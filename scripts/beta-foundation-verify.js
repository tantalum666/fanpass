const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  isAllowedLocalPostgresTarget,
} = require("./local-postgres-target-guard");

const rootDir = path.resolve(__dirname, "..");
const localDatabaseFallback =
  "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass";
const gateIsolationRoot = createGateIsolationRoot();
const npmUserConfigPath = path.join(gateIsolationRoot, "user.npmrc");
const npmGlobalConfigPath = path.join(gateIsolationRoot, "global.npmrc");
createEmptyPrivateFile(npmUserConfigPath);
createEmptyPrivateFile(npmGlobalConfigPath);

const npmStep = (label, ...args) => ({ label, kind: "npm", args });
const nodeStep = (label, script) => ({ label, kind: "node", args: [script] });
const initialNodeExecutableIdentity = executableIdentity(process.execPath);
const reviewedNpmCli = resolveNpmCli();
const initialNpmCliIdentity = npmCliIdentity(reviewedNpmCli);
const trustedToolBin = createTrustedToolBin(reviewedNpmCli);
const defaultNodeShadowRoots = Object.freeze([
  rootDir,
  path.join(rootDir, "apps/api"),
  path.join(rootDir, "apps/dashboard"),
  path.join(rootDir, "apps/console-auth"),
  path.join(rootDir, "packages/contracts"),
]);
let runtimeIntegrityCheck = () => {};
let runtimeIntegrityConfigured = false;
let runtimePackageScriptsProjection = null;

