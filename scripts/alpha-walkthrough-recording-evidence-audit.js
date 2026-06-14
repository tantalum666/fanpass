const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
const requiredScenes = [
  "Scene 1 - Product Boundary",
  "Scene 2 - Fan Discovery And Wallet",
  "Scene 3 - Marketplace And Settlement",
  "Scene 4 - Fan Access",
  "Scene 5 - Console Operations",
  "Scene 6 - FanPass Ops Entry",
  "Scene 7 - Security Boundary Close",
];
const requiredCommands = [
  "npm run alpha:demo-script:audit",
  "npm run alpha:walkthrough:evidence:audit",
  "npm run beta:foundation:verify",
  "npm run beta:local:start",
  "npm run beta:local:verify",
  "npm run beta:local:stop",
  "npm run security:evidence-redaction",
];
const recordingPolicySnapshotFiles = [
  "docs/ALPHA_DEMO_SCRIPT.md",
  "docs/ALPHA_WALKTHROUGH_EVIDENCE.md",
  "docs/ALPHA_WALKTHROUGH_RECORDING_EVIDENCE.md",
  "scripts/alpha-demo-script-audit.js",
  "scripts/alpha-walkthrough-evidence-audit.js",
  "scripts/alpha-walkthrough-capture.sh",
  "scripts/alpha-walkthrough-recording-evidence-audit.js",
  "scripts/alpha-walkthrough-recording-evidence-audit-self-test.js",
  "scripts/beta-foundation-verify.sh",
];
const expectedRecordingPolicySnapshot = recordingPolicySnapshotFiles.map(
  (file) => ({
    file,
    sha256: sha256File(path.join(rootDir, file)),
  }),
);

if (evidenceFiles.length === 0) {
  console.error(
    [
      "Usage: npm run alpha:walkthrough:recording:evidence -- <evidence-file...>",
      "Validate optional saved human-reviewed Alpha walkthrough recording evidence before claiming review.",
    ].join("\n"),
  );
  process.exit(1);
}

const results = evidenceFiles.map(validateEvidenceFile);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      recordingPolicySnapshot: {
        source: "alpha-walkthrough-recording-review-policy",
        files: expectedRecordingPolicySnapshot,
      },
      checkedFiles: results.length,
      evidence: results,
    },
    null,
    2,
  ),
);

function validateEvidenceFile(filePath) {
  const absolutePath = path.resolve(rootDir, filePath);
  const relativePath = path.relative(rootDir, absolutePath);
  let raw;
  try {
    raw = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    errors.push(
      `${relativePath}: could not read recording evidence file: ${error.message}`,
    );
    return { file: relativePath, ok: false };
  }

  validateNoSecretMarkers(relativePath, raw);
  const evidence = extractJsonObject(relativePath, raw);
  if (!evidence) {
    return { file: relativePath, ok: false };
  }

  validateTopLevel(relativePath, evidence);
  validateRecording(relativePath, evidence.recording);
  validateScenes(relativePath, evidence.scenes);
  validateVerification(relativePath, evidence.verification);
  validateVisualReview(relativePath, evidence.visualReview);
  validateRedaction(relativePath, evidence.redaction);
  validateRecordingPolicySnapshot(
    relativePath,
    evidence.recordingPolicySnapshot,
  );

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    artifactPath: evidence.recording?.artifactPath ?? null,
    sceneCount: Array.isArray(evidence.scenes) ? evidence.scenes.length : null,
    humanReviewed: evidence.recording?.humanReviewed ?? null,
  };
}

function validateTopLevel(relativePath, evidence) {
  if (evidence.ok !== true) {
    errors.push(`${relativePath}: evidence ok must be true`);
  }
  if (!isIsoDate(evidence.checkedAt)) {
    errors.push(`${relativePath}: evidence checkedAt must be an ISO timestamp`);
  }
  if (evidence.provider !== "alpha-walkthrough-recording-review") {
    errors.push(
      `${relativePath}: provider must be alpha-walkthrough-recording-review`,
    );
  }
  if (evidence.localOnly !== true) {
    errors.push(`${relativePath}: localOnly must be true`);
  }
  if (evidence.realUserDataUsed !== false) {
    errors.push(`${relativePath}: realUserDataUsed must be false`);
  }
  if (evidence.productionCredentialsUsed !== false) {
    errors.push(`${relativePath}: productionCredentialsUsed must be false`);
  }
}

