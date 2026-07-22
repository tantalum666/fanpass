#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { isDeepStrictEqual } = require("util");
const yaml = require("js-yaml");
const {
  expressionPath,
  parseTypeScript,
  ts,
  unwrapExpression,
} = require("./lib/typescript-audit");
const {
  BETA_FOUNDATION_ENTRYPOINT,
  HOSTED_BETA_FOUNDATION_BOOTSTRAP,
  HOSTED_BETA_FOUNDATION_SHELL,
  REVIEWED_BETA_FOUNDATION_ENTRYPOINT_SHA256,
} = require("./lib/beta-foundation-bootstrap");

const hostedGateSteps = [
  {
    name: "Verify Beta foundation",
    shell: HOSTED_BETA_FOUNDATION_SHELL,
    run: HOSTED_BETA_FOUNDATION_BOOTSTRAP,
  },
];
const pinnedCheckoutAction =
  "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5";
const pinnedSetupNodeAction =
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020";

const requiredCompositeVerifierSteps = [
  {
    label: "Root deterministic dependency install",
    kind: "npm",
    args: ["ci", "--include=dev"],
  },
  {
    label: "Console Auth deterministic dependency install",
    kind: "npm",
    args: ["--prefix", "apps/console-auth", "ci", "--include=dev"],
  },
  {
    label: "Beta foundation launcher self-test",
    kind: "node",
    args: ["scripts/beta-foundation-launcher-self-test.js"],
  },
  {
    label: "Beta foundation runner self-test",
    kind: "node",
    args: ["scripts/beta-foundation-verify-self-test.js"],
  },
  {
    label: "API Prisma client generation",
    kind: "npm",
    args: ["run", "prisma:generate", "-w", "apps/api"],
  },
  {
    label: "Bootstrap disposable Prisma schema",
    kind: "npm",
    args: ["run", "prisma:push:raw", "-w", "apps/api", "--", "--force-reset"],
  },
  {
    label: "Apply post-identity schema chain",
    kind: "npm",
    args: ["run", "prisma:after-identity", "-w", "apps/api"],
  },
  {
    label: "Verify on-sale concurrency invariants",
    kind: "npm",
    args: [
      "run",
      "test",
      "-w",
      "apps/api",
      "--",
      "--runTestsByPath",
      "test/onsales-prisma-concurrency.spec.ts",
    ],
  },
  {
    label: "Alpha database reset safety self-test",
    kind: "npm",
    args: ["run", "alpha:db:reset:self-test"],
  },
  {
    label: "CI Node 22 workflow audit self-test",
    kind: "npm",
    args: ["run", "security:ci-node22-workflow:self-test"],
  },
  {
    label: "CI Node 22 workflow audit",
    kind: "npm",
    args: ["run", "security:ci-node22-workflow"],
  },
  {
    label: "Render RC configuration audit self-test",
    kind: "npm",
    args: ["run", "security:render-rc-config:self-test"],
  },
  {
    label: "Render RC configuration audit",
    kind: "npm",
    args: ["run", "security:render-rc-config"],
  },
  {
    label: "Console Auth typecheck",
    kind: "npm",
    args: ["--prefix", "apps/console-auth", "run", "typecheck"],
  },
  {
    label: "Console Auth unit tests",
    kind: "npm",
    args: ["--prefix", "apps/console-auth", "test"],
  },
];

const rootDir = process.env.FANPASS_CI_NODE22_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_CI_NODE22_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

auditWorkflow();
auditPackageScripts();
auditDbReset();
auditLauncher();
auditCompositeVerifier();
auditDocs();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      workflow: ".github/workflows/beta-foundation.yml",
      node: "Node 22 from .nvmrc",
      verifier: `env-i isolated Node 22 ${BETA_FOUNDATION_ENTRYPOINT}`,
      database: "local postgres:16-alpine service",
    },
    null,
    2,
  ),
);

