const fs = require("fs");
const path = require("path");
const {
  callExpressions,
  callPath,
  descendants,
  expressionPath,
  findFunction,
  moduleReferences,
  parseTypeScript,
  processEnvReads,
  propertyName,
  stringLiteralValue,
  ts,
  unwrapExpression,
} = require("./lib/typescript-audit");
const {
  DEFAULT_GATE_PATH,
  assertOrderedGateSteps,
  loadBetaFoundationGateSteps,
} = require("./lib/beta-foundation-gate-audit");

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
auditNoAmbientConsoleTokens();
auditConsoleLoginComponent();
auditGateAssignmentRedactor();
auditNoLegacyNextRoutes();
auditRuntimeIntegrationDelegate();

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
      behavioralProofDelegatedTo:
        "npm run security:console-session-handoff:integration",
      routeHandlers: {
        "/api/console/privy-handoff": ["GET"],
        "/api/console/privy-session": ["POST", "DELETE", "OPTIONS"],
        "/api/console/operations": ["GET"],
        "/api/console/events": ["POST"],
        "/api/console/events/:eventId/ticket-types": ["POST"],
        "/api/console/events/:eventId/fan-access": ["POST"],
        "/api/console/fan-access/submissions/:submissionId/decision": ["POST"],
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
  const sourceFile = parseAuditSource(consoleBff, contents);
  if (!sourceFile) {
    return;
  }
  rejectAmbientConsoleTokens(consoleBff, sourceFile);
  if (
    moduleReferences(sourceFile).some(
      (reference) => reference.module === "@privy-io/react-auth",
    )
  ) {
    errors.push(
      `${consoleBff} must not import the Privy browser SDK into the public BFF runtime.`,
    );
  }
  auditConsoleBearerProvenance(sourceFile);
  const requiredSnippets = [
    "createServer(async (request, response) => {",
    'runtime: "vite-node-bff"',
    'pathname === "/api/console/privy-handoff"',
    'method === "GET"',
    "handlePrivyHandoffStart(response)",
    'pathname === "/api/console/privy-session"',
    'method === "POST"',
    'method === "DELETE"',
    'method === "OPTIONS"',
    'pathname === "/api/console/operations"',
    'pathname === "/api/console/events"',
    "handleCreateTicketType(request, response, ticketTypeMatch[1])",
    "handleSaveFanCampaign(request, response, fanCampaignMatch[1])",
    "handleReviewFanSubmission(",
    "/fan-access/events/",
    "/fan-access/submissions/",
    'pathname === "/api/console/gate-assignments"',
    "handleRotateInvite(request, response, inviteMatch[1])",
    "assertConsoleMutationOrigin(originRequest)",
    "consoleMutationCorsHeaders(originRequest)",
    "createConsoleHandoffState()",
    "consoleAuthHandoffUrl(state)",
    "consoleAuthHandoffUrl(state, nextMode)",
    "consoleHandoffCookie(state)",
    "assertConsoleSessionHandoff(",
    "clearConsoleHandoffCookie()",
    "privyCookieAccessToken(request.headers.cookie)",
    "readPrivySessionBody(request)",
    "application/x-www-form-urlencoded",
    'body?.handoff === "top-level"',
    "body?.handoffState",
    "readConsoleAuthRecoveryMode(body?.recovery)",
    "sendPrivySessionRecovery(response, recoveryMode)",
    'sendRedirect(response, 303, "/")',
    '"/?auth=" + reason',
    "MAX_REQUEST_BODY_BYTES",
    "/auth/privy/sync",
    'session.role !== "ORGANIZER" && session.role !== "ADMIN"',
    "consoleSessionCookie(accessToken, session.expiresAt)",
    "clearConsoleSessionCookie()",
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
  requireOccurrences(consoleBff, contents, "consoleHandoffCookie(state)", 2);
  requirePatterns(consoleBff, contents, [
    {
      label:
        "handleDeactivateGateAssignment(request, response, deactivateMatch[1])",
      pattern:
        /handleDeactivateGateAssignment\s*\(\s*request\s*,\s*response\s*,\s*deactivateMatch\[1\]\s*,?\s*\)/,
    },
  ]);
  requireFunctionPatterns(consoleBff, contents, "handleRotateInvite", [
    {
      label: "encode normalizedAssignmentId before invite rotation",
      pattern: /encodeURIComponent\(\s*normalizedAssignmentId\s*,?\s*\)/,
    },
    {
      label: "target the invite rotation endpoint",
      pattern: /\/invites/,
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
  ];
  rejectSnippets(consoleBff, contents, forbiddenSnippets);
}

function auditConsoleAuthHelper() {
  const contents = readFile(consoleAuthHelper);
  const sourceFile = parseAuditSource(consoleAuthHelper, contents);
  if (!sourceFile) {
    return;
  }
  rejectAmbientConsoleTokens(consoleAuthHelper, sourceFile);
  auditConsoleAccessTokenControlFlow(sourceFile);
  const requiredSnippets = [
    'export const CONSOLE_ACCESS_TOKEN_COOKIE = "fanpass_console_access_token"',
    'export const PRIVY_ACCESS_TOKEN_COOKIE = "privy-token"',
    "export function consoleAuthHandoffUrl(",
    "recoveryMode?: ConsoleAuthRecoveryMode",
    'authUrl.searchParams.set("handoff", state)',
    'authUrl.searchParams.set("recovery", recoveryMode)',
    "configuredConsoleOrigin()",
    "authUrl.origin === consoleOrigin",
    "process.env.RENDER_EXTERNAL_HOSTNAME",
    "process.env.FANPASS_CONSOLE_ORIGINS",
    "process.env.FANPASS_CONSOLE_ORIGIN",
    "process.env.FANPASS_CONSOLE_URL",
    "process.env.FANPASS_CONSOLE_AUTH_ORIGIN",
    "process.env.VITE_CONSOLE_AUTH_BASE_URL",
    "process.env.VITE_CONSOLE_BASE_URL",
    "process.env.NEXT_PUBLIC_CONSOLE_AUTH_BASE_URL",
    "process.env.NEXT_PUBLIC_CONSOLE_BASE_URL",
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
    "throw new ConsoleMutationOriginError(",
    'cache: "no-store"',
    "Authorization: `Bearer ${accessToken}`",
    "CONSOLE_ACCESS_TOKEN_COOKIE) ?? null",
    'nodeEnv === "production"',
    'fanpassEnv === "production"',
    'fanpassEnv === "staging"',
  ];
  requireSnippets(consoleAuthHelper, contents, requiredSnippets);
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
    'href="/api/console/privy-handoff"',
    "consoleAuthFailureMessage()",
    'reason === "service"',
    'reason === "session"',
    'reason === "rate"',
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
    "href={consoleAuthUrl}",
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

function auditConsoleBearerProvenance(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.body) {
      continue;
    }
    const functionName = statement.name?.text ?? "<anonymous>";
    if (functionName === "handlePrivySessionPost") {
      // This route exchanges a request-bound Privy credential. Its cookie,
      // state and resulting Console session are exercised by the process-level
      // handoff integration suite below.
      continue;
    }
    const authorizationProperties = descendants(
      statement.body,
      (node) =>
        ts.isPropertyAssignment(node) &&
        propertyName(node.name) === "Authorization",
    );
    if (authorizationProperties.length === 0) {
      continue;
    }
    const accessTokenDeclarations = descendants(
      statement.body,
      (node) =>
        ts.isVariableDeclaration(node) &&
        propertyName(node.name) === "accessToken",
    );
    const requestBound = accessTokenDeclarations.some((declaration) => {
      const initializer = unwrapAwait(declaration.initializer);
      if (
        !initializer ||
        !ts.isCallExpression(initializer) ||
        callPath(initializer) !== "consoleAccessToken"
      ) {
        return false;
      }
      const source = unwrapExpression(initializer.arguments[0]);
      return Boolean(
        source &&
        ts.isCallExpression(source) &&
        callPath(source) === "cookieSource" &&
        expressionPath(unwrapExpression(source.arguments[0])) === "request",
      );
    });
    if (!requestBound) {
      errors.push(
        `${consoleBff} ${functionName} must derive its bearer token from consoleAccessToken(cookieSource(request)) in the same executable function.`,
      );
    }
  }
}

function auditConsoleAccessTokenControlFlow(sourceFile) {
  const functionNode = findFunction(sourceFile, "consoleAccessToken");
  if (!functionNode?.body) {
    errors.push(`${consoleAuthHelper} must define consoleAccessToken().`);
    return;
  }
  const statements = [...functionNode.body.statements];
  const cookieIndex = statements.findIndex((statement) =>
    descendants(statement, (node) => {
      if (
        !ts.isVariableDeclaration(node) ||
        propertyName(node.name) !== "cookieAccessToken"
      ) {
        return false;
      }
      const initializer = unwrapAwait(node.initializer);
      return Boolean(
        initializer &&
        ts.isCallExpression(initializer) &&
        callPath(initializer) === "consoleCookieAccessToken" &&
        expressionPath(unwrapExpression(initializer.arguments[0])) ===
          "source.cookieHeader",
      );
    }),
  );
  const cookieReturnIndex = statements.findIndex(
    (statement) =>
      ts.isIfStatement(statement) &&
      expressionPath(unwrapExpression(statement.expression)) ===
        "cookieAccessToken" &&
      descendants(statement.thenStatement, (node) =>
        Boolean(
          ts.isReturnStatement(node) &&
          expressionPath(unwrapExpression(node.expression)) ===
            "cookieAccessToken",
        ),
      ).length > 0,
  );
  const productionBlockIndex = statements.findIndex(
    (statement) =>
      ts.isIfStatement(statement) &&
      isCallExpression(statement.expression, "isProductionLikeConsole") &&
      descendants(statement.thenStatement, (node) =>
        Boolean(
          ts.isThrowStatement(node) &&
          node.expression &&
          ts.isNewExpression(unwrapExpression(node.expression)) &&
          expressionPath(unwrapExpression(node.expression).expression) ===
            "ConsoleAuthRequiredError",
        ),
      ).length > 0,
  );
  const demoFetchIndex = statements.findIndex((statement) =>
    callExpressions(statement, "fetch").some((call) =>
      executableStringArgumentContains(call, 0, "/auth/demo-session"),
    ),
  );
  if (
    cookieIndex === -1 ||
    cookieReturnIndex <= cookieIndex ||
    productionBlockIndex <= cookieReturnIndex ||
    demoFetchIndex <= productionBlockIndex
  ) {
    errors.push(
      `${consoleAuthHelper} must resolve and return the request cookie, then throw in production-like environments before the executable /auth/demo-session fallback.`,
    );
  }
}

function rejectAmbientConsoleTokens(file, sourceFile) {
  const forbidden = new Set([
    "FANPASS_CONSOLE_ACCESS_TOKEN",
    "NEXT_PUBLIC_CONSOLE_ACCESS_TOKEN",
  ]);
  const reads = processEnvReads(sourceFile).filter((read) =>
    forbidden.has(read.name),
  );
  if (reads.length > 0) {
    errors.push(
      `${file} must not read ambient or public client-exposed Console access token env vars: ${[
        ...new Set(reads.map((read) => read.name)),
      ].join(", ")}.`,
    );
  }
}

function auditNoAmbientConsoleTokens() {
  for (const directory of ["apps/dashboard/server", "apps/dashboard/lib"]) {
    for (const absolutePath of listTypeScriptFiles(
      path.join(rootDir, directory),
    )) {
      const relativePath = normalizePath(path.relative(rootDir, absolutePath));
      if (relativePath === consoleBff || relativePath === consoleAuthHelper) {
        continue;
      }
      const contents = fs.readFileSync(absolutePath, "utf8");
      const sourceFile = parseAuditSource(relativePath, contents);
      if (sourceFile) {
        rejectAmbientConsoleTokens(relativePath, sourceFile);
      }
    }
  }
}

function auditRuntimeIntegrationDelegate() {
  const integrationScript =
    "scripts/console-session-handoff-integration-test.js";
  const packagePath = path.join(rootDir, "package.json");
  const verifierPath = path.join(rootDir, DEFAULT_GATE_PATH);
  const integrationPath = path.join(rootDir, integrationScript);
  if (
    !fs.existsSync(packagePath) ||
    !fs.existsSync(verifierPath) ||
    !fs.existsSync(integrationPath)
  ) {
    errors.push(
      "Console route audit requires the package command, composite verifier, and process-level Console handoff integration test.",
    );
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const integrationCommand =
    packageJson.scripts?.["security:console-session-handoff:integration"];
  if (
    integrationCommand !==
    "node scripts/console-session-handoff-integration-test.js"
  ) {
    errors.push(
      "package.json must delegate security:console-session-handoff:integration to the process-level Console handoff test.",
    );
  }

  const gateSteps = loadBetaFoundationGateSteps(rootDir, errors);
  assertOrderedGateSteps(
    gateSteps,
    [
      {
        kind: "npm",
        args: ["run", "build", "-w", "apps/dashboard"],
      },
      {
        kind: "npm",
        args: ["run", "security:console-session-handoff:integration"],
      },
    ],
    errors,
    { subject: "Beta foundation Console handoff gate" },
  );

  const contents = fs.readFileSync(integrationPath, "utf8");
  const sourceFile = parseAuditSource(integrationScript, contents);
  if (!sourceFile) {
    return;
  }
  const references = new Set(
    moduleReferences(sourceFile).map((reference) => reference.module),
  );
  if (!references.has("node:http") || !references.has("node:child_process")) {
    errors.push(
      `${integrationScript} must start real HTTP processes instead of simulating cookie helper strings.`,
    );
  }
  const main = findFunction(sourceFile, "main");
  if (!main?.body) {
    errors.push(`${integrationScript} must define an executable main() test.`);
    return;
  }
  const mainCalls = callExpressions(main.body);
  if (!mainCalls.some((call) => callPath(call) === "spawn")) {
    errors.push(`${integrationScript} must spawn the built Console BFF.`);
  }
  if (!mainCalls.some((call) => callPath(call)?.endsWith("getSetCookie"))) {
    errors.push(
      `${integrationScript} must inspect real HTTP Set-Cookie response headers.`,
    );
  }
  for (const attribute of [
    "HttpOnly",
    "SameSite=None",
    "Secure",
    "Path=/",
    "Max-Age=300",
  ]) {
    if (
      !mainCalls.some(
        (call) =>
          callPath(call) === "assertCookieAttribute" &&
          call.arguments.some(
            (argument) => stringLiteralValue(argument) === attribute,
          ),
      )
    ) {
      errors.push(
        `${integrationScript} must assert the observed handoff cookie attribute ${attribute}.`,
      );
    }
  }
  const hasNegativeSessionAssertion = mainCalls.some(
    (call) =>
      callPath(call) === "assert" &&
      call.arguments.some((argument) => {
        const expression = unwrapExpression(argument);
        return Boolean(
          expression &&
          ts.isPrefixUnaryExpression(expression) &&
          expression.operator === ts.SyntaxKind.ExclamationToken &&
          isCallExpression(expression.operand, "hasSessionCookie"),
        );
      }),
  );
  const hasPositiveSessionAssertion = mainCalls.some(
    (call) =>
      callPath(call) === "assert" &&
      call.arguments.some((argument) =>
        isCallExpression(argument, "hasSessionCookie"),
      ),
  );
  if (!hasNegativeSessionAssertion || !hasPositiveSessionAssertion) {
    errors.push(
      `${integrationScript} must observe both rejected and successful session-cookie outcomes through HTTP.`,
    );
  }
}

function parseAuditSource(file, contents) {
  try {
    return parseTypeScript(file, contents);
  } catch (error) {
    errors.push(error.message);
    return null;
  }
}

function unwrapAwait(expression) {
  let current = unwrapExpression(expression);
  while (current && ts.isAwaitExpression(current)) {
    current = unwrapExpression(current.expression);
  }
  return current;
}

function isCallExpression(expression, expectedPath) {
  const current = unwrapAwait(expression);
  return Boolean(
    current &&
    ts.isCallExpression(current) &&
    callPath(current) === expectedPath,
  );
}

function executableStringArgumentContains(call, index, expected) {
  const argument = unwrapExpression(call.arguments[index]);
  if (!argument) {
    return false;
  }
  if (ts.isStringLiteralLike(argument)) {
    return argument.text.includes(expected);
  }
  if (ts.isTemplateExpression(argument)) {
    return (
      argument.head.text.includes(expected) ||
      argument.templateSpans.some((span) =>
        span.literal.text.includes(expected),
      )
    );
  }
  return false;
}

function listTypeScriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(absolutePath);
    }
    return /\.tsx?$/.test(entry.name) ? [absolutePath] : [];
  });
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
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

function requireFunctionPatterns(file, contents, functionName, requirements) {
  const escapedFunctionName = functionName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const functionPattern = new RegExp(
    `async function ${escapedFunctionName}\\b[\\s\\S]*?(?=\\n(?:async )?function |$)`,
  );
  const functionContents = contents.match(functionPattern)?.[0];

  if (!functionContents) {
    errors.push(
      `${file} is missing required Console function: ${functionName}`,
    );
    return;
  }

  requirePatterns(file, functionContents, requirements);
}

function requireOccurrences(file, contents, snippet, minimum) {
  const occurrences = contents.split(snippet).length - 1;
  if (occurrences < minimum) {
    errors.push(
      `${file} requires at least ${minimum} occurrences of Console boundary: ${snippet}`,
    );
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
