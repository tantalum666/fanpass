const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_CONSOLE_ROUTE_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_CONSOLE_ROUTE_AUDIT_ROOT)
  : path.resolve(__dirname, "..");
const consoleBff = "apps/dashboard/server/console-bff.ts";
const consoleAuthHelper = "apps/dashboard/lib/console-auth.ts";
const consoleLoginComponent = "apps/dashboard/src/ConsoleApp.tsx";
const gateAssignmentRedactor = "apps/dashboard/lib/gate-assignment-response.ts";
const errors = [];

auditConsoleBff();
auditConsoleAuthHelper();
auditConsoleLoginComponent();
auditGateAssignmentRedactor();
auditNoLegacyNextRoutes();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedConsoleBff: consoleBff,
      checkedConsoleAuthHelper: consoleAuthHelper,
      checkedConsoleLoginComponent: consoleLoginComponent,
      checkedConsoleRedactor: gateAssignmentRedactor,
      routeHandlers: {
        "/api/console/privy-session": ["POST", "DELETE", "OPTIONS"],
        "/api/console/operations": ["GET"],
        "/api/console/events": ["POST"],
        "/api/console/events/:eventId/ticket-types": ["POST"],
        "/api/console/gate-assignments": ["POST"],
        "/api/console/gate-assignments/:assignmentId/invites": ["POST"],
        "/api/console/gate-assignments/:assignmentId/deactivate": ["POST"],
      },
    },
    null,
    2,
  ),
);

