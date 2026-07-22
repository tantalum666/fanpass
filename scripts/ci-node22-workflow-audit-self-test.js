#!/usr/bin/env node
const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  BETA_FOUNDATION_ENTRYPOINT,
  HOSTED_BETA_FOUNDATION_BOOTSTRAP,
  HOSTED_BETA_FOUNDATION_SHELL,
  REVIEWED_BETA_FOUNDATION_ENTRYPOINT_SHA256,
  buildHostedBetaFoundationBootstrap,
} = require("./lib/beta-foundation-bootstrap");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/ci-node22-workflow-audit.js");

const cases = [
  {
    label:
      "accepts Node 22 workflow, controlled RC push/dispatch, local Postgres, strict runtime, and verifier wiring",
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
        BETA_FOUNDATION_ENTRYPOINT,
      ),
  },
  {
    label: "rejects hosted verifier without reviewed launcher digest check",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        'crypto.createHash("sha256")',
      ),
  },
  {
    label: "rejects setup-node supplied only by a comment decoy",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
        "attacker/fake@v1 # actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
      ),
  },
  {
    label: "rejects strict runtime false with a true-value comment decoy",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        'FANPASS_STRICT_NODE_RUNTIME: "true"',
        'FANPASS_STRICT_NODE_RUNTIME: "false" # FANPASS_STRICT_NODE_RUNTIME: "true"',
      ),
  },
  {
    label: "rejects the legacy inherited-environment Node entrypoint",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceHostedVerifierBlock(
        fixtureRoot,
        "sh",
        "/usr/bin/env node scripts/beta-foundation-verify.js",
      ),
  },
  {
    label: "rejects hosted verifier shell drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        `        shell: ${HOSTED_BETA_FOUNDATION_SHELL}`,
        "        shell: sh",
      ),
  },
  {
    label: "rejects hosted verifier without env-i isolation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        "/usr/bin/env -i",
      ),
  },
  {
    label: "rejects hosted verifier without setup-node realpath validation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        "/usr/bin/readlink -f",
      ),
  },
  {
    label: "rejects hosted verifier that inherits the caller PATH",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        'PATH="$node_dir:/usr/bin:/bin:/usr/sbin:/sbin"',
        'PATH="$PATH"',
      ),
  },
  {
    label:
      "rejects repository npm execution before the authoritative bootstrap",
    expected: "fail",
    mutate: (fixtureRoot) =>
      insertWorkflowStepBeforeVerifier(fixtureRoot, [
        "      - name: Untrusted install",
        "        run: npm ci",
        "",
      ]),
  },
  {
    label:
      "rejects repository audit execution before the authoritative bootstrap",
    expected: "fail",
    mutate: (fixtureRoot) =>
      insertWorkflowStepBeforeVerifier(fixtureRoot, [
        "      - name: Premature repository audit",
        "        run: npm run security:render-rc-config",
        "",
      ]),
  },
  {
    label: "rejects another action between setup-node and the bootstrap",
    expected: "fail",
    mutate: (fixtureRoot) =>
      insertWorkflowStepBeforeVerifier(fixtureRoot, [
        "      - name: Unreviewed action",
        "        uses: attacker/action@deadbeef",
        "",
      ]),
  },
  {
    label: "rejects a conditionally disabled authoritative bootstrap",
    expected: "fail",
    mutate: (fixtureRoot) =>
      addWorkflowStepKey(fixtureRoot, "Verify Beta foundation", "if: false"),
  },
  {
    label: "rejects an authoritative bootstrap allowed to fail",
    expected: "fail",
    mutate: (fixtureRoot) =>
      addWorkflowStepKey(
        fixtureRoot,
        "Verify Beta foundation",
        "continue-on-error: true",
      ),
  },
  {
    label: "rejects canonical-workspace argument drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureMarker(
        fixtureRoot,
        ".github/workflows/beta-foundation.yml",
        '"$GITHUB_WORKSPACE"',
        '"/tmp/untrusted-workspace"',
      ),
  },
  {
    label: "rejects Render RC self-test omitted from the reviewed runner",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        multiline: true,
        omitLabels: ["Render RC configuration audit self-test"],
      }),
  },
  {
    label: "rejects Render RC audit omitted from the reviewed runner",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        multiline: true,
        omitLabels: ["Render RC configuration audit"],
      }),
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
    label: "rejects an unreviewed Beta foundation launcher",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        BETA_FOUNDATION_ENTRYPOINT,
        "\n// unreviewed launcher mutation\n",
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
    label: "rejects alpha db reset without the local database target boundary",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "scripts/alpha-db-reset.sh",
        "assert_local_database_target",
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
        "scripts/beta-foundation-verify.js",
        'npmStep("Node runtime policy audit", "run", "security:node-runtime-policy");\n',
      ),
  },
  {
    label: "accepts Prettier multiline typed gateSteps",
    expected: "pass",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, { multiline: true }),
  },
  {
    label: "rejects inherited environment spread in the verifier",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        multiline: true,
        unsafeEnvironmentSpread: true,
      }),
  },
  {
    label: "rejects required gates that exist only in comments",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        decoyOnlyBetaVerifierSource(),
      ),
  },
  {
    label: "rejects comment-only Prisma generation gate",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        multiline: false,
        omitLabels: ["API Prisma client generation"],
        prefix: '/* npmStep("API Prisma client generation" */\n',
      }),
  },
  {
    label: "rejects non-literal and spread gateSteps entries",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        multiline: false,
        extraElements: ["...extraSteps"],
      }),
  },
  {
    label: "rejects duplicate gateSteps declarations",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        "\nconst gateSteps = Object.freeze([]);\n",
      ),
  },
  {
    label: "rejects Prisma generation gate with attacker-controlled argv",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        multiline: false,
        stepOverrides: {
          "API Prisma client generation": [
            "npmStep",
            "API Prisma client generation",
            "run",
            "attacker:noop",
          ],
        },
      }),
  },
  {
    label: "rejects runner self-test moved after Prisma despite comment decoy",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        multiline: false,
        order: [
          "API Prisma client generation",
          "Beta foundation runner self-test",
        ],
        prefix: '/* nodeStep(\n    "Beta foundation runner self-test" */\n',
      }),
  },
  {
    label:
      "rejects CI workflow audit before its self-test despite comment decoy",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        multiline: false,
        order: [
          "CI Node 22 workflow audit",
          "CI Node 22 workflow audit self-test",
        ],
        prefix: '/* npmStep("CI Node 22 workflow audit self-test" */\n',
      }),
  },
  {
    label: "rejects Console Auth tests with drifted argv",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        multiline: false,
        stepOverrides: {
          "Console Auth unit tests": [
            "npmStep",
            "Console Auth unit tests",
            "--prefix",
            "apps/console-auth",
            "run",
            "test:fake",
          ],
        },
      }),
  },
  {
    label: "rejects verifier without Prisma client generation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        omitLabels: ["API Prisma client generation"],
      }),
  },
  {
    label: "rejects verifier without the Alpha database reset safety self-test",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeBetaVerifierFixture(fixtureRoot, {
        omitLabels: ["Alpha database reset safety self-test"],
      }),
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
  {
    label: "rejects README without the pre-Node env-i boundary",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(fixtureRoot, "README.md", "/usr/bin/env -i"),
  },
  {
    label: "rejects QA guidance without the NODE_OPTIONS threat boundary",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(fixtureRoot, "docs/QA_CHECKLIST.md", "NODE_OPTIONS"),
  },
];