function auditWorkflow() {
  const workflowPath = ".github/workflows/beta-foundation.yml";
  const workflow = readFile(workflowPath);
  rejectMarkers(workflowPath, workflow, [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "PRIVY_VERIFICATION_KEY",
    "PRIVY_APP_SECRET",
    "OWNERSHIP_OPERATOR_PRIVATE_KEY",
    "secrets.",
    "npm install",
    "actions/checkout@v4",
    "actions/setup-node@v4",
    "/usr/bin/env node scripts/beta-foundation-verify.js",
    '"$node_real" scripts/beta-foundation-verify.js',
  ]);

  let parsed;
  try {
    parsed = yaml.load(workflow, { schema: yaml.FAILSAFE_SCHEMA });
  } catch (error) {
    errors.push(`${workflowPath} must be valid YAML: ${error.message}`);
    return;
  }
  const expected = expectedWorkflowDocument();
  if (!isDeepStrictEqual(parsed, expected)) {
    errors.push(
      `${workflowPath} must match the exact reviewed job, permissions, PostgreSQL service, environment, pinned actions, ordered fail-closed steps, and launcher bootstrap.`,
    );
  }

  auditHostedGateSteps(workflowPath, workflow);
}

function expectedWorkflowDocument() {
  return {
    name: "FanPass Beta Foundation",
    on: {
      pull_request: null,
      push: { branches: ["main", "codex/security-rc-*"] },
      workflow_dispatch: null,
    },
    jobs: {
      "beta-foundation": {
        name: "Node 22 foundation gates",
        "runs-on": "ubuntu-latest",
        "timeout-minutes": "30",
        permissions: { contents: "read" },
        services: {
          postgres: {
            image: "postgres:16-alpine",
            env: {
              POSTGRES_USER: "fanpass",
              POSTGRES_PASSWORD: "fanpass",
              POSTGRES_DB: "fanpass",
            },
            ports: ["5432:5432"],
            options:
              '--health-cmd "pg_isready -U fanpass -d fanpass" --health-interval 10s --health-timeout 5s --health-retries 5',
          },
        },
        env: {
          DATABASE_URL: "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass",
          FANPASS_DATA_SOURCE: "prisma",
          FANPASS_SKIP_DOCKER_POSTGRES: "true",
          FANPASS_STRICT_NODE_RUNTIME: "true",
        },
        steps: [
          { name: "Checkout", uses: pinnedCheckoutAction },
          {
            name: "Setup Node 22",
            uses: pinnedSetupNodeAction,
            with: { "node-version-file": ".nvmrc", cache: "npm" },
          },
          ...hostedGateSteps,
        ],
      },
    },
  };
}

function auditLauncher() {
  const launcherPath = BETA_FOUNDATION_ENTRYPOINT;
  const contents = readFile(launcherPath);
  const actualSha256 = require("crypto")
    .createHash("sha256")
    .update(contents)
    .digest("hex");
  assert(
    actualSha256 === REVIEWED_BETA_FOUNDATION_ENTRYPOINT_SHA256,
    `${launcherPath} digest ${actualSha256} does not match the reviewed launcher digest ${REVIEWED_BETA_FOUNDATION_ENTRYPOINT_SHA256}`,
  );
  requireMarkers(launcherPath, contents, [
    'const runnerRelativePath = "scripts/beta-foundation-verify.js"',
    '"scripts/local-postgres-target-guard.js"',
    "reviewedRunnerSha256",
    "reviewedLocalTargetGuardSha256",
    "reviewedPackageScriptsSha256",
    "reviewedDependencyInputsSha256",
    '"package.json"',
    '"apps/api/package.json"',
    '"apps/dashboard/package.json"',
    '"apps/console-auth/package.json"',
    "validateReviewedRunner();",
    "validatePackageScripts();",
    "validateDependencyInputs();",
    "executeReviewedRunner(reviewed",
    "runner.configureRuntimeIntegrityCheck",
  ]);
}

