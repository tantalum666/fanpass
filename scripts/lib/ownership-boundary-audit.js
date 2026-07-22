const {
  callExpressions,
  callPath,
  descendants,
  expressionPath,
  findClass,
  findFunction,
  findMethod,
  parseTypeScript,
  propertyName,
  statementList,
  stringLiteralValue,
  throwMessage,
  ts,
  unwrapExpression,
} = require("./typescript-audit");

const MOCK_ERROR =
  "OWNERSHIP_ADAPTER=mock is forbidden in production-like environments";
const TESTNET_ERROR_PREFIX =
  "OWNERSHIP_ADAPTER=testnet is blocked in production-like environments";

function validateOwnershipBoundary({
  ownershipFile,
  ownershipContents,
  securityConfigFile,
  securityConfigContents,
}) {
  const errors = [];
  let ownership;
  let securityConfig;
  try {
    ownership = parseTypeScript(ownershipFile, ownershipContents);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    securityConfig = parseTypeScript(
      securityConfigFile,
      securityConfigContents,
    );
  } catch (error) {
    errors.push(error.message);
  }
  if (!ownership || !securityConfig) {
    return { errors, proof: null };
  }

  const ownershipProof = validateOwnershipAdapter(ownership, ownershipFile);
  const startupProof = validateStartupGuard(securityConfig, securityConfigFile);
  errors.push(...ownershipProof.errors, ...startupProof.errors);
  return {
    errors,
    proof: {
      runtimeMockRejected: ownershipProof.runtimeMockRejected,
      runtimeUnsafeTestnetRejected: ownershipProof.runtimeUnsafeTestnetRejected,
      runtimePrivySelected: ownershipProof.runtimePrivySelected,
      startupMockRejected: startupProof.startupMockRejected,
      startupUnsafeTestnetRejected: startupProof.startupUnsafeTestnetRejected,
      startupGuardReachable: startupProof.startupGuardReachable,
    },
  };
}

