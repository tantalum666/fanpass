import fs from "fs";
import path from "path";
import { ethers, network } from "hardhat";

const SEPOLIA_CHAIN_ID = 11155111n;

async function main() {
  assertSepoliaDevGate();

  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Refusing dev deployment on chain ${chain.chainId}; expected Sepolia ${SEPOLIA_CHAIN_ID}`,
    );
  }

  const [deployer] = await ethers.getSigners();
  const initialOwner = resolveInitialOwner(deployer.address);
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
    warning:
      "Development deployment only. Do not use this artifact as release or chain custody evidence.",
    network: network.name,
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

function assertSepoliaDevGate() {
  if (network.name !== "sepoliaDev") {
    throw new Error(
      "Use the sepoliaDev Hardhat network for this script: npm run deploy:sepolia-dev -w packages/contracts",
    );
  }

  if (process.env.FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY !== "true") {
    throw new Error(
      "Refusing to use a temporary hot key. Set FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY=true only for Sepolia dev-only deployment.",
    );
  }

  const rpcUrl = process.env.FANPASS_SEPOLIA_RPC_URL;
  if (!rpcUrl || !/^https:\/\//.test(rpcUrl)) {
    throw new Error(
      "FANPASS_SEPOLIA_RPC_URL must be set to an HTTPS Sepolia RPC URL. Do not commit or save the raw URL in evidence.",
    );
  }

  const privateKey = process.env.FANPASS_SEPOLIA_DEV_PRIVATE_KEY;
  if (!privateKey || !/^(0x)?[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error(
      "FANPASS_SEPOLIA_DEV_PRIVATE_KEY must be a temporary Sepolia-only private key. Never paste it into chat or commit it.",
    );
  }
}

function resolveInitialOwner(deployerAddress: string): string {
  const configuredOwner = process.env.FANPASS_SEPOLIA_DEV_INITIAL_OWNER;
  if (!configuredOwner) {
    return deployerAddress;
  }
  if (!ethers.isAddress(configuredOwner)) {
    throw new Error("FANPASS_SEPOLIA_DEV_INITIAL_OWNER is not a valid address.");
  }
  return configuredOwner;
}

function resolveDemoFanAddress(deployerAddress: string): string {
  const configuredDemoFan = process.env.FANPASS_SEPOLIA_DEV_DEMO_FAN;
  if (!configuredDemoFan) {
    return deployerAddress;
  }
  if (!ethers.isAddress(configuredDemoFan)) {
    throw new Error("FANPASS_SEPOLIA_DEV_DEMO_FAN is not a valid address.");
  }
  return configuredDemoFan;
}

function writeLocalArtifact(artifact: unknown): string {
  const rootDir = path.resolve(__dirname, "..", "..", "..");
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
