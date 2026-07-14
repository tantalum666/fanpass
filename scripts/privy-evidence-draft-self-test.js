const { execFileSync } = require("child_process");

const fixedCheckedAt = "2026-05-30T00:00:00.000Z";
const cases = [
  {
    label: "creates Privy plan dashboard draft with current policy snapshot",
    kind: "plan",
    provider: "privy",
    snapshotKey: "policySnapshot",
    source: "privy-plan-auth-policy-boundaries",
    fileCount: 9,
  },
  {
    label: "creates Privy mobile app config draft with current iOS snapshot",
    kind: "mobile",
    provider: "privy-mobile-app-config",
    snapshotKey: "implementationSnapshot",
    source: "privy-ios-auth-config-boundaries",
    fileCount: 13,
  },
  {
    label:
      "creates Privy Console SDK isolation draft with current Console snapshot",
    kind: "console",
    provider: "privy-console-react-sdk-isolation",
    snapshotKey: "implementationSnapshot",
    source: "privy-console-sdk-isolation-boundaries",
    fileCount: 20,
  },
];

const results = cases.map(runCase);
const failed = results.filter((result) => result.status !== 0);

console.log(
  JSON.stringify({ ok: failed.length === 0, cases: results }, null, 2),
);

if (failed.length > 0) {
  process.exit(1);
}

function runCase(testCase) {
  try {
    const output = execFileSync(
      process.execPath,
      [
        "scripts/privy-evidence-draft.js",
        testCase.kind,
        "--checked-at",
        fixedCheckedAt,
      ],
      { encoding: "utf8" },
    );
    assertNoSecretMarkers(output);
    const draft = JSON.parse(output);
    assert(draft.ok === false, `${testCase.kind}: draft ok must remain false`);
    assert(draft.draft === true, `${testCase.kind}: draft flag missing`);
    assert(
      draft.checkedAt === fixedCheckedAt,
      `${testCase.kind}: checkedAt mismatch`,
    );
    assert(
      draft.provider === testCase.provider,
      `${testCase.kind}: provider mismatch`,
    );
    const snapshot = draft[testCase.snapshotKey];
    assert(
      snapshot?.source === testCase.source,
      `${testCase.kind}: snapshot source mismatch`,
    );
    assert(
      Array.isArray(snapshot.files) &&
        snapshot.files.length === testCase.fileCount,
      `${testCase.kind}: snapshot file count mismatch`,
    );
    for (const entry of snapshot.files) {
      assert(
        typeof entry.file === "string" && entry.file.length > 0,
        `${testCase.kind}: snapshot entry file missing`,
      );
      assert(
        /^[a-f0-9]{64}$/.test(entry.sha256),
        `${testCase.kind}: snapshot entry sha256 invalid`,
      );
    }
    assert(
      typeof draft.nextValidator === "string" &&
        draft.nextValidator.startsWith("npm run security:privy-"),
      `${testCase.kind}: next validator missing`,
    );
    return { label: testCase.label, status: 0 };
  } catch (error) {
    return { label: testCase.label, status: 1, error: error.message };
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoSecretMarkers(output) {
  const forbidden = [
    "sk_test_",
    "sk_live_",
    "pk_test_",
    "pk_live_",
    "whsec_",
    "Authorization: Bearer ",
    "eyJhbGci",
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN PUBLIC KEY-----",
    "DATABASE_URL=",
    "client_secret",
  ];
  const lowerOutput = output.toLowerCase();
  for (const marker of forbidden) {
    if (lowerOutput.includes(marker.toLowerCase())) {
      throw new Error(`draft output contains forbidden marker ${marker}`);
    }
  }
}
