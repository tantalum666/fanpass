const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const allowDryRun = args.includes("--allow-dry-run");
const evidenceFiles = args.filter((arg) => arg !== "--allow-dry-run");
const errors = [];
const implementationSnapshotFiles = [
  "apps/api/src/main.ts",
  "apps/api/src/config/security-config.ts",
  "apps/api/.env.staging.example",
  "apps/api/src/common/fanpass-socket-io.adapter.ts",
  "apps/api/src/modules/alpha/alpha.controller.ts",
  "apps/api/src/modules/side-effects/side-effect-health.service.ts",
  "apps/dashboard/next.config.ts",
  "scripts/security-runtime-staging-check.sh",
  "scripts/staging-runtime-evidence-audit.js",
  "scripts/security-runtime-staging-local-dry-run.sh",
  "scripts/security-header-policy-audit.js",
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
      "Usage: npm run security:runtime:staging:evidence -- <evidence-file...>",
      "Use --allow-dry-run only for local dry-run evidence validation.",
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
        source: "staging-runtime-security-boundaries",
        files: expectedImplementationSnapshot,
      },
      checkedFiles: results.length,
      allowDryRun,
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
  validateUrls(relativePath, evidence);
  validateApiRuntime(relativePath, evidence);
  validateAdminHealth(relativePath, evidence);
  validateCheckedItems(relativePath, evidence);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    localDryRun: evidence.localDryRun,
    apiUrl: evidence.apiUrl ?? null,
    consoleUrl: evidence.consoleUrl ?? null,
    implementationSnapshotFiles:
      evidence.implementationSnapshot?.files?.length ?? null,
    apiRuntime: evidence.apiRuntime ?? null,
    adminSideEffectHealth: evidence.adminSideEffectHealth ?? null,
    orderbook: evidence.orderbook ?? null,
  };
}

function validateImplementationSnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "staging-runtime-security-boundaries") {
    errors.push(
      `${relativePath}: implementationSnapshot.source must be staging-runtime-security-boundaries`,
    );
  }
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  if (files.length !== expectedImplementationSnapshot.length) {
    errors.push(
      `${relativePath}: implementationSnapshot.files must include the current staging runtime security boundary files`,
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
        `${relativePath}: implementationSnapshot.files ${expected.file} sha256 must match the current staging runtime security implementation`,
      );
    }
  }
}

function validateNoSecretMarkers(relativePath, raw) {
  const forbiddenPatterns = [
    {
      label: "staging admin access token assignment",
      pattern:
        /\b(?:STAGING_ADMIN_ACCESS_TOKEN|FANPASS_STAGING_ADMIN_ACCESS_TOKEN)\s*=/i,
    },
    {
      label: "Authorization: Bearer ",
      pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]+/i,
    },
    {
      label: "JWT",
      pattern: /\beyJhbGci[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+){2}\b/,
    },
    {
      label: "-----BEGIN PRIVATE KEY-----",
      pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    },
    {
      label: "Stripe secret key",
      pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/,
    },
    {
      label: "Stripe publishable key",
      pattern: /\bpk_(?:live|test)_[A-Za-z0-9]{8,}/,
    },
    {
      label: "Stripe webhook secret",
      pattern: /\bwhsec_[A-Za-z0-9]{8,}/,
    },
    {
      label: "Stripe client secret",
      pattern: /\bpi_[A-Za-z0-9_]+_secret_[A-Za-z0-9_]+/,
    },
    {
      label: "Stripe secret marker",
      pattern: /\bstripe_(?:secret|webhook_secret|publishable_key)\b/i,
    },
    {
      label: "Privy secret marker",
      pattern: /\bprivy_(?:verification_key|app_secret|access_token)\b/i,
    },
    {
      label: "database URL",
      pattern: /\bDATABASE_URL\s*=\s*(?:postgres|postgresql):\/\//i,
    },
    {
      label: "deployment or cloud credential assignment",
      pattern:
        /\b(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)\s*=\s*(?!<)[^\s"']{8,}/i,
    },
    {
      label: "deployment or cloud credential field",
      pattern:
        /"(?:awsAccessKeyId|awsSecretAccessKey|awsSessionToken|googleApplicationCredentialsJson|googleCredentials|gcpServiceAccountKey|vercelToken|githubToken|ghToken|netlifyAuthToken|cloudflareApiToken|cfApiToken|cloudflareApiKey|cfApiKey)"\s*:\s*"(?!<)[^"]{8,}"/i,
    },
    {
      label: "deployment or cloud credential environment field",
      pattern:
        /"(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)"\s*:\s*"(?!<)[^"]{8,}"/,
    },
    {
      label: "CI secret masking command literal",
      pattern:
        /(?:::add-mask::|::set-secret\s+name=[^:\r\n]+::|##vso\[task\.setvariable[^\]\r\n]*issecret=true[^\]\r\n]*\])[^\s<][^\r\n]{7,}/i,
    },
  ];
  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(raw)) {
      errors.push(
        `${relativePath}: evidence must not include secret marker ${rule.label}`,
      );
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
  if (evidence.localDryRun === true && !allowDryRun) {
    errors.push(
      `${relativePath}: local dry-run evidence cannot close deployed staging checks`,
    );
  }
  if (evidence.localDryRun !== true && evidence.localDryRun !== false) {
    errors.push(`${relativePath}: evidence localDryRun must be boolean`);
  }
  if (evidence.deploymentCredentialsAvailable !== false) {
    errors.push(
      `${relativePath}: deploymentCredentialsAvailable must be false`,
    );
  }
  if (evidence.redaction?.deploymentCredentialsRedacted !== true) {
    errors.push(
      `${relativePath}: redaction.deploymentCredentialsRedacted must be true`,
    );
  }
  if (evidence.redaction?.ciSecretMaskingCommandsRedacted !== true) {
    errors.push(
      `${relativePath}: redaction.ciSecretMaskingCommandsRedacted must be true`,
    );
  }
}

