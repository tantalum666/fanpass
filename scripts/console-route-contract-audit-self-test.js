const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

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
      fs.rmSync(path.join(fixtureRoot, "apps/dashboard/server/console-bff.ts"), {
        force: true,
      }),
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
    label: "rejects session bridge without HttpOnly cookie handling",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/lib/console-auth.ts",
        consoleAuthHelper().replace('"HttpOnly",', '"CookieOnly",'),
      ),
  },
  {
    label: "rejects session bridge without mutation origin guard",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff().replaceAll("assertConsoleMutationOrigin(originRequest)", ""),
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
  writeFixtureFile(fixtureRoot, "apps/dashboard/server/console-bff.ts", consoleBff());
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

function consoleLoginComponent() {
  return `
import { FormEvent, useState } from "react";

export function ConsoleLoginForm({ onSessionReady }: { onSessionReady: () => Promise<void> }) {
  const [accessToken, setAccessToken] = useState("");

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

  return <form onSubmit={submitSession} />;
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
  assertConsoleMutationOrigin,
  clearConsoleSessionCookie,
  consoleAccessToken,
  consoleMutationCorsHeaders,
  consoleSessionCookie,
} from "../lib/console-auth.js";
import { redactConsoleGateAssignmentResponse } from "../lib/gate-assignment-response.js";

createServer(async (request, response) => {
  console.log(JSON.stringify({ runtime: "vite-node-bff" }));
});

async function routeRequest(request, response, pathname, method) {
  if (pathname === "/api/console/privy-session") {
    if (method === "POST") return handlePrivySessionPost(request, response);
    if (method === "DELETE") return handlePrivySessionDelete(request, response);
    if (method === "OPTIONS") return handlePrivySessionOptions(request, response);
  }
  if (pathname === "/api/console/operations") return handleOperations(request, response);
  if (pathname === "/api/console/events") return handleCreateEvent(request, response);
  if (pathname === "/api/console/gate-assignments") return handleCreateGateAssignment(request, response);
  return handleCreateTicketType(request, response, ticketTypeMatch[1]) ||
    handleCreateGateAssignment(request, response) ||
    handleRotateInvite(request, response, inviteMatch[1]) ||
    handleDeactivateGateAssignment(request, response, deactivateMatch[1]);
}

async function handlePrivySessionPost(request, response) {
  const originRequest = requestToFetchRequest(request);
  const corsHeaders = consoleMutationCorsHeaders(originRequest);
  assertConsoleMutationOrigin(originRequest);
  const accessToken = "fixture-access-token";
  const upstream = await fetch(\`\${API_BASE_URL}/auth/privy/sync\`, { cache: "no-store" });
  const session = await upstream.json();
  if (session.role !== "ORGANIZER" && session.role !== "ADMIN") {
    return sendJson(response, 403, { ok: false });
  }
  response.setHeader("Set-Cookie", consoleSessionCookie(accessToken, session.expiresAt));
  return sendJson(response, 200, {
    ok: true,
    userId: session.userId,
    displayName: session.displayName,
    role: session.role,
    expiresAt: session.expiresAt,
  });
}

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
const API_BASE_URL = "http://fixture";
export const CONSOLE_ACCESS_TOKEN_COOKIE = "fanpass_console_access_token";
const configuredAccessToken = process.env.FANPASS_CONSOLE_ACCESS_TOKEN ?? null;
${publicTokenEnv}
export class ConsoleAuthRequiredError extends Error {}
export class ConsoleMutationOriginError extends Error {}

export async function consoleAccessToken(source) {
  if (configuredAccessToken) {
    return configuredAccessToken;
  }
  const cookieAccessToken = consoleCookieAccessToken(source.cookieHeader);
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
