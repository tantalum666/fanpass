const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");
const {
  HOSTED_BETA_FOUNDATION_BOOTSTRAP,
  HOSTED_BETA_FOUNDATION_SHELL,
} = require("./lib/beta-foundation-bootstrap");
const {
  buildHardenedEnvironment,
  gateSteps,
  npmCliIdentity,
  resolveStepCommand,
  runStep,
  validateNoNodeShadow,
  validateNodeExecutableIdentity,
  validateNpmCliIdentity,
  validateProjectNpmConfig,
  validateReviewedEntrypoint,
  validateRuntimeGateManifest,
} = require("./beta-foundation-verify");

const rootDir = path.resolve(__dirname, "..");
const runnerPath = path.join(rootDir, "scripts/beta-foundation-verify.js");
const workflowPath = path.join(
  rootDir,
  ".github/workflows/beta-foundation.yml",
);
const packageJsonPath = path.join(rootDir, "package.json");
const hostileOverrideKeys = Object.freeze([
  "BASHOPTS",
  "BASH_ENV",
  "CDPATH",
  "ENV",
  "GLOBIGNORE",
  "NODE_OPTIONS",
  "NODE_PATH",
  "SHELLOPTS",
  "BASH_FUNC_npm%%",
  "BASH_FUNC_node%%",
  "BASH_FUNC_sh%%",
  "npm_config_if_present",
  "Npm_Token",
  "npm_execpath",
  "FANPASS_PROVIDER_AUDIT_ROOT",
  "FANPASS_RENDER_RC_AUDIT_ROOT",
  "FANPASS_CI_NODE22_AUDIT_ROOT",
  "FANPASS_ENGINEERING_GATES_AUDIT_ROOT",
  "FANPASS_DEPENDENCY_ADVISORY_ROOT",
  "FANPASS_DEPENDENCY_ADVISORY_AUDIT_JSON",
  "FANPASS_DEPENDENCY_ADVISORY_NEXT_JSON",
  "FANPASS_EVIDENCE_REDACTION_ROOT",
  "FANPASS_EVIDENCE_REDACTION_DIR",
  "FANPASS_PRIVY_READINESS_SKIP_DB",
  "FANPASS_SKIP_SECURITY_AUDIT",
  "FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES",
  "FANPASS_CONSOLE_ACCESS_TOKEN",
  "PRIVY_APP_SECRET",
  "PRIVY_VERIFICATION_KEY",
  "STRIPE_SECRET_KEY",
  "RPC_URL",
  "OPERATOR_PRIVATE_KEY",
  "DEPLOY_PRIVATE_KEY",
  "GITHUB_TOKEN",
  "AWS_SECRET_ACCESS_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "PGPASSFILE",
  "PGPASSWORD",
  "AUDIT_ROOT",
  "EVIDENCE_PATH",
  "SKIP_TESTS",
]);