const results = [
  runBootstrapInputValidationRegression(),
  runBootstrapBoundaryRegression(),
  ...cases.map((testCase) => {
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
  }),
];

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

function runBootstrapInputValidationRegression() {
  const label = "rejects parent and current-directory bootstrap entrypoints";
  try {
    for (const entrypoint of [
      "../sentinel.js",
      "scripts/../sentinel.js",
      "./sentinel.js",
    ]) {
      let rejected = false;
      try {
        buildHostedBetaFoundationBootstrap(entrypoint, "a".repeat(64));
      } catch (error) {
        rejected = /relative literal path/.test(
          String(error?.message ?? error),
        );
      }
      if (!rejected) {
        throw new Error(`bootstrap accepted unsafe entrypoint ${entrypoint}`);
      }
    }
    return { label, expected: "pass", status: 0, ok: true, stderr: "" };
  } catch (error) {
    return {
      label,
      expected: "pass",
      status: 1,
      ok: false,
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

function runBootstrapBoundaryRegression() {
  const label =
    "blocks hostile Node and Perl loader variables before the canonical hosted Node process";
  const fixtureRoot = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "fanpass-bootstrap-boundary-")),
  );
  try {
    const runnerTemp = path.join(fixtureRoot, "runner-temp");
    const toolCache = path.join(fixtureRoot, "tool-cache");
    const fakeNodeDir = path.join(
      toolCache,
      "node",
      "22.22.3",
      "fixture",
      "bin",
    );
    const attackerModules = path.join(fixtureRoot, "attacker-modules");
    const preloadModuleDir = path.join(attackerModules, "gate-preload");
    const preloadMarker = path.join(fixtureRoot, "preload-ran");
    const childMarker = path.join(fixtureRoot, "real-child-ran");
    const sentinelReport = path.join(fixtureRoot, "sentinel-report.json");
    fs.mkdirSync(runnerTemp, { recursive: true });
    fs.mkdirSync(fakeNodeDir, { recursive: true });
    fs.mkdirSync(preloadModuleDir, { recursive: true });

    const fakeNodePath = path.join(fakeNodeDir, "node");
    fs.writeFileSync(
      fakeNodePath,
      `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} "$@"\n`,
      { mode: 0o700 },
    );
    fs.chmodSync(fakeNodePath, 0o700);

    fs.writeFileSync(
      path.join(preloadModuleDir, "index.js"),
      [
        'const fs = require("node:fs");',
        'const childProcess = require("node:child_process");',
        `fs.writeFileSync(${JSON.stringify(preloadMarker)}, "loaded");`,
        "delete process.env.NODE_OPTIONS;",
        "delete process.env.NODE_PATH;",
        "childProcess.spawnSync = () => ({ status: 0, signal: null });",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "sentinel.js"),
      [
        'const fs = require("node:fs");',
        'const { spawnSync } = require("node:child_process");',
        "module.exports = { main() {",
        `const childMarker = ${JSON.stringify(childMarker)};`,
        "const child = spawnSync(",
        "  process.execPath,",
        `  ["-e", ${JSON.stringify(
          `require("node:fs").writeFileSync(${JSON.stringify(childMarker)}, "child")`,
        )}],`,
        '  { env: process.env, stdio: "pipe" },',
        ");",
        "if (child.status !== 0 || !fs.existsSync(childMarker)) {",
        '  throw new Error("real sentinel child did not execute");',
        "}",
        `fs.writeFileSync(${JSON.stringify(sentinelReport)}, JSON.stringify({`,
        "  nodeOptions: process.env.NODE_OPTIONS ?? null,",
        "  nodePath: process.env.NODE_PATH ?? null,",
        "  perl5opt: process.env.PERL5OPT ?? null,",
        "  perl5lib: process.env.PERL5LIB ?? null,",
        "  ci: process.env.CI ?? null,",
        "  githubActions: process.env.GITHUB_ACTIONS ?? null,",
        "  databaseUrl: process.env.DATABASE_URL ?? null,",
        "  home: process.env.HOME ?? null,",
        "  tmpdir: process.env.TMPDIR ?? null,",
        "  runnerTemp: process.env.RUNNER_TEMP ?? null,",
        "  path: process.env.PATH ?? null,",
        "}));",
        "} };",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );

    const bootstrapPath = path.join(fixtureRoot, "bootstrap.sh");
    const sentinelSha256 = crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(fixtureRoot, "sentinel.js")))
      .digest("hex");
    fs.writeFileSync(
      bootstrapPath,
      buildHostedBetaFoundationBootstrap("sentinel.js", sentinelSha256),
      { mode: 0o600 },
    );
    const result = spawnSync("/bin/sh", ["-e", bootstrapPath], {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        CI: "false",
        DATABASE_URL: "postgresql://attacker.invalid/production",
        GITHUB_ACTIONS: "false",
        GITHUB_WORKSPACE: fixtureRoot,
        NODE_OPTIONS: "--require=gate-preload",
        NODE_PATH: attackerModules,
        PERL5OPT: "-Mstrict",
        PERL5LIB: attackerModules,
        PATH: `${fakeNodeDir}:/usr/bin:/bin`,
        RUNNER_TEMP: runnerTemp,
        RUNNER_TOOL_CACHE: toolCache,
      },
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(
        `canonical bootstrap failed: ${result.stderr.trim() || result.status}`,
      );
    }
    if (fs.existsSync(preloadMarker)) {
      throw new Error("hostile Node preload executed before the sentinel");
    }
    if (!fs.existsSync(childMarker) || !fs.existsSync(sentinelReport)) {
      throw new Error(
        "canonical bootstrap did not execute the real sentinel child",
      );
    }
    const report = JSON.parse(fs.readFileSync(sentinelReport, "utf8"));
    const expectedPath = `${fakeNodeDir}:/usr/bin:/bin:/usr/sbin:/sbin`;
    const expected = {
      nodeOptions: null,
      nodePath: null,
      perl5opt: null,
      perl5lib: null,
      ci: "true",
      githubActions: "true",
      databaseUrl: "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass",
      home: runnerTemp,
      tmpdir: runnerTemp,
      runnerTemp,
      path: expectedPath,
    };
    if (JSON.stringify(report) !== JSON.stringify(expected)) {
      throw new Error(
        `canonical bootstrap exposed an unexpected environment: ${JSON.stringify(report)}`,
      );
    }
    return { label, expected: "pass", status: 0, ok: true, stderr: "" };
  } catch (error) {
    return {
      label,
      expected: "pass",
      status: 1,
      ok: false,
      stderr: error instanceof Error ? error.message : String(error),
    };
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function hostedVerifierWorkflowBlock(
  shell = HOSTED_BETA_FOUNDATION_SHELL,
  run = HOSTED_BETA_FOUNDATION_BOOTSTRAP,
) {
  return [
    "      - name: Verify Beta foundation",
    `        shell: ${shell}`,
    "        run: |",
    ...run
      .trimEnd()
      .split("\n")
      .map((line) => `          ${line}`),
    "",
  ].join("\n");
}

function replaceHostedVerifierBlock(fixtureRoot, shell, run) {
  replaceFixtureMarker(
    fixtureRoot,
    ".github/workflows/beta-foundation.yml",
    hostedVerifierWorkflowBlock(),
    hostedVerifierWorkflowBlock(shell, run),
  );
}

function writePassingFixture(fixtureRoot) {
  writeFixtureFile(
    fixtureRoot,
    ".github/workflows/beta-foundation.yml",
    fs.readFileSync(
      path.join(rootDir, ".github/workflows/beta-foundation.yml"),
      "utf8",
    ),
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
          "alpha:db:reset:self-test":
            "node scripts/alpha-db-reset-self-test.js",
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
      'ALPHA_RESET_EXPECTED_DATABASE="fanpass"',
      "assert_local_database_target() {",
      '  const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"])',
      "  const allowedLocalQueryParameters = new Set([",
      "  !allowedHosts.has(explicitHost)",
      "}",
      "printf 'Alpha database reset refused'",
      "  docker compose up -d postgres >/dev/null",
      "fi",
      "",
    ].join("\n"),
  );
  writeBetaVerifierFixture(fixtureRoot, { multiline: true });
  writeFixtureFile(
    fixtureRoot,
    BETA_FOUNDATION_ENTRYPOINT,
    fs.readFileSync(path.join(rootDir, BETA_FOUNDATION_ENTRYPOINT), "utf8"),
  );
  const docs =
    "CI Node 22 Beta foundation workflow is locked by security:ci-node22-workflow.\n";
  writeFixtureFile(
    fixtureRoot,
    "docs/QA_CHECKLIST.md",
    [
      docs.trimEnd(),
      "Use the complete `/usr/bin/env -i` boundary.",
      "Reject NODE_OPTIONS and NODE_PATH before Node starts.",
      "Resolve setup-node under $RUNNER_TOOL_CACHE.",
      "",
    ].join("\n"),
  );
  for (const file of [
    "docs/BETA_ROADMAP.md",
    "docs/ALPHA_SECURITY_REVIEW.md",
    "docs/CODEX_HANDOFF.md",
    "docs/DEVELOPMENT_TASKS.md",
    "docs/PROVIDER_COST_FEASIBILITY.md",
  ]) {
    writeFixtureFile(fixtureRoot, file, docs);
  }
  writeFixtureFile(
    fixtureRoot,
    "README.md",
    [
      "/usr/bin/env -i",
      'crypto.createHash("sha256")',
      REVIEWED_BETA_FOUNDATION_ENTRYPOINT_SHA256,
      "/opt/homebrew/opt/node@22/bin/node -e",
      'loaded._compile(source.toString("utf8"),file)',
      "NODE_OPTIONS",
      "NODE_PATH",
      "",
    ].join("\n"),
  );
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const target = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function appendFixtureFile(fixtureRoot, relativePath, contents) {
  fs.appendFileSync(path.join(fixtureRoot, relativePath), contents);
}

function writeBetaVerifierFixture(fixtureRoot, options = {}) {
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.js",
    betaVerifierSource(options),
  );
}

