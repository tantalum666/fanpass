#!/usr/bin/env node
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const resetScript = path.join(rootDir, "scripts/alpha-db-reset.sh");
const fixtureRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-alpha-db-reset-"),
);
const binDir = path.join(fixtureRoot, "bin");
const actionLog = path.join(fixtureRoot, "actions.log");

fs.mkdirSync(binDir, { recursive: true });
for (const command of ["docker"]) {
  const executable = path.join(binDir, command);
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env bash\nprintf '%s\\n' "${command} $*" >> "$FANPASS_ALPHA_RESET_ACTION_LOG"\n`,
    { mode: 0o755 },
  );
}
const fakeNode = path.join(binDir, "reviewed-node");
fs.writeFileSync(
  fakeNode,
  `#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -eq 0 ]]; then
  exec "$FANPASS_ALPHA_RESET_REAL_NODE"
fi
printf 'node %s\\n' "$*" >> "$FANPASS_ALPHA_RESET_ACTION_LOG"
if [[ "$1" == *'/node_modules/prisma/build/index.js' && "$*" == *' db execute '* ]]; then
  exit "\${FANPASS_ALPHA_RESET_PRISMA_STATUS:-0}"
fi
exit 0
`,
  { mode: 0o755 },
);
fs.writeFileSync(path.join(binDir, "sleep"), "#!/usr/bin/env bash\nexit 0\n", {
  mode: 0o755,
});

const results = [];

try {
  rejectBeforeMutation(
    "rejects a remote target before any external command",
    "postgresql://release-user:do-not-print-remote-secret@db.example.test:5432/fanpass?sslmode=require",
    ["do-not-print-remote-secret", "db.example.test"],
  );
  rejectBeforeMutation(
    "rejects a shared database name on a loopback target",
    "postgresql://release-user:do-not-print-database-secret@localhost:5432/fanpass_staging",
    ["do-not-print-database-secret", "fanpass_staging"],
  );
  rejectBeforeMutation(
    "rejects a query parameter that overrides the local host",
    "postgresql://fanpass:do-not-print-override-secret@localhost:5432/fanpass?host=db.example.test",
    ["do-not-print-override-secret", "db.example.test"],
  );
  rejectBeforeMutation(
    "rejects a query parameter that overrides the database name",
    "postgresql://fanpass:do-not-print-dbname-secret@localhost:5432/fanpass?dbname=shared",
    ["do-not-print-dbname-secret", "dbname=shared"],
  );
  rejectBeforeMutation(
    "rejects a non-explicit numeric alias for the IPv4 loopback",
    "postgresql://fanpass:do-not-print-numeric-secret@2130706433:5432/fanpass",
    ["do-not-print-numeric-secret", "2130706433"],
  );
  rejectBeforeMutation(
    "rejects a shortened IPv4 loopback spelling",
    "postgresql://fanpass:do-not-print-short-secret@127.1:5432/fanpass",
    ["do-not-print-short-secret", "127.1"],
  );
  rejectBeforeMutation(
    "rejects malformed connection strings without echoing them",
    "not-a-database-url-do-not-print",
    ["not-a-database-url-do-not-print"],
  );
  rejectUnreachableTarget();
  acceptLocalTarget(
    "accepts the local hostname database and preserves Docker startup",
    "postgresql://fanpass:local-only@localhost:5432/fanpass?schema=public",
    false,
  );
  acceptLocalTarget(
    "accepts the IPv4 loopback database and preserves the CI Docker skip",
    "postgresql://fanpass:local-only@127.0.0.1:5432/fanpass",
    true,
  );
  acceptLocalTarget(
    "accepts the IPv6 loopback database",
    "postgresql://fanpass:local-only@[::1]:5432/fanpass",
    true,
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, cases: results }, null, 2));

function runReset(databaseUrl, { skipDocker = true, prismaStatus = "0" } = {}) {
  fs.writeFileSync(actionLog, "");
  const result = spawnSync("bash", [resetScript], {
    cwd: rootDir,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH || ""}`,
      DATABASE_URL: databaseUrl,
      FANPASS_ALPHA_RESET_ACTION_LOG: actionLog,
      FANPASS_ALPHA_RESET_PRISMA_STATUS: prismaStatus,
      FANPASS_ALPHA_RESET_REAL_NODE: process.execPath,
      FANPASS_NODE_BIN: fakeNode,
      FANPASS_SKIP_DOCKER_POSTGRES: skipDocker ? "true" : "false",
    },
    encoding: "utf8",
  });
  return {
    ...result,
    actions: fs.readFileSync(actionLog, "utf8"),
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
}

function rejectUnreachableTarget() {
  const label = "redacts an unreachable local target and skips all mutations";
  const secret = "do-not-print-unreachable-secret";
  const result = runReset(
    `postgresql://fanpass:${secret}@localhost:5432/fanpass`,
    { prismaStatus: "1" },
  );
  assert.notEqual(result.status, 0, `${label}: expected rejection`);
  assert.match(result.output, /Alpha Postgres did not become reachable\./);
  assert.equal(
    result.output.includes(secret),
    false,
    `${label}: leaked password`,
  );
  assert.doesNotMatch(result.output, /postgres(?:ql)?:\/\//i);
  assert.equal(
    result.actions.includes(" db push "),
    false,
    `${label}: Prisma mutation ran after the failed readiness probe`,
  );
  assert.equal(
    result.actions.includes("prisma/seed-alpha.ts"),
    false,
    `${label}: seed mutation ran after the failed readiness probe`,
  );
  results.push({ label, status: "passed" });
}

function rejectBeforeMutation(label, databaseUrl, sensitiveMarkers) {
  const result = runReset(databaseUrl);
  assert.notEqual(result.status, 0, `${label}: expected rejection`);
  assert.equal(
    result.actions,
    "",
    `${label}: rejection must happen before Docker, Prisma, or seed commands`,
  );
  assert.match(result.output, /Alpha database reset refused/);
  assert.doesNotMatch(result.output, /postgres(?:ql)?:\/\//i);
  for (const marker of sensitiveMarkers) {
    assert.equal(
      result.output.includes(marker),
      false,
      `${label}: output leaked a sensitive connection marker`,
    );
  }
  results.push({ label, status: "passed" });
}

function acceptLocalTarget(label, databaseUrl, skipDocker) {
  const result = runReset(databaseUrl, { skipDocker });
  assert.equal(result.status, 0, `${label}: ${result.output}`);
  assert.equal(
    result.actions.includes("docker compose up -d postgres"),
    !skipDocker,
    `${label}: Docker startup behavior changed`,
  );
  assert.match(
    result.actions,
    /node .*node_modules\/prisma\/build\/index\.js db execute/,
  );
  assert.match(
    result.actions,
    /node .*node_modules\/prisma\/build\/index\.js db push .*--accept-data-loss/,
  );
  assert.match(
    result.actions,
    /node .*node_modules\/ts-node\/dist\/bin\.js prisma\/seed-alpha\.ts/,
  );
  assert.equal(
    result.output.includes(databaseUrl),
    false,
    `${label}: output leaked the database URL`,
  );
  assert.equal(
    result.output.includes("local-only"),
    false,
    `${label}: output leaked the database password`,
  );
  results.push({ label, status: "passed" });
}
