const fs = require("fs");
const path = require("path");
const {
  assertOrderedNpmScripts,
  loadBetaFoundationGateSteps,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = process.env.FANPASS_PAYMENT_RESPONSE_REDACTION_ROOT
  ? path.resolve(process.env.FANPASS_PAYMENT_RESPONSE_REDACTION_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

const packageJson = readJson("package.json");
const betaGateSteps = loadBetaFoundationGateSteps(rootDir, errors);
const paymentsService = readProjectFile(
  "apps/api/src/modules/payments/payments.service.ts",
);
const alphaPersistence = readProjectFile(
  "apps/api/src/modules/alpha/alpha-persistence.service.ts",
);
const privacyMatrix = readProjectFile("docs/API_RESPONSE_PRIVACY_MATRIX.md");
const tasks = readProjectFile("docs/DEVELOPMENT_TASKS.md");
const qaChecklist = readProjectFile("docs/QA_CHECKLIST.md");
const betaRoadmap = readProjectFile("docs/BETA_ROADMAP.md");

validatePackageAndCompositeGate();
validatePaymentsServiceRedaction();
validateOperationsSnapshotRedaction();
validateDocs();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      paymentResponses: {
        checkoutIntent: "payer-only client secret boundary",
        adminOperations: "redacted payment status only",
        webhookResponses: "redacted payment status only",
        workerPayloads: "no client secrets",
        operationsSnapshot: "clientSecret null and provider id gated",
      },
    },
    null,
    2,
  ),
);

function validatePackageAndCompositeGate() {
  const scripts = packageJson.scripts ?? {};
  for (const script of [
    "security:payment-response-redaction",
    "security:payment-response-redaction:self-test",
  ]) {
    if (!scripts[script]) {
      errors.push(`package.json must define ${script}`);
    }
  }
  assertOrderedNpmScripts(
    betaGateSteps,
    [
      "security:payment-response-redaction:self-test",
      "security:payment-response-redaction",
    ],
    errors,
  );
}

function validatePaymentsServiceRedaction() {
  const createPaymentIntent = extractClassMethod("createPaymentIntent");
  const mapPaymentCalls = countMatches(paymentsService, "this.mapPayment(");
  const checkoutMapPaymentCalls = countMatches(
    createPaymentIntent,
    "this.mapPayment(",
  );
  const nonCheckoutMapPaymentCalls = mapPaymentCalls - checkoutMapPaymentCalls;

  if (mapPaymentCalls !== 1) {
    errors.push(
      `PaymentsService must keep exactly one payer-only this.mapPayment(...) call; found ${mapPaymentCalls} calls.`,
    );
  }
  if (checkoutMapPaymentCalls !== 1) {
    errors.push(
      `createPaymentIntent must keep exactly one payer-only this.mapPayment(...) call; found ${checkoutMapPaymentCalls} calls.`,
    );
  }
  if (nonCheckoutMapPaymentCalls !== 0) {
    errors.push(
      `Only createPaymentIntent may call the payer-only mapPayment mapper; found ${nonCheckoutMapPaymentCalls} call(s) elsewhere.`,
    );
  }
  for (const marker of [
    "let updated: Payment;",
    "updated = await this.ensureProviderPaymentIntent(",
    "paymentResult.existing",
    '"PAYMENT_INTENT_REPAIRED"',
    '"PAYMENT_INTENT_CREATED"',
  ]) {
    if (!createPaymentIntent.includes(marker)) {
      errors.push(
        `createPaymentIntent must keep fresh and repaired provider results on the unified updated response path: ${marker}`,
      );
    }
  }
  if (
    !/return\s+this\.mapPayment\(updated\);\s*}\s*$/.test(
      createPaymentIntent.trim(),
    )
  ) {
    errors.push(
      "createPaymentIntent must end with the single payer-only return this.mapPayment(updated) response path.",
    );
  }
  if (!paymentsService.includes("payment: this.mapRedactedPayment(payment)")) {
    errors.push(
      "requestPaymentOperation must return payment through mapRedactedPayment(payment).",
    );
  }
  if (!paymentsService.includes("payment: this.mapRedactedPayment(updated)")) {
    errors.push(
      "handleWebhook must return payment through mapRedactedPayment(updated).",
    );
  }

  const mapPayment = extractClassMethod("mapPayment");
  for (const marker of [
    "clientSecret: payment.clientSecret",
    "idempotencyKey: payment.idempotencyKey",
  ]) {
    if (!mapPayment.includes(marker)) {
      errors.push(
        `mapPayment must keep explicit payer-only checkout marker: ${marker}`,
      );
    }
  }

  const redactedPayment = extractClassMethod("mapRedactedPayment");
  for (const forbidden of [
    "clientSecret",
    "stripePaymentIntentId",
    "idempotencyKey",
    "userId",
  ]) {
    if (redactedPayment.includes(forbidden)) {
      errors.push(
        `mapRedactedPayment must not expose ${forbidden} in admin/webhook responses.`,
      );
    }
  }

  const paymentJobPayload = extractClassMethod("paymentJobPayload");
  for (const forbidden of ["clientSecret", "idempotencyKey"]) {
    if (paymentJobPayload.includes(forbidden)) {
      errors.push(
        `paymentJobPayload must not place ${forbidden} into side-effect results.`,
      );
    }
  }
}

