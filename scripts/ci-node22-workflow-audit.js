#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_CI_NODE22_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_CI_NODE22_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

auditWorkflow();
auditPackageScripts();
auditDbReset();
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
      verifier: "npm run beta:foundation:verify",
      database: "local postgres:16-alpine service",
    },
    null,
    2,
  ),
);

function auditWorkflow() {
  const workflowPath = ".github/workflows/beta-foundation.yml";
  const workflow = readFile(workflowPath);
  requireMarkers(workflowPath, workflow, [
    "FanPass Beta Foundation",
    "actions/checkout@v4",
    "actions/setup-node@v4",
    "node-version-file: .nvmrc",
    "cache: npm",
    "npm ci",
    "npm run beta:foundation:verify",
    "postgres:16-alpine",
    "POSTGRES_USER: fanpass",
    "POSTGRES_PASSWORD: fanpass",
    "POSTGRES_DB: fanpass",
    "DATABASE_URL: postgresql://fanpass:fanpass@localhost:5432/fanpass",
    'FANPASS_SKIP_DOCKER_POSTGRES: "true"',
    'FANPASS_STRICT_NODE_RUNTIME: "true"',
    "permissions:",
    "contents: read",
  ]);

  rejectMarkers(workflowPath, workflow, [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "PRIVY_VERIFICATION_KEY",
    "PRIVY_APP_SECRET",
    "OWNERSHIP_OPERATOR_PRIVATE_KEY",
    "secrets.",
    "npm install",
  ]);
}

function auditPackageScripts() {
  const packageJson = JSON.parse(readFile("package.json"));
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
}

function auditDbReset() {
  requireMarkers(
    "scripts/alpha-db-reset.sh",
    readFile("scripts/alpha-db-reset.sh"),
    [
      "FANPASS_SKIP_DOCKER_POSTGRES",
      '[[ "${FANPASS_SKIP_DOCKER_POSTGRES:-false}" != "true" ]]',
      "docker compose up -d postgres",
    ],
  );
}

function auditCompositeVerifier() {
  const contents = readFile("scripts/beta-foundation-verify.sh");
  const prismaGenerate = "npm run prisma:generate -w apps/api";
  const selfTest = "security:ci-node22-workflow:self-test";
  const audit = "security:ci-node22-workflow";
  if (!contents.includes(prismaGenerate)) {
    errors.push(
      "scripts/beta-foundation-verify.sh must generate the API Prisma client before Jest audits.",
    );
  }
  if (!contents.includes(selfTest) || !contents.includes(audit)) {
    errors.push(
      "scripts/beta-foundation-verify.sh must run CI Node 22 workflow self-test and audit.",
    );
    return;
  }
  if (
    contents.includes(prismaGenerate) &&
    contents.indexOf(prismaGenerate) > contents.indexOf(selfTest)
  ) {
    errors.push(
      "scripts/beta-foundation-verify.sh must generate the API Prisma client before CI workflow self-test.",
    );
  }
  if (contents.indexOf(selfTest) > contents.indexOf(audit)) {
    errors.push(
      "scripts/beta-foundation-verify.sh must run CI Node 22 workflow self-test before the real audit.",
    );
  }
}

function auditDocs() {
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