function betaVerifierSource(options = {}) {
  const baseSteps = [
    ["npmStep", "Root deterministic dependency install", "ci", "--include=dev"],
    [
      "npmStep",
      "Console Auth deterministic dependency install",
      "--prefix",
      "apps/console-auth",
      "ci",
      "--include=dev",
    ],
    [
      "nodeStep",
      "Beta foundation launcher self-test",
      "scripts/beta-foundation-launcher-self-test.js",
    ],
    [
      "nodeStep",
      "Beta foundation runner self-test",
      "scripts/beta-foundation-verify-self-test.js",
    ],
    [
      "npmStep",
      "API Prisma client generation",
      "run",
      "prisma:generate",
      "-w",
      "apps/api",
    ],
    [
      "npmStep",
      "Bootstrap disposable Prisma schema",
      "run",
      "prisma:push:raw",
      "-w",
      "apps/api",
      "--",
      "--force-reset",
    ],
    [
      "npmStep",
      "Apply post-identity schema chain",
      "run",
      "prisma:after-identity",
      "-w",
      "apps/api",
    ],
    [
      "npmStep",
      "Verify on-sale concurrency invariants",
      "run",
      "test",
      "-w",
      "apps/api",
      "--",
      "--runTestsByPath",
      "test/onsales-prisma-concurrency.spec.ts",
    ],
    [
      "npmStep",
      "Alpha database reset safety self-test",
      "run",
      "alpha:db:reset:self-test",
    ],
    [
      "npmStep",
      "CI Node 22 workflow audit self-test",
      "run",
      "security:ci-node22-workflow:self-test",
    ],
    [
      "npmStep",
      "CI Node 22 workflow audit",
      "run",
      "security:ci-node22-workflow",
    ],
    [
      "npmStep",
      "Render RC configuration audit self-test",
      "run",
      "security:render-rc-config:self-test",
    ],
    [
      "npmStep",
      "Render RC configuration audit",
      "run",
      "security:render-rc-config",
    ],
    [
      "npmStep",
      "Console Auth typecheck",
      "--prefix",
      "apps/console-auth",
      "run",
      "typecheck",
    ],
    [
      "npmStep",
      "Console Auth unit tests",
      "--prefix",
      "apps/console-auth",
      "test",
    ],
  ];
  const overrides = options.stepOverrides ?? {};
  let steps = baseSteps
    .filter(([, label]) => !(options.omitLabels ?? []).includes(label))
    .map((step) => overrides[step[1]] ?? step);

  if (Array.isArray(options.order)) {
    const orderedLabels = new Set(options.order);
    const replacements = options.order.map((label) => {
      const step = steps.find((candidate) => candidate[1] === label);
      if (!step) {
        throw new Error(`Unknown fixture gate step: ${label}`);
      }
      return step;
    });
    const firstAffectedIndex = steps.findIndex((step) =>
      orderedLabels.has(step[1]),
    );
    steps = steps.filter((step) => !orderedLabels.has(step[1]));
    steps.splice(firstAffectedIndex, 0, ...replacements);
  }

  const renderStep = ([helper, ...values]) => {
    const multiline =
      options.multiline !== false ||
      values[0] === "Beta foundation runner self-test";
    return multiline
      ? [
          `  ${helper}(`,
          ...values.map((value) => `    ${JSON.stringify(value)},`),
          "  ),",
        ].join("\n")
      : `  ${helper}(${values.map((value) => JSON.stringify(value)).join(", ")}),`;
  };

  return [
    options.prefix ?? "",
    'const npmStep = (label, ...args) => ({ label, kind: "npm", args });',
    'const nodeStep = (label, script) => ({ label, kind: "node", args: [script] });',
    'const shStep = (label, script) => ({ label, kind: "sh", args: [script] });',
    "const extraSteps = [];",
    "const gateSteps = Object.freeze([",
    ...steps.map(renderStep),
    ...(options.extraElements ?? []).map((element) => `  ${element},`),
    "]);",
    'const fs = require("fs");',
    "const gateIsolationRoot = createGateIsolationRoot();",
    "function createGateIsolationRoot() {",
    '  const isolationRoot = fs.mkdtempSync("/tmp/fanpass-beta-gate-");',
    "  fs.chmodSync(isolationRoot, 0o700);",
    "  return isolationRoot;",
    "}",
    "function isAllowedLocalPostgresTarget() { return true; }",
    "function buildHardenedEnvironment(source = {}) {",
    '  const databaseUrl = "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass";',
    '  if (!isAllowedLocalPostgresTarget(databaseUrl, "fanpass")) throw new Error("local only");',
    "  const env = {",
    ...(options.unsafeEnvironmentSpread ? ["    ...source,"] : []),
    "    HOME: gateIsolationRoot,",
    "    TMPDIR: gateIsolationRoot,",
    "    RUNNER_TEMP: gateIsolationRoot,",
    "    DATABASE_URL: databaseUrl,",
    '    FANPASS_DATA_SOURCE: "prisma",',
    '    FANPASS_SKIP_DOCKER_POSTGRES: "true",',
    '    FANPASS_STRICT_NODE_RUNTIME: "true",',
    "  };",
    '  if (source.CI === "true") env.CI = "true";',
    '  if (source.GITHUB_ACTIONS === "true") env.GITHUB_ACTIONS = "true";',
    '  env.PATH = "/trusted/node:/usr/bin:/bin:/usr/sbin:/sbin";',
    '  env.FANPASS_GATE_HARDENED = "true";',
    '  env.NPM_CONFIG_SCRIPT_SHELL = "/bin/sh";',
    '  env.npm_config_script_shell = "/bin/sh";',
    "  return env;",
    "}",
    "const spawnOptions = { shell: false };",
    'if (process.versions.node.split(".")[0] !== "22") throw new Error("wrong node");',
    'const npmArgv = ["--script-shell=/bin/sh"];',
    "",
  ].join("\n");
}

