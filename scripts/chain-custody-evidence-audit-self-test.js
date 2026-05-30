const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/chain-custody-evidence-audit.js",
);
const implementationSnapshotFiles = [
  "apps/api/src/modules/ownership/ownership.service.ts",
  "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
  "apps/api/src/modules/side-effects/ticket-ownership-side-effects.service.ts",
  "apps/api/src/modules/side-effects/side-effect-outbox.service.ts",
  "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
  "apps/api/src/modules/side-effects/side-effect-health.service.ts",
  "apps/api/src/config/security-config.ts",
  "apps/api/prisma/schema.prisma",
  "scripts/chain-operator-key-boundary-audit.js",
  "scripts/provider-boundary-audit.js",
  "scripts/settlement-retry-idempotency-audit.js",
  "scripts/side-effects-worker-verify.sh",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-chain-custody-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts complete chain custody and contract-control evidence",
    writeEvidence("valid.txt", withProgressText(createEvidence())),
  );

  expectFail(
    "rejects raw private key markers and copyable 0x64 values",
    writeEvidence(
      "private-key-leak.txt",
      `${withProgressText(createEvidence())}\nTESTNET_OPERATOR_PRIVATE_KEY=replace-me\n0x1111111111111111111111111111111111111111111111111111111111111111\n`,
    ),
    ["TESTNET_OPERATOR_PRIVATE_KEY=", "0x64"],
  );

  expectFail(
    "rejects leaked provider keys and database URL markers",
    writeEvidence(
      "provider-database-markers.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234\nDATABASE_URL=postgresql://fixture:secret@db/fanpass\nCHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/fixture-secret\n`,
    ),
    [
      "STRIPE_PUBLISHABLE_KEY=",
      "pk_test_",
      "DATABASE_URL=",
      "database URLs",
      "RPC_URL=",
      "provider RPC URLs",
    ],
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
    "rejects CI secret masking command literals",
    writeEvidence(
      "ci-secret-mask-command-literals.txt",
      [
        withProgressText(createEvidence()),
        "::add-mask::fixture-ci-secret-value",
        "::set-secret name=CHAIN_RPC_TOKEN::fixture-ci-secret-value",
        "##vso[task.setvariable variable=CHAIN_RPC_TOKEN;issecret=true]fixture-ci-secret-value",
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
    "rejects missing CI secret masking command redaction proof",
    writeEvidence(
      "missing-ci-secret-masking-redaction.txt",
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
    "rejects stale chain custody implementation snapshot proof",
    writeEvidence(
      "stale-implementation-snapshot.txt",
      withProgressText(
        createEvidence({
          implementationSnapshot: {
            source: "old-chain-custody-boundary",
            files: [
              {
                file: "apps/api/src/modules/ownership/ownership.service.ts",
                sha256:
                  "1111111111111111111111111111111111111111111111111111111111111111",
              },
              {
                file: "unexpected/chain-custody.ts",
                sha256:
                  "2222222222222222222222222222222222222222222222222222222222222222",
              },
            ],
          },
        }),
      ),
    ),
    [
      "implementationSnapshot.source must be chain-custody-ownership-outbox-boundaries",
      "implementationSnapshot.files must include the current chain custody ownership/outbox boundary files",
      "implementationSnapshot.files contains unexpected file unexpected/chain-custody.ts",
      "implementationSnapshot.files apps/api/src/modules/ownership/ownership.service.ts sha256 must match the current chain custody ownership/outbox implementation",
      "implementationSnapshot.files missing apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
    ],
  );

  expectFail(
    "rejects secret-bearing JSON fields",
    writeEvidence(
      "secret-json-fields.txt",
      withProgressText({
        ...createEvidence(),
        custody: {
          ...createEvidence().custody,
          privateKey: "redacted-but-field-name-is-not-allowed",
        },
      }),
    ),
    ["raw secret-bearing JSON fields"],
  );

  expectFail(
    "rejects local mock or production credential evidence",
    writeEvidence(
      "local-mock.txt",
      withProgressText(
        createEvidence({
          localMockOnly: true,
          productionCredentialsUsed: true,
          realUserDataUsed: true,
        }),
      ),
    ),
    [
      "localMockOnly must be false",
      "productionCredentialsUsed must be false",
      "realUserDataUsed must be false",
    ],
  );

  expectFail(
    "rejects missing vault or delegated signer custody proof",
    writeEvidence(
      "missing-custody.txt",
      withProgressText(
        createEvidence({
          custody: {
            signerProvider: "hot-key",
            usesVaultKmsOrDelegatedSigner: false,
            rawPrivateKeyUnavailableToApp: false,
            leastPrivilegeSignerPolicyVerified: false,
          },
        }),
      ),
    ),
    [
      "custody.signerProvider must be vault-kms or delegated-signer",
      "custody.usesVaultKmsOrDelegatedSigner must be true",
      "custody.rawPrivateKeyUnavailableToApp must be true",
      "custody.leastPrivilegeSignerPolicyVerified must be true",
    ],
  );

  expectFail(
    "rejects hot-key contract ownership",
    writeEvidence(
      "hot-key-owner.txt",
      withProgressText(
        createEvidence({
          contractControl: {
            multisigOwnerConfigured: false,
            timelockOrAdminDelayConfigured: false,
            singleHotKeyIsNotOwner: false,
          },
        }),
      ),
    ),
    [
      "contractControl.multisigOwnerConfigured must be true",
      "contractControl.timelockOrAdminDelayConfigured must be true",
      "contractControl.singleHotKeyIsNotOwner must be true",
    ],
  );

  expectFail(
    "rejects direct chain calls outside the durable outbox",
    writeEvidence(
      "direct-chain-call.txt",
      withProgressText(
        createEvidence({
          sideEffects: {
            chainCallsThroughDurableOutboxOnly: false,
            noDirectRequestPathChainCalls: false,
            outboxHealthAfterRun: "stale",
          },
        }),
      ),
    ),
    [
      "sideEffects.chainCallsThroughDurableOutboxOnly must be true",
      "sideEffects.noDirectRequestPathChainCalls must be true",
      "sideEffects.outboxHealthAfterRun must be healthy",
    ],
  );

  expectFail(
    "rejects missing operational runbooks",
    writeEvidence(
      "missing-runbooks.txt",
      withProgressText(
        createEvidence({
          operationalReadiness: {
            rotationProcedureDocumented: false,
            incidentResponseDocumented: false,
            monitoringAndAlertingConfigured: false,
          },
        }),
      ),
    ),
    [
      "operationalReadiness.rotationProcedureDocumented must be true",
      "operationalReadiness.incidentResponseDocumented must be true",
      "operationalReadiness.monitoringAndAlertingConfigured must be true",
    ],
  );

  expectFail(
    "rejects missing redaction proof",
    writeEvidence(
      "missing-redaction.txt",
      withProgressText(
        createEvidence({
          redaction: {
            privateKeysRedacted: false,
            transactionHashesRedactedOrShortened: false,
            vaultIdentifiersRedactedOrNonSensitive: false,
          },
        }),
      ),
    ),
    [
      "redaction.privateKeysRedacted must be true",
      "redaction.transactionHashesRedactedOrShortened must be true",
      "redaction.vaultIdentifiersRedactedOrNonSensitive must be true",
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
      provider: "chain-custody",
      environment: "testnet",
      localMockOnly: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      deploymentCredentialsAvailable: false,
      implementationSnapshot: createImplementationSnapshot(),
      custody: {
        signerProvider: "vault-kms",
        usesVaultKmsOrDelegatedSigner: true,
        rawPrivateKeyUnavailableToApp: true,
        operatorKeyNotCommitted: true,
        signerAccessPolicyReviewed: true,
        leastPrivilegeSignerPolicyVerified: true,
        signingAuditLogCaptured: true,
      },
      contractControl: {
        multisigOwnerConfigured: true,
        timelockOrAdminDelayConfigured: true,
        singleHotKeyIsNotOwner: true,
        ownerChangeTestedOnTestnet: true,
        emergencyAdminSeparationReviewed: true,
      },
      sideEffects: {
        chainCallsThroughDurableOutboxOnly: true,
        noDirectRequestPathChainCalls: true,
        ownershipTransferJobTested: true,
        ownershipFinalizationJobTested: true,
        staleJobRecoveryVerified: true,
        idempotentRetryVerified: true,
        outboxHealthAfterRun: "healthy",
      },
      operationalReadiness: {
        rotationProcedureDocumented: true,
        incidentResponseDocumented: true,
        signerDisableProcedureDocumented: true,
        monitoringAndAlertingConfigured: true,
        rollbackOrPausePlanDocumented: true,
      },
      redaction: {
        privateKeysRedacted: true,
        seedPhrasesRedacted: true,
        bearerTokensRedacted: true,
        signerProviderSecretsRedacted: true,
        providerSecretsRedacted: true,
        databaseUrlsRedacted: true,
        rpcUrlsRedacted: true,
        stripePublishableKeysRedacted: true,
        deploymentCredentialsRedacted: true,
        ciSecretMaskingCommandsRedacted: true,
        transactionHashesRedactedOrShortened: true,
        walletAddressesRedactedOrTestOnly: true,
        vaultIdentifiersRedactedOrNonSensitive: true,
      },
    },
    overrides,
  );
}

function createImplementationSnapshot() {
  return {
    source: "chain-custody-ownership-outbox-boundaries",
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
    "Checking FanPass chain custody evidence...",
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
