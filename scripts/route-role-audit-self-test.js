require("reflect-metadata");

const {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} = require("@nestjs/common/constants");

const FANPASS_ROLES_KEY = "fanpass:roles";
const FANPASS_PUBLIC_ROUTE_KEY = "fanpass:public-route";

class FanPassAuthGuard {}

const cases = [
  {
    label: "accepts public routes and guarded role routes",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects a route without public or guarded role metadata",
    expected: "fail",
    mutate: ({ controller }) => addRoute(controller, "unsafeRoute", {}),
  },
  {
    label: "rejects role metadata without FanPassAuthGuard",
    expected: "fail",
    mutate: ({ controller }) =>
      addRoute(controller, "rolesWithoutGuard", {
        roles: ["ADMIN"],
        guard: false,
      }),
  },
  {
    label: "rejects role matrix drift on an existing handler",
    expected: "fail",
    mutate: ({ controller }) =>
      defineAccess(controller.prototype.createEvent, {
        roles: ["ORGANIZER", "ADMIN"],
      }),
  },
  {
    label: "rejects public/private matrix drift",
    expected: "fail",
    mutate: ({ controller }) =>
      defineAccess(controller.prototype.createEvent, { public: true }),
  },
  {
    label: "rejects unexpected new route handlers",
    expected: "fail",
    mutate: ({ controller }) =>
      addRoute(controller, "newPublicRoute", { public: true }),
  },
  {
    label: "rejects missing expected route handlers",
    expected: "fail",
    mutate: ({ controller }) => {
      Reflect.deleteMetadata(PATH_METADATA, controller.prototype.health);
      Reflect.deleteMetadata(METHOD_METADATA, controller.prototype.health);
    },
  },
];

const results = cases.map((testCase) => {
  const fixture = buildFixture();
  testCase.mutate(fixture);
  const auditResult = auditRouteRoles({
    controllers: [fixture.controller],
    expectedAccessByHandler: fixture.expectedAccessByHandler,
  });
  const passed = auditResult.ok;
  const expectedPass = testCase.expected === "pass";
  return {
    label: testCase.label,
    expected: testCase.expected,
    status: passed ? 0 : 1,
    ok: passed === expectedPass,
    errors: auditResult.errors,
  };
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

function buildFixture() {
  class FixtureController {}
  addRoute(FixtureController, "health", { public: true });
  addRoute(FixtureController, "createEvent", {
    roles: ["ADMIN"],
    guard: true,
  });

  return {
    controller: FixtureController,
    expectedAccessByHandler: new Map([
      ["FixtureController.health", "PUBLIC"],
      ["FixtureController.createEvent", ["ADMIN"]],
    ]),
  };
}

function addRoute(controller, handlerName, access) {
  Object.defineProperty(controller.prototype, handlerName, {
    configurable: true,
    value: function routeHandler() {},
  });
  const handler = controller.prototype[handlerName];
  Reflect.defineMetadata(PATH_METADATA, `/${handlerName}`, handler);
  Reflect.defineMetadata(METHOD_METADATA, 0, handler);
  defineAccess(handler, access);
}

function defineAccess(handler, access) {
  Reflect.deleteMetadata(FANPASS_PUBLIC_ROUTE_KEY, handler);
  Reflect.deleteMetadata(FANPASS_ROLES_KEY, handler);
  Reflect.deleteMetadata(GUARDS_METADATA, handler);

  if (access.public) {
    Reflect.defineMetadata(FANPASS_PUBLIC_ROUTE_KEY, true, handler);
    return;
  }
  if (access.roles) {
    Reflect.defineMetadata(FANPASS_ROLES_KEY, access.roles, handler);
  }
  if (access.guard !== false) {
    Reflect.defineMetadata(GUARDS_METADATA, [FanPassAuthGuard], handler);
  }
}

function auditRouteRoles({ controllers, expectedAccessByHandler }) {
  const uncovered = [];
  const actualAccessByHandler = new Map();

  for (const controller of controllers) {
    for (const { handlerName, handler } of getRouteHandlers(controller)) {
      const key = `${controller.name}.${handlerName}`;
      const isPublic = getMetadata(
        FANPASS_PUBLIC_ROUTE_KEY,
        handler,
        controller,
      );
      const roles = getMetadata(FANPASS_ROLES_KEY, handler, controller) ?? [];
      const guards = getMetadata(GUARDS_METADATA, handler, controller) ?? [];
      const hasFanPassGuard = guards.includes(FanPassAuthGuard);

      if (!isPublic && !(hasFanPassGuard && roles.length > 0)) {
        uncovered.push(key);
      }
      actualAccessByHandler.set(key, isPublic ? "PUBLIC" : roles);
    }
  }

  const errors = [];
  if (uncovered.length > 0) {
    errors.push(`uncovered routes: ${uncovered.join(", ")}`);
  }

  const actualKeys = [...actualAccessByHandler.keys()].sort();
  const expectedKeys = [...expectedAccessByHandler.keys()].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    errors.push(
      `route matrix keys drifted: expected ${expectedKeys.join(", ")}; actual ${actualKeys.join(", ")}`,
    );
  }

  for (const [key, expectedAccess] of expectedAccessByHandler) {
    const actualAccess = actualAccessByHandler.get(key);
    if (JSON.stringify(actualAccess) !== JSON.stringify(expectedAccess)) {
      errors.push(
        `route access drifted for ${key}: expected ${JSON.stringify(expectedAccess)}; actual ${JSON.stringify(actualAccess)}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function getRouteHandlers(controller) {
  const prototype = controller.prototype;
  return Object.getOwnPropertyNames(prototype)
    .filter((propertyName) => propertyName !== "constructor")
    .map((propertyName) => ({
      handlerName: propertyName,
      handler: prototype[propertyName],
    }))
    .filter(({ handler }) => {
      return (
        typeof handler === "function" &&
        Reflect.getMetadata(PATH_METADATA, handler) !== undefined &&
        Reflect.getMetadata(METHOD_METADATA, handler) !== undefined
      );
    });
}

function getMetadata(key, handler, controller) {
  return (
    Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller)
  );
}