function decoyOnlyBetaVerifierSource() {
  return [
    "/*",
    'nodeStep(\n    "Beta foundation runner self-test"',
    'npmStep("API Prisma client generation"',
    'npmStep("Alpha database reset safety self-test"',
    'npmStep("CI Node 22 workflow audit self-test"',
    'npmStep("CI Node 22 workflow audit"',
    'npmStep("Console Auth typecheck"',
    'npmStep("Console Auth unit tests"',
    "*/",
    "const spawnOptions = { shell: false };",
    'if (process.versions.node.split(".")[0] !== "22") throw new Error("wrong node");',
    "const inheritedKeys = Object.freeze([",
    '  "FANPASS_STRICT_NODE_RUNTIME",',
    "]);",
    "for (const key of inheritedKeys) void key;",
    'const npmArgv = ["--script-shell=/bin/sh"];',
    "",
  ].join("\n");
}

function removeMarker(fixtureRoot, relativePath, marker) {
  const target = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(target, "utf8");
  fs.writeFileSync(target, contents.replace(marker, ""));
}

function removeWorkflowStep(fixtureRoot, name, run) {
  const block = `      - name: ${name}\n        run: ${run}\n`;
  replaceFixtureMarker(
    fixtureRoot,
    ".github/workflows/beta-foundation.yml",
    block,
    "",
  );
}

