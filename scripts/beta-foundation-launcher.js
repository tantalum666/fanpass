"use strict";

const crypto = require("crypto");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const vm = require("vm");

const rootDir = path.resolve(__dirname, "..");
const runnerRelativePath = "scripts/beta-foundation-verify.js";
const localTargetGuardRelativePath = "scripts/local-postgres-target-guard.js";
const reviewedRunnerSha256 =
  "690f80e13f7ed32ce6560fb982f703a52760884c4ed5f5019f025d58f9aed1cd";
const reviewedLocalTargetGuardSha256 =
  "0abd9001cabac53b5ed327dbc171545d8f6d2ca831dba70dee8e7c93fdd03aa8";
const reviewedPackageScriptsSha256 =
  "af945dcfe9b78c81c2447baefb0c20d883af5058ac92a08cd2aa35ffbee45683";
const reviewedDependencyInputsSha256 =
  "822c8dfa78e08ec9907b09fcad473a05daec7bcb993281d5ae345fa4f2429d74";
const packageManifestPaths = Object.freeze([
  "package.json",
  "apps/api/package.json",
  "apps/dashboard/package.json",
  "apps/console-auth/package.json",
]);
const dependencyInputPaths = Object.freeze([
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
]);

function sha256(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

function validateCanonicalProjectRoot(projectRoot = rootDir) {
  const expectedRoot = path.resolve(projectRoot);
  const canonicalRoot = fs.realpathSync(expectedRoot);
  if (canonicalRoot !== expectedRoot) {
    throw new Error(
      "The Beta foundation project root must not contain symlinks",
    );
  }
  return canonicalRoot;
}

function readRegularFile(filePath, label, projectRoot = rootDir) {
  const canonicalRoot = validateCanonicalProjectRoot(projectRoot);
  const expectedPath = path.resolve(filePath);
  const relativePath = path.relative(canonicalRoot, expectedPath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`${label} must stay below the canonical project root`);
  }
  if (fs.realpathSync(expectedPath) !== expectedPath) {
    throw new Error(`${label} path must not contain symlinks`);
  }
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(expectedPath, flags);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) {
      throw new Error(`${label} must be a regular file`);
    }
    return fs.readFileSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function validateReviewedRunner(projectRoot = rootDir) {
  validateCanonicalProjectRoot(projectRoot);
  const runnerPath = path.join(projectRoot, runnerRelativePath);
  const runnerSource = readRegularFile(runnerPath, "Gate runner", projectRoot);
  const runnerActual = sha256(runnerSource);
  if (runnerActual !== reviewedRunnerSha256) {
    throw new Error(
      `Gate runner digest ${runnerActual} does not match reviewed ${reviewedRunnerSha256}`,
    );
  }
  const guardPath = path.join(projectRoot, localTargetGuardRelativePath);
  const guardSource = readRegularFile(
    guardPath,
    "Local PostgreSQL target guard",
    projectRoot,
  );
  const guardActual = sha256(guardSource);
  if (guardActual !== reviewedLocalTargetGuardSha256) {
    throw new Error(
      `Local PostgreSQL target guard digest ${guardActual} does not match reviewed ${reviewedLocalTargetGuardSha256}`,
    );
  }
  return Object.freeze({
    guardPath,
    guardSource,
    runnerPath,
    runnerSource,
  });
}

function packageScriptsProjection(projectRoot = rootDir) {
  return packageManifestPaths.map((relativePath) => {
    const manifestPath = path.join(projectRoot, relativePath);
    const manifest = JSON.parse(
      readRegularFile(manifestPath, relativePath, projectRoot).toString("utf8"),
    );
    if (
      manifest.scripts == null ||
      typeof manifest.scripts !== "object" ||
      Array.isArray(manifest.scripts)
    ) {
      throw new Error(`${relativePath} must expose a scripts object`);
    }
    const scripts = Object.fromEntries(
      Object.entries(manifest.scripts)
        .map(([name, command]) => {
          if (typeof command !== "string" || command.length === 0) {
            throw new Error(
              `${relativePath} script ${name} must be a non-empty string`,
            );
          }
          return [name, command];
        })
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    );
    return {
      path: relativePath,
      name: typeof manifest.name === "string" ? manifest.name : null,
      scripts,
    };
  });
}