function validateUrls(relativePath, evidence) {
  if (evidence.localDryRun === true && allowDryRun) {
    requireLocalHttpUrl(relativePath, "apiUrl", evidence.apiUrl);
    requireLocalHttpUrl(relativePath, "consoleUrl", evidence.consoleUrl);
    return;
  }
  requireHttpsUrl(relativePath, "apiUrl", evidence.apiUrl);
  requireHttpsUrl(relativePath, "consoleUrl", evidence.consoleUrl);
}

function validateAdminHealth(relativePath, evidence) {
  if (evidence.adminSideEffectHealth !== "admin side-effect outbox health ok") {
    errors.push(
      `${relativePath}: adminSideEffectHealth must prove admin side-effect outbox health ok`,
    );
  }
}

function validateApiRuntime(relativePath, evidence) {
  const trustProxyHops = evidence.apiRuntime?.trustProxyHops;
  if (
    !Number.isInteger(trustProxyHops) ||
    trustProxyHops < 1 ||
    trustProxyHops > 3
  ) {
    errors.push(
      `${relativePath}: apiRuntime.trustProxyHops must be an integer from 1 to 3`,
    );
  }
}

function validateCheckedItems(relativePath, evidence) {
  const apiChecks = new Set(evidence.checked?.api ?? []);
  const consoleChecks = new Set(evidence.checked?.console ?? []);
  for (const required of [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "cross-origin-opener-policy",
    "strict-transport-security",
    "x-powered-by absent",
    "demo-session non-2xx",
    "admin side-effect health unauthenticated non-2xx",
    "admin side-effect health: admin side-effect outbox health ok",
    "orderbook websocket allowed origin",
    "orderbook websocket disallowed origin rejected",
  ]) {
    if (!apiChecks.has(required)) {
      errors.push(`${relativePath}: missing API check ${required}`);
    }
  }
  const trustProxyHops = evidence.apiRuntime?.trustProxyHops;
  if (
    Number.isInteger(trustProxyHops) &&
    !apiChecks.has(`trust proxy hops configured: ${trustProxyHops}`)
  ) {
    errors.push(
      `${relativePath}: missing API check trust proxy hops configured: ${trustProxyHops}`,
    );
  }
  for (const required of [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "cross-origin-opener-policy",
    "strict-transport-security",
    "permissions-policy",
    "content-security-policy",
    "x-powered-by absent",
    "locked-or-sign-in unauthenticated state",
  ]) {
    if (!consoleChecks.has(required)) {
      errors.push(`${relativePath}: missing Console check ${required}`);
    }
  }
  const orderbook = evidence.orderbook ?? {};
  if (orderbook.subscriptionTargetRedacted !== true || !orderbook.allowedOrigin) {
    errors.push(
      `${relativePath}: orderbook evidence target redaction proof and allowed origin are required`,
    );
  }
  if (
    evidence.localDryRun !== true &&
    typeof orderbook.allowedOrigin === "string" &&
    !orderbook.allowedOrigin.startsWith("https://")
  ) {
    errors.push(
      `${relativePath}: deployed orderbook allowedOrigin must be HTTPS`,
    );
  }
}

function requireHttpsUrl(relativePath, key, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      errors.push(
        `${relativePath}: ${key} must be HTTPS for deployed staging evidence`,
      );
    }
  } catch {
    errors.push(`${relativePath}: ${key} must be a valid URL`);
  }
}

function requireLocalHttpUrl(relativePath, key, value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      errors.push(`${relativePath}: dry-run ${key} must be a local HTTP URL`);
    }
  } catch {
    errors.push(`${relativePath}: ${key} must be a valid URL`);
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