function insertWorkflowStepBeforeVerifier(fixtureRoot, lines) {
  replaceFixtureMarker(
    fixtureRoot,
    ".github/workflows/beta-foundation.yml",
    "      - name: Verify Beta foundation\n",
    `${lines.join("\n")}      - name: Verify Beta foundation\n`,
  );
}

function replaceWorkflowStepRun(fixtureRoot, name, currentRun, replacementRun) {
  replaceFixtureMarker(
    fixtureRoot,
    ".github/workflows/beta-foundation.yml",
    `      - name: ${name}\n        run: ${currentRun}\n`,
    `      - name: ${name}\n        run: ${replacementRun}\n`,
  );
}

function addWorkflowStepKey(fixtureRoot, name, keyAndValue) {
  replaceFixtureMarker(
    fixtureRoot,
    ".github/workflows/beta-foundation.yml",
    `      - name: ${name}\n`,
    `      - name: ${name}\n        ${keyAndValue}\n`,
  );
}

function swapRenderWorkflowSteps(fixtureRoot) {
  const selfTest = [
    "      - name: Verify Render RC configuration audit self-test",
    "        run: npm run security:render-rc-config:self-test",
    "",
    "",
  ].join("\n");
  const audit = [
    "      - name: Verify Render RC configuration audit",
    "        run: npm run security:render-rc-config",
    "",
    "",
  ].join("\n");
  replaceFixtureMarker(
    fixtureRoot,
    ".github/workflows/beta-foundation.yml",
    `${selfTest}${audit}`,
    `${audit}${selfTest}`,
  );
}

function replaceFixtureMarker(fixtureRoot, relativePath, marker, replacement) {
  const target = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(target, "utf8");
  if (!contents.includes(marker)) {
    throw new Error(`Fixture marker not found in ${relativePath}: ${marker}`);
  }
  fs.writeFileSync(target, contents.replace(marker, replacement));
}