const cases = [
  testCase(
    "inherits only the reviewed Beta inputs and strips hostile overrides",
    () => {
      const env = buildHardenedEnvironment(hostileEnvironment());
      assert.deepStrictEqual(
        Object.keys(env).sort(),
        [
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
        ].sort(),
      );
      assert.strictEqual(env.HOME, env.TMPDIR);
      assert.strictEqual(env.HOME, env.RUNNER_TEMP);
      assert.match(env.HOME, /^\/tmp\/fanpass-beta-gate-/);
      assert.strictEqual(fs.statSync(env.HOME).mode & 0o777, 0o700);
      assert.notStrictEqual(env.HOME, "/tmp/fanpass-reviewed-home");
      assert.notStrictEqual(env.TMPDIR, "/tmp/fanpass-reviewed-tmp");
      assert.strictEqual(env.CI, "true");
      assert.strictEqual(env.GITHUB_ACTIONS, "true");
      assert.strictEqual(
        env.DATABASE_URL,
        "postgresql://fanpass:password@127.0.0.1:5432/fanpass",
      );
      assert.strictEqual(env.FANPASS_DATA_SOURCE, "prisma");
      assert.strictEqual(env.FANPASS_SKIP_DOCKER_POSTGRES, "true");
      assert.strictEqual(env.FANPASS_STRICT_NODE_RUNTIME, "true");
      assert.strictEqual(env.FANPASS_GATE_HARDENED, "true");
      assert.strictEqual(env.NPM_CONFIG_SCRIPT_SHELL, "/bin/sh");
      assert.strictEqual(env.npm_config_script_shell, "/bin/sh");

      for (const key of hostileOverrideKeys) {
        assert.ok(!(key in env), `${key} must not reach gate children`);
      }
    },
  ),
  testCase("fixes the proof profile instead of trusting caller values", () => {
    const env = buildHardenedEnvironment({
      DATABASE_URL: "postgresql://fanpass:password@127.0.0.1:5432/fanpass",
      FANPASS_DATA_SOURCE: "mock",
      FANPASS_SKIP_DOCKER_POSTGRES: "false",
      FANPASS_STRICT_NODE_RUNTIME: "false",
      CI: "false",
      GITHUB_ACTIONS: "1",
    });
    assert.strictEqual(env.FANPASS_DATA_SOURCE, "prisma");
    assert.strictEqual(env.FANPASS_SKIP_DOCKER_POSTGRES, "true");
    assert.strictEqual(env.FANPASS_STRICT_NODE_RUNTIME, "true");
    assert.ok(!("CI" in env));
    assert.ok(!("GITHUB_ACTIONS" in env));
  }),
  testCase("accepts literal IPv4 and IPv6 loopback fanpass targets", () => {
    for (const databaseUrl of [
      "postgresql://fanpass:password@127.0.0.1:5432/fanpass",
      "postgres://fanpass:password@[::1]:5432/fanpass",
    ]) {
      assert.strictEqual(
        buildHardenedEnvironment({ DATABASE_URL: databaseUrl }).DATABASE_URL,
        databaseUrl,
      );
    }
  }),
  testCase("rejects non-literal or unsafe PostgreSQL targets", () => {
    for (const databaseUrl of [
      "postgresql://fanpass:password@localhost:5432/fanpass",
      "postgresql://fanpass:password@db.example.test:5432/fanpass",
      "postgresql://fanpass:password@127.0.0.1:5432/postgres",
      "postgresql://fanpass@127.0.0.1:5432/fanpass",
      "postgresql://fanpass:password@127.0.0.1:5432/fanpass?host=db.example.test",
    ]) {
      assert.throws(
        () => buildHardenedEnvironment({ DATABASE_URL: databaseUrl }),
        /explicit local PostgreSQL fanpass target/,
      );
    }
  }),
  testCase("uses the fixed local PostgreSQL fallback when unset", () => {
    assert.strictEqual(
      buildHardenedEnvironment({}).DATABASE_URL,
      "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass",
    );
    assert.strictEqual(
      buildHardenedEnvironment({ DATABASE_URL: "" }).DATABASE_URL,
      "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass",
    );
  }),
  testCase("uses only the fixed Node and system binary path", () => {
    const env = buildHardenedEnvironment(hostileEnvironment());
    const entries = env.PATH.split(path.delimiter);
    assert.match(entries[0], /^\/tmp\/fanpass-beta-gate-[^/]+\/trusted-bin$/);
    assert.deepStrictEqual(entries.slice(1), [
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
    ]);
    assert.deepStrictEqual(fs.readdirSync(entries[0]).sort(), ["node", "npm"]);
    assert.strictEqual(
      fs.realpathSync(path.join(entries[0], "node")),
      fs.realpathSync(process.execPath),
    );
    assert.strictEqual(
      path.basename(fs.realpathSync(path.join(entries[0], "npm"))),
      "npm-cli.js",
    );
    assert.strictEqual(fs.lstatSync(entries[0]).mode & 0o777, 0o700);
    assert.ok(!env.PATH.includes("attacker-bin"));
  }),
  testCase("rejects a workspace npm bin that shadows Node", () => {
    withFixture((fixtureRoot) => {
      const shadowPath = path.join(fixtureRoot, "node_modules/.bin/node");
      fs.mkdirSync(path.dirname(shadowPath), { recursive: true });
      fs.writeFileSync(shadowPath, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
      assert.throws(
        () => validateNoNodeShadow([fixtureRoot]),
        /Refusing npm script Node shadow/,
      );
    });
  }),
  testCase("rejects replacement of the bootstrapped Node executable", () => {
    withFixture((fixtureRoot) => {
      const executablePath = path.join(fixtureRoot, "node");
      fs.writeFileSync(executablePath, "reviewed", { mode: 0o700 });
      const stat = fs.statSync(executablePath, { bigint: true });
      const expected = {
        dev: stat.dev,
        ino: stat.ino,
        mode: stat.mode,
        size: stat.size,
        mtimeNs: stat.mtimeNs,
        ctimeNs: stat.ctimeNs,
      };
      const replacement = path.join(fixtureRoot, "replacement");
      fs.writeFileSync(replacement, "unreviewed", { mode: 0o700 });
      fs.renameSync(replacement, executablePath);
      assert.throws(
        () => validateNodeExecutableIdentity(expected, executablePath),
        /executable changed after the authoritative bootstrap/,
      );
    });
  }),
  testCase("rejects same-length in-place npm CLI replacement", () => {
    withFixture((fixtureRoot) => {
      const npmCliPath = path.join(fixtureRoot, "npm-cli.js");
      fs.writeFileSync(npmCliPath, "AAAA", { mode: 0o500 });
      const expected = npmCliIdentity(npmCliPath);
      const originalTimes = fs.statSync(npmCliPath);
      fs.chmodSync(npmCliPath, 0o700);
      fs.writeFileSync(npmCliPath, "BBBB", { mode: 0o700 });
      fs.chmodSync(npmCliPath, 0o500);
      fs.utimesSync(npmCliPath, originalTimes.atime, originalTimes.mtime);
      assert.throws(
        () => validateNpmCliIdentity(expected, npmCliPath),
        /reviewed npm CLI changed/,
      );
    });
  }),
  testCase("rejects symlinked direct execution entrypoints", () => {
    withFixture((fixtureRoot) => {
      const reviewedPath = path.join(fixtureRoot, "reviewed.js");
      const linkedPath = path.join(fixtureRoot, "linked.js");
      fs.writeFileSync(reviewedPath, "process.exit(0);\n", { mode: 0o600 });
      fs.symlinkSync(reviewedPath, linkedPath);
      assert.strictEqual(
        validateReviewedEntrypoint(
          reviewedPath,
          fixtureRoot,
          "Fixture entrypoint",
        ),
        reviewedPath,
      );
      assert.throws(
        () =>
          validateReviewedEntrypoint(
            linkedPath,
            fixtureRoot,
            "Fixture entrypoint",
          ),
        /path must not contain symlinks/,
      );
    });
  }),
  testCase("runs only deterministic installs through the fixed npm CLI", () => {
    const command = resolveStepCommand(gateSteps[0], "/trusted/npm-cli.js");
    assert.strictEqual(command.executable, process.execPath);
    assert.deepStrictEqual(command.args, [
      "/trusted/npm-cli.js",
      command.args[1],
      command.args[2],
      "--script-shell=/bin/sh",
      "--if-present=false",
      "--ignore-scripts=true",
      "--node-options=",
      "ci",
      "--include=dev",
    ]);
    const userConfigPath = command.args[1].replace("--userconfig=", "");
    const globalConfigPath = command.args[2].replace("--globalconfig=", "");
    assert.ok(
      command.args[1].startsWith("--userconfig=/tmp/fanpass-beta-gate-"),
    );
    assert.ok(
      command.args[2].startsWith("--globalconfig=/tmp/fanpass-beta-gate-"),
    );
    assert.notStrictEqual(userConfigPath, globalConfigPath);
    for (const configPath of [userConfigPath, globalConfigPath]) {
      assert.strictEqual(fs.readFileSync(configPath, "utf8"), "");
      assert.strictEqual(fs.statSync(configPath).mode & 0o777, 0o600);
    }
  }),
  testCase("rejects generic npm commands outside the two installs", () => {
    assert.throws(
      () =>
        resolveStepCommand(
          { label: "generic npm", kind: "npm", args: ["--version"] },
          "/trusted/npm-cli.js",
        ),
      /Only deterministic install or reviewed package scripts/,
    );
  }),
  testCase(
    "executes deterministic install with isolated config and environment",
    () => {
      withFixture((fixtureRoot) => {
        const capturePath = path.join(fixtureRoot, "capture.json");
        const fakeNpmCli = path.join(fixtureRoot, "npm-cli.js");
        const hostileHome = path.join(fixtureRoot, "hostile-home");
        fs.mkdirSync(hostileHome);
        fs.writeFileSync(
          path.join(hostileHome, ".npmrc"),
          "script-shell=/usr/bin/true\nif-present=true\nignore-scripts=true\n",
          { mode: 0o600 },
        );
        fs.writeFileSync(
          fakeNpmCli,
          `const fs = require("fs");
fs.writeFileSync(${JSON.stringify(capturePath)}, JSON.stringify({
  argv: process.argv.slice(2),
  home: process.env.HOME,
  tmpdir: process.env.TMPDIR,
  keys: Object.keys(process.env).sort(),
  marker: "executed",
}));
`,
          { mode: 0o600 },
        );
        const env = buildHardenedEnvironment({
          ...hostileEnvironment(),
          HOME: hostileHome,
        });
        runStep(gateSteps[0], {
          cwd: fixtureRoot,
          env,
          npmCli: fakeNpmCli,
          stdio: "pipe",
        });
        const capture = JSON.parse(fs.readFileSync(capturePath, "utf8"));
        assert.strictEqual(capture.marker, "executed");
        assert.strictEqual(capture.home, env.HOME);
        assert.strictEqual(capture.tmpdir, env.TMPDIR);
        assert.notStrictEqual(capture.home, hostileHome);
        const userConfig = capture.argv.find((arg) =>
          arg.startsWith("--userconfig="),
        );
        const globalConfig = capture.argv.find((arg) =>
          arg.startsWith("--globalconfig="),
        );
        assert.ok(userConfig);
        assert.ok(globalConfig);
        assert.notStrictEqual(userConfig, globalConfig);
        assert.ok(capture.argv.includes("--script-shell=/bin/sh"));
        assert.ok(capture.argv.includes("--ignore-scripts=true"));
        assert.ok(!capture.argv.includes("--ignore-scripts=false"));
        assert.deepStrictEqual(capture.argv.slice(-2), ["ci", "--include=dev"]);
        assert.ok(!capture.keys.some((key) => key.startsWith("BASH_FUNC_")));
        assert.ok(!capture.keys.includes("BASH_ENV"));
        assert.ok(!capture.keys.includes("NODE_OPTIONS"));
        assert.ok(!capture.keys.includes("FANPASS_PROVIDER_AUDIT_ROOT"));
        assert.ok(!capture.keys.includes("PRIVY_APP_SECRET"));
      });
    },
  ),
  testCase(
    "fixed direct commands cannot be intercepted by repository or ancestor bins",
    () => {
      withFixture((fixtureRoot) => {
        const repositoryBin = path.join(
          fixtureRoot,
          "workspace/node_modules/.bin",
        );
        const ancestorBin = path.join(fixtureRoot, "node_modules/.bin");
        for (const directory of [repositoryBin, ancestorBin]) {
          fs.mkdirSync(directory, { recursive: true });
          for (const name of ["node", "npm", "bash", "jest", "prisma"]) {
            fs.writeFileSync(
              path.join(directory, name),
              "#!/bin/sh\nexit 99\n",
              { mode: 0o700 },
            );
          }
        }

        const hardened = buildHardenedEnvironment({
          PATH: [repositoryBin, ancestorBin, process.env.PATH ?? ""].join(
            path.delimiter,
          ),
        });
        assert.ok(!hardened.PATH.includes(repositoryBin));
        assert.ok(!hardened.PATH.includes(ancestorBin));

        const byLabel = (label) => {
          const step = gateSteps.find((entry) => entry.label === label);
          assert.ok(step, `missing gate step ${label}`);
          return resolveStepCommand(step, "/trusted/npm-cli.js");
        };
        const nodeAudit = byLabel("Payment response redaction audit");
        assert.strictEqual(nodeAudit.executable, process.execPath);
        assert.strictEqual(
          nodeAudit.args[0],
          path.join(rootDir, "scripts/payment-response-redaction-audit.js"),
        );

        const bashAudit = byLabel("Side-effect worker saga verification");
        assert.strictEqual(bashAudit.executable, "/bin/bash");
        assert.strictEqual(
          bashAudit.args[0],
          path.join(rootDir, "scripts/side-effects-worker-verify.sh"),
        );

        const prisma = byLabel("API Prisma client generation");
        assert.strictEqual(prisma.executable, process.execPath);
        assert.strictEqual(
          prisma.args[0],
          path.join(rootDir, "node_modules/prisma/build/index.js"),
        );

        const jest = byLabel("Verify on-sale concurrency invariants");
        assert.strictEqual(jest.executable, process.execPath);
        assert.strictEqual(
          jest.args[0],
          path.join(rootDir, "node_modules/jest/bin/jest.js"),
        );
        const migration = byLabel("Apply post-identity schema chain");
        const backfill = migration.commands.find((command) =>
          command.args.includes(
            "src/workers/backfill-ticket-ownership-routes.ts",
          ),
        );
        assert.deepStrictEqual(backfill.env, {
          FANPASS_LEGACY_OWNERSHIP_ADAPTER: "mock",
        });
        for (const command of [nodeAudit, bashAudit, prisma, jest]) {
          assert.ok(!command.executable.includes("node_modules/.bin"));
          assert.ok(!command.args[0].includes("node_modules/.bin"));
        }
      });
    },
  ),
  testCase("fails closed on a non-zero child exit", () => {
    withFixture((fixtureRoot) => {
      const fakeNpmCli = path.join(fixtureRoot, "npm-cli.js");
      fs.writeFileSync(fakeNpmCli, "process.exit(23);\n", { mode: 0o600 });
      assert.throws(
        () =>
          runStep(gateSteps[0], {
            cwd: fixtureRoot,
            env: buildHardenedEnvironment(hostileEnvironment()),
            npmCli: fakeNpmCli,
            stdio: "pipe",
          }),
        /failed with 23/,
      );
    });
  }),
  testCase("fails closed when a child terminates by signal", () => {
    withFixture((fixtureRoot) => {
      const fakeNpmCli = path.join(fixtureRoot, "npm-cli.js");
      fs.writeFileSync(fakeNpmCli, 'process.kill(process.pid, "SIGTERM");\n', {
        mode: 0o600,
      });
      assert.throws(
        () =>
          runStep(gateSteps[0], {
            cwd: fixtureRoot,
            env: buildHardenedEnvironment(hostileEnvironment()),
            npmCli: fakeNpmCli,
            stdio: "pipe",
          }),
        /signal SIGTERM/,
      );
    });
  }),
  testCase("rejects project npm script-shell drift", () => {
    withFixture((fixtureRoot) => {
      const npmrc = path.join(fixtureRoot, ".npmrc");
      fs.writeFileSync(
        npmrc,
        "engine-strict=true\nscript-shell=/usr/bin/true\n",
        { mode: 0o600 },
      );
      assert.throws(() => validateProjectNpmConfig(npmrc), /exact reviewed/);
    });
  }),
  testCase("keeps one unique, typed, ordered gate manifest", () => {
    assert.ok(gateSteps.length >= 90);
    assert.strictEqual(
      new Set(gateSteps.map((step) => step.label)).size,
      gateSteps.length,
    );
    for (const step of gateSteps) {
      assert.ok(["npm", "node", "sh"].includes(step.kind));
      assert.ok(Array.isArray(step.args) && step.args.length > 0);
      assert.ok(step.args.every((arg) => typeof arg === "string"));
      assert.ok(!step.args.some((arg) => /(?:\|\||&&|;|`|\$\()/.test(arg)));
    }
    assert.deepStrictEqual(gateSteps[0], {
      label: "Root deterministic dependency install",
      kind: "npm",
      args: ["ci", "--include=dev"],
    });
    assert.deepStrictEqual(gateSteps[1], {
      label: "Console Auth deterministic dependency install",
      kind: "npm",
      args: ["--prefix", "apps/console-auth", "ci", "--include=dev"],
    });
    assert.deepStrictEqual(gateSteps[2], {
      label: "Beta foundation launcher self-test",
      kind: "node",
      args: ["scripts/beta-foundation-launcher-self-test.js"],
    });
    assert.deepStrictEqual(gateSteps[3], {
      label: "Beta foundation runner self-test",
      kind: "node",
      args: ["scripts/beta-foundation-verify-self-test.js"],
    });
    assert.deepStrictEqual(gateSteps[4], {
      label: "API Prisma client generation",
      kind: "npm",
      args: ["run", "prisma:generate", "-w", "apps/api"],
    });
    assert.deepStrictEqual(gateSteps[5], {
      label: "Bootstrap disposable Prisma schema",
      kind: "npm",
      args: ["run", "prisma:push:raw", "-w", "apps/api", "--", "--force-reset"],
    });
    assertCriticalOrder([
      "PostgreSQL side-effect health integration wrapper self-test",
      "Side-effect outbox health self-test",
      "PostgreSQL side-effect health store integration",
      "Hermetic local side-effect health profile self-test",
      "Side-effect outbox local health check",
    ]);
  }),
  testCase("matches every runtime gate step to the audited source", () => {
    const source = fs.readFileSync(runnerPath, "utf8");
    const verifiedSteps = validateRuntimeGateManifest(source, gateSteps);
    assert.ok(Object.isFrozen(verifiedSteps));
    assert.ok(verifiedSteps.every((step) => Object.isFrozen(step)));
    assert.ok(verifiedSteps.every((step) => Object.isFrozen(step.args)));
    assert.deepStrictEqual(verifiedSteps, gateSteps);

    const mutatedSteps = gateSteps.map((step) => ({
      label: step.label,
      kind: step.kind,
      args: [...step.args],
    }));
    mutatedSteps[1] = {
      ...mutatedSteps[1],
      kind: "node",
      args: ["scripts/noop.js"],
    };
    assert.throws(
      () => validateRuntimeGateManifest(source, mutatedSteps),
      /differs from its audited source manifest/,
    );
  }),
  testCase("rejects helper and Object.freeze semantic substitution", () => {
    const source = fs.readFileSync(runnerPath, "utf8");
    const maliciousHelper = source.replace(
      'const npmStep = (label, ...args) => ({ label, kind: "npm", args });',
      'const npmStep = (label, ...args) => ({ label, kind: "node", args: ["scripts/noop.js"] });',
    );
    assert.notStrictEqual(maliciousHelper, source);
    assert.throws(
      () => validateRuntimeGateManifest(maliciousHelper, gateSteps),
      /npmStep|helper|manifest|skeleton/,
    );

    const shadowedObject = source.replace(
      "const gateSteps = Object.freeze([",
      "const Object = { freeze() { return []; } };\nconst gateSteps = Object.freeze([",
    );
    assert.notStrictEqual(shadowedObject, source);
    assert.throws(
      () => validateRuntimeGateManifest(shadowedObject, gateSteps),
      /Object|shadow|manifest|skeleton/,
    );
  }),
  testCase("rejects gate main and entrypoint execution substitutions", () => {
    const source = fs.readFileSync(runnerPath, "utf8");
    const mutations = [
      source.replace("function main() {", "function main() {\n  return;"),
      source.replace(
        "function main() {",
        "function main() {\n  const runStep = () => ({ status: 0 });",
      ),
      source.replace(
        "if (require.main === module) {",
        "main = () => {};\nif (require.main === module) {",
      ),
      source.replace(
        "if (require.main === module) {",
        "if (false && require.main === module) {",
      ),
      source.replace(
        "const npmCli = resolveNpmCli();",
        'const npmCli = "/tmp/noop.js";',
      ),
      source.replace(
        "function main() {",
        "if (false) validateRuntimeGateManifest = () => [];\nfunction main() {",
      ),
      source.replace(
        "function main() {",
        "if (false) runStep = () => ({ status: 0 });\nfunction main() {",
      ),
    ];
    for (const mutatedSource of mutations) {
      assert.notStrictEqual(mutatedSource, source);
      assert.throws(
        () => validateRuntimeGateManifest(mutatedSource, gateSteps),
        /main|entry|binding|assign|npmCli|gate|manifest|runStep/,
      );
    }
  }),
  testCase("rejects substitution of the reviewed full gate manifest", () => {
    const source = fs.readFileSync(runnerPath, "utf8");
    const substituted = source.replace(
      '"API Prisma client generation"',
      '"API Prisma client generation bypassed"',
    );
    assert.notStrictEqual(substituted, source);
    assert.throws(
      () => validateRuntimeGateManifest(substituted, gateSteps),
      /canonical manifest digest/,
    );
  }),
  testCase("removes the npm and shell authoritative aliases", () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    assert.strictEqual(
      packageJson.scripts["beta:foundation:verify"],
      undefined,
    );
    assert.ok(
      !fs.existsSync(path.join(rootDir, "scripts/beta-foundation-verify.sh")),
    );
  }),
  testCase("keeps Hosted CI on the pre-Node env-i bootstrap", () => {
    const workflow = fs.readFileSync(workflowPath, "utf8");
    const parsed = yaml.load(workflow, { schema: yaml.FAILSAFE_SCHEMA });
    const steps = parsed?.jobs?.["beta-foundation"]?.steps;
    const matches = Array.isArray(steps)
      ? steps.filter((step) => step?.name === "Verify Beta foundation")
      : [];
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].shell, HOSTED_BETA_FOUNDATION_SHELL);
    assert.strictEqual(matches[0].run, HOSTED_BETA_FOUNDATION_BOOTSTRAP);
    assert.ok(matches[0].run.includes("exec /usr/bin/env -i"));
    assert.ok(matches[0].run.includes('"$RUNNER_TOOL_CACHE"/node/22.'));
    assert.ok(!workflow.includes("npm run beta:foundation:verify"));
    assert.ok(!workflow.includes("beta-foundation-verify.sh"));
    assert.ok(
      !workflow.includes("/usr/bin/env node scripts/beta-foundation-verify.js"),
    );
  }),
  testCase("keeps the runner on shell-false child execution", () => {
    const source = fs.readFileSync(runnerPath, "utf8");
    assert.ok(source.includes("shell: false"));
    assert.ok(source.includes('process.versions.node.split(".")[0] !== "22"'));
    assert.ok(!source.includes("execSync("));
    assert.ok(!source.includes("shell: true"));
    assert.ok(
      source.indexOf("const verifiedGateSteps = gateSteps;") <
        source.indexOf("for (const step of verifiedGateSteps)"),
    );
    assert.ok(!source.includes("for (const step of gateSteps)"));
  }),
];

const results = cases.map((entry) => entry());
const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, cases: results }, null, 2));

function hostileEnvironment() {
  return {
    ...process.env,
    HOME: "/tmp/fanpass-reviewed-home",
    TMPDIR: "/tmp/fanpass-reviewed-tmp",
    CI: "true",
    GITHUB_ACTIONS: "true",
    RUNNER_TEMP: "/tmp/fanpass-reviewed-runner",
    DATABASE_URL: "postgresql://fanpass:password@127.0.0.1:5432/fanpass",
    FANPASS_DATA_SOURCE: "mock",
    FANPASS_SKIP_DOCKER_POSTGRES: "false",
    FANPASS_STRICT_NODE_RUNTIME: "false",
    PATH: `/tmp/attacker-bin${path.delimiter}${process.env.PATH ?? ""}`,
    BASHOPTS: "extdebug",
    BASH_ENV: "/tmp/attacker-bash-env",
    CDPATH: "/tmp/attacker-cdpath",
    ENV: "/tmp/attacker-env",
    GLOBIGNORE: "*",
    NODE_OPTIONS: "--require=/tmp/attacker-node.js",
    NODE_PATH: "/tmp/attacker-node-path",
    SHELLOPTS: "xtrace",
    "BASH_FUNC_npm%%": "() { return 0; }",
    "BASH_FUNC_node%%": "() { return 0; }",
    "BASH_FUNC_sh%%": "() { return 0; }",
    NPM_CONFIG_SCRIPT_SHELL: "/usr/bin/true",
    npm_config_script_shell: "/usr/bin/true",
    npm_config_if_present: "true",
    Npm_Token: "self-test-marker",
    npm_execpath: "/tmp/attacker-npm",
    FANPASS_PROVIDER_AUDIT_ROOT: "/tmp/attacker-provider-root",
    FANPASS_RENDER_RC_AUDIT_ROOT: "/tmp/attacker-render-root",
    FANPASS_CI_NODE22_AUDIT_ROOT: "/tmp/attacker-ci-root",
    FANPASS_ENGINEERING_GATES_AUDIT_ROOT: "/tmp/attacker-gates-root",
    FANPASS_DEPENDENCY_ADVISORY_ROOT: "/tmp/attacker-advisory-root",
    FANPASS_DEPENDENCY_ADVISORY_AUDIT_JSON: "/tmp/forged-audit.json",
    FANPASS_DEPENDENCY_ADVISORY_NEXT_JSON: "/tmp/forged-next.json",
    FANPASS_EVIDENCE_REDACTION_ROOT: "/tmp/attacker-evidence-root",
    FANPASS_EVIDENCE_REDACTION_DIR: "/tmp/attacker-evidence-dir",
    FANPASS_PRIVY_READINESS_SKIP_DB: "true",
    FANPASS_SKIP_SECURITY_AUDIT: "true",
    FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES: "true",
    FANPASS_CONSOLE_ACCESS_TOKEN: "attacker-console-token",
    PRIVY_APP_SECRET: "attacker-privy-secret",
    PRIVY_VERIFICATION_KEY: "attacker-privy-key",
    STRIPE_SECRET_KEY: "attacker-stripe-secret",
    RPC_URL: "https://attacker.invalid",
    OPERATOR_PRIVATE_KEY: "attacker-operator-key",
    DEPLOY_PRIVATE_KEY: "attacker-deploy-key",
    GITHUB_TOKEN: "attacker-github-token",
    AWS_SECRET_ACCESS_KEY: "attacker-aws-secret",
    GOOGLE_APPLICATION_CREDENTIALS: "/tmp/attacker-google-credentials.json",
    PGPASSFILE: "/tmp/attacker-pgpass",
    PGPASSWORD: "attacker-postgres-password",
    AUDIT_ROOT: "/tmp/attacker-generic-audit-root",
    EVIDENCE_PATH: "/tmp/attacker-generic-evidence",
    SKIP_TESTS: "true",
  };
}

function assertCriticalOrder(labels) {
  const positions = labels.map((label) =>
    gateSteps.findIndex((step) => step.label === label),
  );
  assert.ok(positions.every((position) => position >= 0));
  assert.deepStrictEqual(
    [...positions].sort((left, right) => left - right),
    positions,
  );
}

function withFixture(callback) {
  const fixtureRoot = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), "fanpass-beta-runner-"),
  );
  try {
    return callback(fixtureRoot);
  } finally {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  }
}

function testCase(label, fn) {
  return () => {
    try {
      fn();
      return { label, expected: "pass", status: 0, ok: true };
    } catch (error) {
      return {
        label,
        expected: "pass",
        status: 1,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}
