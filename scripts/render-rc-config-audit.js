#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const {
  DEFAULT_GATE_PATH,
  assertOrderedNpmScripts,
  loadBetaFoundationGateSteps,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = process.env.FANPASS_RENDER_RC_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_RENDER_RC_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const files = {
  blueprint: "render.yaml",
  manifest: "package.json",
  verifier: DEFAULT_GATE_PATH,
};
const expectedApiBuildCommand =
  "npm ci --include=dev --audit=false && npm audit --omit=dev --audit-level=high && npm run build -w apps/api && npm run prisma:deploy -w apps/api";
const expectedConsoleBuildCommand =
  "npm ci --include=dev --audit=false && npm audit --omit=dev --audit-level=high && npm run build -w apps/dashboard";
const expectedAuthBuildCommand =
  "npm_config_include=dev npm ci --audit=false && npm audit --omit=dev --audit-level=high && npm run build";
const consoleOrigin = "https://fanpass-console-staging.onrender.com";
const consoleAuthOrigin = "https://fanpass-console-auth-staging.onrender.com";
const forbiddenServiceFields = new Set([
  "preDeployCommand",
  "initialDeployHook",
  "repo",
  "branch",
  "dockerCommand",
  "dockerContext",
  "dockerfilePath",
  "image",
]);
const expectedServices = new Map([
  [
    "fanpass-api-staging",
    {
      fields: {
        type: "web",
        name: "fanpass-api-staging",
        runtime: "node",
        plan: "starter",
        region: "oregon",
        autoDeployTrigger: "off",
        maxShutdownDelaySeconds: 60,
        buildCommand: expectedApiBuildCommand,
        startCommand: "npm run start -w apps/api",
        healthCheckPath: "/health",
      },
      envVars: createEnvSpec({
        values: {
          NODE_VERSION: "22.22.3",
          NODE_ENV: "production",
          FANPASS_ENV: "staging",
          FANPASS_DATA_SOURCE: "prisma",
          FANPASS_ENABLE_PRISMA_CONNECT: "true",
          FANPASS_ENABLE_DEMO_AUTH: "false",
          FANPASS_ENABLE_PAYMENTS: "true",
          FANPASS_REQUIRE_PAYMENT_AUTHORIZATION: "true",
          FANPASS_STRIPE_CAPTURE_TIMEOUT_MS: "10000",
          FANPASS_STRIPE_CAPTURE_TX_TIMEOUT_MS: "20000",
          FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "true",
          FANPASS_SIDE_EFFECT_WORKER_ENABLED: "false",
          SIDE_EFFECT_WORKER_LIMIT: "1",
          OWNERSHIP_ADAPTER: "privy",
          FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES: "false",
          FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "true",
          FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2: "eip155:11155111",
          FANPASS_PRIVY_TRANSACTION_HASH_TIMEOUT_MS: "45000",
          FANPASS_WALLET_CHAIN_ID: "11155111",
          FANPASS_USDC_CONTRACT_ADDRESS:
            "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
          FANPASS_TRUST_PROXY_HOPS: "1",
          FANPASS_ORDERBOOK_MAX_IDENTITIES: "4096",
          FANPASS_ORDERBOOK_IDENTITY_TTL_MS: "60000",
          FANPASS_ORDERBOOK_IPV6_PREFIX_BITS: "64",
          FANPASS_ORDERBOOK_SUBSCRIPTIONS_PER_10_SECONDS: "16",
          FANPASS_ORDERBOOK_CONNECTIONS_PER_MINUTE: "60",
          FANPASS_ORDERBOOK_MAX_IN_FLIGHT_SNAPSHOTS_PER_ACTOR: "2",
          FANPASS_ORDERBOOK_GLOBAL_IN_FLIGHT_SNAPSHOTS: "32",
          FANPASS_ORDERBOOK_MAX_CONNECTIONS_PER_ACTOR: "32",
          FANPASS_ORDERBOOK_GLOBAL_CONNECTIONS: "512",
          SESSION_TTL_SECONDS: "28800",
          QR_TTL_SECONDS: "30",
          RATE_LIMIT_GENERAL_PER_MINUTE: "600",
          RATE_LIMIT_AUTH_PER_MINUTE: "30",
          RATE_LIMIT_VERIFY_PER_MINUTE: "120",
          RATE_LIMIT_PRIVY_PER_MINUTE: "12",
          RATE_LIMIT_PRIVY_ORIGIN_PER_MINUTE: "300",
          RATE_LIMIT_STAFF_INVITE_PER_MINUTE: "6",
          RATE_LIMIT_STAFF_ASSIGNMENT_PER_MINUTE: "30",
          FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS: "300",
          SIDE_EFFECT_HEALTH_PROCESSING_STALE_SECONDS: "300",
          SIDE_EFFECT_HEALTH_PENDING_STALE_SECONDS: "900",
        },
        synced: [
          "FANPASS_TICKET_CONTRACT_ADDRESS",
          "FANPASS_LEGACY_OWNERSHIP_ADAPTER",
          "FANPASS_LEGACY_TICKET_CONTRACT_ADDRESS",
          "FANPASS_LEGACY_TICKET_CHAIN_ID",
          "TESTNET_RPC_URL",
          "PRIVY_APP_SECRET",
          "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY",
          "FANPASS_PRIVY_SPONSOR_WALLET_ID",
          "FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS",
          "FANPASS_WALLET_RPC_URL",
          "FANPASS_CORS_ORIGINS",
          "DATABASE_URL",
          "FANPASS_STAGING_DATABASE_IDENTITY_SHA256",
          "PRIVY_APP_ID",
          "PRIVY_VERIFICATION_KEY",
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
        ],
        generated: [
          "FANPASS_ORDERBOOK_ADMISSION_SECRET",
          "QR_SIGNING_SECRET",
          "SESSION_SIGNING_SECRET",
          "FANPASS_ONSALE_QUEUE_SECRET",
        ],
      }),
    },
  ],
  [
    "fanpass-console-staging",
    {
      fields: {
        type: "web",
        name: "fanpass-console-staging",
        runtime: "node",
        plan: "free",
        region: "oregon",
        autoDeployTrigger: "off",
        buildCommand: expectedConsoleBuildCommand,
        startCommand: "npm run start -w apps/dashboard",
        healthCheckPath: "/",
      },
      envVars: createEnvSpec({
        values: {
          NODE_VERSION: "22.22.3",
          NODE_ENV: "production",
          FANPASS_ENV: "staging",
          FANPASS_API_BASE_URL: "https://fanpass-api-staging.onrender.com",
          VITE_API_BASE_URL: "https://fanpass-api-staging.onrender.com",
          FANPASS_CONSOLE_AUTH_ORIGIN: consoleAuthOrigin,
          VITE_CONSOLE_AUTH_BASE_URL: consoleAuthOrigin,
        },
        synced: ["FANPASS_CONSOLE_ORIGINS"],
      }),
    },
  ],
  [
    "fanpass-console-auth-staging",
    {
      fields: {
        type: "web",
        name: "fanpass-console-auth-staging",
        runtime: "node",
        plan: "free",
        region: "oregon",
        rootDir: "apps/console-auth",
        autoDeployTrigger: "off",
        buildCommand: expectedAuthBuildCommand,
        startCommand: "npm run start",
        healthCheckPath: "/health",
      },
      envVars: createEnvSpec({
        values: {
          NODE_VERSION: "22.22.3",
          NODE_ENV: "production",
          FANPASS_ENV: "staging",
          FANPASS_PRIVY_SESSION_MODE: "browser-sdk",
          FANPASS_CONSOLE_SESSION_BRIDGE_URL: `${consoleOrigin}/api/console/privy-session`,
          FANPASS_CONSOLE_URL: consoleOrigin,
        },
        synced: ["NEXT_PUBLIC_PRIVY_APP_ID"],
      }),
    },
  ],
]);
const errors = [];