function validateRecording(relativePath, recording = {}) {
  if (recording.humanReviewed !== true) {
    errors.push(`${relativePath}: recording.humanReviewed must be true`);
  }
  if (recording.recordingArtifactAvailable !== true) {
    errors.push(
      `${relativePath}: recording.recordingArtifactAvailable must be true`,
    );
  }
  if (!isAlphaWalkthroughPath(recording.artifactPath)) {
    errors.push(
      `${relativePath}: recording.artifactPath must stay under outputs/alpha-walkthrough/`,
    );
  }
  if (!/\.(mp4|mov|webm)$/i.test(recording.fileName ?? "")) {
    errors.push(
      `${relativePath}: recording.fileName must end in .mp4, .mov, or .webm`,
    );
  }
  if (recording.reviewedByRole !== "project-owner") {
    errors.push(
      `${relativePath}: recording.reviewedByRole must be project-owner`,
    );
  }
  if (recording.demoScriptPath !== "docs/ALPHA_DEMO_SCRIPT.md") {
    errors.push(
      `${relativePath}: recording.demoScriptPath must be docs/ALPHA_DEMO_SCRIPT.md`,
    );
  }
  if (recording.usedFrozenScript !== true) {
    errors.push(`${relativePath}: recording.usedFrozenScript must be true`);
  }
  if (!isAlphaWalkthroughPath(recording.supportingCaptureBundle)) {
    errors.push(
      `${relativePath}: recording.supportingCaptureBundle must stay under outputs/alpha-walkthrough/`,
    );
  }
  if (recording.supportingCaptureOnly !== true) {
    errors.push(
      `${relativePath}: recording.supportingCaptureOnly must be true to avoid treating capture bundles as recording artifacts`,
    );
  }
}

function validateScenes(relativePath, scenes = []) {
  if (!Array.isArray(scenes) || scenes.length !== requiredScenes.length) {
    errors.push(
      `${relativePath}: scenes must include the seven frozen walkthrough scenes`,
    );
    return;
  }
  requiredScenes.forEach((sceneName, index) => {
    const scene = scenes[index] ?? {};
    if (scene.name !== sceneName) {
      errors.push(
        `${relativePath}: scenes[${index}].name must be ${sceneName}`,
      );
    }
    if (scene.humanReviewed !== true) {
      errors.push(
        `${relativePath}: scenes[${index}].humanReviewed must be true`,
      );
    }
    if (scene.localOnly === false) {
      errors.push(`${relativePath}: scenes[${index}] must stay local-only`);
    }
  });
}

function validateVerification(relativePath, verification = {}) {
  const commands = Array.isArray(verification.commands)
    ? verification.commands
    : [];
  for (const command of requiredCommands) {
    if (!commands.includes(command)) {
      errors.push(
        `${relativePath}: verification.commands must include ${command}`,
      );
    }
  }
  if (verification.allCommandsPassed !== true) {
    errors.push(`${relativePath}: verification.allCommandsPassed must be true`);
  }
  if (verification.noRealProviderCredentials !== true) {
    errors.push(
      `${relativePath}: verification.noRealProviderCredentials must be true`,
    );
  }
}

function validateVisualReview(relativePath, visualReview = {}) {
  const requiredBooleanChecks = [
    "fanpassHasNoStaffControls",
    "fanpassOpsOwnsScannerFlow",
    "consoleOwnsOrganizerAdminControls",
    "localOnlyScopeDisclosed",
    "noExternalBetaReadyClaim",
    "remainingBlockersNamed",
  ];
  for (const check of requiredBooleanChecks) {
    if (visualReview[check] !== true) {
      errors.push(`${relativePath}: visualReview.${check} must be true`);
    }
  }
}

