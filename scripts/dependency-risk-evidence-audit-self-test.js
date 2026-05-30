const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/dependency-risk-evidence-audit.js",
);
const dependencySnapshotFiles = [
  "package.json",
  "package-lock.json",
  "apps/api/package.json",
  "apps/dashboard/package.json",
  "packages/contracts/package.json",
  "packages/shared/package.json",
];
const riskPolicySnapshotFiles = [
  "scripts/dependency-advisory-check.js",
  "scripts/dependency-advisory-check-self-test.js",
  "scripts/dependency-risk-evidence-audit.js",
  "scripts/dependency-risk-evidence-audit-self-test.js",
  "scripts/dependency-tooling-audit.js",
  "docs/DEPENDENCY_ADVISORY_LOG.md",
  "docs/DEPENDENCY_RISK_EVIDENCE.md",
  "docs/PROVIDER_COST_FEASIBILITY.md",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-dependency-risk-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts clean production audit closeout evidence",
    writeEvidence(
      "clean.txt",
      withProgressText(createEvidence({ clean: true })),
    ),
  );

  expectPass(
    "accepts documented moderate-only closed-beta risk acceptance",
    writeEvidence("accepted.txt", withProgressText(createEvidence())),
  );

  expectFail(
    "rejects high or critical production advisories",
    writeEvidence(
      "high-critical.txt",
      withProgressText(
        createEvidence({
          productionAudit: {
            high: 1,
            critical: 1,
            total: 4,
            highestSeverity: "critical",
          },
        }),
      ),
    ),
    ["production audit must have no high/critical advisories"],
  );

  expectFail(
    "rejects stale dependency snapshot proof",
    writeEvidence(
      "stale-dependency-snapshot.txt",
      withProgressText(
        createEvidence({
          dependencySnapshot: {
            source: "old-package-list",
            files: [
              {
                file: "package-lock.json",
                sha256:
                  "2222222222222222222222222222222222222222222222222222222222222222",
              },
              {
                file: "unexpected/package.json",
                sha256:
                  "3333333333333333333333333333333333333333333333333333333333333333",
              },
            ],
          },
        }),
      ),
    ),
    [
      "dependencySnapshot.source must be workspace-package-manifests",
      "dependencySnapshot.files must include the current workspace package manifests and lockfile",
      "dependencySnapshot.files contains unexpected file unexpected/package.json",
      "dependencySnapshot.files package-lock.json sha256 must match the current workspace dependency snapshot",
      "dependencySnapshot.files missing package.json",
    ],
  );

  expectFail(
    "rejects stale dependency risk policy snapshot proof",
    writeEvidence(
      "stale-risk-policy-snapshot.txt",
      withProgressText(
        createEvidence({
          riskPolicySnapshot: {
            source: "old-dependency-policy",
            files: [
              {
                file: "scripts/dependency-advisory-check.js",
                sha256:
                  "2222222222222222222222222222222222222222222222222222222222222222",
              },
              {
                file: "unexpected-risk-policy.md",
                sha256:
                  "3333333333333333333333333333333333333333333333333333333333333333",
              },
            ],
          },
        }),
      ),
    ),
    [
      "riskPolicySnapshot.source must be dependency-advisory-risk-policy",
      "riskPolicySnapshot.files must include the current dependency advisory risk policy files",
      "riskPolicySnapshot.files contains unexpected file unexpected-risk-policy.md",
      "riskPolicySnapshot.files scripts/dependency-advisory-check.js sha256 must match the current dependency advisory risk policy",
      "riskPolicySnapshot.files missing scripts/dependency-advisory-check-self-test.js",
    ],
  );

  expectFail(
    "rejects undocumented advisory packages",
    writeEvidence(
      "unexpected-package.txt",
      withProgressText(
        createEvidence({
          productionAudit: {
            advisories: [
              ...knownAudit().advisories,
              {
                package: "unexpected-package",
                severity: "moderate",
                isDirect: false,
              },
            ],
            total: 3,
            moderate: 3,
          },
        }),
      ),
    ),
    ["unresolved audit must contain exactly 2 moderate advisories"],
  );

  expectFail(
    "rejects newly available safe Next/PostCSS patch path",
    writeEvidence(
      "safe-patch.txt",
      withProgressText(
        createEvidence({
          fixStatus: {
            safeNextPostcssPatchAvailable: true,
            latestNextVersion: "16.2.7",
            latestNextPostcssDependency: "8.5.10",
          },
        }),
      ),
    ),
    [
      "fixStatus.safeNextPostcssPatchAvailable must be false",
      "latest Next PostCSS dependency appears patched",
    ],
  );

  expectFail(
    "rejects missing owner, expiry, and scope",
    writeEvidence(
      "missing-owner-expiry.txt",
      withProgressText(
        createEvidence({
          riskAcceptance: {
            acceptedByRole: "developer",
            expiresAt: "2026-05-30T00:00:00.000Z",
            scope: "public-beta",
            decisionReference: "",
          },
        }),
      ),
    ),
    [
      "acceptedByRole must be project-owner or security-owner",
      "expiresAt must be after checkedAt",
      "scope must be closed-beta-only",
      "decisionReference must be present",
    ],
  );

  expectFail(
    "rejects long-lived risk acceptance",
    writeEvidence(
      "long-lived.txt",
      withProgressText(
        createEvidence({
          riskAcceptance: {
            reviewCadenceDays: 45,
            expiresAt: "2026-10-01T00:00:00.000Z",
          },
        }),
      ),
    ),
    [
      "reviewCadenceDays must be between 1 and 30",
      "expiresAt must be within 90 days",
    ],
  );

  expectFail(
    "rejects missing mitigations",
    writeEvidence(
      "missing-mitigations.txt",
      withProgressText(
        createEvidence({
          mitigations: {
            consoleCspEnabled: false,
            noUserControlledCssGeneration: false,
            dependencyAdvisoryGateInVerifier: false,
          },
        }),
      ),
    ),
    [
      "mitigations.consoleCspEnabled must be true",
      "mitigations.noUserControlledCssGeneration must be true",
      "mitigations.dependencyAdvisoryGateInVerifier must be true",
    ],
  );

  expectFail(
    "rejects leaked secret markers",
    writeEvidence(
      "secret-marker.txt",
      `${withProgressText(createEvidence())}\nAuthorization: Bearer eyJhbGci\nSTRIPE_SECRET_KEY=sk_test_123\nDATABASE_URL=postgresql://example\n`,
    ),
    [
      "Authorization: Bearer",
      "STRIPE_SECRET_KEY=",
      "sk_test_",
      "DATABASE_URL=",
    ],
  );

  expectFail(
    "rejects leaked Stripe publishable key markers",
    writeEvidence(
      "stripe-publishable-key.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234\n`,
    ),
    ["STRIPE_PUBLISHABLE_KEY=", "pk_test_"],
  );

  expectFail(
    "rejects leaked provider secret and raw database URL markers",
    writeEvidence(
      "provider-secret-database-url.txt",
      `${withProgressText(createEvidence())}\nPROVIDER_SECRET=fixture-provider-secret\npostgresql://fixture:secret@db/fanpass\n`,
    ),
    ["PROVIDER_SECRET=", "database URLs"],
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
    "rejects CI secret masking command literals",
    writeEvidence(
      "ci-secret-mask-commands.txt",
      [
        withProgressText(createEvidence()),
        "::add-mask::fixture-github-mask-secret",
        "::set-secret name=FANPASS_TOKEN::fixture-github-set-secret",
        "##vso[task.setvariable variable=FANPASS_TOKEN;issecret=true]fixture-azure-pipelines-secret",
      ].join("\n"),
    ),
    ["CI secret masking command literal"],
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
            ciSecretMaskingCommandsRedacted: false,
          },
        }),
      ),
    ),
    [
      "deploymentCredentialsAvailable must be false",
      "redaction.deploymentCredentialsRedacted must be true",
      "redaction.ciSecretMaskingCommandsRedacted must be true",
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
  const productionAudit =
    overrides.clean === true ? cleanAudit() : knownAudit();
  delete overrides.clean;
  const evidence = deepMerge(
    {
      ok: true,
      checkedAt: "2026-05-30T00:00:00.000Z",
      provider: "dependency-risk",
      evidenceSource: "node22-production-audit",
      localDryRun: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      deploymentCredentialsAvailable: false,
      dependencySnapshot: createDependencySnapshot(),
      riskPolicySnapshot: createRiskPolicySnapshot(),
      nodeRuntime: {
        nodeVersion: "22.22.3",
        engineStrict: true,
        withNode22HelperUsed: true,
        commands: {
          productionAudit: "npm run security:audit:prod",
          advisoryGate: "npm run security:dependency-advisories",
        },
      },
      productionAudit,
      fixStatus: {
        npmAuditFixForceRequired: true,
        forcedFixDowngradesNextToUnsupportedMajor: true,
        safeNextPostcssPatchAvailable: false,
        latestNextChecked: true,
        latestNextVersion: "16.2.6",
        latestNextPostcssDependency: "8.4.31",
      },
      mitigations: {
        consoleAuthRequired: true,
        consoleCspEnabled: true,
        noUserControlledCssGeneration: true,
        dependencyAdvisoryGateInVerifier: true,
        node22RuntimeUsed: true,
        externalTestingScopeClosedBetaOnly: true,
        safeUpgradeRecheckBeforeTesterBuild: true,
      },
      riskAcceptance: {
        acceptedByRole: "security-owner",
        acceptedAt: "2026-05-30T00:00:00.000Z",
        expiresAt: "2026-06-29T00:00:00.000Z",
        scope: "closed-beta-only",
        reviewCadenceDays: 14,
        rollbackOrPatchPlanDocumented: true,
        noPublicLaunchUntilCleanOrRenewed: true,
        realUserDataAllowed: false,
        decisionReference: "risk-register:dependency-next-postcss-closed-beta",
      },
      redaction: {
        providerSecretsRedacted: true,
        databaseUrlRedacted: true,
        bearerTokensRedacted: true,
        privyTokensRedacted: true,
        stripeSecretsRedacted: true,
        stripePublishableKeysRedacted: true,
        privateKeysRedacted: true,
        deploymentCredentialsRedacted: true,
        ciSecretMaskingCommandsRedacted: true,
        realPersonalDataExcluded: true,
      },
    },
    overrides,
  );
  if (evidence.productionAudit?.total === 0) {
    delete evidence.riskAcceptance;
  }
  return evidence;
}

function knownAudit() {
  return {
    clean: false,
    total: 2,
    moderate: 2,
    high: 0,
    critical: 0,
    highestSeverity: "moderate",
    advisories: [
      {
        package: "next",
        severity: "moderate",
        isDirect: true,
        range: "9.3.4 - 15.5.18",
      },
      {
        package: "postcss",
        severity: "moderate",
        isDirect: false,
        range: "<8.5.10",
        advisoryId: "GHSA-qx2v-qp2m-jg93",
      },
    ],
  };
}

function cleanAudit() {
  return {
    clean: true,
    total: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    highestSeverity: null,
    advisories: [],
  };
}

function createDependencySnapshot() {
  return {
    source: "workspace-package-manifests",
    files: dependencySnapshotFiles.map((file) => ({
      file,
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(rootDir, file)))
        .digest("hex"),
    })),
  };
}

function createRiskPolicySnapshot() {
  return {
    source: "dependency-advisory-risk-policy",
    files: riskPolicySnapshotFiles.map((file) => ({
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
    "Checking FanPass dependency risk evidence...",
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
