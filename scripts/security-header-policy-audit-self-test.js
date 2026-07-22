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
  "scripts/security-header-policy-audit.js",
);

const cases = [
  {
    label: "accepts complete static header and runtime policy coverage",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects API bootstrap without Helmet",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "apps/api/src/main.ts",
        'import helmet from "helmet"',
      ),
  },
  {
    label: "rejects API powered-by disclosure drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "apps/api/src/main.ts",
        '.disable("x-powered-by")',
      ),
  },
  {
    label: "rejects API bootstrap without production-like HSTS",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(fixtureRoot, "apps/api/src/main.ts", "hsts: productionLike"),
  },
  {
    label: "rejects API bootstrap without trust proxy policy",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(fixtureRoot, "apps/api/src/main.ts", '"trust proxy"'),
  },
  {
    label: "rejects API security config without trust proxy validation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "apps/api/src/config/security-config.ts",
        "FANPASS_TRUST_PROXY_HOPS is required in production-like environments",
      ),
  },
  {
    label: "rejects Console config without CSP",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        '"Content-Security-Policy"',
      ),
  },
  {
    label: "rejects Console config without cross-origin opener policy",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        '"Cross-Origin-Opener-Policy"',
      ),
  },
  {
    label: "rejects Console config without strict transport security",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        '"Strict-Transport-Security"',
      ),
  },
  {
    label: "rejects local runtime checker missing powered-by assertion",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "scripts/security-runtime-check.sh",
        'assert_header_absent "$api_headers" "x-powered-by"',
      ),
  },
  {
    label: "rejects staging checker without HTTPS enforcement",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "scripts/security-runtime-staging-check.sh",
        "Staging runtime checks require https URLs",
      ),
  },
  {
    label: "rejects staging evidence validator without dry-run rejection",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "scripts/staging-runtime-evidence-audit.js",
        "localDryRun",
      ),
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        renderBetaFoundationGateFixture(["security:runtime:local:self-test"]),
      ),
  },
  {
    label: "rejects missing documentation markers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "docs/ALPHA_SECURITY_REVIEW.md",
        "Status after Security Pass 81",
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-security-header-policy-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_SECURITY_HEADER_AUDIT_ROOT: fixtureRoot,
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
    "apps/api/src/main.ts",
    [
      'import helmet from "helmet";',
      'app.getHttpAdapter().getInstance().disable("x-powered-by");',
      "const productionLike = isProductionLikeEnvironment();",
      "helmet({",
      "contentSecurityPolicy: false,",
      '"trust proxy"',
      "FANPASS_TRUST_PROXY_HOPS",
      "hsts: productionLike",
      "maxAge: 15_552_000",
      "includeSubDomains: true",
      "preload: false,",
      "frameguard: {",
      'action: "deny",',
      "referrerPolicy: {",
      'policy: "no-referrer",',
      'json({ limit: "256kb" });',
      'urlencoded({ extended: false, limit: "64kb" });',
      "rateLimit({",
      'standardHeaders: "draft-8",',
      "legacyHeaders: false,",
      '"/auth/privy/sync"',
      '"/auth/privy/accept-staff-invite"',
      '"/verification"',
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/config/security-config.ts",
    [
      '"FANPASS_TRUST_PROXY_HOPS"',
      "FANPASS_TRUST_PROXY_HOPS is required in production-like environments",
      'validatePositiveInteger(config, "FANPASS_TRUST_PROXY_HOPS", errors, 1, 3)',
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/.env.staging.example",
    "FANPASS_TRUST_PROXY_HOPS=1\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/server/console-bff.ts",
    [
      "applySecurityHeaders(response)",
      '"X-Content-Type-Options"',
      '"nosniff"',
      '"X-Frame-Options"',
      '"DENY"',
      '"Referrer-Policy"',
      '"no-referrer"',
      '"Cross-Origin-Opener-Policy"',
      '"same-origin"',
      '"Strict-Transport-Security"',
      "max-age=15552000; includeSubDomains",
      '"Permissions-Policy"',
      "camera=(), microphone=(), geolocation=(), payment=()",
      '"Content-Security-Policy"',
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/package.json",
    JSON.stringify({ dependencies: { react: "19.1.0" } }, null, 2),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/security-runtime-check.sh",
    [
      'assert_header_present "$api_headers" "x-content-type-options"',
      'assert_header_present "$api_headers" "x-frame-options"',
      'assert_header_present "$api_headers" "referrer-policy"',
      'assert_header_present "$api_headers" "cross-origin-opener-policy"',
      'assert_header_absent "$api_headers" "x-powered-by"',
      'assert_header_present "$auth_privy_headers" "ratelimit-policy"',
      'assert_header_present "$console_headers" "cross-origin-opener-policy"',
      'assert_header_present "$console_headers" "content-security-policy"',
      'assert_header_absent "$console_headers" "x-powered-by"',
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/security-runtime-check-self-test.sh",
    [
      "rejects missing API content-type hardening header",
      "rejects API powered-by disclosure",
      "rejects missing Privy auth rate-limit policy header",
      "rejects missing Console cross-origin opener policy header",
      "rejects missing Console CSP header",
      "rejects Console powered-by disclosure",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/security-runtime-staging-check.sh",
    [
      "Staging runtime checks require https URLs",
      'assert_header_present "$api_headers" "x-content-type-options"',
      'assert_header_present "$api_headers" "strict-transport-security"',
      'assert_header_absent "$api_headers" "x-powered-by"',
      'assert_header_present "$console_headers" "cross-origin-opener-policy"',
      'assert_header_present "$console_headers" "strict-transport-security"',
      'assert_header_present "$console_headers" "content-security-policy"',
      'assert_header_absent "$console_headers" "x-powered-by"',
      "STAGING_API_TRUST_PROXY_HOPS",
      "trust proxy hops configured",
      "Staging API must not issue demo sessions",
      "Admin side-effect health must reject unauthenticated access",
      "admin side-effect outbox health ok",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/security-runtime-staging-check-self-test.sh",
    [
      "rejects non-HTTPS staging URLs without local override",
      "rejects missing API content-type hardening header",
      "rejects missing API strict transport security header",
      "rejects API powered-by disclosure",
      "rejects missing Console cross-origin opener policy header",
      "rejects missing Console strict transport security header",
      "rejects missing Console CSP header",
      "rejects missing API trust proxy hop evidence",
      "rejects invalid API trust proxy hop evidence",
      "rejects staging demo-session issuance",
      "rejects unauthenticated side-effect health access",
      "rejects unlocked unauthenticated Console render",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/staging-runtime-evidence-audit.js",
    [
      "localDryRun",
      "https://",
      "admin side-effect outbox health ok",
      "x-powered-by absent",
      "cross-origin-opener-policy",
      "strict-transport-security",
      "apiRuntime.trustProxyHops",
      "trust proxy hops configured",
      "content-security-policy",
      "-----BEGIN PRIVATE KEY-----",
      "Authorization: Bearer ",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.js",
    renderBetaFoundationGateFixture([
      "security:headers-policy:self-test",
      "security:headers-policy",
    ]),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/QA_CHECKLIST.md",
    "security:headers-policy:self-test\nsecurity:headers-policy\nHelmet\nstrict transport security\ntrust-proxy\nConsole cross-origin opener policy\nConsole CSP\nstaging runtime evidence\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/BETA_ROADMAP.md",
    "The security header policy audit must keep passing\nHelmet\nstrict transport security\ntrust-proxy\nConsole cross-origin opener policy\nConsole CSP\nstaging runtime evidence\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/ALPHA_SECURITY_REVIEW.md",
    "ASR-011 - Security headers and public deployment hardening\nStatus after Security Pass 81\nsecurity:headers-policy\n",
  );
}

function removeMarker(fixtureRoot, relativePath, marker) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  fs.writeFileSync(absolutePath, contents.replace(marker, ""));
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