const gateSteps = Object.freeze([
  npmStep("Root deterministic dependency install", "ci", "--include=dev"),
  npmStep(
    "Console Auth deterministic dependency install",
    "--prefix",
    "apps/console-auth",
    "ci",
    "--include=dev",
  ),
  nodeStep(
    "Beta foundation launcher self-test",
    "scripts/beta-foundation-launcher-self-test.js",
  ),
  nodeStep(
    "Beta foundation runner self-test",
    "scripts/beta-foundation-verify-self-test.js",
  ),
  npmStep(
    "API Prisma client generation",
    "run",
    "prisma:generate",
    "-w",
    "apps/api",
  ),
  npmStep(
    "Bootstrap disposable Prisma schema",
    "run",
    "prisma:push:raw",
    "-w",
    "apps/api",
    "--",
    "--force-reset",
  ),
  npmStep(
    "Apply post-identity schema chain",
    "run",
    "prisma:after-identity",
    "-w",
    "apps/api",
  ),
  npmStep(
    "Verify on-sale concurrency invariants",
    "run",
    "test",
    "-w",
    "apps/api",
    "--",
    "--runTestsByPath",
    "test/onsales-prisma-concurrency.spec.ts",
  ),
  npmStep(
    "API contract audit self-test",
    "run",
    "security:api-contracts:self-test",
  ),
  npmStep("API contract audit", "run", "security:api-contracts"),
  npmStep(
    "API route role matrix audit self-test",
    "run",
    "security:route-roles:self-test",
  ),
  npmStep("API route role matrix audit", "run", "security:route-roles"),
  npmStep(
    "API response privacy audit self-test",
    "run",
    "security:api-privacy:self-test",
  ),
  npmStep("API response privacy audit", "run", "security:api-privacy"),
  npmStep(
    "Payment response redaction audit self-test",
    "run",
    "security:payment-response-redaction:self-test",
  ),
  npmStep(
    "Payment response redaction audit",
    "run",
    "security:payment-response-redaction",
  ),
  npmStep(
    "Console route contract audit self-test",
    "run",
    "security:console-routes:self-test",
  ),
  npmStep("Console route contract audit", "run", "security:console-routes"),
  npmStep(
    "Console Auth runtime audit self-test",
    "run",
    "security:console-auth-runtime:self-test",
  ),
  npmStep("Console Auth runtime audit", "run", "security:console-auth-runtime"),
  npmStep("Console production build", "run", "build", "-w", "apps/dashboard"),
  npmStep(
    "Console session handoff integration",
    "run",
    "security:console-session-handoff:integration",
  ),
  npmStep(
    "Node runtime policy audit self-test",
    "run",
    "security:node-runtime-policy:self-test",
  ),
  npmStep("Node runtime policy audit", "run", "security:node-runtime-policy"),
  npmStep(
    "Alpha database reset safety self-test",
    "run",
    "alpha:db:reset:self-test",
  ),
  npmStep(
    "CI Node 22 workflow audit self-test",
    "run",
    "security:ci-node22-workflow:self-test",
  ),
  npmStep("CI Node 22 workflow audit", "run", "security:ci-node22-workflow"),
  npmStep(
    "Render RC configuration audit self-test",
    "run",
    "security:render-rc-config:self-test",
  ),
  npmStep("Render RC configuration audit", "run", "security:render-rc-config"),
  npmStep(
    "Hosted CI evidence validator self-test",
    "run",
    "security:ci-hosted:evidence:self-test",
  ),
  npmStep(
    "Saved evidence redaction audit self-test",
    "run",
    "security:evidence-redaction:self-test",
  ),
  npmStep(
    "Saved evidence redaction audit",
    "run",
    "security:evidence-redaction",
  ),
  npmStep(
    "Dependency advisory state check self-test",
    "run",
    "security:dependency-advisories:self-test",
  ),
  npmStep(
    "Dependency advisory state check",
    "run",
    "security:dependency-advisories",
  ),
  npmStep(
    "Dependency risk evidence validator self-test",
    "run",
    "security:dependency-risk:evidence:self-test",
  ),
  npmStep(
    "Dependency tooling audit self-test",
    "run",
    "security:dependency-tooling:self-test",
  ),
  npmStep("Dependency tooling audit", "run", "security:dependency-tooling"),
  npmStep(
    "Privy webhook optionality audit self-test",
    "run",
    "security:privy-webhooks:optional:self-test",
  ),
  npmStep(
    "Privy webhook optionality audit",
    "run",
    "security:privy-webhooks:optional",
  ),
  npmStep(
    "Privy local config check self-test",
    "run",
    "security:privy-local-config:self-test",
  ),
  npmStep(
    "Privy evidence draft helper self-test",
    "run",
    "privy:evidence:draft:self-test",
  ),
  npmStep(
    "Release evidence draft helper self-test",
    "run",
    "release:evidence:draft:self-test",
  ),
  npmStep(
    "Privy plan evidence validator self-test",
    "run",
    "security:privy-plan:evidence:self-test",
  ),
  npmStep(
    "Privy mobile app config evidence validator self-test",
    "run",
    "security:privy-mobile-app-config:evidence:self-test",
  ),
  npmStep(
    "Privy Console React SDK isolation validator self-test",
    "run",
    "security:privy-console-react-sdk:isolation:self-test",
  ),
  npmStep(
    "Stripe dashboard evidence validator self-test",
    "run",
    "security:stripe-dashboard:evidence:self-test",
  ),
  npmStep(
    "Stripe test-mode evidence validator self-test",
    "run",
    "security:stripe-testmode:evidence:self-test",
  ),
  npmStep(
    "Apple Wallet signed-pass evidence validator self-test",
    "run",
    "security:apple-wallet:evidence:self-test",
  ),
  npmStep(
    "FanPass Ops device scanner evidence validator self-test",
    "run",
    "security:ops-scanner:device-evidence:self-test",
  ),
  npmStep(
    "NFC NDEF fixture format audit self-test",
    "run",
    "security:nfc-ndef-fixture:self-test",
  ),
  npmStep("NFC NDEF fixture format audit", "run", "security:nfc-ndef-fixture"),
  npmStep(
    "Alpha demo script audit self-test",
    "run",
    "alpha:demo-script:audit:self-test",
  ),
  npmStep("Alpha demo script audit", "run", "alpha:demo-script:audit"),
  npmStep(
    "Alpha walkthrough evidence audit self-test",
    "run",
    "alpha:walkthrough:evidence:audit:self-test",
  ),
  npmStep(
    "Alpha walkthrough evidence audit",
    "run",
    "alpha:walkthrough:evidence:audit",
  ),
  npmStep(
    "Alpha walkthrough recording evidence validator self-test",
    "run",
    "alpha:walkthrough:recording:evidence:self-test",
  ),
  npmStep(
    "Alpha walkthrough capture self-test",
    "run",
    "alpha:walkthrough:capture:self-test",
  ),
  npmStep(
    "Provider boundary audit self-test",
    "run",
    "security:provider-boundaries:self-test",
  ),
  npmStep(
    "Provider and lifecycle boundary audit",
    "run",
    "security:provider-boundaries",
  ),
  npmStep(
    "Chain operator key boundary audit self-test",
    "run",
    "security:chain-operator-key:self-test",
  ),
  npmStep(
    "Chain operator key boundary audit",
    "run",
    "security:chain-operator-key",
  ),
  npmStep(
    "Chain custody evidence validator self-test",
    "run",
    "security:chain-custody:evidence:self-test",
  ),
  npmStep(
    "Engineering quality gate audit self-test",
    "run",
    "security:engineering-gates:self-test",
  ),
  npmStep(
    "Engineering quality gate audit",
    "run",
    "security:engineering-gates",
  ),
  npmStep(
    "iOS distribution boundary audit self-test",
    "run",
    "security:ios-distribution-boundaries:self-test",
  ),
  npmStep(
    "iOS distribution boundary audit",
    "run",
    "security:ios-distribution-boundaries",
  ),
  npmStep(
    "iOS staging/TestFlight build evidence validator self-test",
    "run",
    "security:ios-staging-build:evidence:self-test",
  ),
  npmStep(
    "iOS physical-device QA checklist audit self-test",
    "run",
    "security:ios-physical-device-qa:self-test",
  ),
  npmStep(
    "iOS physical-device QA checklist audit",
    "run",
    "security:ios-physical-device-qa",
  ),
  npmStep(
    "Staff invite policy audit self-test",
    "run",
    "security:staff-invite-policy:self-test",
  ),
  npmStep("Staff invite policy audit", "run", "security:staff-invite-policy"),
  npmStep(
    "Staff tenant staging evidence validator self-test",
    "run",
    "security:staff-tenant:staging-evidence:self-test",
  ),
  npmStep(
    "Prototype reset policy audit self-test",
    "run",
    "security:prototype-reset-policy:self-test",
  ),
  npmStep(
    "Prototype reset policy audit",
    "run",
    "security:prototype-reset-policy",
  ),
  npmStep(
    "Prototype shortcut register audit self-test",
    "run",
    "security:prototype-shortcuts:self-test",
  ),
  npmStep(
    "Prototype shortcut register audit",
    "run",
    "security:prototype-shortcuts",
  ),
  npmStep(
    "Beta local start safety self-test",
    "run",
    "beta:local:start:self-test",
  ),
  npmStep(
    "Beta local verification self-test",
    "run",
    "beta:local:verify:self-test",
  ),
  npmStep(
    "Local runtime security check self-test",
    "run",
    "security:runtime:local:self-test",
  ),
  npmStep(
    "Staging runtime security check self-test",
    "run",
    "security:runtime:staging:self-test",
  ),
  npmStep(
    "Staging runtime evidence validator self-test",
    "run",
    "security:runtime:staging:evidence:self-test",
  ),
  npmStep(
    "Security header policy audit self-test",
    "run",
    "security:headers-policy:self-test",
  ),
  npmStep("Security header policy audit", "run", "security:headers-policy"),
  npmStep(
    "Settlement retry idempotency audit self-test",
    "run",
    "security:settlement-retry-idempotency:self-test",
  ),
  npmStep(
    "Settlement retry idempotency audit",
    "run",
    "security:settlement-retry-idempotency",
  ),
  npmStep(
    "Side-effect worker saga verification self-test",
    "run",
    "side-effects:verify:self-test",
  ),
  npmStep("Side-effect worker saga verification", "run", "side-effects:verify"),
  nodeStep(
    "PostgreSQL side-effect health integration wrapper self-test",
    "scripts/side-effects-health-postgres-self-test.js",
  ),
  nodeStep(
    "Side-effect outbox health self-test",
    "scripts/side-effects-health-unit.js",
  ),
  nodeStep(
    "PostgreSQL side-effect health store integration",
    "scripts/side-effects-health-postgres.js",
  ),
  nodeStep(
    "Hermetic local side-effect health profile self-test",
    "scripts/side-effects-health-local-self-test.js",
  ),
  nodeStep(
    "Side-effect outbox local health check",
    "scripts/side-effects-health-local.js",
  ),
  npmStep("API typecheck", "run", "typecheck", "-w", "apps/api"),
  npmStep("Console typecheck", "run", "typecheck", "-w", "apps/dashboard"),
  npmStep(
    "Console Auth typecheck",
    "--prefix",
    "apps/console-auth",
    "run",
    "typecheck",
  ),
  npmStep("Console Auth unit tests", "--prefix", "apps/console-auth", "test"),
  npmStep("API unit tests", "run", "test", "-w", "apps/api"),
]);