function validateOperationsSnapshotRedaction() {
  for (const marker of [
    "payments: payments.map((payment) => ({",
    "userId: this.userReference(payment.userId, privacy.piiVisible)",
    "stripePaymentIntentId: privacy.piiVisible",
    "clientSecret: null",
  ]) {
    if (!alphaPersistence.includes(marker)) {
      errors.push(
        `Alpha operations snapshot must keep payment redaction marker: ${marker}`,
      );
    }
  }
  if (alphaPersistence.includes("clientSecret: payment.clientSecret")) {
    errors.push(
      "Alpha operations snapshot must never copy payment.clientSecret into organizer/admin responses.",
    );
  }
}

function validateDocs() {
  for (const marker of [
    "| `apps/api/src/modules/payments/payments.controller.ts:createPaymentIntent`",
    "Fan/admin payment authorization boundary; no secret echo to organizers.",
    "| `apps/api/src/modules/payments/payments.controller.ts:cancelAuthorization`",
    "| `apps/api/src/modules/payments/payments.controller.ts:refund`",
    "| `apps/api/src/modules/payments/payments.controller.ts:reconcile`",
    "| `apps/api/src/modules/alpha/alpha.controller.ts:operationsSnapshot`",
    "Organizer-scoped operational snapshot with default redaction.",
  ]) {
    if (!privacyMatrix.includes(marker)) {
      errors.push(
        `API privacy matrix must keep payment redaction marker: ${marker}`,
      );
    }
  }

  if (
    !tasks.includes(
      "- [x] Add payment response redaction audit for client-secret and admin operation boundaries.",
    )
  ) {
    errors.push(
      "Development tasks must mark payment response redaction audit complete.",
    );
  }

  for (const [label, contents, markers] of [
    [
      "QA checklist",
      qaChecklist,
      [
        "Keep `npm run security:payment-response-redaction:self-test` and `npm run security:payment-response-redaction` in `node scripts/beta-foundation-verify.js`",
        "Payment status visible to organizer Console views must redact Stripe client secrets and user PII by default.",
      ],
    ],
    [
      "Beta roadmap",
      betaRoadmap,
      [
        "The payment response redaction audit must keep passing inside `node scripts/beta-foundation-verify.js`",
      ],
    ],
  ]) {
    for (const marker of markers) {
      if (!contents.includes(marker)) {
        errors.push(
          `${label} must keep payment response redaction marker: ${marker}`,
        );
      }
    }
  }
}

function extractClassMethod(methodName) {
  const declaration = new RegExp(
    `^  (?:(?:public|protected|private)\\s+)?(?:async\\s+)?${escapeRegExp(methodName)}\\s*\\(`,
    "m",
  );
  const match = declaration.exec(paymentsService);
  if (!match) {
    errors.push(`PaymentsService must define method ${methodName}`);
    return "";
  }

  const start = match.index;
  const nextMethod =
    /\n  (?:(?:public|protected|private)\s+)?(?:async\s+)?[A-Za-z_$][\w$]*\s*\(/g;
  nextMethod.lastIndex = start + match[0].length;
  const next = nextMethod.exec(paymentsService);
  return paymentsService.slice(start, next ? next.index : undefined);
}

function countMatches(contents, needle) {
  return contents.split(needle).length - 1;
}

function readJson(relativePath) {
  return JSON.parse(readProjectFile(relativePath));
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
