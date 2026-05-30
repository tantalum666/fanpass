const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/ios-distribution-boundary-audit.js",
);

const cases = [
  {
    label: "accepts separated iOS distribution boundaries",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects missing iOS signing placeholders",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/project.yml",
        projectYml({ includeSigning: false }),
      ),
  },
  {
    label: "rejects raw Apple team id in project signing settings",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/project.yml",
        projectYml({ rawTeamId: true }),
      ),
  },
  {
    label: "rejects real provisioning profile names",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/project.yml",
        projectYml({ rawProfileName: true }),
      ),
  },
  {
    label: "rejects Apple certificate identity markers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/project.yml",
        projectYml({ certificateIdentity: true }),
      ),
  },
  {
    label: "rejects FanPass camera permission drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/FanPass/Generated/Info.plist",
        "\n<key>NSCameraUsageDescription</key>\n<string>camera</string>\n",
      ),
  },
  {
    label: "rejects FanPassOps missing NFC entitlement",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
        plist("<dict></dict>"),
      ),
  },
  {
    label: "rejects release config pointing at local HTTP",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/Config/Beta.xcconfig",
        "FANPASS_API_BASE_URL = http:/$()/localhost:4000\nFANPASS_STRIPE_PUBLISHABLE_KEY =\n",
      ),
  },
  {
    label: "rejects server-side secret marker in iOS config",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/Config/Staging.xcconfig",
        "STRIPE_SECRET_KEY = sk_test_fake\n",
      ),
  },
  {
    label: "rejects Privy secret marker in iOS config",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/Config/Staging.xcconfig",
        "PRIVY_APP_SECRET = do-not-commit\n",
      ),
  },
  {
    label: "rejects checked-in Stripe publishable key in iOS config",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/Config/Staging.xcconfig",
        "FANPASS_STRIPE_PUBLISHABLE_KEY = pk_test_should_not_be_committed\n",
      ),
  },
  {
    label: "rejects Stripe publishable-key runtime guard drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
        fanPassEnvironment({ testKeyGuard: false }),
      ),
  },
  {
    label: "rejects Privy public-config secret guard drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
        fanPassEnvironment({ privySecretGuard: false }),
      ),
  },
  {
    label: "rejects FanPassOps Stripe leakage",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/project.yml",
        projectYml({ opsStripe: true }),
      ),
  },
  {
    label: "rejects fake Apple Wallet pass flow",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
        "\nlet fake = PKAddPassesViewController()\n",
      ),
  },
  {
    label: "rejects wallet debug payload copy outside DEBUG",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
        walletView({ debugWrap: false }),
      ),
  },
  {
    label: "rejects Ops paste payload entry outside DEBUG",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
        scannerView({ debugWrap: false }),
      ),
  },
  {
    label: "rejects Ops shell paste fallback metric outside DEBUG",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
        opsShell({ debugWrap: false }),
      ),
  },
  {
    label: "rejects missing debug payload documentation marker",
    expected: "fail",
    mutate: (fixtureRoot) => {
      for (const file of [
        "docs/IOS_DISTRIBUTION_PLAN.md",
        "docs/DEVELOPMENT_TASKS.md",
        "docs/QA_CHECKLIST.md",
        "docs/BETA_ROADMAP.md",
      ]) {
        writeFixtureFile(
          fixtureRoot,
          file,
          docs().replace("debug-gated payload copy/paste", ""),
        );
      }
    },
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        "#!/usr/bin/env bash\necho missing ios distribution audit\n",
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-ios-distribution-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_IOS_DISTRIBUTION_AUDIT_ROOT: fixtureRoot,
      },
      encoding: "utf8",
    });
    const passed = result.status === 0;
    const expectedPass = testCase.expected === "pass";
    return {
      label: testCase.label,
      expected: testCase.expected,
      status: result.status,
      ok: passed === expectedPass,
      stderr: result.stderr.trim(),
    };
  } finally {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        failures,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      cases: results.map(({ label, expected, status }) => ({
        label,
        expected,
        status,
      })),
    },
    null,
    2,
  ),
);