function validateOwnershipAdapter(sourceFile, fileName) {
  const errors = [];
  const ownershipClass = findClass(sourceFile, "OwnershipService");
  const adapterMethod = findMethod(ownershipClass, "adapter");
  if (!adapterMethod?.body) {
    errors.push(`${fileName} must define OwnershipService.adapter().`);
    return emptyRuntimeProof(errors);
  }

  const statements = [...adapterMethod.body.statements];
  const adapterDeclaration = directVariableDeclaration(
    statements,
    "adapter",
    (declaration) =>
      callExpressions(declaration, "this.config.get").some(
        (call) => stringLiteralValue(call.arguments[0]) === "OWNERSHIP_ADAPTER",
      ),
  );
  if (!adapterDeclaration) {
    errors.push(
      `${fileName} OwnershipService.adapter() must select from this.config.get("OWNERSHIP_ADAPTER").`,
    );
  }
  const privyBranch = statements.find(
    (statement) =>
      ts.isIfStatement(statement) &&
      isAdapterComparison(
        statement.expression,
        "privy",
        ts.SyntaxKind.EqualsEqualsEqualsToken,
      ),
  );
  const mockBranch = statements.find(
    (statement) =>
      ts.isIfStatement(statement) &&
      isAdapterComparison(
        statement.expression,
        "mock",
        ts.SyntaxKind.EqualsEqualsEqualsToken,
      ),
  );
  const invalidAdapterBranch = statements.find(
    (statement) =>
      ts.isIfStatement(statement) &&
      isAdapterComparison(
        statement.expression,
        "testnet",
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ),
  );
  const testnetGuard = statements.find(
    (statement) =>
      ts.isIfStatement(statement) &&
      isUnsafeProductionTestnetCondition(statement.expression),
  );

  const runtimePrivySelected = branchReturnsNewClass(
    privyBranch,
    "PrivySponsoredOwnershipAdapter",
  );
  if (!runtimePrivySelected) {
    errors.push(
      `${fileName} must select PrivySponsoredOwnershipAdapter from the executable adapter === "privy" branch.`,
    );
  }

  const mockStatements = statementList(mockBranch?.thenStatement);
  const productionMockGuard = mockStatements.find(
    (statement) =>
      ts.isIfStatement(statement) &&
      isCall(statement.expression, "this.productionLike") &&
      branchThrowsMessage(statement, MOCK_ERROR),
  );
  const runtimeMockRejected = Boolean(productionMockGuard);
  if (!runtimeMockRejected) {
    errors.push(
      `${fileName} must throw from the executable adapter === "mock" branch when this.productionLike() is true.`,
    );
  }
  if (!branchReturnsNewClass(mockBranch, "MockOwnershipAdapter")) {
    errors.push(
      `${fileName} must return MockOwnershipAdapter only after the production-like rejection inside the mock branch.`,
    );
  }
  const mockGuardIndex = mockStatements.indexOf(productionMockGuard);
  const mockReturnIndex = mockStatements.findIndex((statement) =>
    statementReturnsNewClass(statement, "MockOwnershipAdapter"),
  );
  if (
    mockGuardIndex === -1 ||
    mockReturnIndex === -1 ||
    mockReturnIndex <= mockGuardIndex ||
    hasUnconditionalTerminationBefore(mockStatements, mockGuardIndex)
  ) {
    errors.push(
      `${fileName} must execute the production-like rejection before returning MockOwnershipAdapter.`,
    );
  }

  if (!invalidAdapterBranch || !branchThrows(invalidAdapterBranch)) {
    errors.push(
      `${fileName} must throw from the executable adapter !== "testnet" branch instead of falling through to a signer.`,
    );
  }

  const runtimeUnsafeTestnetRejected =
    Boolean(testnetGuard) &&
    branchThrowsMessagePrefix(testnetGuard, TESTNET_ERROR_PREFIX);
  if (!runtimeUnsafeTestnetRejected) {
    errors.push(
      `${fileName} must throw from an executable productionLike && !privateKeyTestnetWritesAllowed testnet branch.`,
    );
  }

  const testnetGuardIndex = statements.indexOf(testnetGuard);
  const testnetReturnIndex = statements.findIndex((statement) =>
    statementReturnsNewClass(statement, "TestnetOwnershipAdapter"),
  );
  if (
    testnetGuardIndex === -1 ||
    testnetReturnIndex === -1 ||
    testnetReturnIndex <= testnetGuardIndex
  ) {
    errors.push(
      `${fileName} must reach TestnetOwnershipAdapter only after the production-like private-key guard.`,
    );
  }
  for (const [label, branch] of [
    ["Privy", privyBranch],
    ["mock", mockBranch],
    ["invalid-adapter", invalidAdapterBranch],
    ["unsafe-testnet", testnetGuard],
  ]) {
    const index = statements.indexOf(branch);
    if (index !== -1 && hasUnconditionalTerminationBefore(statements, index)) {
      errors.push(
        `${fileName} ${label} ownership branch must be reachable before any unconditional return or throw.`,
      );
    }
  }

  const productionLikeMethod = findMethod(ownershipClass, "productionLike");
  if (
    !productionLikeMethod?.body ||
    !directReturnCalls(productionLikeMethod.body, "isProductionLikeEnvironment")
  ) {
    errors.push(
      `${fileName} productionLike() must execute isProductionLikeEnvironment().`,
    );
  }
  const privateKeyPermissionMethod = findMethod(
    ownershipClass,
    "privateKeyTestnetWritesAllowed",
  );
  if (
    !privateKeyPermissionMethod?.body ||
    !directReturnCalls(
      privateKeyPermissionMethod.body,
      "allowsPrivateKeyTestnetWrites",
    )
  ) {
    errors.push(
      `${fileName} privateKeyTestnetWritesAllowed() must execute allowsPrivateKeyTestnetWrites().`,
    );
  }

  return {
    errors,
    runtimeMockRejected,
    runtimePrivySelected,
    runtimeUnsafeTestnetRejected,
  };
}

