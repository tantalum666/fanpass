const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/staff-invite-policy-audit.js");

const cases = [
  {
    label: "accepts production staff invitation/linking policy coverage",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects invite acceptance outside a Prisma transaction",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureText(
        fixtureRoot,
        "apps/api/src/modules/auth/auth.service.ts",
        "const accepted = await prisma.$transaction(async (tx: Prisma.TransactionClient) =>",
        "const accepted = await Promise.resolve(async (tx: Prisma.TransactionClient) =>",
      ),
  },
  {
    label: "rejects missing active assignment check",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureText(
        fixtureRoot,
        "apps/api/src/modules/auth/auth.service.ts",
        "if (!assignment?.active)",
        "if (false)",
      ),
  },
  {
    label: "rejects non-atomic pending invite claim",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureText(
        fixtureRoot,
        "apps/api/src/modules/auth/auth.service.ts",
        "const claimedInvite = await tx.staffInvite.updateMany",
        "const claimedInvite = await tx.staffInvite.update",
      ),
  },
  {
    label: "rejects missing linked staff role gate",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureText(
        fixtureRoot,
        "apps/api/src/modules/auth/auth.service.ts",
        'staff.role !== "GATE_STAFF"',
        'staff.role !== "FAN"',
      ),
  },
  {
    label: "rejects invite rotation for already linked staff",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureText(
        fixtureRoot,
        "apps/api/src/modules/alpha/alpha-persistence.service.ts",
        "if (assignment.staff.privyId)",
        "if (false)",
      ),
  },
  {
    label: "rejects Console proxy raw assignment forwarding",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureText(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        "redactConsoleGateAssignmentResponse(payload)",
        "payload",
      ),
  },
  {
    label: "rejects missing staff invite rate limits",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureText(
        fixtureRoot,
        "apps/api/src/main.ts",
        "RATE_LIMIT_STAFF_INVITE_PER_MINUTE",
        "RATE_LIMIT_AUTH_PER_MINUTE",
      ),
  },
  {
    label: "rejects Ops manual Privy token entry outside DEBUG",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceFixtureText(
        fixtureRoot,
        "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
        '#if DEBUG\nSecureField("Privy access token", text: $privyAccessToken)\n#endif',
        'SecureField("Privy access token", text: $privyAccessToken)',
      ),
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        "npm run security:api-contracts\n",
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-staff-invite-policy-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_STAFF_INVITE_POLICY_AUDIT_ROOT: fixtureRoot,
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
  writeFixtureFile(fixtureRoot, "package.json", packageJson());
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.sh",
    "npm run security:staff-invite-policy:self-test\nnpm run security:staff-invite-policy\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/auth/auth.controller.ts",
    authController(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/auth/auth.service.ts",
    authService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/alpha/alpha-persistence.service.ts",
    alphaPersistence(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/alpha/alpha.controller.ts",
    alphaController(),
  );
  writeFixtureFile(fixtureRoot, "apps/api/src/main.ts", mainTs());
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/server/console-bff.ts",
    `${consoleRoute()}\nencodeURIComponent(normalizedAssignmentId);\n`,
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/lib/gate-assignment-response.ts",
    redactor(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
    opsShell(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
    apiClient(),
  );
  const docs =
    "security:staff-invite-policy\nproduction staff invitation/linking policy\none-time staff invite\nactive gate assignment\n";
  writeFixtureFile(fixtureRoot, "docs/DEVELOPMENT_TASKS.md", docs);
  writeFixtureFile(fixtureRoot, "docs/QA_CHECKLIST.md", docs);
  writeFixtureFile(fixtureRoot, "docs/BETA_ROADMAP.md", docs);
}

function packageJson() {
  return JSON.stringify(
    {
      scripts: {
        "security:staff-invite-policy":
          "node scripts/staff-invite-policy-audit.js",
        "security:staff-invite-policy:self-test":
          "node scripts/staff-invite-policy-audit-self-test.js",
      },
    },
    null,
    2,
  );
}

function authController() {
  return `
@Post("privy/accept-staff-invite")
@PublicRoute()
async acceptStaffInvite() {
  throw new UnauthorizedException("Privy access token is required");
  return this.auth.acceptStaffInvite(token, body);
  await this.audit.record(session.userId, "STAFF_INVITE_ACCEPTED", "user", session.userId);
}
`;
}

function authService() {
  return `
export class AuthService {
  async acceptStaffInvite(token, input) {
    throw new BadRequestException("Staff invites require Prisma storage");
    this.privyTokens.verifyAccessToken(token);
    const accepted = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const invite = await tx.staffInvite.findUnique({ where: { tokenHash: this.hashStaffInviteToken(inviteToken) } });
      if (!invite || invite.status !== "PENDING") throw new UnauthorizedException("Staff invite is invalid");
      const now = new Date();
      if (invite.expiresAt <= now) await tx.staffInvite.update({ data: { status: "EXPIRED" } });
      const assignment = await tx.gateAssignment.findUnique({ where: { id: invite.gateAssignmentId } });
      if (!assignment?.active) await tx.staffInvite.updateMany({ data: { status: "REVOKED" } });
      const alreadyLinked = await tx.user.findUnique({ where: { privyId } });
      if (alreadyLinked && alreadyLinked.id !== invite.staffUserId) throw new BadRequestException();
      const staff = await tx.user.findUnique({ where: { id: invite.staffUserId } });
      if (staff.role !== "GATE_STAFF") throw new BadRequestException();
      if (staff.privyId && staff.privyId !== privyId) throw new BadRequestException();
      const claimedInvite = await tx.staffInvite.updateMany({
        where: { id: invite.id, status: "PENDING", acceptedAt: null, acceptedPrivyId: null },
        data: { status: "ACCEPTED", acceptedPrivyId: privyId }
      });
      if (claimedInvite.count !== 1) throw new UnauthorizedException();
    });
    return { inviteAccepted: true };
  }
  private hashStaffInviteToken(token: string) {}
}
`;
}

function alphaPersistence() {
  return `
if (existingUser && existingUser.role !== "GATE_STAFF") throw new BadRequestException();
role: "GATE_STAFF";
action: "GATE_STAFF_CREATED";
status: "SUPERSEDED";
const inviteToken = this.generateStaffInviteToken();
tokenHash: this.hashStaffInviteToken(inviteToken);
status: "PENDING";
expiresAt: this.staffInviteExpiry();
createdByUserId: session.userId;
status: "REVOKED";
action: "GATE_ASSIGNMENT_DEACTIVATED";
throw new BadRequestException(
          "Inactive gate assignments cannot receive new invites"
);
if (assignment.staff.privyId) throw new BadRequestException(
          "Gate staff account is already linked to Privy"
);
action: "STAFF_INVITE_ROTATED";
return \`\${randomUUID()}\${randomUUID()}\`.replace(/-/g, "");
createHash("sha256").update(token).digest("hex");
`;
}

function alphaController() {
  return `
class CreateGateAssignmentDto {
  @IsEmail()
  staffEmail!: string;
}
@Post("/gate-assignments")
@Roles("ORGANIZER", "ADMIN")
class C {
  @Post("/gate-assignments/:assignmentId/deactivate")
  f(@Param("assignmentId", FanPassIdParamPipe) id) {}
  @Post("/gate-assignments/:assignmentId/invites")
  g() {}
}
`;
}

function mainTs() {
  return `
"/auth/privy/accept-staff-invite";
RATE_LIMIT_STAFF_INVITE_PER_MINUTE;
message: "Too many staff invite requests";
"/alpha/gate-assignments";
RATE_LIMIT_STAFF_ASSIGNMENT_PER_MINUTE;
message: "Too many staff assignment requests";
`;
}

function consoleRoute() {
  return `
function handleCreateGateAssignment() {}
function handleRotateInvite() {}
ConsoleAuthRequiredError;
const accessToken = await consoleAccessToken(cookieSource(request));
fetch(url, {
  headers: { Authorization: \`Bearer \${accessToken}\` },
  cache: "no-store",
});
redactConsoleGateAssignmentResponse(payload);
`;
}

function redactor() {
  return `
export interface ConsoleGateAssignmentResponse { inviteToken?: string }
const inviteToken = optionalString(record.inviteToken);
redacted.inviteToken = inviteToken;
`;
}

function opsShell() {
  return `
#if DEBUG
SecureField("Privy access token", text: $privyAccessToken)
#endif
privyAuthProvider.loginWithEmailCode(
privyAccessToken = result.accessToken
apiClient.acceptStaffInvite(
inviteToken.trimmingCharacters(in: .whitespacesAndNewlines)
apiClient = apiClient.withAccessToken(token)
privyAccessToken = ""
inviteToken = ""
`;
}

function apiClient() {
  return `
func acceptStaffInvite(
  privyAccessToken: String,
  inviteToken: String
) {
  withAccessToken(privyAccessToken).post("/auth/privy/accept-staff-invite")
}
`;
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function replaceFixtureText(fixtureRoot, relativePath, search, replacement) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  fs.writeFileSync(absolutePath, contents.replace(search, replacement));
}
