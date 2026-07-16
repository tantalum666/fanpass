const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const rootDir = process.env.FANPASS_API_PRIVACY_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_API_PRIVACY_AUDIT_ROOT)
  : path.resolve(__dirname, "..");
const apiSrcDir = path.join(rootDir, "apps/api/src");
const dashboardApiDir = path.join(rootDir, "apps/dashboard/app/api");
const dashboardBffPath = path.join(
  rootDir,
  "apps/dashboard/server/console-bff.ts",
);
const matrixPath = path.join(rootDir, "docs/API_RESPONSE_PRIVACY_MATRIX.md");
const controllerFiles = listSourceFiles(apiSrcDir).filter((file) =>
  file.endsWith(".controller.ts"),
);
const dashboardRouteFiles = fs.existsSync(dashboardApiDir)
  ? listSourceFiles(dashboardApiDir).filter((file) =>
      file.endsWith("/route.ts"),
    )
  : [];
const routeDecorators = new Set(["Get", "Post", "Put", "Patch", "Delete"]);
const nextRouteMethods = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
const publicResponseClasses = new Set([
  "PUBLIC_SYSTEM",
  "PUBLIC_CATALOG",
  "PUBLIC_MARKET",
  "AUTH_SESSION",
  "PROVIDER_INGRESS",
  "DEVICE_INGRESS",
]);
const allowedClasses = new Set([
  ...publicResponseClasses,
  "FAN_PRIVATE",
  "STAFF_PRIVATE",
  "ORGANIZER_REDACTED",
  "ORGANIZER_SECRET_ONCE",
  "ADMIN_PRIVATE",
  "LOCAL_DEBUG",
]);
const errors = [];

const discoveredHandlers = new Map();
for (const absoluteFile of controllerFiles) {
  auditNestController(absoluteFile);
}
for (const absoluteFile of dashboardRouteFiles) {
  auditNextRoute(absoluteFile);
}
if (fs.existsSync(dashboardBffPath)) {
  auditConsoleBff(dashboardBffPath);
}

const matrix = parseMatrix();
for (const [handler, discovered] of discoveredHandlers) {
  const entry = matrix.get(handler);
  if (!entry) {
    errors.push(
      `${handler} is missing from docs/API_RESPONSE_PRIVACY_MATRIX.md.`,
    );
    continue;
  }
  if (entry.route !== discovered.route) {
    errors.push(
      `${handler} route drifted. Matrix has "${entry.route}", controller has "${discovered.route}".`,
    );
  }
  if (!allowedClasses.has(entry.classification)) {
    errors.push(
      `${handler} uses unknown privacy classification "${entry.classification}".`,
    );
  }
  validateClassification(handler, discovered, entry.classification);
}

for (const handler of matrix.keys()) {
  if (!discoveredHandlers.has(handler)) {
    errors.push(
      `${handler} is listed in the privacy matrix but no controller handler exists.`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedControllers: controllerFiles.length,
      checkedConsoleRouteFiles: dashboardRouteFiles.length,
      classifiedResponses: discoveredHandlers.size,
      classifications: countClassifications(matrix),
    },
    null,
    2,
  ),
);

function auditNestController(absoluteFile) {
  const relativeFile = normalizePath(path.relative(rootDir, absoluteFile));
  const contents = fs.readFileSync(absoluteFile, "utf8");
  const source = ts.createSourceFile(
    absoluteFile,
    contents,
    ts.ScriptTarget.Latest,
    true,
  );

  for (const statement of source.statements) {
    if (!ts.isClassDeclaration(statement)) {
      continue;
    }

    const controllerPrefix = getDecoratorPath(statement, source, "Controller");
    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member) || !member.name) {
        continue;
      }
      const routeDecorator = getRouteDecorator(member, source);
      if (!routeDecorator) {
        continue;
      }
      const methodName = member.name.getText(source);
      const handler = `${relativeFile}:${methodName}`;
      const verb = routeDecorator.name.toUpperCase();
      const routePath = joinRoutePaths(
        controllerPrefix,
        getCallPath(routeDecorator.call, source),
      );
      discoveredHandlers.set(handler, {
        surface: "nest",
        fileContents: contents,
        route: `${verb} ${routePath}`,
        publicRoute: hasDecorator(member, source, "PublicRoute"),
        roles: getRoles(member, source),
      });
    }
  }
}

