const fs = require("fs");
const path = require("path");
const {
  assertOrderedNpmScripts,
  loadBetaFoundationGateSteps,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = process.env.FANPASS_STAFF_INVITE_POLICY_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_STAFF_INVITE_POLICY_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];
const betaGateSteps = loadBetaFoundationGateSteps(rootDir, errors);

const files = {
  packageJson: "package.json",
  authService: "apps/api/src/modules/auth/auth.service.ts",
  authController: "apps/api/src/modules/auth/auth.controller.ts",
  alphaPersistence: "apps/api/src/modules/alpha/alpha-persistence.service.ts",
  alphaController: "apps/api/src/modules/alpha/alpha.controller.ts",
  main: "apps/api/src/main.ts",
  consoleBff: "apps/dashboard/server/console-bff.ts",
  consoleRedactor: "apps/dashboard/lib/gate-assignment-response.ts",
  opsShell: "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
  apiClient: "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  tasks: "docs/DEVELOPMENT_TASKS.md",
  qa: "docs/QA_CHECKLIST.md",
  roadmap: "docs/BETA_ROADMAP.md",
};

validateRequiredFiles();
validatePackageScripts();
validateCompositeVerifier();
validateAcceptStaffInviteBoundary();
validateAssignmentInviteLifecycle();
validateApiRouteBoundaries();
validateConsoleProxyBoundaries();
validateOpsClientBoundary();
validateDocs();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      staffInvitePolicy: {
        accessTokenBoundary: "Privy access token required before invite lookup",
        oneTimeInvite: "pending invite is atomically claimed once",
        assignmentState:
          "inactive assignments revoke pending invite acceptance",
        roleLinking: "only target GATE_STAFF accounts can be linked",
        consoleProxy: "Console proxies redact and use server bearer auth",
        opsClient: "Ops links through API client boundary and clears tokens",
      },
    },
    null,
    2,
  ),
);

function validateRequiredFiles() {
  for (const [label, relativePath] of Object.entries(files)) {
    if (!fs.existsSync(path.join(rootDir, relativePath))) {
      errors.push(`Missing required ${label} file: ${relativePath}`);
    }
  }
}

function validatePackageScripts() {
  const packageJson = JSON.parse(read(files.packageJson));
  const scripts = packageJson.scripts ?? {};
  for (const scriptName of [
    "security:staff-invite-policy",
    "security:staff-invite-policy:self-test",
  ]) {
    if (!scripts[scriptName]) {
      errors.push(`package.json must define ${scriptName}`);
    }
  }
}

function validateCompositeVerifier() {
  assertOrderedNpmScripts(
    betaGateSteps,
    ["security:staff-invite-policy:self-test", "security:staff-invite-policy"],
    errors,
  );
}

