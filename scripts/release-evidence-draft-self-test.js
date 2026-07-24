const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const fixedCheckedAt = "2026-06-04T00:00:00.000Z";
const cases = [
  {
    kind: "staff-tenant",
    label: "creates staging tenant/staff draft",
    provider: "staff-tenant-staging",
    snapshotSource: "staff-tenant-staging-policy-boundaries",
    fileCount: 12,
    nextValidator: "npm run security:staff-tenant:staging-evidence",
  },
  {
    kind: "ios-build",
    label: "creates signed iOS/TestFlight draft",
    provider: "ios-staging-build",
    snapshotSource: "ios-staging-build-distribution-boundaries",
    fileCount: 20,
    nextValidator: "npm run security:ios-staging-build:evidence",
  },
  {
    kind: "apple-wallet",
    label: "creates signed Apple Wallet draft",
    provider: "apple-wallet",
    snapshotSource: "apple-wallet-pass-boundaries",
    fileCount: 12,
    nextValidator: "npm run security:apple-wallet:evidence",
  },
  {
    kind: "ops-scanner",
    label: "creates physical QR-first scanner draft",
    surface: "fanpass-ops",
    snapshotSource: "ops-scanner-qr-first-device-boundaries",
    fileCount: 14,
    nextValidator: "npm run security:ops-scanner:device-evidence",
  },
  {
    kind: "chain-custody",
    label: "creates chain custody draft",
    provider: "chain-custody",
    snapshotSource: "chain-custody-ownership-outbox-boundaries",
    fileCount: 12,
    nextValidator: "npm run security:chain-custody:evidence",
  },
];

const results = cases.map(runCase);
results.push(runOutFileCase());
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
        "scripts/release-evidence-draft.js",
        testCase.kind,
        "--checked-at",
        fixedCheckedAt,
      ],
      { encoding: "utf8" },
    );
    assertNoSecretMarkers(output);
    const draft = JSON.parse(output);
    assert(draft.ok === false, `${testCase.kind}: draft ok must be false`);
    assert(draft.draft === true, `${testCase.kind}: draft flag missing`);
    assert(
      draft.checkedAt === fixedCheckedAt,
      `${testCase.kind}: checkedAt mismatch`,
    );
    if (testCase.provider) {
      assert(
        draft.provider === testCase.provider,
        `${testCase.kind}: provider mismatch`,
      );
    }
    if (testCase.surface) {
      assert(
        draft.surface === testCase.surface,
        `${testCase.kind}: surface mismatch`,
      );
    }
    const snapshot = draft.implementationSnapshot;
    assert(
      snapshot?.source === testCase.snapshotSource,
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
        `${testCase.kind}: snapshot file missing`,
      );
      assert(
        /^[a-f0-9]{64}$/.test(entry.sha256),
        `${testCase.kind}: snapshot sha256 invalid`,
      );
    }
    assert(
      typeof draft.nextValidator === "string" &&
        draft.nextValidator.startsWith(testCase.nextValidator),
      `${testCase.kind}: next validator mismatch`,
    );
    return { label: testCase.label, status: 0 };
  } catch (error) {
    return { label: testCase.label, status: 1, error: error.message };
  }
}

function runOutFileCase() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fanpass-draft-"));
  const outPath = path.join(tmpDir, "draft.json");
  try {
    const output = execFileSync(
      process.execPath,
      [
        "scripts/release-evidence-draft.js",
        "staff-tenant",
        "--checked-at",
        fixedCheckedAt,
        "--out",
        outPath,
      ],
      { encoding: "utf8" },
    );
    const receipt = JSON.parse(output);
    assert(receipt.ok === true, "out-file receipt ok mismatch");
    const draft = JSON.parse(fs.readFileSync(outPath, "utf8"));
    assert(draft.ok === false, "out-file draft ok must be false");
    assertNoSecretMarkers(JSON.stringify(draft));
    return { label: "writes draft to --out path", status: 0 };
  } catch (error) {
    return {
      label: "writes draft to --out path",
      status: 1,
      error: error.message,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
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
    "-----BEGIN CERTIFICATE-----",
    "DATABASE_URL=",
    "client_secret",
    "PROVISIONING_PROFILE_SPECIFIER=",
    "RPC_URL=",
    "MNEMONIC=",
    "SEED_PHRASE=",
    "STAGING_ADMIN_ACCESS_TOKEN=",
  ];
  const lowerOutput = output.toLowerCase();
  for (const marker of forbidden) {
    if (lowerOutput.includes(marker.toLowerCase())) {
      throw new Error(`draft output contains forbidden marker ${marker}`);
    }
  }
}
