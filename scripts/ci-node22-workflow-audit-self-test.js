#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/ci-node22-workflow-audit.js");

const cases = [
  {
    label:
      "accepts Node 22 workflow, local Postgres, strict runtime, and verifier wiring",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects workflow without setup-node .nvmrc pin",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        "node-version-file: .nvmrc",
      ),
  },
  {
    label: "rejects workflow without composite verifier",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        "npm run beta:foundation:verify",
      ),
  },
  {
    label: "rejects workflow without local Postgres service",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        "postgres:16-alpine",
      ),
  },
  {
    label: "rejects workflow that references provider secrets",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        "      STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}\n",
      ),
  },
  {
    label: "rejects alpha db reset without CI Docker skip boundary",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "scripts/alpha-db-reset.sh",
        '[[ "${FANPASS_SKIP_DOCKER_POSTGRES:-false}" != "true" ]]',
      ),
  },
  {
    label: "rejects missing package script wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "package.json",
        JSON.stringify({ scripts: {} }, null, 2),
      ),
  },
  {
    label: "rejects missing Beta verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        "npm run security:node-runtime-policy\n",
      ),
  },
  {
    label: "rejects verifier without Prisma client generation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        "npm run prisma:generate -w apps/api",
      ),
  },
  {
    label: "rejects missing documentation markers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "docs/ALPHA_SECURITY_REVIEW.md",
        "CI Node 22 Beta foundation workflow",
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-ci-node22-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_CI_NODE22_AUDIT_ROOT: fixtureRoot,
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
    ".github/workflows/beta-foundation.yml",
    [
      "name: FanPass Beta Foundation",
      "permissions:",
      "  contents: read",
      "services:",
      "  postgres:",
      "    image: postgres:16-alpine",
      "    env:",
      "      POSTGRES_USER: fanpass",
      "      POSTGRES_PASSWORD: fanpass",
      "      POSTGRES_DB: fanpass",
      "env:",
      "  DATABASE_URL: postgresql://fanpass:fanpass@localhost:5432/fanpass",
      '  FANPASS_SKIP_DOCKER_POSTGRES: "true"',
      '  FANPASS_STRICT_NODE_RUNTIME: "true"',
      "steps:",
      "  - uses: actions/checkout@v4",
      "  - uses: actions/setup-node@v4",
      "    with:",
      "      node-version-file: .nvmrc",
      "      cache: npm",
      "  - run: npm ci",
      "  - run: npm run beta:foundation:verify",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "package.json",
    JSON.stringify(
      {
        scripts: {
          "security:ci-node22-workflow":
            "node scripts/ci-node22-workflow-audit.js",
          "security:ci-node22-workflow:self-test":
            "node scripts/ci-node22-workflow-audit-self-test.js",
        },
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/alpha-db-reset.sh",
    [
      'if command -v docker >/dev/null 2>&1 && [[ "${FANPASS_SKIP_DOCKER_POSTGRES:-false}" != "true" ]]; then',
      "  docker compose up -d postgres >/dev/null",
      "fi",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.sh",
    [
      "npm run prisma:generate -w apps/api",
      "npm run security:ci-node22-workflow:self-test",
      "npm run security:ci-node22-workflow",
      "",
    ].join("\n"),
  );
  const docs =
    "CI Node 22 Beta foundation workflow is locked by security:ci-node22-workflow.\n";
  for (const file of [
    "docs/QA_CHECKLIST.md",
    "docs/BETA_ROADMAP.md",
    "docs/ALPHA_SECURITY_REVIEW.md",
    "docs/CODEX_HANDOFF.md",
    "docs/DEVELOPMENT_TASKS.md",
    "docs/PROVIDER_COST_FEASIBILITY.md",
  ]) {
    writeFixtureFile(fixtureRoot, file, docs);
  }
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const target = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function appendFixtureFile(fixtureRoot, relativePath, contents) {
  fs.appendFileSync(path.join(fixtureRoot, relativePath), contents);
}

function removeMarker(fixtureRoot, relativePath, marker) {
  const target = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(target, "utf8");
  fs.writeFileSync(target, contents.replace(marker, ""));
}
