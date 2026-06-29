const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_IOS_DISTRIBUTION_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_IOS_DISTRIBUTION_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

const files = {
  packageJson: "package.json",
  betaVerifier: "scripts/beta-foundation-verify.sh",
  projectYml: "apps/ios/FanPass/project.yml",
  fanPassInfo: "apps/ios/FanPass/FanPass/Generated/Info.plist",
  fanPassOpsInfo: "apps/ios/FanPass/FanPassOps/Generated/Info.plist",
  fanPassOpsEntitlements: "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
  localConfig: "apps/ios/FanPass/Config/Local.xcconfig",
  stagingConfig: "apps/ios/FanPass/Config/Staging.xcconfig",
  betaConfig: "apps/ios/FanPass/Config/Beta.xcconfig",
  productionConfig: "apps/ios/FanPass/Config/Production.xcconfig",
  fanPassEnvironment:
    "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
  ticketWallet:
    "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
  scanner: "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
  opsShell: "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
  distributionPlan: "docs/IOS_DISTRIBUTION_PLAN.md",
  tasks: "docs/DEVELOPMENT_TASKS.md",
  qa: "docs/QA_CHECKLIST.md",
  roadmap: "docs/BETA_ROADMAP.md",
};

validateRequiredFiles();
validatePackageScripts();
validateCompositeVerifier();
validateXcodeTargets();
validateSigningPlaceholders();
validateInfoPlistsAndEntitlements();
validateConfigFiles();
validateStripePublishableKeyBoundary();
validateWalletPrototypeBoundary();
validateDebugPayloadBoundary();
validateDocs();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      iosDistributionBoundaries: {
        fanPassCapabilities:
          "consumer app has camera purpose string but no scanner source or NFC capability",
        fanPassOpsCapabilities:
          "Ops owns QR camera scanning; native NFC remains DEBUG-only for release",
        releaseApiConfigs: "staging/beta/production configs are HTTPS-only",
        localApiConfig: "local debug may use localhost HTTP",
        providerSecrets: "checked iOS configs for server-side secret markers",
        privyPublicConfig:
          "runtime rejects secret-like values for public Privy app config",
        stripePublishableKey:
          "checked-in configs stay key-free and runtime accepts test publishable keys only",
        signingPlaceholders: "project.yml uses Apple signing placeholders only",
        debugPayloadTools: "payload copy/paste helpers are debug-gated",
        appleWallet: "barcode prototype only; no unsigned pkpass flow",
      },
    },
    null,
    2,
  ),
);

function validateRequiredFiles() {
  for (const [label, relativePath] of Object.entries(files)) {
    if (!fs.existsSync(path.join(rootDir, relativePath))) {
      errors.push(`Missing required ${label} file: ${relativePath}`);
    }
  }
}

function validatePackageScripts() {
  const packageJson = JSON.parse(read(files.packageJson));
  const scripts = packageJson.scripts ?? {};
  for (const scriptName of [
    "security:ios-distribution-boundaries",
    "security:ios-distribution-boundaries:self-test",
  ]) {
    if (!scripts[scriptName]) {
      errors.push(`package.json must define ${scriptName}`);
    }
  }
}

function validateCompositeVerifier() {
  const verifier = read(files.betaVerifier);
  for (const marker of [
    "security:ios-distribution-boundaries:self-test",
    "security:ios-distribution-boundaries",
  ]) {
    if (!verifier.includes(marker)) {
      errors.push(`beta foundation verifier must run ${marker}`);
    }
  }
}

function validateXcodeTargets() {
  const project = read(files.projectYml);
  const fanPassBlock = targetBlock(project, "FanPass", "FanPassOps");
  const opsBlock = targetBlock(project, "FanPassOps", null);

  if (!/excludes:\s*\n\s*-\s*Features\/Scanner/.test(fanPassBlock)) {
    errors.push("FanPass target must exclude Features/Scanner");
  }
  if (
    /CODE_SIGN_ENTITLEMENTS|NFCReaderUsageDescription|fanpass-ops/.test(
      fanPassBlock,
    )
  ) {
    errors.push(
      "FanPass target must not declare NFC, Ops URL, or Ops entitlements",
    );
  }
  if (!/NSCameraUsageDescription:/.test(fanPassBlock)) {
    errors.push(
      "FanPass target must keep a camera purpose string for App Store validation",
    );
  }
  if (
    !/FanPassStripePublishableKey:\s*\$\(FANPASS_STRIPE_PUBLISHABLE_KEY\)/.test(
      fanPassBlock,
    )
  ) {
    errors.push(
      "FanPass target must read only the Stripe publishable key from build settings",
    );
  }
  if (!/fanpass-payments/.test(fanPassBlock)) {
    errors.push("FanPass target must keep the Stripe return URL scheme");
  }

  for (const marker of [
    "CODE_SIGN_ENTITLEMENTS: FanPassOps/FanPassOps.entitlements",
    "NFCReaderUsageDescription:",
    "NSCameraUsageDescription:",
    "fanpass-ops",
  ]) {
    if (!opsBlock.includes(marker)) {
      errors.push(`FanPassOps target must keep marker: ${marker}`);
    }
  }
  if (
    /FanPassStripePublishableKey|fanpass-payments|StripePaymentSheet|package:\s*Stripe/.test(
      opsBlock,
    )
  ) {
    errors.push(
      "FanPassOps target must not inherit consumer Stripe or payment URL settings",
    );
  }
}

