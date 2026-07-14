const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/api-response-privacy-audit.js");

const cases = [
  {
    label: "accepts documented API and Console response classifications",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects undocumented controller handlers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/API_RESPONSE_PRIVACY_MATRIX.md",
        matrix({ omitEvent: true }),
      ),
  },
  {
    label: "rejects route drift between code and privacy matrix",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/API_RESPONSE_PRIVACY_MATRIX.md",
        matrix({ eventRoute: "GET /events/:eventId" }),
      ),
  },
  {
    label: "rejects private classification on public routes",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/API_RESPONSE_PRIVACY_MATRIX.md",
        matrix({ eventClassification: "FAN_PRIVATE" }),
      ),
  },
  {
    label: "rejects public classification on protected routes",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/API_RESPONSE_PRIVACY_MATRIX.md",
        matrix({ orderClassification: "PUBLIC_MARKET" }),
      ),
  },
  {
    label: "rejects admin-private routes without ADMIN-only roles",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/orders/orders.controller.ts",
        ordersController({ roles: '@Roles("ORGANIZER", "ADMIN")' }),
      ),
  },
  {
    label:
      "rejects provider-ingress classification outside the webhook boundary",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/API_RESPONSE_PRIVACY_MATRIX.md",
        matrix({ eventClassification: "PROVIDER_INGRESS" }),
      ),
  },
  {
    label: "rejects webhook classification drift away from provider ingress",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/API_RESPONSE_PRIVACY_MATRIX.md",
        matrix({ webhookClassification: "PUBLIC_SYSTEM" }),
      ),
  },
  {
    label: "rejects public classifications on Console route handlers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/API_RESPONSE_PRIVACY_MATRIX.md",
        matrix({ sessionClassification: "PUBLIC_SYSTEM" }),
      ),
  },
  {
    label:
      "rejects one-time Console secret responses without access token redaction",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/server/console-bff.ts",
        consoleBff({ includeMarkers: false }),
      ),
  },
  {
    label: "rejects stale privacy matrix entries",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "docs/API_RESPONSE_PRIVACY_MATRIX.md",
        "\n| `apps/api/src/modules/events/events.controller.ts:removedHandler` | `GET /events/removed` | `PUBLIC_CATALOG` | stale fixture row |\n",
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-api-privacy-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_API_PRIVACY_AUDIT_ROOT: fixtureRoot,
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
    "apps/api/src/modules/events/events.controller.ts",
    eventsController(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/orders/orders.controller.ts",
    ordersController(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/payments/payments.controller.ts",
    paymentsController(),
  );
  writeFixtureFile(fixtureRoot, "apps/dashboard/server/console-bff.ts", consoleBff());
  writeFixtureFile(
    fixtureRoot,
    "docs/API_RESPONSE_PRIVACY_MATRIX.md",
    matrix(),
  );
}

function eventsController() {
  return `
import { Controller, Get } from "@nestjs/common";
import { PublicRoute } from "../../auth/public-route.decorator";

@Controller("events")
export class EventsController {
  @PublicRoute()
  @Get(":id")
  getEvent() {
    return { id: "evt_fixture" };
  }
}
`;
}

function ordersController(options = {}) {
  const roles = options.roles ?? '@Roles("ADMIN")';
  return `
import { Controller, Post } from "@nestjs/common";
import { Roles } from "../../auth/roles.decorator";

@Controller("orders")
export class OrdersController {
  ${roles}
  @Post(":orderId/match")
  matchOrder() {
    return { ok: true };
  }
}
`;
}

function paymentsController() {
  return `
import { Controller, Post } from "@nestjs/common";
import { PublicRoute } from "../../auth/public-route.decorator";

@Controller("payments")
export class PaymentsController {
  @PublicRoute()
  @Post("webhook")
  webhook() {
    return { received: true };
  }
}
`;
}

function consoleBff(options = {}) {
  const includeMarkers = options.includeMarkers !== false;
  return `
${includeMarkers ? "import { consoleAccessToken } from '../console-session';" : ""}
${includeMarkers ? "import { redactConsoleGateAssignmentResponse } from './redaction';" : ""}

function handlePrivyHandoffStart() {}
function handlePrivySessionPost() {}
function handlePrivySessionDelete() {}
function handlePrivySessionOptions() {}
function handleOperations() {}
function handleCreateEvent() {}
function handleCreateTicketType() {}

function handleCreateGateAssignment() {
  ${includeMarkers ? "consoleAccessToken(cookieSource(request));" : ""}
  const response = { inviteToken: "fixture-token" };
  return Response.json(${includeMarkers ? "redactConsoleGateAssignmentResponse(response)" : "response"});
}

function handleRotateInvite() {
  ${includeMarkers ? "consoleAccessToken(cookieSource(request));" : ""}
  const payload = { inviteToken: "fixture-token" };
  return Response.json(${includeMarkers ? "redactConsoleGateAssignmentResponse(payload)" : "payload"});
}

function handleDeactivateGateAssignment() {}
`;
}

function matrix(options = {}) {
  const rows = [];
  if (!options.omitEvent) {
    rows.push([
      "apps/api/src/modules/events/events.controller.ts:getEvent",
      options.eventRoute ?? "GET /events/:id",
      options.eventClassification ?? "PUBLIC_CATALOG",
      "Public event fixture.",
    ]);
  }
  rows.push(
    [
      "apps/api/src/modules/orders/orders.controller.ts:matchOrder",
      "POST /orders/:orderId/match",
      options.orderClassification ?? "ADMIN_PRIVATE",
      "Admin-only fixture.",
    ],
    [
      "apps/api/src/modules/payments/payments.controller.ts:webhook",
      "POST /payments/webhook",
      options.webhookClassification ?? "PROVIDER_INGRESS",
      "Webhook fixture.",
    ],
    [
      "apps/dashboard/server/console-bff.ts:handlePrivyHandoffStart",
      "GET /api/console/privy-handoff",
      "AUTH_SESSION",
      "Console handoff start fixture.",
    ],
    [
      "apps/dashboard/server/console-bff.ts:handlePrivySessionPost",
      "POST /api/console/privy-session",
      options.sessionClassification ?? "AUTH_SESSION",
      "Console session fixture.",
    ],
    [
      "apps/dashboard/server/console-bff.ts:handlePrivySessionDelete",
      "DELETE /api/console/privy-session",
      "AUTH_SESSION",
      "Console session delete fixture.",
    ],
    [
      "apps/dashboard/server/console-bff.ts:handlePrivySessionOptions",
      "OPTIONS /api/console/privy-session",
      "AUTH_SESSION",
      "Console session preflight fixture.",
    ],
    [
      "apps/dashboard/server/console-bff.ts:handleOperations",
      "GET /api/console/operations",
      "ORGANIZER_REDACTED",
      "Console operations fixture.",
    ],
    [
      "apps/dashboard/server/console-bff.ts:handleCreateEvent",
      "POST /api/console/events",
      "ORGANIZER_REDACTED",
      "Console event fixture.",
    ],
    [
      "apps/dashboard/server/console-bff.ts:handleCreateTicketType",
      "POST /api/console/events/:eventId/ticket-types",
      "ORGANIZER_REDACTED",
      "Console ticket type fixture.",
    ],
    [
      "apps/dashboard/server/console-bff.ts:handleCreateGateAssignment",
      "POST /api/console/gate-assignments",
      "ORGANIZER_SECRET_ONCE",
      "Console one-time secret fixture.",
    ],
    [
      "apps/dashboard/server/console-bff.ts:handleRotateInvite",
      "POST /api/console/gate-assignments/:assignmentId/invites",
      "ORGANIZER_SECRET_ONCE",
      "Console one-time invite rotation fixture.",
    ],
    [
      "apps/dashboard/server/console-bff.ts:handleDeactivateGateAssignment",
      "POST /api/console/gate-assignments/:assignmentId/deactivate",
      "ORGANIZER_REDACTED",
      "Console assignment deactivation fixture.",
    ],
  );
  return [
    "# API Response Privacy Matrix",
    "",
    "| Handler | Route | Classification | Notes |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      ([handler, route, classification, notes]) =>
        `| \`${handler}\` | \`${route}\` | \`${classification}\` | ${notes} |`,
    ),
    "",
  ].join("\n");
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function appendFixtureFile(fixtureRoot, relativePath, contents) {
  fs.appendFileSync(path.join(fixtureRoot, relativePath), contents);
}