function writePassingFixture(fixtureRoot) {
  writeFixtureFile(fixtureRoot, "package.json", packageJson());
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.sh",
    "npm run security:ios-distribution-boundaries:self-test\nnpm run security:ios-distribution-boundaries\n",
  );
  writeFixtureFile(fixtureRoot, "apps/ios/FanPass/project.yml", projectYml());
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Generated/Info.plist",
    fanPassInfoPlist(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPassOps/Generated/Info.plist",
    opsInfoPlist(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
    opsEntitlements(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/Config/Local.xcconfig",
    "FANPASS_API_BASE_URL = http:/$()/localhost:4000\nFANPASS_PRIVY_APP_ID =\nFANPASS_PRIVY_APP_CLIENT_ID =\nFANPASS_STRIPE_PUBLISHABLE_KEY =\n",
  );
  for (const [file, host] of [
    [
      "apps/ios/FanPass/Config/Staging.xcconfig",
      "replace-me-staging-api.fanpass.invalid",
    ],
    [
      "apps/ios/FanPass/Config/Beta.xcconfig",
      "replace-me-beta-api.fanpass.invalid",
    ],
    [
      "apps/ios/FanPass/Config/Production.xcconfig",
      "replace-me-api.fanpass.invalid",
    ],
  ]) {
    writeFixtureFile(
      fixtureRoot,
      file,
      `FANPASS_API_BASE_URL = https:/$()/${host}\nFANPASS_PRIVY_APP_ID =\nFANPASS_PRIVY_APP_CLIENT_ID =\nFANPASS_STRIPE_PUBLISHABLE_KEY =\n`,
    );
  }
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
    fanPassEnvironment(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
    walletView(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
    scannerView(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
    opsShell(),
  );
  writeFixtureFile(fixtureRoot, "docs/IOS_DISTRIBUTION_PLAN.md", docs());
  writeFixtureFile(fixtureRoot, "docs/DEVELOPMENT_TASKS.md", docs());
  writeFixtureFile(fixtureRoot, "docs/QA_CHECKLIST.md", docs());
  writeFixtureFile(fixtureRoot, "docs/BETA_ROADMAP.md", docs());
}

function fanPassEnvironment(options = {}) {
  const testKeyGuard = options.testKeyGuard !== false;
  const privySecretGuard = options.privySecretGuard !== false;
  return `
enum FanPassEnvironment {
    struct PrivyConfiguration: Equatable {
        let appId: String
        let appClientId: String
    }

    static var stripePublishableKey: String? {
        let trimmed = "fixture"
        guard !trimmed.isEmpty,
              !trimmed.hasPrefix("$("),
              !trimmed.lowercased().contains("replace-me")${testKeyGuard ? ",\n              isStripeTestPublishableKey(trimmed)" : ""}
        else {
            return nil
        }
        return trimmed
    }

    static var privyConfiguration: PrivyConfiguration? {
        guard let appId = publicConfigValue("FanPassPrivyAppID"),
              let appClientId = publicConfigValue("FanPassPrivyAppClientID")
        else {
            return nil
        }

        return PrivyConfiguration(appId: appId, appClientId: appClientId)
    }

    private static func publicConfigValue(_ key: String) -> String? {
        let trimmed = "fixture"
        guard !trimmed.isEmpty,
              !trimmed.hasPrefix("$("),
              !trimmed.lowercased().contains("replace-me")${privySecretGuard ? ",\n              !containsProviderSecretMarker(trimmed)" : ""}
        else {
            return nil
        }

        return trimmed
    }

    private static func isStripeTestPublishableKey(_ value: String) -> Bool {
        value.hasPrefix("pk_test_")
    }

    private static func containsProviderSecretMarker(_ value: String) -> Bool {
        let normalized = value.lowercased()
        return [
            "authorization: bearer",
            "bearer ",
            "eyjhbgci",
            "-----begin ",
            "privy_app_secret",
            "privy_verification_key",
            "privy_access_token",
            "sk_test_",
            "sk_live_",
            "pk_test_",
            "pk_live_",
            "whsec_",
            "client_secret",
            "database_url",
        ].contains { normalized.contains($0) }
    }
}
`;
}

function packageJson() {
  return JSON.stringify(
    {
      scripts: {
        "security:ios-distribution-boundaries":
          "node scripts/ios-distribution-boundary-audit.js",
        "security:ios-distribution-boundaries:self-test":
          "node scripts/ios-distribution-boundary-audit-self-test.js",
      },
    },
    null,
    2,
  );
}

function projectYml(options = {}) {
  const includeSigning = options.includeSigning !== false;
  const teamId = options.rawTeamId ? "ABC123DEFG" : "$(FANPASS_APPLE_TEAM_ID)";
  const fanProfile = options.rawProfileName
    ? "FanPass Beta Distribution"
    : "$(FANPASS_FANPASS_PROVISIONING_PROFILE_SPECIFIER)";
  const opsProfile = options.rawProfileName
    ? "FanPass Ops Beta Distribution"
    : "$(FANPASS_OPS_PROVISIONING_PROFILE_SPECIFIER)";
  const signingSettings = includeSigning
    ? `
      DEVELOPMENT_TEAM: ${teamId}
      CODE_SIGN_STYLE: Manual
      PROVISIONING_PROFILE_SPECIFIER: ${fanProfile}${options.certificateIdentity ? "\n      CODE_SIGN_IDENTITY: Apple Distribution: FanPass Inc (ABC123DEFG)" : ""}`
    : "";
  const opsSigningSettings = includeSigning
    ? `
      DEVELOPMENT_TEAM: ${teamId}
      CODE_SIGN_STYLE: Manual
      PROVISIONING_PROFILE_SPECIFIER: ${opsProfile}`
    : "";

  return `
targets:
  FanPass:
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.fanpass.app${signingSettings}
    sources:
      - path: FanPass
        excludes:
          - Features/Scanner
    dependencies:
      - package: Stripe
        product: StripePaymentSheet
      - package: SocketIO
        product: SocketIO
    info:
      properties:
        FanPassStripePublishableKey: $(FANPASS_STRIPE_PUBLISHABLE_KEY)
        CFBundleURLTypes:
        - CFBundleURLSchemes:
            - fanpass-payments
  FanPassOps:
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.fanpass.ops${opsSigningSettings}
      CODE_SIGN_ENTITLEMENTS: FanPassOps/FanPassOps.entitlements
    sources:
      - FanPassOps
    ${options.opsStripe ? "dependencies:\n      - package: Stripe\n        product: StripePaymentSheet" : ""}
    info:
      properties:
        NFCReaderUsageDescription: FanPass Ops uses NFC.
        NSCameraUsageDescription: FanPass Ops uses camera.
        CFBundleURLTypes:
        - CFBundleURLSchemes:
            - fanpass-ops
`;
}

function fanPassInfoPlist() {
  return plist(`
<dict>
  <key>CFBundleURLTypes</key>
  <array><dict><key>CFBundleURLSchemes</key><array><string>fanpass-payments</string></array></dict></array>
  <key>FanPassAPIBaseURL</key>
  <string>$(FANPASS_API_BASE_URL)</string>
  <key>FanPassStripePublishableKey</key>
  <string>$(FANPASS_STRIPE_PUBLISHABLE_KEY)</string>
</dict>`);
}

function opsInfoPlist() {
  return plist(`
<dict>
  <key>CFBundleURLTypes</key>
  <array><dict><key>CFBundleURLSchemes</key><array><string>fanpass-ops</string></array></dict></array>
  <key>FanPassAPIBaseURL</key>
  <string>$(FANPASS_API_BASE_URL)</string>
  <key>NFCReaderUsageDescription</key>
  <string>FanPass Ops uses NFC.</string>
  <key>NSCameraUsageDescription</key>
  <string>FanPass Ops uses camera.</string>
</dict>`);
}

function opsEntitlements() {
  return plist(`
<dict>
  <key>com.apple.developer.nfc.readersession.formats</key>
  <array><string>NDEF</string></array>
</dict>`);
}

function walletView(options = {}) {
  const debugWrap = options.debugWrap !== false;
  return `
StatusPill(text: "Prototype", color: FanPassTheme.amber)
struct AppleWalletBarcodePrototype {}
${debug(
  debugWrap,
  `
Button("Copy barcode JSON") {
  UIPasteboard.general.string = payload.walletBarcode.jsonString
}
Button("Copy entry payload") {
  UIPasteboard.general.string = payload.qrCodeString
}
`,
)}
`;
}

function scannerView(options = {}) {
  const debugWrap = options.debugWrap !== false;
  return `
${debug(
  debugWrap,
  `
TextField("Paste QR payload JSON", text: $qrText)
Button {
  pasteFromClipboard()
} label: {
  Label("Paste", systemImage: "doc.on.clipboard")
}
return "Waiting for QR, NFC, or paste fallback"
private func pasteFromClipboard() {
  qrText = UIPasteboard.general.string ?? qrText
}
`,
)}
return "Waiting for QR or NFC"
`;
}

function opsShell(options = {}) {
  const debugWrap = options.debugWrap !== false;
  return `
OpsMetric(title: "Mode", value: "QR")
${debug(debugWrap, 'OpsMetric(title: "Fallback", value: "Paste")')}
OpsMetric(title: "NFC", value: "Beta")
`;
}

function debug(debugWrap, contents) {
  return debugWrap ? `#if DEBUG\n${contents}\n#endif` : contents;
}

function docs() {
  return "security:ios-distribution-boundaries\nFanPass target has no Camera/NFC permissions\nFanPass Ops owns Camera/NFC capability\nsigned `.pkpass`\nreal HTTPS staging\ndebug-gated payload copy/paste\nplaceholder Apple signing settings\ntest publishable-key runtime guard\nPrivy public-config secret guard\n";
}

function plist(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n${body}\n</plist>\n`;
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function appendFixtureFile(fixtureRoot, relativePath, contents) {
  fs.appendFileSync(path.join(fixtureRoot, relativePath), contents);
}
