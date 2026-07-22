const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  renderBetaFoundationGateFixture,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/prototype-reset-policy-audit.js",
);

const cases = [
  {
    label: "accepts guarded local-debug reset policy",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects public reset route",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/app.controller.ts",
        appController({
          decorators: ['@Post("/prototype/reset")', "@PublicRoute()"],
        }),
      ),
  },
  {
    label: "rejects reset route without FanPassAuthGuard",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/app.controller.ts",
        appController({
          decorators: [
            '@Post("/prototype/reset")',
            '@Roles("ORGANIZER", "ADMIN")',
          ],
        }),
      ),
  },
  {
    label: "rejects reset route exposed to fan roles",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/app.controller.ts",
        appController({
          decorators: [
            '@Post("/prototype/reset")',
            "@UseGuards(FanPassAuthGuard)",
            '@Roles("FAN", "ADMIN")',
          ],
        }),
      ),
  },
  {
    label: "rejects missing privacy classification",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/API_RESPONSE_PRIVACY_MATRIX.md",
        "| Handler | Route | Classification |\n| --- | --- | --- |\n",
      ),
  },
  {
    label: "rejects missing reset shortcut registration",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
        "# Prototype Shortcut Register\n",
      ),
  },
  {
    label: "rejects unauthenticated prototype reset script",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/prototype-verify.sh",
        'curl -X POST "$API_BASE_URL/prototype/reset"\n',
      ),
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        renderBetaFoundationGateFixture(["security:prototype-shortcuts"]),
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-prototype-reset-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_PROTOTYPE_RESET_AUDIT_ROOT: fixtureRoot,
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
    "apps/api/src/app.controller.ts",
    appController(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/test/route-security.spec.ts",
    'const expectedAccessByHandler = new Map([["AppController.resetPrototype", ["ORGANIZER", "ADMIN"]]]);\n',
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/API_RESPONSE_PRIVACY_MATRIX.md",
    "| Handler | Route | Classification |\n| --- | --- | --- |\n| `apps/api/src/app.controller.ts:resetPrototype` | `POST /prototype/reset` | `LOCAL_DEBUG` |\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
    [
      "# Prototype Shortcut Register",
      "",
      "## PS-009 - Local Prototype Reset Endpoint",
      "",
      "- Status: Accepted local shortcut.",
      "- Scope: Local fixture reset.",
      "- Owner: FanPass platform.",
      "- Risk: This must not become a public reset command.",
      "- Replacement Path: Remove or tightly gate shared-runtime reset controls.",
      "- Release Gate: External Beta cannot expose prototype reset without admin/organizer access and explicit risk acceptance.",
      "- Evidence: apps/api/src/app.controller.ts; scripts/prototype-start.sh; scripts/prototype-verify.sh; docs/API_RESPONSE_PRIVACY_MATRIX.md.",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/prototype-start.sh",
    prototypeResetScript(),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/prototype-verify.sh",
    prototypeResetScript(),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.js",
    renderBetaFoundationGateFixture([
      "security:prototype-reset-policy:self-test",
      "security:prototype-reset-policy",
    ]),
  );
}

function appController(options = {}) {
  const decorators = options.decorators ?? [
    '@Post("/prototype/reset")',
    "@UseGuards(FanPassAuthGuard)",
    '@Roles("ORGANIZER", "ADMIN")',
  ];
  return [
    'import { Controller, Post, UseGuards } from "@nestjs/common";',
    'import { PublicRoute, Roles } from "./common/auth.decorators";',
    'import { FanPassAuthGuard } from "./common/fanpass-auth.guard";',
    "",
    "@Controller()",
    "export class AppController {",
    ...decorators.map((decorator) => `  ${decorator}`),
    "  resetPrototype() {",
    "    return { ok: true };",
    "  }",
    "}",
    "",
  ].join("\n");
}

function prototypeResetScript() {
  return [
    "const session = await fetch(`${baseUrl}/auth/demo-session`, {",
    '  method: "POST",',
    '  body: JSON.stringify({ userId: "usr_organizer_demo" })',
    "});",
    "await fetch(`${baseUrl}/prototype/reset`, {",
    '  method: "POST",',
    "  headers: { Authorization: `Bearer ${accessToken}` }",
    "});",
    "",
  ].join("\n");
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
