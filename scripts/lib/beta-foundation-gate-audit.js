"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  expressionPath,
  parseTypeScript,
  stringLiteralValue,
  ts,
  unwrapExpression,
} = require("./typescript-audit");

const DEFAULT_GATE_PATH = "scripts/beta-foundation-verify.js";
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const REVIEWED_GATE_SKELETON_SHA256 =
  "887ebcdc6b2bf93a443120010f60b9df4f9c4edeb956c6fc30fc56ee8c6ef7a9";
const REVIEWED_GATE_MANIFEST_SHA256 =
  "49f6a63e504360ad26aed36241202bd7dfd4c9432b26c822800750b83d64f263";
const STEP_HELPERS = Object.freeze({
  npmStep: "npm",
  nodeStep: "node",
  shStep: "sh",
});

function loadBetaFoundationGateSteps(rootDir, errors, options = {}) {
  const relativePath = options.relativePath ?? DEFAULT_GATE_PATH;
  try {
    const contents = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
    return parseBetaFoundationGateSteps(relativePath, contents, {
      enforceReviewedSkeleton:
        options.enforceReviewedSkeleton ??
        path.resolve(rootDir) === PROJECT_ROOT,
    });
  } catch (error) {
    errors.push(
      `${relativePath} must expose a literal typed gateSteps manifest: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }
}

function parseBetaFoundationGateSteps(fileName, contents, options = {}) {
  const sourceFile = parseTypeScript(fileName, contents);
  assertNoTopLevelBinding(sourceFile, "Object");
  const declarations = findTopLevelVariables(sourceFile, "gateSteps");
  if (declarations.length !== 1) {
    throw new Error(
      `expected exactly one top-level gateSteps declaration; found ${declarations.length}`,
    );
  }
  const [{ declaration, declarationList }] = declarations;
  if ((declarationList.flags & ts.NodeFlags.Const) === 0) {
    throw new Error("gateSteps must be declared with const");
  }
  if (!declaration.initializer) {
    throw new Error("gateSteps must have an initializer");
  }

  const initializer = unwrapExpression(declaration.initializer);
  if (
    !initializer ||
    !ts.isCallExpression(initializer) ||
    !isExactObjectFreezeCall(initializer) ||
    initializer.arguments.length !== 1
  ) {
    throw new Error("gateSteps must be exactly Object.freeze([...])");
  }

  const array = unwrapExpression(initializer.arguments[0]);
  if (!array || !ts.isArrayLiteralExpression(array)) {
    throw new Error("gateSteps must freeze one array literal");
  }

  if (options.enforceReviewedSkeleton) {
    assertReviewedGateSkeleton(fileName, contents, sourceFile, array);
  }

  const usedHelpers = new Set();
  const steps = array.elements.map((element, index) =>
    parseGateStep(fileName, element, index, usedHelpers),
  );
  for (const helper of usedHelpers) {
    validateStepHelperDefinition(sourceFile, helper, STEP_HELPERS[helper]);
  }
  assertNoCriticalReassignments(sourceFile, [...usedHelpers]);
  validateGateExecutionPath(sourceFile);
  if (options.enforceReviewedSkeleton) {
    assertReviewedGateManifest(steps);
  }
  return steps;
}

function computeGateManifestSha256(steps) {
  const canonical = steps.map((step) => ({
    label: step.label,
    kind: step.kind,
    args: [...step.args],
  }));
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical), "utf8")
    .digest("hex");
}

function assertReviewedGateManifest(steps) {
  const actual = computeGateManifestSha256(steps);
  if (actual !== REVIEWED_GATE_MANIFEST_SHA256) {
    throw new Error(
      `gate runner canonical manifest digest ${actual} does not match reviewed ${REVIEWED_GATE_MANIFEST_SHA256}`,
    );
  }
}

function computeGateSkeletonSha256(fileName, contents) {
  const sourceFile = parseTypeScript(fileName, contents);
  const declarations = findTopLevelVariables(sourceFile, "gateSteps");
  if (declarations.length !== 1 || !declarations[0].declaration.initializer) {
    throw new Error(
      `expected exactly one initialized top-level gateSteps declaration; found ${declarations.length}`,
    );
  }
  const initializer = unwrapExpression(declarations[0].declaration.initializer);
  if (
    !initializer ||
    !ts.isCallExpression(initializer) ||
    !isExactObjectFreezeCall(initializer) ||
    initializer.arguments.length !== 1
  ) {
    throw new Error("gateSteps must be exactly Object.freeze([...])");
  }
  const array = unwrapExpression(initializer.arguments[0]);
  if (!array || !ts.isArrayLiteralExpression(array)) {
    throw new Error("gateSteps must freeze one array literal");
  }
  return gateSkeletonSha256(contents, sourceFile, array);
}

function assertReviewedGateSkeleton(fileName, contents, sourceFile, array) {
  const actual = gateSkeletonSha256(contents, sourceFile, array);
  if (actual !== REVIEWED_GATE_SKELETON_SHA256) {
    throw new Error(
      `gate runner executable skeleton digest ${actual} does not match reviewed ${REVIEWED_GATE_SKELETON_SHA256}`,
    );
  }
}

function gateSkeletonSha256(contents, sourceFile, array) {
  const arrayStart = array.getStart(sourceFile);
  const normalized = `${contents.slice(0, arrayStart)}[/* gateSteps manifest audited separately */]${contents.slice(array.end)}`;
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

function parseGateStep(fileName, element, index, usedHelpers) {
  const current = unwrapExpression(element);
  if (!current || !ts.isCallExpression(current)) {
    throw new Error(`gateSteps[${index}] must be one typed helper call`);
  }
  const helper = expressionPath(current.expression);
  const kind = STEP_HELPERS[helper];
  if (!kind) {
    throw new Error(
      `gateSteps[${index}] uses unsupported helper ${helper ?? "unknown"}`,
    );
  }
  usedHelpers.add(helper);
  const values = current.arguments.map((argument, argumentIndex) => {
    const value = stringLiteralValue(argument);
    if (value == null) {
      throw new Error(
        `${fileName} gateSteps[${index}] argument ${argumentIndex} must be a string literal`,
      );
    }
    return value;
  });
  if (values.length < 2 || values[0].trim() !== values[0] || !values[0]) {
    throw new Error(`gateSteps[${index}] must have a non-empty literal label`);
  }
  if ((kind === "node" || kind === "sh") && values.length !== 2) {
    throw new Error(
      `gateSteps[${index}] ${kind} step must have exactly one script argument`,
    );
  }
  return Object.freeze({
    label: values[0],
    kind,
    args: Object.freeze(values.slice(1)),
  });
}

function isExactObjectFreezeCall(call) {
  if (call.questionDotToken || call.typeArguments?.length) {
    return false;
  }
  const callee = call.expression;
  return Boolean(
    ts.isPropertyAccessExpression(callee) &&
    !callee.questionDotToken &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === "Object" &&
    callee.name.text === "freeze",
  );
}

function validateStepHelperDefinition(sourceFile, helper, kind) {
  const bindings = findTopLevelBindings(sourceFile, helper);
  const declarations = findTopLevelVariables(sourceFile, helper);
  if (bindings.length !== 1 || declarations.length !== 1) {
    throw new Error(
      `${helper} must have exactly one top-level binding and const declaration`,
    );
  }

  const [{ declaration, declarationList }] = declarations;
  if ((declarationList.flags & ts.NodeFlags.Const) === 0) {
    throw new Error(`${helper} must be declared with const`);
  }
  if (!declaration.initializer) {
    throw new Error(`${helper} must have an initializer`);
  }

  const initializer = unwrapExpression(declaration.initializer);
  if (!initializer || !ts.isArrowFunction(initializer)) {
    throw new Error(`${helper} must be an arrow function`);
  }
  if (
    initializer.modifiers?.length ||
    initializer.typeParameters?.length ||
    initializer.type
  ) {
    throw new Error(`${helper} must use the exact reviewed arrow signature`);
  }

  const scriptParameter = kind === "npm" ? "args" : "script";
  if (
    initializer.parameters.length !== 2 ||
    !isExactParameter(initializer.parameters[0], "label", false) ||
    !isExactParameter(
      initializer.parameters[1],
      scriptParameter,
      kind === "npm",
    )
  ) {
    const signature = kind === "npm" ? "(label, ...args)" : "(label, script)";
    throw new Error(`${helper} must use the exact ${signature} signature`);
  }

  const body = unwrapExpression(initializer.body);
  if (!body || !ts.isObjectLiteralExpression(body)) {
    throw new Error(`${helper} must directly return one object literal`);
  }
  validateStepHelperReturn(helper, kind, body);
}

function isExactParameter(parameter, name, rest) {
  return Boolean(
    ts.isIdentifier(parameter.name) &&
    parameter.name.text === name &&
    Boolean(parameter.dotDotDotToken) === rest &&
    !parameter.initializer &&
    !parameter.questionToken &&
    !parameter.type &&
    !parameter.modifiers?.length,
  );
}

function validateStepHelperReturn(helper, kind, body) {
  const properties = body.properties;
  if (
    properties.length !== 3 ||
    !isExactShorthand(properties[0], "label") ||
    !isExactKindProperty(properties[1], kind) ||
    !(kind === "npm"
      ? isExactShorthand(properties[2], "args")
      : isExactScriptArrayProperty(properties[2]))
  ) {
    const expected =
      kind === "npm"
        ? `{ label, kind: "${kind}", args }`
        : `{ label, kind: "${kind}", args: [script] }`;
    throw new Error(`${helper} must directly return exactly ${expected}`);
  }
}

function isExactShorthand(property, name) {
  return Boolean(
    ts.isShorthandPropertyAssignment(property) &&
    property.name.text === name &&
    !property.objectAssignmentInitializer,
  );
}

function isExactKindProperty(property, kind) {
  return Boolean(
    ts.isPropertyAssignment(property) &&
    !ts.isComputedPropertyName(property.name) &&
    ts.isIdentifier(property.name) &&
    property.name.text === "kind" &&
    stringLiteralValue(property.initializer) === kind,
  );
}

function isExactScriptArrayProperty(property) {
  if (
    !ts.isPropertyAssignment(property) ||
    ts.isComputedPropertyName(property.name) ||
    !ts.isIdentifier(property.name) ||
    property.name.text !== "args"
  ) {
    return false;
  }
  const value = unwrapExpression(property.initializer);
  return Boolean(
    value &&
    ts.isArrayLiteralExpression(value) &&
    value.elements.length === 1 &&
    ts.isIdentifier(value.elements[0]) &&
    value.elements[0].text === "script",
  );
}

function assertNoTopLevelBinding(sourceFile, name) {
  if (findTopLevelBindings(sourceFile, name).length > 0) {
    throw new Error(`${name} must not be shadowed by a top-level binding`);
  }
}

function findTopLevelBindings(sourceFile, name) {
  const matches = [];
  const recordBindingName = (bindingName, declaration) => {
    if (ts.isIdentifier(bindingName)) {
      if (bindingName.text === name) {
        matches.push(declaration);
      }
      return;
    }
    for (const element of bindingName.elements) {
      if (!ts.isOmittedExpression(element)) {
        recordBindingName(element.name, declaration);
      }
    }
  };

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        recordBindingName(declaration.name, declaration);
      }
      continue;
    }
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name?.text === name
    ) {
      matches.push(statement);
      continue;
    }
    if (ts.isImportEqualsDeclaration(statement)) {
      if (statement.name.text === name) {
        matches.push(statement);
      }
      continue;
    }
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      continue;
    }
    const { importClause } = statement;
    if (importClause.name?.text === name) {
      matches.push(importClause);
    }
    const bindings = importClause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      if (bindings.name.text === name) {
        matches.push(bindings);
      }
    } else if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (element.name.text === name) {
          matches.push(element);
        }
      }
    }
  }
  return matches;
}

function validateGateExecutionPath(sourceFile) {
  assertUnshadowedTopLevelFunctions(sourceFile, [
    "main",
    "runStep",
    "validateRuntimeGateManifest",
    "resolveNpmCli",
    "buildHardenedEnvironment",
    "validateProjectNpmConfig",
  ]);
  assertNoCriticalReassignments(sourceFile, [
    "main",
    "runStep",
    "validateRuntimeGateManifest",
    "resolveNpmCli",
    "buildHardenedEnvironment",
    "validateProjectNpmConfig",
  ]);
  const mainFunctions = sourceFile.statements.filter(
    (statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "main",
  );
  if (mainFunctions.length !== 1 || !mainFunctions[0].body) {
    throw new Error(
      "gate runner must define exactly one top-level main function",
    );
  }
  const main = mainFunctions[0];
  if (
    main.modifiers?.length ||
    main.asteriskToken ||
    main.parameters.length !== 0 ||
    main.typeParameters?.length ||
    main.type
  ) {
    throw new Error(
      "gate runner main must use the exact function main() signature",
    );
  }

  const statements = main.body.statements;
  if (
    statements.length !== 9 ||
    !isExactNode22Guard(statements[0]) ||
    !isExactConstIdentifierStatement(
      statements[1],
      "verifiedGateSteps",
      "gateSteps",
    ) ||
    !isExactNoArgumentCallStatement(
      statements[2],
      "validateProjectNpmConfig",
    ) ||
    !isExactConstCallStatement(statements[3], "npmCli", "resolveNpmCli") ||
    !isExactReviewedNpmCliGuard(statements[4]) ||
    !isExactConstCallStatement(
      statements[5],
      "env",
      "buildHardenedEnvironment",
    ) ||
    !isExactConsoleLiteralStatement(
      statements[6],
      "== FanPass Beta foundation local gates ==",
    ) ||
    !ts.isForOfStatement(statements[7]) ||
    !isExactConsoleLiteralStatement(
      statements[8],
      "\nBeta foundation local gates passed.",
    )
  ) {
    throw new Error(
      "main must use the exact reviewed Node guard, initialization, execution loop, and success sequence",
    );
  }

  const verifiedDeclarations = descendantsWithin(
    main.body,
    ts.isVariableDeclaration,
  ).filter(
    (declaration) =>
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === "verifiedGateSteps",
  );
  const directVerifiedDeclarations = main.body.statements.flatMap(
    (statement) =>
      ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.filter(
            (declaration) =>
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === "verifiedGateSteps",
          )
        : [],
  );
  if (
    verifiedDeclarations.length !== 1 ||
    directVerifiedDeclarations.length !== 1
  ) {
    throw new Error(
      "main must declare exactly one direct verifiedGateSteps binding",
    );
  }
  const verifiedDeclaration = directVerifiedDeclarations[0];
  const verifiedStatement = verifiedDeclaration.parent.parent;
  if (
    !ts.isVariableStatement(verifiedStatement) ||
    (verifiedStatement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
    verifiedStatement.declarationList.declarations.length !== 1 ||
    !ts.isIdentifier(unwrapExpression(verifiedDeclaration.initializer)) ||
    unwrapExpression(verifiedDeclaration.initializer).text !== "gateSteps"
  ) {
    throw new Error(
      "main verifiedGateSteps must be exactly const verifiedGateSteps = gateSteps",
    );
  }

  const runStepCalls = descendantsWithin(main.body, ts.isCallExpression).filter(
    (call) => expressionPath(call.expression) === "runStep",
  );
  const loops = descendantsWithin(main.body, ts.isForOfStatement);
  if (runStepCalls.length !== 1 || loops.length !== 1) {
    throw new Error(
      "main must contain exactly one gate execution loop and one runStep call",
    );
  }
  if (loops[0] !== statements[7]) {
    throw new Error("gate execution loop must be a direct main statement");
  }
  validateGateExecutionLoop(loops[0], runStepCalls[0]);
  validateReachableMainEntry(sourceFile, main);
}

function isExactReviewedNpmCliGuard(statement) {
  if (
    !ts.isIfStatement(statement) ||
    statement.elseStatement ||
    !ts.isBlock(statement.thenStatement) ||
    statement.thenStatement.statements.length !== 1
  ) {
    return false;
  }
  const condition = unwrapExpression(statement.expression);
  if (
    !condition ||
    !ts.isBinaryExpression(condition) ||
    condition.operatorToken.kind !==
      ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    !ts.isIdentifier(unwrapExpression(condition.left)) ||
    unwrapExpression(condition.left).text !== "npmCli" ||
    !ts.isIdentifier(unwrapExpression(condition.right)) ||
    unwrapExpression(condition.right).text !== "reviewedNpmCli"
  ) {
    return false;
  }
  const onlyStatement = statement.thenStatement.statements[0];
  if (!ts.isThrowStatement(onlyStatement) || !onlyStatement.expression) {
    return false;
  }
  const error = unwrapExpression(onlyStatement.expression);
  return Boolean(
    error &&
    ts.isNewExpression(error) &&
    ts.isIdentifier(error.expression) &&
    error.expression.text === "Error" &&
    error.arguments?.length === 1 &&
    stringLiteralValue(error.arguments[0]) ===
      "The reviewed npm CLI path changed before gate execution",
  );
}

function assertUnshadowedTopLevelFunctions(sourceFile, names) {
  for (const name of names) {
    const functions = sourceFile.statements.filter(
      (statement) =>
        ts.isFunctionDeclaration(statement) && statement.name?.text === name,
    );
    const bindings = findAllBindings(sourceFile, name);
    if (
      functions.length !== 1 ||
      bindings.length !== 1 ||
      bindings[0] !== functions[0]
    ) {
      throw new Error(
        `${name} must be one unshadowed top-level function declaration`,
      );
    }
  }
}

function findAllBindings(sourceFile, name) {
  const matches = [];
  const recordBindingName = (bindingName, declaration) => {
    if (ts.isIdentifier(bindingName)) {
      if (bindingName.text === name) {
        matches.push(declaration);
      }
      return;
    }
    for (const element of bindingName.elements) {
      if (!ts.isOmittedExpression(element)) {
        recordBindingName(element.name, declaration);
      }
    }
  };
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
      recordBindingName(node.name, node);
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name?.text === name
    ) {
      matches.push(node);
    } else if (ts.isImportEqualsDeclaration(node) && node.name.text === name) {
      matches.push(node);
    } else if (ts.isImportClause(node) && node.name?.text === name) {
      matches.push(node);
    } else if (ts.isNamespaceImport(node) && node.name.text === name) {
      matches.push(node);
    } else if (ts.isImportSpecifier(node) && node.name.text === name) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return matches;
}

function assertNoCriticalReassignments(sourceFile, names) {
  const protectedNames = new Set(names);
  const assignments = descendantsWithin(sourceFile, (node) =>
    isCriticalReassignment(node, protectedNames),
  );
  if (assignments.length > 0) {
    throw new Error(
      "gate runner critical function bindings must not be reassigned",
    );
  }
}

function isCriticalReassignment(node, protectedNames) {
  if (ts.isBinaryExpression(node) && isAssignmentOperator(node.operatorToken)) {
    return assignmentTargetContainsName(node.left, protectedNames);
  }
  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
    return (
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      assignmentTargetContainsName(node.operand, protectedNames)
    );
  }
  return false;
}

function isAssignmentOperator(token) {
  return (
    token.kind >= ts.SyntaxKind.FirstAssignment &&
    token.kind <= ts.SyntaxKind.LastAssignment
  );
}

function assignmentTargetContainsName(node, protectedNames) {
  const current = unwrapExpression(node);
  if (!current) {
    return false;
  }
  if (ts.isIdentifier(current)) {
    return protectedNames.has(current.text);
  }
  if (ts.isArrayLiteralExpression(current)) {
    return current.elements.some(
      (element) =>
        !ts.isOmittedExpression(element) &&
        assignmentTargetContainsName(element, protectedNames),
    );
  }
  if (ts.isObjectLiteralExpression(current)) {
    return current.properties.some((property) => {
      if (ts.isShorthandPropertyAssignment(property)) {
        return protectedNames.has(property.name.text);
      }
      return (
        ts.isPropertyAssignment(property) &&
        assignmentTargetContainsName(property.initializer, protectedNames)
      );
    });
  }
  if (ts.isSpreadElement(current)) {
    return assignmentTargetContainsName(current.expression, protectedNames);
  }
  return false;
}

function isExactNode22Guard(statement) {
  if (
    !ts.isIfStatement(statement) ||
    statement.elseStatement ||
    !ts.isBlock(statement.thenStatement) ||
    statement.thenStatement.statements.length !== 1
  ) {
    return false;
  }
  const condition = unwrapExpression(statement.expression);
  if (
    !condition ||
    !ts.isBinaryExpression(condition) ||
    condition.operatorToken.kind !==
      ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    stringLiteralValue(condition.right) !== "22"
  ) {
    return false;
  }
  const left = unwrapExpression(condition.left);
  if (
    !left ||
    !ts.isElementAccessExpression(left) ||
    !left.argumentExpression ||
    !ts.isNumericLiteral(left.argumentExpression) ||
    left.argumentExpression.text !== "0"
  ) {
    return false;
  }
  const split = unwrapExpression(left.expression);
  if (
    !split ||
    !ts.isCallExpression(split) ||
    expressionPath(split.expression) !== "process.versions.node.split" ||
    split.arguments.length !== 1 ||
    stringLiteralValue(split.arguments[0]) !== "."
  ) {
    return false;
  }
  const onlyStatement = statement.thenStatement.statements[0];
  if (!ts.isThrowStatement(onlyStatement) || !onlyStatement.expression) {
    return false;
  }
  const error = unwrapExpression(onlyStatement.expression);
  return Boolean(
    error &&
    ts.isNewExpression(error) &&
    ts.isIdentifier(error.expression) &&
    error.expression.text === "Error" &&
    error.arguments?.length === 1 &&
    stringLiteralValue(error.arguments[0]) ===
      "FanPass Beta foundation verification requires Node 22 LTS",
  );
}

function isExactConstCallStatement(statement, binding, callee) {
  if (
    !ts.isVariableStatement(statement) ||
    (statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
    statement.declarationList.declarations.length !== 1
  ) {
    return false;
  }
  const [declaration] = statement.declarationList.declarations;
  return Boolean(
    ts.isIdentifier(declaration.name) &&
    declaration.name.text === binding &&
    !declaration.type &&
    isExactNoArgumentCall(declaration.initializer, callee),
  );
}

function isExactConstIdentifierStatement(statement, binding, source) {
  if (
    !ts.isVariableStatement(statement) ||
    (statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
    statement.declarationList.declarations.length !== 1
  ) {
    return false;
  }
  const [declaration] = statement.declarationList.declarations;
  const initializer = unwrapExpression(declaration.initializer);
  return Boolean(
    ts.isIdentifier(declaration.name) &&
    declaration.name.text === binding &&
    !declaration.type &&
    initializer &&
    ts.isIdentifier(initializer) &&
    initializer.text === source,
  );
}

function isExactNoArgumentCallStatement(statement, callee) {
  return Boolean(
    ts.isExpressionStatement(statement) &&
    isExactNoArgumentCall(statement.expression, callee),
  );
}

function isExactConsoleLiteralStatement(statement, message) {
  if (!ts.isExpressionStatement(statement)) {
    return false;
  }
  const call = unwrapExpression(statement.expression);
  return Boolean(
    call &&
    ts.isCallExpression(call) &&
    !call.questionDotToken &&
    !call.typeArguments?.length &&
    expressionPath(call.expression) === "console.log" &&
    call.arguments.length === 1 &&
    stringLiteralValue(call.arguments[0]) === message,
  );
}

function validateReachableMainEntry(sourceFile, main) {
  const topLevelIfStatements = sourceFile.statements.filter(ts.isIfStatement);
  if (topLevelIfStatements.length !== 1) {
    throw new Error(
      "gate runner must have exactly one top-level require.main entry",
    );
  }
  const entry = topLevelIfStatements[0];
  const condition = unwrapExpression(entry.expression);
  if (
    !condition ||
    !ts.isBinaryExpression(condition) ||
    condition.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken ||
    expressionPath(condition.left) !== "require.main" ||
    !ts.isIdentifier(unwrapExpression(condition.right)) ||
    unwrapExpression(condition.right).text !== "module" ||
    entry.elseStatement ||
    !ts.isBlock(entry.thenStatement) ||
    entry.thenStatement.statements.length !== 1 ||
    !ts.isTryStatement(entry.thenStatement.statements[0])
  ) {
    throw new Error(
      "gate runner entry must be exactly if (require.main === module) with one try block",
    );
  }
  const tryStatement = entry.thenStatement.statements[0];
  if (
    tryStatement.finallyBlock ||
    tryStatement.tryBlock.statements.length !== 1 ||
    !ts.isExpressionStatement(tryStatement.tryBlock.statements[0]) ||
    !isExactNoArgumentCall(
      tryStatement.tryBlock.statements[0].expression,
      "main",
    ) ||
    !tryStatement.catchClause ||
    !tryStatement.catchClause.variableDeclaration ||
    !ts.isIdentifier(tryStatement.catchClause.variableDeclaration.name) ||
    tryStatement.catchClause.variableDeclaration.name.text !== "error" ||
    tryStatement.catchClause.block.statements.length !== 2 ||
    !isConsoleErrorStatement(tryStatement.catchClause.block.statements[0]) ||
    !isProcessExitOneStatement(tryStatement.catchClause.block.statements[1])
  ) {
    throw new Error(
      "gate runner entry must directly call main and fail closed with process.exit(1)",
    );
  }
  const mainCalls = descendantsWithin(sourceFile, ts.isCallExpression).filter(
    (call) => expressionPath(call.expression) === "main",
  );
  if (mainCalls.length !== 1) {
    throw new Error("gate runner must contain exactly one main() call");
  }
  if (
    sourceFile.statements.indexOf(entry) <= sourceFile.statements.indexOf(main)
  ) {
    throw new Error("gate runner require.main entry must follow main");
  }
}

function isConsoleErrorStatement(statement) {
  const expression = ts.isExpressionStatement(statement)
    ? unwrapExpression(statement.expression)
    : null;
  return Boolean(
    expression &&
    ts.isCallExpression(expression) &&
    expressionPath(expression.expression) === "console.error" &&
    expression.arguments.length === 1,
  );
}

function isProcessExitOneStatement(statement) {
  const expression = ts.isExpressionStatement(statement)
    ? unwrapExpression(statement.expression)
    : null;
  return Boolean(
    expression &&
    ts.isCallExpression(expression) &&
    expressionPath(expression.expression) === "process.exit" &&
    expression.arguments.length === 1 &&
    ts.isNumericLiteral(unwrapExpression(expression.arguments[0])) &&
    unwrapExpression(expression.arguments[0]).text === "1",
  );
}

function validateGateExecutionLoop(loop, runStepCall) {
  if (
    loop.awaitModifier ||
    !ts.isVariableDeclarationList(loop.initializer) ||
    (loop.initializer.flags & ts.NodeFlags.Const) === 0 ||
    loop.initializer.declarations.length !== 1
  ) {
    throw new Error(
      "gate execution loop must be exactly for (const step of verifiedGateSteps)",
    );
  }
  const [stepDeclaration] = loop.initializer.declarations;
  const iterable = unwrapExpression(loop.expression);
  if (
    !ts.isIdentifier(stepDeclaration.name) ||
    stepDeclaration.name.text !== "step" ||
    stepDeclaration.initializer ||
    stepDeclaration.type ||
    !ts.isIdentifier(iterable) ||
    iterable.text !== "verifiedGateSteps" ||
    !ts.isBlock(loop.statement)
  ) {
    throw new Error(
      "gate execution loop must be exactly for (const step of verifiedGateSteps)",
    );
  }

  const bodyStatements = loop.statement.statements;
  if (
    bodyStatements.length !== 2 ||
    !isExactGateStepLog(bodyStatements[0]) ||
    !ts.isExpressionStatement(bodyStatements[1]) ||
    unwrapExpression(bodyStatements[1].expression) !== runStepCall ||
    !isExactRunStepCall(runStepCall)
  ) {
    throw new Error(
      "gate execution loop must log the current step and directly call runStep(step, { env, npmCli })",
    );
  }
}

function isExactNoArgumentCall(node, name) {
  const current = unwrapExpression(node);
  return Boolean(
    current &&
    ts.isCallExpression(current) &&
    !current.questionDotToken &&
    !current.typeArguments?.length &&
    ts.isIdentifier(current.expression) &&
    current.expression.text === name &&
    current.arguments.length === 0,
  );
}

function isExactGateStepLog(statement) {
  if (!ts.isExpressionStatement(statement)) {
    return false;
  }
  const call = unwrapExpression(statement.expression);
  if (
    !call ||
    !ts.isCallExpression(call) ||
    call.questionDotToken ||
    call.typeArguments?.length ||
    !ts.isPropertyAccessExpression(call.expression) ||
    !ts.isIdentifier(call.expression.expression) ||
    call.expression.expression.text !== "console" ||
    call.expression.name.text !== "log" ||
    call.arguments.length !== 1
  ) {
    return false;
  }
  const message = unwrapExpression(call.arguments[0]);
  return Boolean(
    message &&
    ts.isTemplateExpression(message) &&
    message.head.text === "\n-- " &&
    message.templateSpans.length === 1 &&
    expressionPath(message.templateSpans[0].expression) === "step.label" &&
    message.templateSpans[0].literal.text === "",
  );
}

function isExactRunStepCall(call) {
  if (
    call.questionDotToken ||
    call.typeArguments?.length ||
    !ts.isIdentifier(call.expression) ||
    call.expression.text !== "runStep" ||
    call.arguments.length !== 2 ||
    !ts.isIdentifier(unwrapExpression(call.arguments[0])) ||
    unwrapExpression(call.arguments[0]).text !== "step"
  ) {
    return false;
  }
  const options = unwrapExpression(call.arguments[1]);
  return Boolean(
    options &&
    ts.isObjectLiteralExpression(options) &&
    options.properties.length === 2 &&
    isExactShorthand(options.properties[0], "env") &&
    isExactShorthand(options.properties[1], "npmCli"),
  );
}

function descendantsWithin(node, predicate) {
  const matches = [];
  const visit = (current) => {
    ts.forEachChild(current, (child) => {
      if (predicate(child)) {
        matches.push(child);
      }
      visit(child);
    });
  };
  visit(node);
  return matches;
}

function findTopLevelVariables(sourceFile, name) {
  const matches = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        matches.push({
          declaration,
          declarationList: statement.declarationList,
        });
      }
    }
  }
  return matches;
}

function npmScriptStepIndex(steps, script) {
  return steps.findIndex(
    (step) =>
      step.kind === "npm" &&
      step.args.length === 2 &&
      step.args[0] === "run" &&
      step.args[1] === script,
  );
}

function assertOrderedNpmScripts(steps, scripts, errors, options = {}) {
  const subject = options.subject ?? "Beta foundation gate";
  let previousIndex = -1;
  for (const script of scripts) {
    const index = npmScriptStepIndex(steps, script);
    if (index === -1) {
      errors.push(`${subject} must run npm script ${script}`);
      continue;
    }
    if (index <= previousIndex) {
      errors.push(
        `${subject} must run npm script ${script} after the previous required step`,
      );
    }
    previousIndex = index;
  }
}

function gateStepIndex(steps, expected) {
  return steps.findIndex(
    (step) =>
      step.kind === expected.kind &&
      (expected.label == null || step.label === expected.label) &&
      arraysEqual(step.args, expected.args),
  );
}

function assertOrderedGateSteps(steps, expectedSteps, errors, options = {}) {
  const subject = options.subject ?? "Beta foundation gate";
  let previousIndex = -1;
  for (const expected of expectedSteps) {
    const index = gateStepIndex(steps, expected);
    const description =
      expected.label ?? `${expected.kind} ${expected.args.join(" ")}`;
    if (index === -1) {
      errors.push(`${subject} must run ${description}`);
      continue;
    }
    if (index <= previousIndex) {
      errors.push(
        `${subject} must run ${description} after the previous required step`,
      );
    }
    previousIndex = index;
  }
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function renderBetaFoundationGateFixture(npmScripts) {
  return renderBetaFoundationGateStepsFixture(
    npmScripts.map((script, index) => ({
      label: `Fixture gate ${index + 1}`,
      kind: "npm",
      args: ["run", script],
    })),
  );
}

function renderBetaFoundationGateStepsFixture(steps) {
  const helperByKind = {
    npm: "npmStep",
    node: "nodeStep",
    sh: "shStep",
  };
  const renderedSteps = steps
    .map((step, index) => {
      const helper = helperByKind[step.kind];
      if (!helper) {
        throw new Error(
          `Fixture gate ${index} has unsupported kind ${step.kind}`,
        );
      }
      const values = [step.label, ...step.args];
      if (
        values.length < 2 ||
        values.some((value) => typeof value !== "string")
      ) {
        throw new Error(`Fixture gate ${index} must use literal string values`);
      }
      return `  ${helper}(${values.map(JSON.stringify).join(", ")}),`;
    })
    .join("\n");
  return [
    'const npmStep = (label, ...args) => ({ label, kind: "npm", args });',
    'const nodeStep = (label, script) => ({ label, kind: "node", args: [script] });',
    'const shStep = (label, script) => ({ label, kind: "sh", args: [script] });',
    "const gateSteps = Object.freeze([",
    renderedSteps,
    "]);",
    "function buildHardenedEnvironment() { return {}; }",
    'function resolveNpmCli() { return "npm-cli.js"; }',
    "function validateProjectNpmConfig() {}",
    "function validateRuntimeGateManifest() { return gateSteps; }",
    "function runStep() {}",
    "function main() {",
    '  if (process.versions.node.split(".")[0] !== "22") {',
    '    throw new Error("FanPass Beta foundation verification requires Node 22 LTS");',
    "  }",
    "  const verifiedGateSteps = gateSteps;",
    "  validateProjectNpmConfig();",
    "  const npmCli = resolveNpmCli();",
    "  if (npmCli !== reviewedNpmCli) {",
    '    throw new Error("The reviewed npm CLI path changed before gate execution");',
    "  }",
    "  const env = buildHardenedEnvironment();",
    '  console.log("== FanPass Beta foundation local gates ==");',
    "  for (const step of verifiedGateSteps) {",
    "    console.log(`\\n-- ${step.label}`);",
    "    runStep(step, { env, npmCli });",
    "  }",
    '  console.log("\\nBeta foundation local gates passed.");',
    "}",
    "if (require.main === module) {",
    "  try {",
    "    main();",
    "  } catch (error) {",
    "    console.error(error);",
    "    process.exit(1);",
    "  }",
    "}",
    "",
  ].join("\n");
}

module.exports = {
  DEFAULT_GATE_PATH,
  REVIEWED_GATE_MANIFEST_SHA256,
  REVIEWED_GATE_SKELETON_SHA256,
  assertOrderedGateSteps,
  assertOrderedNpmScripts,
  gateStepIndex,
  computeGateManifestSha256,
  computeGateSkeletonSha256,
  loadBetaFoundationGateSteps,
  npmScriptStepIndex,
  parseBetaFoundationGateSteps,
  renderBetaFoundationGateFixture,
  renderBetaFoundationGateStepsFixture,
};
