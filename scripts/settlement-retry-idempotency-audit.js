const fs = require("fs");
const path = require("path");
const {
  assertOrderedNpmScripts,
  loadBetaFoundationGateSteps,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = process.env.FANPASS_SETTLEMENT_RETRY_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_SETTLEMENT_RETRY_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

const packageJson = readJson("package.json");
const betaGateSteps = loadBetaFoundationGateSteps(rootDir, errors);
const outbox = readProjectFile(
  "apps/api/src/modules/side-effects/side-effect-outbox.service.ts",
);
const settlementSideEffects = readProjectFile(
  "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
);
const ticketOwnershipSideEffects = readProjectFile(
  "apps/api/src/modules/side-effects/ticket-ownership-side-effects.service.ts",
);
const worker = readProjectFile(
  "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
);
const payments = readProjectFile(
  "apps/api/src/modules/payments/payments.service.ts",
);
const workerSpec = readProjectFile(
  "apps/api/test/side-effect-worker.service.spec.ts",
);
const tasks = readProjectFile("docs/DEVELOPMENT_TASKS.md");
const qaChecklist = readProjectFile("docs/QA_CHECKLIST.md");
const providerFeasibility = readProjectFile(
  "docs/PROVIDER_COST_FEASIBILITY.md",
);

validatePackageAndCompositeGate();
validateOutboxRetryIdempotency();
validateTicketOwnershipProofSyncKeys();
validateSettlementSideEffectKeys();
validateWorkerRetryDispatch();
validatePaymentProviderKeys();
validateCoverageAndDocs();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      durableRetryKeys: [
        "ownership-issue:{localTicketId}",
        "ownership-transfer:{buyOrderId}:{sellOrderId}",
        "ownership-redeem:{ticketId}:{tokenId}",
        "ownership-finalize:{buyOrderId}:{sellOrderId}",
        "payment-capture:{paymentId}:{tradeId}",
        "payment-cancel:{paymentId}:{reason}",
        "payment-refund:{paymentId}:{reason}",
        "payment-operation:{operation}:{paymentId}:{idempotencyKey}",
      ],
      retryBoundaries: {
        outboxUpsertByIdempotencyKey: true,
        retryingJobsAreRunnable: true,
        workerPassesPaymentOutboxKeys: true,
        ownershipFinalizationDoesNotRerunTransfer: true,
      },
    },
    null,
    2,
  ),
);

function validatePackageAndCompositeGate() {
  const scripts = packageJson.scripts ?? {};
  for (const script of [
    "security:settlement-retry-idempotency",
    "security:settlement-retry-idempotency:self-test",
  ]) {
    if (!scripts[script]) {
      errors.push(`package.json must define ${script}`);
    }
  }
  assertOrderedNpmScripts(
    betaGateSteps,
    [
      "security:settlement-retry-idempotency:self-test",
      "security:settlement-retry-idempotency",
    ],
    errors,
  );
}

function validateOutboxRetryIdempotency() {
  for (const marker of [
    "writer.sideEffectOutbox.upsert",
    "idempotencyKey: input.idempotencyKey",
    "update: {}",
    'in: ["PENDING", "RETRYING"]',
    "attempts: {\n          increment: 1",
    'status: terminal ? "DEAD" : "RETRYING"',
    "availableAt: terminal ? new Date() : this.nextAvailableAt(attempts)",
  ]) {
    if (!outbox.includes(marker)) {
      errors.push(
        `SideEffectOutboxService must keep retry/idempotency marker: ${marker}`,
      );
    }
  }
}

function validateTicketOwnershipProofSyncKeys() {
  for (const marker of [
    'type: "OWNERSHIP_ISSUE"',
    'type: "OWNERSHIP_REDEEM"',
    "issueSideEffectKey(",
    "return `ownership-issue:${localTicketId}`;",
    "redeemSideEffectKey(",
    'return `ownership-redeem:${ticketId}:${tokenId ?? "missing-token"}`;',
    "FANPASS_CHAIN_PROOF_SYNC_OUTBOX",
    "usesOutboxProofSync()",
  ]) {
    if (!ticketOwnershipSideEffects.includes(marker)) {
      errors.push(
        `TicketOwnershipSideEffectsService must keep deterministic proof-sync marker: ${marker}`,
      );
    }
  }
}

