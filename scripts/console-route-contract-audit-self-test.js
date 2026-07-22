const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  renderBetaFoundationGateStepsFixture,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/console-route-contract-audit.js",
);

const cases = [
  {
    label: "accepts documented Console BFF and auth-helper contracts",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects missing Console BFF",
    expected: "fail",
    mutate: (fixtureRoot) =>
      fs.rmSync(
        path.join(fixtureRoot, "apps/dashboard/server/console-bff.ts"),
        {
          force: true,
        },
      ),
  },
  {
    label: "rejects legacy Next route handlers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/app/api/console/debug/route.ts",
        "export async function POST() { return Response.json({ ok: true }); }\n",
      ),
  },
  {
    label: "rejects session bridge without organizer/admin role gate",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace(
          'session.role !== "ORGANIZER" && session.role !== "ADMIN"',
          'session.role !== "ORGANIZER"',
        ),
      ),
  },
  {
    label: "rejects session bridge leaking sensitive session fields",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace(
          "expiresAt: session.expiresAt,",
          "expiresAt: session.expiresAt,\n    email: session.email,",
        ),
      ),
  },
  {
    label: "rejects handoff integration without observed HttpOnly cookie proof",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureFile(
        fixtureRoot,
        "scripts/console-session-handoff-integration-test.js",
        '    assertCookieAttribute(handoffCookie, "HttpOnly");\n',
        "",
      ),
  },
  {
    label: "rejects handoff integration without a rejected-session outcome",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceAllFixtureFile(
        fixtureRoot,
        "scripts/console-session-handoff-integration-test.js",
        "!hasSessionCookie(",
        "hasSessionCookie(",
      ),
  },
  {
    label:
      "rejects production session bridge without Privy HttpOnly cookie input",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace(
          "privyCookieAccessToken(request.headers.cookie)",
          "null",
        ),
      ),
  },
  {
    label: "rejects session bridge without mutation origin guard",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replaceAll(
          "assertConsoleMutationOrigin(originRequest)",
          "",
        ),
      ),
  },
  {
    label: "rejects session bridge without first-party form handoff parsing",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace(
          "readPrivySessionBody(request)",
          "readJsonBody(request)",
        ),
      ),
  },
  {
    label: "rejects session bridge without one-time handoff state validation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace("assertConsoleSessionHandoff(", "noop("),
      ),
  },
  {
    label: "rejects handoff start without a short-lived Console cookie",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace("consoleHandoffCookie(state)", '""'),
      ),
  },
  {
    label: "rejects session bridge without a post-cookie 303 redirect",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace('sendRedirect(response, 303, "/")', "undefined"),
      ),
  },
  {
    label: "rejects gate assignment proxy without Console access token",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replaceAll(
          "const accessToken = await consoleAccessToken(cookieSource(request));",
          'const accessToken = "fixture";',
        ),
      ),
  },
  {
    label: "rejects gate assignment proxy raw upstream response forwarding",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace(
          "assignment: redactConsoleGateAssignmentResponse(payload),",
          "assignment: payload,",
        ),
      ),
  },
  {
    label: "rejects invite rotation without encoded assignment id",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace(
          "${encodeURIComponent(normalizedAssignmentId)}/invites",
          "${normalizedAssignmentId}/invites",
        ),
      ),
  },
  {
    label: "rejects a missing gate assignment deactivation route",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace(
          "handleDeactivateGateAssignment(request, response, deactivateMatch[1])",
          "undefined",
        ),
      ),
  },
  {
    label: "rejects helper with ambient process-wide Console access token",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/lib/console-auth.ts",
        consoleAuthHelper({ includeConfiguredAccessToken: true }),
      ),
  },
  {
    label: "rejects a BFF handler with an ambient Console access token",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replace(
          "const accessToken = await consoleAccessToken(cookieSource(request));",
          "const accessToken = process.env.FANPASS_CONSOLE_ACCESS_TOKEN;",
        ),
      ),
  },
  {
    label: "rejects ambient Console access tokens in a sibling server helper",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/ambient-token.ts",
        "export const token = process.env.FANPASS_CONSOLE_ACCESS_TOKEN;\n",
      ),
  },
  {
    label: "rejects missing process-level handoff integration command",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "package.json",
        JSON.stringify({ scripts: {} }, null, 2),
      ),
  },
  {
    label: "rejects Console handoff gate before the Console build",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        consoleGateFixture({ reversed: true }),
      ),
  },
  {
    label: "rejects a comment-only Console handoff gate decoy",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        `${renderBetaFoundationGateStepsFixture([consoleBuildGate()])}// npmStep("Console session handoff integration", "run", "security:console-session-handoff:integration");\n`,
      ),
  },
  {
    label: "rejects helper that allows demo auth before production block",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/lib/console-auth.ts",
        consoleAuthHelper({ demoBeforeProduction: true }),
      ),
  },
  {
    label: "rejects public client-exposed Console token config",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/lib/console-auth.ts",
        consoleAuthHelper({ includePublicTokenEnv: true }),
      ),
  },
  {
    label: "rejects Console login component without session bridge fetch",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/src/ConsoleApp.tsx",
        consoleLoginComponent().replace(
          'fetch("/api/console/privy-session", {',
          'fetch("/api/debug-session", {',
        ),
      ),
  },
  {
    label: "rejects a same-origin Console auth link guard regression",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/src/ConsoleApp.tsx",
        consoleLoginComponent().replace(
          "authUrl.origin === window.location.origin",
          "false",
        ),
      ),
  },
  {
    label: "rejects Console login bypassing the secure handoff start",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/src/ConsoleApp.tsx",
        consoleLoginComponent().replace(
          'href="/api/console/privy-handoff"',
          "href={consoleAuthUrl}",
        ),
      ),
  },
  {
    label: "rejects Console login component storing tokens",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/src/ConsoleApp.tsx",
        consoleLoginComponent().replace(
          'setAccessToken("");',
          'localStorage.setItem("fanpass_console_access_token", token);',
        ),
      ),
  },
  {
    label: "rejects Console login component importing Privy React SDK directly",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/src/ConsoleApp.tsx",
        consoleLoginComponent().replace(
          'import { FormEvent, useState } from "react";',
          'import { FormEvent, useState } from "react";\nimport { usePrivy } from "@privy-io/react-auth";',
        ),
      ),
  },
  {
    label: "rejects Next dependency returning to dashboard package",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/package.json",
        JSON.stringify(
          {
            dependencies: {
              next: "15.3.2",
            },
          },
          null,
          2,
        ),
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-console-route-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_CONSOLE_ROUTE_AUDIT_ROOT: fixtureRoot,
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
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
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
  writeFixtureFile(
    fixtureRoot,
    "package.json",
    JSON.stringify(
      {
        scripts: {
          "security:console-session-handoff:integration":
            "node scripts/console-session-handoff-integration-test.js",
        },
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.js",
    consoleGateFixture(),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/console-session-handoff-integration-test.js",
    fs.readFileSync(
      path.join(rootDir, "scripts/console-session-handoff-integration-test.js"),
      "utf8",
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/server/console-bff.ts",
    consoleBff(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/lib/console-auth.ts",
    consoleAuthHelper(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/lib/gate-assignment-response.ts",
    gateAssignmentRedactor(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/src/ConsoleApp.tsx",
    consoleLoginComponent(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/package.json",
    JSON.stringify({ dependencies: { react: "19.1.0" } }, null, 2),
  );
}

function consoleGateFixture(options = {}) {
  const steps = [consoleBuildGate(), consoleHandoffGate()];
  if (options.reversed) {
    steps.reverse();
  }
  return renderBetaFoundationGateStepsFixture(steps);
}

function consoleBuildGate() {
  return {
    label: "Console production build",
    kind: "npm",
    args: ["run", "build", "-w", "apps/dashboard"],
  };
}

function consoleHandoffGate() {
  return {
    label: "Console session handoff integration",
    kind: "npm",
    args: ["run", "security:console-session-handoff:integration"],
  };
}

function consoleLoginComponent() {
  return `
import { FormEvent, useState } from "react";

export function ConsoleLoginForm({ onSessionReady }: { onSessionReady: () => Promise<void> }) {
  const [accessToken, setAccessToken] = useState("");
  const consoleAuthUrl = safeConsoleAuthUrl("https://auth.example.test");

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = accessToken.trim();
    setAccessToken("");
    const response = await fetch("/api/console/privy-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token }),
      cache: "no-store",
    });
    if (response.ok) {
      await onSessionReady();
    }
  }

  return consoleAuthUrl ? <><a href="/api/console/privy-handoff">Continue with Privy</a><form onSubmit={submitSession} /></> : <p>Privy sign-in is temporarily unavailable.</p>;
}

function consoleAuthFailureMessage() {
  const reason = new URLSearchParams(window.location.search).get("auth");
  if (reason === "service") return "Authentication service unavailable";
  if (reason === "session") return "Session verification failed";
  if (reason === "rate") return "Authentication rate limited";
  return "";
}

function safeConsoleAuthUrl(configuredUrl: string) {
  const authUrl = new URL(configuredUrl, window.location.origin);
  return authUrl.origin === window.location.origin ? "" : authUrl.toString();
}
`;
}

function consoleBff() {
  return `
import { createServer } from "node:http";
import {
  API_BASE_URL,
  CONSOLE_ACCESS_TOKEN_COOKIE,
  ConsoleMutationOriginError,
  ConsoleSessionHandoffError,
  assertConsoleMutationOrigin,
  assertConsoleSessionHandoff,
  clearConsoleHandoffCookie,
  clearConsoleSessionCookie,
  consoleAccessToken,
  consoleAuthHandoffUrl,
  consoleHandoffCookie,
  consoleMutationCorsHeaders,
  consoleSessionCookie,
  createConsoleHandoffState,
  privyCookieAccessToken,
} from "../lib/console-auth.js";
import { redactConsoleGateAssignmentResponse } from "../lib/gate-assignment-response.js";

createServer(async (request, response) => {
  console.log(JSON.stringify({ runtime: "vite-node-bff" }));
});

async function routeRequest(request, response, pathname, method) {
  if (pathname === "/api/console/privy-handoff" && method === "GET") {
    return handlePrivyHandoffStart(response);
  }
  if (pathname === "/api/console/privy-session") {
    if (method === "POST") return handlePrivySessionPost(request, response);
    if (method === "DELETE") return handlePrivySessionDelete(request, response);
    if (method === "OPTIONS") return handlePrivySessionOptions(request, response);
  }
  if (pathname === "/api/console/operations") return handleOperations(request, response);
  if (pathname === "/api/console/events") return handleCreateEvent(request, response);
  if (pathname === "/api/console/gate-assignments") return handleCreateGateAssignment(request, response);
  return handleCreateTicketType(request, response, ticketTypeMatch[1]) ||
    handleSaveFanCampaign(request, response, fanCampaignMatch[1]) ||
    handleReviewFanSubmission(request, response, fanSubmissionMatch[1]) ||
    handleCreateGateAssignment(request, response) ||
    handleRotateInvite(request, response, inviteMatch[1]) ||
    handleDeactivateGateAssignment(request, response, deactivateMatch[1]);
}

async function handleSaveFanCampaign(request, response, eventIdParam) {
  const originRequest = requestToFetchRequest(request);
  assertConsoleMutationOrigin(originRequest);
  return apiPost(\`/fan-access/events/\${encodeURIComponent(eventIdParam)}/campaign\`, {}, request);
}

async function handleReviewFanSubmission(request, response, submissionIdParam) {
  const originRequest = requestToFetchRequest(request);
  assertConsoleMutationOrigin(originRequest);
  return apiPost(\`/fan-access/submissions/\${encodeURIComponent(submissionIdParam)}/decision\`, {}, request);
}

function handlePrivyHandoffStart(response) {
  const state = createConsoleHandoffState();
  const authUrl = consoleAuthHandoffUrl(state);
  response.setHeader("Set-Cookie", consoleHandoffCookie(state));
  return sendRedirect(response, 303, authUrl);
}

async function handlePrivySessionPost(request, response) {
  const originRequest = requestToFetchRequest(request);
  const corsHeaders = consoleMutationCorsHeaders(originRequest);
  const body = await readPrivySessionBody(request);
  const topLevelHandoff =
    requestContentType(request) === "application/x-www-form-urlencoded" &&
    body?.handoff === "top-level";
  const recoveryMode = readConsoleAuthRecoveryMode(body?.recovery);
  if (topLevelHandoff) {
    assertConsoleSessionHandoff(request.headers.cookie, body?.handoffState);
  } else {
    assertConsoleMutationOrigin(originRequest);
  }
  const accessToken = privyCookieAccessToken(request.headers.cookie) ?? "fixture-access-token";
  const upstream = await fetch(\`\${API_BASE_URL}/auth/privy/sync\`, { cache: "no-store" });
  const session = await upstream.json();
  if (!upstream.ok) return sendPrivySessionRecovery(response, recoveryMode);
  if (session.role !== "ORGANIZER" && session.role !== "ADMIN") {
    return sendJson(response, 403, { ok: false });
  }
  response.setHeader("Set-Cookie", [clearConsoleHandoffCookie(), consoleSessionCookie(accessToken, session.expiresAt)]);
  if (topLevelHandoff) return sendRedirect(response, 303, "/");
  return sendJson(response, 200, {
    ok: true,
    userId: session.userId,
    displayName: session.displayName,
    role: session.role,
    expiresAt: session.expiresAt,
  });
}

function sendPrivySessionFailure(response, topLevelHandoff, status, message, reason = "failed") {
  if (topLevelHandoff) return sendRedirect(response, 303, "/?auth=" + reason);
  return sendJson(response, status, { ok: false, message });
}

function sendPrivySessionRecovery(response, currentMode) {
  if (currentMode === "reauth") return sendPrivySessionFailure(response, true, 401, "rejected", "session");
  const nextMode = currentMode === "refresh" ? "reauth" : "refresh";
  const state = createConsoleHandoffState();
  const authUrl = consoleAuthHandoffUrl(state, nextMode);
  response.setHeader("Set-Cookie", consoleHandoffCookie(state));
  return sendRedirect(response, 303, authUrl);
}

function readConsoleAuthRecoveryMode(value) {
  return value === "refresh" || value === "reauth" ? value : null;
}

const MAX_REQUEST_BODY_BYTES = 64 * 1024;
function readPrivySessionBody() { return { handoff: "top-level", handoffState: "fixture", recovery: "refresh" }; }
function requestContentType() { return "application/x-www-form-urlencoded"; }

function handlePrivySessionDelete(request, response) {
  const originRequest = requestToFetchRequest(request);
  const corsHeaders = consoleMutationCorsHeaders(originRequest);
  assertConsoleMutationOrigin(originRequest);
  response.setHeader("Set-Cookie", clearConsoleSessionCookie());
}

function handlePrivySessionOptions(request, response) {
  const originRequest = requestToFetchRequest(request);
  const corsHeaders = consoleMutationCorsHeaders(originRequest);
  assertConsoleMutationOrigin(originRequest);
}

async function handleCreateGateAssignment(request, response) {
  const originRequest = requestToFetchRequest(request);
  assertConsoleMutationOrigin(originRequest);
  const eventId = "evt_fixture";
  const gate = "A1";
  const staffName = "Fixture Staff";
  const staffEmail = "fixture.staff@example.invalid";
  if (!eventId || !gate || !staffName || !staffEmail) return;
  const accessToken = await consoleAccessToken(cookieSource(request));
  const upstream = await fetch(\`\${API_BASE_URL}/alpha/gate-assignments\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${accessToken}\`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const payload = await upstream.json();
  return sendJson(response, 200, {
    ok: true,
    assignment: redactConsoleGateAssignmentResponse(payload),
  });
}

async function handleRotateInvite(request, response, assignmentIdParam) {
  const originRequest = requestToFetchRequest(request);
  assertConsoleMutationOrigin(originRequest);
  const normalizedAssignmentId = assignmentIdParam.trim();
  const accessToken = await consoleAccessToken(cookieSource(request));
  const upstream = await fetch(\`\${API_BASE_URL}/alpha/gate-assignments/\${encodeURIComponent(normalizedAssignmentId)}/invites\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${accessToken}\`,
    },
    cache: "no-store",
  });
  const payload = await upstream.json();
  return sendJson(response, 200, {
    ok: true,
    assignment: redactConsoleGateAssignmentResponse(payload),
  });
}

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  response.setHeader("Content-Security-Policy", "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'");
}
`;
}

function consoleAuthHelper(options = {}) {
  const publicTokenEnv = options.includePublicTokenEnv
    ? "\nconst leaked = process.env.NEXT_PUBLIC_CONSOLE_ACCESS_TOKEN;\n"
    : "";
  const configuredToken = options.includeConfiguredAccessToken
    ? [
        "const configuredAccessToken = process.env.FANPASS_CONSOLE_ACCESS_TOKEN ?? null;",
        "",
      ].join("\n")
    : "";
  const configuredTokenBranch = options.includeConfiguredAccessToken
    ? [
        "  if (configuredAccessToken) {",
        "    return configuredAccessToken;",
        "  }",
      ].join("\n") + "\n"
    : "";
  const productionBlock = [
    "  if (isProductionLikeConsole()) {",
    "    throw new ConsoleAuthRequiredError()",
    "  }",
    "",
  ].join("\n");
  const demoFallback = [
    "  const response = await fetch(`${API_BASE_URL}/auth/demo-session`, {",
    '    cache: "no-store",',
    "  });",
    "  return response.text();",
    "",
  ].join("\n");
  return `
import { randomBytes, timingSafeEqual } from "node:crypto";
const API_BASE_URL = "http://fixture";
export const CONSOLE_ACCESS_TOKEN_COOKIE = "fanpass_console_access_token";
export const PRIVY_ACCESS_TOKEN_COOKIE = "privy-token";
const CONSOLE_HANDOFF_COOKIE = "fanpass_console_handoff";
const CONSOLE_HANDOFF_HOST_COOKIE = "__Host-fanpass_console_handoff";
const CONSOLE_HANDOFF_MAX_AGE_SECONDS = 5 * 60;
export type ConsoleAuthRecoveryMode = "refresh" | "reauth";
${configuredToken}
${publicTokenEnv}
export class ConsoleAuthRequiredError extends Error {}
export class ConsoleMutationOriginError extends Error {}
export class ConsoleSessionHandoffError extends Error {}

export async function consoleAccessToken(source) {
${configuredTokenBranch}  const cookieAccessToken = consoleCookieAccessToken(source.cookieHeader);
  if (cookieAccessToken) {
    return cookieAccessToken;
  }
${options.demoBeforeProduction ? demoFallback + productionBlock : productionBlock + demoFallback}  throw new Error("unreachable");
}

export async function apiGet() {
  const accessToken = await consoleAccessToken({ cookieHeader: "" });
  return fetch(API_BASE_URL, {
    headers: {
      Authorization: \`Bearer \${accessToken}\`,
    },
    cache: "no-store",
  });
}

export function consoleCookieAccessToken(cookieHeader) {
  return parseCookies(cookieHeader).get(CONSOLE_ACCESS_TOKEN_COOKIE) ?? null;
}

export function privyCookieAccessToken(cookieHeader?: string | null) {
  return parseCookies(cookieHeader).get(PRIVY_ACCESS_TOKEN_COOKIE) ?? null;
}

export function createConsoleHandoffState() {
  return randomBytes(32).toString("base64url");
}

export function consoleAuthHandoffUrl(
  state: string,
  recoveryMode?: ConsoleAuthRecoveryMode,
) {
  const authUrl = new URL(process.env.FANPASS_CONSOLE_AUTH_ORIGIN ?? "https://auth.example.test");
  const consoleOrigin = configuredConsoleOrigin();
  if (authUrl.origin === consoleOrigin) return null;
  authUrl.searchParams.set("handoff", state);
  if (recoveryMode) authUrl.searchParams.set("recovery", recoveryMode);
  return authUrl.toString();
}

export function assertConsoleSessionHandoff(cookieHeader, state) {
  const leftBuffer = Buffer.from(state);
  const rightBuffer = Buffer.from(state);
  if (!timingSafeEqual(leftBuffer, rightBuffer)) throw new ConsoleSessionHandoffError();
}

export function consoleHandoffCookie(state: string) {
  const productionLike = isProductionLikeConsole();
  return [
    \`\${productionLike ? CONSOLE_HANDOFF_HOST_COOKIE : CONSOLE_HANDOFF_COOKIE}=\${state}\`,
    "HttpOnly",
    productionLike ? "SameSite=None" : "SameSite=Lax",
    "Path=/",
    \`Max-Age=\${CONSOLE_HANDOFF_MAX_AGE_SECONDS}\`,
    "Secure",
  ].join("; ");
}

export function clearConsoleHandoffCookie() {
  return "Max-Age=0";
}

export function assertConsoleMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = consoleAllowedOrigins();
  if (!origin) {
    if (isProductionLikeConsole()) {
      throw new ConsoleMutationOriginError("FanPass Console mutation origin is required");
    }
    return;
  }
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
    throw new ConsoleMutationOriginError();
  }
}

function consoleAllowedOrigins() {
  const origins = new Set<string>();
  for (const value of String(process.env.FANPASS_CONSOLE_ORIGINS ?? "").split(",")) addAllowedOrigin(origins, value);
  addAllowedOrigin(origins, process.env.FANPASS_CONSOLE_ORIGIN ?? "");
  addAllowedOrigin(origins, process.env.FANPASS_CONSOLE_URL ?? "");
  addAllowedOrigin(origins, process.env.FANPASS_CONSOLE_AUTH_ORIGIN ?? "");
  addAllowedOrigin(origins, process.env.VITE_CONSOLE_AUTH_BASE_URL ?? "");
  addAllowedOrigin(origins, process.env.VITE_CONSOLE_BASE_URL ?? "");
  addAllowedOrigin(origins, process.env.NEXT_PUBLIC_CONSOLE_AUTH_BASE_URL ?? "");
  addAllowedOrigin(origins, process.env.NEXT_PUBLIC_CONSOLE_BASE_URL ?? "");
  return origins;
}

function configuredConsoleOrigin() {
  return normalizeOrigin(process.env.RENDER_EXTERNAL_HOSTNAME ? \`https://\${process.env.RENDER_EXTERNAL_HOSTNAME}\` : "https://console.example.test");
}

export function consoleMutationCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const normalizedOrigin = origin ? normalizeOrigin(origin) : null;
  if (!normalizedOrigin || !consoleAllowedOrigins().has(normalizedOrigin)) return {};
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Origin": normalizedOrigin,
    Vary: "Origin",
  };
}

export function consoleSessionCookie(accessToken, expiresAt) {
  return [
    \`\${CONSOLE_ACCESS_TOKEN_COOKIE}=\${accessToken}\`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=60",
    "Secure",
  ].join("; ");
}

function addAllowedOrigin(origins, value) {
  const normalized = normalizeOrigin(value.trim());
  if (normalized) origins.add(normalized);
}
function normalizeOrigin(origin) { return new URL(origin).origin; }
function parseCookies() { return new Map(); }
function isProductionLikeConsole() {
  const nodeEnv = String(process.env.NODE_ENV ?? "").toLowerCase();
  const fanpassEnv = String(process.env.FANPASS_ENV ?? "").toLowerCase();
  return nodeEnv === "production" || fanpassEnv === "production" || fanpassEnv === "staging";
}
`;
}

function gateAssignmentRedactor() {
  return `
export function redactConsoleGateAssignmentResponse(record) {
  return {
    id: requiredString(record.id, "assignment id"),
    gate: requiredString(record.gate, "gate"),
    staffName: requiredString(record.staffName, "staff name"),
    inviteToken: record.inviteToken,
  };
}
function requiredString(value, label) { return String(value || label); }
`;
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function replaceFixtureFile(fixtureRoot, relativePath, expected, replacement) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  if (!contents.includes(expected)) {
    throw new Error(`${relativePath} fixture mutation target was not found`);
  }
  fs.writeFileSync(absolutePath, contents.replace(expected, replacement));
}

function replaceAllFixtureFile(
  fixtureRoot,
  relativePath,
  expected,
  replacement,
) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  if (!contents.includes(expected)) {
    throw new Error(`${relativePath} fixture mutation target was not found`);
  }
  fs.writeFileSync(absolutePath, contents.replaceAll(expected, replacement));
}