function validateSigningPlaceholders() {
  const project = read(files.projectYml);
  const targets = [
    {
      label: "FanPass",
      block: targetBlock(project, "FanPass", "FanPassOps"),
      profileSpecifier: "$(FANPASS_FANPASS_PROVISIONING_PROFILE_SPECIFIER)",
    },
    {
      label: "FanPassOps",
      block: targetBlock(project, "FanPassOps", null),
      profileSpecifier: "$(FANPASS_OPS_PROVISIONING_PROFILE_SPECIFIER)",
    },
  ];

  for (const target of targets) {
    for (const marker of [
      "DEVELOPMENT_TEAM: $(FANPASS_APPLE_TEAM_ID)",
      "CODE_SIGN_STYLE: Manual",
      `PROVISIONING_PROFILE_SPECIFIER: ${target.profileSpecifier}`,
    ]) {
      if (!target.block.includes(marker)) {
        errors.push(
          `${target.label} target must keep placeholder signing setting: ${marker}`,
        );
      }
    }
  }

  for (const line of project.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DEVELOPMENT_TEAM:")) {
      const value = readYamlScalarValue(trimmed);
      if (value && value !== "$(FANPASS_APPLE_TEAM_ID)") {
        errors.push(
          "project.yml must use FANPASS_APPLE_TEAM_ID placeholder instead of a raw Apple team id",
        );
      }
    }

    if (trimmed.startsWith("PROVISIONING_PROFILE_SPECIFIER:")) {
      const value = readYamlScalarValue(trimmed);
      if (
        value &&
        ![
          "$(FANPASS_FANPASS_PROVISIONING_PROFILE_SPECIFIER)",
          "$(FANPASS_OPS_PROVISIONING_PROFILE_SPECIFIER)",
        ].includes(value)
      ) {
        errors.push(
          "project.yml must use provisioning profile placeholders instead of real profile names",
        );
      }
    }

    if (/PROVISIONING_PROFILE:\s*[0-9a-fA-F-]{36}/.test(trimmed)) {
      errors.push("project.yml must not commit provisioning profile UUIDs");
    }
  }

  for (const forbidden of [
    /CODE_SIGN_IDENTITY:\s*(Apple|iPhone)\s+(Development|Distribution|Developer)/i,
    /\.p12\b/i,
    /\.cer\b/i,
    /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/i,
    /APPLE_CERTIFICATE/i,
    /PROVISIONING_PROFILE_BASE64/i,
  ]) {
    if (forbidden.test(project)) {
      errors.push(
        "project.yml must not contain Apple certificate, private key, or provisioning profile material",
      );
    }
  }
}

function validateInfoPlistsAndEntitlements() {
  const fanInfo = read(files.fanPassInfo);
  const opsInfo = read(files.fanPassOpsInfo);
  const opsEntitlements = read(files.fanPassOpsEntitlements);

  for (const forbidden of [
    "NFCReaderUsageDescription",
    "com.apple.developer.nfc.readersession.formats",
    "fanpass-ops",
  ]) {
    if (fanInfo.includes(forbidden)) {
      errors.push(`FanPass Info.plist must not contain ${forbidden}`);
    }
  }
  for (const marker of [
    "FanPassStripePublishableKey",
    "NSCameraUsageDescription",
    "CFBundleIconName",
    "ITSAppUsesNonExemptEncryption",
    "fanpass-payments",
    "$(FANPASS_API_BASE_URL)",
  ]) {
    if (!fanInfo.includes(marker)) {
      errors.push(`FanPass Info.plist must keep marker: ${marker}`);
    }
  }

  for (const marker of [
    "NSCameraUsageDescription",
    "NFCReaderUsageDescription",
    "fanpass-ops",
    "$(FANPASS_API_BASE_URL)",
  ]) {
    if (!opsInfo.includes(marker)) {
      errors.push(`FanPassOps Info.plist must keep marker: ${marker}`);
    }
  }
  for (const forbidden of ["FanPassStripePublishableKey", "fanpass-payments"]) {
    if (opsInfo.includes(forbidden)) {
      errors.push(`FanPassOps Info.plist must not contain ${forbidden}`);
    }
  }
  if (
    opsEntitlements.includes(
      "com.apple.developer.nfc.readersession.formats",
    ) ||
    opsEntitlements.includes("<string>NDEF</string>")
  ) {
    errors.push(
      "FanPassOps release entitlements must not include Core NFC NDEF capability",
    );
  }
}