for (const relativePath of Object.values(files)) {
  if (!fs.existsSync(path.join(rootDir, relativePath))) {
    errors.push(`Render RC audit input is missing: ${relativePath}`);
  }
}

let services = new Map();
if (errors.length === 0) {
  services = parseRenderServices(read(files.blueprint));
  auditServiceTopology();
  auditApiReleaseFence();
  auditConsoleReleaseRoutes();
  auditWiring();
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      blueprint: files.blueprint,
      apiPlan: "starter",
      companionPlans: "free",
      maxShutdownDelaySeconds: 60,
      autoDeployTrigger: "off",
      buildBeforeDatabaseDeploy: true,
      sideEffectWorker: {
        enabled: "false",
        limit: "1",
      },
      checkedServices: [...services.keys()],
    },
    null,
    2,
  ),
);

function auditServiceTopology() {
  for (const name of services.keys()) {
    if (!expectedServices.has(name)) {
      errors.push(
        `${files.blueprint} must not define unexpected service ${name}`,
      );
    }
  }

  for (const [name, expected] of expectedServices) {
    const service = services.get(name);
    if (!service) {
      errors.push(
        `${files.blueprint} must define service ${name} exactly once`,
      );
      continue;
    }
    auditExactServiceSchema(service, expected);
  }
}