function auditHostedGateSteps(workflowPath, workflow) {
  let parsed;
  try {
    parsed = yaml.load(workflow, { schema: yaml.FAILSAFE_SCHEMA });
  } catch (error) {
    errors.push(`${workflowPath} must be valid YAML: ${error.message}`);
    return;
  }

  const steps = parsed?.jobs?.["beta-foundation"]?.steps;
  if (!Array.isArray(steps)) {
    errors.push(
      `${workflowPath} must define jobs.beta-foundation.steps as a YAML sequence.`,
    );
    return;
  }

  let previousIndex = -1;
  for (const expectedStep of hostedGateSteps) {
    const matchingIndexes = [];
    for (const [index, step] of steps.entries()) {
      if (isPlainObject(step) && step.name === expectedStep.name) {
        matchingIndexes.push(index);
      }
    }

    if (matchingIndexes.length !== 1) {
      errors.push(
        `${workflowPath} must contain exactly one hosted step named "${expectedStep.name}"; found ${matchingIndexes.length}.`,
      );
      continue;
    }

    const index = matchingIndexes[0];
    const step = steps[index];
    if (step.run !== expectedStep.run) {
      errors.push(
        `${workflowPath} step "${expectedStep.name}" must run exactly: ${expectedStep.run}`,
      );
    }

    if ((step.shell ?? null) !== (expectedStep.shell ?? null)) {
      errors.push(
        `${workflowPath} step "${expectedStep.name}" must use shell ${expectedStep.shell ?? "default"}.`,
      );
    }

    const unexpectedKeys = Object.keys(step).filter(
      (key) =>
        key !== "name" &&
        key !== "run" &&
        !(key === "shell" && expectedStep.shell),
    );
    if (unexpectedKeys.length > 0) {
      errors.push(
        `${workflowPath} step "${expectedStep.name}" must be unconditional and fail-closed; unexpected keys: ${unexpectedKeys.join(", ")}.`,
      );
    }

    if (index <= previousIndex) {
      errors.push(
        `${workflowPath} hosted steps must run in this order: ${hostedGateSteps.map(({ name }) => name).join(" -> ")}.`,
      );
    }
    previousIndex = Math.max(previousIndex, index);
  }
}

function auditPackageScripts() {
  const packageJson = JSON.parse(readFile("package.json"));
  assert(
    packageJson.scripts?.["beta:foundation:verify"] === undefined,
    "package.json must not expose the security gate through npm run",
  );
  assert(
    packageJson.scripts?.["security:ci-node22-workflow"] ===
      "node scripts/ci-node22-workflow-audit.js",
    "package.json missing security:ci-node22-workflow script",
  );
  assert(
    packageJson.scripts?.["security:ci-node22-workflow:self-test"] ===
      "node scripts/ci-node22-workflow-audit-self-test.js",
    "package.json missing security:ci-node22-workflow:self-test script",
  );
  assert(
    packageJson.scripts?.["alpha:db:reset:self-test"] ===
      "node scripts/alpha-db-reset-self-test.js",
    "package.json missing alpha:db:reset:self-test script",
  );
}

function auditDbReset() {
  requireMarkers(
    "scripts/alpha-db-reset.sh",
    readFile("scripts/alpha-db-reset.sh"),
    [
      "FANPASS_SKIP_DOCKER_POSTGRES",
      '[[ "${FANPASS_SKIP_DOCKER_POSTGRES:-false}" != "true" ]]',
      "docker compose up -d postgres",
      'ALPHA_RESET_EXPECTED_DATABASE="fanpass"',
      "assert_local_database_target",
      'const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"])',
      "const allowedLocalQueryParameters = new Set([",
      "!allowedHosts.has(explicitHost)",
      "Alpha database reset refused",
    ],
  );
}

function auditCompositeVerifier() {
  const verifierPath = "scripts/beta-foundation-verify.js";
  const contents = readFile(verifierPath);
  const gateSteps = parseTypedGateSteps(verifierPath, contents);
  if (gateSteps) {
    auditRequiredCompositeVerifierSteps(verifierPath, gateSteps);
  }
  auditHardenedEnvironment(verifierPath, contents);
  for (const marker of [
    "shell: false",
    'process.versions.node.split(".")[0] !== "22"',
    '"--script-shell=/bin/sh"',
  ]) {
    if (!contents.includes(marker)) {
      errors.push(
        `scripts/beta-foundation-verify.js is missing hardened runner marker: ${marker}`,
      );
    }
  }
}