function validateStartupGuard(sourceFile, fileName) {
  const errors = [];
  const validateEnvironment = findFunction(sourceFile, "validateEnvironment");
  const validateOwnership = findFunction(
    sourceFile,
    "validateOwnershipConfiguration",
  );
  if (!validateEnvironment?.body || !validateOwnership?.body) {
    errors.push(
      `${fileName} must define validateEnvironment() and validateOwnershipConfiguration().`,
    );
    return emptyStartupProof(errors);
  }

  const productionBranch = validateEnvironment.body.statements.find(
    (statement) =>
      ts.isIfStatement(statement) &&
      expressionPath(unwrapExpression(statement.expression)) ===
        "productionLike",
  );
  const startupGuardReachable = Boolean(
    productionBranch &&
    directStatementsContainCall(
      statementList(productionBranch.thenStatement),
      "validateOwnershipConfiguration",
      ["config", "errors"],
    ),
  );
  const environmentStatements = [...validateEnvironment.body.statements];
  const productionDeclaration = directVariableDeclaration(
    environmentStatements,
    "productionLike",
    (declaration) =>
      callExpressions(declaration, "isProductionLikeEnvironment").some(
        (call) =>
          expressionPath(unwrapExpression(call.arguments[0])) === "config",
      ),
  );
  if (!productionDeclaration) {
    errors.push(
      `${fileName} validateEnvironment() must derive productionLike from isProductionLikeEnvironment(config).`,
    );
  }
  if (!startupGuardReachable) {
    errors.push(
      `${fileName} must call validateOwnershipConfiguration(config, errors) directly from the executable productionLike branch.`,
    );
  }
  const productionDeclarationIndex = environmentStatements.findIndex(
    (statement) =>
      statementContainsDeclaration(statement, productionDeclaration),
  );
  const productionBranchIndex = environmentStatements.indexOf(productionBranch);
  if (
    productionDeclarationIndex === -1 ||
    productionBranchIndex <= productionDeclarationIndex ||
    hasUnconditionalTerminationBefore(
      environmentStatements,
      productionBranchIndex,
    )
  ) {
    errors.push(
      `${fileName} productionLike ownership validation must be reachable after the production-like environment is derived.`,
    );
  }

  const ownershipStatements = [...validateOwnership.body.statements];
  const adapterDeclaration = directVariableDeclaration(
    ownershipStatements,
    "adapter",
    (declaration) =>
      callExpressions(declaration, "rawStringValue").some(
        (call) =>
          expressionPath(unwrapExpression(call.arguments[0])) ===
          "config.OWNERSHIP_ADAPTER",
      ),
  );
  if (!adapterDeclaration) {
    errors.push(
      `${fileName} validateOwnershipConfiguration() must read config.OWNERSHIP_ADAPTER through rawStringValue().`,
    );
  }
  const mockBranch = ownershipStatements.find(
    (statement) =>
      ts.isIfStatement(statement) &&
      isAdapterComparison(
        statement.expression,
        "mock",
        ts.SyntaxKind.EqualsEqualsEqualsToken,
      ),
  );
  const startupMockRejected = branchPushesError(mockBranch, MOCK_ERROR);
  if (!startupMockRejected) {
    errors.push(
      `${fileName} must push the mock-adapter production error from an executable adapter === "mock" branch.`,
    );
  }

  const testnetBranch = ownershipStatements.find(
    (statement) =>
      ts.isIfStatement(statement) &&
      isNegatedCall(statement.expression, "allowsPrivateKeyTestnetWrites"),
  );
  const startupUnsafeTestnetRejected = branchPushesErrorPrefix(
    testnetBranch,
    TESTNET_ERROR_PREFIX,
  );
  if (!startupUnsafeTestnetRejected) {
    errors.push(
      `${fileName} must push the testnet production error from an executable !allowsPrivateKeyTestnetWrites(config) branch.`,
    );
  }
  for (const [label, branch] of [
    ["mock", mockBranch],
    ["unsafe-testnet", testnetBranch],
  ]) {
    const index = ownershipStatements.indexOf(branch);
    if (
      index !== -1 &&
      hasUnconditionalTerminationBefore(ownershipStatements, index)
    ) {
      errors.push(
        `${fileName} ${label} startup ownership branch must be reachable before any unconditional return or throw.`,
      );
    }
  }

  return {
    errors,
    startupGuardReachable,
    startupMockRejected,
    startupUnsafeTestnetRejected,
  };
}

function isAdapterComparison(expression, expectedValue, operatorKind) {
  const current = unwrapExpression(expression);
  if (!current || !ts.isBinaryExpression(current)) {
    return false;
  }
  if (current.operatorToken.kind !== operatorKind) {
    return false;
  }
  const left = unwrapExpression(current.left);
  const right = unwrapExpression(current.right);
  return (
    (expressionPath(left) === "adapter" &&
      stringLiteralValue(right) === expectedValue) ||
    (expressionPath(right) === "adapter" &&
      stringLiteralValue(left) === expectedValue)
  );
}

