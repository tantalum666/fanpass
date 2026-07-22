const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  renderBetaFoundationGateFixture,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/ios-physical-device-qa-audit.js",
);

const cases = [
  {
    label: "accepts complete iOS physical-device QA checklist",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects missing real-device and signed-build scope",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/IOS_PHYSICAL_DEVICE_QA.md",
        fixtureDoc()
          .replace("Use a real iPhone, not a simulator", "Use any simulator")
          .replace(
            "signed `FanPass` and `FanPass Ops` builds on real iPhones",
            "local simulator builds",
          ),
      ),
    messages: ["Use a real iPhone", "signed `FanPass` and `FanPass Ops`"],
  },
  {
    label: "rejects missing FanPass consumer role-separation checks",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/IOS_PHYSICAL_DEVICE_QA.md",
        fixtureDoc().replace("## FanPass Consumer Checks", "## Consumer"),
      ),
    messages: ["## FanPass Consumer Checks"],
  },
  {
    label: "rejects missing FanPass Ops scanner and auth checks",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/IOS_PHYSICAL_DEVICE_QA.md",
        fixtureDoc()
          .replace("## FanPass Ops Checks", "## Ops")
          .replace("verified auth", "local demo session")
          .replace(
            "When NFC is explicitly re-enabled later, it must read a supported physical NDEF tag into the same backend redemption path as QR",
            "NFC reads anything",
          ),
      ),
    messages: ["## FanPass Ops Checks", "physical NDEF tag"],
  },
  {
    label: "rejects raw token, nonce, and signing leakage",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "docs/IOS_PHYSICAL_DEVICE_QA.md",
        '\nAuthorization: Bearer eyJhbGciOiJIUzI1NiJ9.fake\n{"nonce":"raw"}\nPROVISIONING_PROFILE_SPECIFIER=private\n',
      ),
    messages: ["bearer token marker", "JWT-looking token", "provisioning"],
  },
  {
    label: "rejects missing evidence handoffs",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/IOS_PHYSICAL_DEVICE_QA.md",
        fixtureDoc()
          .replace(
            "npm run security:ios-staging-build:evidence -- <saved-json-output>",
            "ios evidence",
          )
          .replace(
            "npm run security:ops-scanner:device-evidence -- <saved-json-output>",
            "scanner evidence",
          )
          .replace(
            "npm run security:stripe-testmode:evidence -- <saved-json-output>",
            "stripe evidence",
          ),
      ),
    messages: [
      "ios-staging-build:evidence",
      "ops-scanner:device-evidence",
      "stripe-testmode:evidence",
    ],
  },
  {
    label: "rejects unchecked task documentation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/DEVELOPMENT_TASKS.md",
        tasksDoc().replace(
          "- [x] Add physical-device",
          "- [ ] Add physical-device",
        ),
      ),
    messages: ["must mark the iOS physical-device QA checklist gate complete"],
  },
  {
    label: "rejects missing package scripts",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "package.json",
        JSON.stringify({ scripts: {} }, null, 2),
      ),
    messages: [
      "must define security:ios-physical-device-qa",
      "must define security:ios-physical-device-qa:self-test",
    ],
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        renderBetaFoundationGateFixture(["security:api-contracts"]),
      ),
    messages: ["must run npm script security:ios-physical-device-qa"],
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-ios-physical-qa-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_IOS_PHYSICAL_QA_AUDIT_ROOT: fixtureRoot,
      },
      encoding: "utf8",
    });
    const passed = result.status === 0;
    const expectedPass = testCase.expected === "pass";
    const output = `${result.stderr}\n${result.stdout}`;
    const messagesPresent = (testCase.messages ?? []).every((message) =>
      output.includes(message),
    );
    return {
      label: testCase.label,
      expected: testCase.expected,
      status: result.status,
      ok: passed === expectedPass && (expectedPass || messagesPresent),
      stderr: result.stderr.trim(),
    };
  } finally {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
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
  writeFixtureFile(fixtureRoot, "package.json", packageJson());
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.js",
    renderBetaFoundationGateFixture([
      "security:ios-physical-device-qa:self-test",
      "security:ios-physical-device-qa",
    ]),
  );
  writeFixtureFile(fixtureRoot, "docs/IOS_PHYSICAL_DEVICE_QA.md", fixtureDoc());
  writeFixtureFile(fixtureRoot, "docs/DEVELOPMENT_TASKS.md", tasksDoc());
  writeFixtureFile(fixtureRoot, "docs/QA_CHECKLIST.md", qaDoc());
  writeFixtureFile(fixtureRoot, "docs/BETA_ROADMAP.md", roadmapDoc());
  writeFixtureFile(fixtureRoot, "docs/IOS_DISTRIBUTION_PLAN.md", iosPlanDoc());
  writeFixtureFile(
    fixtureRoot,
    "docs/PROVIDER_COST_FEASIBILITY.md",
    providerDoc(),
  );
}

