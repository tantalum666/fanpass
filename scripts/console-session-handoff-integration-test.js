const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const dashboardEntry = path.join(
  rootDir,
  "apps/dashboard/dist/server/console-bff.js",
);
const fixtureAccessToken = "fixture-console-access-token";

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Console handoff integration test failed",
    }),
  );
  process.exitCode = 1;
});

async function main() {
  const api = await startMockApi();
  const consolePort = await availablePort();
  const authOrigin = "https://auth.example.test";
  const consoleOrigin = `http://127.0.0.1:${consolePort}`;
  const child = spawn(process.execPath, [dashboardEntry], {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      FANPASS_ENV: "staging",
      FANPASS_API_BASE_URL: api.origin,
      FANPASS_CONSOLE_AUTH_ORIGIN: authOrigin,
      FANPASS_CONSOLE_ORIGIN: consoleOrigin,
      FANPASS_CONSOLE_ORIGINS: authOrigin,
      FANPASS_CONSOLE_PORT: String(consolePort),
      PORT: String(consolePort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let childOutput = "";
  child.stdout.on("data", (chunk) => {
    childOutput = appendBounded(childOutput, chunk);
  });
  child.stderr.on("data", (chunk) => {
    childOutput = appendBounded(childOutput, chunk);
  });

  try {
    const startResponse = await fetchWithRetry(
      `${consoleOrigin}/api/console/privy-handoff`,
      { redirect: "manual" },
      child,
    );
    assertEqual(startResponse.status, 303, "handoff start status");
    const location = requiredHeader(startResponse, "location");
    const authUrl = new URL(location);
    assertEqual(authUrl.origin, authOrigin, "handoff auth origin");
    assertEqual(authUrl.pathname, "/", "handoff auth path");
    const handoffState = authUrl.searchParams.get("handoff") ?? "";
    assert(
      /^[A-Za-z0-9_-]{43}$/.test(handoffState),
      "handoff state must be a 32-byte base64url nonce",
    );

    const startCookies = startResponse.headers.getSetCookie();
    assertEqual(startCookies.length, 1, "handoff start cookie count");
    const handoffCookie = startCookies[0];
    assertCookieAttribute(
      handoffCookie,
      "__Host-fanpass_console_handoff=",
    );
    assertCookieAttribute(handoffCookie, "HttpOnly");
    assertCookieAttribute(handoffCookie, "SameSite=None");
    assertCookieAttribute(handoffCookie, "Secure");
    assertCookieAttribute(handoffCookie, "Path=/");
    assertCookieAttribute(handoffCookie, "Max-Age=300");
    const handoffCookiePair = handoffCookie.split(";", 1)[0];

    const missingStateResponse = await postForm(
      consoleOrigin,
      handoffCookiePair,
      "",
      "null",
    );
    assertEqual(
      missingStateResponse.status,
      303,
      "missing handoff state status",
    );
    assertEqual(
      requiredHeader(missingStateResponse, "location"),
      "/?auth=handoff",
      "missing handoff state redirect",
    );
    assert(
      !hasSessionCookie(missingStateResponse),
      "missing handoff state must not create a session",
    );

    const invalidJsonResponse = await fetch(
      `${consoleOrigin}/api/console/privy-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://untrusted.example.test",
        },
        body: JSON.stringify({ accessToken: fixtureAccessToken }),
        redirect: "manual",
      },
    );
    assertEqual(invalidJsonResponse.status, 403, "invalid JSON origin status");
    assert(
      !hasSessionCookie(invalidJsonResponse),
      "invalid JSON origin must not create a session",
    );

    const expiredStart = await startHandoff(consoleOrigin);
    const expiredResponse = await postForm(
      consoleOrigin,
      expiredStart.cookie,
      expiredStart.state,
      "null",
      { accessToken: "expired-fixture-access-token" },
    );
    const refreshHandoff = recoveryHandoff(expiredResponse, authOrigin, "refresh");
    assert(
      !hasSessionCookie(expiredResponse),
      "expired token must not create a session",
    );

    const refreshResponse = await postForm(
      consoleOrigin,
      refreshHandoff.cookie,
      refreshHandoff.state,
      "null",
      {
        accessToken: "expired-fixture-access-token",
        recovery: "refresh",
      },
    );
    const reauthHandoff = recoveryHandoff(refreshResponse, authOrigin, "reauth");
    assert(
      !hasSessionCookie(refreshResponse),
      "failed refresh must not create a session",
    );

    const reauthResponse = await postForm(
      consoleOrigin,
      reauthHandoff.cookie,
      reauthHandoff.state,
      "null",
      {
        accessToken: "expired-fixture-access-token",
        recovery: "reauth",
      },
    );
    assertEqual(reauthResponse.status, 303, "failed re-authentication status");
    assertEqual(
      requiredHeader(reauthResponse, "location"),
      "/?auth=session",
      "failed re-authentication redirect",
    );
    assert(
      !hasSessionCookie(reauthResponse),
      "failed re-authentication must not create a session",
    );

    const formResponse = await postForm(
      consoleOrigin,
      handoffCookiePair,
      handoffState,
      "null",
    );
    assertEqual(formResponse.status, 303, "valid handoff status");
    assertEqual(
      requiredHeader(formResponse, "location"),
      "/",
      "valid handoff redirect",
    );
    const sessionCookies = formResponse.headers.getSetCookie();
    assert(
      sessionCookies.some(
        (cookie) =>
          cookie.startsWith("__Host-fanpass_console_handoff=") &&
          cookie.includes("Max-Age=0"),
      ),
      "valid handoff must consume its short-lived state cookie",
    );
    assert(
      sessionCookies.some(
        (cookie) =>
          cookie.startsWith("fanpass_console_access_token=") &&
          cookie.includes("HttpOnly") &&
          cookie.includes("SameSite=Lax") &&
          cookie.includes("Secure"),
      ),
      "valid handoff must create the host Console session cookie",
    );

    const validJsonResponse = await fetch(
      `${consoleOrigin}/api/console/privy-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: authOrigin,
        },
        body: JSON.stringify({ accessToken: fixtureAccessToken }),
        redirect: "manual",
      },
    );
    assertEqual(validJsonResponse.status, 200, "valid JSON origin status");
    assert(
      hasSessionCookie(validJsonResponse),
      "valid JSON origin must retain the supported session path",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks: [
            "short-lived host-only HttpOnly handoff cookie",
            "cryptographically random handoff state",
            "missing state rejected without session",
            "invalid JSON origin rejected",
            "expired token gets one refresh then explicit re-authentication",
            "bounded recovery never creates a session from a rejected token",
            "opaque-origin form accepted only with matching state cookie",
            "handoff state consumed on success",
            "exact-origin JSON client retained",
          ],
          sensitiveValuesPrinted: false,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (child.exitCode !== null && childOutput) {
      throw new Error(
        `Console BFF exited during handoff integration test: ${childOutput.trim()}`,
      );
    }
    throw error;
  } finally {
    child.kill("SIGTERM");
    await Promise.allSettled([waitForExit(child), closeServer(api.server)]);
  }
}

async function postForm(
  consoleOrigin,
  cookie,
  handoffState,
  origin,
  { accessToken = fixtureAccessToken, recovery = "" } = {},
) {
  return fetch(`${consoleOrigin}/api/console/privy-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
      Origin: origin,
    },
    body: new URLSearchParams({
      accessToken,
      handoff: "top-level",
      handoffState,
      recovery,
    }),
    redirect: "manual",
  });
}

async function startHandoff(consoleOrigin) {
  const response = await fetch(`${consoleOrigin}/api/console/privy-handoff`, {
    redirect: "manual",
  });
  assertEqual(response.status, 303, "recovery handoff start status");
  const location = requiredHeader(response, "location");
  const authUrl = new URL(location);
  const state = authUrl.searchParams.get("handoff") ?? "";
  assert(
    /^[A-Za-z0-9_-]{43}$/.test(state),
    "recovery handoff state must be a 32-byte base64url nonce",
  );
  const cookie = response.headers.getSetCookie()[0]?.split(";", 1)[0] ?? "";
  assert(
    cookie.startsWith("__Host-fanpass_console_handoff="),
    "recovery handoff must set its host-only state cookie",
  );
  return { state, cookie };
}

function recoveryHandoff(response, authOrigin, expectedMode) {
  assertEqual(response.status, 303, `${expectedMode} recovery status`);
  const location = requiredHeader(response, "location");
  const authUrl = new URL(location);
  assertEqual(authUrl.origin, authOrigin, `${expectedMode} recovery origin`);
  assertEqual(
    authUrl.searchParams.get("recovery"),
    expectedMode,
    `${expectedMode} recovery mode`,
  );
  const state = authUrl.searchParams.get("handoff") ?? "";
  assert(
    /^[A-Za-z0-9_-]{43}$/.test(state),
    `${expectedMode} recovery must rotate the handoff state`,
  );
  const stateCookie = response.headers
    .getSetCookie()
    .find((cookie) =>
      cookie.startsWith("__Host-fanpass_console_handoff="),
    );
  assert(Boolean(stateCookie), `${expectedMode} recovery cookie is required`);
  assertCookieAttribute(stateCookie, "HttpOnly");
  assertCookieAttribute(stateCookie, "SameSite=None");
  assertCookieAttribute(stateCookie, "Secure");
  assertCookieAttribute(stateCookie, "Max-Age=300");
  return { state, cookie: stateCookie.split(";", 1)[0] };
}

async function startMockApi() {
  const server = createServer((request, response) => {
    if (
      request.method === "POST" &&
      request.url === "/auth/privy/sync" &&
      request.headers.authorization === `Bearer ${fixtureAccessToken}`
    ) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          userId: "fixture-user",
          displayName: "Fixture Organizer",
          email: "fixture@example.invalid",
          role: "ORGANIZER",
          walletAddress: null,
          authProvider: "privy",
          privyId: "fixture-privy",
          created: false,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }),
      );
      return;
    }
    response.writeHead(401, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: "Unauthorized fixture request" }));
  });
  const port = await listenOnAvailablePort(server);
  return { server, origin: `http://127.0.0.1:${port}` };
}

async function availablePort() {
  const server = createServer();
  const port = await listenOnAvailablePort(server);
  await closeServer(server);
  return port;
}

function listenOnAvailablePort(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a local test port"));
        return;
      }
      resolve(address.port);
    });
  });
}

async function fetchWithRetry(url, options, child) {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error("Console BFF exited before accepting requests");
    }
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      await delay(50);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Console BFF did not start");
}

function hasSessionCookie(response) {
  return response.headers
    .getSetCookie()
    .some((cookie) => cookie.startsWith("fanpass_console_access_token="));
}

function requiredHeader(response, name) {
  const value = response.headers.get(name);
  assert(Boolean(value), `${name} response header is required`);
  return value;
}

function assertCookieAttribute(cookie, expected) {
  assert(cookie.includes(expected), `handoff cookie must include ${expected}`);
}

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label} must equal ${expected}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function appendBounded(current, chunk) {
  return `${current}${String(chunk)}`.slice(-4_096);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function waitForExit(child) {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => child.once("exit", resolve));
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}
