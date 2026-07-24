const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/ops-scanner-device-evidence-audit.js",
);
const implementationSnapshotFiles = [
  "apps/ios/FanPass/project.yml",
  "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
  "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
  "apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift",
  "apps/ios/FanPass/FanPass/Features/Scanner/NFCPayloadScanner.swift",
  "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
  "apps/api/src/common/fanpass-auth.guard.ts",
  "apps/api/src/common/session.ts",
  "apps/api/src/modules/verification/verification.controller.ts",
  "apps/api/src/modules/verification/verification.service.ts",
  "docs/NFC_NDEF_TAG_FIXTURE.md",
  "scripts/nfc-ndef-fixture-audit.js",
  "scripts/ios-distribution-boundary-audit.js",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-ops-scanner-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts physical FanPass Ops QR-first evidence without secrets",
    writeEvidence("valid.txt", withProgressText(createEvidence())),
  );

  expectFail(
    "rejects simulator or local API evidence",
    writeEvidence(
      "local-simulator.txt",
      withProgressText(
        createEvidence({
          localSimulator: true,
          runtime: {
            realDeviceTested: false,
            apiBaseUrl: "http://localhost:4000",
          },
        }),
      ),
    ),
    [
      "localSimulator must be false",
      "runtime.realDeviceTested must be true",
      "runtime.apiBaseUrl must be an HTTPS URL",
    ],
  );

  expectFail(
    "rejects leaked bearer token and private-key markers",
    writeEvidence(
      "secret-markers.txt",
      `${withProgressText(createEvidence())}\nAuthorization: Bearer eyJhbGci\n-----BEGIN PRIVATE KEY-----\n`,
    ),
    ["Authorization: Bearer", "PRIVATE KEY"],
  );

  expectFail(
    "rejects leaked provider key and database URL markers",
    writeEvidence(
      "provider-database-markers.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234\nDATABASE_URL=postgresql://fixture:secret@db/fanpass\n`,
    ),
    ["STRIPE_PUBLISHABLE_KEY=", "pk_test_", "DATABASE_URL=", "database URLs"],
  );

  expectFail(
    "rejects leaked deployment and cloud credential markers",
    writeEvidence(
      "deployment-credential-markers.txt",
      [
        withProgressText(createEvidence()),
        "VERCEL_TOKEN=vercel_fixture_token_1234567890",
        '"AWS_SECRET_ACCESS_KEY": "aws_fixture_secret_1234567890"',
        '"cloudflareApiToken": "cloudflare_fixture_token_1234567890"',
      ].join("\n"),
    ),
    [
      "deployment or cloud credential assignment",
      "deployment or cloud credential field",
      "deployment or cloud credential environment field",
    ],
  );

  expectFail(
    "rejects missing deployment credential availability and redaction proof",
    writeEvidence(
      "missing-deployment-credential-proof.txt",
      withProgressText(
        createEvidence({
          runtime: {
            deploymentCredentialsAvailable: true,
          },
          redaction: {
            deploymentCredentialsRedacted: false,
          },
        }),
      ),
    ),
    [
      "runtime.deploymentCredentialsAvailable must be false",
      "redaction.deploymentCredentialsRedacted must be true",
    ],
  );

  expectFail(
    "rejects release NFC capability claims in QR-first evidence",
    writeEvidence(
      "release-nfc-claim.txt",
      withProgressText(
        createEvidence({
          releaseCapabilities: {
            releaseNfcEntitlementPresent: true,
            nativeNfcDebugOnly: false,
            nfcEvidenceClaimed: true,
          },
        }),
      ),
    ),
    [
      "releaseCapabilities.releaseNfcEntitlementPresent must be false",
      "releaseCapabilities.nativeNfcDebugOnly must be true",
      "releaseCapabilities.nfcEvidenceClaimed must be false",
    ],
  );

  expectFail(
    "rejects legacy NFC transport evidence in the QR-first contract",
    writeEvidence(
      "legacy-nfc-transport.txt",
      withProgressText(
        createEvidence({
          nfcTransport: {
            physicalTagReadVerified: true,
          },
        }),
      ),
    ),
    ["nfcTransport is not accepted by the QR-first release evidence contract"],
  );

  expectFail(
    "rejects stale FanPass Ops scanner implementation snapshot proof",
    writeEvidence(
      "stale-implementation-snapshot.txt",
      withProgressText(
        createEvidence({
          implementationSnapshot: {
            source: "stale-ops-scanner-boundaries",
            files: [
              {
                file: "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
                sha256: "0".repeat(64),
              },
              {
                file: "unexpected/scanner-boundary.swift",
                sha256: "1".repeat(64),
              },
            ],
          },
        }),
      ),
    ),
    [
      "implementationSnapshot.source must be ops-scanner-qr-first-device-boundaries",
      "implementationSnapshot.files must include the current FanPass Ops scanner implementation boundary files",
      "implementationSnapshot.files contains unexpected file unexpected/scanner-boundary.swift",
      "implementationSnapshot.files apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift sha256 must match the current FanPass Ops scanner implementation",
      "implementationSnapshot.files missing apps/ios/FanPass/project.yml",
    ],
  );

  expectFail(
    "rejects missing QR replay and invalid-payload proof",
    writeEvidence(
      "missing-qr-replay.txt",
      withProgressText(
        createEvidence({
          qrTransport: {
            duplicateReplayRejected: false,
            expiredOrInvalidPayloadRejected: false,
          },
        }),
      ),
    ),
    [
      "qrTransport.duplicateReplayRejected must be true",
      "qrTransport.expiredOrInvalidPayloadRejected must be true",
    ],
  );

  expectFail(
    "rejects missing backend authority proof",
    writeEvidence(
      "missing-backend-authority.txt",
      withProgressText(
        createEvidence({
          backendAuthority: {
            gateAssignmentEnforced: false,
            scannerIdentityDerivedFromBearer: false,
            clientSuppliedScannerUserRejected: false,
          },
        }),
      ),
    ),
    [
      "backendAuthority.gateAssignmentEnforced must be true",
      "backendAuthority.scannerIdentityDerivedFromBearer must be true",
      "backendAuthority.clientSuppliedScannerUserRejected must be true",
    ],
  );

  expectFail(
    "rejects real user or production credential evidence",
    writeEvidence(
      "real-user-data.txt",
      withProgressText(
        createEvidence({
          realUserDataUsed: true,
          productionCredentialsUsed: true,
        }),
      ),
    ),
    [
      "realUserDataUsed must be false",
      "productionCredentialsUsed must be false",
    ],
  );

  expectFail(
    "rejects missing redaction proof",
    writeEvidence(
      "missing-redaction.txt",
      withProgressText(
        createEvidence({
          redaction: {
            payloadNonceRedacted: false,
            staffIdentifiersRedacted: false,
          },
        }),
      ),
    ),
    [
      "redaction.payloadNonceRedacted must be true",
      "redaction.staffIdentifiersRedacted must be true",
    ],
  );

  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, cases }, null, 2));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

