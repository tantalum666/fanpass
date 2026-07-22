const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/alpha-walkthrough-recording-evidence-audit.js",
);
const recordingPolicySnapshotFiles = [
  "docs/ALPHA_DEMO_SCRIPT.md",
  "docs/ALPHA_WALKTHROUGH_EVIDENCE.md",
  "docs/ALPHA_WALKTHROUGH_RECORDING_EVIDENCE.md",
  "scripts/alpha-demo-script-audit.js",
  "scripts/alpha-walkthrough-evidence-audit.js",
  "scripts/alpha-walkthrough-capture.sh",
  "scripts/alpha-walkthrough-recording-evidence-audit.js",
  "scripts/alpha-walkthrough-recording-evidence-audit-self-test.js",
  "scripts/beta-foundation-launcher.js",
  "scripts/beta-foundation-launcher-self-test.js",
  "scripts/lib/beta-foundation-bootstrap.js",
  "scripts/beta-foundation-verify.js",
];
const recordingPolicySnapshot = recordingPolicySnapshotFiles.map((file) => ({
  file,
  sha256: sha256File(path.join(rootDir, file)),
}));
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-alpha-recording-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts complete human-reviewed Alpha walkthrough recording evidence",
    writeEvidence("valid.txt", withProgressText(createEvidence())),
  );

  expectFail(
    "rejects missing human-reviewed recording artifact",
    writeEvidence(
      "missing-recording.txt",
      withProgressText(
        createEvidence({
          recording: {
            humanReviewed: false,
            recordingArtifactAvailable: false,
            artifactPath: "outputs/not-alpha/recording.mp4",
          },
        }),
      ),
    ),
    [
      "recording.humanReviewed must be true",
      "recording.recordingArtifactAvailable must be true",
      "recording.artifactPath must stay under outputs/alpha-walkthrough/",
    ],
  );

  expectFail(
    "rejects capture bundle being treated as the recording artifact",
    writeEvidence(
      "capture-only.txt",
      withProgressText(
        createEvidence({
          recording: {
            supportingCaptureOnly: false,
            supportingCaptureBundle:
              "../outputs/alpha-walkthrough/20260529T182908Z/",
          },
        }),
      ),
    ),
    [
      "recording.supportingCaptureOnly must be true",
      "recording.supportingCaptureBundle must stay under outputs/alpha-walkthrough/",
    ],
  );

  expectFail(
    "rejects missing scene coverage",
    writeEvidence(
      "missing-scenes.txt",
      withProgressText(
        createEvidence({
          scenes: createScenes().slice(0, 6),
        }),
      ),
    ),
    ["scenes must include the seven frozen walkthrough scenes"],
  );

  expectFail(
    "rejects incomplete verification commands",
    writeEvidence(
      "missing-commands.txt",
      withProgressText(
        createEvidence({
          verification: {
            commands: ["npm run alpha:walkthrough:capture"],
            allCommandsPassed: false,
            noRealProviderCredentials: false,
          },
        }),
      ),
    ),
    [
      "verification.commands must include npm run alpha:demo-script:audit",
      "verification.commands must include npm run beta:local:start",
      "verification.allCommandsPassed must be true",
      "verification.noRealProviderCredentials must be true",
    ],
  );

  expectFail(
    "rejects external beta overclaiming",
    writeEvidence(
      "overclaim.txt",
      withProgressText(
        createEvidence({
          visualReview: {
            noExternalBetaReadyClaim: false,
            remainingBlockersNamed: false,
          },
        }),
      ),
    ),
    [
      "visualReview.noExternalBetaReadyClaim must be true",
      "visualReview.remainingBlockersNamed must be true",
    ],
  );

  expectFail(
    "rejects provider secret leakage",
    writeEvidence(
      "secret-markers.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_SECRET_KEY=sk_test_12345678\nAuthorization: Bearer fixture-token\n`,
    ),
    ["Stripe secret key", "Authorization bearer token"],
  );

  expectFail(
    "rejects real identity and QR payload leakage",
    writeEvidence(
      "identity-qr.txt",
      `${withProgressText(createEvidence())}\nreviewer@example.com\n0x1111111111111111111111111111111111111111\n{"qrPayload":"fixtureSignedPayload1234567890"}\n`,
    ),
    ["raw email address", "raw wallet address", "raw signed payload"],
  );

  expectFail(
    "rejects production credential use and weak redaction",
    writeEvidence(
      "production-creds.txt",
      withProgressText(
        createEvidence({
          productionCredentialsUsed: true,
          realUserDataUsed: true,
          redaction: {
            deploymentCredentialsRedacted: false,
            personalDataRedacted: false,
            noProductionCredentialsInRecording: false,
          },
        }),
      ),
    ),
    [
      "realUserDataUsed must be false",
      "productionCredentialsUsed must be false",
      "redaction.deploymentCredentialsRedacted must be true",
      "redaction.personalDataRedacted must be true",
      "redaction.noProductionCredentialsInRecording must be true",
    ],
  );

  expectFail(
    "rejects stale Alpha walkthrough recording policy snapshot",
    writeEvidence(
      "stale-policy-snapshot.txt",
      withProgressText(
        createEvidence({
          recordingPolicySnapshot: {
            source: "old-alpha-recording-policy",
            files: [
              {
                file: "docs/ALPHA_DEMO_SCRIPT.md",
                sha256:
                  "2222222222222222222222222222222222222222222222222222222222222222",
              },
              {
                file: "unexpected-recording-policy.txt",
                sha256:
                  "3333333333333333333333333333333333333333333333333333333333333333",
              },
            ],
          },
        }),
      ),
    ),
    [
      "recordingPolicySnapshot.source must be alpha-walkthrough-recording-review-policy",
      "recordingPolicySnapshot.files must include the current Alpha walkthrough recording policy files",
      "recordingPolicySnapshot.files contains unexpected file unexpected-recording-policy.txt",
      "recordingPolicySnapshot.files docs/ALPHA_DEMO_SCRIPT.md sha256 must match the current Alpha walkthrough recording policy",
      "recordingPolicySnapshot.files missing docs/ALPHA_WALKTHROUGH_EVIDENCE.md",
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
      provider: "alpha-walkthrough-recording-review",
      localOnly: true,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      recording: {
        humanReviewed: true,
        recordingArtifactAvailable: true,
        artifactPath:
          "outputs/alpha-walkthrough/20260530T000000Z/alpha-walkthrough.mp4",
        fileName: "alpha-walkthrough.mp4",
        reviewedByRole: "project-owner",
        demoScriptPath: "docs/ALPHA_DEMO_SCRIPT.md",
        usedFrozenScript: true,
        supportingCaptureBundle: "outputs/alpha-walkthrough/20260529T182908Z/",
        supportingCaptureOnly: true,
      },
      scenes: createScenes(),
      verification: {
        commands: [
          "npm run alpha:demo-script:audit",
          "npm run alpha:walkthrough:evidence:audit",
          "npm run alpha:walkthrough:capture",
          "npm run beta:local:start",
          "npm run beta:local:verify",
          "npm run beta:local:stop",
          "npm run security:evidence-redaction",
        ],
        allCommandsPassed: true,
        noRealProviderCredentials: true,
      },
      visualReview: {
        fanpassHasNoStaffControls: true,
        fanpassOpsOwnsScannerFlow: true,
        consoleOwnsOrganizerAdminControls: true,
        localOnlyScopeDisclosed: true,
        noExternalBetaReadyClaim: true,
        remainingBlockersNamed: true,
      },
      redaction: {
        providerSecretsRedacted: true,
        stripeSecretsRedacted: true,
        stripePublishableKeysRedacted: true,
        privySecretsRedacted: true,
        bearerTokensRedacted: true,
        privateKeysRedacted: true,
        deploymentCredentialsRedacted: true,
        personalDataRedacted: true,
        walletAddressesRedacted: true,
        qrPayloadsRedacted: true,
        noProductionCredentialsInRecording: true,
      },
      recordingPolicySnapshot: {
        source: "alpha-walkthrough-recording-review-policy",
        files: recordingPolicySnapshot,
      },
    },
    overrides,
  );
}

function createScenes() {
  return [
    "Scene 1 - Product Boundary",
    "Scene 2 - Fan Discovery And Wallet",
    "Scene 3 - Marketplace And Settlement",
    "Scene 4 - Fan Access",
    "Scene 5 - Console Operations",
    "Scene 6 - FanPass Ops Entry",
    "Scene 7 - Security Boundary Close",
  ].map((name) => ({
    name,
    humanReviewed: true,
    localOnly: true,
  }));
}

function withProgressText(evidence) {
  return [
    "Checking FanPass Alpha walkthrough recording evidence...",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
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
      `${label}: expected pass but failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
}

function expectFail(label, filePath, expectedMessages) {
  const result = runAudit(filePath);
  cases.push({ label, expected: "fail", status: result.status });
  if (result.status === 0) {
    errors.push(`${label}: expected failure but passed`);
    return;
  }
  const output = `${result.stdout}\n${result.stderr}`;
  for (const expectedMessage of expectedMessages) {
    if (!output.includes(expectedMessage)) {
      errors.push(`${label}: missing expected error: ${expectedMessage}`);
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
  const output = Array.isArray(target) ? [...target] : { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      output[key] = deepMerge(target[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}
