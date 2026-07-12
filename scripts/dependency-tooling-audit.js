const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = process.env.FANPASS_DEPENDENCY_TOOLING_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_DEPENDENCY_TOOLING_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const allowedHighToolingPackages = new Set([
  "lodash",
  "serialize-javascript",
  "tmp",
  "undici",
]);
const toolingBoundaryPattern =
  /hardhat|@nomicfoundation|ignition|solc|mocha|solidity-coverage/i;
const errors = [];

const packageJson = readJson("package.json");
const verifier = readProjectFile("scripts/beta-foundation-verify.sh");
const advisoryLog = readProjectFile("docs/DEPENDENCY_ADVISORY_LOG.md");
const auditReport = process.env.FANPASS_DEPENDENCY_TOOLING_AUDIT_JSON
  ? readJsonFile(
      process.env.FANPASS_DEPENDENCY_TOOLING_AUDIT_JSON,
      "npm audit full JSON fixture",
    )
  : parseJson(
      runNpm(["audit", "--audit-level=low", "--json"], {
        allowNonZero: true,
      }).stdout,
      "npm audit full JSON",
    );

validateScriptWiring();
validateDocs(auditReport);
validateFullAudit(auditReport);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const vulnerabilities = auditReport.vulnerabilities ?? {};
const highToolingPackages = Object.values(vulnerabilities)
  .filter((entry) => entry?.severity === "high")
  .map((entry) => entry.name)
  .sort();

console.log(
  JSON.stringify(
    {
      ok: true,
      fullAudit: auditReport.metadata?.vulnerabilities ?? null,
      highToolingPackages,
      containment:
        "high findings are confined to known dev/contract tooling transitive dependencies",
    },
    null,
    2,
  ),
);

function validateScriptWiring() {
  const scripts = packageJson.scripts ?? {};
  for (const scriptName of [
    "security:dependency-tooling",
    "security:dependency-tooling:self-test",
  ]) {
    if (!scripts[scriptName]) {
      errors.push(`package.json must define ${scriptName}`);
    }
  }

  assertOrderedVerifierSteps([
    "security:dependency-risk:evidence:self-test",
    "security:dependency-tooling:self-test",
    "security:dependency-tooling",
  ]);
}

function validateDocs(report) {
  const metadata = report.metadata?.vulnerabilities ?? {};
  for (const marker of [
    "full dev/tooling audit",
    "Hardhat/contract-toolchain",
    `${Number(metadata.total ?? 0)} advisories`,
    `${Number(metadata.high ?? 0)} high`,
    "dedicated migration with contract tests",
  ]) {
    if (!advisoryLog.includes(marker)) {
      errors.push(
        `docs/DEPENDENCY_ADVISORY_LOG.md must keep full tooling audit marker: ${marker}`,
      );
    }
  }

  for (const packageName of allowedHighToolingPackages) {
    if (!advisoryLog.includes(`\`${packageName}\``)) {
      errors.push(
        `docs/DEPENDENCY_ADVISORY_LOG.md must name contained high tooling package: ${packageName}`,
      );
    }
  }
}

function validateFullAudit(report) {
  const vulnerabilities = report.vulnerabilities ?? {};
  const metadata = report.metadata?.vulnerabilities ?? {};

  if (Number(metadata.critical ?? 0) !== 0) {
    errors.push("Full dependency audit must not contain critical advisories.");
  }

  for (const vulnerability of Object.values(vulnerabilities)) {
    if (!vulnerability || vulnerability.severity !== "high") {
      continue;
    }
    validateHighFinding(vulnerability);
  }
}

function validateHighFinding(vulnerability) {
  if (!allowedHighToolingPackages.has(vulnerability.name)) {
    errors.push(
      `Unexpected high-severity full-audit package ${vulnerability.name}; review before external testing.`,
    );
  }
  if (vulnerability.isDirect === true) {
    errors.push(
      `High-severity package ${vulnerability.name} must not be a direct workspace dependency.`,
    );
  }

  const boundaryText = [
    ...(vulnerability.effects ?? []),
    ...flattenViaNames(vulnerability.via),
    ...(vulnerability.nodes ?? []),
    JSON.stringify(vulnerability.fixAvailable ?? null),
  ].join(" ");
  if (!toolingBoundaryPattern.test(boundaryText)) {
    errors.push(
      `High-severity package ${vulnerability.name} must remain tied to Hardhat/contract tooling, not app runtime dependencies.`,
    );
  }
}

function flattenViaNames(via = []) {
  if (!Array.isArray(via)) {
    return [];
  }
  return via.flatMap((entry) => {
    if (typeof entry === "string") {
      return [entry];
    }
    if (entry && typeof entry === "object") {
      return [entry.name, entry.dependency, entry.title, entry.url].filter(
        Boolean,
      );
    }
    return [];
  });
}

function assertOrderedVerifierSteps(steps) {
  let previousIndex = -1;
  for (const step of steps) {
    const pattern = new RegExp(`npm\\s+run\\s+${escapeRegExp(step)}(?=\\s|$)`);
    const match = pattern.exec(verifier);
    const index = match?.index ?? -1;
    if (index === -1) {
      errors.push(`beta foundation verifier must run npm run ${step}`);
      continue;
    }
    if (index <= previousIndex) {
      errors.push(
        `beta foundation verifier must run npm run ${step} after the previous dependency tooling step`,
      );
    }
    previousIndex = index;
  }
}

function runNpm(args, options = {}) {
  const result = spawnSync("npm", args, {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowNonZero) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status);
  }
  return result;
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readProjectFile(relativePath));
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    errors.push(`Could not parse ${label}: ${error.message}`);
    return {};
  }
}

function readJsonFile(filePath, label) {
  return parseJson(fs.readFileSync(path.resolve(filePath), "utf8"), label);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
