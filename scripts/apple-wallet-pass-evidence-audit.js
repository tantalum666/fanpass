const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
const allowedBarcodeFormats = new Set([
  "PKBarcodeFormatQR",
  "PKBarcodeFormatAztec",
]);
const implementationSnapshotFiles = [
  "apps/ios/FanPass/project.yml",
  "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
  "apps/ios/FanPass/FanPass/Models/FanPassModels.swift",
  "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
  "apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift",
  "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
  "apps/api/src/modules/verification/verification.controller.ts",
  "apps/api/src/modules/verification/verification.service.ts",
  "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
  "scripts/prototype-shortcut-audit.js",
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
      "Usage: npm run security:apple-wallet:evidence -- <evidence-file...>",
      "Validate saved Apple Wallet signed-pass evidence before closing Wallet Beta gates.",
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
  validateImplementationSnapshot(relativePath, evidence.implementationSnapshot);
  validatePassSigning(relativePath, evidence.passSigning);
  validateDeviceInstall(relativePath, evidence.deviceInstall);
  validatePassContents(relativePath, evidence.passContents);
  validateSecurity(relativePath, evidence.security);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    provider: evidence.provider ?? null,
    localPrototype: evidence.localPrototype ?? null,
    barcodeFormat: evidence.passSigning?.barcodeFormat ?? null,
    realDeviceTested: evidence.deviceInstall?.realDeviceTested ?? null,
    implementationSnapshotFiles:
      evidence.implementationSnapshot?.files?.length ?? null,
    passSigning: evidence.passSigning ?? null,
  };
}

function validateNoSecretMarkers(relativePath, raw) {
  const forbidden = [
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN ENCRYPTED PRIVATE KEY-----",
    "-----BEGIN RSA PRIVATE KEY-----",
    "-----BEGIN EC PRIVATE KEY-----",
    "-----BEGIN CERTIFICATE-----",
    "PRIVATE KEY",
    ".p12",
    ".p8",
    "PKCS12",
    "Authorization: Bearer ",
    "eyJhbGci",
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
  if (evidence.provider !== "apple-wallet") {
    errors.push(`${relativePath}: provider must be apple-wallet`);
  }
  if (evidence.localPrototype !== false) {
    errors.push(
      `${relativePath}: localPrototype must be false for signed Wallet evidence`,
    );
  }
  if (evidence.usesUnsignedPrototype !== false) {
    errors.push(`${relativePath}: usesUnsignedPrototype must be false`);
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

function validatePassSigning(relativePath, passSigning = {}) {
  for (const key of [
    "pkpassGenerated",
    "pkpassValidated",
    "signedWithApplePassCertificate",
    "passTypeIdentifierConfigured",
    "teamIdentifierConfigured",
    "manifestHashVerified",
    "signatureVerified",
    "barcodePayloadSignedByFanPassApi",
  ]) {
    if (passSigning[key] !== true) {
      errors.push(`${relativePath}: passSigning.${key} must be true`);
    }
  }
  if (passSigning.certificatePrivateKeyExported !== false) {
    errors.push(
      `${relativePath}: passSigning.certificatePrivateKeyExported must be false`,
    );
  }
  if (!allowedBarcodeFormats.has(passSigning.barcodeFormat)) {
    errors.push(
      `${relativePath}: passSigning.barcodeFormat must be PKBarcodeFormatQR or PKBarcodeFormatAztec`,
    );
  }
}

function validateImplementationSnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "apple-wallet-pass-boundaries") {
    errors.push(
      `${relativePath}: implementationSnapshot.source must be apple-wallet-pass-boundaries`,
    );
  }

  if (
    !Array.isArray(snapshot.files) ||
    snapshot.files.length !== expectedImplementationSnapshot.length
  ) {
    errors.push(
      `${relativePath}: implementationSnapshot.files must include the current Apple Wallet pass boundary files`,
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
        `${relativePath}: implementationSnapshot.files ${expected.file} sha256 must match the current Apple Wallet pass implementation`,
      );
    }
  }
}

function validateDeviceInstall(relativePath, deviceInstall = {}) {
  for (const key of [
    "realDeviceTested",
    "addPassFlowVerified",
    "walletDisplaysSignedPass",
    "barcodeScansThroughFanPassOps",
  ]) {
    if (deviceInstall[key] !== true) {
      errors.push(`${relativePath}: deviceInstall.${key} must be true`);
    }
  }
  if (deviceInstall.simulatorOnly !== false) {
    errors.push(`${relativePath}: deviceInstall.simulatorOnly must be false`);
  }
  if (
    !["development", "testflight"].includes(deviceInstall.buildChannel ?? "")
  ) {
    errors.push(
      `${relativePath}: deviceInstall.buildChannel must be development or testflight`,
    );
  }
}

function validatePassContents(relativePath, passContents = {}) {
  for (const key of [
    "containsNoRealPersonalData",
    "containsNoProviderSecrets",
    "containsNoPaymentData",
    "containsOnlySignedEntryPayload",
    "expirationMatchesQrTtlPolicy",
  ]) {
    if (passContents[key] !== true) {
      errors.push(`${relativePath}: passContents.${key} must be true`);
    }
  }
}

function validateSecurity(relativePath, security = {}) {
  for (const key of [
    "noPrivateKeysInRepo",
    "passCertificateNotCommitted",
    "usesEphemeralTestTicket",
    "revocationOrRotationPlanDocumented",
    "prototypeBarcodeFallbackRemovedOrDebugOnly",
  ]) {
    if (security[key] !== true) {
      errors.push(`${relativePath}: security.${key} must be true`);
    }
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "privateKeyRedacted",
    "certificateSerialRedacted",
    "teamIdRedactedOrNonSecret",
    "passTypeIdRedactedOrNonSecret",
    "ticketIdentifiersRedacted",
    "bearerTokensRedacted",
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
