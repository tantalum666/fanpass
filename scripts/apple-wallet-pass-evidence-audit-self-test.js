const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/apple-wallet-pass-evidence-audit.js",
);
const implementationSnapshotFiles = [
  "apps/ios/FanPass/project.yml",
  "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
  "apps/ios/FanPass/FanPass/Models/FanPassModels.swift",
  "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
  "apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift",
  "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
  "apps/api/src/modules/verification/verification.controller.ts",
  "apps/api/src/modules/verification/verification.service.ts",
  "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
  "scripts/prototype-shortcut-audit.js",
  "scripts/ios-distribution-boundary-audit.js",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-apple-wallet-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts signed Apple Wallet pass evidence without secrets",
    writeEvidence("valid.txt", withProgressText(createEvidence())),
  );

  expectFail(
    "rejects local unsigned barcode prototype evidence",
    writeEvidence(
      "local-prototype.txt",
      withProgressText(
        createEvidence({
          localPrototype: true,
          usesUnsignedPrototype: true,
          passSigning: { signedWithApplePassCertificate: false },
        }),
      ),
    ),
    [
      "localPrototype must be false",
      "usesUnsignedPrototype must be false",
      "passSigning.signedWithApplePassCertificate must be true",
    ],
  );

  expectFail(
    "rejects leaked Apple signing private key markers",
    writeEvidence(
      "private-key.txt",
      `${withProgressText(createEvidence())}\n-----BEGIN PRIVATE KEY-----\n`,
    ),
    ["PRIVATE KEY"],
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
          deploymentCredentialsAvailable: true,
          redaction: {
            deploymentCredentialsRedacted: false,
          },
        }),
      ),
    ),
    [
      "deploymentCredentialsAvailable must be false",
      "redaction.deploymentCredentialsRedacted must be true",
    ],
  );

  expectFail(
    "rejects certificate export evidence",
    writeEvidence(
      "exported-certificate.txt",
      withProgressText(
        createEvidence({
          passSigning: { certificatePrivateKeyExported: true },
        }),
      ),
    ),
    ["certificatePrivateKeyExported must be false"],
  );

  expectFail(
    "rejects simulator-only Wallet evidence",
    writeEvidence(
      "simulator-only.txt",
      withProgressText(
        createEvidence({
          deviceInstall: {
            realDeviceTested: false,
            simulatorOnly: true,
          },
        }),
      ),
    ),
    [
      "deviceInstall.realDeviceTested must be true",
      "simulatorOnly must be false",
    ],
  );

  expectFail(
    "rejects stale Apple Wallet pass implementation snapshot proof",
    writeEvidence(
      "stale-implementation-snapshot.txt",
      withProgressText(
        createEvidence({
          implementationSnapshot: {
            source: "stale-wallet-pass-boundaries",
            files: [
              {
                file: "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
                sha256: "0".repeat(64),
              },
              {
                file: "unexpected/wallet-pass.swift",
                sha256: "1".repeat(64),
              },
            ],
          },
        }),
      ),
    ),
    [
      "implementationSnapshot.source must be apple-wallet-pass-boundaries",
      "implementationSnapshot.files must include the current Apple Wallet pass boundary files",
      "implementationSnapshot.files contains unexpected file unexpected/wallet-pass.swift",
      "implementationSnapshot.files apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift sha256 must match the current Apple Wallet pass implementation",
      "implementationSnapshot.files missing apps/ios/FanPass/project.yml",
    ],
  );

  expectFail(
    "rejects invalid barcode formats",
    writeEvidence(
      "bad-barcode.txt",
      withProgressText(
        createEvidence({
          passSigning: { barcodeFormat: "PDF417" },
        }),
      ),
    ),
    ["barcodeFormat must be PKBarcodeFormatQR or PKBarcodeFormatAztec"],
  );

  expectFail(
    "rejects pass contents with real personal or payment data",
    writeEvidence(
      "bad-contents.txt",
      withProgressText(
        createEvidence({
          passContents: {
            containsNoRealPersonalData: false,
            containsNoPaymentData: false,
          },
        }),
      ),
    ),
    [
      "passContents.containsNoRealPersonalData must be true",
      "passContents.containsNoPaymentData must be true",
    ],
  );

  expectFail(
    "rejects missing redaction proof",
    writeEvidence(
      "missing-redaction.txt",
      withProgressText(
        createEvidence({
          redaction: {
            privateKeyRedacted: false,
            ticketIdentifiersRedacted: false,
          },
        }),
      ),
    ),
    [
      "redaction.privateKeyRedacted must be true",
      "redaction.ticketIdentifiersRedacted must be true",
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
      provider: "apple-wallet",
      localPrototype: false,
      usesUnsignedPrototype: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      deploymentCredentialsAvailable: false,
      implementationSnapshot: createImplementationSnapshot(),
      passSigning: {
        pkpassGenerated: true,
        pkpassValidated: true,
        signedWithApplePassCertificate: true,
        certificatePrivateKeyExported: false,
        passTypeIdentifierConfigured: true,
        teamIdentifierConfigured: true,
        manifestHashVerified: true,
        signatureVerified: true,
        barcodePayloadSignedByFanPassApi: true,
        barcodeFormat: "PKBarcodeFormatQR",
      },
      deviceInstall: {
        realDeviceTested: true,
        simulatorOnly: false,
        buildChannel: "development",
        addPassFlowVerified: true,
        walletDisplaysSignedPass: true,
        barcodeScansThroughFanPassOps: true,
      },
      passContents: {
        containsNoRealPersonalData: true,
        containsNoProviderSecrets: true,
        containsNoPaymentData: true,
        containsOnlySignedEntryPayload: true,
        expirationMatchesQrTtlPolicy: true,
      },
      security: {
        noPrivateKeysInRepo: true,
        passCertificateNotCommitted: true,
        usesEphemeralTestTicket: true,
        revocationOrRotationPlanDocumented: true,
        prototypeBarcodeFallbackRemovedOrDebugOnly: true,
      },
      redaction: {
        privateKeyRedacted: true,
        certificateSerialRedacted: true,
        teamIdRedactedOrNonSecret: true,
        passTypeIdRedactedOrNonSecret: true,
        ticketIdentifiersRedacted: true,
        bearerTokensRedacted: true,
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
    "Checking FanPass Apple Wallet signed-pass evidence...",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}

function createImplementationSnapshot() {
  return {
    source: "apple-wallet-pass-boundaries",
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