function validatePackageScripts(projectRoot = rootDir) {
  const projection = packageScriptsProjection(projectRoot);
  const actual = sha256(Buffer.from(JSON.stringify(projection), "utf8"));
  if (actual !== reviewedPackageScriptsSha256) {
    throw new Error(
      `Package script projection digest ${actual} does not match reviewed ${reviewedPackageScriptsSha256}`,
    );
  }
  return projection;
}

function dependencyInputsProjection(projectRoot = rootDir) {
  return dependencyInputPaths.map((relativePath) => ({
    path: relativePath,
    sha256: sha256(
      readRegularFile(
        path.join(projectRoot, relativePath),
        relativePath,
        projectRoot,
      ),
    ),
  }));
}

function validateDependencyInputs(projectRoot = rootDir) {
  const projection = dependencyInputsProjection(projectRoot);
  const actual = sha256(Buffer.from(JSON.stringify(projection), "utf8"));
  if (actual !== reviewedDependencyInputsSha256) {
    throw new Error(
      `Dependency input digest ${actual} does not match reviewed ${reviewedDependencyInputsSha256}`,
    );
  }
  return projection;
}

function compileCommonJsModule(
  source,
  filename,
  parent = module,
  requireOverrides = new Map(),
) {
  let executableSource = source.toString("utf8");
  if (executableSource.charCodeAt(0) === 0xfeff) {
    executableSource = executableSource.slice(1);
  }
  executableSource = executableSource.replace(/^#![^\r\n]*/, (shebang) =>
    " ".repeat(shebang.length),
  );
  const loaded = new Module(filename, parent);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  const fixedRequire = (request) =>
    requireOverrides.has(request)
      ? requireOverrides.get(request)
      : originalRequire(request);
  fixedRequire.resolve = originalRequire.resolve;
  fixedRequire.cache = require.cache;
  fixedRequire.extensions = require.extensions;
  fixedRequire.main = require.main;
  const wrapped = new vm.Script(Module.wrap(executableSource), {
    filename,
  }).runInThisContext();
  wrapped.call(
    loaded.exports,
    loaded.exports,
    fixedRequire,
    loaded,
    filename,
    path.dirname(filename),
  );
  loaded.loaded = true;
  return loaded;
}

function executeReviewedRunner(reviewed, options = {}) {
  const compile = options.compileModule ?? compileCommonJsModule;
  const guardModule = compile(reviewed.guardSource, reviewed.guardPath, module);
  const guardRequest = options.guardRequest ?? "./local-postgres-target-guard";
  const runnerModule = compile(
    reviewed.runnerSource,
    reviewed.runnerPath,
    module,
    new Map([[guardRequest, guardModule.exports]]),
  );
  const runner = runnerModule.exports;
  if (
    typeof runner?.configureRuntimeIntegrityCheck !== "function" ||
    typeof runner?.main !== "function"
  ) {
    throw new Error(
      "Reviewed Beta foundation runner must export its integrity configurator and main entrypoint",
    );
  }
  runner.configureRuntimeIntegrityCheck(
    options.integrityCheck ?? (() => {}),
    options.packageScriptsProjection ?? [],
  );
  return runner.main();
}

function main() {
  if (process.versions.node.split(".")[0] !== "22") {
    throw new Error("FanPass Beta foundation launcher requires Node 22 LTS");
  }
  const canonicalRoot = validateCanonicalProjectRoot();
  if (fs.realpathSync(process.cwd()) !== canonicalRoot) {
    throw new Error(
      "FanPass Beta foundation launcher must run from the canonical project root",
    );
  }
  const reviewed = validateReviewedRunner();
  const packageScripts = validatePackageScripts();
  validateDependencyInputs();
  const integrityCheck = () => {
    validateReviewedRunner();
    validatePackageScripts();
    validateDependencyInputs();
  };
  executeReviewedRunner(reviewed, {
    integrityCheck,
    packageScriptsProjection: packageScripts,
  });
  integrityCheck();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? `Beta foundation launch failed: ${error.message}`
        : "Beta foundation launch failed",
    );
    process.exit(1);
  }
}

module.exports = {
  compileCommonJsModule,
  dependencyInputsProjection,
  executeReviewedRunner,
  main,
  packageScriptsProjection,
  reviewedLocalTargetGuardSha256,
  reviewedDependencyInputsSha256,
  reviewedPackageScriptsSha256,
  reviewedRunnerSha256,
  sha256,
  validatePackageScripts,
  validateCanonicalProjectRoot,
  validateDependencyInputs,
  validateReviewedRunner,
};
