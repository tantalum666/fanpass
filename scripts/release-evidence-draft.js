const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const args = parseArgs(process.argv.slice(2));
const kind = args.kind ?? args._[0];

const snapshotFiles = {
  "staff-tenant": [
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
  ],
  "ios-build": [
    "apps/ios/FanPass/project.yml",
    "apps/ios/FanPass/Config/Local.xcconfig",
    "apps/ios/FanPass/Config/Staging.xcconfig",
    "apps/ios/FanPass/Config/Beta.xcconfig",
    "apps/ios/FanPass/Config/Production.xcconfig",
    "apps/ios/FanPass/FanPass/Generated/Info.plist",
    "apps/ios/FanPass/FanPassOps/Generated/Info.plist",
    "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
    "apps/ios/FanPass/FanPass/App/FanPassApp.swift",
    "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
    "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
    "apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift",
    "apps/ios/FanPass/FanPass/Services/FanPassPaymentCoordinator.swift",
    "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
    "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
    "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
    "scripts/ios-distribution-boundary-audit.js",
  ],
  "apple-wallet": [
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
  ],
  "ops-scanner": [
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
  ],
  "chain-custody": [
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
  ],
};

if (!Object.hasOwn(snapshotFiles, kind)) {
  console.error(
    [
      "Usage: node scripts/release-evidence-draft.js <staff-tenant|ios-build|apple-wallet|ops-scanner|chain-custody> [--out <file>] [--checked-at <iso>]",
      "",
      "Creates a non-passing, secret-free draft evidence JSON with current SHA-256 snapshot fields.",
      "Fill only facts proven by real staging, signing, physical-device, Wallet, or custody evidence, then run the matching validator.",
    ].join("\n"),
  );
  process.exit(1);
}

const checkedAt = args["checked-at"] ?? new Date().toISOString();
if (!isIsoDate(checkedAt)) {
  console.error("--checked-at must be an ISO timestamp");
  process.exit(1);
}

const draft = buildDraft(kind, checkedAt);
const output = `${JSON.stringify(draft, null, 2)}\n`;

if (args.out) {
  const outPath = path.resolve(rootDir, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output);
  console.log(
    JSON.stringify(
      { ok: true, written: path.relative(rootDir, outPath) },
      null,
      2,
    ),
  );
} else {
  process.stdout.write(output);
}

