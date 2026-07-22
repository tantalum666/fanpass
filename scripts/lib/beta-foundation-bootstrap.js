"use strict";

const HOSTED_BETA_FOUNDATION_SHELL = "/bin/sh -e {0}";
const BETA_FOUNDATION_ENTRYPOINT = "scripts/beta-foundation-launcher.js";
const REVIEWED_BETA_FOUNDATION_ENTRYPOINT_SHA256 =
  "377af7200bfffe357620315caf2c158d13a81de0ee3f2bad0e767731f8b4e47f";
const ENTRYPOINT_EXEC_SCRIPT =
  'const crypto=require("node:crypto"),fs=require("node:fs"),Module=require("node:module"),path=require("node:path");try{const relative=process.argv[1],expected=process.argv[2],requestedRoot=process.argv[3],root=fs.realpathSync(requestedRoot),cwd=fs.realpathSync(process.cwd());if(root!==cwd)throw new Error("Canonical workspace does not match the current directory");const file=path.join(root,relative),real=fs.realpathSync(file);if(real!==file)throw new Error("Launcher path contains a symlink or escapes the canonical workspace");const descriptor=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));let source;try{const stat=fs.fstatSync(descriptor);if(!stat.isFile())throw new Error("Launcher must be a regular file");source=fs.readFileSync(descriptor)}finally{fs.closeSync(descriptor)}const actual=crypto.createHash("sha256").update(source).digest("hex");if(actual!==expected)throw new Error("Launcher digest does not match the reviewed bytes");const loaded=new Module(file);loaded.filename=file;loaded.paths=Module._nodeModulePaths(path.dirname(file));loaded._compile(source.toString("utf8"),file);if(typeof loaded.exports.main!=="function")throw new Error("Launcher must export main");loaded.exports.main()}catch(error){console.error(`Beta foundation bootstrap failed: ${error instanceof Error?error.message:"unknown error"}`);process.exit(1)}';

function buildHostedBetaFoundationBootstrap(entrypoint, reviewedSha256) {
  const entrypointSegments = entrypoint.split("/");
  if (
    !/^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(entrypoint) ||
    entrypointSegments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error(
      "Beta foundation bootstrap entrypoint must be a relative literal path",
    );
  }
  const expectedSha256 =
    reviewedSha256 ??
    (entrypoint === BETA_FOUNDATION_ENTRYPOINT
      ? REVIEWED_BETA_FOUNDATION_ENTRYPOINT_SHA256
      : null);
  if (!/^[a-f0-9]{64}$/.test(expectedSha256 ?? "")) {
    throw new Error(
      "Beta foundation bootstrap requires a reviewed entrypoint SHA-256",
    );
  }

  return [
    'node_bin="$(command -v node)"',
    'node_real="$(/usr/bin/readlink -f "$node_bin")"',
    'case "$node_real" in',
    '  "$RUNNER_TOOL_CACHE"/node/22.*/*/bin/node) ;;',
    '  *) printf "%s\\n" "Refusing Node outside the GitHub Actions Node 22 tool cache" >&2; exit 1 ;;',
    "esac",
    "node_dir=${node_real%/*}",
    "exec /usr/bin/env -i \\",
    '  HOME="$RUNNER_TEMP" \\',
    '  TMPDIR="$RUNNER_TEMP" \\',
    '  RUNNER_TEMP="$RUNNER_TEMP" \\',
    '  PATH="$node_dir:/usr/bin:/bin:/usr/sbin:/sbin" \\',
    "  CI=true \\",
    "  GITHUB_ACTIONS=true \\",
    "  DATABASE_URL=postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass \\",
    `  "$node_real" -e '${ENTRYPOINT_EXEC_SCRIPT}' ${entrypoint} ${expectedSha256} "$GITHUB_WORKSPACE"`,
    "",
  ].join("\n");
}

const HOSTED_BETA_FOUNDATION_BOOTSTRAP = buildHostedBetaFoundationBootstrap(
  BETA_FOUNDATION_ENTRYPOINT,
);

module.exports = {
  BETA_FOUNDATION_ENTRYPOINT,
  ENTRYPOINT_EXEC_SCRIPT,
  HOSTED_BETA_FOUNDATION_BOOTSTRAP,
  HOSTED_BETA_FOUNDATION_SHELL,
  REVIEWED_BETA_FOUNDATION_ENTRYPOINT_SHA256,
  buildHostedBetaFoundationBootstrap,
};
