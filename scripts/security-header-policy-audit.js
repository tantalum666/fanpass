const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_SECURITY_HEADER_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_SECURITY_HEADER_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

auditApiBootstrap();
auditApiSecurityConfig();
auditConsoleConfig();
auditRuntimeCheckers();
auditCompositeVerifier();
auditDocs();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      api: "Helmet headers, powered-by disabled, body limits, and route rate limits configured",
      console: "Vite/Node BFF headers, CSP, permissions policy, and powered-by disabled",
      runtimeEvidence:
        "local/staging runtime and staging evidence checks remain wired",
    },
    null,
    2,
  ),
);

function auditApiBootstrap() {
  const contents = readFile("apps/api/src/main.ts");
  requireMarkers("apps/api/src/main.ts", contents, [
    'import helmet from "helmet"',
    '.disable("x-powered-by")',
    "const productionLike = isProductionLikeEnvironment()",
    "helmet({",
    "contentSecurityPolicy: false",
    '"trust proxy"',
    "FANPASS_TRUST_PROXY_HOPS",
    "hsts: productionLike",
    "maxAge: 15_552_000",
    "includeSubDomains: true",
    "preload: false",
    "frameguard: {",
    'action: "deny"',
    "referrerPolicy: {",
    'policy: "no-referrer"',
    'json({ limit: "256kb" })',
    'urlencoded({ extended: false, limit: "64kb" })',
    "rateLimit({",
    'standardHeaders: "draft-8"',
    "legacyHeaders: false",
    '"/auth/privy/sync"',
    '"/auth/privy/accept-staff-invite"',
    '"/verification"',
  ]);
}

function auditApiSecurityConfig() {
  const contents = readFile("apps/api/src/config/security-config.ts");
  requireMarkers("apps/api/src/config/security-config.ts", contents, [
    '"FANPASS_TRUST_PROXY_HOPS"',
    "FANPASS_TRUST_PROXY_HOPS is required in production-like environments",
    'validatePositiveInteger(config, "FANPASS_TRUST_PROXY_HOPS", errors, 1, 3)',
  ]);

  requireMarkers(
    "apps/api/.env.staging.example",
    readFile("apps/api/.env.staging.example"),
    ["FANPASS_TRUST_PROXY_HOPS=1"],
  );
}

function auditConsoleConfig() {
  const contents = readFile("apps/dashboard/server/console-bff.ts");
  requireMarkers("apps/dashboard/server/console-bff.ts", contents, [
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
  ]);
  const packageJson = JSON.parse(readFile("apps/dashboard/package.json"));
  if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
    errors.push("FanPass Console header policy must not depend on Next.");
  }
}

function auditRuntimeCheckers() {
  requireMarkers(
    "scripts/security-runtime-check.sh",
    readFile("scripts/security-runtime-check.sh"),
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
    ],
  );

  requireMarkers(
    "scripts/security-runtime-check-self-test.sh",
    readFile("scripts/security-runtime-check-self-test.sh"),
    [
      "rejects missing API content-type hardening header",
      "rejects API powered-by disclosure",
      "rejects missing Privy auth rate-limit policy header",
      "rejects missing Console cross-origin opener policy header",
      "rejects missing Console CSP header",
      "rejects Console powered-by disclosure",
    ],
  );

  requireMarkers(
    "scripts/security-runtime-staging-check.sh",
    readFile("scripts/security-runtime-staging-check.sh"),
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
    ],
  );

  requireMarkers(
    "scripts/security-runtime-staging-check-self-test.sh",
    readFile("scripts/security-runtime-staging-check-self-test.sh"),
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
    ],
  );

  requireMarkers(
    "scripts/staging-runtime-evidence-audit.js",
    readFile("scripts/staging-runtime-evidence-audit.js"),
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
    ],
  );
}

function auditCompositeVerifier() {
  const contents = readFile("scripts/beta-foundation-verify.sh");
  const selfTest = "security:headers-policy:self-test";
  const audit = "security:headers-policy";
  if (!contents.includes(selfTest) || !contents.includes(audit)) {
    errors.push(
      "scripts/beta-foundation-verify.sh must run security header policy self-test and audit.",
    );
    return;
  }
  if (contents.indexOf(selfTest) > contents.indexOf(audit)) {
    errors.push(
      "scripts/beta-foundation-verify.sh must run security header policy self-test before the real audit.",
    );
  }
}

function auditDocs() {
  requireMarkers("docs/QA_CHECKLIST.md", readFile("docs/QA_CHECKLIST.md"), [
    "security:headers-policy:self-test",
    "security:headers-policy",
    "Helmet",
    "strict transport security",
    "trust-proxy",
    "Console cross-origin opener policy",
    "Console CSP",
    "staging runtime evidence",
  ]);

  requireMarkers("docs/BETA_ROADMAP.md", readFile("docs/BETA_ROADMAP.md"), [
    "The security header policy audit must keep passing",
    "Helmet",
    "strict transport security",
    "trust-proxy",
    "Console cross-origin opener policy",
    "Console CSP",
    "staging runtime evidence",
  ]);

  requireMarkers(
    "docs/ALPHA_SECURITY_REVIEW.md",
    readFile("docs/ALPHA_SECURITY_REVIEW.md"),
    [
      "ASR-011 - Security headers and public deployment hardening",
      "Status after Security Pass 81",
      "security:headers-policy",
    ],
  );
}

function requireMarkers(relativePath, contents, markers) {
  for (const marker of markers) {
    if (!contents.includes(marker)) {
      errors.push(`${relativePath} is missing required marker: ${marker}`);
    }
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}
