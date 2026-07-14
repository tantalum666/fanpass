const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_CONSOLE_AUTH_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_CONSOLE_AUTH_AUDIT_ROOT)
  : path.resolve(__dirname, "..");
const errors = [];

const files = {
  manifest: "apps/console-auth/package.json",
  login: "apps/console-auth/src/PrivyConsoleLogin.tsx",
  clientConfig: "apps/console-auth/src/runtime-config.ts",
  serverConfig: "apps/console-auth/server/config.ts",
  server: "apps/console-auth/server/index.ts",
  security: "apps/console-auth/server/security.ts",
  staticFiles: "apps/console-auth/server/static-files.ts",
  vite: "apps/console-auth/vite.config.ts",
  render: "render.yaml",
  releaseContract: "docs/PRIVY_CONSOLE_REACT_SDK_ISOLATION.md",
  rootManifest: "package.json",
  betaVerifier: "scripts/beta-foundation-verify.sh",
};

for (const relativePath of Object.values(files)) {
  if (!fs.existsSync(path.join(rootDir, relativePath))) {
    errors.push(
      `Console Auth runtime boundary file is missing: ${relativePath}`,
    );
  }
}

for (const legacyPath of [
  "apps/console-auth/app",
  "apps/console-auth/next.config.ts",
  "apps/console-auth/next-env.d.ts",
]) {
  if (fs.existsSync(path.join(rootDir, legacyPath))) {
    errors.push(
      `Console Auth must not retain legacy Next runtime path ${legacyPath}`,
    );
  }
}

if (errors.length === 0) {
  auditManifest();
  auditLogin();
  auditRuntimeConfiguration();
  auditServer();
  auditSecurityHeaders();
  auditStaticFiles();
  auditViteBoundary();
  auditDeploymentAndReleaseContract();
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      runtime: "vite-node-static",
      checkedFiles: Object.values(files),
      nextRuntimePresent: false,
      fanPassManagedBrowserTokenStoragePresent: false,
      productionConfigurationFailClosed: true,
      productionPrivyHttpOnlyCookieRequired: true,
      productionReleaseEvidenceRequired: true,
    },
    null,
    2,
  ),
);

function auditManifest() {
  const manifest = JSON.parse(read(files.manifest));
  if (manifest.dependencies?.next || manifest.devDependencies?.next) {
    errors.push("apps/console-auth/package.json must not include Next");
  }
  if (manifest.dependencies?.["@privy-io/react-auth"] !== "3.35.0") {
    errors.push("Console Auth must pin the reviewed Privy React SDK version");
  }
  for (const [script, marker] of [
    ["build", "vite build"],
    ["build", "tsc -p tsconfig.server.json"],
    ["start", "node dist/server/index.js"],
    ["typecheck", "tsc -p tsconfig.server.json --noEmit"],
  ]) {
    if (!String(manifest.scripts?.[script] ?? "").includes(marker)) {
      errors.push(`Console Auth ${script} script must include ${marker}`);
    }
  }
}

function auditLogin() {
  const login = read(files.login);
  requireMarkers(files.login, login, [
    'from "@privy-io/react-auth"',
    'loginMethods: ["email"]',
    "getAccessToken()",
    'privySessionMode === "browser-sdk"',
    "handoffForm",
    'action={sessionBridgeUrl}',
    'name="accessToken"',
    'name="handoff" value="top-level"',
    "form.requestSubmit()",
    "fetch(sessionBridgeUrl",
    'method: "POST"',
    "body: JSON.stringify({})",
    'cache: "no-store"',
    'credentials: "include"',
    "window.location.assign(consoleUrl)",
  ]);
  rejectMarkers(files.login, login, [
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "console.log",
    "console.error",
    "dangerouslySetInnerHTML",
  ]);
}

function auditRuntimeConfiguration() {
  const clientConfig = read(files.clientConfig);
  const serverConfig = read(files.serverConfig);
  requireMarkers(files.clientConfig, clientConfig, [
    'fetch("/api/runtime-config"',
    'cache: "no-store"',
    'credentials: "same-origin"',
    'sessionBridgeUrl.pathname !== "/api/console/privy-session"',
    "sessionBridgeUrl.origin !== consoleUrl.origin",
    'consoleUrl.pathname !== "/"',
  ]);
  requireMarkers(files.serverConfig, serverConfig, [
    '"FANPASS_PRIVY_APP_ID"',
    '"FANPASS_CONSOLE_SESSION_BRIDGE_URL"',
    '"FANPASS_CONSOLE_URL"',
    "FANPASS_PRIVY_SESSION_MODE",
    'privySessionMode !== "httponly-cookie"',
    "Beta and production Console Auth must use Privy HttpOnly cookie mode",
    "env.RENDER_SERVICE_NAME",
    "env.RENDER_EXTERNAL_HOSTNAME",
    'sessionBridgeUrl.pathname !== "/api/console/privy-session"',
    "sessionBridgeUrl.origin !== consoleUrl.origin",
    'url.protocol !== "https:"',
    "productionLike",
    "url.username || url.password",
  ]);
  rejectMarkers(files.serverConfig, serverConfig, [
    "process.env.PRIVY_APP_SECRET",
    "process.env.PRIVY_VERIFICATION_KEY",
  ]);
}