function auditHardenedEnvironment(relativePath, contents) {
  let sourceFile;
  try {
    sourceFile = parseTypeScript(relativePath, contents);
  } catch (error) {
    errors.push(error.message);
    return;
  }
  const functionNode = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "buildHardenedEnvironment",
  );
  if (!functionNode?.body) {
    errors.push(`${relativePath} must define buildHardenedEnvironment.`);
    return;
  }
  const expectedKeys = [
    "CI",
    "DATABASE_URL",
    "FANPASS_DATA_SOURCE",
    "FANPASS_GATE_HARDENED",
    "FANPASS_SKIP_DOCKER_POSTGRES",
    "FANPASS_STRICT_NODE_RUNTIME",
    "GITHUB_ACTIONS",
    "HOME",
    "NPM_CONFIG_SCRIPT_SHELL",
    "PATH",
    "RUNNER_TEMP",
    "TMPDIR",
    "npm_config_script_shell",
  ].sort();
  const observedKeys = [];
  let invalidShape = false;
  visitNode(functionNode.body, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "env"
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
        invalidShape = true;
        return;
      }
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) {
          invalidShape = true;
          continue;
        }
        const key = staticPropertyName(property.name);
        if (!key) {
          invalidShape = true;
        } else {
          observedKeys.push(key);
        }
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const left = unwrapExpression(node.left);
      if (
        ts.isPropertyAccessExpression(left) &&
        ts.isIdentifier(left.expression) &&
        left.expression.text === "env"
      ) {
        observedKeys.push(left.name.text);
      } else if (
        ts.isElementAccessExpression(left) &&
        ts.isIdentifier(left.expression) &&
        left.expression.text === "env"
      ) {
        invalidShape = true;
      }
    }
  });
  if (
    invalidShape ||
    JSON.stringify([...new Set(observedKeys)].sort()) !==
      JSON.stringify(expectedKeys)
  ) {
    errors.push(
      `${relativePath} hardened environment must expose exactly: ${expectedKeys.join(", ")}.`,
    );
  }
  requireMarkers(relativePath, contents, [
    'isAllowedLocalPostgresTarget(databaseUrl, "fanpass")',
    'FANPASS_DATA_SOURCE: "prisma"',
    'FANPASS_SKIP_DOCKER_POSTGRES: "true"',
    'FANPASS_STRICT_NODE_RUNTIME: "true"',
    'fs.mkdtempSync("/tmp/fanpass-beta-gate-")',
    "fs.chmodSync(isolationRoot, 0o700)",
  ]);
}

function visitNode(node, callback) {
  callback(node);
  ts.forEachChild(node, (child) => visitNode(child, callback));
}

function staticPropertyName(node) {
  return ts.isIdentifier(node) || ts.isStringLiteralLike(node)
    ? node.text
    : null;
}

function parseTypedGateSteps(relativePath, contents) {
  let sourceFile;
  try {
    sourceFile = parseTypeScript(relativePath, contents);
  } catch (error) {
    errors.push(error.message);
    return null;
  }

  const declarations = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "gateSteps"
      ) {
        declarations.push({
          declaration,
          isConst: Boolean(
            statement.declarationList.flags & ts.NodeFlags.Const,
          ),
        });
      }
    }
  }

  if (declarations.length !== 1) {
    errors.push(
      `${relativePath} must define exactly one top-level gateSteps declaration; found ${declarations.length}.`,
    );
    return null;
  }
  if (!declarations[0].isConst) {
    errors.push(`${relativePath} gateSteps must be declared with const.`);
    return null;
  }

  const initializer = unwrapExpression(declarations[0].declaration.initializer);
  if (
    !initializer ||
    !ts.isCallExpression(initializer) ||
    expressionPath(initializer.expression) !== "Object.freeze" ||
    initializer.arguments.length !== 1
  ) {
    errors.push(
      `${relativePath} gateSteps must be initialized by exactly one Object.freeze array.`,
    );
    return null;
  }
  const array = unwrapExpression(initializer.arguments[0]);
  if (!array || !ts.isArrayLiteralExpression(array)) {
    errors.push(
      `${relativePath} gateSteps must be initialized by exactly one Object.freeze array.`,
    );
    return null;
  }

  const helperKinds = new Map([
    ["npmStep", "npm"],
    ["nodeStep", "node"],
    ["shStep", "sh"],
  ]);
  const steps = [];
  for (const element of array.elements) {
    const call = unwrapExpression(element);
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) {
      errors.push(
        `${relativePath} gateSteps may contain only typed helper calls with literal arguments.`,
      );
      return null;
    }
    const kind = helperKinds.get(call.expression.text);
    const values = call.arguments.map((argument) => {
      const value = unwrapExpression(argument);
      return value && ts.isStringLiteralLike(value) ? value.text : null;
    });
    if (!kind || values.length < 2 || values.some((value) => value === null)) {
      errors.push(
        `${relativePath} gateSteps may contain only npmStep, nodeStep, or shStep calls with literal label and argv values.`,
      );
      return null;
    }
    steps.push({ label: values[0], kind, args: values.slice(1) });
  }

  const labels = new Set();
  for (const step of steps) {
    if (labels.has(step.label)) {
      errors.push(
        `${relativePath} gateSteps must not contain duplicate label: ${step.label}`,
      );
      return null;
    }
    labels.add(step.label);
  }
  return steps;
}

