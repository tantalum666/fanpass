const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = process.env.FANPASS_PRIVY_LOCAL_CONFIG_ROOT
  ? path.resolve(process.env.FANPASS_PRIVY_LOCAL_CONFIG_ROOT)
  : path.resolve(__dirname, "..");
const apiEnvPath = path.join(
  rootDir,
  process.env.FANPASS_PRIVY_LOCAL_API_ENV ?? "apps/api/.env",
);
const expectedAppId = process.env.FANPASS_EXPECTED_PRIVY_APP_ID?.trim() ?? "";
const iosLocalConfigPath = path.join(
  rootDir,
  process.env.FANPASS_PRIVY_LOCAL_IOS_CONFIG ??
    "apps/ios/FanPass/Config/LocalSecrets.xcconfig",
);
const errors = [];

const env = readEnvFile(apiEnvPath);
const appId = env.PRIVY_APP_ID ?? "";
const verificationKey = normalizeEnvValue(env.PRIVY_VERIFICATION_KEY ?? "");
const iosLocalConfig = readXcconfigFile(iosLocalConfigPath);
const iosAppIdFromEnvironment =
  process.env.FANPASS_PRIVY_APP_ID?.trim() ?? "";
const appClientIdFromEnvironment =
  process.env.FANPASS_PRIVY_APP_CLIENT_ID?.trim() ?? "";
const iosAppId =
  iosAppIdFromEnvironment || iosLocalConfig.FANPASS_PRIVY_APP_ID || "";
const appClientId =
  appClientIdFromEnvironment ||
  iosLocalConfig.FANPASS_PRIVY_APP_CLIENT_ID ||
  "";
const iosPublicConfigSource = iosAppIdFromEnvironment
  ? "environment"
  : iosLocalConfig.FANPASS_PRIVY_APP_ID
    ? "local-xcconfig"
    : "missing";
const appClientIdSource = appClientIdFromEnvironment
  ? "environment"
  : iosLocalConfig.FANPASS_PRIVY_APP_CLIENT_ID
    ? "local-xcconfig"
    : "missing";

validateApiEnv();
validateIosPublicConfig();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      apiEnv: {
        file: path.relative(rootDir, apiEnvPath),
        ignoredBySourceControl: isIgnored(apiEnvPath),
        appIdConfigured: Boolean(appId),
        appIdMatchesExpected: expectedAppId ? appId === expectedAppId : null,
        verificationKeyConfigured: Boolean(verificationKey),
        verificationKeyPemPublicKey: isPemPublicKey(verificationKey),
        verificationKeyParsed: canParsePublicKey(verificationKey),
        verificationKeyLength: verificationKey.length,
      },
      ios: {
        appIdProvidedOutsideSourceControl: Boolean(iosAppId),
        appIdMatchesApiEnv: iosAppId ? iosAppId === appId : null,
        appClientIdProvidedOutsideSourceControl: Boolean(appClientId),
        appClientIdLooksPublicClientId: /^client-[A-Za-z0-9_-]{20,}$/.test(
          appClientId,
        ),
        buildSettingsInjectedOutsideSourceControl: Boolean(
          iosAppId && appClientId,
        ),
        publicConfigSource: iosPublicConfigSource,
        appClientIdSource,
        localOverrideFile: path.relative(rootDir, iosLocalConfigPath),
        localOverrideFileExists: fs.existsSync(iosLocalConfigPath),
        localOverrideIgnoredBySourceControl: fs.existsSync(iosLocalConfigPath)
          ? isIgnored(iosLocalConfigPath)
          : null,
        checkedInXcconfigsRemainPlaceholderOnly: xcconfigsPlaceholderOnly(),
        bundleIdsCovered: projectDefinesBundleIds(),
        xcodeBuildSettingNames: [
          "FANPASS_PRIVY_APP_ID",
          "FANPASS_PRIVY_APP_CLIENT_ID",
        ],
      },
      redaction: {
        secretValuesPrinted: false,
      },
    },
    null,
    2,
  ),
);

function validateApiEnv() {
  if (!fs.existsSync(apiEnvPath)) {
    errors.push(`${relative(apiEnvPath)} must exist for local Privy testing`);
    return;
  }
  if (!isIgnored(apiEnvPath)) {
    errors.push(`${relative(apiEnvPath)} must be ignored by source control`);
  }
  if (!appId) {
    errors.push("PRIVY_APP_ID must be configured in the local API env file");
  }
  if (expectedAppId && appId !== expectedAppId) {
    errors.push("PRIVY_APP_ID does not match FANPASS_EXPECTED_PRIVY_APP_ID");
  }
  if (!verificationKey) {
    errors.push(
      "PRIVY_VERIFICATION_KEY must be configured in the local API env file",
    );
    return;
  }
  if (!isPemPublicKey(verificationKey)) {
    errors.push(
      "PRIVY_VERIFICATION_KEY must be a PEM public key with escaped newlines in the local API env file",
    );
  }
  if (!canParsePublicKey(verificationKey)) {
    errors.push("PRIVY_VERIFICATION_KEY could not be parsed as a public key");
  }
}

