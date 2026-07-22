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
  "scripts/payment-response-redaction-audit.js",
);

const cases = [
  {
    label: "accepts intended payment response redaction boundaries",
    expected: "pass",
    mutate: (fixtureRoot) => writeFixture(fixtureRoot),
  },
  {
    label: "rejects admin payment operation returning payer-only mapper",
    expected: "fail",
    mutate: (fixtureRoot) => {
      writeFixture(fixtureRoot);
      replaceInFixture(
        fixtureRoot,
        "apps/api/src/modules/payments/payments.service.ts",
        "payment: this.mapRedactedPayment(payment)",
        "payment: this.mapPayment(payment)",
      );
    },
  },
  {
    label: "rejects payer-only mapper usage outside createPaymentIntent",
    expected: "fail",
    mutate: (fixtureRoot) => {
      writeFixture(fixtureRoot);
      replaceInFixture(
        fixtureRoot,
        "apps/api/src/modules/payments/payments.service.ts",
        "  async requestPaymentOperation() {",
        [
          "  async exposePayment(payment) {",
          "    return this.mapPayment(payment);",
          "  }",
          "",
          "  async requestPaymentOperation() {",
        ].join("\n"),
      );
    },
  },
  {
    label: "rejects a non-unified checkout response tail",
    expected: "fail",
    mutate: (fixtureRoot) => {
      writeFixture(fixtureRoot);
      replaceInFixture(
        fixtureRoot,
        "apps/api/src/modules/payments/payments.service.ts",
        "    return this.mapPayment(updated);\n  }\n\n  async requestPaymentOperation() {",
        [
          "    if (paymentResult.existing) {",
          "      return this.mapPayment(updated);",
          "    }",
          "    return updated;",
          "  }",
          "",
          "  async requestPaymentOperation() {",
        ].join("\n"),
      );
    },
  },
  {
    label: "rejects webhook response returning payer-only mapper",
    expected: "fail",
    mutate: (fixtureRoot) => {
      writeFixture(fixtureRoot);
      replaceInFixture(
        fixtureRoot,
        "apps/api/src/modules/payments/payments.service.ts",
        "payment: this.mapRedactedPayment(updated)",
        "payment: this.mapPayment(updated)",
      );
    },
  },
  {
    label: "rejects redacted payment mapper leaking client secrets",
    expected: "fail",
    mutate: (fixtureRoot) => {
      writeFixture(fixtureRoot);
      replaceInFixture(
        fixtureRoot,
        "apps/api/src/modules/payments/payments.service.ts",
        "captureStatus: payment.captureStatus,\n      createdAt: payment.createdAt.toISOString(),\n      updatedAt: payment.updatedAt.toISOString(),\n    };",
        "updatedAt: payment.updatedAt.toISOString(),\n      clientSecret: payment.clientSecret,\n    };",
      );
    },
  },
  {
    label: "rejects side-effect payment payload leaking client secrets",
    expected: "fail",
    mutate: (fixtureRoot) => {
      writeFixture(fixtureRoot);
      replaceInFixture(
        fixtureRoot,
        "apps/api/src/modules/payments/payments.service.ts",
        "captureStatus: payment.captureStatus,\n    };",
        "captureStatus: payment.captureStatus,\n      clientSecret: payment.clientSecret,\n    };",
      );
    },
  },
  {
    label: "rejects operations snapshot copying payment client secret",
    expected: "fail",
    mutate: (fixtureRoot) => {
      writeFixture(fixtureRoot);
      replaceInFixture(
        fixtureRoot,
        "apps/api/src/modules/alpha/alpha-persistence.service.ts",
        "clientSecret: null",
        "clientSecret: payment.clientSecret",
      );
    },
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) => {
      writeFixture(fixtureRoot, { includeVerifierStep: false });
    },
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-payment-response-redaction-"),
  );
  try {
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_PAYMENT_RESPONSE_REDACTION_ROOT: fixtureRoot,
      },
      encoding: "utf8",
    });
    const passed =
      testCase.expected === "pass" ? result.status === 0 : result.status !== 0;
    if (!passed) {
      return {
        label: testCase.label,
        expected: testCase.expected,
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    }
    return {
      label: testCase.label,
      expected: testCase.expected,
      status: result.status,
    };
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

const failed = results.filter((result) => {
  return result.expected === "pass" ? result.status !== 0 : result.status === 0;
});

if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, results }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, cases: results }, null, 2));