function auditNextRoute(absoluteFile) {
  const relativeFile = normalizePath(path.relative(rootDir, absoluteFile));
  const contents = fs.readFileSync(absoluteFile, "utf8");
  const source = ts.createSourceFile(
    absoluteFile,
    contents,
    ts.ScriptTarget.Latest,
    true,
  );

  for (const statement of source.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name) {
      continue;
    }
    const methodName = statement.name.getText(source);
    if (!nextRouteMethods.has(methodName)) {
      continue;
    }
    discoveredHandlers.set(`${relativeFile}:${methodName}`, {
      surface: "next",
      fileContents: contents,
      route: `${methodName} ${nextRoutePath(relativeFile)}`,
      publicRoute: false,
      roles: [],
    });
  }
}

function auditConsoleBff(absoluteFile) {
  const relativeFile = normalizePath(path.relative(rootDir, absoluteFile));
  const contents = fs.readFileSync(absoluteFile, "utf8");
  const handlers = [
    ["handlePrivyHandoffStart", "GET /api/console/privy-handoff"],
    ["handlePrivySessionPost", "POST /api/console/privy-session"],
    ["handlePrivySessionDelete", "DELETE /api/console/privy-session"],
    ["handlePrivySessionOptions", "OPTIONS /api/console/privy-session"],
    ["handleOperations", "GET /api/console/operations"],
    ["handleCreateEvent", "POST /api/console/events"],
    [
      "handleCreateTicketType",
      "POST /api/console/events/:eventId/ticket-types",
    ],
    ["handleSaveFanCampaign", "POST /api/console/events/:eventId/fan-access"],
    [
      "handleReviewFanSubmission",
      "POST /api/console/fan-access/submissions/:submissionId/decision",
    ],
    ["handleCreateGateAssignment", "POST /api/console/gate-assignments"],
    [
      "handleRotateInvite",
      "POST /api/console/gate-assignments/:assignmentId/invites",
    ],
    [
      "handleDeactivateGateAssignment",
      "POST /api/console/gate-assignments/:assignmentId/deactivate",
    ],
  ];

  for (const [methodName, route] of handlers) {
    if (!contents.includes(`function ${methodName}`)) {
      errors.push(`${relativeFile}:${methodName} is missing.`);
      continue;
    }
    discoveredHandlers.set(`${relativeFile}:${methodName}`, {
      surface: "consoleBff",
      fileContents: contents,
      route,
      publicRoute: false,
      roles: [],
    });
  }
}