function auditExactServiceSchema(service, expected) {
  const allowedFields = new Set([...Object.keys(expected.fields), "envVars"]);
  for (const field of service.fields.keys()) {
    if (forbiddenServiceFields.has(field) || field.startsWith("docker")) {
      errors.push(
        `${service.name} must not define executable/source field ${field}`,
      );
    } else if (!allowedFields.has(field)) {
      errors.push(
        `${service.name} must not define unexpected service field ${field}`,
      );
    }
  }

  for (const [field, expectedValue] of Object.entries(expected.fields)) {
    assertExactValue(
      service.fields.get(field),
      expectedValue,
      `${service.name} ${field}`,
    );
  }
  if (!service.fields.has("envVars")) {
    errors.push(`${service.name} must define envVars exactly once`);
  }

  for (const key of service.envVars.keys()) {
    if (!expected.envVars.has(key)) {
      errors.push(`${service.name} must not define unexpected env ${key}`);
    }
  }
  for (const [key, expectedFields] of expected.envVars) {
    const entry = service.envVars.get(key);
    if (!entry) {
      errors.push(`${service.name} must define env ${key} exactly once`);
      continue;
    }
    const allowedEnvFields = new Set(["key", ...Object.keys(expectedFields)]);
    for (const field of entry.fields.keys()) {
      if (!allowedEnvFields.has(field)) {
        errors.push(
          `${service.name} env ${key} must not define unexpected field ${field}`,
        );
      }
    }
    for (const [field, expectedValue] of Object.entries(expectedFields)) {
      assertExactValue(
        entry.fields.get(field),
        expectedValue,
        `${service.name} env ${key} ${field}`,
      );
    }
  }
}

function auditApiReleaseFence() {
  const service = services.get("fanpass-api-staging");
  if (!service) {
    return;
  }

  assertScalar(
    service.fields.get("plan"),
    "starter",
    "fanpass-api-staging plan must be starter",
  );
  assertNumberScalar(
    service.fields.get("maxShutdownDelaySeconds"),
    60,
    "fanpass-api-staging maxShutdownDelaySeconds must be the numeric value 60",
  );
  assertScalar(
    service.fields.get("buildCommand"),
    expectedApiBuildCommand,
    "fanpass-api-staging buildCommand must install, audit, and build before prisma:deploy",
  );
  assertExplicitStringEnv(
    service,
    "FANPASS_SIDE_EFFECT_WORKER_ENABLED",
    "false",
  );
  assertExplicitStringEnv(service, "SIDE_EFFECT_WORKER_LIMIT", "1");
}

