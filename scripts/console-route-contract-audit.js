const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const rootDir = process.env.FANPASS_CONSOLE_ROUTE_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_CONSOLE_ROUTE_AUDIT_ROOT)
  : path.resolve(__dirname, "..");
const consoleApiDir = path.join(rootDir, "apps/dashboard/app/api/console");
const consoleApiHelper = "apps/dashboard/lib/api.ts";
const consoleLoginComponent = "apps/dashboard/app/console-login-form.tsx";
const errors = [];

const expectedRoutes = new Map([
  [
    "apps/dashboard/app/api/console/privy-session/route.ts",
    {
      methods: new Set(["POST", "DELETE"]),
      requiredSnippets: [
        "/auth/privy/sync",
        "assertConsoleMutationOrigin(request)",
        "ConsoleMutationOriginError",
        'session.role !== "ORGANIZER" && session.role !== "ADMIN"',
        "result.cookies.set(CONSOLE_ACCESS_TOKEN_COOKIE, accessToken",
        "httpOnly: true",
        'sameSite: "lax"',
        "secure: isProductionLikeConsole()",
        'path: "/"',
        "maxAge: maxAgeSeconds(session.expiresAt)",
        "result.cookies.delete(CONSOLE_ACCESS_TOKEN_COOKIE)",
      ],
      forbiddenSnippets: [
        "accessToken: accessToken",
        "email: session.email",
        "privyId: session.privyId",
        "walletAddress: session.walletAddress",
      ],
    },
  ],
  [
    "apps/dashboard/app/api/console/gate-assignments/route.ts",
    {
      methods: new Set(["POST"]),
      requiredSnippets: [
        "assertConsoleMutationOrigin(request)",
        "ConsoleMutationOriginError",
        "consoleAccessToken(",
        "ConsoleAuthRequiredError",
        "!eventId || !gate || !staffName || !staffEmail",
        "/alpha/gate-assignments",
        "Authorization: `Bearer ${accessToken}`",
        '"Content-Type": "application/json"',
        'cache: "no-store"',
        "redactConsoleGateAssignmentResponse(payload)",
      ],
      forbiddenSnippets: ["assignment: payload"],
    },
  ],
  [
    "apps/dashboard/app/api/console/gate-assignments/[assignmentId]/invites/route.ts",
    {
      methods: new Set(["POST"]),
      requiredSnippets: [
        "assertConsoleMutationOrigin(request)",
        "ConsoleMutationOriginError",
        "consoleAccessToken(",
        "ConsoleAuthRequiredError",
        "normalizedAssignmentId",
        "encodeURIComponent(",
        "/invites",
        "Authorization: `Bearer ${accessToken}`",
        'cache: "no-store"',
        "redactConsoleGateAssignmentResponse(payload)",
      ],
      forbiddenSnippets: ["assignment: payload"],
    },
  ],
]);

const routeFiles = listSourceFiles(consoleApiDir)
  .filter((file) => file.endsWith("/route.ts"))
  .map((absoluteFile) => normalizePath(path.relative(rootDir, absoluteFile)))
  .sort();

for (const routeFile of routeFiles) {
  auditRouteFile(routeFile);
}

for (const expectedRoute of expectedRoutes.keys()) {
  if (!routeFiles.includes(expectedRoute)) {
    errors.push(`${expectedRoute} is missing from FanPass Console routes.`);
  }
}

auditConsoleApiHelper();
auditConsoleLoginComponent();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedConsoleRoutes: routeFiles.length,
      checkedConsoleAuthHelper: consoleApiHelper,
      checkedConsoleLoginComponent: consoleLoginComponent,
      routeHandlers: Object.fromEntries(
        routeFiles.map((routeFile) => [
          routeFile,
          [...exportedRouteMethods(routeFile)],
        ]),
      ),
    },
    null,
    2,
  ),
);

function auditConsoleLoginComponent() {
  const contents = fs.readFileSync(
    path.join(rootDir, consoleLoginComponent),
    "utf8",
  );
  const requiredSnippets = [
    '"use client"',
    'fetch("/api/console/privy-session"',
    'method: "POST"',
    '"Content-Type": "application/json"',
    "body: JSON.stringify({ accessToken: token })",
    'cache: "no-store"',
    'setAccessToken("")',
    "window.location.reload()",
  ];
  for (const snippet of requiredSnippets) {
    if (!contents.includes(snippet)) {
      errors.push(
        `${consoleLoginComponent} is missing required login boundary: ${snippet}`,
      );
    }
  }

  const forbiddenSnippets = [
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "console.log",
    "console.error",
    "@privy-io/react-auth",
  ];
  for (const snippet of forbiddenSnippets) {
    if (contents.includes(snippet)) {
      errors.push(
        `${consoleLoginComponent} contains forbidden login boundary: ${snippet}`,
      );
    }
  }
}

