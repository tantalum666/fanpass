import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeConfig, RuntimeConfigError } from "./config.js";

const appId = "fanpass_test_app_12345";
const consoleUrl = "https://console.example.com";
const bridgeUrl = `${consoleUrl}/api/console/privy-session`;

test("accepts an HTTPS production-like runtime configuration", () => {
  const config = loadRuntimeConfig({
    FANPASS_ENV: "staging",
    FANPASS_PRIVY_APP_ID: appId,
    FANPASS_CONSOLE_URL: consoleUrl,
    FANPASS_CONSOLE_SESSION_BRIDGE_URL: bridgeUrl,
  });

  assert.equal(config.productionLike, true);
  assert.equal(config.consoleUrl, consoleUrl);
  assert.equal(config.sessionBridgeUrl, bridgeUrl);
  assert.deepEqual(config.legacyEnvironmentNames, []);
  assert.equal(config.privySessionMode, "browser-sdk");
});

test("accepts legacy public names only as a migration fallback", () => {
  const config = loadRuntimeConfig({
    FANPASS_ENV: "staging",
    NEXT_PUBLIC_PRIVY_APP_ID: appId,
    NEXT_PUBLIC_FANPASS_CONSOLE_URL: consoleUrl,
    NEXT_PUBLIC_FANPASS_CONSOLE_SESSION_BRIDGE_URL: bridgeUrl,
  });

  assert.deepEqual(config.legacyEnvironmentNames.sort(), [
    "NEXT_PUBLIC_FANPASS_CONSOLE_SESSION_BRIDGE_URL",
    "NEXT_PUBLIC_FANPASS_CONSOLE_URL",
    "NEXT_PUBLIC_PRIVY_APP_ID",
  ]);
});

test("infers staging from Render metadata during environment migration", () => {
  const config = loadRuntimeConfig({
    NODE_ENV: "production",
    RENDER_SERVICE_NAME: "fanpass-console-auth-staging",
    NEXT_PUBLIC_PRIVY_APP_ID: appId,
    NEXT_PUBLIC_FANPASS_CONSOLE_URL: consoleUrl,
    NEXT_PUBLIC_FANPASS_CONSOLE_SESSION_BRIDGE_URL: bridgeUrl,
  });

  assert.equal(config.environment, "staging");
  assert.equal(config.privySessionMode, "browser-sdk");
});

test("allows loopback HTTP only for local development", () => {
  const config = loadRuntimeConfig({
    FANPASS_ENV: "development",
    FANPASS_PRIVY_APP_ID: appId,
  });

  assert.equal(config.consoleUrl, "http://localhost:3000");
});

test("requires Privy HttpOnly cookie mode for production", () => {
  const config = loadRuntimeConfig({
    FANPASS_ENV: "production",
    FANPASS_PRIVY_APP_ID: appId,
    FANPASS_PRIVY_SESSION_MODE: "httponly-cookie",
    FANPASS_CONSOLE_URL: consoleUrl,
    FANPASS_CONSOLE_SESSION_BRIDGE_URL: bridgeUrl,
  });

  assert.equal(config.privySessionMode, "httponly-cookie");
});

test("does not infer staging for an unrecognized Render production service", () => {
  assert.throws(
    () =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        RENDER_SERVICE_NAME: "fanpass-console-auth-production",
        FANPASS_PRIVY_APP_ID: appId,
        FANPASS_CONSOLE_URL: consoleUrl,
        FANPASS_CONSOLE_SESSION_BRIDGE_URL: bridgeUrl,
      }),
    (error: unknown) =>
      error instanceof RuntimeConfigError &&
      error.message.includes("must use Privy HttpOnly cookie mode"),
  );
});

for (const [label, env, message] of [
  [
    "production browser SDK storage",
    {
      FANPASS_ENV: "production",
      FANPASS_PRIVY_APP_ID: appId,
      FANPASS_PRIVY_SESSION_MODE: "browser-sdk",
      FANPASS_CONSOLE_URL: consoleUrl,
      FANPASS_CONSOLE_SESSION_BRIDGE_URL: bridgeUrl,
    },
    "must use Privy HttpOnly cookie mode",
  ],
  [
    "missing app id",
    {
      FANPASS_ENV: "staging",
      FANPASS_CONSOLE_URL: consoleUrl,
      FANPASS_CONSOLE_SESSION_BRIDGE_URL: bridgeUrl,
    },
    "FANPASS_PRIVY_APP_ID",
  ],
  [
    "non-HTTPS staging URL",
    {
      FANPASS_ENV: "staging",
      FANPASS_PRIVY_APP_ID: appId,
      FANPASS_CONSOLE_URL: "http://localhost:3000",
      FANPASS_CONSOLE_SESSION_BRIDGE_URL:
        "http://localhost:3000/api/console/privy-session",
    },
    "must use HTTPS",
  ],
  [
    "cross-origin session bridge",
    {
      FANPASS_ENV: "staging",
      FANPASS_PRIVY_APP_ID: appId,
      FANPASS_CONSOLE_URL: consoleUrl,
      FANPASS_CONSOLE_SESSION_BRIDGE_URL:
        "https://other.example.com/api/console/privy-session",
    },
    "same configured origin",
  ],
  [
    "wrong bridge path",
    {
      FANPASS_ENV: "staging",
      FANPASS_PRIVY_APP_ID: appId,
      FANPASS_CONSOLE_URL: consoleUrl,
      FANPASS_CONSOLE_SESSION_BRIDGE_URL: `${consoleUrl}/api/session`,
    },
    "exact Console Privy session route",
  ],
] as const) {
  test(`rejects ${label}`, () => {
    assert.throws(
      () => loadRuntimeConfig(env),
      (error: unknown) =>
        error instanceof RuntimeConfigError && error.message.includes(message),
    );
  });
}
