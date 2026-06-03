const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/privy-console-react-sdk-isolation-audit.js",
);
const implementationSnapshotFiles = [
  "apps/console-auth/app/page.tsx",
  "apps/console-auth/app/privy-console-login.tsx",
  "apps/console-auth/next.config.ts",
  "apps/console-auth/package.json",
  "apps/console-auth/package-lock.json",
  "apps/dashboard/app/api/console/privy-session/route.ts",
  "apps/dashboard/app/console-login-form.tsx",
  "apps/dashboard/lib/api.ts",
  "apps/dashboard/package.json",
  "package.json",
  "package-lock.json",
  "scripts/console-route-contract-audit.js",
  "scripts/provider-boundary-audit.js",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-privy-console-sdk-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts isolated Privy React SDK workspace evidence",
    writeEvidence("valid-isolated.txt", withProgressText(createEvidence())),
  );

  expectPass(
    "accepts direct Console dependency only when production audit stays clean",
    writeEvidence(
      "valid-direct.txt",
      withProgressText(
        createEvidence({
          integration: {
            mode: "direct-console-dependency-clean-audit",
            fanPassConsoleProductionDependency: true,
            isolatedRuntimeBoundary: false,
          },
          dependencyAudit: {
            integrationMode: "direct-console-dependency-clean-audit",
          },
        }),
      ),
    ),
  );

  expectFail(
    "rejects leaked Privy secret markers",
    writeEvidence(
      "secret-marker.txt",
      `${withProgressText(createEvidence())}\nPRIVY_VERIFICATION_KEY=do-not-commit\n`,
    ),
    ["PRIVY_VERIFICATION_KEY"],
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
      "deployment-cloud-credential-marker.txt",
      [
        withProgressText(createEvidence()),
        "VERCEL_TOKEN=fixture-vercel-token",
        JSON.stringify({
          AWS_SECRET_ACCESS_KEY: "fixture-aws-secret",
          cloudflareApiToken: "fixture-cloudflare-token",
        }),
      ].join("\n"),
    ),
    [
      "deployment or cloud credential assignments",
      "deployment or cloud credential JSON fields",
      "deployment or cloud credential environment fields",
    ],
  );

  expectFail(
    "rejects missing deployment credential availability and redaction proof",
    writeEvidence(
      "missing-deployment-credential-redaction.txt",
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
    "rejects isolated mode without runtime isolation",
    writeEvidence(
      "missing-runtime-boundary.txt",
      withProgressText(
        createEvidence({ integration: { isolatedRuntimeBoundary: false } }),
      ),
    ),
    ["isolated runtime boundary"],
  );

  expectFail(
    "rejects direct dependency when audit findings increase",
    writeEvidence(
      "direct-audit-drift.txt",
      withProgressText(
        createEvidence({
          integration: {
            mode: "direct-console-dependency-clean-audit",
            fanPassConsoleProductionDependency: true,
            isolatedRuntimeBoundary: false,
          },
          dependencyAudit: {
            integrationMode: "direct-console-dependency-clean-audit",
            productionAuditAfter: {
              total: 6,
              moderate: 6,
              high: 0,
              critical: 0,
              knownNextPostcssOnly: true,
              newAdvisoryPackages: [],
            },
          },
        }),
      ),
    ),
    ["must not increase production audit findings"],
  );

  expectFail(
    "rejects new advisory packages",
    writeEvidence(
      "new-advisory-package.txt",
      withProgressText(
        createEvidence({
          dependencyAudit: {
            productionAuditAfter: {
              newAdvisoryPackages: ["walletconnect"],
            },
          },
        }),
      ),
    ),
    ["must not introduce new advisory packages"],
  );

  expectFail(
    "rejects missing HttpOnly session bridge",
    writeEvidence(
      "missing-session-bridge.txt",
      withProgressText(
        createEvidence({
          integration: { serverRouteStoresHttpOnlyCookie: false },
        }),
      ),
    ),
    ["existing HttpOnly session bridge"],
  );

  expectFail(
    "rejects stale Console SDK isolation implementation snapshot proof",
    writeEvidence(
      "stale-implementation-snapshot.txt",
      withProgressText(
        createEvidence({
          implementationSnapshot: {
            source: "stale-console-sdk-isolation",
            files: [
              {
                file: "apps/dashboard/app/api/console/privy-session/route.ts",
                sha256: "0".repeat(64),
              },
              {
                file: "unexpected/console-auth.tsx",
                sha256: "1".repeat(64),
              },
            ],
          },
        }),
      ),
    ),
    [
      "implementationSnapshot.source must be privy-console-sdk-isolation-boundaries",
      "implementationSnapshot.files must include the current Console SDK isolation boundary files",
      "implementationSnapshot.files contains unexpected file unexpected/console-auth.tsx",
      "implementationSnapshot.files apps/dashboard/app/api/console/privy-session/route.ts sha256 must match the current Console SDK isolation implementation",
      "implementationSnapshot.files missing apps/dashboard/app/console-login-form.tsx",
    ],
  );

  expectFail(
    "rejects incomplete dependency commands",
    writeEvidence(
      "missing-commands.txt",
      withProgressText(
        createEvidence({ dependencyAudit: { commands: ["npm audit"] } }),
      ),
    ),
    ["dependencyAudit.commands must include npm run security:audit:prod"],
  );

  expectFail(
    "rejects integration mode mismatch",
    writeEvidence(
      "mode-mismatch.txt",
      withProgressText(
        createEvidence({
          dependencyAudit: {
            integrationMode: "direct-console-dependency-clean-audit",
          },
        }),
      ),
    ),
    ["dependencyAudit.integrationMode must match integration.mode"],
  );

  expectFail(
    "rejects missing redaction proof",
    writeEvidence(
      "missing-redaction.txt",
      withProgressText(
        createEvidence({ redaction: { accessTokensRedacted: false } }),
      ),
    ),
    ["redaction.accessTokensRedacted must be true"],
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
      provider: "privy-console-react-sdk-isolation",
      evidenceSource: "node22-dependency-isolation-review",
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      deploymentCredentialsAvailable: false,
      implementationSnapshot: createImplementationSnapshot(),
      sdk: {
        package: "@privy-io/react-auth",
        version: "3.28.0",
        metadataCommand:
          "npm view @privy-io/react-auth@latest version dependencies peerDependencies --json",
      },
      integration: {
        mode: "isolated-auth-workspace",
        fanPassConsoleProductionDependency: false,
        isolatedRuntimeBoundary: true,
        sdkImportsLimitedTo: ["apps/console-auth/app/privy-console-login.tsx"],
        sessionBridgeRoute: "/api/console/privy-session",
        serverRouteStoresHttpOnlyCookie: true,
        accessTokensStoredInBrowserStorage: false,
        serverSideApiReadsUseCookieOrConfiguredToken: true,
      },
      dependencyAudit: {
        integrationMode: "isolated-auth-workspace",
        nodeVersion: "22.22.3",
        engineStrict: true,
        withNode22HelperUsed: true,
        safeNextPostcssPathChecked: true,
        commands: [
          "npm run security:audit:prod",
          "npm run security:dependency-advisories",
        ],
        productionAuditBefore: {
          total: 2,
          moderate: 2,
          high: 0,
          critical: 0,
          knownNextPostcssOnly: true,
        },
        productionAuditAfter: {
          total: 2,
          moderate: 2,
          high: 0,
          critical: 0,
          knownNextPostcssOnly: true,
          newAdvisoryPackages: [],
        },
      },
      boundaries: {
        consoleRouteAuditPassed: true,
        providerBoundaryAuditPassed: true,
        dependencyAdvisoryGatePassed: true,
        noProviderSecretsInEnvOrBundle: true,
        noRawPrivyTokenLogging: true,
        noRawUpstreamSessionForwarding: true,
      },
      redaction: {
        accessTokensRedacted: true,
        appSecretRedacted: true,
        verificationKeyRedacted: true,
        providerSecretsRedacted: true,
        stripePublishableKeysRedacted: true,
        databaseUrlsRedacted: true,
        deploymentCredentialsRedacted: true,
        userIdentifiersRedacted: true,
        dependencyLogsReviewed: true,
      },
    },
    overrides,
  );
}

function withProgressText(evidence) {
  return [
    "Checking FanPass Console Privy React SDK isolation evidence...",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}

function createImplementationSnapshot() {
  return {
    source: "privy-console-sdk-isolation-boundaries",
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
