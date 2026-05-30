const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/dependency-advisory-check.js");

const cases = [
  {
    label: "accepts documented Next/PostCSS advisory state",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "accepts clean production audit and reports closeout warning",
    expected: "pass",
    mutate: (fixtureRoot) =>
      writeJsonFixture(fixtureRoot, "audit.json", cleanAuditReport()),
    assert: (result) =>
      result.stdout.includes(
        "Production audit is clean; update dependency docs and close the blocker.",
      ),
  },
  {
    label: "rejects undocumented production advisories",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeJsonFixture(fixtureRoot, "audit.json", {
        ...knownAuditReport(),
        vulnerabilities: {
          ...knownAuditReport().vulnerabilities,
          "unexpected-package": {
            severity: "low",
            isDirect: false,
            range: "<1.0.1",
          },
        },
      }),
  },
  {
    label: "rejects severity drift above documented moderate advisories",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeJsonFixture(fixtureRoot, "audit.json", {
        ...knownAuditReport(),
        vulnerabilities: {
          ...knownAuditReport().vulnerabilities,
          postcss: {
            ...knownAuditReport().vulnerabilities.postcss,
            severity: "high",
          },
        },
      }),
  },
  {
    label: "rejects npm audit fix path changes",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeJsonFixture(fixtureRoot, "audit.json", {
        ...knownAuditReport(),
        vulnerabilities: {
          ...knownAuditReport().vulnerabilities,
          next: {
            ...knownAuditReport().vulnerabilities.next,
            fixAvailable: {
              name: "next",
              version: "16.2.7",
              isSemVerMajor: false,
            },
          },
        },
      }),
  },
  {
    label: "rejects newly available safe Next/PostCSS patch path",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeJsonFixture(fixtureRoot, "next.json", {
        version: "16.2.7",
        dependencies: {
          postcss: "8.5.10",
        },
      }),
  },
  {
    label: "rejects latest Next metadata without direct PostCSS dependency",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeJsonFixture(fixtureRoot, "next.json", {
        version: "16.3.0",
        dependencies: {},
      }),
  },
  {
    label: "rejects advisory log without external testing gate marker",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/DEPENDENCY_ADVISORY_LOG.md",
        advisoryLog().replace("External Testing Gate", "Release Notes"),
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-dependency-advisory-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_DEPENDENCY_ADVISORY_ROOT: fixtureRoot,
        FANPASS_DEPENDENCY_ADVISORY_AUDIT_JSON: path.join(
          fixtureRoot,
          "audit.json",
        ),
        FANPASS_DEPENDENCY_ADVISORY_NEXT_JSON: path.join(
          fixtureRoot,
          "next.json",
        ),
      },
      encoding: "utf8",
    });
    const passed = result.status === 0;
    const expectedPass = testCase.expected === "pass";
    const assertionPassed = testCase.assert ? testCase.assert(result) : true;
    return {
      label: testCase.label,
      expected: testCase.expected,
      status: result.status,
      ok: passed === expectedPass && assertionPassed,
      stderr: result.stderr.trim(),
      stdout: result.stdout.trim(),
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
    "docs/DEPENDENCY_ADVISORY_LOG.md",
    advisoryLog(),
  );
  writeJsonFixture(fixtureRoot, "audit.json", knownAuditReport());
  writeJsonFixture(fixtureRoot, "next.json", currentNextMetadata());
}

function advisoryLog() {
  return [
    "# FanPass Dependency Advisory Log",
    "",
    "Tracked advisory: GHSA-qx2v-qp2m-jg93.",
    "Current range: postcss <8.5.10.",
    "Do not run `npm audit fix --force`.",
    "",
    "## External Testing Gate",
    "",
    "Before external testing, production advisories must be clean or risk-accepted.",
    "",
  ].join("\n");
}

function knownAuditReport() {
  return {
    vulnerabilities: {
      next: {
        severity: "moderate",
        isDirect: true,
        range: "9.3.4 - 15.5.18",
        fixAvailable: {
          name: "next",
          version: "9.3.3",
          isSemVerMajor: true,
        },
      },
      postcss: {
        severity: "moderate",
        isDirect: false,
        range: "<8.5.10",
        nodes: ["node_modules/next/node_modules/postcss"],
        via: [
          {
            name: "postcss",
            url: "https://github.com/advisories/GHSA-qx2v-qp2m-jg93",
          },
        ],
      },
    },
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 2,
        high: 0,
        critical: 0,
        total: 2,
      },
    },
  };
}

function cleanAuditReport() {
  return {
    vulnerabilities: {},
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        total: 0,
      },
    },
  };
}

function currentNextMetadata() {
  return {
    version: "16.2.6",
    dependencies: {
      postcss: "8.4.31",
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