function validateIosPublicConfig() {
  if (fs.existsSync(iosLocalConfigPath) && !isIgnored(iosLocalConfigPath)) {
    errors.push(
      `${relative(iosLocalConfigPath)} must be ignored by source control`,
    );
  }

  if (!iosAppId) {
    errors.push(
      "FANPASS_PRIVY_APP_ID must be provided through the environment for local iOS builds",
    );
  } else if (iosAppId !== appId) {
    errors.push(
      "FANPASS_PRIVY_APP_ID must match PRIVY_APP_ID from the local API env file",
    );
  } else if (containsProviderSecretMarker(iosAppId)) {
    errors.push("FANPASS_PRIVY_APP_ID must not contain secret-like material");
  }

  if (!appClientId) {
    errors.push(
      "FANPASS_PRIVY_APP_CLIENT_ID must be provided through the environment for local iOS builds",
    );
  } else if (!/^client-[A-Za-z0-9_-]{20,}$/.test(appClientId)) {
    errors.push("FANPASS_PRIVY_APP_CLIENT_ID must look like a Privy client id");
  } else if (containsProviderSecretMarker(appClientId)) {
    errors.push(
      "FANPASS_PRIVY_APP_CLIENT_ID must not contain secret-like material",
    );
  }

  if (!xcconfigsPlaceholderOnly()) {
    errors.push(
      "checked-in iOS xcconfig files must keep Privy app/client id values blank",
    );
  }
  if (!projectDefinesBundleIds()) {
    errors.push(
      "iOS project must keep FanPass and FanPass Ops bundle ids configured",
    );
  }
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const result = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trimStart().startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }
    result[match[1]] = stripQuotes(match[2].trim());
  }
  return result;
}

function readXcconfigFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const result = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("#include")
    ) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }
    result[match[1]] = stripQuotes(match[2].trim());
  }
  return result;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeEnvValue(value) {
  return stripQuotes(String(value).trim()).replace(/\\n/g, "\n").trim();
}

function isPemPublicKey(value) {
  return (
    value.includes("-----BEGIN PUBLIC KEY-----") &&
    value.includes("-----END PUBLIC KEY-----")
  );
}

function canParsePublicKey(value) {
  try {
    crypto.createPublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function containsProviderSecretMarker(value) {
  const normalized = String(value).toLowerCase();
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
  ].some((marker) => normalized.includes(marker));
}

function isIgnored(filePath) {
  const relativePath = relative(filePath);
  try {
    execFileSync("git", ["check-ignore", "--quiet", relativePath], {
      cwd: rootDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    const gitignore = path.join(rootDir, ".gitignore");
    if (!fs.existsSync(gitignore)) {
      return false;
    }
    const rules = fs.readFileSync(gitignore, "utf8").split(/\r?\n/);
    const basename = path.basename(filePath);
    const relativePath = relative(filePath);
    return rules.some(
      (rule) =>
        !rule.trim().startsWith("!") &&
        (rule.trim() === basename ||
          rule.trim() === relativePath ||
          (rule.trim().endsWith("/") &&
            relativePath.startsWith(rule.trim())) ||
          (rule.trim() === ".env.*" && basename.startsWith(".env."))),
    );
  }
}

function xcconfigsPlaceholderOnly() {
  const files = [
    "apps/ios/FanPass/Config/Local.xcconfig",
    "apps/ios/FanPass/Config/Staging.xcconfig",
    "apps/ios/FanPass/Config/Beta.xcconfig",
    "apps/ios/FanPass/Config/Production.xcconfig",
  ];
  return files.every((file) => {
    const absolutePath = path.join(rootDir, file);
    if (!fs.existsSync(absolutePath)) {
      return false;
    }
    const contents = fs.readFileSync(absolutePath, "utf8");
    return (
      readXcconfigValue(contents, "FANPASS_PRIVY_APP_ID") === "" &&
      readXcconfigValue(contents, "FANPASS_PRIVY_APP_CLIENT_ID") === "" &&
      !/PRIVY_VERIFICATION_KEY|PRIVY_APP_SECRET|PRIVY_ACCESS_TOKEN|eyJhbGci|BEGIN .*PRIVATE KEY/i.test(
        contents,
      )
    );
  });
}

function readXcconfigValue(contents, key) {
  const match = contents.match(new RegExp(`^${key}[ \\t]*=[ \\t]*(.*)$`, "m"));
  return match ? match[1].trim() : null;
}

function projectDefinesBundleIds() {
  const projectFile = path.join(rootDir, "apps/ios/FanPass/project.yml");
  if (!fs.existsSync(projectFile)) {
    return false;
  }
  const contents = fs.readFileSync(projectFile, "utf8");
  return (
    contents.includes("PRODUCT_BUNDLE_IDENTIFIER: fun.fanpass.app") &&
    contents.includes("PRODUCT_BUNDLE_IDENTIFIER: com.fanpass.ops") &&
    contents.includes("FanPassPrivyAppID: $(FANPASS_PRIVY_APP_ID)") &&
    contents.includes("FanPassPrivyAppClientID: $(FANPASS_PRIVY_APP_CLIENT_ID)")
  );
}

function relative(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}
