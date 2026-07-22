#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const yaml = require("js-yaml");
const {
  renderBetaFoundationGateFixture,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/render-rc-config-audit.js");

const cases = [
  {
    label: "accepts the maintenance-gated Render RC configuration",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects a nested decoy in front of malicious flow-style services",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "render.yaml",
        `x-audit:
  services:
  - type: web
    name: fanpass-api-staging
    plan: starter
    autoDeployTrigger: "off"
    maxShutdownDelaySeconds: 60
    buildCommand: npm ci --include=dev --audit=false && npm audit --omit=dev --audit-level=high && npm run build -w apps/api && npm run prisma:deploy -w apps/api
    envVars:
      - key: FANPASS_SIDE_EFFECT_WORKER_ENABLED
        value: "false"
      - key: SIDE_EFFECT_WORKER_LIMIT
        value: "1"
  - type: web
    name: fanpass-console-staging
    plan: free
    autoDeployTrigger: "off"
    envVars:
      - key: FANPASS_CONSOLE_AUTH_ORIGIN
        value: https://fanpass-console-auth-staging.onrender.com
      - key: VITE_CONSOLE_AUTH_BASE_URL
        value: https://fanpass-console-auth-staging.onrender.com
  - type: web
    name: fanpass-console-auth-staging
    plan: free
    autoDeployTrigger: "off"
    envVars:
      - key: FANPASS_CONSOLE_SESSION_BRIDGE_URL
        value: https://fanpass-console-staging.onrender.com/api/console/privy-session
      - key: FANPASS_CONSOLE_URL
        value: https://fanpass-console-staging.onrender.com
services: [{type: web, name: fanpass-api-staging, plan: starter, autoDeployTrigger: commit, envVars: [{key: FANPASS_SIDE_EFFECT_WORKER_ENABLED, value: "true"}, {key: SIDE_EFFECT_WORKER_LIMIT, value: "99"}]}]
`,
      ),
  },
  {
    label: "accepts an equivalent flow-style top-level services document",
    expected: "pass",
    mutate: (fixtureRoot) => writeFlowStylePassingBlueprint(fixtureRoot),
  },
  {
    label: "rejects a second top-level services key",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(fixtureRoot, "render.yaml", "services: []\n"),
  },
  ...["databases", "envVarGroups"].map((key) => ({
    label: `rejects unexpected top-level ${key}`,
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(fixtureRoot, "render.yaml", `${key}: []\n`),
  })),
  {
    label: "rejects an unexpected fourth service",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "render.yaml",
        `  - type: web
    name: fanpass-unknown-staging
    plan: free
    autoDeployTrigger: "off"
`,
      ),
  },
  ...[
    "preDeployCommand",
    "initialDeployHook",
    "repo",
    "branch",
    "dockerCommand",
    "dockerContext",
    "dockerfilePath",
    "image",
  ].map((field) => ({
    label: `rejects executable or source service field ${field}`,
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    startCommand: npm run start -w apps/api",
        `    ${field}: attacker-controlled\n    startCommand: npm run start -w apps/api`,
      ),
  })),
  {
    label: "rejects an unexpected generic service field",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    startCommand: npm run start -w apps/api",
        "    numInstances: 2\n    startCommand: npm run start -w apps/api",
      ),
  },
  {
    label: "rejects a duplicate service name",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceOnce(
        fixtureRoot,
        "render.yaml",
        "    name: fanpass-console-auth-staging",
        "    name: fanpass-console-staging",
      ),
  },
  {
    label: "rejects a duplicate service mapping field",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    plan: starter",
        "    plan: starter\n    plan: free",
      ),
  },
  {
    label: "rejects a duplicate environment key",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceOnce(
        fixtureRoot,
        "render.yaml",
        "      - key: SIDE_EFFECT_WORKER_LIMIT",
        "      - key: FANPASS_SIDE_EFFECT_WORKER_ENABLED",
      ),
  },
  {
    label: "rejects an unexpected environment key",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    envVars:\n      - key: NODE_VERSION",
        '    envVars:\n      - key: NODE_OPTIONS\n        value: "--require=./unsafe.js"\n      - key: NODE_VERSION',
      ),
  },
  {
    label: "rejects demo authentication drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceEnvValue(
        fixtureRoot,
        "fanpass-api-staging",
        "FANPASS_ENABLE_DEMO_AUTH",
        '"false"',
        '"true"',
      ),
  },
  {
    label: "rejects ownership provider mode drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceEnvValue(
        fixtureRoot,
        "fanpass-api-staging",
        "OWNERSHIP_ADAPTER",
        "privy",
        "demo",
      ),
  },
  {
    label: "rejects a synchronized secret changed to an inline value",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceOnce(
        fixtureRoot,
        "render.yaml",
        "      - key: PRIVY_APP_SECRET\n        sync: false",
        '      - key: PRIVY_APP_SECRET\n        value: "not-a-secret"',
      ),
  },
  {
    label: "rejects a generated secret changed to a synchronized value",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceOnce(
        fixtureRoot,
        "render.yaml",
        "      - key: FANPASS_ORDERBOOK_ADMISSION_SECRET\n        generateValue: true",
        "      - key: FANPASS_ORDERBOOK_ADMISSION_SECRET\n        sync: false",
      ),
  },
  {
    label: "rejects worker configuration delegated with sync false",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceOnce(
        fixtureRoot,
        "render.yaml",
        '        value: "false"',
        "        sync: false",
      ),
  },
  {
    label: "rejects worker configuration delegated with sync true",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceOnce(
        fixtureRoot,
        "render.yaml",
        '        value: "false"',
        "        sync: true",
      ),
  },
  {
    label: "rejects an unquoted worker flag",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceOnce(
        fixtureRoot,
        "render.yaml",
        '        value: "false"',
        "        value: false",
      ),
  },
  {
    label: "rejects side-effect worker limit drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceOnce(
        fixtureRoot,
        "render.yaml",
        '        value: "1"',
        '        value: "2"',
      ),
  },
  ...[
    "fanpass-api-staging",
    "fanpass-console-staging",
    "fanpass-console-auth-staging",
  ].map((serviceName) => ({
    label: `rejects auto-deploy drift for ${serviceName}`,
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        serviceName,
        '    autoDeployTrigger: "off"',
        '    autoDeployTrigger: "commit"',
      ),
  })),
  {
    label: "rejects API plan drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    plan: starter",
        "    plan: free",
      ),
  },
  {
    label: "rejects API runtime drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    runtime: node",
        "    runtime: docker",
      ),
  },
  {
    label: "rejects API region drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    region: oregon",
        "    region: frankfurt",
      ),
  },
  {
    label: "rejects API shutdown grace drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    maxShutdownDelaySeconds: 60",
        "    maxShutdownDelaySeconds: 30",
      ),
  },
  {
    label: "rejects a quoted API shutdown grace value",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    maxShutdownDelaySeconds: 60",
        '    maxShutdownDelaySeconds: "60"',
      ),
  },
  {
    label: "rejects database mutation before the API build completes",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    buildCommand: npm ci --include=dev --audit=false && npm audit --omit=dev --audit-level=high && npm run build -w apps/api && npm run prisma:deploy -w apps/api",
        "    buildCommand: npm ci --include=dev --audit=false && npm audit --omit=dev --audit-level=high && npm run prisma:deploy -w apps/api && npm run build -w apps/api",
      ),
  },
  {
    label: "rejects a no-space hash suffix in the API build command",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    buildCommand: npm ci --include=dev --audit=false && npm audit --omit=dev --audit-level=high && npm run build -w apps/api && npm run prisma:deploy -w apps/api",
        "    buildCommand: npm ci --include=dev --audit=false && npm audit --omit=dev --audit-level=high && npm run build -w apps/api && npm run prisma:deploy -w apps/api#npm run unsafe",
      ),
  },
  {
    label: "rejects an unsafe API start command",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    startCommand: npm run start -w apps/api",
        "    startCommand: npm run exfiltrate",
      ),
  },
  {
    label: "rejects API health check drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-api-staging",
        "    healthCheckPath: /health",
        "    healthCheckPath: /unsafe",
      ),
  },
  ...["fanpass-console-staging", "fanpass-console-auth-staging"].map(
    (serviceName) => ({
      label: `rejects paid-plan drift for ${serviceName}`,
      expected: "fail",
      mutate: (fixtureRoot) =>
        replaceServiceField(
          fixtureRoot,
          serviceName,
          "    plan: free",
          "    plan: starter",
        ),
    }),
  ),
  {
    label: "rejects Console build command drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-console-staging",
        "    buildCommand: npm ci --include=dev --audit=false && npm audit --omit=dev --audit-level=high && npm run build -w apps/dashboard",
        "    buildCommand: npm run unsafe",
      ),
  },
  {
    label: "rejects Auth root directory drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceField(
        fixtureRoot,
        "fanpass-console-auth-staging",
        "    rootDir: apps/console-auth",
        "    rootDir: apps/api",
      ),
  },
  ...[
    {
      serviceName: "fanpass-console-staging",
      key: "FANPASS_CONSOLE_AUTH_ORIGIN",
      before: "https://fanpass-console-auth-staging.onrender.com",
      after: "https://fanpass-console-staging.onrender.com",
    },
    {
      serviceName: "fanpass-console-staging",
      key: "VITE_CONSOLE_AUTH_BASE_URL",
      before: "https://fanpass-console-auth-staging.onrender.com",
      after: "https://fanpass-console-staging.onrender.com",
    },
    {
      serviceName: "fanpass-console-auth-staging",
      key: "FANPASS_CONSOLE_SESSION_BRIDGE_URL",
      before:
        "https://fanpass-console-staging.onrender.com/api/console/privy-session",
      after: "https://fanpass-console-auth-staging.onrender.com",
    },
    {
      serviceName: "fanpass-console-auth-staging",
      key: "FANPASS_CONSOLE_URL",
      before: "https://fanpass-console-staging.onrender.com",
      after: "https://fanpass-console-auth-staging.onrender.com",
    },
  ].map(({ serviceName, key, before, after }) => ({
    label: `rejects cross-service URL drift for ${serviceName} ${key}`,
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceServiceEnvValue(fixtureRoot, serviceName, key, before, after),
  })),
  {
    label: "rejects missing package script wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "package.json",
        `${JSON.stringify({ scripts: {} }, null, 2)}\n`,
      ),
  },
  {
    label: "rejects a transitive-only YAML parser dependency",
    expected: "fail",
    mutate: (fixtureRoot) => {
      const manifest = readFixtureJson(fixtureRoot, "package.json");
      delete manifest.devDependencies["js-yaml"];
      writeFixtureFile(
        fixtureRoot,
        "package.json",
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    },
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        renderBetaFoundationGateFixture(["security:node-runtime-policy"]),
      ),
  },
  {
    label: "rejects comment-only composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        `${renderBetaFoundationGateFixture(["security:render-rc-config:self-test"])}// npmStep("Render RC configuration audit", "run", "security:render-rc-config");\n`,
      ),
  },
  {
    label: "rejects reversed composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        renderBetaFoundationGateFixture([
          "security:render-rc-config",
          "security:render-rc-config:self-test",
        ]),
      ),
  },
  {
    label: "rejects a mutable composite verifier manifest",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        renderBetaFoundationGateFixture([
          "security:render-rc-config:self-test",
          "security:render-rc-config",
        ]).replace("const gateSteps", "let gateSteps"),
      ),
  },
  {
    label: "rejects duplicate composite verifier manifests",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        `${renderBetaFoundationGateFixture([
          "security:render-rc-config:self-test",
          "security:render-rc-config",
        ]).replace(
          "const gateSteps",
          "var gateSteps",
        )}var gateSteps = Object.freeze([]);\n`,
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-render-rc-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_RENDER_RC_AUDIT_ROOT: fixtureRoot,
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
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
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
    "render.yaml",
    fs.readFileSync(path.join(rootDir, "render.yaml"), "utf8"),
  );
  writeFixtureFile(
    fixtureRoot,
    "package.json",
    `${JSON.stringify(
      {
        scripts: {
          "security:render-rc-config": "node scripts/render-rc-config-audit.js",
          "security:render-rc-config:self-test":
            "node scripts/render-rc-config-audit-self-test.js",
        },
        devDependencies: {
          "js-yaml": "4.3.0",
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.js",
    renderBetaFoundationGateFixture([
      "security:render-rc-config:self-test",
      "security:render-rc-config",
    ]),
  );
}

function writeFlowStylePassingBlueprint(fixtureRoot) {
  const blueprint = yaml.load(
    fs.readFileSync(path.join(rootDir, "render.yaml"), "utf8"),
    { json: false, schema: yaml.JSON_SCHEMA },
  );
  writeFixtureFile(
    fixtureRoot,
    "render.yaml",
    `${JSON.stringify(blueprint)}\n`,
  );
}

function replaceServiceField(fixtureRoot, serviceName, before, after) {
  const relativePath = "render.yaml";
  const absolutePath = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  const serviceStart = contents.indexOf(`    name: ${serviceName}\n`);
  if (serviceStart === -1) {
    throw new Error(`Fixture service marker not found: ${serviceName}`);
  }
  const nextService = contents.indexOf("\n  - type:", serviceStart);
  const serviceEnd = nextService === -1 ? contents.length : nextService;
  const service = contents.slice(serviceStart, serviceEnd);
  if (!service.includes(before)) {
    throw new Error(
      `Fixture field marker not found for ${serviceName}: ${before}`,
    );
  }
  const mutated = service.replace(before, after);
  fs.writeFileSync(
    absolutePath,
    `${contents.slice(0, serviceStart)}${mutated}${contents.slice(serviceEnd)}`,
  );
}

function replaceServiceEnvValue(fixtureRoot, serviceName, key, before, after) {
  const relativePath = "render.yaml";
  const absolutePath = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  const serviceStart = contents.indexOf(`    name: ${serviceName}\n`);
  if (serviceStart === -1) {
    throw new Error(`Fixture service marker not found: ${serviceName}`);
  }
  const nextService = contents.indexOf("\n  - type:", serviceStart);
  const serviceEnd = nextService === -1 ? contents.length : nextService;
  const keyMarker = `      - key: ${key}\n`;
  const keyStart = contents.indexOf(keyMarker, serviceStart);
  if (keyStart === -1 || keyStart >= serviceEnd) {
    throw new Error(`Fixture env marker not found for ${serviceName}: ${key}`);
  }
  const nextKey = contents.indexOf("\n      - key:", keyStart);
  const entryEnd =
    nextKey === -1 || nextKey >= serviceEnd ? serviceEnd : nextKey;
  const entry = contents.slice(keyStart, entryEnd);
  const valueMarker = `        value: ${before}`;
  if (!entry.includes(valueMarker)) {
    throw new Error(`Fixture env value not found for ${serviceName} ${key}`);
  }
  const mutated = entry.replace(valueMarker, `        value: ${after}`);
  fs.writeFileSync(
    absolutePath,
    `${contents.slice(0, keyStart)}${mutated}${contents.slice(entryEnd)}`,
  );
}

function replaceOnce(fixtureRoot, relativePath, before, after) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  if (!contents.includes(before)) {
    throw new Error(`Fixture marker not found: ${before}`);
  }
  fs.writeFileSync(absolutePath, contents.replace(before, after));
}

function appendFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.appendFileSync(absolutePath, contents);
}

function readFixtureJson(fixtureRoot, relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, relativePath), "utf8"),
  );
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