function auditConsoleBff() {
  const contents = readFile(consoleBff);
  const requiredSnippets = [
    "createServer(async (request, response) => {",
    'runtime: "vite-node-bff"',
    'pathname === "/api/console/privy-session"',
    'method === "POST"',
    'method === "DELETE"',
    'method === "OPTIONS"',
    'pathname === "/api/console/operations"',
    'pathname === "/api/console/events"',
    "handleCreateTicketType(request, response, ticketTypeMatch[1])",
    'pathname === "/api/console/gate-assignments"',
    "handleRotateInvite(request, response, inviteMatch[1])",
    "assertConsoleMutationOrigin(originRequest)",
    "consoleMutationCorsHeaders(originRequest)",
    "privyCookieAccessToken(request.headers.cookie)",
    "/auth/privy/sync",
    'session.role !== "ORGANIZER" && session.role !== "ADMIN"',
    "consoleSessionCookie(accessToken, session.expiresAt)",
    "clearConsoleSessionCookie()",
    "consoleAccessToken(cookieSource(request))",
    "/alpha/gate-assignments",
    "Authorization: `Bearer ${accessToken}`",
    '"Content-Type": "application/json"',
    'cache: "no-store"',
    "redactConsoleGateAssignmentResponse(payload)",
    "normalizedAssignmentId",
    "encodeURIComponent(",
    "/invites",
    '"X-Content-Type-Options"',
    '"nosniff"',
    '"X-Frame-Options"',
    '"DENY"',
    '"Cross-Origin-Opener-Policy"',
    '"same-origin"',
    '"Strict-Transport-Security"',
    '"Content-Security-Policy"',
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  requireSnippets(consoleBff, contents, requiredSnippets);
  requirePatterns(consoleBff, contents, [
    {
      label:
        "handleDeactivateGateAssignment(request, response, deactivateMatch[1])",
      pattern:
        /handleDeactivateGateAssignment\s*\(\s*request\s*,\s*response\s*,\s*deactivateMatch\[1\]\s*,?\s*\)/,
    },
  ]);

  const forbiddenSnippets = [
    "assignment: payload",
    "accessToken: accessToken",
    "email: session.email",
    "privyId: session.privyId",
    "walletAddress: session.walletAddress",
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "@privy-io/react-auth",
  ];
  rejectSnippets(consoleBff, contents, forbiddenSnippets);
}

function auditConsoleAuthHelper() {
  const contents = readFile(consoleAuthHelper);
  const requiredSnippets = [
    'export const CONSOLE_ACCESS_TOKEN_COOKIE = "fanpass_console_access_token"',
    'export const PRIVY_ACCESS_TOKEN_COOKIE = "privy-token"',
    "process.env.FANPASS_CONSOLE_ACCESS_TOKEN",
    "process.env.FANPASS_CONSOLE_ORIGINS",
    "process.env.FANPASS_CONSOLE_ORIGIN",
    "process.env.FANPASS_CONSOLE_URL",
    "process.env.FANPASS_CONSOLE_AUTH_ORIGIN",
    "process.env.VITE_CONSOLE_AUTH_BASE_URL",
    "process.env.VITE_CONSOLE_BASE_URL",
    "process.env.NEXT_PUBLIC_CONSOLE_AUTH_BASE_URL",
    "process.env.NEXT_PUBLIC_CONSOLE_BASE_URL",
    "const cookieAccessToken = consoleCookieAccessToken(source.cookieHeader)",
    "export function privyCookieAccessToken(cookieHeader?: string | null)",
    "export function assertConsoleMutationOrigin(request: Request)",
    "export function consoleMutationCorsHeaders(",
    'request.headers.get("origin")',
    "allowedOrigins.has(normalizedOrigin)",
    '"Access-Control-Allow-Credentials": "true"',
    '"Access-Control-Allow-Headers": "Content-Type"',
    '"Access-Control-Allow-Methods": "POST, DELETE, OPTIONS"',
    '"Access-Control-Allow-Origin": normalizedOrigin',
    "new URL(origin).origin",
    "if (isProductionLikeConsole())",
    "throw new ConsoleAuthRequiredError()",
    "throw new ConsoleMutationOriginError(",
    "/auth/demo-session",
    'cache: "no-store"',
    "Authorization: `Bearer ${accessToken}`",
    "CONSOLE_ACCESS_TOKEN_COOKIE) ?? null",
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age",
    "Secure",
    'nodeEnv === "production"',
    'fanpassEnv === "production"',
    'fanpassEnv === "staging"',
  ];
  requireSnippets(consoleAuthHelper, contents, requiredSnippets);

  const configuredIndex = contents.indexOf("if (configuredAccessToken)");
  const cookieIndex = contents.indexOf(
    "const cookieAccessToken = consoleCookieAccessToken(source.cookieHeader)",
  );
  const productionIndex = contents.indexOf("if (isProductionLikeConsole())");
  const demoIndex = contents.indexOf("/auth/demo-session");
  if (
    configuredIndex === -1 ||
    cookieIndex === -1 ||
    productionIndex === -1 ||
    demoIndex === -1 ||
    !(
      configuredIndex < cookieIndex &&
      cookieIndex < productionIndex &&
      productionIndex < demoIndex
    )
  ) {
    errors.push(
      `${consoleAuthHelper} must resolve configured token, then cookie token, then block production-like demo fallback before requesting /auth/demo-session.`,
    );
  }

  if (contents.includes("NEXT_PUBLIC_CONSOLE_ACCESS_TOKEN")) {
    errors.push(
      `${consoleAuthHelper} must not read public client-exposed Console access token env vars.`,
    );
  }
}

function auditConsoleLoginComponent() {
  const contents = readFile(consoleLoginComponent);
  const requiredSnippets = [
    'fetch("/api/console/privy-session"',
    'method: "POST"',
    '"Content-Type": "application/json"',
    "body: JSON.stringify({ accessToken: token })",
    'cache: "no-store"',
    'setAccessToken("")',
    "await onSessionReady()",
    "safeConsoleAuthUrl(",
    "authUrl.origin === window.location.origin",
    "Privy sign-in is temporarily unavailable.",
  ];
  requireSnippets(consoleLoginComponent, contents, requiredSnippets);

  const forbiddenSnippets = [
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "console.log",
    "console.error",
    "@privy-io/react-auth",
  ];
  rejectSnippets(consoleLoginComponent, contents, forbiddenSnippets);
}

function auditGateAssignmentRedactor() {
  const contents = readFile(gateAssignmentRedactor);
  requireSnippets(gateAssignmentRedactor, contents, [
    "redactConsoleGateAssignmentResponse",
    "inviteToken",
    "requiredString(record.id",
    "requiredString(record.gate",
    "requiredString(record.staffName",
  ]);
}

function auditNoLegacyNextRoutes() {
  const legacyApiDir = path.join(rootDir, "apps/dashboard/app/api");
  if (fs.existsSync(legacyApiDir)) {
    errors.push(
      "apps/dashboard/app/api must not exist after the Console Next runtime exit; add new BFF routes to apps/dashboard/server/console-bff.ts.",
    );
  }
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, "apps/dashboard/package.json"), "utf8"),
  );
  if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
    errors.push(
      "apps/dashboard/package.json must not include next after the Console production runtime exit.",
    );
  }
}

function requireSnippets(file, contents, snippets) {
  for (const snippet of snippets) {
    if (!contents.includes(snippet)) {
      errors.push(`${file} is missing required Console boundary: ${snippet}`);
    }
  }
}

function requirePatterns(file, contents, requirements) {
  for (const { label, pattern } of requirements) {
    if (!pattern.test(contents)) {
      errors.push(`${file} is missing required Console boundary: ${label}`);
    }
  }
}

function rejectSnippets(file, contents, snippets) {
  for (const snippet of snippets) {
    if (contents.includes(snippet)) {
      errors.push(`${file} contains forbidden Console boundary: ${snippet}`);
    }
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}
