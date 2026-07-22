import { ContractFactory, Wallet } from "ethers";
import hre from "hardhat";
import path from "path";
import { fileURLToPath } from "url";

import {
  assertSepoliaStagingDeploymentNetwork,
  assertSepoliaStagingDeploymentNetworkName,
  requireSepoliaStagingMigrationConfig,
  SEPOLIA_CHAIN_ID,
} from "./deployment-policy.js";
import {
  runDeployedContractsPreflight,
  type DeployedContractArtifact,
} from "./deployed-contract-preflight.js";
import {
  createProtectedDeploymentJournal,
  protectedArtifactLabel,
  redactAddress,
  redactDigest,
  redactHash,
} from "./protected-deployment-artifact.js";
import {
  createReviewedBuildManifest,
  type ReviewedBuildArtifact,
} from "./reviewed-build-manifest.js";
import { deployFanPassStagingContracts } from "./staging-deployment.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..", "..", "..");

async function main(): Promise<void> {
  let journal: ReturnType<typeof createProtectedDeploymentJournal> | undefined;
  let protectedArtifact: Record<string, unknown> | undefined;
  let phase = "CONFIGURATION";

  try {
    const config = requireSepoliaStagingMigrationConfig(process.env);
    protectedArtifact = {
      schemaVersion: 1,
      ok: false,
      mode: "sepolia-staging-migration",
      status: "INITIALIZED",
      phase,
      custodyEvidence: false,
      secretMaterialPersisted: false,
      demoMutationsExecuted: false,
      warning:
        "Public Sepolia deployment state only. Privy sponsor provenance and release custody require separate provider evidence.",
      sponsorAddress: config.sponsorAddress,
      deployerAddress: config.deployerAddress,
      contracts: {},
      deploymentTransactions: {},
      startedAt: new Date().toISOString(),
    };
    journal = createProtectedDeploymentJournal({
      rootDir,
      prefix: "sepolia-staging-migration",
      initialArtifact: protectedArtifact,
    });

    phase = "REVIEWED_BUILD_BINDING";
    const artifacts = {
      fanPassTicket: (await hre.artifacts.readArtifact(
        "FanPassTicket",
      )) as DeployedContractArtifact & ReviewedBuildArtifact,
      fanPassSoulbound: (await hre.artifacts.readArtifact(
        "FanPassSoulbound",
      )) as DeployedContractArtifact & ReviewedBuildArtifact,
      redemptionRegistry: (await hre.artifacts.readArtifact(
        "RedemptionRegistry",
      )) as DeployedContractArtifact & ReviewedBuildArtifact,
    };
    const reviewedBuild = createReviewedBuildManifest({
      packageRoot: path.resolve(scriptDir, ".."),
      artifacts: Object.values(artifacts),
    });
    protectedArtifact = {
      ...protectedArtifact,
      phase,
      reviewedBuild,
    };
    journal.update(protectedArtifact);

    phase = "NETWORK_VALIDATION";
    const connection = await hre.network.create();
    assertSepoliaStagingDeploymentNetworkName(connection.networkName);
    const { ethers } = connection;
    const network = await ethers.provider.getNetwork();
    assertSepoliaStagingDeploymentNetwork({
      networkName: connection.networkName,
      chainId: network.chainId,
    });

    const temporaryDeployer = new Wallet(config.privateKey, ethers.provider);
    if (temporaryDeployer.address !== config.deployerAddress) {
      throw new Error("Temporary deployer address derivation mismatch.");
    }
    const deployerBalance = await ethers.provider.getBalance(
      temporaryDeployer.address,
    );
    if (deployerBalance === 0n) {
      throw new Error("Temporary Sepolia deployer has zero balance.");
    }

    protectedArtifact = {
      ...protectedArtifact,
      phase,
      network: connection.networkName,
      chainId: network.chainId.toString(),
      deployerBalanceEth: ethers.formatEther(deployerBalance),
    };
    journal.update(protectedArtifact);

    phase = "CONTRACT_DEPLOYMENT";
    const partialContracts: Record<string, string> = {};
    const partialTransactions: Record<string, string> = {};
    const deployment = await deployFanPassStagingContracts({
      sponsorAddress: config.sponsorAddress,
      confirmations: 2,
      ticketFactory: new ContractFactory(
        artifacts.fanPassTicket.abi,
        artifacts.fanPassTicket.bytecode,
        temporaryDeployer,
      ),
      soulboundFactory: new ContractFactory(
        artifacts.fanPassSoulbound.abi,
        artifacts.fanPassSoulbound.bytecode,
        temporaryDeployer,
      ),
      redemptionRegistryFactory: new ContractFactory(
        artifacts.redemptionRegistry.abi,
        artifacts.redemptionRegistry.bytecode,
        temporaryDeployer,
      ),
      onContractDeployed: (name, record) => {
        partialContracts[name] = record.address;
        partialTransactions[name] = record.transactionHash;
        protectedArtifact = {
          ...protectedArtifact,
          phase,
          contracts: { ...partialContracts },
          deploymentTransactions: { ...partialTransactions },
        };
        journal?.update(protectedArtifact);
      },
    });

    phase = "READ_ONLY_PREFLIGHT";
    const preflight = await runDeployedContractsPreflight({
      provider: ethers.provider,
      mode: "BASE",
      expectedChainId: SEPOLIA_CHAIN_ID,
      sponsorAddress: config.sponsorAddress,
      addresses: deployment.contracts,
      artifacts,
    });

    protectedArtifact = {
      ...protectedArtifact,
      ok: true,
      status: "DEPLOYED_AND_BASE_PREFLIGHT_VERIFIED",
      phase: "COMPLETE",
      contracts: deployment.contracts,
      deploymentTransactions: deployment.deploymentTransactions,
      preflight,
      completedAt: new Date().toISOString(),
      nextRequiredControl:
        "Create a non-user policy-probe ticket through the Privy-sponsored ownership outbox, then run the keyless preflight with its ticket id hash before worker cutover.",
    };
    journal.update(protectedArtifact);

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "sepolia-staging-migration",
          status: "DEPLOYED_AND_BASE_PREFLIGHT_VERIFIED",
          custodyEvidence: false,
          demoMutationsExecuted: false,
          network: connection.networkName,
          chainId: network.chainId.toString(),
          deployer: redactAddress(config.deployerAddress),
          sponsorOwner: redactAddress(config.sponsorAddress),
          contracts: Object.fromEntries(
            Object.entries(deployment.contracts).map(([name, address]) => [
              name,
              redactAddress(address),
            ]),
          ),
          deploymentTransactions: Object.fromEntries(
            Object.entries(deployment.deploymentTransactions).map(
              ([name, hash]) => [name, redactHash(hash)],
            ),
          ),
          ownerVerified: true,
          runtimeBytecodeVerified: true,
          reviewedBuildManifest: redactDigest(reviewedBuild.manifestSha256),
          directTransferPolicy: "NOT_RUN_NO_PROBE",
          protectedArtifact: protectedArtifactLabel(journal.filePath),
          warning:
            "Base chain state verified. Do not resume staging workers until the sponsor/outbox policy probe and cutover runbook pass.",
        },
        null,
        2,
      ),
    );
  } catch {
    let artifactUpdateFailed = false;
    if (journal && protectedArtifact) {
      try {
        protectedArtifact = {
          ...protectedArtifact,
          ok: false,
          status: "FAILED",
          phase,
          failedAt: new Date().toISOString(),
          failureCode: "SEPOLIA_STAGING_MIGRATION_FAILED",
        };
        journal.update(protectedArtifact);
      } catch {
        artifactUpdateFailed = true;
      }
    }
    console.error(
      JSON.stringify(
        {
          ok: false,
          mode: "sepolia-staging-migration",
          status: "FAILED",
          phase,
          errorCode: "SEPOLIA_STAGING_MIGRATION_FAILED",
          protectedArtifact: journal
            ? protectedArtifactLabel(journal.filePath)
            : null,
          artifactUpdateFailed,
          message:
            "Migration stopped fail-closed. Inspect the protected local artifact and configuration without sharing secrets.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main();