function createEvidence(overrides = {}) {
  return deepMerge(
    {
      ok: true,
      checkedAt: "2026-05-30T00:00:00.000Z",
      surface: "fanpass-ops",
      capabilityModel: "qr-first-release-v1",
      localSimulator: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      implementationSnapshot: createImplementationSnapshot(),
      runtime: {
        realDeviceTested: true,
        buildChannel: "development",
        apiBaseUrl: "https://api.staging.fanpass.example",
        releaseConfigUsed: true,
        debugPasteFallbackUsed: false,
        deploymentCredentialsAvailable: false,
      },
      releaseCapabilities: {
        cameraQrEnabled: true,
        releaseNfcEntitlementPresent: false,
        nativeNfcDebugOnly: true,
        nfcEvidenceClaimed: false,
      },
      qrTransport: {
        cameraScanVerified: true,
        acceptedScanVerified: true,
        duplicateReplayRejected: true,
        expiredOrInvalidPayloadRejected: true,
      },
      backendAuthority: {
        fanPassApiSignatureVerified: true,
        nonceReplayRejectedByApi: true,
        gateAssignmentEnforced: true,
        scannerIdentityDerivedFromBearer: true,
        clientSuppliedScannerUserRejected: true,
        checkInSummaryUpdated: true,
      },
      redaction: {
        bearerTokensRedacted: true,
        qrSigningSecretRedacted: true,
        payloadNonceRedacted: true,
        ticketIdentifiersRedacted: true,
        staffIdentifiersRedacted: true,
        deviceIdentifiersRedacted: true,
        providerSecretsRedacted: true,
        stripePublishableKeysRedacted: true,
        databaseUrlsRedacted: true,
        deploymentCredentialsRedacted: true,
      },
    },
    overrides,
  );
}

function withProgressText(evidence) {
  return [
    "Checking FanPass Ops physical QR-first scanner evidence...",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}

function createImplementationSnapshot() {
  return {
    source: "ops-scanner-qr-first-device-boundaries",
    files: implementationSnapshotFiles.map((file) => ({
      file,
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(rootDir, file)))
        .digest("hex"),
    })),
  };
}

function writeEvidence(fileName, contents) {
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

function expectPass(label, filePath) {
  const result = runAudit(filePath);
  cases.push({ label, expected: "pass", status: result.status });
  if (result.status !== 0) {
    errors.push(
      `${label}: expected pass, got ${result.status}: ${result.stderr || result.stdout}`,
    );
  }
}

function expectFail(label, filePath, requiredMessages) {
  const result = runAudit(filePath);
  cases.push({ label, expected: "fail", status: result.status });
  if (result.status === 0) {
    errors.push(`${label}: expected failure, got success`);
    return;
  }
  const output = `${result.stderr}\n${result.stdout}`;
  for (const message of requiredMessages) {
    if (!output.includes(message)) {
      errors.push(`${label}: failure output did not include ${message}`);
    }
  }
}

function runAudit(filePath) {
  return spawnSync(process.execPath, [auditScript, filePath], {
    cwd: rootDir,
    encoding: "utf8",
  });
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}