function buildDraft(draftKind, checkedAtIso) {
  if (draftKind === "staff-tenant") {
    return {
      ok: false,
      draft: true,
      draftStatus: "requires-real-staging-tenant-staff-proof",
      checkedAt: checkedAtIso,
      provider: "staff-tenant-staging",
      environment: "staging",
      localDryRun: false,
      demoAuthUsed: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      implementationSnapshot: snapshotBlock(
        "staff-tenant-staging-policy-boundaries",
        draftKind,
      ),
      runtime: {
        apiBaseUrl: "<fill-real-https-staging-api-url>",
        consoleBaseUrl: "<fill-real-https-staging-console-url>",
        productionLikeConfig: "<verify-in-deployed-staging>",
        seededDemoUsersDisabled: "<verify-demo-auth-rejected>",
        stagingDatabaseIsolated: "<verify-staging-database>",
        adminBearerFromVerifiedAuth: "<verify-privy-backed-admin-session>",
        deploymentCredentialsAvailable: false,
      },
      tenantIsolation: allPlaceholders([
        "stagingTenantCreated",
        "organizerScopedEventCreated",
        "secondOrganizerIsolationVerified",
        "crossOrganizerConsoleReadRejected",
        "crossOrganizerStaffAssignmentRejected",
        "adminCanAuditWithoutPiiLeakage",
        "noSeededDemoTenantUsed",
      ]),
      authSession: allPlaceholders([
        "privyLoginUsed",
        "verifiedPrivyTokensUsed",
        "demoSessionRejected",
        "consoleHttpOnlyCookieVerified",
        "consoleLockedWhenUnauthenticated",
        "fanRoleRejectedFromConsole",
      ]),
      staffPolicy: allPlaceholders([
        "inviteCreatedByOrganizerScopedConsole",
        "inviteTokenShownOnce",
        "inviteTokenNotPersistedInUrlOrSnapshot",
        "inviteAcceptedWithVerifiedPrivyToken",
        "inviteReplayRejected",
        "supersededInviteRejected",
        "deactivatedAssignmentRevokesAccess",
        "linkedStaffCannotRotateInvite",
        "crossOrganizerInviteRotationRejected",
      ]),
      opsGateAccess: allPlaceholders([
        "opsLoginWithLinkedStaff",
        "assignedGateRedeemAllowed",
        "unassignedGateRedeemRejected",
        "clientSuppliedStaffRejected",
        "checkInSummaryScopedToAssignment",
        "assignmentDeactivationBlocksOpsAccess",
      ]),
      redaction: redactionProof([
        "bearerTokensRedacted",
        "privyTokensRedacted",
        "inviteTokensRedacted",
        "emailsRedacted",
        "walletAddressesRedacted",
        "providerSecretsRedacted",
        "stripePublishableKeysRedacted",
        "databaseUrlsRedacted",
        "deploymentCredentialsRedacted",
        "ciSecretMaskingCommandsRedacted",
        "staffIdentifiersRedacted",
        "organizerIdentifiersRedacted",
        "ticketIdentifiersRedacted",
      ]),
      nextValidator:
        "npm run security:staff-tenant:staging-evidence -- <saved-json-output>",
    };
  }

  if (draftKind === "ios-build") {
    return {
      ok: false,
      draft: true,
      draftStatus: "requires-signed-physical-device-or-testflight-proof",
      checkedAt: checkedAtIso,
      provider: "ios-staging-build",
      localDryRun: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      implementationSnapshot: snapshotBlock(
        "ios-staging-build-distribution-boundaries",
        draftKind,
      ),
      environment: {
        name: "staging",
        apiBaseUrl: "<fill-real-https-staging-api-url>",
        configFile: "Config/Staging.xcconfig",
        buildConfiguration: "Staging",
        demoAuthDisabled: "<verify-in-build-and-runtime>",
        stripeMode: "test",
        privyAppType: "test",
        deploymentCredentialsAvailable: false,
      },
      apps: [
        iosBuildAppDraft("FanPass", "FanPass", "com.fanpass.app", {
          cameraPermissionPresent: false,
          nfcEntitlementPresent: false,
          staffControlsPresent: false,
          paymentReturnUrlSchemePresent: "<verify-in-built-app>",
        }),
        iosBuildAppDraft("FanPass Ops", "FanPassOps", "com.fanpass.ops", {
          cameraPermissionPresent: "<verify-in-built-app>",
          nfcEntitlementPresent: "<verify-in-built-app>",
          consumerWalletPresent: false,
          marketplacePresent: false,
          stripePaymentSheetPresent: false,
        }),
      ],
      runtimeChecks: {
        apiHealthReachable: "<verify-from-signed-build-network-path>",
        tlsVerified: "<verify-https-no-localhost>",
        demoAuthRejected: "<verify-against-staging-api>",
        iosDistributionBoundaryAuditPassed:
          "<run-security-ios-distribution-boundaries>",
        stagingRuntimeEvidencePassedOrLinked:
          "<link-validated-staging-runtime-evidence>",
      },
      redaction: redactionProof([
        "bearerTokensRedacted",
        "privyTokensRedacted",
        "stripeSecretsRedacted",
        "providerSecretsRedacted",
        "stripePublishableKeysRedacted",
        "databaseUrlsRedacted",
        "deploymentCredentialsRedacted",
        "ciSecretMaskingCommandsRedacted",
        "appleSigningMaterialRedacted",
        "provisioningProfilesRedacted",
        "deviceIdentifiersRedacted",
        "realPersonalDataExcluded",
      ]),
      nextValidator:
        "npm run security:ios-staging-build:evidence -- <saved-json-output>",
    };
  }

  if (draftKind === "apple-wallet") {
    return {
      ok: false,
      draft: true,
      draftStatus: "requires-signed-pkpass-and-physical-iphone-proof",
      checkedAt: checkedAtIso,
      provider: "apple-wallet",
      localPrototype: false,
      usesUnsignedPrototype: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      deploymentCredentialsAvailable: false,
      implementationSnapshot: snapshotBlock(
        "apple-wallet-pass-boundaries",
        draftKind,
      ),
      passSigning: {
        pkpassGenerated: "<verify-with-wallet-signing-tool>",
        pkpassValidated: "<verify-pkpass-package>",
        signedWithApplePassCertificate: "<verify-redacted-cert-review>",
        certificatePrivateKeyExported: false,
        passTypeIdentifierConfigured: "<verify-redacted-or-nonsecret-id>",
        teamIdentifierConfigured: "<verify-redacted-or-nonsecret-team>",
        manifestHashVerified: "<verify-manifest-hashes>",
        signatureVerified: "<verify-pkpass-signature>",
        barcodePayloadSignedByFanPassApi: "<verify-staging-api-payload>",
        barcodeFormat: "PKBarcodeFormatQR",
      },
      deviceInstall: {
        realDeviceTested: "<verify-physical-iphone>",
        simulatorOnly: false,
        buildChannel: "development",
        addPassFlowVerified: "<verify-add-to-wallet-flow>",
        walletDisplaysSignedPass: "<verify-device-wallet-display>",
        barcodeScansThroughFanPassOps: "<verify-ops-scan-result>",
      },
      passContents: allPlaceholders([
        "containsNoRealPersonalData",
        "containsNoProviderSecrets",
        "containsNoPaymentData",
        "containsOnlySignedEntryPayload",
        "expirationMatchesQrTtlPolicy",
      ]),
      security: {
        noPrivateKeysInRepo: "<run-secret-and-repo-review>",
        passCertificateNotCommitted: "<run-secret-and-repo-review>",
        usesEphemeralTestTicket: "<verify-test-ticket-only>",
        revocationOrRotationPlanDocumented: "<verify-runbook>",
        prototypeBarcodeFallbackRemovedOrDebugOnly:
          "<run-ios-distribution-boundaries>",
      },
      redaction: redactionProof([
        "privateKeyRedacted",
        "certificateSerialRedacted",
        "teamIdRedactedOrNonSecret",
        "passTypeIdRedactedOrNonSecret",
        "ticketIdentifiersRedacted",
        "bearerTokensRedacted",
        "providerSecretsRedacted",
        "stripePublishableKeysRedacted",
        "databaseUrlsRedacted",
        "deploymentCredentialsRedacted",
      ]),
      nextValidator:
        "npm run security:apple-wallet:evidence -- <saved-json-output>",
    };
  }

  if (draftKind === "ops-scanner") {
    return {
      ok: false,
      draft: true,
      draftStatus: "requires-physical-qr-nfc-device-proof",
      checkedAt: checkedAtIso,
      surface: "fanpass-ops",
      localSimulator: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      implementationSnapshot: snapshotBlock(
        "ops-scanner-physical-device-boundaries",
        draftKind,
      ),
      runtime: {
        realDeviceTested: "<verify-physical-iphone>",
        buildChannel: "development",
        apiBaseUrl: "<fill-real-https-staging-api-url>",
        releaseConfigUsed: "<verify-staging-or-beta-config>",
        debugPasteFallbackUsed: false,
        deploymentCredentialsAvailable: false,
      },
      qrTransport: allPlaceholders([
        "cameraScanVerified",
        "acceptedScanVerified",
        "duplicateReplayRejected",
        "expiredOrInvalidPayloadRejected",
      ]),
      nfcTransport: allPlaceholders([
        "physicalTagReadVerified",
        "ndefPayloadNormalized",
        "acceptedScanVerified",
        "duplicateReplayRejected",
        "unsupportedDeviceFallbackVerified",
      ]),
      backendAuthority: allPlaceholders([
        "fanPassApiSignatureVerified",
        "nonceReplayRejectedByApi",
        "gateAssignmentEnforced",
        "scannerIdentityDerivedFromBearer",
        "clientSuppliedScannerUserRejected",
        "checkInSummaryUpdated",
      ]),
      redaction: redactionProof([
        "bearerTokensRedacted",
        "qrSigningSecretRedacted",
        "payloadNonceRedacted",
        "ticketIdentifiersRedacted",
        "staffIdentifiersRedacted",
        "deviceIdentifiersRedacted",
        "providerSecretsRedacted",
        "stripePublishableKeysRedacted",
        "databaseUrlsRedacted",
        "deploymentCredentialsRedacted",
      ]),
      nextValidator:
        "npm run security:ops-scanner:device-evidence -- <saved-json-output>",
    };
  }

  return {
    ok: false,
    draft: true,
    draftStatus: "requires-real-testnet-custody-and-contract-control-proof",
    checkedAt: checkedAtIso,
    provider: "chain-custody",
    environment: "testnet",
    localMockOnly: false,
    realUserDataUsed: false,
    productionCredentialsUsed: false,
    deploymentCredentialsAvailable: false,
    implementationSnapshot: snapshotBlock(
      "chain-custody-ownership-outbox-boundaries",
      draftKind,
    ),
    custody: {
      signerProvider: "vault-kms",
      usesVaultKmsOrDelegatedSigner: "<verify-signer-architecture>",
      rawPrivateKeyUnavailableToApp: "<verify-app-never-receives-key>",
      operatorKeyNotCommitted: "<run-chain-operator-key-audit>",
      signerAccessPolicyReviewed: "<verify-policy-review>",
      leastPrivilegeSignerPolicyVerified: "<verify-policy-review>",
      signingAuditLogCaptured: "<verify-redacted-audit-log>",
    },
    contractControl: allPlaceholders([
      "multisigOwnerConfigured",
      "timelockOrAdminDelayConfigured",
      "singleHotKeyIsNotOwner",
      "ownerChangeTestedOnTestnet",
      "emergencyAdminSeparationReviewed",
    ]),
    sideEffects: {
      chainCallsThroughDurableOutboxOnly: "<run-provider-boundary-audit>",
      noDirectRequestPathChainCalls: "<run-provider-boundary-audit>",
      ownershipTransferJobTested: "<verify-testnet-outbox-run>",
      ownershipFinalizationJobTested: "<verify-testnet-outbox-run>",
      staleJobRecoveryVerified: "<run-side-effects-worker-verify>",
      idempotentRetryVerified: "<run-settlement-retry-idempotency>",
      outboxHealthAfterRun: "<healthy-after-real-testnet-run>",
    },
    operationalReadiness: allPlaceholders([
      "rotationProcedureDocumented",
      "incidentResponseDocumented",
      "signerDisableProcedureDocumented",
      "monitoringAndAlertingConfigured",
      "rollbackOrPausePlanDocumented",
    ]),
    redaction: redactionProof([
      "privateKeysRedacted",
      "seedPhrasesRedacted",
      "bearerTokensRedacted",
      "signerProviderSecretsRedacted",
      "providerSecretsRedacted",
      "databaseUrlsRedacted",
      "rpcUrlsRedacted",
      "stripePublishableKeysRedacted",
      "deploymentCredentialsRedacted",
      "ciSecretMaskingCommandsRedacted",
      "transactionHashesRedactedOrShortened",
      "walletAddressesRedactedOrTestOnly",
      "vaultIdentifiersRedactedOrNonSensitive",
    ]),
    nextValidator:
      "npm run security:chain-custody:evidence -- <saved-json-output>",
  };
}