function auditConsoleReleaseRoutes() {
  const consoleService = services.get("fanpass-console-staging");
  const authService = services.get("fanpass-console-auth-staging");

  if (consoleService) {
    assertScalar(
      consoleService.fields.get("plan"),
      "free",
      "fanpass-console-staging plan must be free",
    );
    assertExplicitEnvValue(
      consoleService,
      "FANPASS_CONSOLE_AUTH_ORIGIN",
      consoleAuthOrigin,
    );
    assertExplicitEnvValue(
      consoleService,
      "VITE_CONSOLE_AUTH_BASE_URL",
      consoleAuthOrigin,
    );
  }

  if (authService) {
    assertScalar(
      authService.fields.get("plan"),
      "free",
      "fanpass-console-auth-staging plan must be free",
    );
    assertExplicitEnvValue(
      authService,
      "FANPASS_CONSOLE_SESSION_BRIDGE_URL",
      `${consoleOrigin}/api/console/privy-session`,
    );
    assertExplicitEnvValue(authService, "FANPASS_CONSOLE_URL", consoleOrigin);
  }
}

function auditWiring() {
  let manifest;
  try {
    manifest = JSON.parse(read(files.manifest));
  } catch (error) {
    errors.push(`${files.manifest} must contain valid JSON: ${error.message}`);
    return;
  }

  const scripts = manifest.scripts ?? {};
  if (manifest.devDependencies?.["js-yaml"] !== "4.3.0") {
    errors.push(
      "package.json must pin js-yaml 4.3.0 as a direct root devDependency",
    );
  }
  if (
    scripts["security:render-rc-config"] !==
    "node scripts/render-rc-config-audit.js"
  ) {
    errors.push(
      "package.json must expose security:render-rc-config as the Render RC audit",
    );
  }
  if (
    scripts["security:render-rc-config:self-test"] !==
    "node scripts/render-rc-config-audit-self-test.js"
  ) {
    errors.push(
      "package.json must expose security:render-rc-config:self-test as the synthetic audit test",
    );
  }

  const gateSteps = loadBetaFoundationGateSteps(rootDir, errors, {
    relativePath: files.verifier,
  });
  assertOrderedNpmScripts(
    gateSteps,
    ["security:render-rc-config:self-test", "security:render-rc-config"],
    errors,
    { subject: "Beta foundation Render RC gate" },
  );
}

function assertExplicitStringEnv(service, key, expected) {
  const entry = service.envVars.get(key);
  if (!entry) {
    errors.push(`${service.name} must define ${key} exactly once`);
    return;
  }

  if (entry.fields.has("sync")) {
    errors.push(
      `${service.name} ${key} must use an explicit value and must not use sync`,
    );
  }

  const value = entry.fields.get("value");
  if (!value) {
    errors.push(`${service.name} ${key} must define value: "${expected}"`);
    return;
  }

  if (typeof value !== "string" || value !== expected) {
    errors.push(
      `${service.name} ${key} must be the explicit string value: "${expected}"`,
    );
  }
}

function assertExplicitEnvValue(service, key, expected) {
  const entry = service.envVars.get(key);
  if (!entry) {
    errors.push(`${service.name} must define ${key} exactly once`);
    return;
  }
  if (entry.fields.has("sync")) {
    errors.push(
      `${service.name} ${key} must use an explicit value and must not use sync`,
    );
  }

  const value = entry.fields.get("value");
  if (typeof value !== "string" || value !== expected) {
    errors.push(`${service.name} ${key} must equal ${expected}`);
  }
}

function assertScalar(actual, expected, message) {
  if (typeof actual !== "string" || actual !== expected) {
    errors.push(message);
  }
}

function assertNumberScalar(actual, expected, message) {
  if (typeof actual !== "number" || actual !== expected) {
    errors.push(message);
  }
}

function assertExactValue(actual, expected, label) {
  if (typeof actual !== typeof expected || actual !== expected) {
    errors.push(
      `${label} must equal ${JSON.stringify(expected)} as a ${typeof expected}`,
    );
  }
}

