const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/alpha-demo-script-audit.js");

const cases = [
  {
    label: "accepts a complete Alpha demo script fixture",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects missing local-only scope marker",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/ALPHA_DEMO_SCRIPT.md",
        alphaDemoScript().replace("not a public Beta script", "ready for Beta"),
      ),
  },
  {
    label: "rejects missing product surface marker",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/ALPHA_DEMO_SCRIPT.md",
        alphaDemoScript().replace(
          "`FanPass Ops` - gate staff",
          "`Venue App` - gate staff",
        ),
      ),
  },
  {
    label: "rejects missing verification command marker",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/ALPHA_DEMO_SCRIPT.md",
        alphaDemoScript().replace(
          "npm run beta:foundation:verify",
          "npm run verify",
        ),
      ),
  },
  {
    label: "rejects missing required scene marker",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/ALPHA_DEMO_SCRIPT.md",
        alphaDemoScript().replace(
          "Scene 7 - Security Boundary Close",
          "Scene 7 - Wrap Up",
        ),
      ),
  },
  {
    label: "rejects missing unresolved Beta blocker marker",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/ALPHA_DEMO_SCRIPT.md",
        alphaDemoScript().replace(
          "Signed iOS/TestFlight staging evidence",
          "Signed iOS evidence is ready",
        ),
      ),
  },
  {
    label: "rejects missing recording checklist",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/ALPHA_DEMO_SCRIPT.md",
        alphaDemoScript().replace("## Recording Checklist", "## Checklist"),
      ),
  },
  {
    label: "rejects embedded provider secret markers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/ALPHA_DEMO_SCRIPT.md",
        `${alphaDemoScript()}\n\nExample secret: sk_live_fixture\n`,
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-alpha-demo-script-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_ALPHA_DEMO_SCRIPT_AUDIT_ROOT: fixtureRoot,
      },
      encoding: "utf8",
    });
    const passed = result.status === 0;
    const expectedPass = testCase.expected === "pass";
    return {
      label: testCase.label,
      expected: testCase.expected,
      status: result.status,
      ok: passed === expectedPass,
      stderr: result.stderr.trim(),
    };
  } finally {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        failures,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      cases: results.map(({ label, expected, status }) => ({
        label,
        expected,
        status,
      })),
    },
    null,
    2,
  ),
);

function writePassingFixture(fixtureRoot) {
  writeFixtureFile(fixtureRoot, "docs/ALPHA_DEMO_SCRIPT.md", alphaDemoScript());
}

function alphaDemoScript() {
  return [
    "# FanPass Alpha Demo Script",
    "",
    "Date frozen: 2026-05-29",
    "",
    "Status: frozen for local Alpha walkthrough preparation. This is not a public Beta script and must not be used with real personal data, Stripe secrets, Privy secrets, or production credentials.",
    "",
    "## Purpose",
    "",
    "- `FanPass` - fan event discovery, wallet, marketplace, and fan access.",
    "- `FanPass Ops` - gate staff.",
    "- `FanPass Console` - organizer/admin.",
    "",
    "## Preflight",
    "",
    "```bash",
    "npm run beta:foundation:verify",
    "npm run beta:local:start",
    "npm run beta:local:verify",
    "npm run beta:local:stop",
    "```",
    "",
    "## Scene 1 - Product Boundary",
    "## Scene 2 - Fan Discovery And Wallet",
    "## Scene 3 - Marketplace And Settlement",
    "",
    "Local settlement completes through durable outbox jobs without real Stripe or chain credentials.",
    "",
    "## Scene 4 - Fan Access",
    "## Scene 5 - Console Operations",
    "## Scene 6 - FanPass Ops Entry",
    "## Scene 7 - Security Boundary Close",
    "",
    "Not proven for external Beta:",
    "",
    "- Signed iOS/TestFlight staging evidence.",
    "- Public/real-user dependency clean audit or Console migration.",
    "- Signed Apple Wallet `.pkpass` output.",
    "- Physical QR/NFC device validation.",
    "- Chain custody evidence.",
    "",
    "## Recording Checklist",
    "",
    "- Do not show shell environment variables.",
    "",
  ].join("\n");
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