function buildHardenedEnvironment(source = process.env) {
  const databaseUrl =
    source.DATABASE_URL == null || source.DATABASE_URL === ""
      ? localDatabaseFallback
      : source.DATABASE_URL;
  if (!isAllowedLocalPostgresTarget(databaseUrl, "fanpass")) {
    throw new Error(
      "Beta foundation verification requires an explicit local PostgreSQL fanpass target",
    );
  }

  const env = {
    HOME: gateIsolationRoot,
    TMPDIR: gateIsolationRoot,
    RUNNER_TEMP: gateIsolationRoot,
    DATABASE_URL: databaseUrl,
    FANPASS_DATA_SOURCE: "prisma",
    FANPASS_SKIP_DOCKER_POSTGRES: "true",
    FANPASS_STRICT_NODE_RUNTIME: "true",
  };
  if (source.CI === "true") {
    env.CI = "true";
  }
  if (source.GITHUB_ACTIONS === "true") {
    env.GITHUB_ACTIONS = "true";
  }

  const fixedPathEntries = [
    trustedToolBin,
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];
  env.PATH = [...new Set(fixedPathEntries)].join(path.delimiter);
  env.FANPASS_GATE_HARDENED = "true";
  env.NPM_CONFIG_SCRIPT_SHELL = "/bin/sh";
  env.npm_config_script_shell = "/bin/sh";
  return env;
}

