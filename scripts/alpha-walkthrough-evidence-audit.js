const fs = require("fs");
const path = require("path");
const {
  assertOrderedNpmScripts,
  loadBetaFoundationGateSteps,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = process.env.FANPASS_ALPHA_WALKTHROUGH_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_ALPHA_WALKTHROUGH_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];
const betaGateSteps = loadBetaFoundationGateSteps(rootDir, errors);

const evidencePath = "docs/ALPHA_WALKTHROUGH_EVIDENCE.md";
const tasksPath = "docs/DEVELOPMENT_TASKS.md";

const evidence = readRequired(evidencePath);
const tasks = readRequired(tasksPath);

const requiredEvidenceMarkers = [
  "# FanPass Alpha Walkthrough Evidence",
  "Status: optional evidence gate ready; walkthrough recording is owner-skipped for current Beta foundation",
  "Local-only recording scope",
  "Seven-scene coverage",
  "Scene 1 - Product Boundary",
  "Scene 2 - Fan Discovery And Wallet",
  "Scene 3 - Marketplace And Settlement",
  "Scene 4 - Fan Access",
  "Scene 5 - Console Operations",
  "Scene 6 - FanPass Ops Entry",
  "Scene 7 - Security Boundary Close",
  "Recording artifact path",
  "Verification evidence",
  "scripts/beta-foundation-launcher.js",
  "reviewed launcher digest",
  "npm run beta:local:start",
  "npm run beta:local:verify",
  "npm run beta:local:stop",
  "npm run alpha:walkthrough:capture",
  "Forbidden evidence",
  "Do not use real personal data",
  "Do not use production credentials",
  "Do not use Stripe secrets",
  "Do not use Privy secrets",
  "Remaining blockers",
  "Signed iOS/TestFlight staging evidence",
  "Public/real-user dependency clean audit or Console migration",
  "Signed Apple Wallet `.pkpass`",
  "Physical QR/NFC device validation",
  "Chain custody evidence",
];

const forbiddenEvidenceMarkers = [
  "sk_live_",
  "sk_test_",
  "pk_live_",
  "whsec_",
  "-----BEGIN PRIVATE KEY-----",
  "PRIVY_VERIFICATION_KEY=",
  "STRIPE_SECRET_KEY=",
  "Authorization: Bearer ",
  "Status: recorded",
  "Status: complete",
];

for (const marker of requiredEvidenceMarkers) {
  if (!evidence.includes(marker)) {
    errors.push(`${evidencePath} must include marker: ${marker}`);
  }
}

for (const marker of forbiddenEvidenceMarkers) {
  if (evidence.includes(marker)) {
    errors.push(`${evidencePath} must not include marker: ${marker}`);
  }
}

const evidenceGateTask =
  "- [x] Add repeatable Alpha walkthrough recording evidence gate before closing the local walkthrough task.";
if (!tasks.includes(evidenceGateTask)) {
  errors.push(
    `${tasksPath} must mark the Alpha walkthrough evidence gate complete`,
  );
}

const captureAutomationTask =
  "- [x] Add repeatable Alpha walkthrough capture automation and self-test for local artifact bundles.";
if (!tasks.includes(captureAutomationTask)) {
  errors.push(
    `${tasksPath} must mark the Alpha walkthrough capture automation complete`,
  );
}

const ownerSkippedRecordingTask =
  "- [x] Record an Alpha walkthrough using the frozen local script.";
if (!tasks.includes(ownerSkippedRecordingTask)) {
  errors.push(
    `${tasksPath} must mark the Alpha walkthrough recording task owner-skipped for the current Beta foundation`,
  );
}

assertOrderedNpmScripts(
  betaGateSteps,
  [
    "alpha:walkthrough:evidence:audit:self-test",
    "alpha:walkthrough:evidence:audit",
    "alpha:walkthrough:capture:self-test",
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
      file: evidencePath,
      requiredMarkers: requiredEvidenceMarkers.length,
      forbiddenMarkers: forbiddenEvidenceMarkers.length,
      recordingTask: "owner-skipped",
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
