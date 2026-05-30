const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const rootDir = process.env.FANPASS_API_CONTRACT_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_API_CONTRACT_AUDIT_ROOT)
  : path.resolve(__dirname, "..");
const apiSrcDir = path.join(rootDir, "apps/api/src");
const controllerFiles = listSourceFiles(apiSrcDir).filter((file) =>
  file.endsWith(".controller.ts"),
);
const errors = [];
const warnings = [];
let auditedMutationCount = 0;
let routeParamProtectedCount = 0;
let queryParamProtectedCount = 0;

const validatorDecorators = new Set([
  "IsBoolean",
  "IsEmail",
  "IsIn",
  "IsInt",
  "IsISO8601",
  "IsNumber",
  "IsOptional",
  "IsString",
  "IsUUID",
  "Matches",
  "Max",
  "MaxLength",
  "Min",
  "MinLength",
]);

const boundedStringDecorators = new Set([
  "IsEmail",
  "IsIn",
  "IsISO8601",
  "IsUUID",
  "Matches",
  "MaxLength",
]);

const boundedNumberDecorators = new Set(["IsInt", "Max", "Min"]);

const routeDecorators = new Set(["Get", "Post", "Put", "Patch", "Delete"]);
const mutatingDecorators = new Set(["Post", "Put", "Patch", "Delete"]);
const supportedParamPipes = new Set(["FanPassIdParamPipe", "GateCodeParamPipe"]);
const bodylessMutations = new Map([
  ["apps/api/src/app.controller.ts", new Set(["resetPrototype"])],
  [
    "apps/api/src/modules/alpha/alpha.controller.ts",
    new Set(["deactivateGateAssignment", "rotateStaffInvite"]),
  ],
  ["apps/api/src/modules/orders/orders.controller.ts", new Set(["matchOrder"])],
  [
    "apps/api/src/modules/payments/payments.controller.ts",
    new Set(["webhook"]),
  ],
  [
    "apps/api/src/modules/verification/verification.controller.ts",
    new Set(["generateTicketQr"]),
  ],
]);

const idempotencyRequired = new Map([
  [
    "apps/api/src/modules/orders/orders.controller.ts:createOrder",
    "Idempotency-Key",
  ],
  [
    "apps/api/src/modules/payments/payments.controller.ts:createPaymentIntent",
    "Idempotency-Key",
  ],
  [
    "apps/api/src/modules/payments/payments.controller.ts:cancelAuthorization",
    "Idempotency-Key",
  ],
  [
    "apps/api/src/modules/payments/payments.controller.ts:refund",
    "Idempotency-Key",
  ],
  [
    "apps/api/src/modules/payments/payments.controller.ts:reconcile",
    "Idempotency-Key",
  ],
]);

validateGlobalValidationPipe();

for (const absoluteFile of controllerFiles) {
  auditController(absoluteFile);
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
      mutatingRoutes: auditedMutationCount,
      idempotencyProtectedRoutes: idempotencyRequired.size,
      routeParamProtectedRoutes: routeParamProtectedCount,
      queryParamProtectedRoutes: queryParamProtectedCount,
      warnings,
    },
    null,
    2,
  ),
);