function createGateIsolationRoot() {
  const isolationRoot = fs.mkdtempSync("/tmp/fanpass-beta-gate-");
  fs.chmodSync(isolationRoot, 0o700);
  process.once("exit", () => {
    try {
      fs.rmSync(isolationRoot, { force: true, recursive: true });
    } catch {
      // Best-effort cleanup; never mask the gate's actual result.
    }
  });
  return isolationRoot;
}

function createEmptyPrivateFile(filePath) {
  fs.writeFileSync(filePath, "", { flag: "wx", mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

function createTrustedToolBin(npmCli) {
  const directory = path.join(gateIsolationRoot, "trusted-bin");
  fs.mkdirSync(directory, { mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  fs.symlinkSync(process.execPath, path.join(directory, "node"));
  fs.symlinkSync(npmCli, path.join(directory, "npm"));
  return directory;
}

function resolveNpmCli() {
  const npmPath = path.join(
    path.dirname(process.execPath),
    process.platform === "win32" ? "npm.cmd" : "npm",
  );
  if (!fs.existsSync(npmPath)) {
    throw new Error(
      "The Node 22 installation does not contain its sibling npm executable",
    );
  }
  const npmCli = fs.realpathSync(npmPath);
  const npmCliStat = fs.statSync(npmCli);
  if (!npmCliStat.isFile() || path.basename(npmCli) !== "npm-cli.js") {
    throw new Error(
      "The sibling npm executable does not resolve to npm-cli.js",
    );
  }
  return npmCli;
}

function resolveStepCommand(
  step,
  npmCli = resolveNpmCli(),
  packageScriptsProjection = runtimePackageScriptsProjection ??
    loadPackageScriptsProjection(),
) {
  if (step.kind === "node") {
    return {
      executable: process.execPath,
      args: [path.join(rootDir, step.args[0])],
      cwd: rootDir,
    };
  }
  if (step.kind === "sh") {
    return {
      executable: "/bin/bash",
      args: [path.join(rootDir, step.args[0])],
      cwd: rootDir,
    };
  }
  if (step.kind === "npm") {
    if (JSON.stringify(step.args) === JSON.stringify(["ci", "--include=dev"])) {
      return npmInstallCommand(npmCli, rootDir, []);
    }
    if (
      JSON.stringify(step.args) ===
      JSON.stringify(["--prefix", "apps/console-auth", "ci", "--include=dev"])
    ) {
      return npmInstallCommand(npmCli, rootDir, [
        "--prefix",
        "apps/console-auth",
      ]);
    }
    const target = parsePackageScriptTarget(step.args);
    const scripts = packageScriptsProjection.find(
      (entry) => entry.path === target.manifestPath,
    )?.scripts;
    const command = scripts?.[target.scriptName];
    if (typeof command !== "string") {
      throw new Error(
        `Missing reviewed package script ${target.manifestPath}:${target.scriptName}`,
      );
    }
    return resolveReviewedPackageScript(target, command);
  }
  throw new Error(`Unsupported Beta foundation command kind: ${step.kind}`);
}

function npmInstallCommand(npmCli, cwd, prefixArgs) {
  return {
    executable: process.execPath,
    args: [
      npmCli,
      `--userconfig=${npmUserConfigPath}`,
      `--globalconfig=${npmGlobalConfigPath}`,
      "--script-shell=/bin/sh",
      "--if-present=false",
      "--ignore-scripts=true",
      "--node-options=",
      ...prefixArgs,
      "ci",
      "--include=dev",
    ],
    cwd,
  };
}

function loadPackageScriptsProjection() {
  return [
    "package.json",
    "apps/api/package.json",
    "apps/dashboard/package.json",
    "apps/console-auth/package.json",
  ].map((manifestPath) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(rootDir, manifestPath), "utf8"),
    );
    return { path: manifestPath, scripts: manifest.scripts ?? {} };
  });
}

function parsePackageScriptTarget(args) {
  if (args[0] === "--prefix" && args[1] === "apps/console-auth") {
    const runOffset = args[2] === "run" ? 1 : 0;
    const scriptName = args[2 + runOffset];
    if (!scriptName || args.length !== 3 + runOffset) {
      throw new Error("Unsupported Console Auth package-script arguments");
    }
    return {
      manifestPath: "apps/console-auth/package.json",
      scriptName,
      forwardedArgs: [],
    };
  }
  if (args[0] !== "run" || typeof args[1] !== "string") {
    throw new Error(
      "Only deterministic install or reviewed package scripts are allowed",
    );
  }
  const workspaceIndex = args.indexOf("-w");
  let manifestPath = "package.json";
  let forwardedStart = args.indexOf("--");
  if (workspaceIndex >= 0) {
    const workspace = args[workspaceIndex + 1];
    if (workspace === "apps/api") {
      manifestPath = "apps/api/package.json";
    } else if (workspace === "apps/dashboard") {
      manifestPath = "apps/dashboard/package.json";
    } else {
      throw new Error(`Unsupported package workspace: ${workspace}`);
    }
  }
  if (forwardedStart < 0) {
    forwardedStart = args.length;
  }
  const allowedBeforeForwarded = new Set([0, 1]);
  if (workspaceIndex >= 0) {
    allowedBeforeForwarded.add(workspaceIndex);
    allowedBeforeForwarded.add(workspaceIndex + 1);
  }
  for (let index = 0; index < forwardedStart; index += 1) {
    if (!allowedBeforeForwarded.has(index)) {
      throw new Error("Unsupported package-script argument shape");
    }
  }
  return {
    manifestPath,
    scriptName: args[1],
    forwardedArgs: args.slice(forwardedStart + 1),
  };
}

function resolveReviewedPackageScript(target, command) {
  const key = `${target.manifestPath}:${target.scriptName}`;
  const simpleNode = command.match(/^node ([A-Za-z0-9_./-]+\.js)$/);
  if (target.manifestPath === "package.json" && simpleNode) {
    return nodeCommand(simpleNode[1], target.forwardedArgs, rootDir);
  }
  const simpleBash = command.match(/^bash ([A-Za-z0-9_./-]+\.sh)$/);
  if (target.manifestPath === "package.json" && simpleBash) {
    return {
      executable: "/bin/bash",
      args: [
        validateReviewedEntrypoint(
          path.join(rootDir, simpleBash[1]),
          rootDir,
          "Reviewed shell entrypoint",
        ),
        ...target.forwardedArgs,
      ],
      cwd: rootDir,
    };
  }

  const apiRoot = path.join(rootDir, "apps/api");
  const dashboardRoot = path.join(rootDir, "apps/dashboard");
  const authRoot = path.join(rootDir, "apps/console-auth");
  const prisma = "node_modules/prisma/build/index.js";
  const jest = "node_modules/jest/bin/jest.js";
  const tsc = "node_modules/typescript/bin/tsc";
  const tsNode = "node_modules/ts-node/dist/bin.js";
  const vite = "node_modules/vite/bin/vite.js";
  const expectedCommands = {
    "apps/api/package.json:prisma:generate": "prisma generate",
    "apps/api/package.json:prisma:push:raw": "prisma db push",
    "apps/api/package.json:prisma:after-identity":
      "npm run prisma:predeploy && npm run prisma:push:raw && npm run prisma:postdeploy && npm run public-events:upsert:source",
    "apps/api/package.json:test": "jest --runInBand",
    "apps/api/package.json:typecheck": "tsc -p tsconfig.json --noEmit",
    "apps/dashboard/package.json:build":
      "tsc -p tsconfig.server.json && vite build",
    "apps/dashboard/package.json:typecheck":
      "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.server.json --noEmit",
    "apps/console-auth/package.json:typecheck":
      "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.server.json --noEmit",
    "apps/console-auth/package.json:test":
      "npm run build && node --test dist/server/*.test.js",
    "package.json:security:route-roles":
      "npm run test -w apps/api -- --runTestsByPath test/route-security.spec.ts",
  };
  if (expectedCommands[key] !== command) {
    throw new Error(
      `Package script ${key} has no reviewed direct execution plan`,
    );
  }

  if (key === "apps/api/package.json:prisma:generate") {
    return nodeCommand(prisma, ["generate"], apiRoot);
  }
  if (key === "apps/api/package.json:prisma:push:raw") {
    return nodeCommand(
      prisma,
      ["db", "push", ...target.forwardedArgs],
      apiRoot,
    );
  }
  if (key === "apps/api/package.json:prisma:after-identity") {
    const execute = (file) =>
      nodeCommand(
        prisma,
        ["db", "execute", "--schema", "prisma/schema.prisma", "--file", file],
        apiRoot,
      );
    return {
      commands: [
        execute("prisma/deploy/20260720_side_effect_dispatch_control.sql"),
        execute("prisma/deploy/20260717_fan_access_submission_uniqueness.sql"),
        nodeCommand(prisma, ["db", "push"], apiRoot),
        execute("prisma/deploy/20260720_wallet_binding_provenance.sql"),
        execute("prisma/deploy/20260720_sponsored_crypto_submissions.sql"),
        execute(
          "prisma/deploy/20260720_ticket_ownership_route_enforcement.sql",
        ),
        nodeCommand(
          tsNode,
          ["src/workers/backfill-ticket-ownership-routes.ts"],
          apiRoot,
          { FANPASS_LEGACY_OWNERSHIP_ADAPTER: "mock" },
        ),
        execute("prisma/deploy/20260720_ticket_ownership_route_validation.sql"),
        nodeCommand(tsNode, ["src/workers/upsert-public-events.ts"], apiRoot),
      ],
    };
  }
  if (key === "apps/api/package.json:test") {
    return nodeCommand(jest, ["--runInBand", ...target.forwardedArgs], apiRoot);
  }
  if (key === "apps/api/package.json:typecheck") {
    return nodeCommand(tsc, ["-p", "tsconfig.json", "--noEmit"], apiRoot);
  }
  if (key === "package.json:security:route-roles") {
    return nodeCommand(
      jest,
      ["--runInBand", "--runTestsByPath", "test/route-security.spec.ts"],
      apiRoot,
    );
  }
  if (key === "apps/dashboard/package.json:build") {
    return {
      commands: [
        nodeCommand(tsc, ["-p", "tsconfig.server.json"], dashboardRoot),
        nodeCommand(vite, ["build"], dashboardRoot),
      ],
    };
  }
  if (key === "apps/dashboard/package.json:typecheck") {
    return {
      commands: [
        nodeCommand(tsc, ["-p", "tsconfig.json", "--noEmit"], dashboardRoot),
        nodeCommand(
          tsc,
          ["-p", "tsconfig.server.json", "--noEmit"],
          dashboardRoot,
        ),
      ],
    };
  }
  const authTsc = "apps/console-auth/node_modules/typescript/bin/tsc";
  const authVite = "apps/console-auth/node_modules/vite/bin/vite.js";
  if (key === "apps/console-auth/package.json:typecheck") {
    return {
      commands: [
        nodeCommand(authTsc, ["-p", "tsconfig.json", "--noEmit"], authRoot),
        nodeCommand(
          authTsc,
          ["-p", "tsconfig.server.json", "--noEmit"],
          authRoot,
        ),
      ],
    };
  }
  if (key === "apps/console-auth/package.json:test") {
    fs.rmSync(path.join(authRoot, "dist"), { force: true, recursive: true });
    return {
      commands: [
        nodeCommand(authVite, ["build"], authRoot),
        nodeCommand(authTsc, ["-p", "tsconfig.server.json"], authRoot),
        {
          resolve() {
            const serverDir = path.join(authRoot, "dist/server");
            const testFiles = fs
              .readdirSync(serverDir)
              .filter((name) => name.endsWith(".test.js"))
              .sort()
              .map((name) => path.join(serverDir, name));
            const expectedTests = [
              path.join(serverDir, "config.test.js"),
              path.join(serverDir, "static-files.test.js"),
            ];
            if (JSON.stringify(testFiles) !== JSON.stringify(expectedTests)) {
              throw new Error(
                "Console Auth build produced an unexpected server test set",
              );
            }
            return {
              executable: process.execPath,
              args: [
                "--test",
                ...testFiles.map((testFile) =>
                  validateReviewedEntrypoint(
                    testFile,
                    authRoot,
                    "Console Auth generated test entrypoint",
                  ),
                ),
              ],
              cwd: authRoot,
            };
          },
        },
      ],
    };
  }
  throw new Error(`Package script ${key} did not resolve to a direct command`);
}

function nodeCommand(relativeEntrypoint, args, cwd, env = undefined) {
  const entrypoint = path.resolve(rootDir, relativeEntrypoint);
  if (!entrypoint.startsWith(`${rootDir}${path.sep}`)) {
    throw new Error("Reviewed Node entrypoint escaped the project root");
  }
  return {
    executable: process.execPath,
    args: [
      validateReviewedEntrypoint(
        entrypoint,
        rootDir,
        "Reviewed Node entrypoint",
      ),
      ...args,
    ],
    cwd,
    ...(env ? { env: Object.freeze({ ...env }) } : {}),
  };
}

function validateReviewedEntrypoint(filePath, boundaryRoot, label) {
  const canonicalBoundary = fs.realpathSync(boundaryRoot);
  if (canonicalBoundary !== path.resolve(boundaryRoot)) {
    throw new Error(`${label} boundary must not contain symlinks`);
  }
  const expectedPath = path.resolve(filePath);
  const relativePath = path.relative(canonicalBoundary, expectedPath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`${label} escaped its canonical boundary`);
  }
  if (fs.realpathSync(expectedPath) !== expectedPath) {
    throw new Error(`${label} path must not contain symlinks`);
  }
  const descriptor = fs.openSync(
    expectedPath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
  );
  try {
    if (!fs.fstatSync(descriptor).isFile()) {
      throw new Error(`${label} must be a regular file`);
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return expectedPath;
}

function executableIdentity(executablePath) {
  const stat = fs.statSync(executablePath, { bigint: true });
  if (!stat.isFile()) {
    throw new Error("The active Node 22 executable must remain a regular file");
  }
  return Object.freeze({
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs,
  });
}

function validateNodeExecutableIdentity(
  expected = initialNodeExecutableIdentity,
  executablePath = process.execPath,
) {
  const actual = executableIdentity(executablePath);
  for (const field of ["dev", "ino", "mode", "size", "mtimeNs", "ctimeNs"]) {
    if (actual[field] !== expected[field]) {
      throw new Error(
        "The active Node 22 executable changed after the authoritative bootstrap",
      );
    }
  }
}

function npmCliIdentity(npmCliPath) {
  return Object.freeze({
    ...executableIdentity(npmCliPath),
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(npmCliPath))
      .digest("hex"),
  });
}

function validateNpmCliIdentity(
  expected = initialNpmCliIdentity,
  npmCliPath = reviewedNpmCli,
) {
  const actual = npmCliIdentity(npmCliPath);
  for (const field of [
    "dev",
    "ino",
    "mode",
    "size",
    "mtimeNs",
    "ctimeNs",
    "sha256",
  ]) {
    if (actual[field] !== expected[field]) {
      throw new Error(
        "The reviewed npm CLI changed after the authoritative bootstrap",
      );
    }
  }
}

function validateTrustedToolBin(
  directory = trustedToolBin,
  expectedTargets = { node: process.execPath, npm: reviewedNpmCli },
) {
  const directoryStat = fs.lstatSync(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error(
      "The private trusted tool directory must remain a directory",
    );
  }
  if ((directoryStat.mode & 0o777) !== 0o700) {
    throw new Error("The private trusted tool directory permissions changed");
  }
  const actualEntries = fs.readdirSync(directory).sort();
  const expectedEntries = Object.keys(expectedTargets).sort();
  if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
    throw new Error("The private trusted tool directory contents changed");
  }
  for (const [name, target] of Object.entries(expectedTargets)) {
    const linkPath = path.join(directory, name);
    if (!fs.lstatSync(linkPath).isSymbolicLink()) {
      throw new Error(
        `The private trusted ${name} entry must remain a symlink`,
      );
    }
    if (fs.realpathSync(linkPath) !== fs.realpathSync(target)) {
      throw new Error(`The private trusted ${name} target changed`);
    }
  }
}

function validateNoNodeShadow(roots = defaultNodeShadowRoots) {
  for (const directory of roots) {
    const candidate = path.join(directory, "node_modules/.bin/node");
    try {
      fs.lstatSync(candidate);
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }
      throw error;
    }
    throw new Error(
      `Refusing npm script Node shadow outside the reviewed interpreter: ${path.relative(rootDir, candidate)}`,
    );
  }
}