function iosBuildAppDraft(name, scheme, bundleId, appSpecificFields) {
  return {
    name,
    scheme,
    bundleId,
    archiveSucceeded: "<verify-xcode-archive>",
    signedWithAppleTeam: "<verify-redacted-signing-summary>",
    distributionChannel: "development-device",
    installVerifiedOnPhysicalDevice: "<verify-physical-install>",
    apiBaseUrlObserved: "<fill-real-https-staging-api-url>",
    debugCompilationDisabled: "<verify-release-build>",
    debugPayloadHelpersUnavailable: "<verify-no-copy-paste-helpers>",
    secretsInBundle: false,
    ...appSpecificFields,
  };
}

function snapshotBlock(source, draftKind) {
  return {
    source,
    files: snapshotFiles[draftKind].map((file) => ({
      file,
      sha256: sha256File(file),
    })),
  };
}

function allPlaceholders(keys) {
  return Object.fromEntries(
    keys.map((key) => [key, `<verify-${kebabCase(key)}>`]),
  );
}

function redactionProof(keys) {
  return Object.fromEntries(keys.map((key) => [key, true]));
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(rootDir, file)))
    .digest("hex");
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      parsed._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function isIsoDate(value) {
  if (typeof value !== "string") {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
}

function kebabCase(value) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