function validateClassification(handler, discovered, classification) {
  if (discovered.surface === "nest") {
    validateNestClassification(handler, discovered, classification);
  } else if (discovered.surface === "next") {
    validateNextClassification(handler, discovered, classification);
  } else if (discovered.surface === "consoleBff") {
    validateConsoleBffClassification(handler, discovered, classification);
  }
  if (
    classification === "PROVIDER_INGRESS" &&
    handler !== "apps/api/src/modules/payments/payments.controller.ts:webhook"
  ) {
    errors.push(
      `${handler} is classified as PROVIDER_INGRESS outside the payment webhook boundary.`,
    );
  }
  if (
    classification === "DEVICE_INGRESS" &&
    handler !==
      "apps/api/src/modules/verification/verification.controller.ts:redeemTurnstile"
  ) {
    errors.push(
      `${handler} is classified as DEVICE_INGRESS outside the turnstile redemption boundary.`,
    );
  }
  if (
    handler ===
      "apps/api/src/modules/verification/verification.controller.ts:redeemTurnstile" &&
    classification !== "DEVICE_INGRESS"
  ) {
    errors.push(
      "turnstile redemption must remain classified as DEVICE_INGRESS.",
    );
  }
  if (
    handler ===
      "apps/api/src/modules/payments/payments.controller.ts:webhook" &&
    classification !== "PROVIDER_INGRESS"
  ) {
    errors.push("payments webhook must remain classified as PROVIDER_INGRESS.");
  }
  if (
    handler === "apps/api/src/app.controller.ts:resetPrototype" &&
    classification !== "LOCAL_DEBUG"
  ) {
    errors.push("prototype reset must remain classified as LOCAL_DEBUG.");
  }
  if (
    classification === "AUTH_SESSION" &&
    !handler.includes("/auth/") &&
    !handler.startsWith("apps/dashboard/app/api/console/privy-session/") &&
    !handler.startsWith("apps/dashboard/server/console-bff.ts:handlePrivy")
  ) {
    errors.push(
      `${handler} is classified as AUTH_SESSION outside the auth controller.`,
    );
  }
  if (
    classification === "ADMIN_PRIVATE" &&
    !(discovered.roles.length === 1 && discovered.roles[0] === "ADMIN")
  ) {
    errors.push(
      `${handler} is ADMIN_PRIVATE but is not restricted to ADMIN only.`,
    );
  }
}

function validateNestClassification(handler, discovered, classification) {
  if (discovered.publicRoute && !publicResponseClasses.has(classification)) {
    errors.push(
      `${handler} is @PublicRoute but classified as ${classification}; public ingress must be intentionally public or provider/auth-session scoped.`,
    );
  }
  if (
    classification.startsWith("PUBLIC_") &&
    (!discovered.publicRoute || discovered.roles.length > 0)
  ) {
    errors.push(
      `${handler} is classified as ${classification} but is not an intentionally public route.`,
    );
  }
}

function validateNextClassification(handler, discovered, classification) {
  if (classification.startsWith("PUBLIC_")) {
    errors.push(
      `${handler} is a Console route handler and must not be classified as public.`,
    );
  }
  if (
    classification === "AUTH_SESSION" &&
    !handler.startsWith("apps/dashboard/app/api/console/privy-session/")
  ) {
    errors.push(
      `${handler} is classified as AUTH_SESSION outside the Console session bridge.`,
    );
  }
  if (classification === "ORGANIZER_SECRET_ONCE") {
    if (
      !handler.startsWith("apps/dashboard/app/api/console/gate-assignments/")
    ) {
      errors.push(
        `${handler} is classified as ORGANIZER_SECRET_ONCE outside the Console gate-assignment boundary.`,
      );
    }
    if (!discovered.fileContents.includes("consoleAccessToken(")) {
      errors.push(
        `${handler} returns organizer one-time secret data but does not use consoleAccessToken().`,
      );
    }
    if (
      !discovered.fileContents.includes("redactConsoleGateAssignmentResponse(")
    ) {
      errors.push(
        `${handler} returns organizer one-time secret data but does not use redactConsoleGateAssignmentResponse().`,
      );
    }
  }
}

function validateConsoleBffClassification(handler, discovered, classification) {
  if (classification.startsWith("PUBLIC_")) {
    errors.push(
      `${handler} is a Console BFF handler and must not be classified as public.`,
    );
  }
  if (
    classification === "AUTH_SESSION" &&
    !handler.startsWith("apps/dashboard/server/console-bff.ts:handlePrivy")
  ) {
    errors.push(
      `${handler} is classified as AUTH_SESSION outside the Console session bridge.`,
    );
  }
  if (classification === "ORGANIZER_SECRET_ONCE") {
    if (
      !handler.startsWith(
        "apps/dashboard/server/console-bff.ts:handleCreateGateAssignment",
      ) &&
      !handler.startsWith(
        "apps/dashboard/server/console-bff.ts:handleRotateInvite",
      )
    ) {
      errors.push(
        `${handler} is classified as ORGANIZER_SECRET_ONCE outside the Console gate-assignment boundary.`,
      );
    }
    if (
      !discovered.fileContents.includes(
        "consoleAccessToken(cookieSource(request))",
      )
    ) {
      errors.push(
        `${handler} returns organizer one-time secret data but does not use consoleAccessToken().`,
      );
    }
    if (
      !discovered.fileContents.includes(
        "redactConsoleGateAssignmentResponse(payload)",
      )
    ) {
      errors.push(
        `${handler} returns organizer one-time secret data but does not use the Console gate-assignment redactor.`,
      );
    }
  }
}