function auditServer() {
  const server = read(files.server);
  requireMarkers(files.server, server, [
    "createServer(async (request, response) => {",
    'pathname === "/api/runtime-config"',
    'pathname === "/health"',
    'response.setHeader("Cache-Control", "no-store")',
    'response.setHeader("Allow", "GET, HEAD")',
    'runtime: "vite-node-static"',
    "releaseIdentifier(process.env.RENDER_GIT_COMMIT)",
    'message: "Console authentication is not configured."',
    'message: "Console authentication request failed."',
  ]);
  rejectMarkers(files.server, server, [
    "request.headers.authorization",
    "request.headers.cookie",
    "process.env.PRIVY_APP_SECRET",
  ]);
}

function auditSecurityHeaders() {
  const security = read(files.security);
  requireMarkers(files.security, security, [
    '"X-Content-Type-Options", "nosniff"',
    '"X-Frame-Options", "DENY"',
    '"Cross-Origin-Opener-Policy", "same-origin-allow-popups"',
    '"Strict-Transport-Security"',
    '"Content-Security-Policy"',
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "frame-src https://auth.privy.io https://challenges.cloudflare.com",
    "connect-src 'self'",
    "`form-action 'self'${consoleFormAction}`",
    "https://auth.privy.io",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ]);
  rejectMarkers(files.security, security, ["script-src *", "connect-src *"]);
}

function auditStaticFiles() {
  const staticFiles = read(files.staticFiles);
  requireMarkers(files.staticFiles, staticFiles, [
    "decodeURIComponent(pathname)",
    "path.resolve(publicRoot, relativePath)",
    "resolved.startsWith(`${publicRoot}${path.sep}`)",
    'cacheControl: "no-store"',
    '"public, max-age=31536000, immutable"',
    '"application/octet-stream"',
  ]);
}

function auditViteBoundary() {
  const vite = read(files.vite);
  requireMarkers(files.vite, vite, [
    "plugins: [react()]",
    'outDir: "dist/public"',
    "sourcemap: false",
    '"@farcaster/mini-app-solana"',
    '"@stripe/crypto"',
  ]);
}

function auditDeploymentAndReleaseContract() {
  const render = read(files.render);
  const releaseContract = read(files.releaseContract);
  const rootManifest = JSON.parse(read(files.rootManifest));
  const betaVerifier = read(files.betaVerifier);

  requireMarkers(files.render, render, [
    "name: fanpass-console-auth-staging",
    "rootDir: apps/console-auth",
    "healthCheckPath: /health",
    "- key: FANPASS_ENV",
    "- key: FANPASS_PRIVY_SESSION_MODE",
    "- key: FANPASS_CONSOLE_SESSION_BRIDGE_URL",
    "- key: FANPASS_CONSOLE_URL",
  ]);
  requireMarkers(files.releaseContract, releaseContract, [
    "--require-production",
    "dedicated production Privy app",
    "stable owner-controlled production domain",
    "Privy HttpOnly cookie mode",
    "administrator allowlist",
    "MFA or passkey",
    "exact production allowed origins",
  ]);
  if (
    rootManifest.scripts?.["security:console-auth-runtime"] !==
      "node scripts/console-auth-runtime-audit.js" ||
    rootManifest.scripts?.["security:console-auth-runtime:self-test"] !==
      "node scripts/console-auth-runtime-audit-self-test.js"
  ) {
    errors.push("root package scripts must expose Console Auth runtime audits");
  }
  for (const command of [
    "npm run security:console-auth-runtime:self-test",
    "npm run security:console-auth-runtime",
  ]) {
    if (!betaVerifier.includes(command)) {
      errors.push(`Beta foundation verifier must run ${command}`);
    }
  }
}

function requireMarkers(relativePath, contents, markers) {
  for (const marker of markers) {
    if (!contents.includes(marker)) {
      errors.push(`${relativePath} must include ${marker}`);
    }
  }
}

function rejectMarkers(relativePath, contents, markers) {
  for (const marker of markers) {
    if (contents.includes(marker)) {
      errors.push(`${relativePath} must not include ${marker}`);
    }
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}