function auditConsoleApiHelper() {
  const contents = fs.readFileSync(
    path.join(rootDir, consoleApiHelper),
    "utf8",
  );
  const requiredSnippets = [
    'export const CONSOLE_ACCESS_TOKEN_COOKIE = "fanpass_console_access_token"',
    "process.env.FANPASS_CONSOLE_ACCESS_TOKEN",
    "process.env.FANPASS_CONSOLE_ORIGINS",
    "process.env.FANPASS_CONSOLE_ORIGIN",
    "process.env.FANPASS_CONSOLE_URL",
    "await consoleCookieAccessToken()",
    "export function assertConsoleMutationOrigin(request: Request)",
    'request.headers.get("origin")',
    "allowedOrigins.has(normalizedOrigin)",
    "new URL(origin).origin",
    "if (isProductionLikeConsole())",
    "throw new ConsoleAuthRequiredError()",
    "throw new ConsoleMutationOriginError(",
    "/auth/demo-session",
    'cache: "no-store"',
    "Authorization: `Bearer ${accessToken}`",
    "return cookieStore.get(CONSOLE_ACCESS_TOKEN_COOKIE)?.value ?? null",
    'nodeEnv === "production"',
    'fanpassEnv === "production"',
    'fanpassEnv === "staging"',
  ];
  for (const snippet of requiredSnippets) {
    if (!contents.includes(snippet)) {
      errors.push(
        `${consoleApiHelper} is missing required auth boundary: ${snippet}`,
      );
    }
  }

  const configuredIndex = contents.indexOf("if (configuredAccessToken)");
  const cookieIndex = contents.indexOf("await consoleCookieAccessToken()");
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
      `${consoleApiHelper} must resolve configured token, then cookie token, then block production-like demo fallback before requesting /auth/demo-session.`,
    );
  }

  if (contents.includes("NEXT_PUBLIC_CONSOLE_ACCESS_TOKEN")) {
    errors.push(
      `${consoleApiHelper} must not read public client-exposed Console access token env vars.`,
    );
  }
}

function auditRouteFile(routeFile) {
  const expected = expectedRoutes.get(routeFile);
  if (!expected) {
    errors.push(
      `${routeFile} is a new Console route. Add it to scripts/console-route-contract-audit.js and docs/API_RESPONSE_PRIVACY_MATRIX.md.`,
    );
    return;
  }

  const contents = fs.readFileSync(path.join(rootDir, routeFile), "utf8");
  const methods = exportedRouteMethods(routeFile);
  for (const method of methods) {
    if (!expected.methods.has(method)) {
      errors.push(`${routeFile} exports unexpected ${method} handler.`);
    }
  }
  for (const method of expected.methods) {
    if (!methods.has(method)) {
      errors.push(`${routeFile} is missing expected ${method} handler.`);
    }
  }
  for (const snippet of expected.requiredSnippets) {
    if (!contents.includes(snippet)) {
      errors.push(
        `${routeFile} is missing required route boundary: ${snippet}`,
      );
    }
  }
  for (const snippet of expected.forbiddenSnippets) {
    if (contents.includes(snippet)) {
      errors.push(`${routeFile} contains forbidden route boundary: ${snippet}`);
    }
  }
  if (contents.includes("return response.json(")) {
    errors.push(
      `${routeFile} must not directly return upstream response.json().`,
    );
  }
}

function exportedRouteMethods(routeFile) {
  const absoluteFile = path.join(rootDir, routeFile);
  const contents = fs.readFileSync(absoluteFile, "utf8");
  const source = ts.createSourceFile(
    absoluteFile,
    contents,
    ts.ScriptTarget.Latest,
    true,
  );
  const methods = new Set();
  for (const statement of source.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name) {
      continue;
    }
    if (!hasExportModifier(statement)) {
      continue;
    }
    const methodName = statement.name.getText(source);
    if (/^[A-Z]+$/.test(methodName)) {
      methods.add(methodName);
    }
  }
  return methods;
}

function hasExportModifier(statement) {
  return statement.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );
}

function listSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(fullPath);
    }
    return [fullPath];
  });
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}
