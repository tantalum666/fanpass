const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_CHAIN_OPERATOR_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_CHAIN_OPERATOR_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

auditOwnershipService();
auditProductionRuntimeGuard();
auditLocalRuntimeDefaults();
auditPrivateKeyMaterial();
auditCompositeVerifier();
auditDocs();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      ownershipBoundary:
        "testnet signer remains isolated behind OwnershipService and blocked in production-like runtimes",
      keyMaterial:
        "operator private-key examples remain placeholders and no committed exact key assignments were found",
      remainingBlocker:
        "real pilot still requires vault/KMS or delegated signer plus multisig/timelock contract ownership",
    },
    null,
    2,
  ),
);

function auditOwnershipService() {
  const contents = readFile(
    "apps/api/src/modules/ownership/ownership.service.ts",
  );

  requireMarkers(
    "apps/api/src/modules/ownership/ownership.service.ts",
    contents,
    [
      "isProductionLikeEnvironment",
      'this.config.get<string>("OWNERSHIP_ADAPTER") !== "testnet"',
      "OWNERSHIP_ADAPTER=testnet is blocked in production-like environments",
      'this.requiredConfig("TESTNET_OPERATOR_PRIVATE_KEY")',
      'await import("ethers")',
      "new Wallet(privateKey, provider)",
    ],
  );

  if (/\bimport\s+[^;\n]*\s+from\s+["']ethers["']/.test(contents)) {
    errors.push(
      "OwnershipService must dynamically import ethers only inside the testnet adapter path.",
    );
  }

  for (const pattern of [
    /console\.(log|info|warn|error)\([^)]*privateKey/i,
    /logger\.(log|debug|verbose|warn|error)\([^)]*privateKey/i,
    /transactionHash:\s*privateKey/,
    /ownershipRef:\s*privateKey/,
  ]) {
    if (pattern.test(contents)) {
      errors.push(
        "OwnershipService must not log, return, or persist the operator private key.",
      );
      break;
    }
  }
}

function auditProductionRuntimeGuard() {
  const contents = readFile("apps/api/src/config/security-config.ts");

  requireMarkers("apps/api/src/config/security-config.ts", contents, [
    "validateOwnershipConfiguration(config, errors)",
    'stringValue(config.OWNERSHIP_ADAPTER) !== "testnet"',
    "OWNERSHIP_ADAPTER=testnet is blocked in production-like environments",
  ]);
}

function auditLocalRuntimeDefaults() {
  requireMarkers(
    "scripts/beta-local-start.sh",
    readFile("scripts/beta-local-start.sh"),
    ["OWNERSHIP_ADAPTER=mock", "FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true"],
  );

  const stagingEnv = readOptionalFile("apps/api/.env.staging.example");
  if (stagingEnv && !/OWNERSHIP_ADAPTER=mock/.test(stagingEnv)) {
    errors.push(
      "apps/api/.env.staging.example must keep OWNERSHIP_ADAPTER=mock until a vault/KMS or delegated signer is configured.",
    );
  }
}

function auditPrivateKeyMaterial() {
  const scannedFiles = listFiles(rootDir).filter((absolutePath) => {
    const relativePath = normalize(path.relative(rootDir, absolutePath));
    if (
      relativePath.includes("/node_modules/") ||
      relativePath.includes("/dist/") ||
      relativePath.includes("/.next/") ||
      relativePath.includes("/coverage/") ||
      relativePath.includes("/artifacts/") ||
      relativePath.includes("/cache/") ||
      relativePath.includes("/DerivedData/")
    ) {
      return false;
    }
    return (
      /\.(ts|tsx|js|sh|md|yml|yaml|json|example)$/.test(relativePath) ||
      relativePath.endsWith(".env.example") ||
      relativePath.endsWith(".env.staging.example") ||
      relativePath === ".gitignore"
    );
  });

  const exactPrivateKeyAssignment =
    /(TESTNET_OPERATOR_PRIVATE_KEY|OPERATOR_PRIVATE_KEY|PRIVATE_KEY)\s*=\s*["']?(0x[a-fA-F0-9]{64})["']?/;
  const ellipsisOperatorKey = /TESTNET_OPERATOR_PRIVATE_KEY\s*=\s*0x\.\.\./;

  for (const absolutePath of scannedFiles) {
    const relativePath = normalize(path.relative(rootDir, absolutePath));
    const contents = fs.readFileSync(absolutePath, "utf8");
    const exactMatch = contents.match(exactPrivateKeyAssignment);
    if (exactMatch) {
      errors.push(
        `${relativePath} appears to contain an exact ${exactMatch[1]} assignment; use a placeholder and keep real keys out of git.`,
      );
    }
    if (ellipsisOperatorKey.test(contents)) {
      errors.push(
        `${relativePath} must not document TESTNET_OPERATOR_PRIVATE_KEY with a copyable 0x... pattern; use a non-secret placeholder label.`,
      );
    }
  }

  requireMarkers("apps/api/.env.example", readFile("apps/api/.env.example"), [
    "OWNERSHIP_ADAPTER=mock",
    "TESTNET_RPC_URL=",
    "TESTNET_OPERATOR_PRIVATE_KEY=replace-with-non-production-testnet-operator-private-key",
    "FANPASS_TICKET_CONTRACT_ADDRESS=",
  ]);

  requireMarkers("docs/ALPHA_RUNBOOK.md", readFile("docs/ALPHA_RUNBOOK.md"), [
    "TESTNET_OPERATOR_PRIVATE_KEY=replace-with-non-production-testnet-operator-private-key",
    "never commit, log, or paste a real private key",
  ]);
}

function auditCompositeVerifier() {
  const contents = readFile("scripts/beta-foundation-verify.sh");
  const selfTest = "security:chain-operator-key:self-test";
  const audit = "security:chain-operator-key";
  if (!contents.includes(selfTest) || !contents.includes(audit)) {
    errors.push(
      "scripts/beta-foundation-verify.sh must run chain operator key self-test and audit.",
    );
    return;
  }
  if (contents.indexOf(selfTest) > contents.indexOf(audit)) {
    errors.push(
      "scripts/beta-foundation-verify.sh must run chain operator key self-test before the real audit.",
    );
  }
}

function auditDocs() {
  requireMarkers(
    "docs/ALPHA_SECURITY_REVIEW.md",
    readFile("docs/ALPHA_SECURITY_REVIEW.md"),
    [
      "ASR-014 - Chain operator key model is centralized",
      "Status after Security Pass 82",
      "security:chain-operator-key",
      "vault/KMS",
      "delegated signer",
      "multisig/timelock",
    ],
  );

  requireMarkers("docs/QA_CHECKLIST.md", readFile("docs/QA_CHECKLIST.md"), [
    "security:chain-operator-key:self-test",
    "security:chain-operator-key",
    "operator private key",
  ]);
}

function requireMarkers(relativePath, contents, markers) {
  for (const marker of markers) {
    if (!contents.includes(marker)) {
      errors.push(`${relativePath} is missing required marker: ${marker}`);
    }
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function readOptionalFile(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git" || entry.name === "node_modules") {
        return [];
      }
      return listFiles(absolutePath);
    }
    return [absolutePath];
  });
}

function normalize(filePath) {
  return filePath.split(path.sep).join("/");
}
