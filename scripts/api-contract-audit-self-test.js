const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/api-contract-audit.js");

const cases = [
  {
    label: "accepts bounded DTOs, param pipes, query pipes, and idempotency headers",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects missing global ValidationPipe settings",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/main.ts",
        "new ValidationPipe({ whitelist: true, transform: true });\n",
      ),
  },
  {
    label: "rejects bare string request-body validation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/events/events.controller.ts",
        eventsController({ dtoFieldDecorators: "@IsString()" }),
      ),
  },
  {
    label: "rejects raw route params without bounded pipes",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/events/events.controller.ts",
        eventsController({ paramDecorator: '@Param("id")' }),
      ),
  },
  {
    label: "rejects named query params without validation boundary",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/events/events.controller.ts",
        eventsController({ queryDecorator: '@Query("cursor")' }),
      ),
  },
  {
    label: "rejects missing idempotency header on order creation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/orders/orders.controller.ts",
        ordersController({ includeIdempotencyHeader: false }),
      ),
  },
  {
    label: "rejects unallowlisted bodyless mutation",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/events/events.controller.ts",
        "\nexport class ExtraController { @Post() unsafeCommand() { return {}; } }\n",
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-api-contract-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_API_CONTRACT_AUDIT_ROOT: fixtureRoot,
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
      "new ValidationPipe({",
      "  whitelist: true,",
      "  forbidNonWhitelisted: true,",
      "  transform: true,",
      "});",
      "",
    ].join("\n"),
  );
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
}

function eventsController(options = {}) {
  const dtoFieldDecorators =
    options.dtoFieldDecorators ?? "@IsString()\n  @MaxLength(80)";
  const paramDecorator =
    options.paramDecorator ?? '@Param("id", FanPassIdParamPipe)';
  const queryDecorator =
    options.queryDecorator ?? '@Query("cursor", FanPassIdParamPipe)';
  return `
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { IsString, MaxLength } from "class-validator";
import { FanPassIdParamPipe } from "../../../common/route-param.pipe";

class CreateEventDto {
  ${dtoFieldDecorators}
  title!: string;
}

@Controller("/events")
export class EventsController {
  @Get(":id")
  getEvent(${paramDecorator} id: string, ${queryDecorator} cursor?: string) {
    return { id, cursor };
  }

  @Post()
  createEvent(@Body() body: CreateEventDto) {
    return body;
  }
}
`;
}

function ordersController(options = {}) {
  const includeIdempotencyHeader = options.includeIdempotencyHeader !== false;
  const headerParameter = includeIdempotencyHeader
    ? ', @Headers("idempotency-key") idempotencyKey?: string'
    : "";
  return `
import { Body, Controller, Headers, Post } from "@nestjs/common";
import { IsInt, IsString, Matches, Max, Min } from "class-validator";

class CreateOrderDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  eventId!: string;

  @IsInt()
  @Min(1)
  @Max(10000000)
  price!: number;
}

@Controller("/orders")
export class OrdersController {
  @Post()
  createOrder(@Body() body: CreateOrderDto${headerParameter}) {
    return body;
  }
}
`;
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function appendFixtureFile(fixtureRoot, relativePath, contents) {
  fs.appendFileSync(path.join(fixtureRoot, relativePath), contents);
}
