const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
const allowedEnvironments = new Set(["testnet", "staging"]);
const allowedSignerProviders = new Set(["vault-kms", "delegated-signer"]);
const implementationSnapshotFiles = [
  "apps/api/src/modules/ownership/ownership.service.ts",
  "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
  "apps/api/src/modules/side-effects/ticket-ownership-side-effects.service.ts",
  "apps/api/src/modules/side-effects/side-effect-outbox.service.ts",
  "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
  "apps/api/src/modules/side-effects/side-effect-health.service.ts",
  "apps/api/src/config/security-config.ts",
  "apps/api/prisma/schema.prisma",
  "scripts/chain-operator-key-boundary-audit.js",
  "scripts/provider-boundary-audit.js",
  "scripts/settlement-retry-idempotency-audit.js",
  "scripts/side-effects-worker-verify.sh",
];
const expectedImplementationSnapshot = implementationSnapshotFiles.map(
  (file) => ({
    file,
    sha256: sha256File(path.join(rootDir, file)),
  }),
);

if (evidenceFiles.length === 0) {
  console.error(
    [
      "Usage: npm run security:chain-custody:evidence -- <evidence-file...>",
      "Validate saved chain custody and contract-control evidence before closing ASR-014 pilot blockers.",
    ].join("\n"),
  );
  process.exit(1);
}

const results = evidenceFiles.map(validateEvidenceFile);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      implementationSnapshot: {
        source: "chain-custody-ownership-outbox-boundaries",
        files: expectedImplementationSnapshot,
      },
      checkedFiles: results.length,
      evidence: results,
    },
    null,
    2,
  ),
);

function validateEvidenceFile(filePath) {
  const absolutePath = path.resolve(rootDir, filePath);
  const relativePath = path.relative(rootDir, absolutePath);
  let raw;
  try {
    raw = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    errors.push(
      `${relativePath}: could not read evidence file: ${error.message}`,
    );
    return { file: relativePath, ok: false };
  }

  validateNoSecretMarkers(relativePath, raw);
  const evidence = extractJsonObject(relativePath, raw);
  if (!evidence) {
    return { file: relativePath, ok: false };
  }

  validateTopLevel(relativePath, evidence);
  validateImplementationSnapshot(relativePath, evidence.implementationSnapshot);
  validateCustody(relativePath, evidence.custody);
  validateContractControl(relativePath, evidence.contractControl);
  validateSideEffects(relativePath, evidence.sideEffects);
  validateOperationalReadiness(relativePath, evidence.operationalReadiness);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    environment: evidence.environment ?? null,
    signerProvider: evidence.custody?.signerProvider ?? null,
    implementationSnapshotFiles:
      evidence.implementationSnapshot?.files?.length ?? null,
    outboxHealthAfterRun: evidence.sideEffects?.outboxHealthAfterRun ?? null,
  };
}

function validateImplementationSnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "chain-custody-ownership-outbox-boundaries") {
    errors.push(
      `${relativePath}: implementationSnapshot.source must be chain-custody-ownership-outbox-boundaries`,
    );
  }
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  if (files.length !== expectedImplementationSnapshot.length) {
    errors.push(
      `${relativePath}: implementationSnapshot.files must include the current chain custody ownership/outbox boundary files`,
    );
  }
  const expectedFiles = new Set(
    expectedImplementationSnapshot.map((entry) => entry.file),
  );
  for (const entry of files) {
    if (!expectedFiles.has(entry?.file)) {
      errors.push(
        `${relativePath}: implementationSnapshot.files contains unexpected file ${entry?.file}`,
      );
    }
  }
  for (const expected of expectedImplementationSnapshot) {
    const actual = files.find((entry) => entry?.file === expected.file);
    if (!actual) {
      errors.push(
        `${relativePath}: implementationSnapshot.files missing ${expected.file}`,
      );
      continue;
    }
    if (actual.sha256 !== expected.sha256) {
      errors.push(
        `${relativePath}: implementationSnapshot.files ${expected.file} sha256 must match the current chain custody ownership/outbox implementation`,
      );
    }
  }
}

