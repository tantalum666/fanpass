import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { OwnershipService } from "../modules/ownership/ownership.service";
import { SideEffectWorkerService } from "../modules/side-effects/side-effect-worker.service";

interface LocalDeploymentArtifact {
  deployer?: string;
  contracts?: {
    fanPassTicket?: string;
  };
}

interface LocalJob {
  id: string;
  type: string;
  status: string;
  idempotencyKey: string;
  aggregateType: string;
  aggregateId: string;
  payloadJson: Record<string, unknown>;
  attempts: number;
  lastError: string | null;
  availableAt: Date;
  lockedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

async function main() {
  const rootDir = path.resolve(__dirname, "../../../..");
  loadLocalEnv(path.join(rootDir, ".env.local"));
  loadLocalEnv(path.join(rootDir, "packages", "contracts", ".env.local"));

  if (process.env.FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY !== "true") {
    throw new Error(
      "FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY=true is required for dev-only Sepolia outbox smoke testing.",
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
  const outbox = new LocalOutbox();
  const worker = new SideEffectWorkerService(
    outbox as never,
    ownership,
    { processCreateIntentJob: unsupportedPaymentJob } as never,
    {
      tryMatch: unsupportedOrderbookJob,
      finalizeOwnershipTransfer: unsupportedOrderbookJob,
    } as never,
  );

  const unique = Date.now().toString(36);
  const ticketId = `tkt_sepolia_outbox_${unique}`;
  outbox.enqueue({
    id: "sfx_issue",
    type: "OWNERSHIP_ISSUE",
    idempotencyKey: `ownership-issue:${ticketId}`,
    aggregateType: "ticket",
    aggregateId: ticketId,
    payloadJson: {
      localTicketId: ticketId,
      tokenIdHint: "0",
      eventId: `evt_sepolia_outbox_${unique}`,
      ticketTypeId: "tt_sepolia_outbox_general",
      ownerId: "usr_sepolia_outbox_owner",
      ownerWalletAddress: deployer,
      transferable: true,
      resaleCap: 1500,
      maxTransferCount: 1,
      metadataUri: null,
    },
  });
  await expectSingleCompletion(worker, "sfx_issue");
  const issue = outbox.result("sfx_issue");
  const tokenId = requiredString(issue.tokenId, "issue tokenId");

  outbox.enqueue({
    id: "sfx_transfer",
    type: "OWNERSHIP_TRANSFER",
    idempotencyKey: `ownership-transfer:${ticketId}:usr_sepolia_outbox_buyer`,
    aggregateType: "ticket",
    aggregateId: ticketId,
    payloadJson: {
      ticketId,
      tokenId,
      fromOwnerId: "usr_sepolia_outbox_owner",
      fromWalletAddress: deployer,
      toOwnerId: "usr_sepolia_outbox_buyer",
      toWalletAddress: devOnlyAddress("4001"),
    },
  });
  await expectSingleCompletion(worker, "sfx_transfer");

  outbox.enqueue({
    id: "sfx_redeem",
    type: "OWNERSHIP_REDEEM",
    idempotencyKey: `ownership-redeem:${ticketId}:${tokenId}`,
    aggregateType: "ticket",
    aggregateId: ticketId,
    payloadJson: {
      ticketId,
      tokenId,
    },
  });
  await expectSingleCompletion(worker, "sfx_redeem");

  const artifact = {
    ok: true,
    mode: "sepolia-dev-outbox-proof-sync-smoke",
    custodyEvidence: false,
    chainCustodyBlockerClosed: false,
    checkedAt: new Date().toISOString(),
    contract: ticketContract,
    issue,
    transfer: outbox.result("sfx_transfer"),
    redeem: outbox.result("sfx_redeem"),
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
        tokenId,
        issue: redactResult(issue),
        transfer: redactResult(outbox.result("sfx_transfer")),
        redeem: redactResult(outbox.result("sfx_redeem")),
        localArtifactPath: artifactPath,
      },
      null,
      2,
    ),
  );
}

class LocalOutbox {
  private readonly queue: LocalJob[] = [];
  private readonly completed = new Map<string, Record<string, unknown>>();

  enqueue(input: {
    id: string;
    type: string;
    idempotencyKey: string;
    aggregateType: string;
    aggregateId: string;
    payloadJson: Record<string, unknown>;
  }) {
    const now = new Date();
    this.queue.push({
      ...input,
      status: "PENDING",
      attempts: 0,
      lastError: null,
      availableAt: now,
      lockedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async recoverStaleProcessingJobs() {
    return { count: 0 };
  }

  async pending(limit = 10) {
    return this.queue.slice(0, limit);
  }

  async claim(job: LocalJob) {
    const index = this.queue.findIndex((candidate) => candidate.id === job.id);
    if (index === -1) {
      return null;
    }
    this.queue.splice(index, 1);
    return {
      ...job,
      status: "PROCESSING",
      attempts: job.attempts + 1,
      lockedAt: new Date(),
    };
  }

  async completeJob(job: LocalJob, result: Record<string, unknown>) {
    const id = job.id;
    this.completed.set(id, result);
    return { ...job, status: "COMPLETED" };
  }

  async retryOrDeadJob(job: LocalJob, error: unknown) {
    const id = job.id;
    throw new Error(
      `Dev-only outbox smoke job ${id} failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  async enqueueStandalone() {
    throw new Error(
      "Standalone nested side-effects are not used in the Sepolia dev outbox smoke.",
    );
  }

  result(id: string) {
    const result = this.completed.get(id);
    if (!result) {
      throw new Error(`Missing completed result for ${id}`);
    }
    return result;
  }
}

async function expectSingleCompletion(
  worker: SideEffectWorkerService,
  jobId: string,
) {
  const result = await worker.workOnce(1);
  if (result.completed !== 1 || result.retried !== 0 || result.dead !== 0) {
    throw new Error(
      `Expected ${jobId} to complete exactly once, got ${JSON.stringify(result)}`,
    );
  }
}

function unsupportedPaymentJob() {
  throw new Error("Payment jobs are not part of this chain smoke.");
}

function unsupportedOrderbookJob() {
  throw new Error("Orderbook jobs are not part of this chain smoke.");
}

function requiredEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} is required`);
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
    `sepolia-dev-outbox-proof-sync-smoke-${compactTimestamp()}.json`,
  );
  fs.writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`, {
    mode: 0o600,
  });
  return filePath;
}

function compactTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

function redactResult(result: Record<string, unknown>) {
  return {
    ownershipAdapter: result.ownershipAdapter,
    status: result.status,
    tokenId: result.tokenId,
    ownershipRef: shortenOwnershipRef(String(result.ownershipRef ?? "")),
    transactionHash: shortenHash(
      typeof result.transactionHash === "string"
        ? result.transactionHash
        : null,
    ),
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

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        mode: "sepolia-dev-outbox-proof-sync-smoke",
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