function configureRuntimeIntegrityCheck(check, packageScriptsProjection) {
  if (
    runtimeIntegrityConfigured ||
    typeof check !== "function" ||
    !Array.isArray(packageScriptsProjection)
  ) {
    throw new Error(
      "The authoritative runtime integrity check must be configured exactly once",
    );
  }
  runtimeIntegrityCheck = check;
  runtimePackageScriptsProjection = packageScriptsProjection;
  runtimeIntegrityConfigured = true;
}

function verifyRuntimeBoundary(options = {}) {
  validateNodeExecutableIdentity(
    options.nodeExecutableIdentity ?? initialNodeExecutableIdentity,
    options.nodeExecutablePath ?? process.execPath,
  );
  validateNpmCliIdentity(
    options.npmCliIdentity ?? initialNpmCliIdentity,
    options.reviewedNpmCliPath ?? reviewedNpmCli,
  );
  validateTrustedToolBin(
    options.trustedToolBin ?? trustedToolBin,
    options.trustedToolTargets ?? {
      node: process.execPath,
      npm: reviewedNpmCli,
    },
  );
  validateNoNodeShadow(options.nodeShadowRoots ?? defaultNodeShadowRoots);
  runtimeIntegrityCheck();
}

function validateProjectNpmConfig(npmrcPath = path.join(rootDir, ".npmrc")) {
  const normalized = fs.readFileSync(npmrcPath, "utf8").replace(/\r\n/g, "\n");
  if (normalized !== "engine-strict=true\n") {
    throw new Error(
      "The release gate requires the exact reviewed project .npmrc",
    );
  }
}

