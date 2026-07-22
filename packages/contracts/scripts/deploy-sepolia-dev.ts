import fs from "fs";
import { isAddress } from "ethers";
import hre from "hardhat";
import path from "path";
import { fileURLToPath } from "url";

import {
  assertSepoliaDeploymentNetwork,
  assertSepoliaDeploymentNetworkName,
  requireSepoliaDevCredentials,
} from "./deployment-policy.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  requireSepoliaDevCredentials(process.env);

  const connection = await hre.network.create();
  assertSepoliaDeploymentNetworkName(connection.networkName);

  const { ethers } = connection;

  const chain = await ethers.provider.getNetwork();
  assertSepoliaDeploymentNetwork({
    networkName: connection.networkName,
    chainId: chain.chainId,
  });

  const [deployer] = await ethers.getSigners();
  // This script is intentionally a temporary-signer demo. A configurable
  // external owner would make the demo writes fail or, worse, look like
  // custody evidence. Use deploy:sepolia-staging for sponsor-owned contracts.
  const initialOwner = deployer.address;
  const demoFanAddress = resolveDemoFanAddress(deployer.address);
  const deployerBalance = await ethers.provider.getBalance(deployer.address);

  if (deployerBalance === 0n) {
    throw new Error(
      "Sepolia dev deployer has zero balance. Fund the temporary test wallet with Sepolia ETH before deploying.",
    );
  }

  const Ticket = await ethers.getContractFactory("FanPassTicket");
  const ticket = await Ticket.deploy(initialOwner);
  await ticket.waitForDeployment();

  const AccessBadge = await ethers.getContractFactory("FanPassSoulbound");
  const accessBadge = await AccessBadge.deploy(initialOwner);
  await accessBadge.waitForDeployment();

  const RedemptionRegistry =
    await ethers.getContractFactory("RedemptionRegistry");
  const redemptionRegistry = await RedemptionRegistry.deploy(initialOwner);
  await redemptionRegistry.waitForDeployment();

  const ticketTx = await ticket.mintTicketWithProof(
    demoFanAddress,
    1001,
    ethers.id("ticket:sepolia-dev:001"),
    ethers.id("ticket-type:general-admission"),
    ethers.id("policy:transferable:cap-1500:max-1"),
    ethers.id("metadata:sepolia-dev-ticket"),
    true,
    1500,
    1,
    "ipfs://fanpass-sepolia-dev-ticket",
  );
  await ticketTx.wait();

  const badgeTx = await accessBadge.mintLockedWithProof(
    demoFanAddress,
    ethers.id("event:sepolia-dev"),
    ethers.id("access-badge:verified-fan"),
    ethers.id("fan:sepolia-dev"),
    ethers.id("metadata:sepolia-dev-access-badge"),
    "ipfs://fanpass-sepolia-dev-access-badge",
  );
  await badgeTx.wait();

  const redemptionTx = await redemptionRegistry.markRedeemedWithContext(
    await ticket.getAddress(),
    1,
    ethers.id("event:sepolia-dev"),
    ethers.id("gate:A1"),
    ethers.id("credential:sepolia-dev"),
    ethers.id("redemption:sepolia-dev"),
  );
  await redemptionTx.wait();

  const fullArtifact = {
    ok: true,
    mode: "sepolia-dev-temporary-signer",
    custodyEvidence: false,
    chainCustodyBlockerClosed: false,
    demoOwnerIsTemporaryDeployer: true,
    warning:
      "Development deployment only. Do not use this artifact as release or chain custody evidence.",
    network: connection.networkName,
    chainId: chain.chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    initialOwner,
    demoFan: demoFanAddress,
    deployerBalanceEth: ethers.formatEther(deployerBalance),
    contracts: {
      fanPassTicket: await ticket.getAddress(),
      fanPassSoulbound: await accessBadge.getAddress(),
      redemptionRegistry: await redemptionRegistry.getAddress(),
    },
    deploymentTransactions: {
      fanPassTicket: ticket.deploymentTransaction()?.hash ?? null,
      fanPassSoulbound: accessBadge.deploymentTransaction()?.hash ?? null,
      redemptionRegistry:
        redemptionRegistry.deploymentTransaction()?.hash ?? null,
    },
    demoTransactions: {
      ticketMint: ticketTx.hash,
      accessBadgeMint: badgeTx.hash,
      redemptionRecorded: redemptionTx.hash,
    },
    demo: {
      ticketTokenId: "1",
      accessBadgeTokenId: "1",
      redemptionRecorded: true,
    },
    nextStep:
      "When moving beyond dev-only testing, transfer ownership to Safe/Timelock and replace temporary signer with delegated signer or vault/KMS evidence.",
  };

  const artifactPath = writeLocalArtifact(fullArtifact);
  const redactedSummary = {
    ok: true,
    mode: fullArtifact.mode,
    custodyEvidence: false,
    chainCustodyBlockerClosed: false,
    network: fullArtifact.network,
    chainId: fullArtifact.chainId,
    deployer: shortenAddress(fullArtifact.deployer),
    initialOwner: shortenAddress(fullArtifact.initialOwner),
    demoFan: shortenAddress(fullArtifact.demoFan),
    deployerBalanceEth: fullArtifact.deployerBalanceEth,
    contracts: Object.fromEntries(
      Object.entries(fullArtifact.contracts).map(([key, value]) => [
        key,
        shortenAddress(value),
      ]),
    ),
    demo: fullArtifact.demo,
    localArtifactPath: artifactPath,
    warning: fullArtifact.warning,
  };

  console.log(JSON.stringify(redactedSummary, null, 2));
}

function resolveDemoFanAddress(deployerAddress: string): string {
  const configuredDemoFan = process.env.FANPASS_SEPOLIA_DEV_DEMO_FAN;
  if (!configuredDemoFan) {
    return deployerAddress;
  }
  if (!isAddress(configuredDemoFan)) {
    throw new Error("FANPASS_SEPOLIA_DEV_DEMO_FAN is not a valid address.");
  }
  return configuredDemoFan;
}

function writeLocalArtifact(artifact: unknown): string {
  const rootDir = path.resolve(scriptDir, "..", "..", "..");
  const outputDir = path.join(rootDir, ".fanpass-local", "chain-dev");
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const fileName = `sepolia-dev-deployment-${compactTimestamp()}.json`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`, {
    mode: 0o600,
  });
  return filePath;
}

function compactTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

function shortenAddress(value: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        mode: "sepolia-dev-temporary-signer",
        custodyEvidence: false,
        chainCustodyBlockerClosed: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
