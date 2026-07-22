"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  compileCommonJsModule,
  dependencyInputsProjection,
  executeReviewedRunner,
  packageScriptsProjection,
  reviewedDependencyInputsSha256,
  reviewedLocalTargetGuardSha256,
  reviewedPackageScriptsSha256,
  reviewedRunnerSha256,
  sha256,
  validateDependencyInputs,
  validatePackageScripts,
  validateReviewedRunner,
} = require("./beta-foundation-launcher");

const rootDir = path.resolve(__dirname, "..");
const launcherPath = path.join(rootDir, "scripts/beta-foundation-launcher.js");
const runnerPath = path.join(rootDir, "scripts/beta-foundation-verify.js");
const localTargetGuardPath = path.join(
  rootDir,
  "scripts/local-postgres-target-guard.js",
);
const manifestPaths = [
  "package.json",
  "apps/api/package.json",
  "apps/dashboard/package.json",
  "apps/console-auth/package.json",
];
const dependencyInputPaths = [
  ".npmrc",
  "package.json",
  "package-lock.json",
  "apps/api/package.json",
  "apps/dashboard/package.json",
  "apps/web/package.json",
  "packages/contracts/package.json",
  "packages/shared/package.json",
  "apps/console-auth/package.json",
  "apps/console-auth/package-lock.json",
];
const protectedPackageScripts = [
  ["package.json", "security:payment-response-redaction"],
  ["apps/api/package.json", "test"],
  ["apps/dashboard/package.json", "build"],
  ["apps/console-auth/package.json", "test"],
];

