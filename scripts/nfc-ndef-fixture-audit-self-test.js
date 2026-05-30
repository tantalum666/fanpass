const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/nfc-ndef-fixture-audit.js");
const cases = [
  {
    label: "accepts complete NFC fixture contract",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects missing FanPass Ops scope",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/NFC_NDEF_TAG_FIXTURE.md",
        fixtureDoc().replace("`FanPass Ops` only", "`FanPass` and Ops"),
      ),
    messages: ["`FanPass Ops` only"],
  },
  {
    label: "rejects missing backend authority and QR path",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/NFC_NDEF_TAG_FIXTURE.md",
        fixtureDoc()
          .replace("Backend authority remains FanPass API", "Mobile decides")
          .replace(
            "NFC payloads must enter the same redemption path as QR scans",
            "NFC has a separate redemption path",
          ),
      ),
    messages: [
      "Backend authority remains FanPass API",
      "same redemption path as QR",
    ],
  },
  {
    label: "rejects raw payload, nonce, and bearer leakage",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "docs/NFC_NDEF_TAG_FIXTURE.md",
        '\nAuthorization: Bearer eyJhbGciOiJIUzI1NiJ9.fake\n{"nonce":"raw-nonce","signedPayload":"raw"}\n',
      ),
    messages: ["bearer token marker", "JWT-looking token", "raw nonce"],
  },
  {
    label: "rejects missing physical-device evidence requirement",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/NFC_NDEF_TAG_FIXTURE.md",
        fixtureDoc().replace(
          "Physical-device evidence must pass `npm run security:ops-scanner:device-evidence -- <saved-json-output>`",
          "A simulator screenshot is enough",
        ),
      ),
    messages: ["Physical-device evidence must pass"],
  },
  {
    label: "rejects missing debug-only paste fallback boundary",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/NFC_NDEF_TAG_FIXTURE.md",
        fixtureDoc().replace(
          "debug paste fallback remains debug-only",
          "paste fallback can be used anywhere",
        ),
      ),
    messages: ["debug paste fallback remains debug-only"],
  },
  {
    label: "rejects unchecked task documentation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/DEVELOPMENT_TASKS.md",
        tasksDoc().replace("- [x] Add NFC", "- [ ] Add NFC"),
      ),
    messages: ["must mark the NFC NDEF fixture audit complete"],
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
      "must define security:nfc-ndef-fixture",
      "must define security:nfc-ndef-fixture:self-test",
    ],
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        "#!/usr/bin/env bash\necho missing nfc fixture audit\n",
      ),
    messages: ["NFC NDEF fixture format audit"],
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-nfc-ndef-fixture-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_NFC_NDEF_FIXTURE_AUDIT_ROOT: fixtureRoot,
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
    "scripts/beta-foundation-verify.sh",
    [
      "NFC NDEF fixture format audit self-test",
      "npm run security:nfc-ndef-fixture:self-test",
      "NFC NDEF fixture format audit",
      "npm run security:nfc-ndef-fixture",
    ].join("\n"),
  );
  writeFixtureFile(fixtureRoot, "docs/NFC_NDEF_TAG_FIXTURE.md", fixtureDoc());
  writeFixtureFile(fixtureRoot, "docs/DEVELOPMENT_TASKS.md", tasksDoc());
  writeFixtureFile(fixtureRoot, "docs/QA_CHECKLIST.md", qaDoc());
  writeFixtureFile(fixtureRoot, "docs/BETA_ROADMAP.md", roadmapDoc());
  writeFixtureFile(fixtureRoot, "docs/IOS_DISTRIBUTION_PLAN.md", iosPlanDoc());
}

function packageJson() {
  return JSON.stringify(
    {
      scripts: {
        "security:nfc-ndef-fixture": "node scripts/nfc-ndef-fixture-audit.js",
        "security:nfc-ndef-fixture:self-test":
          "node scripts/nfc-ndef-fixture-audit-self-test.js",
      },
    },
    null,
    2,
  );
}

function fixtureDoc() {
  return `# FanPass NFC NDEF Tag Fixture Format

Status: fixture contract ready; physical-device validation remains open.

This document applies to \`FanPass Ops\` only.
NFC is a transport for a FanPass signed entry payload.
Backend authority remains FanPass API.
NFC payloads must enter the same redemption path as QR scans.

Supported records:
- NDEF Text record
- NDEF URI record

Use <REDACTED_SIGNED_ENTRY_PAYLOAD> placeholders.

Do not put bearer tokens on NFC tags.
Do not put Privy tokens on NFC tags.
Do not put Stripe secrets on NFC tags.
Do not put QR signing secrets on NFC tags.
Do not put raw nonces on NFC tags.
Do not put raw signed payload fixtures in committed docs.
Do not put real ticket ids on NFC tags.
Do not put staff ids on NFC tags.
Do not put device identifiers on NFC tags.

Physical QA requires a real HTTPS staging or beta API URL, a physical NDEF tag, duplicate replay coverage, and an unsupported tag or unsupported device behavior check. The debug paste fallback remains debug-only.

Physical-device evidence must pass \`npm run security:ops-scanner:device-evidence -- <saved-json-output>\`.
This fixture contract only defines what the NFC test tag may contain.

## Redaction Requirements
Redact tokens, identifiers, secrets, and personal data.
`;
}

function tasksDoc() {
  return "- [x] Add NFC NDEF tag fixture format document and audit for supported physical-tag payloads.\n";
}

function qaDoc() {
  return [
    "Keep `npm run security:nfc-ndef-fixture:self-test` and `npm run security:nfc-ndef-fixture` in `npm run beta:foundation:verify`.",
    "NFC fixture documentation must keep FanPass Ops scope, QR-equivalent backend authority, supported NDEF Text/URI records, no-token/no-nonce/no-raw-payload constraints, debug-only paste fallback, and physical-device evidence requirements explicit.",
  ].join("\n");
}

function roadmapDoc() {
  return "The NFC NDEF fixture format audit must keep passing inside `npm run beta:foundation:verify`.\n";
}

function iosPlanDoc() {
  return "- Completed NFC tag fixture format document and audit for supported NDEF payloads: `docs/NFC_NDEF_TAG_FIXTURE.md` and `npm run security:nfc-ndef-fixture`.\n";
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
