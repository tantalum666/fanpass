const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/alpha-walkthrough-evidence-audit.js",
);

const cases = [
  {
    label: "accepts a complete Alpha walkthrough evidence contract",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects missing local-only evidence scope",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/ALPHA_WALKTHROUGH_EVIDENCE.md",
        alphaWalkthroughEvidence().replace(
          "Local-only recording scope",
          "External Beta recording scope",
        ),
      ),
  },
  {
    label: "rejects missing seven-scene coverage",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/ALPHA_WALKTHROUGH_EVIDENCE.md",
        alphaWalkthroughEvidence().replace(
          "Scene 6 - FanPass Ops Entry",
          "Scene 6 - Entry",
        ),
      ),
  },
  {
    label: "rejects missing owner-skipped recording task closeout",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/DEVELOPMENT_TASKS.md",
        developmentTasks().replace(
          "- [x] Record an Alpha walkthrough using the frozen local script.",
          "- [ ] Record an Alpha walkthrough using the frozen local script.",
        ),
      ),
  },
  {
    label: "rejects missing capture automation task",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/DEVELOPMENT_TASKS.md",
        developmentTasks().replace(
          "- [x] Add repeatable Alpha walkthrough capture automation and self-test for local artifact bundles.\n",
          "",
        ),
      ),
  },
  {
    label: "rejects embedded provider secret markers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/ALPHA_WALKTHROUGH_EVIDENCE.md",
        `${alphaWalkthroughEvidence()}\n\nExample secret: sk_live_fixture\n`,
      ),
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        betaFoundationVerifier().replace(
          "npm run alpha:walkthrough:evidence:audit",
          "npm run alpha:walkthrough:evidence:check",
        ),
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-alpha-walkthrough-evidence-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_ALPHA_WALKTHROUGH_AUDIT_ROOT: fixtureRoot,
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
  writeFixtureFile(
    fixtureRoot,
    "docs/ALPHA_WALKTHROUGH_EVIDENCE.md",
    alphaWalkthroughEvidence(),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/DEVELOPMENT_TASKS.md",
    developmentTasks(),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.sh",
    betaFoundationVerifier(),
  );
}

function alphaWalkthroughEvidence() {
  return [
    "# FanPass Alpha Walkthrough Evidence",
    "",
    "Status: optional evidence gate ready; walkthrough recording is owner-skipped for current Beta foundation.",
    "",
    "## Local-only recording scope",
    "",
    "- Do not use real personal data.",
    "- Do not use production credentials.",
    "- Do not use Stripe secrets.",
    "- Do not use Privy secrets.",
    "",
    "## Seven-scene coverage",
    "",
    "- Scene 1 - Product Boundary",
    "- Scene 2 - Fan Discovery And Wallet",
    "- Scene 3 - Marketplace And Settlement",
    "- Scene 4 - Fan Access",
    "- Scene 5 - Console Operations",
    "- Scene 6 - FanPass Ops Entry",
    "- Scene 7 - Security Boundary Close",
    "",
    "## Recording artifact path",
    "",
    "- Future recording files must live under `outputs/alpha-walkthrough/`.",
    "",
    "## Verification evidence",
    "",
    "```bash",
    "npm run beta:foundation:verify",
    "npm run beta:local:start",
    "npm run beta:local:verify",
    "npm run beta:local:stop",
    "npm run alpha:walkthrough:capture",
    "```",
    "",
    "## Forbidden evidence",
    "",
    "- Do not record shell environment variables, bearer tokens, private keys, Stripe secrets, Privy secrets, or production provider dashboards.",
    "",
    "## Remaining blockers",
    "",
    "- Signed iOS/TestFlight staging evidence",
    "- Public/real-user dependency clean audit or Console migration",
    "- Signed Apple Wallet `.pkpass`",
    "- Physical QR/NFC device validation",
    "- Chain custody evidence",
    "",
  ].join("\n");
}

function developmentTasks() {
  return [
    "# Development Tasks",
    "",
    "## Beta",
    "",
    "- [x] Freeze Alpha demo script for the local walkthrough.",
    "- [x] Add repeatable Alpha walkthrough recording evidence gate before closing the local walkthrough task.",
    "- [x] Add repeatable Alpha walkthrough capture automation and self-test for local artifact bundles.",
    "- [x] Record an Alpha walkthrough using the frozen local script.",
    "",
  ].join("\n");
}

function betaFoundationVerifier() {
  return [
    "#!/usr/bin/env bash",
    'run_step "Alpha walkthrough evidence audit self-test" npm run alpha:walkthrough:evidence:audit:self-test',
    'run_step "Alpha walkthrough evidence audit" npm run alpha:walkthrough:evidence:audit',
    'run_step "Alpha walkthrough capture self-test" npm run alpha:walkthrough:capture:self-test',
    "",
  ].join("\n");
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
