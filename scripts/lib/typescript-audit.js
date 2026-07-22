const path = require("path");
const ts = require("typescript");

function parseTypeScript(fileName, contents) {
  const scriptKind = /\.tsx$/i.test(fileName)
    ? ts.ScriptKind.TSX
    : /\.jsx$/i.test(fileName)
      ? ts.ScriptKind.JSX
      : /\.js$/i.test(fileName)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    contents,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const diagnostics = sourceFile.parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    const rendered = diagnostics
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
      )
      .join("; ");
    throw new Error(`${fileName} is not valid TypeScript syntax: ${rendered}`);
  }
  return sourceFile;
}

function visit(node, callback) {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

function descendants(node, predicate) {
  const matches = [];
  visit(node, (candidate) => {
    if (candidate !== node && predicate(candidate)) {
      matches.push(candidate);
    }
  });
  return matches;
}

function findClass(sourceFile, className) {
  return sourceFile.statements.find(
    (statement) =>
      ts.isClassDeclaration(statement) && statement.name?.text === className,
  );
}

function findMethod(classNode, methodName) {
  return classNode?.members.find(
    (member) =>
      ts.isMethodDeclaration(member) &&
      propertyName(member.name) === methodName,
  );
}

function findFunction(sourceFile, functionName) {
  return sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === functionName,
  );
}

function propertyName(node) {
  if (!node) {
    return null;
  }
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
    return node.text;
  }
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }
  return null;
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isSatisfiesExpression?.(current))
  ) {
    current = current.expression;
  }
  return current;
}

function expressionPath(node) {
  const current = unwrapExpression(node);
  if (!current) {
    return null;
  }
  if (ts.isIdentifier(current) || ts.isPrivateIdentifier(current)) {
    return current.text;
  }
  if (current.kind === ts.SyntaxKind.ThisKeyword) {
    return "this";
  }
  if (ts.isPropertyAccessExpression(current)) {
    const parent = expressionPath(current.expression);
    return parent ? `${parent}.${current.name.text}` : null;
  }
  if (
    ts.isElementAccessExpression(current) &&
    current.argumentExpression &&
    (ts.isStringLiteral(current.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(current.argumentExpression))
  ) {
    const parent = expressionPath(current.expression);
    return parent ? `${parent}.${current.argumentExpression.text}` : null;
  }
  return null;
}

function callPath(node) {
  return ts.isCallExpression(node) ? expressionPath(node.expression) : null;
}

function callExpressions(node, expectedPath) {
  return descendants(
    node,
    (candidate) =>
      ts.isCallExpression(candidate) &&
      (!expectedPath || callPath(candidate) === expectedPath),
  );
}

function directCallStatements(block, expectedPath) {
  if (!block || !ts.isBlock(block)) {
    return [];
  }
  return block.statements.filter(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(unwrapExpression(statement.expression)) &&
      callPath(unwrapExpression(statement.expression)) === expectedPath,
  );
}

function moduleReferences(sourceFile) {
  const references = [];
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      references.push({
        kind: "import",
        module: statement.moduleSpecifier.text,
        node: statement,
      });
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      references.push({
        kind: "export",
        module: statement.moduleSpecifier.text,
        node: statement,
      });
    }
  }
  visit(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || node.arguments.length !== 1) {
      return;
    }
    const argument = node.arguments[0];
    if (!ts.isStringLiteralLike(argument)) {
      return;
    }
    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      references.push({ kind: "dynamic-import", module: argument.text, node });
      return;
    }
    if (
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      references.push({ kind: "require", module: argument.text, node });
    }
  });
  return references;
}

function processEnvReads(sourceFile) {
  const reads = [];
  visit(sourceFile, (node) => {
    if (ts.isPropertyAccessExpression(node)) {
      const parent = expressionPath(node.expression);
      if (parent === "process.env") {
        reads.push({ name: node.name.text, node });
      }
      return;
    }
    if (
      ts.isElementAccessExpression(node) &&
      expressionPath(node.expression) === "process.env" &&
      node.argumentExpression &&
      ts.isStringLiteralLike(node.argumentExpression)
    ) {
      reads.push({ name: node.argumentExpression.text, node });
    }
  });
  return reads;
}

function stringLiteralValue(node) {
  const current = unwrapExpression(node);
  return current && ts.isStringLiteralLike(current) ? current.text : null;
}

function binaryExpression(node, operator) {
  const current = unwrapExpression(node);
  return Boolean(
    current &&
    ts.isBinaryExpression(current) &&
    current.operatorToken.kind === operator,
  );
}

function returnExpression(statement) {
  return ts.isReturnStatement(statement)
    ? unwrapExpression(statement.expression)
    : null;
}

function throwMessage(statement) {
  if (!ts.isThrowStatement(statement) || !statement.expression) {
    return null;
  }
  const expression = unwrapExpression(statement.expression);
  if (!expression || !ts.isNewExpression(expression)) {
    return null;
  }
  if (expressionPath(expression.expression) !== "Error") {
    return null;
  }
  return stringLiteralValue(expression.arguments?.[0]);
}

function statementList(statement) {
  if (!statement) {
    return [];
  }
  return ts.isBlock(statement) ? [...statement.statements] : [statement];
}

function objectProperty(objectLiteral, name) {
  const current = unwrapExpression(objectLiteral);
  if (!current || !ts.isObjectLiteralExpression(current)) {
    return null;
  }
  const property = current.properties.find(
    (candidate) =>
      (ts.isPropertyAssignment(candidate) ||
        ts.isShorthandPropertyAssignment(candidate)) &&
      propertyName(candidate.name) === name,
  );
  if (!property) {
    return null;
  }
  return ts.isPropertyAssignment(property)
    ? unwrapExpression(property.initializer)
    : property.name;
}

function normalizedPath(filePath) {
  return filePath.split(path.sep).join("/");
}

module.exports = {
  binaryExpression,
  callExpressions,
  callPath,
  descendants,
  directCallStatements,
  expressionPath,
  findClass,
  findFunction,
  findMethod,
  moduleReferences,
  normalizedPath,
  objectProperty,
  parseTypeScript,
  processEnvReads,
  propertyName,
  returnExpression,
  statementList,
  stringLiteralValue,
  throwMessage,
  ts,
  unwrapExpression,
  visit,
};