function validateSettlementSideEffectKeys() {
  for (const marker of [
    'type: "OWNERSHIP_TRANSFER"',
    "idempotencyKey,",
    "return idempotencyKey;",
    "ownershipTransferSideEffectKey(",
    "return `ownership-transfer:${buyOrderId}:${sellOrderId}`;",
    'type: "PAYMENT_CAPTURE"',
    "this.paymentCaptureSideEffectKey(",
    'type: refundRequired ? "PAYMENT_REFUND" : "PAYMENT_CANCEL_AUTHORIZATION"',
    "this.paymentRefundSideEffectKey(input.paymentId, input.reason)",
    "this.paymentCancelSideEffectKey(input.paymentId, input.reason)",
    "return `payment-capture:${paymentId}:${tradeId}`;",
    "return `payment-cancel:${paymentId}:${reason}`;",
    "return `payment-refund:${paymentId}:${reason}`;",
  ]) {
    if (!settlementSideEffects.includes(marker)) {
      errors.push(
        `SettlementSideEffectsService must keep deterministic side-effect marker: ${marker}`,
      );
    }
  }
}

function validateWorkerRetryDispatch() {
  const markers = [
    'case "OWNERSHIP_ISSUE"',
    'case "OWNERSHIP_TRANSFER"',
    'case "OWNERSHIP_REDEEM"',
    'case "OWNERSHIP_SETTLEMENT_FINALIZE"',
    "this.ownership.issueTicket(",
    "this.ownership.redeemTicket(",
    "this.outbox.enqueueStandalone",
    "this.ownershipSettlementFinalizeKey(",
    "return `ownership-finalize:${buyOrderId}:${sellOrderId}`;",
    "this.orderbook.finalizeOwnershipTransfer",
    "this.payments.processCaptureJob(",
    "job.idempotencyKey",
    "this.payments.processCancelAuthorizationJob(",
    "this.payments.processRefundJob(",
  ];

  for (const marker of markers) {
    if (!worker.includes(marker)) {
      errors.push(
        `SideEffectWorkerService must keep retry dispatch marker: ${marker}`,
      );
    }
  }
}

function validatePaymentProviderKeys() {
  for (const marker of [
    "const sideEffectIdempotencyKey = this.paymentOperationSideEffectKey(",
    "type: this.sideEffectTypeForOperation(input.operation)",
    "idempotencyKey: sideEffectIdempotencyKey",
    "paymentOperationSideEffectKey(",
    "return `payment-operation:${operation}:${paymentId}:${idempotencyKey}`;",
    "captureProviderPaymentIntent(",
    "cancelProviderPaymentIntent(",
    "refundProviderPaymentIntent(",
    "sideEffectIdempotencyKey ??",
    "this.paymentCaptureSideEffectKey(payment.id)",
    "this.paymentCancelSideEffectKey(payment.id)",
    "this.paymentRefundSideEffectKey(payment.id)",
  ]) {
    if (!payments.includes(marker)) {
      errors.push(
        `PaymentsService must keep provider idempotency marker: ${marker}`,
      );
    }
  }
}

function validateCoverageAndDocs() {
  for (const marker of [
    "claims and completes an ownership issue side-effect",
    "ownership-issue:tkt_demo_new",
    "claims and completes an ownership redeem side-effect",
    "ownership-redeem:tkt_demo_001:1",
    "finalizes ownership settlement without re-running the provider transfer",
    "payment-capture:pay_demo:trd_demo",
    "payment-cancel:pay_auth:ownership_transfer_failed",
    "payment-refund:pay_capture:event_cancelled",
    "processCaptureJob).toHaveBeenCalledWith",
    "processCancelAuthorizationJob).toHaveBeenCalledWith",
    "processRefundJob).toHaveBeenCalledWith",
  ]) {
    if (!workerSpec.includes(marker)) {
      errors.push(
        `Side-effect worker tests must keep retry/idempotency marker: ${marker}`,
      );
    }
  }

  if (
    !tasks.includes(
      "- [x] Add settlement retry idempotency around payment capture, refund, and ownership retries.",
    )
  ) {
    errors.push(
      "Development tasks must mark settlement retry idempotency complete after audit coverage is added",
    );
  }

  for (const [label, contents, markers] of [
    [
      "QA checklist",
      qaChecklist,
      [
        "Keep payment capture, cancellation, and refund provider retries tied to the durable side-effect outbox job idempotency key.",
        "Keep ownership provider transfer and settlement finalization as separate worker steps",
        "security:settlement-retry-idempotency",
      ],
    ],
    [
      "Provider feasibility",
      providerFeasibility,
      [
        "Payment capture, authorization cancellation, and refund workers now pass the durable outbox job idempotency key",
        "security:settlement-retry-idempotency",
      ],
    ],
  ]) {
    for (const marker of markers) {
      if (!contents.includes(marker)) {
        errors.push(`${label} must keep settlement retry marker: ${marker}`);
      }
    }
  }
}

function readJson(relativePath) {
  return JSON.parse(readProjectFile(relativePath));
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}