function auditController(absoluteFile) {
  const relativeFile = normalizePath(path.relative(rootDir, absoluteFile));
  const contents = fs.readFileSync(absoluteFile, "utf8");
  const source = ts.createSourceFile(
    absoluteFile,
    contents,
    ts.ScriptTarget.Latest,
    true,
  );
  const validatedDtos = collectValidatedDtos(source, relativeFile);

  for (const statement of source.statements) {
    if (!ts.isClassDeclaration(statement)) {
      continue;
    }

    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member) || !member.name) {
        continue;
      }
      const methodName = member.name.getText(source);
      const routeDecorator = getDecoratorCall(member, source, routeDecorators);
      if (!routeDecorator) {
        continue;
      }

      auditRouteBoundaryParameters(member, source, relativeFile, methodName);

      const mutatingRouteDecorator = getDecoratorCall(
        member,
        source,
        mutatingDecorators,
      );
      if (!mutatingRouteDecorator) {
        continue;
      }
      auditedMutationCount += 1;

      const bodyParameters = member.parameters.filter((parameter) =>
        hasDecorator(parameter, source, "Body"),
      );
      const bodylessAllowlist = bodylessMutations.get(relativeFile);
      if (bodyParameters.length === 0) {
        if (!bodylessAllowlist?.has(methodName)) {
          errors.push(
            `${relativeFile}:${methodName} is a mutating route without a DTO body. Add a validated DTO or explicitly allowlist the bodyless command.`,
          );
        }
      } else {
        for (const parameter of bodyParameters) {
          const parameterType = parameter.type?.getText(source);
          if (!parameterType) {
            errors.push(
              `${relativeFile}:${methodName} has @Body() without an explicit DTO type.`,
            );
            continue;
          }
          if (!validatedDtos.has(parameterType)) {
            errors.push(
              `${relativeFile}:${methodName} uses @Body() ${parameterType}, but that DTO has no class-validator decorated properties in the controller file.`,
            );
          }
        }
      }

      const idempotencyHeader = idempotencyRequired.get(
        `${relativeFile}:${methodName}`,
      );
      if (
        idempotencyHeader &&
        !hasHeaderParameter(member, source, idempotencyHeader)
      ) {
        errors.push(
          `${relativeFile}:${methodName} must accept @Headers("idempotency-key") for ${idempotencyHeader}-protected retries.`,
        );
      }
    }
  }
}

function collectValidatedDtos(source, relativeFile) {
  const dtos = new Set();
  for (const statement of source.statements) {
    if (!ts.isClassDeclaration(statement) || !statement.name) {
      continue;
    }
    const className = statement.name.getText(source);
    let hasValidatedProperty = false;
    for (const member of statement.members) {
      if (!ts.isPropertyDeclaration(member)) {
        continue;
      }
      const decorators = getDecoratorNames(member, source);
      if (decorators.some((decorator) => validatorDecorators.has(decorator))) {
        hasValidatedProperty = true;
      }
      const propertyName = member.name.getText(source);
      if (
        decorators.includes("IsString") &&
        !decorators.some((decorator) => boundedStringDecorators.has(decorator))
      ) {
        errors.push(
          `${relativeFile}:${className}.${propertyName} uses @IsString() without a length, format, enum, email, UUID, ISO, or regex constraint.`,
        );
      }
      if (
        decorators.includes("IsNumber") &&
        !decorators.some((decorator) => boundedNumberDecorators.has(decorator))
      ) {
        errors.push(
          `${relativeFile}:${className}.${propertyName} uses @IsNumber() without integer/min/max bounds.`,
        );
      }
    }
    if (hasValidatedProperty) {
      dtos.add(className);
      if (!/(Dto|Request)$/.test(className)) {
        warnings.push(
          `${relativeFile}:${className} has validators but does not use a Dto/Request suffix.`,
        );
      }
    }
  }
  return dtos;
}

function auditRouteBoundaryParameters(member, source, relativeFile, methodName) {
  for (const parameter of member.parameters) {
    for (const decorator of getDecorators(parameter)) {
      const expression = decorator.expression;
      if (!ts.isCallExpression(expression)) {
        continue;
      }
      const decoratorName = expression.expression.getText(source);
      if (decoratorName === "Param") {
        auditParamDecorator(
          expression,
          source,
          relativeFile,
          methodName,
          parameter.name.getText(source),
        );
      }
      if (decoratorName === "Query") {
        auditQueryDecorator(
          expression,
          source,
          relativeFile,
          methodName,
          parameter.name.getText(source),
        );
      }
    }
  }
}