function auditRequiredCompositeVerifierSteps(relativePath, gateSteps) {
  const indexes = new Map();
  let previousIndex = -1;

  for (const expected of requiredCompositeVerifierSteps) {
    const matchingIndexes = gateSteps.flatMap((step, index) =>
      step.label === expected.label ? [index] : [],
    );
    if (matchingIndexes.length !== 1) {
      errors.push(
        `${relativePath} must contain exactly one typed gate step named "${expected.label}"; found ${matchingIndexes.length}.`,
      );
      continue;
    }

    const index = matchingIndexes[0];
    const actual = gateSteps[index];
    indexes.set(expected.label, index);
    if (
      actual.kind !== expected.kind ||
      JSON.stringify(actual.args) !== JSON.stringify(expected.args)
    ) {
      errors.push(
        `${relativePath} gate step "${expected.label}" must use ${expected.kind} with argv: ${expected.args.join(" ")}.`,
      );
    }
    if (index <= previousIndex) {
      errors.push(
        `${relativePath} required gate steps must run in this order: ${requiredCompositeVerifierSteps.map(({ label }) => label).join(" -> ")}.`,
      );
    }
    previousIndex = Math.max(previousIndex, index);
  }

  if (indexes.get("Root deterministic dependency install") !== 0) {
    errors.push(
      `${relativePath} must run the root deterministic install as the first gate step.`,
    );
  }
  if (indexes.get("Console Auth deterministic dependency install") !== 1) {
    errors.push(
      `${relativePath} must install isolated Console Auth dependencies second.`,
    );
  }
  if (indexes.get("Beta foundation launcher self-test") !== 2) {
    errors.push(
      `${relativePath} must run the launcher self-test immediately after both deterministic installs.`,
    );
  }
  if (indexes.get("Beta foundation runner self-test") !== 3) {
    errors.push(
      `${relativePath} must run the runner self-test immediately after the launcher self-test.`,
    );
  }
  if (indexes.get("API Prisma client generation") !== 4) {
    errors.push(
      `${relativePath} must generate the API Prisma client immediately after the runner self-test.`,
    );
  }
  requireAdjacentSteps(
    relativePath,
    indexes,
    "CI Node 22 workflow audit self-test",
    "CI Node 22 workflow audit",
  );
  requireAdjacentSteps(
    relativePath,
    indexes,
    "Console Auth typecheck",
    "Console Auth unit tests",
  );
}

function requireAdjacentSteps(relativePath, indexes, firstLabel, secondLabel) {
  const first = indexes.get(firstLabel);
  const second = indexes.get(secondLabel);
  if (
    Number.isInteger(first) &&
    Number.isInteger(second) &&
    second !== first + 1
  ) {
    errors.push(
      `${relativePath} must run "${secondLabel}" immediately after "${firstLabel}".`,
    );
  }
}

function auditDocs() {
  requireMarkers("README.md", readFile("README.md"), [
    "/usr/bin/env -i",
    'crypto.createHash("sha256")',
    REVIEWED_BETA_FOUNDATION_ENTRYPOINT_SHA256,
    "/opt/homebrew/opt/node@22/bin/node -e",
    'loaded._compile(source.toString("utf8"),file)',
    "NODE_OPTIONS",
    "NODE_PATH",
  ]);
  requireMarkers("docs/QA_CHECKLIST.md", readFile("docs/QA_CHECKLIST.md"), [
    "complete `/usr/bin/env -i`",
    "NODE_OPTIONS",
    "NODE_PATH",
    "$RUNNER_TOOL_CACHE",
  ]);
  for (const file of [
    "docs/QA_CHECKLIST.md",
    "docs/BETA_ROADMAP.md",
    "docs/ALPHA_SECURITY_REVIEW.md",
    "docs/CODEX_HANDOFF.md",
    "docs/DEVELOPMENT_TASKS.md",
    "docs/PROVIDER_COST_FEASIBILITY.md",
  ]) {
    requireMarkers(file, readFile(file), [
      "CI Node 22 Beta foundation workflow",
      "security:ci-node22-workflow",
    ]);
  }
}

function requireMarkers(relativePath, contents, markers) {
  for (const marker of markers) {
    if (!contents.includes(marker)) {
      errors.push(`${relativePath} is missing required marker: ${marker}`);
    }
  }
}

function rejectMarkers(relativePath, contents, markers) {
  for (const marker of markers) {
    if (contents.includes(marker)) {
      errors.push(`${relativePath} must not include marker: ${marker}`);
    }
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