function parseMatrix() {
  const matrix = new Map();
  const contents = fs.readFileSync(matrixPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (
      !line.startsWith("| `apps/api/src/") &&
      !line.startsWith("| `apps/dashboard/app/api/") &&
      !line.startsWith("| `apps/dashboard/server/")
    ) {
      continue;
    }
    const columns = line
      .split("|")
      .slice(1, -1)
      .map((column) => column.trim().replace(/^`|`$/g, ""));
    const [handler, route, classification] = columns;
    if (!handler || !route || !classification) {
      continue;
    }
    if (matrix.has(handler)) {
      errors.push(`${handler} appears more than once in the privacy matrix.`);
    }
    matrix.set(handler, { route, classification });
  }
  return matrix;
}

function getRouteDecorator(node, source) {
  for (const decorator of getDecorators(node)) {
    const expression = decorator.expression;
    if (!ts.isCallExpression(expression)) {
      continue;
    }
    const name = expression.expression.getText(source);
    if (routeDecorators.has(name)) {
      return { name, call: expression };
    }
  }
  return null;
}

function getDecoratorPath(node, source, decoratorName) {
  for (const decorator of getDecorators(node)) {
    const expression = decorator.expression;
    if (!ts.isCallExpression(expression)) {
      continue;
    }
    if (expression.expression.getText(source) !== decoratorName) {
      continue;
    }
    return getCallPath(expression, source);
  }
  return "";
}

function getCallPath(call, source) {
  const [firstArgument] = call.arguments;
  if (!firstArgument) {
    return "";
  }
  if (
    ts.isStringLiteral(firstArgument) ||
    ts.isNoSubstitutionTemplateLiteral(firstArgument)
  ) {
    return firstArgument.text;
  }
  errors.push(`Unsupported non-literal route path in ${source.fileName}.`);
  return "";
}

function getRoles(node, source) {
  for (const decorator of getDecorators(node)) {
    const expression = decorator.expression;
    if (
      !ts.isCallExpression(expression) ||
      expression.expression.getText(source) !== "Roles"
    ) {
      continue;
    }
    return expression.arguments
      .filter((argument) => ts.isStringLiteral(argument))
      .map((argument) => argument.text);
  }
  return [];
}

function hasDecorator(node, source, name) {
  return getDecorators(node).some((decorator) => {
    const expression = decorator.expression;
    if (ts.isCallExpression(expression)) {
      return expression.expression.getText(source) === name;
    }
    return expression.getText(source) === name;
  });
}

function joinRoutePaths(prefix, routePath) {
  const joined = [prefix, routePath]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .map((part) => String(part).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return `/${joined}`;
}

function nextRoutePath(relativeFile) {
  const routeFile = "apps/dashboard/app";
  if (!relativeFile.startsWith(`${routeFile}/`)) {
    errors.push(
      `Unsupported Next route file outside app directory: ${relativeFile}`,
    );
    return "/";
  }
  const appRelative = relativeFile
    .slice(routeFile.length)
    .replace(/\/route\.ts$/, "")
    .replace(/\[([^\]/]+)\]/g, ":$1");
  return appRelative || "/";
}

function countClassifications(matrix) {
  const counts = {};
  for (const entry of matrix.values()) {
    counts[entry.classification] = (counts[entry.classification] ?? 0) + 1;
  }
  return counts;
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

function getDecorators(node) {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}