const cases = [
  testCase(
    "accepts the reviewed runner, local guard, and package scripts",
    () => {
      const reviewed = validateReviewedRunner();
      assert.strictEqual(reviewed.runnerPath, runnerPath);
      assert.strictEqual(sha256(reviewed.runnerSource), reviewedRunnerSha256);
      assert.strictEqual(
        sha256(reviewed.guardSource),
        reviewedLocalTargetGuardSha256,
      );
      assert.strictEqual(
        sha256(Buffer.from(JSON.stringify(packageScriptsProjection()), "utf8")),
        reviewedPackageScriptsSha256,
      );
      assert.strictEqual(
        sha256(
          Buffer.from(JSON.stringify(dependencyInputsProjection()), "utf8"),
        ),
        reviewedDependencyInputsSha256,
      );
      assert.doesNotThrow(() => validatePackageScripts());
      assert.doesNotThrow(() => validateDependencyInputs());
    },
  ),
  testCase(
    "compiles the reviewed shebang guard with Node CJS semantics",
    () => {
      const guardModule = compileCommonJsModule(
        fs.readFileSync(localTargetGuardPath),
        localTargetGuardPath,
      );
      assert.strictEqual(
        guardModule.exports.isAllowedLocalPostgresTarget(
          "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass",
          "fanpass",
        ),
        true,
      );
    },
  ),
  testCase("rejects runner execution-path bypasses before spawn", () => {
    withLauncherFixture((fixtureRoot) => {
      const fixtureRunner = path.join(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
      );
      const source = fs.readFileSync(fixtureRunner, "utf8");
      fs.writeFileSync(
        fixtureRunner,
        source.replace("function main() {", "function main() {\n  return;"),
      );
      const result = runFixtureLauncher(fixtureRoot);
      assert.notStrictEqual(result.status, 0);
      assert.match(result.stderr, /Gate runner digest/);
    });
  }),
  testCase(
    "rejects local PostgreSQL target guard substitution before spawn",
    () => {
      withLauncherFixture((fixtureRoot) => {
        const fixtureGuard = path.join(
          fixtureRoot,
          "scripts/local-postgres-target-guard.js",
        );
        fs.appendFileSync(fixtureGuard, "\nprocess.exit(0);\n");
        const result = runFixtureLauncher(fixtureRoot);
        assert.notStrictEqual(result.status, 0);
        assert.match(result.stderr, /Local PostgreSQL target guard digest/);
      });
    },
  ),
  testCase(
    "rejects no-op substitution in every protected package manifest",
    () => {
      for (const [
        relativeManifestPath,
        scriptName,
      ] of protectedPackageScripts) {
        withLauncherFixture((fixtureRoot) => {
          const packagePath = path.join(fixtureRoot, relativeManifestPath);
          const manifest = JSON.parse(fs.readFileSync(packagePath, "utf8"));
          manifest.scripts[scriptName] = 'node -e "process.exit(0)"';
          fs.writeFileSync(
            packagePath,
            `${JSON.stringify(manifest, null, 2)}\n`,
          );
          const result = runFixtureLauncher(fixtureRoot);
          assert.notStrictEqual(
            result.status,
            0,
            `${relativeManifestPath}:${scriptName} was accepted`,
          );
          assert.match(
            result.stderr,
            /Package script projection digest/,
            `${relativeManifestPath}:${scriptName} failed for the wrong reason`,
          );
        });
      }
    },
  ),
  testCase("rejects a dependency input mutation before execution", () => {
    withLauncherFixture((fixtureRoot) => {
      const dependencyPath = path.join(fixtureRoot, "apps/web/package.json");
      fs.appendFileSync(dependencyPath, "\n");
      const result = runFixtureLauncher(fixtureRoot);
      assert.notStrictEqual(result.status, 0);
      assert.match(result.stderr, /Dependency input digest/);
    });
  }),
  testCase("rejects a symlink in a protected path component", () => {
    withLauncherFixture((fixtureRoot) => {
      const originalApiRoot = path.join(fixtureRoot, "apps/api");
      const relocatedApiRoot = path.join(fixtureRoot, "apps/api-reviewed");
      fs.renameSync(originalApiRoot, relocatedApiRoot);
      fs.symlinkSync("api-reviewed", originalApiRoot);
      assert.throws(
        () => validatePackageScripts(fixtureRoot),
        /path must not contain symlinks/,
      );
    });
  }),
  testCase("executes the reviewed bytes without reopening their paths", () => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), "fanpass-reviewed-bytes-"),
    );
    const guardPath = path.join(fixtureRoot, "guard.js");
    const fixtureRunnerPath = path.join(fixtureRoot, "runner.js");
    try {
      fs.writeFileSync(
        guardPath,
        'throw new Error("unreviewed guard path executed");\n',
      );
      fs.writeFileSync(
        fixtureRunnerPath,
        'throw new Error("unreviewed runner path executed");\n',
      );
      let integrityChecks = 0;
      const result = executeReviewedRunner(
        {
          guardPath,
          guardSource: Buffer.from(
            'module.exports = { marker: "reviewed-guard" };\n',
          ),
          runnerPath: fixtureRunnerPath,
          runnerSource: Buffer.from(
            [
              'const guard = require("./guard");',
              "let check;",
              "module.exports = {",
              "  configureRuntimeIntegrityCheck(value) { check = value; },",
              "  main() { check(); return guard.marker; },",
              "};",
              "",
            ].join("\n"),
          ),
        },
        {
          guardRequest: "./guard",
          integrityCheck: () => (integrityChecks += 1),
        },
      );
      assert.strictEqual(result, "reviewed-guard");
      assert.strictEqual(integrityChecks, 1);
    } finally {
      delete require.cache[guardPath];
      delete require.cache[fixtureRunnerPath];
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }),
  testCase("propagates reviewed runner failures", () => {
    assert.throws(
      () =>
        executeReviewedRunner({
          guardPath: path.join(os.tmpdir(), "fanpass-failing-guard.js"),
          guardSource: Buffer.from("module.exports = {};\n"),
          runnerPath: path.join(os.tmpdir(), "fanpass-failing-runner.js"),
          runnerSource: Buffer.from(
            [
              "module.exports = {",
              "  configureRuntimeIntegrityCheck() {},",
              '  main() { throw new Error("fixture runner failed"); },',
              "};",
              "",
            ].join("\n"),
          ),
        }),
      /fixture runner failed/,
    );
  }),
];

const results = cases.map((entry) => entry());
const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, cases: results }, null, 2));

function withLauncherFixture(callback) {
  const fixtureRoot = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), "fanpass-foundation-launcher-"),
  );
  try {
    for (const relativePath of new Set([
      "scripts/beta-foundation-launcher.js",
      "scripts/beta-foundation-verify.js",
      "scripts/local-postgres-target-guard.js",
      ...manifestPaths,
      ...dependencyInputPaths,
    ])) {
      const destination = path.join(fixtureRoot, relativePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(rootDir, relativePath), destination);
    }
    fs.symlinkSync(
      path.join(rootDir, "node_modules"),
      path.join(fixtureRoot, "node_modules"),
    );
    callback(fixtureRoot);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function runFixtureLauncher(fixtureRoot) {
  return spawnSync(
    process.execPath,
    [path.join(fixtureRoot, "scripts/beta-foundation-launcher.js")],
    {
      cwd: fixtureRoot,
      env: process.env,
      encoding: "utf8",
      shell: false,
    },
  );
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
