const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
const buildChannels = new Set(["development", "testflight"]);
const implementationSnapshotFiles = [
  "apps/ios/FanPass/project.yml",
  "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
  "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
  "apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift",
  "apps/ios/FanPass/FanPass/Features/Scanner/NFCPayloadScanner.swift",
  "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
  "apps/api/src/common/fanpass-auth.guard.ts",
  "apps/api/src/common/session.ts",
  "apps/api/src/modules/verification/verification.controller.ts",
  "apps/api/src/modules/verification/verification.service.ts",
  "docs/NFC_NDEF_TAG_FIXTURE.md",
  "scripts/nfc-ndef-fixture-audit.js",
  "scripts/ios-distribution-boundary-audit.js",
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
      "Usage: npm run security:ops-scanner:device-evidence -- <evidence-file...>",
      "Validate saved FanPass Ops real-device QR-first scanner evidence before closing scanner Beta gates.",
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
  validateRuntime(relativePath, evidence.runtime);
  validateReleaseCapabilities(relativePath, evidence.releaseCapabilities);
  validateImplementationSnapshot(relativePath, evidence.implementationSnapshot);
  validateQrTransport(relativePath, evidence.qrTransport);
  if (Object.hasOwn(evidence, "nfcTransport")) {
    errors.push(
      `${relativePath}: nfcTransport is not accepted by the QR-first release evidence contract`,
    );
  }
  validateBackendAuthority(relativePath, evidence.backendAuthority);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    surface: evidence.surface ?? null,
    apiBaseUrl: evidence.runtime?.apiBaseUrl ?? null,
    buildChannel: evidence.runtime?.buildChannel ?? null,
    capabilityModel: evidence.capabilityModel ?? null,
    implementationSnapshotFiles:
      evidence.implementationSnapshot?.files?.length ?? null,
    qrTransport: evidence.qrTransport ?? null,
    releaseCapabilities: evidence.releaseCapabilities ?? null,
  };
}