function validateConfigFiles() {
  const configs = [
    {
      label: "Local",
      file: files.localConfig,
      allowLocalhostHttp: true,
    },
    {
      label: "Staging",
      file: files.stagingConfig,
      allowLocalhostHttp: false,
    },
    {
      label: "Beta",
      file: files.betaConfig,
      allowLocalhostHttp: false,
    },
    {
      label: "Production",
      file: files.productionConfig,
      allowLocalhostHttp: false,
    },
  ];

  for (const config of configs) {
    const contents = read(config.file);
    const apiBaseUrl = readXcconfigValue(contents, "FANPASS_API_BASE_URL");
    if (!apiBaseUrl) {
      errors.push(`${config.label} xcconfig must set FANPASS_API_BASE_URL`);
      continue;
    }
    if (config.allowLocalhostHttp) {
      if (apiBaseUrl !== "http:/$()/localhost:4000") {
        errors.push("Local xcconfig must point at localhost:4000 only");
      }
    } else {
      if (!apiBaseUrl.startsWith("https:/$()/")) {
        errors.push(`${config.label} xcconfig must use an HTTPS API base URL`);
      }
      if (/localhost|127\.0\.0\.1|http:\/\$\(\)\//.test(apiBaseUrl)) {
        errors.push(`${config.label} xcconfig must not point at local HTTP`);
      }
    }

    const secretPattern =
      /(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|PRIVY_APP_SECRET|PRIVY_VERIFICATION_KEY|PRIVY_ACCESS_TOKEN|SESSION_SIGNING_SECRET|QR_SIGNING_SECRET|AUTHORIZATION:\s*BEARER|eyJhbGci|sk_(live|test)_|pk_(live|test)_|whsec_|client_secret|DATABASE_URL|privkey|private_key|BEGIN .*PRIVATE KEY)/i;
    if (secretPattern.test(contents)) {
      errors.push(
        `${config.label} xcconfig must not contain checked-in provider key or server-side secret markers`,
      );
    }
  }
}