function validateRuntimeGateManifest(
  source = fs.readFileSync(__filename, "utf8"),
  runtimeSteps = gateSteps,
) {
  const {
    parseBetaFoundationGateSteps,
  } = require("./lib/beta-foundation-gate-audit");
  const parsedSteps = parseBetaFoundationGateSteps(__filename, source, {
    enforceReviewedSkeleton: true,
  });
  const normalizedRuntimeSteps = runtimeSteps.map((step) => ({
    label: step.label,
    kind: step.kind,
    args: [...step.args],
  }));
  const normalizedParsedSteps = parsedSteps.map((step) => ({
    label: step.label,
    kind: step.kind,
    args: [...step.args],
  }));
  if (
    JSON.stringify(normalizedRuntimeSteps) !==
    JSON.stringify(normalizedParsedSteps)
  ) {
    throw new Error(
      "Runtime Beta foundation gate manifest differs from its audited source manifest",
    );
  }
  return Object.freeze([...parsedSteps]);
}

function runStep(step, options = {}) {
  verifyRuntimeBoundary(options);
  const command = resolveStepCommand(
    step,
    options.npmCli,
    options.packageScriptsProjection,
  );
  const env = {
    ...(options.env ?? buildHardenedEnvironment()),
  };
  if (step.label === "Verify on-sale concurrency invariants") {
    env.FANPASS_RUN_DATABASE_TESTS = "true";
  }
  const commands = command.commands ?? [command];
  let result;
  for (const current of commands) {
    verifyRuntimeBoundary(options);
    const resolved =
      typeof current.resolve === "function" ? current.resolve() : current;
    result = spawnSync(resolved.executable, resolved.args, {
      cwd: resolved.cwd ?? options.cwd ?? rootDir,
      env: { ...env, ...(resolved.env ?? {}) },
      shell: false,
      stdio: options.stdio ?? "inherit",
    });
    verifyRuntimeBoundary(options);
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const status = result.status ?? `signal ${result.signal ?? "unknown"}`;
      throw new Error(`${step.label} failed with ${status}`);
    }
  }
  return result;
}