function isUnsafeProductionTestnetCondition(expression) {
  const current = unwrapExpression(expression);
  if (
    !current ||
    !ts.isBinaryExpression(current) ||
    current.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return false;
  }
  return (
    isCall(current.left, "this.productionLike") &&
    isNegatedCall(current.right, "this.privateKeyTestnetWritesAllowed")
  );
}

function isNegatedCall(expression, expectedPath) {
  const current = unwrapExpression(expression);
  return Boolean(
    current &&
    ts.isPrefixUnaryExpression(current) &&
    current.operator === ts.SyntaxKind.ExclamationToken &&
    isCall(current.operand, expectedPath),
  );
}

function isCall(expression, expectedPath) {
  const current = unwrapExpression(expression);
  return Boolean(
    current &&
    ts.isCallExpression(current) &&
    callPath(current) === expectedPath,
  );
}

function branchReturnsNewClass(ifStatement, className) {
  return statementList(ifStatement?.thenStatement).some((statement) =>
    statementReturnsNewClass(statement, className),
  );
}

function statementReturnsNewClass(statement, className) {
  if (!ts.isReturnStatement(statement) || !statement.expression) {
    return false;
  }
  const expression = unwrapExpression(statement.expression);
  return Boolean(
    expression &&
    ts.isNewExpression(expression) &&
    expressionPath(expression.expression) === className,
  );
}

function branchThrows(ifStatement) {
  return statementList(ifStatement?.thenStatement).some((statement) =>
    Boolean(throwMessage(statement)),
  );
}

function branchThrowsMessage(ifStatement, expectedMessage) {
  return statementList(ifStatement?.thenStatement).some(
    (statement) => throwMessage(statement) === expectedMessage,
  );
}

function branchThrowsMessagePrefix(ifStatement, prefix) {
  return statementList(ifStatement?.thenStatement).some((statement) =>
    String(throwMessage(statement) ?? "").startsWith(prefix),
  );
}

function branchPushesError(ifStatement, expectedMessage) {
  return branchPushesErrorPrefix(ifStatement, expectedMessage, true);
}

function branchPushesErrorPrefix(ifStatement, expectedMessage, exact = false) {
  return statementList(ifStatement?.thenStatement).some((statement) => {
    if (!ts.isExpressionStatement(statement)) {
      return false;
    }
    const expression = unwrapExpression(statement.expression);
    if (
      !expression ||
      !ts.isCallExpression(expression) ||
      callPath(expression) !== "errors.push"
    ) {
      return false;
    }
    const message = stringLiteralValue(expression.arguments[0]);
    return exact
      ? message === expectedMessage
      : String(message ?? "").startsWith(expectedMessage);
  });
}

function directStatementsContainCall(statements, expectedPath, expectedArgs) {
  return statements.some((statement) => {
    if (!ts.isExpressionStatement(statement)) {
      return false;
    }
    const expression = unwrapExpression(statement.expression);
    if (
      !expression ||
      !ts.isCallExpression(expression) ||
      callPath(expression) !== expectedPath
    ) {
      return false;
    }
    return expectedArgs.every(
      (expected, index) =>
        expressionPath(unwrapExpression(expression.arguments[index])) ===
        expected,
    );
  });
}

function hasUnconditionalTerminationBefore(statements, index) {
  return statements
    .slice(0, index)
    .some(
      (statement) =>
        ts.isReturnStatement(statement) || ts.isThrowStatement(statement),
    );
}

function directVariableDeclaration(statements, name, predicate) {
  for (const statement of statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        propertyName(declaration.name) === name &&
        (!predicate || predicate(declaration))
      ) {
        return declaration;
      }
    }
  }
  return null;
}

function statementContainsDeclaration(statement, declaration) {
  return Boolean(
    declaration &&
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(
      (candidate) => candidate === declaration,
    ),
  );
}

function directReturnCalls(body, expectedPath) {
  return body.statements.some(
    (statement) =>
      ts.isReturnStatement(statement) &&
      callExpressions(statement, expectedPath).length > 0,
  );
}

function emptyRuntimeProof(errors) {
  return {
    errors,
    runtimeMockRejected: false,
    runtimePrivySelected: false,
    runtimeUnsafeTestnetRejected: false,
  };
}

function emptyStartupProof(errors) {
  return {
    errors,
    startupGuardReachable: false,
    startupMockRejected: false,
    startupUnsafeTestnetRejected: false,
  };
}

module.exports = {
  MOCK_ERROR,
  TESTNET_ERROR_PREFIX,
  validateOwnershipBoundary,
};
