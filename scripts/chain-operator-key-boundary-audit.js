const fs = require("fs");
const path = require("path");
const {
  callPath,
  descendants,
  expressionPath,
  findClass,
  moduleReferences,
  parseTypeScript,
  ts,
  unwrapExpression,
} = require("./lib/typescript-audit");
const { validateOwnershipBoundary } = require("./lib/ownership-boundary-audit");
const {
  assertOrderedNpmScripts,
  loadBetaFoundationGateSteps,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = process.env.FANPASS_CHAIN_OPERATOR_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_CHAIN_OPERATOR_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];
const betaGateSteps = loadBetaFoundationGateSteps(rootDir, errors);

auditOwnershipService();
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
  const relativePath = "apps/api/src/modules/ownership/ownership.service.ts";
  const contents = readFile(relativePath);
  const securityConfigPath = "apps/api/src/config/security-config.ts";
  const boundary = validateOwnershipBoundary({
    ownershipFile: relativePath,
    ownershipContents: contents,
    securityConfigFile: securityConfigPath,
    securityConfigContents: readFile(securityConfigPath),
  });
  errors.push(...boundary.errors);

  let sourceFile;
  try {
    sourceFile = parseTypeScript(relativePath, contents);
  } catch (error) {
    errors.push(error.message);
    return;
  }
  const ethersReferences = moduleReferences(sourceFile).filter(
    (reference) => reference.module === "ethers",
  );
  if (
    ethersReferences.some((reference) => reference.kind !== "dynamic-import")
  ) {
    errors.push(
      "OwnershipService must dynamically import ethers only inside the testnet adapter path.",
    );
  }
  if (ethersReferences.length === 0) {
    errors.push(
      "OwnershipService testnet adapter must load ethers through an executable dynamic import.",
    );
  }

  const testnetAdapter = findClass(sourceFile, "TestnetOwnershipAdapter");
  const testnetEthersImports = testnetAdapter
    ? descendants(
        testnetAdapter,
        (node) =>
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments.length === 1 &&
          ts.isStringLiteralLike(unwrapExpression(node.arguments[0])) &&
          unwrapExpression(node.arguments[0]).text === "ethers",
      )
    : [];
  if (!testnetAdapter || testnetEthersImports.length === 0) {
    errors.push(
      `${relativePath} must keep the executable ethers import inside TestnetOwnershipAdapter.`,
    );
  }
  const requiredPrivateKeyCalls = descendants(
    testnetAdapter ?? sourceFile,
    (node) =>
      ts.isCallExpression(node) &&
      callPath(node) === "this.requiredConfig" &&
      node.arguments.some(
        (argument) =>
          ts.isStringLiteralLike(unwrapExpression(argument)) &&
          unwrapExpression(argument).text === "TESTNET_OPERATOR_PRIVATE_KEY",
      ),
  );
  const walletConstructors = descendants(
    testnetAdapter ?? sourceFile,
    (node) =>
      ts.isNewExpression(node) &&
      expressionPath(node.expression) === "Wallet" &&
      expressionPath(unwrapExpression(node.arguments?.[0])) === "privateKey",
  );
  if (requiredPrivateKeyCalls.length === 0 || walletConstructors.length === 0) {
    errors.push(
      `${relativePath} must obtain TESTNET_OPERATOR_PRIVATE_KEY inside the testnet adapter and pass it directly to the Wallet signer constructor.`,
    );
  }

  const privateKeyLeaks = descendants(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const target = callPath(node) ?? "";
      if (
        !/^(console|logger)\.(log|info|debug|verbose|warn|error)$/.test(target)
      ) {
        return false;
      }
      return node.arguments.some((argument) =>
        descendants(argument, (child) => expressionPath(child) === "privateKey")
          .concat(expressionPath(argument) === "privateKey" ? [argument] : [])
          .some(Boolean),
      );
    }
    if (!ts.isPropertyAssignment(node)) {
      return false;
    }
    const name =
      node.name &&
      (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))
        ? node.name.text
        : "";
    return (
      (name === "transactionHash" || name === "ownershipRef") &&
      expressionPath(unwrapExpression(node.initializer)) === "privateKey"
    );
  });
  if (privateKeyLeaks.length > 0) {
    errors.push(
      "OwnershipService must not log, return, or persist the operator private key.",
    );
  }
}

function auditLocalRuntimeDefaults() {
  const localAssignments = parseActiveAssignments(
    "scripts/beta-local-start.sh",
    readFile("scripts/beta-local-start.sh"),
  );
  requireOnlyAssignments(
    "scripts/beta-local-start.sh",
    localAssignments,
    "OWNERSHIP_ADAPTER",
    "mock",
  );
  requireOnlyAssignments(
    "scripts/beta-local-start.sh",
    localAssignments,
    "FANPASS_ASYNC_OWNERSHIP_SETTLEMENT",
    "true",
  );

  const stagingPath = "apps/api/.env.staging.example";
  const stagingEnv = readOptionalFile(stagingPath);
  if (!stagingEnv) {
    errors.push(
      `${stagingPath} is required for the staging ownership contract.`,
    );
    return;
  }
  const stagingAssignments = parseActiveAssignments(stagingPath, stagingEnv);
  const validAdapter = requireSingleAssignment(
    stagingPath,
    stagingAssignments,
    "OWNERSHIP_ADAPTER",
    "privy",
  );
  const validOutbox = requireSingleAssignment(
    stagingPath,
    stagingAssignments,
    "FANPASS_CHAIN_PROOF_SYNC_OUTBOX",
    "true",
  );
  if (!validAdapter || !validOutbox) {
    errors.push(
      "apps/api/.env.staging.example must use the fail-closed Privy adapter with durable outbox proof sync.",
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
  assertOrderedNpmScripts(
    betaGateSteps,
    ["security:chain-operator-key:self-test", "security:chain-operator-key"],
    errors,
  );
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

function parseActiveAssignments(relativePath, contents) {
  const assignments = new Map();
  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(
      /^(?:export\s+)?([A-Z][A-Z0-9_]*)=(?:["']?)([^\s\\#"']+)(?:["']?)(?:\s*\\)?$/,
    );
    if (!match) {
      continue;
    }
    const values = assignments.get(match[1]) ?? [];
    values.push({ line: index + 1, value: match[2] });
    assignments.set(match[1], values);
  }
  return assignments;
}

function requireSingleAssignment(
  relativePath,
  assignments,
  key,
  expectedValue,
) {
  const values = assignments.get(key) ?? [];
  if (values.length !== 1 || values[0].value !== expectedValue) {
    const actual =
      values.length === 0
        ? "missing"
        : values.map((entry) => `${entry.value}@${entry.line}`).join(", ");
    errors.push(
      `${relativePath} must contain exactly one active ${key}=${expectedValue} assignment; found ${actual}.`,
    );
    return false;
  }
  return true;
}

function requireOnlyAssignments(relativePath, assignments, key, expectedValue) {
  const values = assignments.get(key) ?? [];
  if (
    values.length === 0 ||
    values.some((entry) => entry.value !== expectedValue)
  ) {
    const actual =
      values.length === 0
        ? "missing"
        : values.map((entry) => `${entry.value}@${entry.line}`).join(", ");
    errors.push(
      `${relativePath} must set every active ${key} assignment to ${expectedValue}; found ${actual}.`,
    );
    return false;
  }
  return true;
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
