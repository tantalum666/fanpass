const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/staff-tenant-staging-evidence-audit.js",
);
const implementationSnapshotFiles = [
  "apps/api/src/main.ts",
  "apps/api/src/modules/auth/auth.controller.ts",
  "apps/api/src/modules/auth/auth.service.ts",
  "apps/api/src/modules/alpha/alpha.controller.ts",
  "apps/api/src/modules/alpha/alpha-persistence.service.ts",
  "apps/api/src/modules/verification/verification.service.ts",
  "apps/dashboard/server/console-bff.ts",
  "apps/dashboard/lib/gate-assignment-response.ts",
  "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
  "scripts/staff-invite-policy-audit.js",
  "scripts/console-route-contract-audit.js",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-staff-tenant-staging-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts complete staging tenant and staff-policy evidence",
    writeEvidence("valid.txt", withProgressText(createEvidence())),
  );

  expectFail(
    "rejects local dry-run and demo auth evidence",
    writeEvidence(
      "local-demo.txt",
      withProgressText(
        createEvidence({
          localDryRun: true,
          demoAuthUsed: true,
          runtime: {
            apiBaseUrl: "http://localhost:4000",
            consoleBaseUrl: "http://localhost:3000",
            productionLikeConfig: false,
            seededDemoUsersDisabled: false,
          },
        }),
      ),
    ),
    [
      "localDryRun must be false",
      "demoAuthUsed must be false",
      "runtime.apiBaseUrl must be HTTPS",
      "runtime.productionLikeConfig must be true",
      "runtime.seededDemoUsersDisabled must be true",
    ],
  );

  expectFail(
    "rejects bearer token and raw identity evidence",
    writeEvidence(
      "sensitive-markers.txt",
      `${withProgressText(createEvidence())}\nAuthorization: Bearer eyJhbGci\n"email": "staff@example.com"\n`,
    ),
    [
      "Authorization: Bearer",
      "evidence must not include raw identity or token JSON fields",
      "raw email addresses",
    ],
  );

  expectFail(
    "rejects provider key and database URL leakage",
    writeEvidence(
      "provider-markers.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234\nDATABASE_URL=postgresql://fixture:secret@db/fanpass\n`,
    ),
    ["STRIPE_PUBLISHABLE_KEY=", "pk_test_", "DATABASE_URL=", "database URLs"],
  );

  expectFail(
    "rejects leaked deployment and cloud credential markers",
    writeEvidence(
      "deployment-cloud-credentials.txt",
      [
        withProgressText(createEvidence()),
        "VERCEL_TOKEN=fixture-vercel-deploy-token",
        "AWS_SECRET_ACCESS_KEY=fixture-aws-secret-key",
        JSON.stringify({
          CLOUDFLARE_API_TOKEN: "fixture-cloudflare-token",
          githubToken: "fixture-github-token",
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
    "rejects CI secret masking command literals",
    writeEvidence(
      "ci-secret-masking-commands.txt",
      [
        withProgressText(createEvidence()),
        "::add-mask::fixture-ci-secret-value",
        "::set-secret name=LEGACY_SECRET::fixture-legacy-secret",
        "##vso[task.setvariable variable=API_TOKEN;issecret=true]fixture-azure-secret",
      ].join("\n"),
    ),
    ["CI secret masking commands with literal values"],
  );

  expectFail(
    "rejects missing deployment credential availability and redaction proof",
    writeEvidence(
      "missing-deployment-credential-redaction.txt",
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
    "rejects missing CI secret masking command redaction proof",
    writeEvidence(
      "missing-ci-mask-redaction.txt",
      withProgressText(
        createEvidence({
          redaction: {
            ciSecretMaskingCommandsRedacted: false,
          },
        }),
      ),
    ),
    ["redaction.ciSecretMaskingCommandsRedacted must be true"],
  );

  expectFail(
    "rejects missing tenant isolation proof",
    writeEvidence(
      "missing-tenant-isolation.txt",
      withProgressText(
        createEvidence({
          tenantIsolation: {
            secondOrganizerIsolationVerified: false,
            crossOrganizerConsoleReadRejected: false,
            noSeededDemoTenantUsed: false,
          },
        }),
      ),
    ),
    [
      "tenantIsolation.secondOrganizerIsolationVerified must be true",
      "tenantIsolation.crossOrganizerConsoleReadRejected must be true",
      "tenantIsolation.noSeededDemoTenantUsed must be true",
    ],
  );

  expectFail(
    "rejects missing verified auth proof",
    writeEvidence(
      "missing-auth-proof.txt",
      withProgressText(
        createEvidence({
          authSession: {
            privyLoginUsed: false,
            verifiedPrivyTokensUsed: false,
            demoSessionRejected: false,
            fanRoleRejectedFromConsole: false,
          },
        }),
      ),
    ),
    [
      "authSession.privyLoginUsed must be true",
      "authSession.verifiedPrivyTokensUsed must be true",
      "authSession.demoSessionRejected must be true",
      "authSession.fanRoleRejectedFromConsole must be true",
    ],
  );

  expectFail(
    "rejects stale staff tenant staging implementation snapshot proof",
    writeEvidence(
      "stale-implementation-snapshot.txt",
      withProgressText(
        createEvidence({
          implementationSnapshot: {
            source: "stale-staff-policy-boundaries",
            files: [
              {
                file: "apps/api/src/modules/auth/auth.service.ts",
                sha256: "0".repeat(64),
              },
              {
                file: "unexpected/staff-policy.ts",
                sha256: "1".repeat(64),
              },
            ],
          },
        }),
      ),
    ),
    [
      "implementationSnapshot.source must be staff-tenant-staging-policy-boundaries",
      "implementationSnapshot.files must include the current staff tenant staging policy boundary files",
      "implementationSnapshot.files contains unexpected file unexpected/staff-policy.ts",
      "implementationSnapshot.files apps/api/src/modules/auth/auth.service.ts sha256 must match the current staff tenant staging policy implementation",
      "implementationSnapshot.files missing apps/api/src/main.ts",
    ],
  );

  expectFail(
    "rejects missing staff invite policy proof",
    writeEvidence(
      "missing-staff-policy.txt",
      withProgressText(
        createEvidence({
          staffPolicy: {
            inviteTokenShownOnce: false,
            inviteReplayRejected: false,
            deactivatedAssignmentRevokesAccess: false,
            crossOrganizerInviteRotationRejected: false,
          },
        }),
      ),
    ),
    [
      "staffPolicy.inviteTokenShownOnce must be true",
      "staffPolicy.inviteReplayRejected must be true",
      "staffPolicy.deactivatedAssignmentRevokesAccess must be true",
      "staffPolicy.crossOrganizerInviteRotationRejected must be true",
    ],
  );

  expectFail(
    "rejects missing Ops gate assignment proof",
    writeEvidence(
      "missing-ops-gate.txt",
      withProgressText(
        createEvidence({
          opsGateAccess: {
            assignedGateRedeemAllowed: false,
            unassignedGateRedeemRejected: false,
            clientSuppliedStaffRejected: false,
          },
        }),
      ),
    ),
    [
      "opsGateAccess.assignedGateRedeemAllowed must be true",
      "opsGateAccess.unassignedGateRedeemRejected must be true",
      "opsGateAccess.clientSuppliedStaffRejected must be true",
    ],
  );

  expectFail(
    "rejects real user or production credential evidence",
    writeEvidence(
      "real-user.txt",
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
            inviteTokensRedacted: false,
            emailsRedacted: false,
            staffIdentifiersRedacted: false,
          },
        }),
      ),
    ),
    [
      "redaction.inviteTokensRedacted must be true",
      "redaction.emailsRedacted must be true",
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
      provider: "staff-tenant-staging",
      environment: "staging",
      localDryRun: false,
      demoAuthUsed: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      implementationSnapshot: createImplementationSnapshot(),
      runtime: {
        apiBaseUrl: "https://api.staging.fanpass.example",
        consoleBaseUrl: "https://console.staging.fanpass.example",
        productionLikeConfig: true,
        seededDemoUsersDisabled: true,
        stagingDatabaseIsolated: true,
        adminBearerFromVerifiedAuth: true,
        deploymentCredentialsAvailable: false,
      },
      tenantIsolation: {
        stagingTenantCreated: true,
        organizerScopedEventCreated: true,
        secondOrganizerIsolationVerified: true,
        crossOrganizerConsoleReadRejected: true,
        crossOrganizerStaffAssignmentRejected: true,
        adminCanAuditWithoutPiiLeakage: true,
        noSeededDemoTenantUsed: true,
      },
      authSession: {
        privyLoginUsed: true,
        verifiedPrivyTokensUsed: true,
        demoSessionRejected: true,
        consoleHttpOnlyCookieVerified: true,
        consoleLockedWhenUnauthenticated: true,
        fanRoleRejectedFromConsole: true,
      },
      staffPolicy: {
        inviteCreatedByOrganizerScopedConsole: true,
        inviteTokenShownOnce: true,
        inviteTokenNotPersistedInUrlOrSnapshot: true,
        inviteAcceptedWithVerifiedPrivyToken: true,
        inviteReplayRejected: true,
        supersededInviteRejected: true,
        deactivatedAssignmentRevokesAccess: true,
        linkedStaffCannotRotateInvite: true,
        crossOrganizerInviteRotationRejected: true,
      },
      opsGateAccess: {
        opsLoginWithLinkedStaff: true,
        assignedGateRedeemAllowed: true,
        unassignedGateRedeemRejected: true,
        clientSuppliedStaffRejected: true,
        checkInSummaryScopedToAssignment: true,
        assignmentDeactivationBlocksOpsAccess: true,
      },
      redaction: {
        bearerTokensRedacted: true,
        privyTokensRedacted: true,
        inviteTokensRedacted: true,
        emailsRedacted: true,
        walletAddressesRedacted: true,
        providerSecretsRedacted: true,
        stripePublishableKeysRedacted: true,
        databaseUrlsRedacted: true,
        deploymentCredentialsRedacted: true,
        ciSecretMaskingCommandsRedacted: true,
        staffIdentifiersRedacted: true,
        organizerIdentifiersRedacted: true,
        ticketIdentifiersRedacted: true,
      },
    },
    overrides,
  );
}

function withProgressText(evidence) {
  return [
    "Checking FanPass staging tenant and staff-policy evidence...",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}

function createImplementationSnapshot() {
  return {
    source: "staff-tenant-staging-policy-boundaries",
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