function writeFixture(fixtureRoot, options = {}) {
  const includeVerifierStep = options.includeVerifierStep !== false;
  writeFixtureFile(
    fixtureRoot,
    "package.json",
    JSON.stringify(
      {
        scripts: {
          "security:payment-response-redaction":
            "node scripts/payment-response-redaction-audit.js",
          "security:payment-response-redaction:self-test":
            "node scripts/payment-response-redaction-audit-self-test.js",
        },
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.js",
    includeVerifierStep
      ? renderBetaFoundationGateFixture([
          "security:payment-response-redaction:self-test",
          "security:payment-response-redaction",
        ])
      : renderBetaFoundationGateFixture(["security:api-privacy"]),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/payments/payments.service.ts",
    paymentsServiceFixture(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/alpha/alpha-persistence.service.ts",
    alphaPersistenceFixture(),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/API_RESPONSE_PRIVACY_MATRIX.md",
    privacyMatrixFixture(),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/DEVELOPMENT_TASKS.md",
    "- [x] Add payment response redaction audit for client-secret and admin operation boundaries.\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/QA_CHECKLIST.md",
    [
      "Payment status visible to organizer Console views must redact Stripe client secrets and user PII by default.",
      "Keep `npm run security:payment-response-redaction:self-test` and `npm run security:payment-response-redaction` in `node scripts/beta-foundation-verify.js`.",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/BETA_ROADMAP.md",
    "The payment response redaction audit must keep passing inside `node scripts/beta-foundation-verify.js`.",
  );
}

function paymentsServiceFixture() {
  return `
export class PaymentsService {
  async createPaymentIntent() {
    const existing = {};
    const paymentResult = {
      payment: existing,
      existing: Boolean(existing),
    };
    let updated: Payment;
    updated = await this.ensureProviderPaymentIntent(
      paymentResult.payment,
      paymentResult.existing
        ? "PAYMENT_INTENT_REPAIRED"
        : "PAYMENT_INTENT_CREATED",
    );
    return this.mapPayment(updated);
  }

  async requestPaymentOperation() {
    const payment = {};
    const job = {};
    return {
      ok: true,
      payment: this.mapRedactedPayment(payment),
      sideEffect: { id: job.id },
    };
  }

  async handleWebhook() {
    const updated = {};
    return {
      received: true,
      payment: this.mapRedactedPayment(updated),
    };
  }

  private paymentJobPayload(payment) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      captureStatus: payment.captureStatus,
    };
  }

  private mapPayment(payment) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      clientSecret: payment.clientSecret,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      captureStatus: payment.captureStatus,
      idempotencyKey: payment.idempotencyKey,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  private mapRedactedPayment(payment) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      captureStatus: payment.captureStatus,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }
}
`;
}

function alphaPersistenceFixture() {
  return `
export class AlphaPersistenceService {
  operationsSnapshot(privacy, payments) {
    return {
      payments: payments.map((payment) => ({
        id: payment.id,
        userId: this.userReference(payment.userId, privacy.piiVisible),
        orderId: payment.orderId,
        stripePaymentIntentId: privacy.piiVisible
          ? payment.stripePaymentIntentId
          : null,
        clientSecret: null,
      })),
    };
  }
}
`;
}

function privacyMatrixFixture() {
  return [
    "| Handler | Route | Classification | Notes |",
    "| --- | --- | --- | --- |",
    "| `apps/api/src/modules/payments/payments.controller.ts:createPaymentIntent` | `POST /payments/intents` | `FAN_PRIVATE` | Fan/admin payment authorization boundary; no secret echo to organizers. |",
    "| `apps/api/src/modules/payments/payments.controller.ts:cancelAuthorization` | `POST /payments/:paymentId/cancel-authorization` | `ADMIN_PRIVATE` | Admin-only payment operation outbox request. |",
    "| `apps/api/src/modules/payments/payments.controller.ts:refund` | `POST /payments/:paymentId/refund` | `ADMIN_PRIVATE` | Admin-only payment operation outbox request. |",
    "| `apps/api/src/modules/payments/payments.controller.ts:reconcile` | `POST /payments/:paymentId/reconcile` | `ADMIN_PRIVATE` | Admin-only payment operation outbox request. |",
    "| `apps/api/src/modules/alpha/alpha.controller.ts:operationsSnapshot` | `GET /alpha/operations` | `ORGANIZER_REDACTED` | Organizer-scoped operational snapshot with default redaction. |",
  ].join("\n");
}

function replaceInFixture(fixtureRoot, relativePath, from, to) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  if (!contents.includes(from)) {
    throw new Error(`Fixture did not include expected marker: ${from}`);
  }
  fs.writeFileSync(absolutePath, contents.replace(from, to));
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
