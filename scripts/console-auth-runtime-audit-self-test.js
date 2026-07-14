const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/console-auth-runtime-audit.js");
const fixtureFiles = [
  "apps/console-auth/package.json",
  "apps/console-auth/src/PrivyConsoleLogin.tsx",
  "apps/console-auth/src/runtime-config.ts",
  "apps/console-auth/server/config.ts",
  "apps/console-auth/server/index.ts",
  "apps/console-auth/server/security.ts",
  "apps/console-auth/server/static-files.ts",
  "apps/console-auth/vite.config.ts",
  "render.yaml",
  "docs/PRIVY_CONSOLE_REACT_SDK_ISOLATION.md",
  "package.json",
  "scripts/beta-foundation-verify.sh",
];

const cases = [
  {
    label: "accepts the hardened Vite and Node auth runtime",
    mutate: () => {},
    pass: true,
  },
  {
    label: "rejects a reintroduced Next dependency",
    mutate: (fixtureRoot) =>
      mutateJson(fixtureRoot, "apps/console-auth/package.json", (manifest) => {
        manifest.dependencies.next = "latest";
      }),
    pass: false,
    marker: "must not include Next",
  },
  {
    label: "rejects browser token storage",
    mutate: (fixtureRoot) =>
      append(
        fixtureRoot,
        "apps/console-auth/src/PrivyConsoleLogin.tsx",
        '\nlocalStorage.setItem("accessToken", accessToken);\n',
      ),
    pass: false,
    marker: "must not include localStorage",
  },
  {
    label: "rejects a missing first-party Console session form handoff",
    mutate: (fixtureRoot) =>
      replace(
        fixtureRoot,
        "apps/console-auth/src/PrivyConsoleLogin.tsx",
        "form.requestSubmit()",
        "return",
      ),
    pass: false,
    marker: "must include form.requestSubmit()",
  },
  {
    label: "rejects a session handoff without the one-time state",
    mutate: (fixtureRoot) =>
      replace(
        fixtureRoot,
        "apps/console-auth/src/PrivyConsoleLogin.tsx",
        'name="handoffState" value={handoffState}',
        'name="handoffState" value=""',
      ),
    pass: false,
    marker: "must include name=\"handoffState\" value={handoffState}",
  },
  {
    label: "rejects direct Auth loads that cannot restart secure handoff",
    mutate: (fixtureRoot) =>
      replace(
        fixtureRoot,
        "apps/console-auth/src/PrivyConsoleLogin.tsx",
        "window.location.replace(handoffStartUrl)",
        "return",
      ),
    pass: false,
    marker: "must include window.location.replace(handoffStartUrl)",
  },
  {
    label: "rejects a CSP that cannot submit to the exact Console origin",
    mutate: (fixtureRoot) =>
      replace(
        fixtureRoot,
        "apps/console-auth/server/security.ts",
        "`form-action 'self'${consoleFormAction}`",
        '"form-action \'self\'"',
      ),
    pass: false,
    marker: "must include `form-action 'self'${consoleFormAction}`",
  },
  {
    label: "rejects a missing strict session URL boundary",
    mutate: (fixtureRoot) =>
      replace(
        fixtureRoot,
        "apps/console-auth/server/config.ts",
        'sessionBridgeUrl.pathname !== "/api/console/privy-session"',
        "false",
      ),
    pass: false,
    marker: "must include sessionBridgeUrl.pathname",
  },
  {
    label: "rejects a missing Render staging migration boundary",
    mutate: (fixtureRoot) =>
      replace(
        fixtureRoot,
        "apps/console-auth/server/config.ts",
        "env.RENDER_SERVICE_NAME",
        "undefined",
      ),
    pass: false,
    marker: "must include env.RENDER_SERVICE_NAME",
  },
  {
    label: "rejects a missing production release evidence contract",
    mutate: (fixtureRoot) =>
      replace(
        fixtureRoot,
        "docs/PRIVY_CONSOLE_REACT_SDK_ISOLATION.md",
        "--require-production",
        "--staging-only",
      ),
    pass: false,
    marker: "--require-production",
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-console-auth-runtime-"),
  );
  try {
    copyFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: { ...process.env, FANPASS_CONSOLE_AUTH_AUDIT_ROOT: fixtureRoot },
      encoding: "utf8",
    });
    const output = `${result.stdout}\n${result.stderr}`;
    const ok =
      (testCase.pass ? result.status === 0 : result.status !== 0) &&
      (!testCase.marker || output.includes(testCase.marker));
    return {
      label: testCase.label,
      expected: testCase.pass ? "pass" : "fail",
      status: result.status,
      ok,
    };
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

const failures = results.filter((result) => !result.ok);
if (failures.length) {
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

function copyFixture(fixtureRoot) {
  for (const relativePath of fixtureFiles) {
    const target = path.join(fixtureRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(rootDir, relativePath), target);
  }
}

function mutateJson(fixtureRoot, relativePath, mutate) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  const value = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  mutate(value);
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

function append(fixtureRoot, relativePath, contents) {
  fs.appendFileSync(path.join(fixtureRoot, relativePath), contents);
}

function replace(fixtureRoot, relativePath, before, after) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  fs.writeFileSync(absolutePath, contents.replace(before, after));
}
