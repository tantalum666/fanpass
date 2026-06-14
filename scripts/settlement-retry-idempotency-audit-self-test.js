const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/settlement-retry-idempotency-audit.js",
);

const cases = [
  {
    label: "accepts durable settlement retry idempotency coverage",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects outbox enqueue without idempotency-key upsert",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/side-effects/side-effect-outbox.service.ts",
        outboxService().replace(
          "writer.sideEffectOutbox.upsert",
          "writer.sideEffectOutbox.create",
        ),
      ),
  },
  {
    label: "rejects missing ownership finalization idempotency key",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
        workerService().replace(
          "this.ownershipSettlementFinalizeKey(",
          "this.randomFinalizeKey(",
        ),
      ),
  },
  {
    label: "rejects payment worker dispatch without outbox idempotency key",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
        workerService().replaceAll("job.idempotencyKey", "undefined"),
      ),
  },
  {
    label: "rejects provider calls without side-effect idempotency key",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/payments/payments.service.ts",
        paymentsService().replaceAll("sideEffectIdempotencyKey ??", ""),
      ),
  },
  {
    label: "rejects missing side-effect worker test coverage",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/test/side-effect-worker.service.spec.ts",
        "describe('SideEffectWorkerService', () => {});\n",
      ),
  },
  {
    label: "rejects missing composite verifier step",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        "npm run security:settlement-retry-idempotency:self-test\n",
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-settlement-retry-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_SETTLEMENT_RETRY_AUDIT_ROOT: fixtureRoot,
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
  writeFixtureFile(fixtureRoot, "package.json", JSON.stringify(packageJson()));
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.sh",
    [
      "npm run security:settlement-retry-idempotency:self-test",
      "npm run security:settlement-retry-idempotency",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/side-effects/side-effect-outbox.service.ts",
    outboxService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
    settlementSideEffectsService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/side-effects/ticket-ownership-side-effects.service.ts",
    ticketOwnershipSideEffectsService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
    workerService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/payments/payments.service.ts",
    paymentsService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/test/side-effect-worker.service.spec.ts",
    workerSpec(),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/DEVELOPMENT_TASKS.md",
    "- [x] Add settlement retry idempotency around payment capture, refund, and ownership retries.\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/QA_CHECKLIST.md",
    [
      "Keep payment capture, cancellation, and refund provider retries tied to the durable side-effect outbox job idempotency key.",
      "Keep ownership provider transfer and settlement finalization as separate worker steps",
      "security:settlement-retry-idempotency",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/PROVIDER_COST_FEASIBILITY.md",
    [
      "Payment capture, authorization cancellation, and refund workers now pass the durable outbox job idempotency key",
      "security:settlement-retry-idempotency",
    ].join("\n"),
  );
}

function packageJson() {
  return {
    scripts: {
      "security:settlement-retry-idempotency":
        "node scripts/settlement-retry-idempotency-audit.js",
      "security:settlement-retry-idempotency:self-test":
        "node scripts/settlement-retry-idempotency-audit-self-test.js",
    },
  };
}

function outboxService() {
  return `
export class SideEffectOutboxService {
  enqueue(writer, input) {
    return writer.sideEffectOutbox.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: { idempotencyKey: input.idempotencyKey },
      update: {},
    });
  }
  pending() { return { status: { in: ["PENDING", "RETRYING"] } }; }
  claim() {
    return {
      attempts: {
          increment: 1,
      },
    };
  }
  retryOrDeadJob() {
    return {
      status: terminal ? "DEAD" : "RETRYING",
      availableAt: terminal ? new Date() : this.nextAvailableAt(attempts),
    };
  }
}
`;
}

function settlementSideEffectsService() {
  return `
export class SettlementSideEffectsService {
  enqueueOwnershipTransfer() {
    const idempotencyKey = this.ownershipTransferSideEffectKey(buyOrderId, sellOrderId);
    this.outbox.enqueue(prisma, { type: "OWNERSHIP_TRANSFER", idempotencyKey, payload: {} });
    return idempotencyKey;
  }
  enqueuePaymentCaptureForTrade() {
    this.outbox.enqueue(prisma, { type: "PAYMENT_CAPTURE", idempotencyKey: this.paymentCaptureSideEffectKey(paymentId, tradeId) });
  }
  enqueuePaymentCompensation() {
    this.outbox.enqueue(prisma, {
      type: refundRequired ? "PAYMENT_REFUND" : "PAYMENT_CANCEL_AUTHORIZATION",
      idempotencyKey: refundRequired ? this.paymentRefundSideEffectKey(input.paymentId, input.reason) : this.paymentCancelSideEffectKey(input.paymentId, input.reason),
    });
  }
  ownershipTransferSideEffectKey(buyOrderId, sellOrderId) { return \`ownership-transfer:\${buyOrderId}:\${sellOrderId}\`; }
  paymentCaptureSideEffectKey(paymentId, tradeId) { return \`payment-capture:\${paymentId}:\${tradeId}\`; }
  paymentCancelSideEffectKey(paymentId, reason) { return \`payment-cancel:\${paymentId}:\${reason}\`; }
  paymentRefundSideEffectKey(paymentId, reason) { return \`payment-refund:\${paymentId}:\${reason}\`; }
}
`;
}

function ticketOwnershipSideEffectsService() {
  return `
export class TicketOwnershipSideEffectsService {
  issueTicket() {
    this.outbox.enqueue(writer, { type: "OWNERSHIP_ISSUE", idempotencyKey: this.issueSideEffectKey(localTicketId) });
    return this.usesOutboxProofSync();
  }
  redeemTicket() {
    this.outbox.enqueue(writer, { type: "OWNERSHIP_REDEEM", idempotencyKey: this.redeemSideEffectKey(ticketId, tokenId) });
    return this.usesOutboxProofSync();
  }
  issueSideEffectKey(localTicketId) { return \`ownership-issue:\${localTicketId}\`; }
  redeemSideEffectKey(ticketId, tokenId) { return \`ownership-redeem:\${ticketId}:\${tokenId ?? "missing-token"}\`; }
  usesOutboxProofSync() { return "FANPASS_CHAIN_PROOF_SYNC_OUTBOX"; }
}
`;
}

function workerService() {
  return `
export class SideEffectWorkerService {
  dispatch(job) {
    switch(job.type) {
      case "OWNERSHIP_ISSUE": this.ownership.issueTicket(payload); break;
      case "OWNERSHIP_TRANSFER": break;
      case "OWNERSHIP_REDEEM": this.ownership.redeemTicket(payload); break;
      case "OWNERSHIP_SETTLEMENT_FINALIZE": break;
    }
    this.outbox.enqueueStandalone({ idempotencyKey: this.ownershipSettlementFinalizeKey(buyOrderId, sellOrderId) });
    this.orderbook.finalizeOwnershipTransfer(job);
    this.payments.processCaptureJob(paymentId, tradeId, job.idempotencyKey);
    this.payments.processCancelAuthorizationJob(paymentId, reason, job.idempotencyKey);
    this.payments.processRefundJob(paymentId, reason, job.idempotencyKey);
  }
  ownershipSettlementFinalizeKey(buyOrderId, sellOrderId) { return \`ownership-finalize:\${buyOrderId}:\${sellOrderId}\`; }
}
`;
}

function paymentsService() {
  return `
export class PaymentsService {
  requestPaymentOperation() {
    const sideEffectIdempotencyKey = this.paymentOperationSideEffectKey(operation, payment.id, idempotencyKey);
    this.outbox.enqueue(tx, { type: this.sideEffectTypeForOperation(input.operation), idempotencyKey: sideEffectIdempotencyKey });
  }
  captureProviderPaymentIntent(payment, sideEffectIdempotencyKey) {
    return stripe.capture({ idempotencyKey: sideEffectIdempotencyKey ?? this.paymentCaptureSideEffectKey(payment.id) });
  }
  cancelProviderPaymentIntent(payment, sideEffectIdempotencyKey) {
    return stripe.cancel({ idempotencyKey: sideEffectIdempotencyKey ?? this.paymentCancelSideEffectKey(payment.id) });
  }
  refundProviderPaymentIntent(payment, sideEffectIdempotencyKey) {
    return stripe.refund({ idempotencyKey: sideEffectIdempotencyKey ?? this.paymentRefundSideEffectKey(payment.id) });
  }
  paymentOperationSideEffectKey(operation, paymentId, idempotencyKey) { return \`payment-operation:\${operation}:\${paymentId}:\${idempotencyKey}\`; }
}
`;
}

function workerSpec() {
  return `
it("claims and completes an ownership issue side-effect", () => {});
expect("ownership-issue:tkt_demo_new").toBeTruthy();
it("claims and completes an ownership redeem side-effect", () => {});
expect("ownership-redeem:tkt_demo_001:1").toBeTruthy();
it("finalizes ownership settlement without re-running the provider transfer", () => {});
expect("payment-capture:pay_demo:trd_demo").toBeTruthy();
expect("payment-cancel:pay_auth:ownership_transfer_failed").toBeTruthy();
expect("payment-refund:pay_capture:event_cancelled").toBeTruthy();
expect(payments.processCaptureJob).toHaveBeenCalledWith("pay", "trade", "key");
expect(payments.processCancelAuthorizationJob).toHaveBeenCalledWith("pay", "reason", "key");
expect(payments.processRefundJob).toHaveBeenCalledWith("pay", "reason", "key");
`;
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
