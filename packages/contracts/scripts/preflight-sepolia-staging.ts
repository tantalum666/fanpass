import { JsonRpcProvider } from "ethers";
import hre from "hardhat";
import path from "path";
import { fileURLToPath } from "url";

import {
  assertSepoliaStagingPreflightIsKeyless,
  requireSepoliaStagingPreflightConfig,
  SEPOLIA_CHAIN_ID,
} from "./deployment-policy.js";
import {
  runDeployedContractsPreflight,
  type DeployedContractArtifact,
} from "./deployed-contract-preflight.js";
import {
  protectedArtifactLabel,
  redactAddress,
  redactDigest,
  redactHash,
  writeProtectedDeploymentArtifact,
} from "./protected-deployment-artifact.js";
import {
  createReviewedBuildManifest,
  type ReviewedBuildArtifact,
} from "./reviewed-build-manifest.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..", "..", "..");

async function main(): Promise<void> {
  let phase = "CONFIGURATION";
  try {
    assertSepoliaStagingPreflightIsKeyless(process.env);
    const config = requireSepoliaStagingPreflightConfig(process.env);
    if (!config.directTransferProbeTicketIdHash) {
      throw new Error(
        "Cutover preflight requires FANPASS_SEPOLIA_STAGING_POLICY_PROBE_TICKET_ID_HASH.",
      );
    }

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
    if (reviewedBuild.manifestSha256 !== config.expectedBuildManifestSha256) {
      throw new Error(
        "Current reviewed build does not match the protected migration build digest.",
      );
    }

    phase = "READ_ONLY_CHAIN_PREFLIGHT";
    // Do not provide a static network: the endpoint must prove its own chain id.
    // Supplying one here would let a misrouted RPC appear to be Sepolia.
    const provider = new JsonRpcProvider(config.rpcUrl);
    const result = await runDeployedContractsPreflight({
      provider,
      mode: "CUTOVER",
      expectedChainId: SEPOLIA_CHAIN_ID,
      sponsorAddress: config.sponsorAddress,
      addresses: config.contracts,
      artifacts,
      directTransferProbeTicketIdHash: config.directTransferProbeTicketIdHash,
    });

    phase = "ARTIFACT_WRITE";
    const artifactPath = writeProtectedDeploymentArtifact({
      rootDir,
      prefix: "sepolia-staging-preflight",
      artifact: {
        schemaVersion: 1,
        ...result,
        mode: "sepolia-staging-cutover-preflight",
        readOnly: true,
        reviewedBuild,
        providerCredentialsPersisted: false,
        custodyEvidence: false,
        warning:
          "This proves reviewed Sepolia bytecode and owner state, not Privy provider control or production custody by itself.",
      },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "sepolia-staging-cutover-preflight",
          readOnly: true,
          chainId: result.chainId,
          sponsorOwner: redactAddress(result.expectedOwner),
          contracts: Object.fromEntries(
            Object.entries(result.contracts).map(([name, contract]) => [
              name,
              {
                address: redactAddress(contract.address),
                runtimeBytecodeHash: redactHash(contract.runtimeBytecodeHash),
                ownerVerified: contract.owner === result.expectedOwner,
              },
            ]),
          ),
          ticketIdGetterVerified: result.ticketIdGetter.tokenId === "0",
          directTransferPolicy: result.directTransferPolicy.status,
          reviewedBuildManifest: redactDigest(reviewedBuild.manifestSha256),
          directTransferEntrypoints:
            result.directTransferPolicy.status === "BLOCKED_AS_REQUIRED"
              ? result.directTransferPolicy.entrypoints
              : [],
          protectedArtifact: protectedArtifactLabel(artifactPath),
          custodyEvidence: false,
        },
        null,
        2,
      ),
    );
  } catch {
    console.error(
      JSON.stringify(
        {
          ok: false,
          mode: "sepolia-staging-cutover-preflight",
          readOnly: true,
          phase,
          errorCode: "SEPOLIA_STAGING_PREFLIGHT_FAILED",
          message:
            "Preflight stopped fail-closed. Check protected configuration locally without sharing provider errors or secrets.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main();
