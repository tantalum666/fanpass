const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/staging-runtime-evidence-audit.js",
);
const implementationSnapshotFiles = [
  "apps/api/src/main.ts",
  "apps/api/src/config/security-config.ts",
  "apps/api/.env.staging.example",
  "apps/api/src/common/fanpass-socket-io.adapter.ts",
  "apps/api/src/modules/alpha/alpha.controller.ts",
  "apps/api/src/modules/side-effects/side-effect-health.service.ts",
  "apps/dashboard/next.config.ts",
  "scripts/security-runtime-staging-check.sh",
  "scripts/staging-runtime-evidence-audit.js",
  "scripts/security-runtime-staging-local-dry-run.sh",
  "scripts/security-header-policy-audit.js",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-staging-evidence-"),
);
const cases = [];
const errors = [];

try {
  const deployedEvidencePath = writeEvidence(
    "deployed-valid.txt",
    withProgressText(
      createEvidence({
        apiUrl: "https://api.staging.fanpass.example/health",
        consoleUrl: "https://console.staging.fanpass.example/",
        localDryRun: false,
        allowedOrigin: "https://console.staging.fanpass.example",
      }),
    ),
  );
  expectPass("accepts deployed HTTPS evidence", [deployedEvidencePath]);

  const dryRunEvidencePath = writeEvidence(
    "dry-run-valid.txt",
    withProgressText(
      createEvidence({
        apiUrl: "http://localhost:4200/health",
        consoleUrl: "http://127.0.0.1:3200/",
        localDryRun: true,
        allowedOrigin: "http://localhost:3200",
      }),
    ),
  );
  expectPass("accepts dry-run evidence only with flag", [
    "--allow-dry-run",
    dryRunEvidencePath,
  ]);
  expectFail(
    "rejects dry-run evidence by default",
    [dryRunEvidencePath],
    [
      "local dry-run evidence cannot close deployed staging checks",
      "apiUrl must be HTTPS",
      "consoleUrl must be HTTPS",
    ],
  );

  const leakedTokenPath = writeEvidence(
    "leaked-token.txt",
    `${withProgressText(
      createEvidence({
        apiUrl: "https://api.staging.fanpass.example/health",
        consoleUrl: "https://console.staging.fanpass.example/",
        localDryRun: false,
        allowedOrigin: "https://console.staging.fanpass.example",
      }),
    )}\nAuthorization: Bearer should-not-appear-in-evidence\n`,
  );
  expectFail(
    "rejects bearer token markers",
    [leakedTokenPath],
    ["Authorization: Bearer "],
  );

  const leakedProviderKeyPath = writeEvidence(
    "leaked-provider-key.txt",
    `${withProgressText(
      createEvidence({
        apiUrl: "https://api.staging.fanpass.example/health",
        consoleUrl: "https://console.staging.fanpass.example/",
        localDryRun: false,
        allowedOrigin: "https://console.staging.fanpass.example",
      }),
    )}\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234\nDATABASE_URL=postgresql://fixture:secret@db/fanpass\n`,
  );
  expectFail(
    "rejects provider key and database markers",
    [leakedProviderKeyPath],
    ["Stripe publishable key", "database URL"],
  );

  const leakedDeploymentCredentialPath = writeEvidence(
    "leaked-deployment-credential.txt",
    [
      withProgressText(
        createEvidence({
          apiUrl: "https://api.staging.fanpass.example/health",
          consoleUrl: "https://console.staging.fanpass.example/",
          localDryRun: false,
          allowedOrigin: "https://console.staging.fanpass.example",
        }),
      ),
      "VERCEL_TOKEN=fixture-vercel-deploy-token",
      JSON.stringify({
        AWS_SECRET_ACCESS_KEY: "fixture-aws-secret-key",
        cloudflareApiToken: "fixture-cloudflare-token",
      }),
    ].join("\n"),
  );
  expectFail(
    "rejects deployment and cloud credential markers",
    [leakedDeploymentCredentialPath],
    [
      "deployment or cloud credential assignment",
      "deployment or cloud credential field",
      "deployment or cloud credential environment field",
    ],
  );

  const leakedCiMaskingCommandPath = writeEvidence(
    "leaked-ci-masking-command.txt",
    [
      withProgressText(
        createEvidence({
          apiUrl: "https://api.staging.fanpass.example/health",
          consoleUrl: "https://console.staging.fanpass.example/",
          localDryRun: false,
          allowedOrigin: "https://console.staging.fanpass.example",
        }),
      ),
      "::add-mask::fixture-staging-admin-token",
      "##vso[task.setvariable variable=STAGING_ADMIN_ACCESS_TOKEN;issecret=true]fixture-staging-admin-token",
    ].join("\n"),
  );
  expectFail(
    "rejects CI secret masking command literals",
    [leakedCiMaskingCommandPath],
    ["CI secret masking command literal"],
  );

  const missingDeploymentCredentialProofPath = writeEvidence(
    "missing-deployment-credential-proof.txt",
    withProgressText({
      ...createEvidence({
        apiUrl: "https://api.staging.fanpass.example/health",
        consoleUrl: "https://console.staging.fanpass.example/",
        localDryRun: false,
        allowedOrigin: "https://console.staging.fanpass.example",
      }),
      deploymentCredentialsAvailable: true,
      redaction: {
        deploymentCredentialsRedacted: false,
        ciSecretMaskingCommandsRedacted: true,
      },
    }),
  );
  expectFail(
    "rejects missing deployment credential redaction proof",
    [missingDeploymentCredentialProofPath],
    [
      "deploymentCredentialsAvailable must be false",
      "redaction.deploymentCredentialsRedacted must be true",
    ],
  );

  const missingCiMaskingProofPath = writeEvidence(
    "missing-ci-masking-proof.txt",
    withProgressText({
      ...createEvidence({
        apiUrl: "https://api.staging.fanpass.example/health",
        consoleUrl: "https://console.staging.fanpass.example/",
        localDryRun: false,
        allowedOrigin: "https://console.staging.fanpass.example",
      }),
      redaction: {
        deploymentCredentialsRedacted: true,
      },
    }),
  );
  expectFail(
    "rejects missing CI secret masking command redaction proof",
    [missingCiMaskingProofPath],
    ["redaction.ciSecretMaskingCommandsRedacted must be true"],
  );

  const badOrderbookPath = writeEvidence(
    "bad-orderbook-origin.txt",
    withProgressText(
      createEvidence({
        apiUrl: "https://api.staging.fanpass.example/health",
        consoleUrl: "https://console.staging.fanpass.example/",
        localDryRun: false,
        allowedOrigin: "http://console.staging.fanpass.example",
      }),
    ),
  );
  expectFail(
    "rejects non-HTTPS deployed orderbook origin",
    [badOrderbookPath],
    ["deployed orderbook allowedOrigin must be HTTPS"],
  );

  const missingConsoleCoopPath = writeEvidence(
    "missing-console-coop.txt",
    withProgressText(
      createEvidence({
        apiUrl: "https://api.staging.fanpass.example/health",
        consoleUrl: "https://console.staging.fanpass.example/",
        localDryRun: false,
        allowedOrigin: "https://console.staging.fanpass.example",
        omitConsoleCheck: "cross-origin-opener-policy",
      }),
    ),
  );
  expectFail(
    "rejects missing Console cross-origin opener policy proof",
    [missingConsoleCoopPath],
    ["missing Console check cross-origin-opener-policy"],
  );

  const missingHstsPath = writeEvidence(
    "missing-hsts.txt",
    withProgressText(
      createEvidence({
        apiUrl: "https://api.staging.fanpass.example/health",
        consoleUrl: "https://console.staging.fanpass.example/",
        localDryRun: false,
        allowedOrigin: "https://console.staging.fanpass.example",
        omitApiCheck: "strict-transport-security",
        omitConsoleCheck: "strict-transport-security",
      }),
    ),
  );
  expectFail(
    "rejects missing strict transport security proof",
    [missingHstsPath],
    [
      "missing API check strict-transport-security",
      "missing Console check strict-transport-security",
    ],
  );

  const missingTrustProxyRuntimePath = writeEvidence(
    "missing-trust-proxy-runtime.txt",
    withProgressText({
      ...createEvidence({
        apiUrl: "https://api.staging.fanpass.example/health",
        consoleUrl: "https://console.staging.fanpass.example/",
        localDryRun: false,
        allowedOrigin: "https://console.staging.fanpass.example",
      }),
      apiRuntime: {},
    }),
  );
  expectFail(
    "rejects missing API trust proxy runtime proof",
    [missingTrustProxyRuntimePath],
    ["apiRuntime.trustProxyHops must be an integer from 1 to 3"],
  );

  const missingTrustProxyCheckPath = writeEvidence(
    "missing-trust-proxy-check.txt",
    withProgressText(
      createEvidence({
        apiUrl: "https://api.staging.fanpass.example/health",
        consoleUrl: "https://console.staging.fanpass.example/",
        localDryRun: false,
        allowedOrigin: "https://console.staging.fanpass.example",
        omitApiCheck: "trust proxy hops configured: 1",
      }),
    ),
  );
  expectFail(
    "rejects stale staging runtime implementation snapshot proof",
    [
      writeEvidence(
        "stale-implementation-snapshot.txt",
        withProgressText({
          ...createEvidence({
            apiUrl: "https://api.staging.fanpass.example/health",
            consoleUrl: "https://console.staging.fanpass.example/",
            localDryRun: false,
            allowedOrigin: "https://console.staging.fanpass.example",
          }),
          implementationSnapshot: {
            source: "old-staging-runtime-boundary",
            files: [
              {
                file: "apps/api/src/main.ts",
                sha256:
                  "1111111111111111111111111111111111111111111111111111111111111111",
              },
              {
                file: "unexpected/staging-runtime.js",
                sha256:
                  "2222222222222222222222222222222222222222222222222222222222222222",
              },
            ],
          },
        }),
      ),
    ],
    [
      "implementationSnapshot.source must be staging-runtime-security-boundaries",
      "implementationSnapshot.files must include the current staging runtime security boundary files",
      "implementationSnapshot.files contains unexpected file unexpected/staging-runtime.js",
      "implementationSnapshot.files apps/api/src/main.ts sha256 must match the current staging runtime security implementation",
      "implementationSnapshot.files missing apps/api/src/config/security-config.ts",
    ],
  );

  expectFail(
    "rejects missing API trust proxy checked item",
    [missingTrustProxyCheckPath],
    ["missing API check trust proxy hops configured: 1"],
  );

  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        cases,
      },
      null,
      2,
    ),
  );
} finally {
  fs.rmSync(tempDir, { force: true, recursive: true });
}

