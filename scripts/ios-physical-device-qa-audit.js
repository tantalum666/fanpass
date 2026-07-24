const fs = require("fs");
const path = require("path");
const {
  assertOrderedNpmScripts,
  loadBetaFoundationGateSteps,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = process.env.FANPASS_IOS_PHYSICAL_QA_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_IOS_PHYSICAL_QA_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];
const betaGateSteps = loadBetaFoundationGateSteps(rootDir, errors);

const docPath = "docs/IOS_PHYSICAL_DEVICE_QA.md";
const tasksPath = "docs/DEVELOPMENT_TASKS.md";
const qaPath = "docs/QA_CHECKLIST.md";
const roadmapPath = "docs/BETA_ROADMAP.md";
const iosPlanPath = "docs/IOS_DISTRIBUTION_PLAN.md";
const providerPath = "docs/PROVIDER_COST_FEASIBILITY.md";
const packagePath = "package.json";

const doc = readRequired(docPath);
const tasks = readRequired(tasksPath);
const qa = readRequired(qaPath);
const roadmap = readRequired(roadmapPath);
const iosPlan = readRequired(iosPlanPath);
const provider = readRequired(providerPath);
const packageJson = readRequired(packagePath);

const requiredDocMarkers = [
  "# FanPass iOS Physical-Device QA Checklist",
  "Status: historical physical-iPhone QR execution completed; the checklist is ready for version-bound refresh on the next reviewed `qr-first-release-v1` candidate",
  "signed `FanPass` and `FanPass Ops` builds on real iPhones",
  "does not replace saved iOS staging/TestFlight build evidence",
  "Do not use real personal data",
  "production credentials",
  "Apple signing material",
  "device identifiers",
  "raw signed payloads",
  "Use a real iPhone, not a simulator",
  "real HTTPS staging or beta API URL",
  "Do not use localhost",
  "Stripe test mode only",
  "Privy test app",
  "separate apps with separate bundle ids",
  "## FanPass Consumer Checks",
  "No staff scanner, gate, inventory, audit, admin, NFC, or Camera permission prompt appears in the consumer app",
  "Stripe iOS PaymentSheet presenter boundary",
  "Apple Wallet signed-pass evidence passes `npm run security:apple-wallet:evidence -- <saved-json-output>`",
  "## FanPass Ops Checks",
  "verified auth",
  "assigned event/gate access",
  "QR camera scanning accepts the first valid staging payload and rejects duplicate replay",
  "When NFC is explicitly re-enabled later, it must read a supported physical NDEF tag into the same backend redemption path as QR",
  "Scanner identity comes from the verified auth session",
  "Debug paste fallback and payload copy helpers are unavailable",
  "does not expose consumer wallet, marketplace, checkout, PaymentSheet, or organizer inventory flows",
  "## Shared Evidence Handoffs",
  "npm run security:ios-staging-build:evidence -- <saved-json-output>",
  "npm run security:ops-scanner:device-evidence -- <saved-json-output>",
  "npm run security:apple-wallet:evidence -- <saved-json-output>",
  "npm run security:runtime:staging:evidence -- <saved-json-output>",
  "npm run security:staff-tenant:staging-evidence -- <saved-json-output>",
  "npm run security:stripe-testmode:evidence -- <saved-json-output>",
  "npm run security:privy-plan:evidence -- <saved-json-output>",
  "## Redaction Review",
];

for (const marker of requiredDocMarkers) {
  if (!doc.includes(marker)) {
    errors.push(`${docPath} must include marker: ${marker}`);
  }
}

