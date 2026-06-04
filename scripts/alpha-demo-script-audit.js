const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_ALPHA_DEMO_SCRIPT_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_ALPHA_DEMO_SCRIPT_AUDIT_ROOT)
  : path.resolve(__dirname, "..");
const scriptPath = path.join(rootDir, "docs/ALPHA_DEMO_SCRIPT.md");
const contents = fs.readFileSync(scriptPath, "utf8");
const errors = [];

const requiredMarkers = [
  "# FanPass Alpha Demo Script",
  "Date frozen: 2026-05-29",
  "not a public Beta script",
  "must not be used with real personal data",
  "Stripe secrets",
  "Privy secrets",
  "FanPass` - fan event discovery",
  "FanPass Ops` - gate staff",
  "FanPass Console` - organizer/admin",
  "npm run beta:foundation:verify",
  "npm run beta:local:start",
  "npm run beta:local:verify",
  "npm run beta:local:stop",
  "Scene 1 - Product Boundary",
  "Scene 2 - Fan Discovery And Wallet",
  "Scene 3 - Marketplace And Settlement",
  "Scene 4 - Fan Access",
  "Scene 5 - Console Operations",
  "Scene 6 - FanPass Ops Entry",
  "Scene 7 - Security Boundary Close",
  "Local settlement completes through durable outbox jobs without real Stripe or chain credentials.",
  "Production tenant/staff staging evidence",
  "Signed iOS/TestFlight staging evidence",
  "Public/real-user dependency clean audit or Console migration",
  "Signed Apple Wallet `.pkpass` output",
  "Physical QR/NFC device validation",
  "Chain custody evidence",
  "Do not show shell environment variables",
];

const forbiddenMarkers = [
  "sk_live_",
  "sk_test_",
  "pk_live_",
  "whsec_",
  "-----BEGIN PRIVATE KEY-----",
  "PRIVY_VERIFICATION_KEY=",
  "STRIPE_SECRET_KEY=",
  "Authorization: Bearer ",
];

for (const marker of requiredMarkers) {
  if (!contents.includes(marker)) {
    errors.push(`docs/ALPHA_DEMO_SCRIPT.md must include marker: ${marker}`);
  }
}

for (const marker of forbiddenMarkers) {
  if (contents.includes(marker)) {
    errors.push(`docs/ALPHA_DEMO_SCRIPT.md must not include ${marker}`);
  }
}

if (!/^## Recording Checklist$/m.test(contents)) {
  errors.push(
    "docs/ALPHA_DEMO_SCRIPT.md must include a Recording Checklist section",
  );
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      file: "docs/ALPHA_DEMO_SCRIPT.md",
      requiredMarkers: requiredMarkers.length,
      forbiddenMarkers: forbiddenMarkers.length,
    },
    null,
    2,
  ),
);
