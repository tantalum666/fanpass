import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { OwnershipService } from "../modules/ownership/ownership.service";

interface LocalDeploymentArtifact {
  deployer?: string;
  contracts?: {
    fanPassTicket?: string;
  };
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        mode: "sepolia-dev-ownership-smoke",
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

async function main() {
  const rootDir = path.resolve(__dirname, "../../../..");
  loadLocalEnv(path.join(rootDir, ".env.local"));
  loadLocalEnv(path.join(rootDir, "packages", "contracts", ".env.local"));

  if (process.env.FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY !== "true") {
    throw new Error(
      "FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY=true is required for dev-only Sepolia smoke testing.",
    );
  }

  const deployment = readLatestDeployment(rootDir);
  const ticketContract = firstAddress(
    process.env.FANPASS_TICKET_CONTRACT_ADDRESS,
    deployment.contracts?.fanPassTicket,
  );
  if (!isAddress(ticketContract)) {
    throw new Error(
      "FANPASS_TICKET_CONTRACT_ADDRESS or latest local deployment artifact is required.",
    );
  }
  const deployer = deployment.deployer;
  if (!isAddress(deployer)) {
    throw new Error(
      "Latest local deployment artifact does not include deployer.",
    );
  }

  const ownership = new OwnershipService(
    new ConfigService({
      OWNERSHIP_ADAPTER: "testnet",
      FANPASS_ENV: "local",
      TESTNET_RPC_URL: requiredEnv("FANPASS_SEPOLIA_RPC_URL"),
      TESTNET_OPERATOR_PRIVATE_KEY: requiredEnv(
        "FANPASS_SEPOLIA_DEV_PRIVATE_KEY",
      ),
      FANPASS_TICKET_CONTRACT_ADDRESS: ticketContract,
    }),
  );

  const unique = Date.now().toString(36);
  const ticketId = `tkt_sepolia_smoke_${unique}`;
  const issue = await ownership.issueTicket({
    localTicketId: ticketId,
    tokenIdHint: "0",
    eventId: `evt_sepolia_smoke_${unique}`,
    ticketTypeId: "tt_sepolia_smoke_general",
    ownerId: "usr_sepolia_smoke_owner",
    ownerWalletAddress: deployer,
    transferable: true,
    resaleCap: 1500,
    maxTransferCount: 1,
    metadataUri: null,
  });
  const buyerAddress = devOnlyAddress("3001");
  const transfer = await ownership.transferTicket({
    ticketId,
    tokenId: issue.tokenId,
    fromOwnerId: "usr_sepolia_smoke_owner",
    fromWalletAddress: deployer,
    toOwnerId: "usr_sepolia_smoke_buyer",
    toWalletAddress: buyerAddress,
  });
  const redeem = await ownership.redeemTicket({
    ticketId,
    tokenId: issue.tokenId,
  });

  const artifact = {
    ok: true,
    mode: "sepolia-dev-ownership-smoke",
    custodyEvidence: false,
    chainCustodyBlockerClosed: false,
    checkedAt: new Date().toISOString(),
    contract: ticketContract,
    issue,
    transfer,
    redeem,
  };
  const artifactPath = writeArtifact(rootDir, artifact);

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: artifact.mode,
        custodyEvidence: false,
        chainCustodyBlockerClosed: false,
        contract: shortenAddress(ticketContract),
        tokenId: issue.tokenId,
        issue: redactReceipt(issue),
        transfer: redactReceipt(transfer),
        redeem: redactReceipt(redeem),
        localArtifactPath: artifactPath,
      },
      null,
      2,
    ),
  );
}

function requiredEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function loadLocalEnv(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }
    process.env[match[1]] = unquote(match[2].trim());
  }
}

function readLatestDeployment(rootDir: string): LocalDeploymentArtifact {
  const outputDir = path.join(rootDir, ".fanpass-local", "chain-dev");
  const files = fs.existsSync(outputDir)
    ? fs
        .readdirSync(outputDir)
        .filter((file) => /^sepolia-dev-deployment-.+\.json$/.test(file))
        .sort()
    : [];
  const latest = files.at(-1);
  if (!latest) {
    throw new Error("No local Sepolia dev deployment artifact exists.");
  }
  return JSON.parse(
    fs.readFileSync(path.join(outputDir, latest), "utf8"),
  ) as LocalDeploymentArtifact;
}

function writeArtifact(rootDir: string, artifact: unknown) {
  const outputDir = path.join(rootDir, ".fanpass-local", "chain-dev");
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const filePath = path.join(
    outputDir,
    `sepolia-dev-ownership-smoke-${compactTimestamp()}.json`,
  );
  fs.writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`, {
    mode: 0o600,
  });
  return filePath;
}

function compactTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

function redactReceipt(receipt: {
  adapter: string;
  status: string;
  tokenId: string;
  ownershipRef: string;
  transactionHash: string | null;
}) {
  return {
    adapter: receipt.adapter,
    status: receipt.status,
    tokenId: receipt.tokenId,
    ownershipRef: shortenOwnershipRef(receipt.ownershipRef),
    transactionHash: shortenHash(receipt.transactionHash),
  };
}

function shortenOwnershipRef(value: string) {
  const [contract, tokenId] = value.split(":");
  return `${shortenAddress(contract)}:${tokenId ?? ""}`;
}

function shortenAddress(value: string | undefined) {
  if (!isAddress(value)) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function shortenHash(value: string | null) {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return value ?? null;
  }
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function devOnlyAddress(suffix: string) {
  return `0x${suffix.padStart(40, "0")}`;
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function firstAddress(...values: Array<string | undefined>) {
  return values.find((value) => isAddress(value));
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
