const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = process.env.FANPASS_DEPENDENCY_ADVISORY_ROOT
  ? path.resolve(process.env.FANPASS_DEPENDENCY_ADVISORY_ROOT)
  : path.resolve(__dirname, "..");
const advisoryLogPath = path.join(rootDir, "docs/DEPENDENCY_ADVISORY_LOG.md");
const advisoryLog = fs.readFileSync(advisoryLogPath, "utf8");

const PATCHED_POSTCSS_VERSION = "8.5.10";
const KNOWN_ADVISORY_ID = "GHSA-qx2v-qp2m-jg93";
const KNOWN_FORCED_NEXT_FIX = "9.3.3";

const errors = [];
const warnings = [];

const auditReport = process.env.FANPASS_DEPENDENCY_ADVISORY_AUDIT_JSON
  ? readJsonFile(
      process.env.FANPASS_DEPENDENCY_ADVISORY_AUDIT_JSON,
      "npm audit production JSON fixture",
    )
  : parseJson(
      runNpm(["audit", "--omit=dev", "--audit-level=low", "--json"], {
        allowNonZero: true,
      }).stdout,
      "npm audit production JSON",
    );

const latestNextMetadata = process.env.FANPASS_DEPENDENCY_ADVISORY_NEXT_JSON
  ? readJsonFile(
      process.env.FANPASS_DEPENDENCY_ADVISORY_NEXT_JSON,
      "npm view next@latest version dependencies JSON fixture",
    )
  : parseJson(
      runNpm(["view", "next@latest", "version", "dependencies", "--json"])
        .stdout,
      "npm view next@latest version dependencies JSON",
    );

validateAdvisoryLog();
validateAuditReport(auditReport);
validateLatestNext(latestNextMetadata);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      releaseBlocker:
        Object.keys(auditReport.vulnerabilities ?? {}).length > 0
          ? "known Next/PostCSS advisory remains unresolved"
          : null,
      productionAudit: auditReport.metadata?.vulnerabilities ?? null,
      latestNext: {
        version: latestNextMetadata.version,
        postcss: latestNextMetadata.dependencies?.postcss ?? null,
      },
      warning: warnings.join(" "),
    },
    null,
    2,
  ),
);

function validateAdvisoryLog() {
  for (const marker of [
    KNOWN_ADVISORY_ID,
    "postcss <8.5.10",
    "Do not run `npm audit fix --force`",
    "External Testing Gate",
  ]) {
    if (!advisoryLog.includes(marker)) {
      errors.push(`docs/DEPENDENCY_ADVISORY_LOG.md must mention ${marker}`);
    }
  }
}

function validateAuditReport(report) {
  const vulnerabilities = report.vulnerabilities ?? {};
  const names = Object.keys(vulnerabilities).sort();

  if (names.length === 0) {
    warnings.push(
      "Production audit is clean; update dependency docs and close the blocker.",
    );
    return;
  }

  const expectedNames = ["next", "postcss"];
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    errors.push(
      `Production audit must contain only the documented Next/PostCSS advisories; found ${names.join(
        ", ",
      )}`,
    );
    return;
  }

  const next = vulnerabilities.next;
  const postcss = vulnerabilities.postcss;
  if (next?.severity !== "moderate" || postcss?.severity !== "moderate") {
    errors.push(
      "Documented Next/PostCSS advisories must remain moderate severity only.",
    );
  }
  if (next?.isDirect !== true) {
    errors.push(
      "Expected next to remain the direct vulnerable production dependency.",
    );
  }
  if (postcss?.isDirect !== false) {
    errors.push("Expected postcss to remain transitive through next.");
  }
  if (!String(next?.range ?? "").includes("9.3.4")) {
    errors.push(`Unexpected next advisory range: ${next?.range ?? "missing"}`);
  }
  if (postcss?.range !== "<8.5.10") {
    errors.push(
      `Unexpected postcss advisory range: ${postcss?.range ?? "missing"}`,
    );
  }
  if (!postcss?.nodes?.includes("node_modules/next/node_modules/postcss")) {
    errors.push(
      "Expected vulnerable postcss path to remain nested under next.",
    );
  }
  const postcssVia = postcss?.via?.find?.((via) => via?.name === "postcss");
  if (postcssVia?.url && !postcssVia.url.includes(KNOWN_ADVISORY_ID)) {
    errors.push(`Unexpected postcss advisory URL: ${postcssVia.url}`);
  }
  const fix = next?.fixAvailable;
  if (
    !fix ||
    fix.name !== "next" ||
    fix.version !== KNOWN_FORCED_NEXT_FIX ||
    fix.isSemVerMajor !== true
  ) {
    errors.push(
      `npm audit fix path changed; review before external testing. Current fix: ${JSON.stringify(
        fix,
      )}`,
    );
  }
}

function validateLatestNext(metadata) {
  if (!metadata || typeof metadata !== "object") {
    errors.push("Could not read next@latest metadata from npm.");
    return;
  }

  const postcssDependency = metadata.dependencies?.postcss;
  if (!postcssDependency) {
    errors.push(
      `next@latest ${metadata.version ?? "unknown"} no longer declares postcss directly; review upgrade path.`,
    );
    return;
  }

  const minimumVersion = extractVersion(postcssDependency);
  if (!minimumVersion) {
    errors.push(
      `Could not parse next@latest postcss dependency ${postcssDependency}; review upgrade path.`,
    );
    return;
  }

  if (compareVersions(minimumVersion, PATCHED_POSTCSS_VERSION) >= 0) {
    errors.push(
      `next@latest ${metadata.version} declares postcss ${postcssDependency}; safe patch path may exist.`,
    );
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

function extractVersion(range) {
  return String(range).match(/\d+\.\d+\.\d+/)?.[0] ?? null;
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) {
      return 1;
    }
    if (leftParts[index] < rightParts[index]) {
      return -1;
    }
  }
  return 0;
}
