const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_PRIVY_WEBHOOK_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_PRIVY_WEBHOOK_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const sourceRoots = [
  "apps/api/src",
  "apps/dashboard/lib",
  "apps/dashboard/server",
  "apps/dashboard/src",
  "apps/ios/FanPass/FanPass",
  "apps/ios/FanPass/FanPassOps",
];

const errors = [];
const sourceFiles = sourceRoots.flatMap((sourceRoot) =>
  listSourceFiles(path.join(rootDir, sourceRoot)),
);

validateNoPrivyWebhookCodeDependency();
validateAccessTokenSyncBoundaries();
validatePackageAndCompositeGate();
validateDocs();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedFiles: sourceFiles.length,
      privyWebhooks: "optional until plan support is verified",
      requiredLowCostBoundaries: [
        "POST /auth/privy/sync",
        "POST /auth/privy/accept-staff-invite",
        "POST /api/console/privy-session",
      ],
    },
    null,
    2,
  ),
);

function validateNoPrivyWebhookCodeDependency() {
  const forbiddenPatterns = [
    {
      label: "Privy webhook route or handler",
      pattern: /privy[\s\S]{0,120}webhook|webhook[\s\S]{0,120}privy/i,
    },
    {
      label: "Privy webhook environment requirement",
      pattern:
        /\bPRIVY_[A-Z0-9_]*WEBHOOK[A-Z0-9_]*\b|\b[A-Z0-9_]*WEBHOOK[A-Z0-9_]*PRIVY[A-Z0-9_]*\b/,
    },
  ];

  for (const absoluteFile of sourceFiles) {
    const relativeFile = normalizePath(path.relative(rootDir, absoluteFile));
    const contents = fs.readFileSync(absoluteFile, "utf8");
    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(contents)) {
        errors.push(
          `${rule.label} must not exist before Privy plan support is verified; found in ${relativeFile}`,
        );
      }
    }
  }
}

function validateAccessTokenSyncBoundaries() {
  const authController = readProjectFile(
    "apps/api/src/modules/auth/auth.controller.ts",
  );
  const authService = readProjectFile(
    "apps/api/src/modules/auth/auth.service.ts",
  );
  const consoleSession = readProjectFile("apps/dashboard/server/console-bff.ts");
  const apiClient = readProjectFile(
    "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  );

  for (const marker of [
    '@Post("privy/sync")',
    '@Post("privy/accept-staff-invite")',
  ]) {
    if (!authController.includes(marker)) {
      errors.push(
        `AuthController must keep non-webhook Privy marker: ${marker}`,
      );
    }
  }

  for (const marker of [
    "syncPrivyUser(token",
    "acceptStaffInvite(token",
    "this.privyTokens.verifyAccessToken(token)",
  ]) {
    if (!authService.includes(marker)) {
      errors.push(`AuthService must keep access-token Privy marker: ${marker}`);
    }
  }

  if (!consoleSession.includes("/auth/privy/sync")) {
    errors.push(
      "FanPass Console Privy session bridge must keep using /auth/privy/sync instead of Privy webhooks",
    );
  }

  for (const marker of [
    '"/auth/privy/sync"',
    '"/auth/privy/accept-staff-invite"',
  ]) {
    if (!apiClient.includes(marker)) {
      errors.push(
        `FanPass iOS API client must keep Privy token path: ${marker}`,
      );
    }
  }
}

function validatePackageAndCompositeGate() {
  const packageJson = JSON.parse(readProjectFile("package.json"));
  const scripts = packageJson.scripts ?? {};
  for (const script of [
    "security:privy-webhooks:optional",
    "security:privy-webhooks:optional:self-test",
  ]) {
    if (!scripts[script]) {
      errors.push(`package.json must define ${script}`);
    }
  }

  const verifier = readProjectFile("scripts/beta-foundation-verify.sh");
  assertVerifierStep(verifier, "security:privy-webhooks:optional:self-test");
  assertVerifierStep(verifier, "security:privy-webhooks:optional");
}

function validateDocs() {
  const tasks = readProjectFile("docs/DEVELOPMENT_TASKS.md");
  const qa = readProjectFile("docs/QA_CHECKLIST.md");
  const provider = readProjectFile("docs/PROVIDER_COST_FEASIBILITY.md");
  const roadmap = readProjectFile("docs/BETA_ROADMAP.md");

  if (
    !tasks.includes(
      "- [x] Keep Privy webhooks optional until plan support is verified.",
    )
  ) {
    errors.push(
      "Development tasks must mark the Privy webhook optionality gate complete after audit coverage is added",
    );
  }

  for (const [fileLabel, contents, markers] of [
    [
      "QA checklist",
      qa,
      [
        "Privy webhooks must remain optional until actual plan support is verified",
        "security:privy-webhooks:optional",
      ],
    ],
    [
      "Provider feasibility",
      provider,
      [
        "Do not make Privy webhooks a hard dependency",
        "Add Privy webhooks only after verifying the selected plan supports them.",
        "security:privy-webhooks:optional",
      ],
    ],
    [
      "Beta roadmap",
      roadmap,
      ["Privy webhook optionality audit", "backend access-token sync"],
    ],
  ]) {
    for (const marker of markers) {
      if (!contents.includes(marker)) {
        errors.push(`${fileLabel} must keep marker: ${marker}`);
      }
    }
  }
}

function assertVerifierStep(verifier, script) {
  const pattern = new RegExp(`npm\\s+run\\s+${escapeRegExp(script)}(?=\\s|$)`);
  if (!pattern.test(verifier)) {
    errors.push(`beta foundation verifier must run npm run ${script}`);
  }
}

function listSourceFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name.endsWith(".xcodeproj")
      ) {
        return [];
      }
      return listSourceFiles(absolutePath);
    }
    if (!/\.(ts|tsx|js|swift)$/.test(entry.name)) {
      return [];
    }
    return [absolutePath];
  });
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
