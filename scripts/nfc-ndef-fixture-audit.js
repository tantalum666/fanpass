const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_NFC_NDEF_FIXTURE_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_NFC_NDEF_FIXTURE_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

const docPath = "docs/NFC_NDEF_TAG_FIXTURE.md";
const tasksPath = "docs/DEVELOPMENT_TASKS.md";
const qaPath = "docs/QA_CHECKLIST.md";
const roadmapPath = "docs/BETA_ROADMAP.md";
const iosPlanPath = "docs/IOS_DISTRIBUTION_PLAN.md";
const packagePath = "package.json";
const verifierPath = "scripts/beta-foundation-verify.sh";

const doc = readRequired(docPath);
const tasks = readRequired(tasksPath);
const qa = readRequired(qaPath);
const roadmap = readRequired(roadmapPath);
const iosPlan = readRequired(iosPlanPath);
const packageJson = readRequired(packagePath);
const verifier = readRequired(verifierPath);

const requiredDocMarkers = [
  "# FanPass NFC NDEF Tag Fixture Format",
  "Status: fixture contract ready; physical-device validation remains open",
  "`FanPass Ops` only",
  "NFC is a transport for a FanPass signed entry payload",
  "Backend authority remains FanPass API",
  "NFC payloads must enter the same redemption path as QR scans",
  "NDEF Text record",
  "NDEF URI record",
  "<REDACTED_SIGNED_ENTRY_PAYLOAD>",
  "Do not put bearer tokens on NFC tags",
  "Do not put Privy tokens on NFC tags",
  "Do not put Stripe secrets on NFC tags",
  "Do not put QR signing secrets on NFC tags",
  "Do not put raw nonces on NFC tags",
  "Do not put raw signed payload fixtures",
  "Do not put real ticket ids",
  "Do not put staff ids",
  "Do not put device identifiers",
  "real HTTPS staging or beta API URL",
  "physical NDEF tag",
  "duplicate replay coverage",
  "unsupported tag or unsupported device behavior check",
  "debug paste fallback remains debug-only",
  "Physical-device evidence must pass `npm run security:ops-scanner:device-evidence -- <saved-json-output>`",
  "This fixture contract only defines what the NFC test tag may contain",
  "Redaction Requirements",
];

for (const marker of requiredDocMarkers) {
  if (!doc.includes(marker)) {
    errors.push(`${docPath} must include marker: ${marker}`);
  }
}

const forbiddenPatterns = [
  [/Authorization:\s*Bearer\s+/i, "bearer token marker"],
  [/eyJ[a-zA-Z0-9_-]{10,}/, "JWT-looking token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key marker"],
  [/\bsk_(test|live)_[a-zA-Z0-9_]+/, "Stripe secret key marker"],
  [/\bpk_live_[a-zA-Z0-9_]+/, "Stripe live publishable key marker"],
  [/\bwhsec_[a-zA-Z0-9_]+/, "Stripe webhook secret marker"],
  [
    /PRIVY_(APP_SECRET|VERIFICATION_KEY|PRIVATE_KEY)\s*=/,
    "Privy secret marker",
  ],
  [/QR_SIGNING_SECRET\s*=/, "QR signing secret marker"],
  [/SESSION_SIGNING_SECRET\s*=/, "session signing secret marker"],
  [/"nonce"\s*:/, "raw nonce JSON field"],
  [/rawNonce\s*[:=]/, "raw nonce field"],
  [/signedPayload\s*[:=]/, "raw signed payload field"],
  [/ticket_(?!identifiers)[a-zA-Z0-9]{6,}/i, "ticket id marker"],
  [/staff_(?!identifiers)[a-zA-Z0-9]{6,}/i, "staff id marker"],
  [/device_(?!identifiers)[a-zA-Z0-9]{6,}/i, "device id marker"],
];

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(doc)) {
    errors.push(`${docPath} must not include ${label}`);
  }
}

const requiredTask =
  "- [x] Add NFC NDEF tag fixture format document and audit for supported physical-tag payloads.";
if (!tasks.includes(requiredTask)) {
  errors.push(`${tasksPath} must mark the NFC NDEF fixture audit complete`);
}

const requiredIosPlan =
  "- Completed NFC tag fixture format document and audit for supported NDEF payloads: `docs/NFC_NDEF_TAG_FIXTURE.md` and `npm run security:nfc-ndef-fixture`.";
if (!iosPlan.includes(requiredIosPlan)) {
  errors.push(`${iosPlanPath} must document the completed NFC fixture gate`);
}

const qaMarkers = [
  "Keep `npm run security:nfc-ndef-fixture:self-test` and `npm run security:nfc-ndef-fixture` in `npm run beta:foundation:verify`",
  "NFC fixture documentation must keep FanPass Ops scope, QR-equivalent backend authority, supported NDEF Text/URI records, no-token/no-nonce/no-raw-payload constraints, debug-only paste fallback, and physical-device evidence requirements explicit.",
];
for (const marker of qaMarkers) {
  if (!qa.includes(marker)) {
    errors.push(`${qaPath} must include marker: ${marker}`);
  }
}

const roadmapMarker =
  "The NFC NDEF fixture format audit must keep passing inside `npm run beta:foundation:verify`";
if (!roadmap.includes(roadmapMarker)) {
  errors.push(
    `${roadmapPath} must include NFC NDEF fixture audit release gate`,
  );
}

let scripts = {};
try {
  scripts = JSON.parse(packageJson).scripts ?? {};
} catch (error) {
  errors.push(`${packagePath} must be valid JSON: ${error.message}`);
}

if (
  scripts["security:nfc-ndef-fixture"] !==
  "node scripts/nfc-ndef-fixture-audit.js"
) {
  errors.push(`${packagePath} must define security:nfc-ndef-fixture`);
}
if (
  scripts["security:nfc-ndef-fixture:self-test"] !==
  "node scripts/nfc-ndef-fixture-audit-self-test.js"
) {
  errors.push(`${packagePath} must define security:nfc-ndef-fixture:self-test`);
}

const verifierMarkers = [
  "NFC NDEF fixture format audit self-test",
  "npm run security:nfc-ndef-fixture:self-test",
  "NFC NDEF fixture format audit",
  "npm run security:nfc-ndef-fixture",
];
for (const marker of verifierMarkers) {
  if (!verifier.includes(marker)) {
    errors.push(`${verifierPath} must include marker: ${marker}`);
  }
}

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
