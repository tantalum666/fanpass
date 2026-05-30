const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_ALPHA_WALKTHROUGH_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_ALPHA_WALKTHROUGH_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

const evidencePath = "docs/ALPHA_WALKTHROUGH_EVIDENCE.md";
const tasksPath = "docs/DEVELOPMENT_TASKS.md";
const verifierPath = "scripts/beta-foundation-verify.sh";

const evidence = readRequired(evidencePath);
const tasks = readRequired(tasksPath);
const verifier = readRequired(verifierPath);

const requiredEvidenceMarkers = [
  "# FanPass Alpha Walkthrough Evidence",
  "Status: evidence gate ready; walkthrough recording remains open",
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
  "npm run beta:foundation:verify",
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
  "Real Privy SDK login",
  "Real Stripe test-mode keys",
  "Deployed HTTPS staging evidence",
  "Next/PostCSS advisory closure or explicit risk acceptance",
  "Signed Apple Wallet `.pkpass`",
  "Real-device NFC/TestFlight validation",
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

const openRecordingTask =
  "- [ ] Record an Alpha walkthrough using the frozen local script.";
if (!tasks.includes(openRecordingTask)) {
  errors.push(
    `${tasksPath} must keep the Alpha walkthrough recording task open until actual recording evidence is captured`,
  );
}

const verifierMarkers = [
  "Alpha walkthrough evidence audit self-test",
  "npm run alpha:walkthrough:evidence:audit:self-test",
  "Alpha walkthrough evidence audit",
  "npm run alpha:walkthrough:evidence:audit",
  "Alpha walkthrough capture self-test",
  "npm run alpha:walkthrough:capture:self-test",
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
      file: evidencePath,
      requiredMarkers: requiredEvidenceMarkers.length,
      forbiddenMarkers: forbiddenEvidenceMarkers.length,
      recordingTask: "open",
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