function validateRedaction(relativePath, redaction = {}) {
  const requiredRedactionChecks = [
    "providerSecretsRedacted",
    "stripeSecretsRedacted",
    "stripePublishableKeysRedacted",
    "privySecretsRedacted",
    "bearerTokensRedacted",
    "privateKeysRedacted",
    "deploymentCredentialsRedacted",
    "personalDataRedacted",
    "walletAddressesRedacted",
    "qrPayloadsRedacted",
    "noProductionCredentialsInRecording",
  ];
  for (const check of requiredRedactionChecks) {
    if (redaction[check] !== true) {
      errors.push(`${relativePath}: redaction.${check} must be true`);
    }
  }
}

function validateRecordingPolicySnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "alpha-walkthrough-recording-review-policy") {
    errors.push(
      `${relativePath}: recordingPolicySnapshot.source must be alpha-walkthrough-recording-review-policy`,
    );
  }
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  if (files.length !== expectedRecordingPolicySnapshot.length) {
    errors.push(
      `${relativePath}: recordingPolicySnapshot.files must include the current Alpha walkthrough recording policy files`,
    );
  }
  const expectedFiles = new Set(
    expectedRecordingPolicySnapshot.map((entry) => entry.file),
  );
  for (const entry of files) {
    if (!expectedFiles.has(entry?.file)) {
      errors.push(
        `${relativePath}: recordingPolicySnapshot.files contains unexpected file ${entry?.file}`,
      );
    }
  }
  for (const expected of expectedRecordingPolicySnapshot) {
    const actual = files.find((entry) => entry?.file === expected.file);
    if (!actual) {
      errors.push(
        `${relativePath}: recordingPolicySnapshot.files missing ${expected.file}`,
      );
      continue;
    }
    if (actual.sha256 !== expected.sha256) {
      errors.push(
        `${relativePath}: recordingPolicySnapshot.files ${expected.file} sha256 must match the current Alpha walkthrough recording policy`,
      );
    }
  }
}

function validateNoSecretMarkers(relativePath, raw) {
  const forbiddenPatterns = [
    {
      label: "Authorization bearer token",
      pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]+/i,
    },
    {
      label: "JWT",
      pattern: /\beyJhbGci[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+){2}\b/,
    },
    {
      label: "private key",
      pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    },
    {
      label: "Stripe secret key",
      pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/,
    },
    {
      label: "Stripe publishable key",
      pattern: /\bpk_(?:live|test)_[A-Za-z0-9]{8,}/,
    },
    {
      label: "Stripe webhook secret",
      pattern: /\bwhsec_[A-Za-z0-9]{8,}/,
    },
    {
      label: "Privy secret marker",
      pattern: /\bPRIVY_(?:APP_SECRET|VERIFICATION_KEY|ACCESS_TOKEN)\b/i,
    },
    {
      label: "deployment or cloud credential assignment",
      pattern:
        /\b(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)\s*=\s*(?!<)[^\s"']{8,}/i,
    },
    {
      label: "database URL",
      pattern: /\bDATABASE_URL\s*=\s*(?:postgres|postgresql):\/\//i,
    },
    {
      label: "raw email address",
      pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    },
    {
      label: "raw wallet address",
      pattern: /\b0x[a-fA-F0-9]{40}\b/,
    },
    {
      label: "raw QR nonce",
      pattern: /"(?:nonce|qrNonce)"\s*:\s*"(?!<)[A-Za-z0-9._~+/=-]{8,}"/i,
    },
    {
      label: "raw signed payload",
      pattern:
        /"(?:signedPayload|qrPayload|signature)"\s*:\s*"(?!<)[A-Za-z0-9._~+/=-]{16,}"/i,
    },
  ];
  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(raw)) {
      errors.push(
        `${relativePath}: recording evidence must not include secret marker ${rule.label}`,
      );
    }
  }
}

function extractJsonObject(relativePath, raw) {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    errors.push(`${relativePath}: evidence does not contain a JSON object`);
    return null;
  }
  const candidate = raw.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    errors.push(
      `${relativePath}: could not parse evidence JSON: ${error.message}`,
    );
    return null;
  }
}

function isAlphaWalkthroughPath(value) {
  if (typeof value !== "string") {
    return false;
  }
  if (!value.startsWith("outputs/alpha-walkthrough/")) {
    return false;
  }
  return !value.split(/[\\/]/).includes("..");
}

function isIsoDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  );
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}