function auditParamDecorator(
  expression,
  source,
  relativeFile,
  methodName,
  parameterName,
) {
  const [nameArgument, pipeArgument] = expression.arguments;
  if (!nameArgument || !ts.isStringLiteral(nameArgument)) {
    errors.push(
      `${relativeFile}:${methodName} uses @Param() ${parameterName} without a named, scalar route parameter.`,
    );
    return;
  }

  if (!pipeArgument) {
    errors.push(
      `${relativeFile}:${methodName} @Param("${nameArgument.text}") is missing a bounded route parameter pipe.`,
    );
    return;
  }

  const pipeName = pipeArgument.getText(source);
  if (!supportedParamPipes.has(pipeName)) {
    errors.push(
      `${relativeFile}:${methodName} @Param("${nameArgument.text}") uses unsupported route parameter pipe ${pipeName}.`,
    );
    return;
  }

  if (nameArgument.text === "gate" && pipeName !== "GateCodeParamPipe") {
    errors.push(
      `${relativeFile}:${methodName} @Param("gate") must use GateCodeParamPipe.`,
    );
  }
  if (nameArgument.text !== "gate" && pipeName !== "FanPassIdParamPipe") {
    errors.push(
      `${relativeFile}:${methodName} @Param("${nameArgument.text}") must use FanPassIdParamPipe unless it is the gate code parameter.`,
    );
  }
  routeParamProtectedCount += 1;
}

function auditQueryDecorator(
  expression,
  source,
  relativeFile,
  methodName,
  parameterName,
) {
  const [nameArgument, pipeArgument] = expression.arguments;
  if (!nameArgument || !ts.isStringLiteral(nameArgument)) {
    errors.push(
      `${relativeFile}:${methodName} uses @Query() ${parameterName} without a named, scalar query parameter.`,
    );
    return;
  }
  if (!pipeArgument) {
    errors.push(
      `${relativeFile}:${methodName} @Query("${nameArgument.text}") is missing an explicit validation pipe or DTO boundary.`,
    );
    return;
  }
  queryParamProtectedCount += 1;
}

function validateGlobalValidationPipe() {
  const mainPath = path.join(rootDir, "apps/api/src/main.ts");
  const main = fs.readFileSync(mainPath, "utf8");
  const requiredSnippets = [
    "new ValidationPipe",
    "whitelist: true",
    "forbidNonWhitelisted: true",
    "transform: true",
  ];
  for (const snippet of requiredSnippets) {
    if (!main.includes(snippet)) {
      errors.push(
        `apps/api/src/main.ts is missing ValidationPipe setting: ${snippet}`,
      );
    }
  }
}

function hasHeaderParameter(method, source, expectedHeader) {
  return method.parameters.some((parameter) => {
    const decorators = getDecorators(parameter);
    return decorators.some((decorator) => {
      const expression = decorator.expression;
      if (!ts.isCallExpression(expression)) {
        return false;
      }
      if (expression.expression.getText(source) !== "Headers") {
        return false;
      }
      const [firstArgument] = expression.arguments;
      return (
        firstArgument &&
        ts.isStringLiteral(firstArgument) &&
        firstArgument.text.toLowerCase() === expectedHeader.toLowerCase()
      );
    });
  });
}

function getDecoratorCall(node, source, names) {
  return getDecorators(node).find((decorator) => {
    const expression = decorator.expression;
    if (!ts.isCallExpression(expression)) {
      return false;
    }
    return names.has(expression.expression.getText(source));
  });
}

function hasDecorator(node, source, name) {
  return getDecoratorNames(node, source).includes(name);
}

function getDecoratorNames(node, source) {
  return getDecorators(node)
    .map((decorator) => decorator.expression)
    .map((expression) =>
      ts.isCallExpression(expression)
        ? expression.expression.getText(source)
        : expression.getText(source),
    );
}

function getDecorators(node) {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function listSourceFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        return [];
      }
      return listSourceFiles(absolutePath);
    }
    return entry.name.endsWith(".ts") ? [absolutePath] : [];
  });
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}