function validateAcceptStaffInviteBoundary() {
  const controller = read(files.authController);
  const service = read(files.authService);

  for (const marker of [
    '@Post("privy/accept-staff-invite")',
    "@PublicRoute()",
    'throw new UnauthorizedException("Privy access token is required")',
    "this.auth.acceptStaffInvite(token, body)",
    '"STAFF_INVITE_ACCEPTED"',
  ]) {
    if (!controller.includes(marker)) {
      errors.push(
        `AuthController staff invite boundary missing marker: ${marker}`,
      );
    }
  }

  for (const marker of [
    "this.privyTokens.verifyAccessToken(token)",
    'throw new BadRequestException("Staff invites require Prisma storage")',
    "tokenHash: this.hashStaffInviteToken(inviteToken)",
    'invite.status !== "PENDING"',
    'status: "EXPIRED"',
    "tx.gateAssignment.findUnique",
    "id: invite.gateAssignmentId",
    "if (!assignment?.active)",
    'status: "REVOKED"',
    "alreadyLinked && alreadyLinked.id !== invite.staffUserId",
    'staff.role !== "GATE_STAFF"',
    "staff.privyId && staff.privyId !== privyId",
    "const claimedInvite = await tx.staffInvite.updateMany",
    'status: "PENDING"',
    "acceptedAt: null",
    "acceptedPrivyId: null",
    "claimedInvite.count !== 1",
    'status: "ACCEPTED"',
    "acceptedPrivyId: privyId",
    "inviteAccepted: true",
    "hashStaffInviteToken(token: string)",
  ]) {
    if (!service.includes(marker)) {
      errors.push(`AuthService staff invite policy missing marker: ${marker}`);
    }
  }
  if (
    !/const accepted = await prisma\.\$transaction\(\s*async \(tx(?::\s*Prisma\.TransactionClient)?\) =>/.test(
      service,
    )
  ) {
    errors.push(
      "AuthService staff invite policy missing marker: Prisma transaction around invite acceptance",
    );
  }
}

function validateAssignmentInviteLifecycle() {
  const alpha = read(files.alphaPersistence);
  for (const marker of [
    'existingUser && existingUser.role !== "GATE_STAFF"',
    'role: "GATE_STAFF"',
    'action: "GATE_STAFF_CREATED"',
    'status: "SUPERSEDED"',
    "const inviteToken = this.generateStaffInviteToken()",
    "tokenHash: this.hashStaffInviteToken(inviteToken)",
    'status: "PENDING"',
    "expiresAt: this.staffInviteExpiry()",
    "createdByUserId: session.userId",
    'status: "REVOKED"',
    'action: "GATE_ASSIGNMENT_DEACTIVATED"',
    'throw new BadRequestException(\n          "Inactive gate assignments cannot receive new invites"',
    "if (assignment.staff.privyId)",
    'throw new BadRequestException(\n          "Gate staff account is already linked to Privy"',
    'action: "STAFF_INVITE_ROTATED"',
    'return `${randomUUID()}${randomUUID()}`.replace(/-/g, "")',
    'createHash("sha256").update(token).digest("hex")',
  ]) {
    if (!alpha.includes(marker)) {
      errors.push(
        `AlphaPersistenceService staff invite lifecycle missing marker: ${marker}`,
      );
    }
  }
}

function validateApiRouteBoundaries() {
  const alphaController = read(files.alphaController);
  const main = read(files.main);

  for (const marker of [
    "class CreateGateAssignmentDto",
    "@IsEmail()",
    '@Post("/gate-assignments")',
    '@Roles("ORGANIZER", "ADMIN")',
    '@Post("/gate-assignments/:assignmentId/deactivate")',
    '@Param("assignmentId", FanPassIdParamPipe)',
    '@Post("/gate-assignments/:assignmentId/invites")',
  ]) {
    if (!alphaController.includes(marker)) {
      errors.push(
        `AlphaController staff route boundary missing marker: ${marker}`,
      );
    }
  }
  for (const marker of [
    '"/auth/privy/accept-staff-invite"',
    "RATE_LIMIT_STAFF_INVITE_PER_MINUTE",
    'message: "Too many staff invite requests"',
    '"/alpha/gate-assignments"',
    "RATE_LIMIT_STAFF_ASSIGNMENT_PER_MINUTE",
    'message: "Too many staff assignment requests"',
  ]) {
    if (!main.includes(marker)) {
      errors.push(
        `API staff route rate-limit boundary missing marker: ${marker}`,
      );
    }
  }
}

function validateConsoleProxyBoundaries() {
  const consoleBff = read(files.consoleBff);
  const redactor = read(files.consoleRedactor);

  for (const marker of [
    "handleCreateGateAssignment",
    "handleRotateInvite",
    "consoleAccessToken(cookieSource(request))",
    "ConsoleAuthRequiredError",
    "Authorization: `Bearer ${accessToken}`",
    'cache: "no-store"',
    "redactConsoleGateAssignmentResponse(payload)",
  ]) {
    if (!consoleBff.includes(marker)) {
      errors.push(`Console BFF staff proxy missing marker: ${marker}`);
    }
  }
  if (!consoleBff.includes("encodeURIComponent(")) {
    errors.push("Console invite rotation route must encode assignment ids");
  }
  for (const marker of [
    "inviteToken?: string",
    "const inviteToken = optionalString(record.inviteToken)",
    "redacted.inviteToken = inviteToken",
  ]) {
    if (!redactor.includes(marker)) {
      errors.push(`Console gate assignment redactor missing marker: ${marker}`);
    }
  }
  for (const forbidden of ["tokenHash", "acceptedPrivyId", "createdByUserId"]) {
    if (redactor.includes(forbidden)) {
      errors.push(
        `Console gate assignment redactor must not expose ${forbidden}`,
      );
    }
  }
}

function validateOpsClientBoundary() {
  const ops = read(files.opsShell);
  const client = read(files.apiClient);
  for (const marker of [
    "privyAuthProvider.loginWithEmailCode(",
    "privyAccessToken = result.accessToken",
    "apiClient.acceptStaffInvite(",
    "inviteToken.trimmingCharacters",
    "await activateOpsSession(session, fallbackAccessToken: result.accessToken)",
    "apiClient = apiClient.withAccessToken(session.accessToken ?? fallbackAccessToken)",
    'privyAccessToken = ""',
    'inviteToken = ""',
  ]) {
    if (!ops.includes(marker)) {
      errors.push(`FanPass Ops staff linking UI missing marker: ${marker}`);
    }
  }
  if (
    ops.includes('SecureField("Privy access token"') &&
    !isMarkerInsideDebugBlock(ops, 'SecureField("Privy access token"')
  ) {
    errors.push(
      "FanPass Ops manual Privy access-token entry must stay inside #if DEBUG",
    );
  }
  for (const marker of [
    "func acceptStaffInvite(",
    "privyAccessToken: String",
    "inviteToken: String",
    '"/auth/privy/accept-staff-invite"',
    "withAccessToken(privyAccessToken).post",
  ]) {
    if (!client.includes(marker)) {
      errors.push(
        `iOS API client staff invite boundary missing marker: ${marker}`,
      );
    }
  }
}

function validateDocs() {
  const docs = [files.tasks, files.qa, files.roadmap].map(read).join("\n");
  for (const marker of [
    "security:staff-invite-policy",
    "production staff invitation/linking policy",
    "one-time staff invite",
    "active gate assignment",
  ]) {
    if (!docs.includes(marker)) {
      errors.push(`staff invite policy docs must keep marker: ${marker}`);
    }
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function isMarkerInsideDebugBlock(contents, marker) {
  const lines = contents.split(/\r?\n/);
  let debugDepth = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#if DEBUG")) {
      debugDepth += 1;
    } else if (trimmed.startsWith("#if ")) {
      if (debugDepth > 0) {
        debugDepth += 1;
      }
    } else if (trimmed.startsWith("#endif") && debugDepth > 0) {
      debugDepth -= 1;
    }
    if (line.includes(marker)) {
      return debugDepth > 0;
    }
  }
  return false;
}