function packageJson() {
  return JSON.stringify(
    {
      scripts: {
        "security:ios-physical-device-qa":
          "node scripts/ios-physical-device-qa-audit.js",
        "security:ios-physical-device-qa:self-test":
          "node scripts/ios-physical-device-qa-audit-self-test.js",
      },
    },
    null,
    2,
  );
}

function fixtureDoc() {
  return `# FanPass iOS Physical-Device QA Checklist

Status: checklist gate ready; physical-device execution remains open.

This checklist is for signed \`FanPass\` and \`FanPass Ops\` builds on real iPhones. It does not replace saved iOS staging/TestFlight build evidence.

Do not use real personal data, production credentials, Apple signing material, device identifiers, or raw signed payloads.

## Required Environment
- Use a real iPhone, not a simulator.
- Use a real HTTPS staging or beta API URL.
- Do not use localhost.
- Use Stripe test mode only.
- Use a Privy test app.
- Keep separate apps with separate bundle ids.

## FanPass Consumer Checks
- No staff scanner, gate, inventory, audit, admin, NFC, or Camera permission prompt appears in the consumer app.
- Payment UI uses the Stripe iOS PaymentSheet presenter boundary.
- Wallet barcode remains blocked until Apple Wallet signed-pass evidence passes \`npm run security:apple-wallet:evidence -- <saved-json-output>\`.

## FanPass Ops Checks
- Gate staff can sign in with verified auth.
- Staff only sees assigned event/gate access.
- QR camera scanning accepts the first valid staging payload and rejects duplicate replay.
- When NFC is explicitly re-enabled later, it must read a supported physical NDEF tag into the same backend redemption path as QR.
- Scanner identity comes from the verified auth session.
- Debug paste fallback and payload copy helpers are unavailable.
- FanPass Ops does not expose consumer wallet, marketplace, checkout, PaymentSheet, or organizer inventory flows.

## Shared Evidence Handoffs
- \`npm run security:ios-staging-build:evidence -- <saved-json-output>\`
- \`npm run security:ops-scanner:device-evidence -- <saved-json-output>\`
- \`npm run security:apple-wallet:evidence -- <saved-json-output>\`
- \`npm run security:runtime:staging:evidence -- <saved-json-output>\`
- \`npm run security:staff-tenant:staging-evidence -- <saved-json-output>\`
- \`npm run security:stripe-testmode:evidence -- <saved-json-output>\`
- \`npm run security:privy-plan:evidence -- <saved-json-output>\`

## Redaction Review
Redact all tokens, provider secrets, identifiers, and personal data.
`;
}

function tasksDoc() {
  return "- [x] Add physical-device QA checklist and audit for FanPass and FanPass Ops before external tester evidence is trusted.\n";
}

function qaDoc() {
  return [
    "Keep `npm run security:ios-physical-device-qa:self-test` and `npm run security:ios-physical-device-qa` in `node scripts/beta-foundation-verify.js`.",
    "The iOS physical-device QA checklist must keep real-iPhone scope, signed build scope, HTTPS staging/beta API scope, FanPass/FanPass Ops role separation, no-debug-fallback requirements, no-secret/no-real-data constraints, and saved-evidence handoffs explicit.",
  ].join("\n");
}

function roadmapDoc() {
  return "The iOS physical-device QA checklist audit must keep passing inside `node scripts/beta-foundation-verify.js`.\n";
}

function iosPlanDoc() {
  return "- Completed physical-device QA checklist and audit for FanPass and FanPass Ops: `docs/IOS_PHYSICAL_DEVICE_QA.md` and `npm run security:ios-physical-device-qa`.\n";
}

function providerDoc() {
  return "`npm run security:ios-physical-device-qa` keeps the signed-real-device QA runbook explicit before external tester evidence is trusted.\n";
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const filePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

function appendFixtureFile(fixtureRoot, relativePath, contents) {
  const filePath = path.join(fixtureRoot, relativePath);
  fs.appendFileSync(filePath, contents, "utf8");
}