function createEvidence({
  apiUrl,
  consoleUrl,
  localDryRun,
  allowedOrigin,
  omitApiCheck = "",
  omitConsoleCheck = "",
}) {
  const apiChecks = [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "cross-origin-opener-policy",
    "strict-transport-security",
    "x-powered-by absent",
    "demo-session non-2xx",
    "admin side-effect health unauthenticated non-2xx",
    "admin side-effect health: admin side-effect outbox health ok",
    "trust proxy hops configured: 1",
    "orderbook websocket allowed origin",
    "orderbook websocket disallowed origin rejected",
  ].filter((check) => check !== omitApiCheck);

  const consoleChecks = [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "cross-origin-opener-policy",
    "strict-transport-security",
    "permissions-policy",
    "content-security-policy",
    "x-powered-by absent",
    "locked-or-sign-in unauthenticated state",
  ].filter((check) => check !== omitConsoleCheck);

  return {
    ok: true,
    checkedAt: "2026-05-29T12:00:00.000Z",
    localDryRun,
    deploymentCredentialsAvailable: false,
    implementationSnapshot: createImplementationSnapshot(),
    apiUrl,
    consoleUrl,
    adminSideEffectHealth: "admin side-effect outbox health ok",
    apiRuntime: {
      trustProxyHops: 1,
    },
    redaction: {
      deploymentCredentialsRedacted: true,
      ciSecretMaskingCommandsRedacted: true,
    },
    checked: {
      api: apiChecks,
      console: consoleChecks,
    },
    orderbook: {
      eventId: "evt_staging_fixture",
      ticketTypeId: "tt_staging_fixture",
      allowedOrigin,
    },
  };
}

function createImplementationSnapshot() {
  return {
    source: "staging-runtime-security-boundaries",
    files: implementationSnapshotFiles.map((file) => ({
      file,
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(rootDir, file)))
        .digest("hex"),
    })),
  };
}

function withProgressText(evidence) {
  return [
    "Checking FanPass staging runtime security evidence...",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}

function writeEvidence(fileName, contents) {
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

function expectPass(label, args) {
  const result = runAudit(args);
  cases.push({ label, expected: "pass", status: result.status });
  if (result.status !== 0) {
    errors.push(
      `${label}: expected pass, got ${result.status}: ${result.stderr || result.stdout}`,
    );
  }
}

function expectFail(label, args, requiredMessages) {
  const result = runAudit(args);
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

function runAudit(args) {
  return spawnSync(process.execPath, [auditScript, ...args], {
    cwd: rootDir,
    encoding: "utf8",
  });
}