function validateNoSecretMarkers(relativePath, raw) {
  const forbiddenMarkers = [
    "Authorization: Bearer ",
    "eyJhbGci",
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN ENCRYPTED PRIVATE KEY-----",
    "-----BEGIN RSA PRIVATE KEY-----",
    "-----BEGIN EC PRIVATE KEY-----",
    "sk_test_",
    "sk_live_",
    "pk_test_",
    "pk_live_",
    "whsec_",
    "STRIPE_SECRET_KEY=",
    "STRIPE_PUBLISHABLE_KEY=",
    "STRIPE_WEBHOOK_SECRET=",
    "PRIVY_APP_SECRET",
    "PRIVY_VERIFICATION_KEY",
    "DATABASE_URL=",
    "RPC_URL=",
    "ALCHEMY_API_KEY",
    "INFURA_API_KEY",
    "ETHERSCAN_API_KEY",
    "TESTNET_OPERATOR_PRIVATE_KEY=",
    "OPERATOR_PRIVATE_KEY=",
    "PRIVATE_KEY=",
    "MNEMONIC=",
    "SEED_PHRASE=",
  ];
  const lowerRaw = raw.toLowerCase();
  for (const marker of forbiddenMarkers) {
    if (lowerRaw.includes(marker.toLowerCase())) {
      errors.push(
        `${relativePath}: evidence must not include secret marker ${marker}`,
      );
    }
  }

  const forbiddenPatterns = [
    {
      pattern: /postgres:\/\/[^\s"']+/i,
      message: "evidence must not include database URLs",
    },
    {
      pattern: /postgresql:\/\/[^\s"']+/i,
      message: "evidence must not include database URLs",
    },
    {
      pattern: /\b[A-Z0-9_]*RPC_URL\s*=\s*https?:\/\/[^\s"']+/i,
      message: "evidence must not include provider RPC URLs",
    },
    {
      pattern: /\b0x[a-fA-F0-9]{64}\b/,
      message:
        "evidence must not include copyable 0x64 private-key or transaction-hash-looking values; redact or shorten them",
    },
    {
      pattern:
        /"(operatorPrivateKey|privateKey|mnemonic|seedPhrase|bearerToken|accessToken|privyAppSecret|privyVerificationKey)"\s*:/i,
      message:
        "evidence must not include raw secret-bearing JSON fields such as privateKey, bearerToken, or accessToken",
    },
    {
      pattern:
        /\b(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)\s*=\s*(?!<)[^\s"']{8,}/i,
      message:
        "evidence must not include deployment or cloud credential assignments",
    },
    {
      pattern:
        /"(?:awsAccessKeyId|awsSecretAccessKey|awsSessionToken|googleApplicationCredentialsJson|googleCredentials|gcpServiceAccountKey|vercelToken|githubToken|ghToken|netlifyAuthToken|cloudflareApiToken|cfApiToken|cloudflareApiKey|cfApiKey)"\s*:\s*"(?!<)[^"]{8,}"/i,
      message:
        "evidence must not include deployment or cloud credential JSON fields",
    },
    {
      pattern:
        /"(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)"\s*:\s*"(?!<)[^"]{8,}"/,
      message:
        "evidence must not include deployment or cloud credential environment fields",
    },
    {
      pattern:
        /(?:::add-mask::(?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,}|::set-secret\s+name=[^:\r\n]+::(?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,}|##vso\[task\.setvariable[^\]\r\n]*issecret=true[^\]\r\n]*\](?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,})/i,
      message:
        "evidence must not include CI secret masking commands with literal values",
    },
  ];
  for (const { pattern, message } of forbiddenPatterns) {
    if (pattern.test(raw)) {
      errors.push(`${relativePath}: ${message}`);
    }
  }
}

function extractJsonObject(relativePath, raw) {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    errors.push(`${relativePath}: evidence does not contain a JSON object`);
    return null;
  }
  const candidate = raw.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    errors.push(
      `${relativePath}: could not parse evidence JSON: ${error.message}`,
    );
    return null;
  }
}

function validateTopLevel(relativePath, evidence) {
  if (evidence.ok !== true) {
    errors.push(`${relativePath}: evidence ok must be true`);
  }
  if (!isIsoDate(evidence.checkedAt)) {
    errors.push(`${relativePath}: evidence checkedAt must be an ISO timestamp`);
  }
  if (evidence.provider !== "chain-custody") {
    errors.push(`${relativePath}: provider must be chain-custody`);
  }
  if (!allowedEnvironments.has(evidence.environment)) {
    errors.push(`${relativePath}: environment must be testnet or staging`);
  }
  if (evidence.localMockOnly !== false) {
    errors.push(`${relativePath}: localMockOnly must be false`);
  }
  if (evidence.realUserDataUsed !== false) {
    errors.push(`${relativePath}: realUserDataUsed must be false`);
  }
  if (evidence.productionCredentialsUsed !== false) {
    errors.push(`${relativePath}: productionCredentialsUsed must be false`);
  }
  if (evidence.deploymentCredentialsAvailable !== false) {
    errors.push(
      `${relativePath}: deploymentCredentialsAvailable must be false`,
    );
  }
}

function validateCustody(relativePath, custody = {}) {
  if (!allowedSignerProviders.has(custody.signerProvider)) {
    errors.push(
      `${relativePath}: custody.signerProvider must be vault-kms or delegated-signer`,
    );
  }
  for (const key of [
    "usesVaultKmsOrDelegatedSigner",
    "rawPrivateKeyUnavailableToApp",
    "operatorKeyNotCommitted",
    "signerAccessPolicyReviewed",
    "leastPrivilegeSignerPolicyVerified",
    "signingAuditLogCaptured",
  ]) {
    if (custody[key] !== true) {
      errors.push(`${relativePath}: custody.${key} must be true`);
    }
  }
}

function validateContractControl(relativePath, contractControl = {}) {
  for (const key of [
    "multisigOwnerConfigured",
    "timelockOrAdminDelayConfigured",
    "singleHotKeyIsNotOwner",
    "ownerChangeTestedOnTestnet",
    "emergencyAdminSeparationReviewed",
  ]) {
    if (contractControl[key] !== true) {
      errors.push(`${relativePath}: contractControl.${key} must be true`);
    }
  }
}

function validateSideEffects(relativePath, sideEffects = {}) {
  for (const key of [
    "chainCallsThroughDurableOutboxOnly",
    "noDirectRequestPathChainCalls",
    "ownershipTransferJobTested",
    "ownershipFinalizationJobTested",
    "staleJobRecoveryVerified",
    "idempotentRetryVerified",
  ]) {
    if (sideEffects[key] !== true) {
      errors.push(`${relativePath}: sideEffects.${key} must be true`);
    }
  }
  if (sideEffects.outboxHealthAfterRun !== "healthy") {
    errors.push(
      `${relativePath}: sideEffects.outboxHealthAfterRun must be healthy`,
    );
  }
}

function validateOperationalReadiness(relativePath, operationalReadiness = {}) {
  for (const key of [
    "rotationProcedureDocumented",
    "incidentResponseDocumented",
    "signerDisableProcedureDocumented",
    "monitoringAndAlertingConfigured",
    "rollbackOrPausePlanDocumented",
  ]) {
    if (operationalReadiness[key] !== true) {
      errors.push(`${relativePath}: operationalReadiness.${key} must be true`);
    }
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "privateKeysRedacted",
    "seedPhrasesRedacted",
    "bearerTokensRedacted",
    "signerProviderSecretsRedacted",
    "providerSecretsRedacted",
    "databaseUrlsRedacted",
    "rpcUrlsRedacted",
    "stripePublishableKeysRedacted",
    "deploymentCredentialsRedacted",
    "ciSecretMaskingCommandsRedacted",
    "transactionHashesRedactedOrShortened",
    "walletAddressesRedactedOrTestOnly",
    "vaultIdentifiersRedactedOrNonSensitive",
  ]) {
    if (redaction[key] !== true) {
      errors.push(`${relativePath}: redaction.${key} must be true`);
    }
  }
}

function isIsoDate(value) {
  if (typeof value !== "string" || !value) {
    return false;
  }
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}