function validateNoSecretMarkers(relativePath, raw) {
  const forbidden = [
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
    "QR_SIGNING_SECRET=",
    "SESSION_SIGNING_SECRET=",
    "DATABASE_URL=",
  ];
  const lowerRaw = raw.toLowerCase();
  for (const marker of forbidden) {
    if (lowerRaw.includes(marker.toLowerCase())) {
      errors.push(
        `${relativePath}: evidence must not include secret marker ${marker}`,
      );
    }
  }
  for (const pattern of [
    /postgres:\/\/[^\s"']+/i,
    /postgresql:\/\/[^\s"']+/i,
  ]) {
    if (pattern.test(raw)) {
      errors.push(`${relativePath}: evidence must not include database URLs`);
    }
  }
  const forbiddenPatterns = [
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
  if (evidence.surface !== "fanpass-ops") {
    errors.push(`${relativePath}: surface must be fanpass-ops`);
  }
  if (evidence.capabilityModel !== "qr-first-release-v1") {
    errors.push(`${relativePath}: capabilityModel must be qr-first-release-v1`);
  }
  if (evidence.localSimulator !== false) {
    errors.push(`${relativePath}: localSimulator must be false`);
  }
  if (evidence.realUserDataUsed !== false) {
    errors.push(`${relativePath}: realUserDataUsed must be false`);
  }
  if (evidence.productionCredentialsUsed !== false) {
    errors.push(`${relativePath}: productionCredentialsUsed must be false`);
  }
}

function validateRuntime(relativePath, runtime = {}) {
  if (runtime.realDeviceTested !== true) {
    errors.push(`${relativePath}: runtime.realDeviceTested must be true`);
  }
  if (!buildChannels.has(runtime.buildChannel)) {
    errors.push(
      `${relativePath}: runtime.buildChannel must be development or testflight`,
    );
  }
  if (!isHttpsUrl(runtime.apiBaseUrl)) {
    errors.push(`${relativePath}: runtime.apiBaseUrl must be an HTTPS URL`);
  }
  if (runtime.releaseConfigUsed !== true) {
    errors.push(`${relativePath}: runtime.releaseConfigUsed must be true`);
  }
  if (runtime.debugPasteFallbackUsed !== false) {
    errors.push(
      `${relativePath}: runtime.debugPasteFallbackUsed must be false`,
    );
  }
  if (runtime.deploymentCredentialsAvailable !== false) {
    errors.push(
      `${relativePath}: runtime.deploymentCredentialsAvailable must be false`,
    );
  }
}

function validateReleaseCapabilities(relativePath, capabilities = {}) {
  if (capabilities.cameraQrEnabled !== true) {
    errors.push(
      `${relativePath}: releaseCapabilities.cameraQrEnabled must be true`,
    );
  }
  if (capabilities.releaseNfcEntitlementPresent !== false) {
    errors.push(
      `${relativePath}: releaseCapabilities.releaseNfcEntitlementPresent must be false`,
    );
  }
  if (capabilities.nativeNfcDebugOnly !== true) {
    errors.push(
      `${relativePath}: releaseCapabilities.nativeNfcDebugOnly must be true`,
    );
  }
  if (capabilities.nfcEvidenceClaimed !== false) {
    errors.push(
      `${relativePath}: releaseCapabilities.nfcEvidenceClaimed must be false`,
    );
  }
}

function validateImplementationSnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "ops-scanner-qr-first-device-boundaries") {
    errors.push(
      `${relativePath}: implementationSnapshot.source must be ops-scanner-qr-first-device-boundaries`,
    );
  }

  if (
    !Array.isArray(snapshot.files) ||
    snapshot.files.length !== expectedImplementationSnapshot.length
  ) {
    errors.push(
      `${relativePath}: implementationSnapshot.files must include the current FanPass Ops scanner implementation boundary files`,
    );
  }

  const byFile = new Map(
    Array.isArray(snapshot.files)
      ? snapshot.files.map((entry) => [entry?.file, entry])
      : [],
  );
  const expectedFiles = new Set(
    expectedImplementationSnapshot.map((entry) => entry.file),
  );

  for (const entry of Array.isArray(snapshot.files) ? snapshot.files : []) {
    if (!expectedFiles.has(entry?.file)) {
      errors.push(
        `${relativePath}: implementationSnapshot.files contains unexpected file ${entry?.file}`,
      );
    }
  }

  for (const expected of expectedImplementationSnapshot) {
    const actual = byFile.get(expected.file);
    if (!actual) {
      errors.push(
        `${relativePath}: implementationSnapshot.files missing ${expected.file}`,
      );
      continue;
    }
    if (actual.sha256 !== expected.sha256) {
      errors.push(
        `${relativePath}: implementationSnapshot.files ${expected.file} sha256 must match the current FanPass Ops scanner implementation`,
      );
    }
  }
}

function validateQrTransport(relativePath, qrTransport = {}) {
  for (const key of [
    "cameraScanVerified",
    "acceptedScanVerified",
    "duplicateReplayRejected",
    "expiredOrInvalidPayloadRejected",
  ]) {
    if (qrTransport[key] !== true) {
      errors.push(`${relativePath}: qrTransport.${key} must be true`);
    }
  }
}

function validateBackendAuthority(relativePath, backendAuthority = {}) {
  for (const key of [
    "fanPassApiSignatureVerified",
    "nonceReplayRejectedByApi",
    "gateAssignmentEnforced",
    "scannerIdentityDerivedFromBearer",
    "clientSuppliedScannerUserRejected",
    "checkInSummaryUpdated",
  ]) {
    if (backendAuthority[key] !== true) {
      errors.push(`${relativePath}: backendAuthority.${key} must be true`);
    }
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "bearerTokensRedacted",
    "qrSigningSecretRedacted",
    "payloadNonceRedacted",
    "ticketIdentifiersRedacted",
    "staffIdentifiersRedacted",
    "deviceIdentifiersRedacted",
    "providerSecretsRedacted",
    "stripePublishableKeysRedacted",
    "databaseUrlsRedacted",
    "deploymentCredentialsRedacted",
  ]) {
    if (redaction[key] !== true) {
      errors.push(`${relativePath}: redaction.${key} must be true`);
    }
  }
}

function isHttpsUrl(value) {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
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
