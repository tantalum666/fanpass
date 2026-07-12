const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/dependency-tooling-audit.js");

const cases = [
  {
    label: "accepts known full-audit contract tooling advisories",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects critical full-audit advisory drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeJsonFixture(fixtureRoot, "audit.json", {
        ...knownFullAudit(),
        metadata: {
          vulnerabilities: {
            ...knownFullAudit().metadata.vulnerabilities,
            critical: 1,
          },
        },
      }),
  },
  {
    label: "rejects unexpected high-severity package",
    expected: "fail",
    mutate: (fixtureRoot) => {
      const audit = knownFullAudit();
      audit.vulnerabilities["runtime-high"] = {
        name: "runtime-high",
        severity: "high",
        isDirect: false,
        effects: ["next"],
        nodes: ["node_modules/runtime-high"],
      };
      writeJsonFixture(fixtureRoot, "audit.json", audit);
    },
  },
  {
    label: "rejects direct high-severity workspace dependency",
    expected: "fail",
    mutate: (fixtureRoot) => {
      const audit = knownFullAudit();
      audit.vulnerabilities.undici.isDirect = true;
      writeJsonFixture(fixtureRoot, "audit.json", audit);
    },
  },
  {
    label: "rejects high finding outside contract tooling boundary",
    expected: "fail",
    mutate: (fixtureRoot) => {
      const audit = knownFullAudit();
      audit.vulnerabilities.tmp.effects = ["next"];
      audit.vulnerabilities.tmp.nodes = ["node_modules/next/node_modules/tmp"];
      audit.vulnerabilities.tmp.fixAvailable = true;
      writeJsonFixture(fixtureRoot, "audit.json", audit);
    },
  },
  {
    label: "rejects missing package script wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "package.json",
        JSON.stringify({
          scripts: {
            "security:dependency-tooling":
              "node scripts/dependency-tooling-audit.js",
          },
        }),
      ),
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        "npm run security:dependency-risk:evidence:self-test\n",
      ),
  },
  {
    label: "rejects missing advisory log containment markers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/DEPENDENCY_ADVISORY_LOG.md",
        "# FanPass Dependency Advisory Log\n",
      ),
  },
  {
    label: "rejects stale advisory summary metadata",
    expected: "fail",
    mutate: (fixtureRoot) => {
      const audit = knownFullAudit();
      audit.metadata.vulnerabilities.total = 41;
      writeJsonFixture(fixtureRoot, "audit.json", audit);
    },
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-dependency-tooling-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_DEPENDENCY_TOOLING_AUDIT_ROOT: fixtureRoot,
        FANPASS_DEPENDENCY_TOOLING_AUDIT_JSON: path.join(
          fixtureRoot,
          "audit.json",
        ),
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
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        failures,
      },
      null,
      2,
    ),
  );
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
    "package.json",
    JSON.stringify(
      {
        scripts: {
          "security:dependency-tooling":
            "node scripts/dependency-tooling-audit.js",
          "security:dependency-tooling:self-test":
            "node scripts/dependency-tooling-audit-self-test.js",
        },
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.sh",
    [
      "npm run security:dependency-risk:evidence:self-test",
      "npm run security:dependency-tooling:self-test",
      "npm run security:dependency-tooling",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/DEPENDENCY_ADVISORY_LOG.md",
    [
      "# FanPass Dependency Advisory Log",
      "",
      "The full dev/tooling audit currently reports 40 advisories, including 4 high findings.",
      "The contained high packages are `lodash`, `serialize-javascript`, `tmp`, and `undici`.",
      "Those high findings are confined to the Hardhat/contract-toolchain transitive dependency graph.",
      "Resolve them through a dedicated migration with contract tests.",
      "",
    ].join("\n"),
  );
  writeJsonFixture(fixtureRoot, "audit.json", knownFullAudit());
}

function knownFullAudit() {
  return {
    vulnerabilities: {
      lodash: highTooling("lodash", ["@nomicfoundation/ignition-core"]),
      "serialize-javascript": highTooling("serialize-javascript", ["mocha"]),
      tmp: highTooling("tmp", ["solc"]),
      undici: highTooling("undici", ["hardhat"]),
      next: {
        name: "next",
        severity: "moderate",
        isDirect: true,
        effects: [],
        nodes: ["node_modules/next"],
      },
    },
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 13,
        moderate: 23,
        high: 4,
        critical: 0,
        total: 40,
      },
    },
  };
}

function highTooling(name, effects) {
  return {
    name,
    severity: "high",
    isDirect: false,
    via: [{ name, severity: "high" }],
    effects,
    nodes: [`node_modules/${name}`],
    fixAvailable: {
      name: effects.includes("hardhat")
        ? "hardhat"
        : "@nomicfoundation/hardhat-toolbox",
      version: effects.includes("hardhat") ? "3.7.0" : "7.0.0",
      isSemVerMajor: true,
    },
  };
}

function writeJsonFixture(fixtureRoot, relativePath, value) {
  writeFixtureFile(fixtureRoot, relativePath, JSON.stringify(value, null, 2));
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
