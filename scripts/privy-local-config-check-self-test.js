const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.resolve(__dirname, "privy-local-config-check.js");
const cases = [];

cases.push(runCase("accepts secret-safe local Privy config", makeFixture(), 0));

{
  const fixture = makeFixture({
    omitIosAppId: true,
    omitClientId: true,
    useLocalOverride: true,
  });
  cases.push(
    runCase("accepts ignored local iOS xcconfig override", fixture, 0),
  );
}

{
  const fixture = makeFixture({ iosAppId: "cmps_other" });
  cases.push(
    runCase("rejects mismatched iOS Privy app id injection", fixture, 1),
  );
}

{
  const fixture = makeFixture();
  fs.writeFileSync(
    path.join(fixture.root, "apps/api/.env"),
    "PRIVY_APP_ID=cmps_fixture\nPRIVY_VERIFICATION_KEY=not-a-public-key\n",
  );
  cases.push(runCase("rejects non-PEM verification key", fixture, 1));
}

{
  const fixture = makeFixture();
  fs.writeFileSync(
    path.join(fixture.root, "apps/ios/FanPass/Config/Local.xcconfig"),
    [
      "FANPASS_API_BASE_URL = https:/$()/example.invalid",
      "FANPASS_PRIVY_APP_ID =",
      "FANPASS_PRIVY_APP_CLIENT_ID = client_should_not_be_checked_in",
      "",
    ].join("\n"),
  );
  cases.push(runCase("rejects checked-in iOS Privy client id", fixture, 1));
}

{
  const fixture = makeFixture({ omitClientId: true });
  cases.push(
    runCase("rejects missing local iOS client id injection", fixture, 1),
  );
}

{
  const fixture = makeFixture({ omitIosAppId: true });
  cases.push(runCase("rejects missing local iOS app id injection", fixture, 1));
}

const ok = cases.every((testCase) => testCase.status === testCase.expected);
console.log(
  JSON.stringify(
    {
      ok,
      cases: cases.map(({ label, expected, status }) => ({
        label,
        expected: expected === 0 ? "pass" : "fail",
        status,
      })),
    },
    null,
    2,
  ),
);
process.exit(ok ? 0 : 1);

function runCase(label, fixture, expected) {
  const env = {
    ...process.env,
    FANPASS_PRIVY_LOCAL_CONFIG_ROOT: fixture.root,
    FANPASS_EXPECTED_PRIVY_APP_ID: "cmps_fixture",
    FANPASS_PRIVY_APP_ID: fixture.iosAppId ?? "cmps_fixture",
  };
  if (fixture.omitIosAppId) {
    delete env.FANPASS_PRIVY_APP_ID;
  }
  if (!fixture.omitClientId) {
    env.FANPASS_PRIVY_APP_CLIENT_ID = "client-fixturePublicValue1234567890";
  } else {
    delete env.FANPASS_PRIVY_APP_CLIENT_ID;
  }
  const result = spawnSync(process.execPath, [script], {
    cwd: fixture.root,
    env,
    encoding: "utf8",
  });
  return { label, expected, status: result.status };
}

function makeFixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fanpass-privy-local-"));
  mkdirp(path.join(root, "apps/api"));
  mkdirp(path.join(root, "apps/ios/FanPass/Config"));
  mkdirp(path.join(root, "apps/ios/FanPass"));

  fs.writeFileSync(
    rootPath(root, ".gitignore"),
    ".env\n.env.*\n!.env.example\napps/ios/FanPass/Config/LocalSecrets.xcconfig\n",
  );

  const { publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const pem = publicKey.export({ type: "spki", format: "pem" }).trim();
  fs.writeFileSync(
    rootPath(root, "apps/api/.env"),
    [
      "PRIVY_APP_ID=cmps_fixture",
      `PRIVY_VERIFICATION_KEY=\"${pem.replace(/\n/g, "\\n")}\"`,
      "",
    ].join("\n"),
  );

  for (const file of [
    "Local.xcconfig",
    "Staging.xcconfig",
    "Beta.xcconfig",
    "Production.xcconfig",
  ]) {
    fs.writeFileSync(
      rootPath(root, `apps/ios/FanPass/Config/${file}`),
      [
        "FANPASS_API_BASE_URL = https:/$()/example.invalid",
        "FANPASS_PRIVY_APP_ID =",
        "FANPASS_PRIVY_APP_CLIENT_ID =",
        '#include? "LocalSecrets.xcconfig"',
        "",
      ].join("\n"),
    );
  }

  if (options.useLocalOverride) {
    fs.writeFileSync(
      rootPath(root, "apps/ios/FanPass/Config/LocalSecrets.xcconfig"),
      [
        "FANPASS_PRIVY_APP_ID = cmps_fixture",
        "FANPASS_PRIVY_APP_CLIENT_ID = client-fixturePublicValue1234567890",
        "",
      ].join("\n"),
    );
  }

  fs.writeFileSync(
    rootPath(root, "apps/ios/FanPass/project.yml"),
    [
      "targets:",
      "  FanPass:",
      "    settings:",
      "      PRODUCT_BUNDLE_IDENTIFIER: fun.fanpass.app",
      "    info:",
      "      properties:",
      "        FanPassPrivyAppID: $(FANPASS_PRIVY_APP_ID)",
      "        FanPassPrivyAppClientID: $(FANPASS_PRIVY_APP_CLIENT_ID)",
      "  FanPassOps:",
      "    settings:",
      "      PRODUCT_BUNDLE_IDENTIFIER: com.fanpass.ops",
      "    info:",
      "      properties:",
      "        FanPassPrivyAppID: $(FANPASS_PRIVY_APP_ID)",
      "        FanPassPrivyAppClientID: $(FANPASS_PRIVY_APP_CLIENT_ID)",
      "",
    ].join("\n"),
  );

  return {
    root,
    iosAppId: options.iosAppId,
    omitClientId: options.omitClientId === true,
    omitIosAppId: options.omitIosAppId === true,
  };
}

function mkdirp(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function rootPath(root, relativePath) {
  return path.join(root, relativePath);
}
