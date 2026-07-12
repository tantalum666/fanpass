const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_PAYMENT_RESPONSE_REDACTION_ROOT
  ? path.resolve(process.env.FANPASS_PAYMENT_RESPONSE_REDACTION_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

const packageJson = readJson("package.json");
const betaVerifier = readProjectFile("scripts/beta-foundation-verify.sh");
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
    assertVerifierStep(script);
  }
}

function validatePaymentsServiceRedaction() {
  const mapPaymentCalls = countMatches(paymentsService, "this.mapPayment(");
  if (mapPaymentCalls !== 2) {
    errors.push(
      `PaymentsService must keep this.mapPayment(...) limited to createPaymentIntent idempotent and fresh checkout responses; found ${mapPaymentCalls} calls.`,
    );
  }
  if (!paymentsService.includes("return this.mapPayment(repaired);")) {
    errors.push(
      "createPaymentIntent repaired idempotent retry must keep returning the payer-only payment mapper.",
    );
  }
  if (!paymentsService.includes("return this.mapPayment(updated);")) {
    errors.push(
      "createPaymentIntent fresh provider result must keep returning the payer-only payment mapper.",
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

  const mapPayment = extractMethodBody("mapPayment");
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

  const redactedPayment = extractMethodBody("mapRedactedPayment");
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

  const paymentJobPayload = extractMethodBody("paymentJobPayload");
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
        "Keep `npm run security:payment-response-redaction:self-test` and `npm run security:payment-response-redaction` in `npm run beta:foundation:verify`",
        "Payment status visible to organizer Console views must redact Stripe client secrets and user PII by default.",
      ],
    ],
    [
      "Beta roadmap",
      betaRoadmap,
      [
        "The payment response redaction audit must keep passing inside `npm run beta:foundation:verify`",
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

function assertVerifierStep(script) {
  const pattern = new RegExp(`npm\\s+run\\s+${escapeRegExp(script)}(?=\\s|$)`);
  if (!pattern.test(betaVerifier)) {
    errors.push(`beta foundation verifier must run npm run ${script}`);
  }
}

function extractMethodBody(methodName) {
  const marker = `private ${methodName}`;
  const start = paymentsService.indexOf(marker);
  if (start === -1) {
    errors.push(`PaymentsService must define ${marker}`);
    return "";
  }
  const next = paymentsService.indexOf("\n  private ", start + marker.length);
  return paymentsService.slice(start, next === -1 ? undefined : next);
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
