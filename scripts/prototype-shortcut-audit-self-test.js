const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/prototype-shortcut-audit.js");

const cases = [
  {
    label: "accepts a complete prototype shortcut register",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects missing required shortcut sections",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
        shortcutRegister({ omitId: "PS-006" }),
      ),
  },
  {
    label: "rejects unexpected shortcut sections",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
        `${shortcutRegister()}\n${shortcutSection("PS-999", "Untracked Shortcut")}`,
      ),
  },
  {
    label: "rejects missing required shortcut fields",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
        shortcutRegister({
          mutateSection: (id, section) =>
            id === "PS-001" ? section.replace(/^- Risk: .+\n/m, "") : section,
        }),
      ),
  },
  {
    label: "rejects missing release gate field",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
        shortcutRegister({
          mutateSection: (id, section) =>
            id === "PS-003"
              ? section.replace(/^- Release Gate: .+\n/m, "")
              : section,
        }),
      ),
  },
  {
    label: "rejects missing evidence marker",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
        shortcutRegister({
          mutateSection: (id, section) =>
            id === "PS-004"
              ? section.replace(
                  "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
                  "apps/api/src/modules/side-effects/removed.service.ts",
                )
              : section,
        }),
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-prototype-shortcut-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_PROTOTYPE_SHORTCUT_AUDIT_ROOT: fixtureRoot,
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
    "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
    shortcutRegister(),
  );
}

function shortcutRegister(options = {}) {
  const ids = [
    "PS-001",
    "PS-002",
    "PS-003",
    "PS-004",
    "PS-005",
    "PS-006",
    "PS-007",
    "PS-008",
    "PS-009",
  ].filter((id) => id !== options.omitId);
  return [
    "# Prototype Shortcut Register",
    "",
    ...ids.map((id) => {
      const section = shortcutSection(id, shortcutTitle(id));
      return options.mutateSection
        ? options.mutateSection(id, section)
        : section;
    }),
    "",
  ].join("\n");
}

function shortcutSection(id, title) {
  return [
    `## ${id} - ${title}`,
    "",
    "- Status: Accepted local shortcut.",
    "- Scope: Local fixture scope.",
    "- Owner: FanPass platform.",
    "- Risk: This shortcut is not suitable for public or real-user Beta.",
    "- Replacement Path: Replace with production-grade provider, auth, deployment, or device validation.",
    "- Release Gate: External Beta must close or explicitly risk-accept this shortcut.",
    `- Evidence: ${evidenceMarkers(id).join("; ")}.`,
    "",
  ].join("\n");
}

function shortcutTitle(id) {
  return {
    "PS-001": "Local Demo Auth",
    "PS-002": "Local QR Secret Fallback",
    "PS-003": "Mock Stripe And Unsigned Local Webhooks",
    "PS-004": "Mock Ownership Adapter",
    "PS-005": "FanPass Ops Paste Fallback",
    "PS-006": "Apple Wallet Barcode Prototype",
    "PS-007": "Manual Staff Invite Token Delivery",
    "PS-008": "Placeholder Mobile Environment Values",
    "PS-009": "Local Prototype Reset Endpoint",
    "PS-999": "Untracked Shortcut",
  }[id];
}

function evidenceMarkers(id) {
  return {
    "PS-001": [
      "apps/api/src/config/security-config.ts",
      "scripts/security-runtime-staging-check.sh",
    ],
    "PS-002": [
      "QR_SIGNING_SECRET",
      "apps/api/src/modules/verification/verification.service.ts",
    ],
    "PS-003": ["scripts/beta-local-start.sh", "scripts/alpha-prisma-verify.sh"],
    "PS-004": [
      "apps/api/src/modules/ownership/ownership.service.ts",
      "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
    ],
    "PS-005": [
      "apps/ios/FanPass/FanPass/Features/Scanner",
      "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
    ],
    "PS-006": ["docs/IOS_DISTRIBUTION_PLAN.md", ".pkpass"],
    "PS-007": [
      "apps/api/src/modules/alpha/alpha-persistence.service.ts",
      "apps/dashboard/src/ConsoleApp.tsx",
    ],
    "PS-008": [
      "apps/ios/FanPass/Config",
      "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
    ],
    "PS-009": [
      "apps/api/src/app.controller.ts",
      "scripts/prototype-start.sh",
      "scripts/prototype-verify.sh",
      "docs/API_RESPONSE_PRIVACY_MATRIX.md",
    ],
    "PS-999": ["docs/PROTOTYPE_SHORTCUT_REGISTER.md"],
  }[id];
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
