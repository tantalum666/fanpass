const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/privy-webhook-optionality-audit.js",
);

const cases = [
  {
    label: "accepts access-token sync without Privy webhooks",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects a Privy webhook route",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/auth/privy-webhook.controller.ts",
        'import { Controller, Post } from "@nestjs/common";\n@Controller("auth/privy/webhook")\nexport class PrivyWebhookController { @Post() receivePrivyWebhook() {} }\n',
      ),
  },
  {
    label: "rejects required Privy webhook secrets",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "apps/api/src/config/security-config.ts",
        '\nvalidateProductionSecret(config, "PRIVY_WEBHOOK_SECRET", errors);\n',
      ),
  },
  {
    label: "rejects missing backend sync boundary",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/auth/auth.controller.ts",
        '@Post("privy/accept-staff-invite")\nexport class AuthController {}\n',
      ),
  },
  {
    label: "rejects missing optionality documentation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(fixtureRoot, "docs/PROVIDER_COST_FEASIBILITY.md", ""),
  },
  {
    label: "rejects missing composite verifier step",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        "npm run security:privy-webhooks:optional:self-test\n",
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-privy-webhook-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_PRIVY_WEBHOOK_AUDIT_ROOT: fixtureRoot,
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
  writeFixtureFile(fixtureRoot, "package.json", JSON.stringify(packageJson()));
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.sh",
    [
      "npm run security:privy-webhooks:optional:self-test",
      "npm run security:privy-webhooks:optional",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/auth/auth.controller.ts",
    '@Post("privy/sync")\n@Post("privy/accept-staff-invite")\nexport class AuthController {}\n',
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/auth/auth.service.ts",
    "export class AuthService { syncPrivyUser(token) { this.privyTokens.verifyAccessToken(token); } acceptStaffInvite(token) { this.privyTokens.verifyAccessToken(token); } }\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/server/console-bff.ts",
    'export async function POST() { return fetch("https://fixture/auth/privy/sync"); }\n',
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
    'let sync = "/auth/privy/sync"\nlet invite = "/auth/privy/accept-staff-invite"\n',
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/config/security-config.ts",
    "export function validateEnvironment() {}\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/DEVELOPMENT_TASKS.md",
    "- [x] Keep Privy webhooks optional until plan support is verified.\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/QA_CHECKLIST.md",
    "Privy webhooks must remain optional until actual plan support is verified. Keep security:privy-webhooks:optional in the gate.\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/PROVIDER_COST_FEASIBILITY.md",
    "Do not make Privy webhooks a hard dependency. Add Privy webhooks only after verifying the selected plan supports them. security:privy-webhooks:optional\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/BETA_ROADMAP.md",
    "Privy webhook optionality audit keeps backend access-token sync until plan support is verified.\n",
  );
}

function packageJson() {
  return {
    scripts: {
      "security:privy-webhooks:optional":
        "node scripts/privy-webhook-optionality-audit.js",
      "security:privy-webhooks:optional:self-test":
        "node scripts/privy-webhook-optionality-audit-self-test.js",
    },
  };
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function appendFixtureFile(fixtureRoot, relativePath, contents) {
  fs.appendFileSync(path.join(fixtureRoot, relativePath), contents);
}