const forbiddenPatterns = [
  [/Authorization:\s*Bearer\s+/i, "bearer token marker"],
  [/eyJ[a-zA-Z0-9_-]{10,}/, "JWT-looking token"],
  [/-----BEGIN [A-Z ]*(PRIVATE KEY|CERTIFICATE)-----/, "key/cert marker"],
  [/\bsk_(test|live)_[a-zA-Z0-9_]+/, "Stripe secret key marker"],
  [/\bpk_live_[a-zA-Z0-9_]+/, "Stripe live publishable key marker"],
  [/\bwhsec_[a-zA-Z0-9_]+/, "Stripe webhook secret marker"],
  [/client_secret/i, "Stripe client secret marker"],
  [
    /PRIVY_(APP_SECRET|VERIFICATION_KEY|PRIVATE_KEY)\s*=/,
    "Privy secret marker",
  ],
  [/QR_SIGNING_SECRET\s*=/, "QR signing secret marker"],
  [/DATABASE_URL\s*=/, "database URL marker"],
  [/PROVISIONING_PROFILE_SPECIFIER\s*=/, "provisioning profile marker"],
  [/\budid\b/i, "device identifier marker"],
  [/"nonce"\s*:/, "raw nonce JSON field"],
  [/signedPayload\s*[:=]/, "raw signed payload field"],
];

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(doc)) {
    errors.push(`${docPath} must not include ${label}`);
  }
}

const requiredTask =
  "- [x] Add physical-device QA checklist and audit for FanPass and FanPass Ops before external tester evidence is trusted.";
if (!tasks.includes(requiredTask)) {
  errors.push(
    `${tasksPath} must mark the iOS physical-device QA checklist gate complete`,
  );
}

const requiredIosPlan =
  "- Completed physical-device QA checklist and audit for FanPass and FanPass Ops: `docs/IOS_PHYSICAL_DEVICE_QA.md` and `npm run security:ios-physical-device-qa`.";
if (!iosPlan.includes(requiredIosPlan)) {
  errors.push(
    `${iosPlanPath} must document the completed physical-device QA gate`,
  );
}

const qaMarkers = [
  "Keep `npm run security:ios-physical-device-qa:self-test` and `npm run security:ios-physical-device-qa` in `node scripts/beta-foundation-verify.js`",
  "The iOS physical-device QA checklist must keep real-iPhone scope, signed build scope, HTTPS staging/beta API scope, FanPass/FanPass Ops role separation, no-debug-fallback requirements, no-secret/no-real-data constraints, and saved-evidence handoffs explicit.",
];
for (const marker of qaMarkers) {
  if (!qa.includes(marker)) {
    errors.push(`${qaPath} must include marker: ${marker}`);
  }
}

const roadmapMarker =
  "The iOS physical-device QA checklist audit must keep passing inside `node scripts/beta-foundation-verify.js`";
if (!roadmap.includes(roadmapMarker)) {
  errors.push(
    `${roadmapPath} must include iOS physical-device QA audit release gate`,
  );
}

const providerMarker =
  "`npm run security:ios-physical-device-qa` keeps the signed-real-device QA runbook explicit before external tester evidence is trusted.";
if (!provider.includes(providerMarker)) {
  errors.push(
    `${providerPath} must include iOS physical-device QA enforcement marker`,
  );
}

let scripts = {};
try {
  scripts = JSON.parse(packageJson).scripts ?? {};
} catch (error) {
  errors.push(`${packagePath} must be valid JSON: ${error.message}`);
}

if (
  scripts["security:ios-physical-device-qa"] !==
  "node scripts/ios-physical-device-qa-audit.js"
) {
  errors.push(`${packagePath} must define security:ios-physical-device-qa`);
}
if (
  scripts["security:ios-physical-device-qa:self-test"] !==
  "node scripts/ios-physical-device-qa-audit-self-test.js"
) {
  errors.push(
    `${packagePath} must define security:ios-physical-device-qa:self-test`,
  );
}

assertOrderedNpmScripts(
  betaGateSteps,
  [
    "security:ios-physical-device-qa:self-test",
    "security:ios-physical-device-qa",
  ],
  errors,
);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      file: docPath,
      requiredMarkers: requiredDocMarkers.length,
      forbiddenPatterns: forbiddenPatterns.length,
    },
    null,
    2,
  ),
);

function readRequired(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${relativePath} is missing`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}