function validateStripePublishableKeyBoundary() {
  const environment = read(files.fanPassEnvironment);
  if (!/static\s+var\s+stripePublishableKey:\s*String\?/.test(environment)) {
    errors.push(
      "FanPassEnvironment must keep a typed Stripe publishable-key accessor",
    );
  }
  if (!environment.includes("isStripeTestPublishableKey(trimmed)")) {
    errors.push(
      "FanPassEnvironment.stripePublishableKey must require the test publishable-key guard",
    );
  }
  if (
    !/private\s+static\s+func\s+isStripeTestPublishableKey\(_\s+value:\s*String\)\s*->\s*Bool\s*\{[\s\S]*value\.hasPrefix\(\"pk_test_\"\)/.test(
      environment,
    )
  ) {
    errors.push(
      "FanPassEnvironment must accept only pk_test_ publishable keys for the current Beta PaymentSheet path",
    );
  }
  if (/(pk_live_|sk_(test|live)_|whsec_)[A-Za-z0-9]/.test(environment)) {
    errors.push(
      "FanPassEnvironment must not contain committed Stripe live keys, secret keys, or webhook secrets",
    );
  }
  validatePrivyPublicConfigBoundary(environment);
}

function validatePrivyPublicConfigBoundary(environment) {
  if (!/struct\s+PrivyConfiguration:\s*Equatable/.test(environment)) {
    errors.push("FanPassEnvironment must keep a typed Privy configuration");
  }
  if (!environment.includes('publicConfigValue("FanPassPrivyAppID")')) {
    errors.push(
      "FanPassEnvironment must read the Privy app id through publicConfigValue",
    );
  }
  if (!environment.includes('publicConfigValue("FanPassPrivyAppClientID")')) {
    errors.push(
      "FanPassEnvironment must read the Privy app client id through publicConfigValue",
    );
  }
  if (!environment.includes("containsProviderSecretMarker(trimmed)")) {
    errors.push(
      "FanPassEnvironment publicConfigValue must reject provider secret markers",
    );
  }
  const secretGuardMatch = environment.match(
    /private\s+static\s+func\s+containsProviderSecretMarker\(_\s+value:\s*String\)\s*->\s*Bool\s*\{[\s\S]*?\n\s*\}/,
  );
  const secretGuardBody = secretGuardMatch?.[0] ?? "";
  for (const marker of [
    "privy_app_secret",
    "privy_verification_key",
    "privy_access_token",
    "eyjhbgci",
    "-----begin",
    "client_secret",
  ]) {
    if (!secretGuardBody.includes(marker)) {
      errors.push(
        `FanPassEnvironment Privy public-config secret guard must keep marker: ${marker}`,
      );
    }
  }
  if (!secretGuardBody) {
    errors.push(
      "FanPassEnvironment must keep the Privy public-config secret-marker guard",
    );
  }
  if (
    /PRIVY_APP_SECRET|PRIVY_VERIFICATION_KEY|PRIVY_ACCESS_TOKEN/.test(
      environment,
    )
  ) {
    errors.push(
      "FanPassEnvironment must not contain committed Privy app secrets, verification keys, or access-token assignments",
    );
  }
}

function validateWalletPrototypeBoundary() {
  const wallet = read(files.ticketWallet);
  if (!wallet.includes("AppleWalletBarcodePrototype")) {
    errors.push("Apple Wallet barcode must remain explicit prototype metadata");
  }
  if (!wallet.includes('Text("Apple Wallet barcode")')) {
    errors.push("Apple Wallet UI must keep explicit barcode-only labeling");
  }
  for (const forbidden of [
    "PKAddPassesViewController",
    ".pkpass",
    "PassKit",
    "PKPass",
  ]) {
    if (wallet.includes(forbidden)) {
      errors.push(
        `Ticket wallet must not expose unsigned Apple Wallet pass flow marker: ${forbidden}`,
      );
    }
  }
}

function validateDebugPayloadBoundary() {
  const wallet = read(files.ticketWallet);
  const scanner = read(files.scanner);
  const opsShell = read(files.opsShell);

  for (const marker of [
    "Copy barcode JSON",
    "Copy entry code",
    "copyPayload()",
    "UIPasteboard.general.string = payload.qrCodeString",
    "UIPasteboard.general.string = payload.walletBarcode.jsonString",
  ]) {
    if (!isMarkerInsideDebugBlock(wallet, marker)) {
      errors.push(
        `Ticket wallet debug payload helper must stay inside #if DEBUG: ${marker}`,
      );
    }
  }

  for (const marker of [
    "Manual QR code",
    'Label("Clipboard"',
    "pasteFromClipboard()",
    "UIPasteboard.general.string ?? qrText",
  ]) {
    if (!isMarkerInsideDebugBlock(scanner, marker)) {
      errors.push(
        `FanPass Ops paste payload helper must stay inside #if DEBUG: ${marker}`,
      );
    }
  }

  if (!scanner.includes("Waiting for QR or NFC")) {
    errors.push(
      "FanPass Ops scanner must keep a non-debug QR/NFC-only waiting hint.",
    );
  }

  if (
    opsShell.includes('OpsMetric(title: "Fallback"') &&
    !isMarkerInsideDebugBlock(opsShell, 'OpsMetric(title: "Fallback"')
  ) {
    errors.push(
      "FanPass Ops paste fallback metric must stay inside #if DEBUG.",
    );
  }
}

function validateDocs() {
  const docs = [files.distributionPlan, files.tasks, files.qa, files.roadmap]
    .map(read)
    .join("\n");

  for (const marker of [
    "security:ios-distribution-boundaries",
    "FanPass target has a camera purpose string but no scanner source or NFC capability",
    "FanPass Ops owns QR camera scanning and keeps native Core NFC DEBUG-only",
    "signed `.pkpass`",
    "real HTTPS staging",
    "debug-gated payload copy/paste",
    "placeholder Apple signing settings",
    "test publishable-key runtime guard",
    "Privy public-config secret guard",
  ]) {
    if (!docs.includes(marker)) {
      errors.push(`iOS distribution docs must keep marker: ${marker}`);
    }
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function readXcconfigValue(contents, key) {
  const line = contents
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith(`${key} =`));
  return line?.split("=").slice(1).join("=").trim() ?? "";
}

function readYamlScalarValue(line) {
  return line
    .split(":")
    .slice(1)
    .join(":")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function targetBlock(project, targetName, nextTargetName) {
  const start = project.indexOf(`  ${targetName}:\n`);
  if (start === -1) {
    errors.push(`Missing ${targetName} target in ${files.projectYml}`);
    return "";
  }
  const end = nextTargetName
    ? project.indexOf(`  ${nextTargetName}:\n`, start + targetName.length)
    : project.length;
  return project.slice(start, end === -1 ? project.length : end);
}

function isMarkerInsideDebugBlock(contents, marker) {
  const lines = contents.split(/\r?\n/);
  let debugDepth = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#if DEBUG")) {
      debugDepth += 1;
    } else if (trimmed.startsWith("#if ")) {
      if (debugDepth > 0) {
        debugDepth += 1;
      }
    } else if (trimmed.startsWith("#endif") && debugDepth > 0) {
      debugDepth -= 1;
    }
    if (line.includes(marker)) {
      return debugDepth > 0;
    }
  }
  return false;
}
