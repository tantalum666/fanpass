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
    label: "accepts documented Console route and auth-helper contracts",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects missing expected Console routes",
    expected: "fail",
    mutate: (fixtureRoot) =>
      fs.rmSync(
        path.join(
          fixtureRoot,
          "apps/dashboard/app/api/console/privy-session/route.ts",
        ),
        { force: true },
      ),
  },
  {
    label: "rejects unexpected new Console route handlers",
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
        "apps/dashboard/app/api/console/privy-session/route.ts",
        privySessionRoute().replace(
          'session.role !== "ORGANIZER" && session.role !== "ADMIN"',
          'session.role !== "ORGANIZER"',
        ),
      ),
  },
  {
    label: "rejects session bridge that leaks sensitive session fields",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/app/api/console/privy-session/route.ts",
        privySessionRoute().replace(
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
        "apps/dashboard/app/api/console/privy-session/route.ts",
        privySessionRoute().replace("httpOnly: true,", "httpOnly: false,"),
      ),
  },
  {
    label: "rejects session bridge without mutation origin guard",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/app/api/console/privy-session/route.ts",
        privySessionRoute().replaceAll(
          "  assertConsoleMutationOrigin(request);\n",
          "",
        ),
      ),
  },
  {
    label: "rejects gate assignment proxy without Console access token",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/app/api/console/gate-assignments/route.ts",
        gateAssignmentRoute().replace(
          "const accessToken = await consoleAccessToken();",
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
        "apps/dashboard/app/api/console/gate-assignments/route.ts",
        gateAssignmentRoute().replace(
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
        "apps/dashboard/app/api/console/gate-assignments/[assignmentId]/invites/route.ts",
        inviteRotationRoute().replace(
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
        "apps/dashboard/lib/api.ts",
        consoleApiHelper({ demoBeforeProduction: true }),
      ),
  },
  {
    label: "rejects public client-exposed Console token config",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/lib/api.ts",
        consoleApiHelper({ includePublicTokenEnv: true }),
      ),
  },
  {
    label: "rejects Console login component without session bridge fetch",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/app/console-login-form.tsx",
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
        "apps/dashboard/app/console-login-form.tsx",
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
        "apps/dashboard/app/console-login-form.tsx",
        consoleLoginComponent().replace(
          'import { FormEvent, useState } from "react";',
          'import { FormEvent, useState } from "react";\nimport { usePrivy } from "@privy-io/react-auth";',
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
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/app/api/console/privy-session/route.ts",
    privySessionRoute(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/app/api/console/gate-assignments/route.ts",
    gateAssignmentRoute(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/app/api/console/gate-assignments/[assignmentId]/invites/route.ts",
    inviteRotationRoute(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/lib/api.ts",
    consoleApiHelper(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/app/console-login-form.tsx",
    consoleLoginComponent(),
  );
}

function consoleLoginComponent() {
  return `
"use client";

import { FormEvent, useState } from "react";

export function ConsoleLoginForm() {
  const [accessToken, setAccessToken] = useState("");

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = accessToken.trim();
    setAccessToken("");
    const response = await fetch("/api/console/privy-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accessToken: token }),
      cache: "no-store",
    });
    if (response.ok) {
      window.location.reload();
    }
  }

  return <form onSubmit={submitSession} />;
}
`;
}

function privySessionRoute() {
  return `
import { NextResponse } from "next/server";
import {
  CONSOLE_ACCESS_TOKEN_COOKIE,
  ConsoleMutationOriginError,
  assertConsoleMutationOrigin,
} from "../../../../lib/api";

export async function POST(request: Request) {
  assertConsoleMutationOrigin(request);
  const accessToken = "fixture-access-token";
  const response = await fetch("http://fixture/auth/privy/sync", {
    cache: "no-store",
  });
  const session = await response.json();
  if (session.role !== "ORGANIZER" && session.role !== "ADMIN") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const result = NextResponse.json({
    ok: true,
    userId: session.userId,
    displayName: session.displayName,
    role: session.role,
    expiresAt: session.expiresAt,
  });
  result.cookies.set(CONSOLE_ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionLikeConsole(),
    path: "/",
    maxAge: maxAgeSeconds(session.expiresAt),
  });
  return result;
}

export async function DELETE(request: Request) {
  assertConsoleMutationOrigin(request);
  const result = NextResponse.json({ ok: true });
  result.cookies.delete(CONSOLE_ACCESS_TOKEN_COOKIE);
  return result;
}

function maxAgeSeconds(expiresAt: string | null) {
  return expiresAt ? 60 : 55 * 60;
}

function isProductionLikeConsole() {
  return false;
}
`;
}

function gateAssignmentRoute() {
  return `
import { NextResponse } from "next/server";
import {
  ConsoleAuthRequiredError,
  ConsoleMutationOriginError,
  assertConsoleMutationOrigin,
  consoleAccessToken,
} from "../../../../lib/api";
import { redactConsoleGateAssignmentResponse } from "../../../../lib/gate-assignment-response";

export async function POST(request: Request) {
  assertConsoleMutationOrigin(request);
  const eventId = "evt_fixture";
  const gate = "A1";
  const staffName = "Fixture Staff";
  const staffEmail = "fixture.staff@example.invalid";
  if (!eventId || !gate || !staffName || !staffEmail) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const accessToken = await consoleAccessToken();
    const response = await fetch("http://fixture/alpha/gate-assignments", {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${accessToken}\`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json({
      ok: true,
      assignment: redactConsoleGateAssignmentResponse(payload),
    });
  } catch (error) {
    if (error instanceof ConsoleAuthRequiredError) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    throw error;
  }
}
`;
}

function inviteRotationRoute() {
  return `
import { NextResponse } from "next/server";
import {
  ConsoleAuthRequiredError,
  ConsoleMutationOriginError,
  assertConsoleMutationOrigin,
  consoleAccessToken,
} from "../../../../../../lib/api";
import { redactConsoleGateAssignmentResponse } from "../../../../../../lib/gate-assignment-response";

export async function POST(request: Request, { params }: { params: { assignmentId?: string } }) {
  assertConsoleMutationOrigin(request);
  const normalizedAssignmentId = params.assignmentId?.trim() ?? "";
  if (!normalizedAssignmentId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const accessToken = await consoleAccessToken();
    const response = await fetch(
      \`http://fixture/alpha/gate-assignments/\${encodeURIComponent(normalizedAssignmentId)}/invites\`,
      {
        method: "POST",
        headers: {
          Authorization: \`Bearer \${accessToken}\`,
        },
        cache: "no-store",
      },
    );
    const payload = await response.json();
    return NextResponse.json({
      ok: true,
      assignment: redactConsoleGateAssignmentResponse(payload),
    });
  } catch (error) {
    if (error instanceof ConsoleAuthRequiredError) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    throw error;
  }
}
`;
}

function consoleApiHelper(options = {}) {
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
import { cookies } from "next/headers";

const API_BASE_URL = "http://fixture";
export const CONSOLE_ACCESS_TOKEN_COOKIE = "fanpass_console_access_token";
const configuredAccessToken = process.env.FANPASS_CONSOLE_ACCESS_TOKEN ?? null;
${publicTokenEnv}
export class ConsoleAuthRequiredError extends Error {}
export class ConsoleMutationOriginError extends Error {}

export async function consoleAccessToken() {
  if (configuredAccessToken) {
    return configuredAccessToken;
  }

  const cookieAccessToken = await consoleCookieAccessToken();
  if (cookieAccessToken) {
    return cookieAccessToken;
  }

${options.demoBeforeProduction ? demoFallback + productionBlock : productionBlock + demoFallback}  throw new Error("unreachable");
}

export async function apiGet() {
  const accessToken = await consoleAccessToken();
  return fetch(API_BASE_URL, {
    headers: {
      Authorization: \`Bearer \${accessToken}\`,
    },
    cache: "no-store",
  });
}

async function consoleCookieAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(CONSOLE_ACCESS_TOKEN_COOKIE)?.value ?? null;
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
  for (const value of String(process.env.FANPASS_CONSOLE_ORIGINS ?? "").split(",")) {
    addAllowedOrigin(origins, value);
  }
  addAllowedOrigin(origins, process.env.FANPASS_CONSOLE_ORIGIN ?? "");
  addAllowedOrigin(origins, process.env.FANPASS_CONSOLE_URL ?? "");
  addAllowedOrigin(origins, process.env.NEXT_PUBLIC_CONSOLE_BASE_URL ?? "");
  return origins;
}

function addAllowedOrigin(origins: Set<string>, value: string) {
  const normalized = normalizeOrigin(value.trim());
  if (normalized) {
    origins.add(normalized);
  }
}

function normalizeOrigin(origin: string) {
  if (!origin) {
    return null;
  }
  return new URL(origin).origin;
}

function isProductionLikeConsole() {
  const nodeEnv = String(process.env.NODE_ENV ?? "").toLowerCase();
  const fanpassEnv = String(process.env.FANPASS_ENV ?? "").toLowerCase();
  return nodeEnv === "production" || fanpassEnv === "production" || fanpassEnv === "staging";
}
`;
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
