import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export function writeProtectedDeploymentArtifact(options: {
  rootDir: string;
  prefix: string;
  artifact: unknown;
  now?: Date;
}): string {
  const journal = createProtectedDeploymentJournal({
    rootDir: options.rootDir,
    prefix: options.prefix,
    initialArtifact: options.artifact,
    now: options.now,
  });
  return journal.filePath;
}

export function createProtectedDeploymentJournal(options: {
  rootDir: string;
  prefix: string;
  initialArtifact: unknown;
  now?: Date;
}): { filePath: string; update: (artifact: unknown) => void } {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(options.prefix)) {
    throw new Error("Protected artifact prefix is invalid.");
  }
  const outputDir = path.join(
    options.rootDir,
    ".fanpass-local",
    "chain-staging",
  );
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(outputDir, 0o700);

  const timestamp = (options.now ?? new Date())
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "Z");
  const fileName = `${options.prefix}-${timestamp}-${randomUUID().slice(0, 8)}.json`;
  const filePath = path.join(outputDir, fileName);
  writeExclusiveJson(filePath, options.initialArtifact);

  return {
    filePath,
    update: (artifact) => replaceJsonAtomically(filePath, artifact),
  };
}

function writeExclusiveJson(filePath: string, artifact: unknown): void {
  const contents = serializeArtifact(artifact);
  const descriptor = fs.openSync(filePath, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, contents, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.chmodSync(filePath, 0o600);
}

function replaceJsonAtomically(filePath: string, artifact: unknown): void {
  const temporaryPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  writeExclusiveJson(temporaryPath, artifact);
  fs.renameSync(temporaryPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function serializeArtifact(artifact: unknown): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export function redactAddress(value: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return "[invalid-address-redacted]";
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function redactHash(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return "[invalid-hash-redacted]";
  }
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function redactDigest(value: string): string {
  if (!/^sha256:[a-fA-F0-9]{64}$/.test(value)) {
    return "[invalid-digest-redacted]";
  }
  return `${value.slice(0, 15)}...${value.slice(-8)}`;
}

export function protectedArtifactLabel(filePath: string): string {
  return path.basename(filePath);
}