function main() {
  if (process.versions.node.split(".")[0] !== "22") {
    throw new Error(
      "FanPass Beta foundation verification requires Node 22 LTS",
    );
  }
  const verifiedGateSteps = gateSteps;
  validateProjectNpmConfig();
  const npmCli = resolveNpmCli();
  if (npmCli !== reviewedNpmCli) {
    throw new Error("The reviewed npm CLI path changed before gate execution");
  }
  const env = buildHardenedEnvironment();
  console.log("== FanPass Beta foundation local gates ==");
  for (const step of verifiedGateSteps) {
    console.log(`\n-- ${step.label}`);
    runStep(step, { env, npmCli });
  }
  console.log("\nBeta foundation local gates passed.");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? `Beta foundation verification failed: ${error.message}`
        : "Beta foundation verification failed",
    );
    process.exit(1);
  }
}

module.exports = {
  buildHardenedEnvironment,
  configureRuntimeIntegrityCheck,
  gateSteps,
  main,
  npmCliIdentity,
  resolveNpmCli,
  resolveStepCommand,
  runStep,
  validateNoNodeShadow,
  validateNodeExecutableIdentity,
  validateNpmCliIdentity,
  validateProjectNpmConfig,
  validateReviewedEntrypoint,
  validateRuntimeGateManifest,
  validateTrustedToolBin,
};