function parseRenderServices(source) {
  const parsed = new Map();
  let blueprint;
  try {
    blueprint = yaml.load(source, {
      filename: files.blueprint,
      json: false,
      schema: yaml.JSON_SCHEMA,
    });
  } catch (error) {
    errors.push(
      `${files.blueprint} must contain exactly one valid YAML document without duplicate mapping keys: ${formatYamlError(error)}`,
    );
    return parsed;
  }

  if (!isMapping(blueprint)) {
    errors.push(`${files.blueprint} top level must be a YAML mapping`);
    return parsed;
  }
  for (const key of Object.keys(blueprint)) {
    if (key !== "services") {
      errors.push(
        `${files.blueprint} must not define unexpected top-level key ${key}`,
      );
    }
  }
  if (!Object.prototype.hasOwnProperty.call(blueprint, "services")) {
    errors.push(`${files.blueprint} must define a top-level services list`);
    return parsed;
  }
  if (!Array.isArray(blueprint.services)) {
    errors.push(`${files.blueprint} top-level services must be a YAML list`);
    return parsed;
  }

  for (const [index, serviceValue] of blueprint.services.entries()) {
    if (!isMapping(serviceValue)) {
      errors.push(
        `${files.blueprint} top-level services[${index}] must be a mapping`,
      );
      continue;
    }

    const fields = new Map(Object.entries(serviceValue));
    const name = fields.get("name");
    if (typeof name !== "string" || name.length === 0) {
      errors.push(
        `${files.blueprint} top-level services[${index}] must define a non-empty string name`,
      );
      continue;
    }
    if (parsed.has(name)) {
      errors.push(
        `${files.blueprint} must not define duplicate service ${name}`,
      );
      continue;
    }

    const service = {
      name,
      fields,
      envVars: parseEnvVars(fields.get("envVars"), name),
    };
    parsed.set(service.name, service);
  }

  return parsed;
}

function parseEnvVars(envValue, serviceName) {
  const envVars = new Map();
  if (envValue === undefined) {
    return envVars;
  }
  if (!Array.isArray(envValue)) {
    errors.push(
      `${files.blueprint} ${serviceName} envVars must be a YAML list`,
    );
    return envVars;
  }

  for (const [index, envEntry] of envValue.entries()) {
    if (!isMapping(envEntry)) {
      errors.push(
        `${files.blueprint} ${serviceName} envVars[${index}] must be a mapping`,
      );
      continue;
    }
    const fields = new Map(Object.entries(envEntry));
    const key = fields.get("key");
    if (typeof key !== "string" || key.length === 0) {
      errors.push(
        `${files.blueprint} ${serviceName} envVars[${index}] must define a non-empty string key`,
      );
      continue;
    }

    if (envVars.has(key)) {
      errors.push(
        `${files.blueprint} must not define duplicate ${serviceName} env ${key}`,
      );
    } else {
      envVars.set(key, { key, fields });
    }
  }

  return envVars;
}

function isMapping(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function formatYamlError(error) {
  if (error && typeof error === "object") {
    if (typeof error.reason === "string") {
      return error.reason;
    }
    if (typeof error.message === "string") {
      return error.message.split("\n", 1)[0];
    }
  }
  return String(error);
}

function createEnvSpec({ values = {}, synced = [], generated = [] }) {
  const spec = new Map();
  for (const [key, value] of Object.entries(values)) {
    addExpectedEnv(spec, key, { value });
  }
  for (const key of synced) {
    addExpectedEnv(spec, key, { sync: false });
  }
  for (const key of generated) {
    addExpectedEnv(spec, key, { generateValue: true });
  }
  return spec;
}

function addExpectedEnv(spec, key, fields) {
  if (spec.has(key)) {
    throw new Error(`Duplicate expected Render env specification: ${key}`);
  }
  spec.set(key, fields);
}

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}
