import { ConfigService } from "@nestjs/config";
import { walletBindingFingerprint } from "../src/common/wallet-binding";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { SideEffectDispatchFencedError } from "../src/modules/side-effects/side-effect-outbox.service";

const createdAt = new Date("2026-06-14T00:00:00.000Z");
const updatedAt = new Date("2026-06-14T00:00:01.000Z");

interface TestPayment {
  id: string;
  userId: string;
  orderId: string;
  stripePaymentIntentId: string | null;
  clientSecret: string | null;
  amount: number;
  currency: string;
  status: string;
  captureStatus: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const order = {
  id: "ord_demo",
  userId: "usr_fan_demo",
  eventId: "evt_demo",
  ticketTypeId: "tt_cat2_demo",
  side: "BUY",
  price: 1288,
  status: "OPEN",
  fulfillmentMode: "ANY",
  event: {
    status: "PUBLISHED",
  },
};

const incompletePayment: TestPayment = {
  id: "pay_demo",
  userId: "usr_fan_demo",
  orderId: "ord_demo",
  stripePaymentIntentId: null,
  clientSecret: null,
  amount: 128800,
  currency: "hkd",
  status: "PENDING",
  captureStatus: "NOT_CAPTURED",
  idempotencyKey: "ios-v4-payment-stable",
  createdAt,
  updatedAt,
};

const completedPayment: TestPayment = {
  ...incompletePayment,
  stripePaymentIntentId: "pi_demo",
  clientSecret: "pi_demo_secret_test",
  status: "requires_payment_method",
};

function verifiedPrivyUser(walletAddress: string) {
  const privyId = "did:privy:fan-demo";
  const privyWalletId = "wallet_privy_demo";
  return {
    privyId,
    walletAddress,
    privyWalletId,
    walletBindingStatus: "VERIFIED" as const,
    walletBindingVerifiedAt: new Date("2026-06-14T00:00:00.000Z"),
    walletBindingVersion: 1,
    walletBindingFingerprint: walletBindingFingerprint({
      privyId,
      walletId: privyWalletId,
      walletAddress,
    }),
  };
}

function attachMarketplaceTransactions<T extends Record<string, any>>(
  prisma: T,
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" = "PUBLISHED",
) {
  const tx = {
    ...prisma,
    $queryRaw: jest.fn(async () => [{ status }]),
  };
  Object.assign(prisma, {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  });
  return tx;
}

describe("PaymentsService", () => {
  const previousDataSource = process.env.FANPASS_DATA_SOURCE;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FANPASS_DATA_SOURCE = "prisma";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (previousDataSource === undefined) {
      delete process.env.FANPASS_DATA_SOURCE;
    } else {
      process.env.FANPASS_DATA_SOURCE = previousDataSource;
    }
  });

  function buildService(existingPayment: TestPayment) {
    const prisma = {
      order: {
        findUnique: jest.fn(async () => order),
      },
      payment: {
        findFirst: jest.fn(async () => existingPayment),
        update: jest.fn(async () => completedPayment),
      },
    };
    attachMarketplaceTransactions(prisma);
    const outbox = {
      markCompleted: jest.fn(),
      enqueue: jest.fn(async (_writer: unknown, input: any) => ({
        id: "sfx_payment_intent_create",
        type: input.type,
        status: "PENDING",
        idempotencyKey: input.idempotencyKey,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payloadJson: input.payload,
      })),
      captureDirectProviderMutationFence: jest.fn(async () => ({
        revision: 7n,
      })),
      assertDirectProviderMutationFenceCurrent: jest.fn(async () => undefined),
    };
    const audit = {
      record: jest.fn(),
    };
    const service = new PaymentsService(
      new ConfigService(),
      prisma as never,
      outbox as never,
      audit as never,
    );
    return { service, prisma, outbox, audit };
  }

  function buildCaptureService(
    input: {
      eventStatus?: "DRAFT" | "PUBLISHED" | "CANCELLED";
      resale?: boolean;
      ticket?: Record<string, unknown>;
      sellOrder?: Record<string, unknown>;
    } = {},
  ) {
    const ticketId = input.resale
      ? "tkt_capture_resale"
      : "tkt_capture_primary";
    const tradeId = input.resale ? "trd_capture_resale" : null;
    const captureOrder = {
      ...order,
      status: "SETTLED",
      ticketId: input.resale ? null : ticketId,
      fulfillmentMode: input.resale ? "RESALE_ONLY" : "PRIMARY_ONLY",
    };
    const payment = {
      ...completedPayment,
      id: input.resale ? "pay_capture_resale" : "pay_capture_primary",
      status: "requires_capture",
      captureStatus: "AUTHORIZED",
      order: captureOrder,
    };
    const ticket = {
      id: ticketId,
      tokenId: input.resale ? "42" : "41",
      eventId: captureOrder.eventId,
      ticketTypeId: captureOrder.ticketTypeId,
      ownerId: captureOrder.userId,
      status: input.resale ? "TRANSFERRED" : "ACTIVE",
      ...input.ticket,
    };
    const sellOrder = {
      id: "ord_capture_sell",
      eventId: captureOrder.eventId,
      ticketTypeId: captureOrder.ticketTypeId,
      ticketId,
      status: "SETTLED",
      ...input.sellOrder,
    };
    const trade = input.resale
      ? {
          id: tradeId,
          buyOrderId: captureOrder.id,
          sellOrderId: sellOrder.id,
          ticketId,
          settlementStatus: "SETTLED",
          sellOrder,
        }
      : null;
    const updatedPayment = {
      ...payment,
      status: "succeeded",
      captureStatus: "CAPTURED",
    };
    const tx = {
      $queryRaw: jest.fn(async () => [
        { status: input.eventStatus ?? "PUBLISHED" },
      ]),
      payment: {
        findUniqueOrThrow: jest.fn(async () => payment),
        update: jest.fn(async () => updatedPayment),
      },
      ticket: {
        findUnique: jest.fn(async () => ticket),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      trade: {
        findUnique: jest.fn(async () => trade),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      order: {
        updateMany: jest.fn(async () => ({ count: input.resale ? 2 : 1 })),
      },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const outbox = { enqueue: jest.fn(async () => ({})) };
    const onsaleInventory = { releaseOrderHold: jest.fn(async () => ({})) };
    const service = new PaymentsService(
      new ConfigService(),
      prisma as never,
      outbox as never,
      { record: jest.fn() } as never,
      undefined,
      onsaleInventory as never,
    );
    const provider = jest
      .spyOn(service as any, "captureProviderPaymentIntent")
      .mockResolvedValue({
        id: completedPayment.stripePaymentIntentId,
        clientSecret: completedPayment.clientSecret,
        status: "succeeded",
        captureStatus: "CAPTURED",
      });
    return {
      service,
      prisma,
      tx,
      outbox,
      onsaleInventory,
      provider,
      payment,
      ticket,
      ticketId,
      trade,
      tradeId,
    };
  }

  function buildSponsoredPollService(rawStatus: string) {
    const payer = "0x0000000000000000000000000000000000003000";
    const cryptoOrder = {
      ...order,
      fulfillmentMode: "PRIMARY_ONLY",
      user: verifiedPrivyUser(payer),
      event: { status: "PUBLISHED" },
    };
    const submission: Record<string, any> = {
      id: `scs_${rawStatus}`,
      paymentId: `pay_crypto_${rawStatus}`,
      requestKeyHash: "request_hash",
      providerIdempotencyKey: `crypto-${rawStatus}`,
      walletId: "wallet_privy_demo",
      walletAddress: payer,
      walletBindingVersion: 1,
      walletBindingFingerprint: cryptoOrder.user.walletBindingFingerprint,
      chainId: "11155111",
      tokenContractAddress: "0x0000000000000000000000000000000000001000",
      receiverAddress: "0x0000000000000000000000000000000000002000",
      amountAtomic: "1000000",
      tokenDecimals: 6,
      transactionData: "0x1234",
      status: "PROVIDER_ACCEPTED",
      leaseOwner: "lease_poll",
      leaseExpiresAt: new Date(Date.now() + 60_000),
      providerId: `privy_${rawStatus}`,
      transactionHash: null,
      ambiguityDeadlineAt: new Date(Date.now() + 60_000),
      submittedAt: new Date(),
      completedAt: null,
      lastErrorCode: null,
      attemptCount: 1,
      createdAt,
      updatedAt,
    };
    const cryptoPayment: Record<string, any> = {
      ...incompletePayment,
      id: submission.paymentId,
      currency: "usdc",
      status: "PENDING",
      captureStatus: "NOT_CAPTURED",
      sponsoredCryptoSubmission: null,
      order: cryptoOrder,
    };
    const applySubmissionUpdate = async ({
      data,
    }: {
      data: Record<string, any>;
    }) => {
      Object.assign(submission, data);
      cryptoPayment.sponsoredCryptoSubmission = submission;
      return submission;
    };
    const applyPaymentUpdate = async ({
      data,
    }: {
      data: Record<string, any>;
    }) => {
      Object.assign(cryptoPayment, data);
      return cryptoPayment;
    };
    const tx = {
      $queryRaw: jest.fn(async () => [{ status: "PUBLISHED" }]),
      sponsoredCryptoSubmission: { update: jest.fn(applySubmissionUpdate) },
      payment: { update: jest.fn(applyPaymentUpdate) },
      order: { updateMany: jest.fn(async () => ({ count: 1 })) },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    const prisma = {
      payment: { findUnique: jest.fn(async () => cryptoPayment) },
      sponsoredCryptoSubmission: {
        update: jest.fn(applySubmissionUpdate),
        updateMany: jest.fn(async ({ data }: { data: Record<string, any> }) => {
          await applySubmissionUpdate({ data });
          return { count: 1 };
        }),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const privyWallets = {
      resolveUserEmbeddedEthereumWallet: jest.fn(async () => ({
        walletId: submission.walletId,
        walletAddress: payer,
      })),
      sendSponsoredEthereumTransaction: jest.fn(),
      waitForTransactionHash: jest.fn(async () => ({
        hash: null,
        providerId: submission.providerId,
        rawStatus,
        userOperationHash: null,
      })),
    };
    const onsaleInventory = { releaseOrderHold: jest.fn(async () => ({})) };
    const audit = { record: jest.fn(async () => ({})) };
    const outbox = {
      enqueue: jest.fn(),
      captureDirectProviderMutationFence: jest.fn(async () => ({
        revision: 7n,
      })),
      assertDirectProviderMutationFenceCurrent: jest.fn(async () => undefined),
    };
    const service = new PaymentsService(
      new ConfigService(),
      prisma as never,
      outbox as never,
      audit as never,
      privyWallets as never,
      onsaleInventory as never,
    );
    jest.spyOn(service as any, "cryptoPaymentConfig").mockResolvedValue({});
    jest
      .spyOn(service as any, "assertSufficientUsdcBalance")
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, "assertSponsoredSubmissionMaySend")
      .mockResolvedValue(undefined);
    jest.spyOn(service as any, "cryptoQuoteForPayment").mockReturnValue({
      asset: "USDC",
      chainId: submission.chainId,
      tokenContractAddress: submission.tokenContractAddress,
      receiverAddress: submission.receiverAddress,
      amountAtomic: submission.amountAtomic,
      amountDecimal: "1.000000",
      decimals: 6,
      hkdRate: "7.8355",
      hkdRateSource: "test",
      hkdRateAsOf: null,
      hkdRateFetchedAt: createdAt.toISOString(),
      usdcUsdRate: "1.000000",
      usdcPegStatus: "stable",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      erc20TransferData: submission.transactionData,
    });
    const claim = jest
      .spyOn(service as any, "claimSponsoredCryptoSubmission")
      .mockImplementation(async () => ({
        kind: "POLL",
        submission,
        leaseOwner: "lease_poll",
      }));
    return {
      service,
      prisma,
      tx,
      privyWallets,
      onsaleInventory,
      audit,
      outbox,
      claim,
      cryptoPayment,
      submission,
    };
  }

  it("repairs an idempotent payment retry when the prior attempt did not persist a provider intent", async () => {
    const { service, prisma, outbox, audit } = buildService(incompletePayment);
    const createProviderPaymentIntent = jest
      .spyOn(service as any, "createProviderPaymentIntent")
      .mockImplementation(async (_payment, providerHooks: any) => {
        await providerHooks.beforeProviderSubmission();
        return {
          id: "pi_demo",
          clientSecret: "pi_demo_secret_test",
          status: "requires_payment_method",
          captureStatus: "NOT_CAPTURED",
        };
      });

    const payment = await service.createPaymentIntent(
      {
        orderId: "ord_demo",
        idempotencyKey: "ios-v4-payment-stable",
      },
      {
        userId: "usr_fan_demo",
        role: "FAN",
      } as never,
    );

    expect(payment.clientSecret).toBe("pi_demo_secret_test");
    expect(createProviderPaymentIntent).toHaveBeenCalledWith(
      incompletePayment,
      expect.objectContaining({
        beforeProviderSubmission: expect.any(Function),
      }),
    );
    expect(outbox.captureDirectProviderMutationFence).toHaveBeenCalledTimes(1);
    expect(
      outbox.assertDirectProviderMutationFenceCurrent,
    ).toHaveBeenCalledWith({ revision: 7n });
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "PAYMENT_INTENT_CREATE",
        idempotencyKey: "payment-intent-create:pay_demo",
        aggregateId: "pay_demo",
      }),
    );
    expect(outbox.enqueue.mock.invocationCallOrder[0]).toBeLessThan(
      outbox.captureDirectProviderMutationFence.mock.invocationCallOrder[0],
    );
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: {
        id: "pay_demo",
      },
      data: {
        stripePaymentIntentId: "pi_demo",
        clientSecret: "pi_demo_secret_test",
        status: "requires_payment_method",
        captureStatus: "NOT_CAPTURED",
      },
    });
    expect(outbox.markCompleted).toHaveBeenCalledWith(
      "payment-intent-create:pay_demo",
      expect.objectContaining({
        paymentId: "pay_demo",
        orderId: "ord_demo",
        eventId: "evt_demo",
        ticketTypeId: "tt_cat2_demo",
        stripePaymentIntentId: "pi_demo",
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      "usr_fan_demo",
      "PAYMENT_INTENT_REPAIRED",
      "payment",
      "pay_demo",
      expect.objectContaining({
        orderId: "ord_demo",
        stripePaymentIntentId: "pi_demo",
      }),
    );
  });

  it("returns a complete idempotent payment without creating another provider intent", async () => {
    const { service, prisma, outbox, audit } = buildService(completedPayment);
    const createProviderPaymentIntent = jest.spyOn(
      service as any,
      "createProviderPaymentIntent",
    );

    const payment = await service.createPaymentIntent(
      {
        orderId: "ord_demo",
        idempotencyKey: "ios-v4-payment-stable",
      },
      {
        userId: "usr_fan_demo",
        role: "FAN",
      } as never,
    );

    expect(payment.clientSecret).toBe("pi_demo_secret_test");
    expect(createProviderPaymentIntent).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(outbox.markCompleted).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(outbox.captureDirectProviderMutationFence).not.toHaveBeenCalled();
  });

  it("blocks direct Stripe creation when dispatch changes after admission", async () => {
    const { service, prisma, outbox } = buildService(incompletePayment);
    const stripeCreate = jest.fn();
    jest
      .spyOn(service as any, "stripeClient")
      .mockReturnValue({ paymentIntents: { create: stripeCreate } });
    outbox.assertDirectProviderMutationFenceCurrent.mockRejectedValue(
      new SideEffectDispatchFencedError(),
    );

    await expect(
      service.createPaymentIntent(
        {
          orderId: "ord_demo",
          idempotencyKey: "ios-v4-payment-stable",
        },
        {
          userId: "usr_fan_demo",
          role: "FAN",
        } as never,
      ),
    ).rejects.toMatchObject({ status: 503 });

    expect(outbox.captureDirectProviderMutationFence).toHaveBeenCalledTimes(1);
    expect(
      outbox.assertDirectProviderMutationFenceCurrent,
    ).toHaveBeenCalledWith({ revision: 7n });
    expect(stripeCreate).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(outbox.markCompleted).not.toHaveBeenCalled();
  });

  it("blocks direct Stripe reconciliation when dispatch changes after admission", async () => {
    const legacyIncomplete = {
      ...incompletePayment,
      stripePaymentIntentId: "pi_legacy_incomplete",
      clientSecret: null,
    };
    const { service, prisma, outbox } = buildService(legacyIncomplete);
    const stripeRetrieve = jest.fn();
    jest
      .spyOn(service as any, "stripeClient")
      .mockReturnValue({ paymentIntents: { retrieve: stripeRetrieve } });
    outbox.assertDirectProviderMutationFenceCurrent.mockRejectedValue(
      new SideEffectDispatchFencedError(),
    );

    await expect(
      service.createPaymentIntent(
        {
          orderId: "ord_demo",
          idempotencyKey: "ios-v4-payment-stable",
        },
        {
          userId: "usr_fan_demo",
          role: "FAN",
        } as never,
      ),
    ).rejects.toMatchObject({ status: 503 });

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.captureDirectProviderMutationFence).toHaveBeenCalledTimes(1);
    expect(stripeRetrieve).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(outbox.markCompleted).not.toHaveBeenCalled();
  });

  it.each(["PROCESSING", "DEAD"])(
    "fails closed before direct Stripe when the durable marker is %s",
    async (status) => {
      const { service, outbox } = buildService(incompletePayment);
      outbox.enqueue.mockImplementationOnce(
        async (_writer: unknown, input: any) => ({
          id: "sfx_payment_intent_unsafe",
          type: input.type,
          status,
          idempotencyKey: input.idempotencyKey,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          payloadJson: input.payload,
        }),
      );
      const provider = jest.spyOn(
        service as any,
        "createProviderPaymentIntent",
      );

      await expect(
        service.createPaymentIntent(
          {
            orderId: "ord_demo",
            idempotencyKey: "ios-v4-payment-stable",
          },
          {
            userId: "usr_fan_demo",
            role: "FAN",
          } as never,
        ),
      ).rejects.toMatchObject({ status: 503 });

      expect(outbox.captureDirectProviderMutationFence).not.toHaveBeenCalled();
      expect(provider).not.toHaveBeenCalled();
    },
  );

  it("fails closed before direct Stripe when the durable marker payload is inconsistent", async () => {
    const { service, outbox } = buildService(incompletePayment);
    outbox.enqueue.mockImplementationOnce(
      async (_writer: unknown, input: any) => ({
        id: "sfx_payment_intent_inconsistent",
        type: input.type,
        status: "PENDING",
        idempotencyKey: input.idempotencyKey,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payloadJson: { ...input.payload, paymentId: "pay_other" },
      }),
    );
    const provider = jest.spyOn(service as any, "createProviderPaymentIntent");

    await expect(
      service.createPaymentIntent(
        {
          orderId: "ord_demo",
          idempotencyKey: "ios-v4-payment-stable",
        },
        {
          userId: "usr_fan_demo",
          role: "FAN",
        } as never,
      ),
    ).rejects.toMatchObject({ status: 503 });

    expect(outbox.captureDirectProviderMutationFence).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it("rejects a crypto payment idempotency record before card provider admission", async () => {
    const { service, outbox } = buildService({
      ...incompletePayment,
      currency: "usdc",
    });
    const provider = jest.spyOn(service as any, "createProviderPaymentIntent");

    await expect(
      service.createPaymentIntent(
        {
          orderId: "ord_demo",
          idempotencyKey: "ios-v4-payment-stable",
        },
        {
          userId: "usr_fan_demo",
          role: "FAN",
        } as never,
      ),
    ).rejects.toThrow(
      "Idempotency key already belongs to a non-card payment request",
    );

    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(outbox.captureDirectProviderMutationFence).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it("rejects card authorization when the event is unpublished before any provider call", async () => {
    const prisma = {
      order: {
        findUnique: jest.fn(async () => ({
          ...order,
          event: { status: "DRAFT" },
        })),
      },
      payment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = new PaymentsService(
      new ConfigService(),
      prisma as never,
      { enqueue: jest.fn(), markCompleted: jest.fn() } as never,
      { record: jest.fn() } as never,
    );
    const provider = jest.spyOn(service as any, "createProviderPaymentIntent");

    await expect(
      service.createPaymentIntent(
        { orderId: order.id, idempotencyKey: "closed-card-payment" },
        { userId: order.userId, role: "FAN" } as never,
      ),
    ).rejects.toThrow("Event is not available for marketplace operations");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it("locks and rechecks publication before writing a payment", async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [{ status: "CANCELLED" }]),
      payment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      order: { findUnique: jest.fn(async () => order) },
      payment: { update: jest.fn() },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new PaymentsService(
      new ConfigService(),
      prisma as never,
      { enqueue: jest.fn(), markCompleted: jest.fn() } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.createPaymentIntent(
        { orderId: order.id, idempotencyKey: "race-closed-card-payment" },
        { userId: order.userId, role: "FAN" } as never,
      ),
    ).rejects.toThrow("Event is not available for marketplace operations");
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("cancels a card authorization instead of issuing when the on-sale hold is rejected", async () => {
    const authorizedPayment = {
      ...incompletePayment,
      stripePaymentIntentId: "pi_onsale_rejected",
      status: "requires_capture",
      captureStatus: "AUTHORIZED",
      paymentMethodFingerprintHash: "hashed_card_identity",
    };
    const tx = {
      $queryRaw: jest.fn(async () => [{ status: "PUBLISHED" }]),
      paymentWebhookEvent: {
        create: jest.fn(async () => ({ id: "pwe_onsale_rejected" })),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(async () => ({ ...incompletePayment, order })),
        update: jest.fn(async () => authorizedPayment),
      },
      order: {
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const outbox = {
      enqueue: jest.fn(),
      markCompleted: jest.fn(),
    };
    const audit = {
      record: jest.fn(),
    };
    const onsaleInventory = {
      authorizeOrderHold: jest.fn(async () => ({
        hasPrimaryHold: true,
        authorized: false,
        reason: "identity_limit",
      })),
    };
    const service = new PaymentsService(
      new ConfigService(),
      prisma as never,
      outbox as never,
      audit as never,
      undefined,
      onsaleInventory as never,
    );
    jest
      .spyOn(service as any, "paymentMethodFingerprintHashForIntent")
      .mockResolvedValue("hashed_card_identity");
    jest.spyOn(service as any, "constructWebhookEvent").mockReturnValue({
      id: "evt_onsale_rejected",
      type: "payment_intent.amount_capturable_updated",
      data: {
        object: {
          id: "pi_onsale_rejected",
          status: "requires_capture",
          latest_charge: "ch_onsale_rejected",
        },
      },
    });

    await service.handleWebhook(Buffer.alloc(0), undefined);

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED" }),
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: "PAYMENT_CANCEL_AUTHORIZATION",
        aggregateId: authorizedPayment.id,
      }),
    );
    expect(outbox.enqueue).not.toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: "ORDER_MATCH_AFTER_PAYMENT_AUTH" }),
    );
    expect(tx.paymentWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: "identity_limit" }),
      }),
    );
  });

  it("keeps a closed-event Stripe authorization fact and queues cancellation without matching", async () => {
    const authorizedPayment = {
      ...incompletePayment,
      stripePaymentIntentId: "pi_closed_event",
      status: "requires_capture",
      captureStatus: "AUTHORIZED",
    };
    const tx = {
      $queryRaw: jest.fn(async () => [{ status: "CANCELLED" }]),
      paymentWebhookEvent: {
        create: jest.fn(async () => ({ id: "pwe_closed_event" })),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(async () => ({ ...incompletePayment, order })),
        update: jest.fn(async () => authorizedPayment),
      },
      order: {
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const outbox = { enqueue: jest.fn(), markCompleted: jest.fn() };
    const service = new PaymentsService(
      new ConfigService(),
      prisma as never,
      outbox as never,
      { record: jest.fn() } as never,
    );
    jest.spyOn(service as any, "constructWebhookEvent").mockReturnValue({
      id: "evt_closed_event_authorized",
      type: "payment_intent.amount_capturable_updated",
      data: {
        object: { id: "pi_closed_event", status: "requires_capture" },
      },
    });

    await expect(
      service.handleWebhook(Buffer.alloc(0), undefined),
    ).resolves.toMatchObject({ received: true });
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ captureStatus: "AUTHORIZED" }),
      }),
    );
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ fulfillmentMode: "PRIMARY_ONLY" }),
        data: expect.objectContaining({ status: "REJECTED" }),
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: "PAYMENT_CANCEL_AUTHORIZATION",
        aggregateId: authorizedPayment.id,
      }),
    );
    expect(outbox.enqueue).not.toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: "ORDER_MATCH_AFTER_PAYMENT_AUTH" }),
    );
    expect(tx.paymentWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PROCESSED",
          reason: "event_not_published",
        }),
      }),
    );
  });

  it("creates a USDC crypto quote with ERC-20 transfer calldata", async () => {
    const cryptoPayment = {
      ...incompletePayment,
      id: "pay_crypto_demo",
      stripePaymentIntentId: null,
      clientSecret: null,
      currency: "usdc",
    };
    const prisma = {
      order: {
        findUnique: jest.fn(async () => order),
      },
      payment: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => cryptoPayment),
      },
    };
    attachMarketplaceTransactions(prisma);
    const service = new PaymentsService(
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.example.test",
        FANPASS_USDC_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        FANPASS_USDC_RECEIVER_ADDRESS:
          "0x0000000000000000000000000000000000002000",
        FANPASS_USDC_HKD_RATE: "7.8355",
        FANPASS_ALLOW_UNVERIFIED_USDC_RATE: "true",
      }),
      prisma as never,
      { enqueue: jest.fn(), markCompleted: jest.fn() } as never,
      { record: jest.fn() } as never,
    );

    const quote = await service.createCryptoQuote(
      {
        orderId: order.id,
        asset: "USDC",
        idempotencyKey: "ios-v4-crypto-payment-demo",
      },
      {
        userId: order.userId,
        role: "FAN",
      } as never,
    );

    expect(quote.payment).not.toHaveProperty("clientSecret");
    expect(quote.payment).not.toHaveProperty("stripePaymentIntentId");
    expect(quote.payment).not.toHaveProperty("idempotencyKey");

    expect(quote.payment.currency).toBe("usdc");
    expect(quote.quote.asset).toBe("USDC");
    expect(quote.quote.chainId).toBe("11155111");
    expect(quote.quote.tokenContractAddress).toBe(
      "0x0000000000000000000000000000000000001000",
    );
    expect(quote.quote.receiverAddress).toBe(
      "0x0000000000000000000000000000000000002000",
    );
    expect(quote.quote.amountAtomic).toMatch(/^[1-9][0-9]*$/);
    expect(quote.quote.erc20TransferData).toMatch(/^0xa9059cbb/);
  });

  it("rejects an unpublished event before fetching rates or persisting a USDC quote", async () => {
    const prisma = {
      order: {
        findUnique: jest.fn(async () => ({
          ...order,
          event: { status: "CANCELLED" },
        })),
      },
      payment: { findFirst: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(),
    };
    const fetchSpy = jest.spyOn(global, "fetch");
    const service = new PaymentsService(
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.example.test",
        FANPASS_USDC_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        FANPASS_USDC_RECEIVER_ADDRESS:
          "0x0000000000000000000000000000000000002000",
      }),
      prisma as never,
      { enqueue: jest.fn(), markCompleted: jest.fn() } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.createCryptoQuote(
        {
          orderId: order.id,
          asset: "USDC",
          idempotencyKey: "closed-crypto-quote",
        },
        { userId: order.userId, role: "FAN" } as never,
      ),
    ).rejects.toThrow("Event is not available for marketplace operations");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechecks event publication in the payment-intent worker", async () => {
    const prisma = {
      payment: {
        findUniqueOrThrow: jest.fn(async () => ({
          ...incompletePayment,
          order: {
            ...order,
            event: { status: "DRAFT" },
          },
        })),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = new PaymentsService(
      new ConfigService(),
      prisma as never,
      { enqueue: jest.fn(), markCompleted: jest.fn() } as never,
      { record: jest.fn() } as never,
    );
    const provider = jest.spyOn(service as any, "createProviderPaymentIntent");

    await expect(
      service.processCreateIntentJob(incompletePayment.id),
    ).rejects.toThrow("Event is not available for marketplace operations");
    expect(provider).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "captures only after the %s ticket ownership facts pass under the event lock",
    async (resale) => {
      const scenario = buildCaptureService({ resale });

      await expect(
        scenario.service.processCaptureJob(
          scenario.payment.id,
          scenario.tradeId,
          scenario.ticketId,
          `payment-capture:${scenario.payment.id}:${scenario.tradeId ?? `primary:${scenario.ticketId}`}`,
        ),
      ).resolves.toMatchObject({
        paymentId: scenario.payment.id,
        captureStatus: "CAPTURED",
      });

      expect(scenario.tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(scenario.provider).toHaveBeenCalledWith(
        scenario.payment,
        expect.stringContaining("payment-capture:"),
        10_000,
      );
      expect(scenario.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        scenario.provider.mock.invocationCallOrder[0],
      );
      expect(scenario.tx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: scenario.payment.id },
          data: { status: "succeeded", captureStatus: "CAPTURED" },
        }),
      );
      expect(scenario.outbox.enqueue).not.toHaveBeenCalled();
      expect(scenario.tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "PAYMENT_CAPTURED",
            metadataJson: expect.objectContaining({
              ticketId: scenario.ticketId,
              tradeId: scenario.tradeId,
            }),
          }),
        }),
      );
      if (resale) {
        expect(scenario.tx.trade.findUnique).toHaveBeenCalledWith({
          where: { id: scenario.tradeId },
          include: { sellOrder: true },
        });
      }
    },
  );

  it("blocks a delayed primary capture after the event closes and atomically starts compensation", async () => {
    const scenario = buildCaptureService({ eventStatus: "CANCELLED" });

    await expect(
      scenario.service.processCaptureJob(
        scenario.payment.id,
        null,
        scenario.ticketId,
        `payment-capture:${scenario.payment.id}:primary:${scenario.ticketId}`,
      ),
    ).resolves.toMatchObject({
      captureBlocked: true,
      compensationRequired: true,
      compensationReason: "event_not_published_before_capture",
    });

    expect(scenario.provider).not.toHaveBeenCalled();
    expect(scenario.tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["OPEN", "MATCHED", "SETTLED"] },
        }),
        data: { status: "REJECTED", remainingQuantity: 0 },
      }),
    );
    expect(scenario.tx.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } }),
    );
    expect(scenario.onsaleInventory.releaseOrderHold).toHaveBeenCalledWith(
      scenario.tx,
      scenario.payment.order.id,
      "event_not_published_before_capture",
      true,
    );
    expect(scenario.outbox.enqueue).toHaveBeenCalledWith(
      scenario.tx,
      expect.objectContaining({
        type: "PAYMENT_CANCEL_AUTHORIZATION",
        idempotencyKey: `payment-cancel:${scenario.payment.id}:event_not_published_before_capture`,
      }),
    );
  });

  it.each([
    [
      "missing token",
      { ticket: { tokenId: null } },
      "capture_ticket_token_missing",
    ],
    [
      "wrong owner",
      { ticket: { ownerId: "usr_attacker" } },
      "capture_ticket_order_mismatch",
    ],
    [
      "unsettled resale seller",
      { resale: true, sellOrder: { status: "MATCHED" } },
      "capture_trade_order_mismatch",
    ],
  ])(
    "fails closed before Stripe capture for %s",
    async (_label, overrides, expectedReason) => {
      const scenario = buildCaptureService(overrides as never);

      await expect(
        scenario.service.processCaptureJob(
          scenario.payment.id,
          scenario.tradeId,
          scenario.ticketId,
          `payment-capture:${scenario.payment.id}:integrity`,
        ),
      ).resolves.toMatchObject({
        captureBlocked: true,
        compensationReason: expectedReason,
      });
      expect(scenario.provider).not.toHaveBeenCalled();
      expect(scenario.outbox.enqueue).toHaveBeenCalledTimes(1);
    },
  );

  it("fails closed when independent USDC peg evidence is unavailable", async () => {
    const prisma = {
      order: {
        findUnique: jest.fn(async () => order),
      },
      payment: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({
          ...incompletePayment,
          id: "pay_crypto_no_peg_proof",
          stripePaymentIntentId: null,
          clientSecret: null,
          currency: "usdc",
        })),
      },
    };
    attachMarketplaceTransactions(prisma);
    const service = new PaymentsService(
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.example.test",
        FANPASS_USDC_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        FANPASS_USDC_RECEIVER_ADDRESS:
          "0x0000000000000000000000000000000000002000",
        FANPASS_USDC_HKD_RATE: "7.8355",
      }),
      prisma as never,
      { enqueue: jest.fn(), markCompleted: jest.fn() } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.createCryptoQuote(
        {
          orderId: order.id,
          asset: "USDC",
          idempotencyKey: "ios-v4-crypto-payment-no-peg-proof",
        },
        { userId: order.userId, role: "FAN" } as never,
      ),
    ).rejects.toThrow("peg verification could not be completed");
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("uses CoinGecko USDC/HKD market pricing when no configured USDC rate is provided", async () => {
    const cryptoPayment = {
      ...incompletePayment,
      id: "pay_crypto_coingecko_demo",
      stripePaymentIntentId: null,
      clientSecret: null,
      currency: "usdc",
    };
    const prisma = {
      order: {
        findUnique: jest.fn(async () => order),
      },
      payment: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => cryptoPayment),
      },
    };
    attachMarketplaceTransactions(prisma);
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        "usd-coin": {
          hkd: 7.84,
          usd: 0.999687,
          last_updated_at: 1782114288,
        },
      }),
    } as Response);
    const service = new PaymentsService(
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.example.test",
        FANPASS_USDC_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        FANPASS_USDC_RECEIVER_ADDRESS:
          "0x0000000000000000000000000000000000002000",
      }),
      prisma as never,
      { enqueue: jest.fn(), markCompleted: jest.fn() } as never,
      { record: jest.fn() } as never,
    );

    const quote = await service.createCryptoQuote(
      {
        orderId: order.id,
        asset: "USDC",
        idempotencyKey: "ios-v4-crypto-payment-coingecko",
      },
      {
        userId: order.userId,
        role: "FAN",
      } as never,
    );

    expect(quote.quote.hkdRate).toBe("7.8400");
    expect(quote.quote.hkdRateSource).toBe("coingecko:simple-price");
    expect(quote.quote.usdcUsdRate).toBe("0.999687");
    expect(quote.quote.usdcPegStatus).toBe("stable");
    expect(quote.quote.hkdRateAsOf).toBe("2026-06-22T07:44:48.000Z");
  });

  it("blocks USDC checkout when CoinGecko shows a severe USDC depeg", async () => {
    const cryptoPayment = {
      ...incompletePayment,
      id: "pay_crypto_depeg_demo",
      stripePaymentIntentId: null,
      clientSecret: null,
      currency: "usdc",
    };
    const prisma = {
      order: {
        findUnique: jest.fn(async () => order),
      },
      payment: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => cryptoPayment),
      },
    };
    attachMarketplaceTransactions(prisma);
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        "usd-coin": {
          hkd: 7.4,
          usd: 0.94,
          last_updated_at: 1782114288,
        },
      }),
    } as Response);
    const service = new PaymentsService(
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.example.test",
        FANPASS_USDC_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        FANPASS_USDC_RECEIVER_ADDRESS:
          "0x0000000000000000000000000000000000002000",
      }),
      prisma as never,
      { enqueue: jest.fn(), markCompleted: jest.fn() } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.createCryptoQuote(
        {
          orderId: order.id,
          asset: "USDC",
          idempotencyKey: "ios-v4-crypto-payment-depeg",
        },
        {
          userId: order.userId,
          role: "FAN",
        } as never,
      ),
    ).rejects.toThrow("USDC checkout is temporarily disabled");
  });

  it("confirms a Sepolia USDC transfer and enqueues order settlement", async () => {
    const payer = "0x0000000000000000000000000000000000003000";
    const receiver = "0x0000000000000000000000000000000000002000";
    const token = "0x0000000000000000000000000000000000001000";
    const transactionHash =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const cryptoPayment = {
      ...incompletePayment,
      id: "pay_crypto_demo",
      stripePaymentIntentId: null,
      clientSecret: null,
      currency: "usdc",
      order: {
        ...order,
        user: verifiedPrivyUser(payer),
      },
    };
    const updatedPayment = {
      ...cryptoPayment,
      stripePaymentIntentId: `crypto:${transactionHash}`,
      status: "crypto_confirmed",
      captureStatus: "CAPTURED",
    };
    const tx = {
      $queryRaw: jest.fn(async () => [{ status: "PUBLISHED" }]),
      payment: {
        update: jest.fn(async () => updatedPayment),
      },
      order: {
        updateMany: jest.fn(),
      },
      sponsoredCryptoSubmission: {
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    const prisma = {
      payment: {
        findUnique: jest.fn(async () => cryptoPayment),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const outbox = {
      enqueue: jest.fn(),
      markCompleted: jest.fn(),
    };
    const audit = {
      record: jest.fn(),
    };
    jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.method === "eth_getTransactionByHash") {
        return {
          ok: true,
          json: async () => ({
            result: {
              hash: transactionHash,
              from: "0x0000000000000000000000000000000000009999",
              to: token,
            },
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          result: {
            status: "0x1",
            blockNumber: "0x10",
            logs: [
              {
                address: token,
                topics: [
                  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
                  `0x${payer.slice(2).padStart(64, "0")}`,
                  `0x${receiver.slice(2).padStart(64, "0")}`,
                ],
                data: `0x${999999999999n.toString(16).padStart(64, "0")}`,
              },
            ],
          },
        }),
      } as Response;
    });
    const service = new PaymentsService(
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.example.test",
        FANPASS_USDC_CONTRACT_ADDRESS: token,
        FANPASS_USDC_RECEIVER_ADDRESS: receiver,
        FANPASS_USDC_HKD_RATE: "7.8355",
        FANPASS_ALLOW_UNVERIFIED_USDC_RATE: "true",
        FANPASS_ALLOW_MANUAL_CRYPTO_CONFIRMATION: "true",
      }),
      prisma as never,
      outbox as never,
      audit as never,
    );

    const result = await service.confirmCryptoPayment(
      {
        paymentId: cryptoPayment.id,
        transactionHash,
        idempotencyKey: "ios-v4-crypto-confirm-demo",
      },
      {
        userId: order.userId,
        role: "FAN",
      } as never,
    );

    expect(result.ok).toBe(true);
    expect(result.payment).not.toHaveProperty("clientSecret");
    expect(result.payment).not.toHaveProperty("stripePaymentIntentId");
    expect(result.payment).not.toHaveProperty("idempotencyKey");
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: cryptoPayment.id },
      data: {
        stripePaymentIntentId: `crypto:${transactionHash}`,
        status: "crypto_confirmed",
        captureStatus: "CAPTURED",
      },
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: "ORDER_MATCH_AFTER_PAYMENT_AUTH",
        aggregateId: order.id,
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      order.userId,
      "PAYMENT_WEBHOOK_APPLIED",
      "payment",
      cryptoPayment.id,
      expect.objectContaining({
        provider: "crypto",
        transactionHash,
        captureStatus: "CAPTURED",
      }),
    );
  });

  it("records a confirmed USDC fact for operations compensation when the event closes", async () => {
    const payer = "0x0000000000000000000000000000000000003000";
    const transactionHash =
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
    const cryptoPayment = {
      ...incompletePayment,
      id: "pay_crypto_closed_event",
      stripePaymentIntentId: null,
      currency: "usdc",
      order: {
        ...order,
        user: verifiedPrivyUser(payer),
      },
    };
    const compensatedPayment = {
      ...cryptoPayment,
      stripePaymentIntentId: `crypto:${transactionHash}`,
      status: "crypto_compensation_required",
      captureStatus: "CAPTURED",
    };
    const tx = {
      $queryRaw: jest.fn(async () => [{ status: "CANCELLED" }]),
      payment: { update: jest.fn(async () => compensatedPayment) },
      order: { updateMany: jest.fn(async () => ({ count: 1 })) },
      sponsoredCryptoSubmission: {
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      payment: { findUnique: jest.fn(async () => cryptoPayment) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const outbox = { enqueue: jest.fn() };
    const service = new PaymentsService(
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.example.test",
        FANPASS_USDC_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        FANPASS_USDC_RECEIVER_ADDRESS:
          "0x0000000000000000000000000000000000002000",
        FANPASS_USDC_HKD_RATE: "7.8355",
        FANPASS_ALLOW_UNVERIFIED_USDC_RATE: "true",
        FANPASS_ALLOW_MANUAL_CRYPTO_CONFIRMATION: "true",
      }),
      prisma as never,
      outbox as never,
      { record: jest.fn() } as never,
    );
    jest
      .spyOn(service as any, "assertConfirmedUsdcTransfer")
      .mockResolvedValue(undefined);

    const result = await service.confirmCryptoPayment(
      {
        paymentId: cryptoPayment.id,
        transactionHash,
        idempotencyKey: "closed-event-confirmed-usdc",
      },
      { userId: order.userId, role: "FAN" } as never,
    );

    expect(result).toMatchObject({
      ok: false,
      compensationRequired: true,
      compensationReason: "event_not_published",
      transactionHash,
    });
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "crypto_compensation_required",
          captureStatus: "CAPTURED",
        }),
      }),
    );
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED" }),
      }),
    );
    expect(tx.sponsoredCryptoSubmission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPENSATION_REQUIRED",
          transactionHash,
        }),
      }),
    );
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    ["confirm", "crypto_confirmed", "CAPTURED", null, true, false, false],
    ["send", "crypto_confirmed", "CAPTURED", null, true, false, false],
    [
      "confirm",
      "crypto_compensation_required",
      "CAPTURED",
      "COMPENSATION_REQUIRED",
      false,
      true,
      false,
    ],
    [
      "send",
      "crypto_compensation_required",
      "CAPTURED",
      "COMPENSATION_REQUIRED",
      false,
      true,
      false,
    ],
    ["confirm", "PENDING", "NOT_CAPTURED", "AMBIGUOUS", false, false, true],
    ["send", "PENDING", "NOT_CAPTURED", "AMBIGUOUS", false, false, true],
  ])(
    "returns the persisted crypto terminal state from %s without another provider action",
    async (
      endpoint,
      status,
      captureStatus,
      submissionStatus,
      expectedOk,
      expectedCompensation,
      expectedAmbiguous,
    ) => {
      const payer = "0x0000000000000000000000000000000000003000";
      const cryptoPayment = {
        ...incompletePayment,
        id: `pay_crypto_terminal_${endpoint}_${submissionStatus ?? "confirmed"}`,
        currency: "usdc",
        status,
        captureStatus,
        sponsoredCryptoSubmission: submissionStatus
          ? {
              status: submissionStatus,
              lastErrorCode:
                submissionStatus === "AMBIGUOUS"
                  ? "privy_provider_error"
                  : "event_not_published",
            }
          : null,
        order: {
          ...order,
          user: verifiedPrivyUser(payer),
          event: { status: "PUBLISHED" },
        },
      };
      const prisma = {
        payment: { findUnique: jest.fn(async () => cryptoPayment) },
      };
      const privyWallets = {
        sendSponsoredEthereumTransaction: jest.fn(),
        waitForTransactionHash: jest.fn(),
      };
      const service = new PaymentsService(
        new ConfigService(),
        prisma as never,
        { enqueue: jest.fn() } as never,
        { record: jest.fn() } as never,
        privyWallets as never,
      );
      const confirmRecord = jest.spyOn(
        service as any,
        "confirmCryptoPaymentRecord",
      );
      const fetchSpy = jest.spyOn(global, "fetch");

      const result =
        endpoint === "confirm"
          ? await service.confirmCryptoPayment(
              {
                paymentId: cryptoPayment.id,
                transactionHash:
                  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                idempotencyKey: `terminal-${endpoint}`,
              },
              { userId: order.userId, role: "FAN" } as never,
            )
          : await service.sendSponsoredCryptoPayment(
              {
                paymentId: cryptoPayment.id,
                idempotencyKey: `terminal-${endpoint}`,
              },
              { userId: order.userId, role: "FAN" } as never,
            );

      expect(result).toMatchObject({
        ok: expectedOk,
        compensationRequired: expectedCompensation,
        ...(expectedAmbiguous ? { ambiguous: true } : {}),
      });
      expect(confirmRecord).not.toHaveBeenCalled();
      expect(
        privyWallets.sendSponsoredEthereumTransaction,
      ).not.toHaveBeenCalled();
      expect(privyWallets.waitForTransactionHash).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each(["failed", "execution_reverted"])(
    "terminates sponsored payment on definitive Privy status %s and never resends",
    async (rawStatus) => {
      const scenario = buildSponsoredPollService(rawStatus);
      const request = {
        paymentId: scenario.cryptoPayment.id,
        idempotencyKey: `crypto-${rawStatus}`,
      };
      const session = { userId: order.userId, role: "FAN" } as never;

      await expect(
        scenario.service.sendSponsoredCryptoPayment(request, session),
      ).resolves.toMatchObject({
        ok: false,
        failed: true,
        retryableCheckout: true,
        failureReason: `privy_${rawStatus}`,
      });
      expect(scenario.tx.sponsoredCryptoSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "FAILED",
            lastErrorCode: `privy_${rawStatus}`,
          }),
        }),
      );
      expect(scenario.tx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "crypto_failed", captureStatus: "CANCELLED" },
        }),
      );
      expect(scenario.tx.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "REJECTED", remainingQuantity: 0 },
        }),
      );
      expect(scenario.onsaleInventory.releaseOrderHold).toHaveBeenCalledWith(
        scenario.tx,
        order.id,
        "sponsored_crypto_transaction_failed",
      );

      await expect(
        scenario.service.sendSponsoredCryptoPayment(request, session),
      ).resolves.toMatchObject({ ok: false, failed: true });
      expect(scenario.claim).toHaveBeenCalledTimes(1);
      expect(
        scenario.privyWallets.waitForTransactionHash,
      ).toHaveBeenCalledTimes(1);
      expect(
        scenario.privyWallets.sendSponsoredEthereumTransaction,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["failed", { failed: true }],
    ["provider_error", { ambiguous: true }],
  ])(
    "classifies initial Privy send status %s before any confirmation path",
    async (rawStatus, expectedTerminal) => {
      const scenario = buildSponsoredPollService(rawStatus);
      scenario.claim.mockResolvedValue({
        kind: "SEND",
        submission: scenario.submission,
        leaseOwner: "lease_send",
      });
      scenario.privyWallets.sendSponsoredEthereumTransaction.mockResolvedValue({
        hash: null,
        providerId: `privy_${rawStatus}`,
        rawStatus,
        userOperationHash: null,
      });
      const request = {
        paymentId: scenario.cryptoPayment.id,
        idempotencyKey: `crypto-${rawStatus}`,
      };
      const session = { userId: order.userId, role: "FAN" } as never;

      await expect(
        scenario.service.sendSponsoredCryptoPayment(request, session),
      ).resolves.toMatchObject({ ok: false, ...expectedTerminal });
      await expect(
        scenario.service.sendSponsoredCryptoPayment(request, session),
      ).resolves.toMatchObject({ ok: false, ...expectedTerminal });

      expect(
        scenario.privyWallets.sendSponsoredEthereumTransaction,
      ).toHaveBeenCalledTimes(1);
      expect(
        scenario.privyWallets.waitForTransactionHash,
      ).not.toHaveBeenCalled();
    },
  );

  it.each(["provider_error", "replaced"])(
    "marks Privy status %s ambiguous and never resends the old submission",
    async (rawStatus) => {
      const scenario = buildSponsoredPollService(rawStatus);
      const request = {
        paymentId: scenario.cryptoPayment.id,
        idempotencyKey: `crypto-${rawStatus}`,
      };
      const session = { userId: order.userId, role: "FAN" } as never;

      await expect(
        scenario.service.sendSponsoredCryptoPayment(request, session),
      ).resolves.toMatchObject({
        ok: false,
        ambiguous: true,
        ambiguityReason: `privy_${rawStatus}`,
      });
      expect(
        scenario.prisma.sponsoredCryptoSubmission.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "AMBIGUOUS",
            lastErrorCode: `privy_${rawStatus}`,
          }),
        }),
      );

      await expect(
        scenario.service.sendSponsoredCryptoPayment(request, session),
      ).resolves.toMatchObject({ ok: false, ambiguous: true });
      expect(scenario.claim).toHaveBeenCalledTimes(1);
      expect(
        scenario.privyWallets.waitForTransactionHash,
      ).toHaveBeenCalledTimes(1);
      expect(
        scenario.privyWallets.sendSponsoredEthereumTransaction,
      ).not.toHaveBeenCalled();
    },
  );

  it("blocks a Privy send and releases the durable lease when dispatch changes after admission", async () => {
    const scenario = buildSponsoredPollService("submitted");
    Object.assign(scenario.submission, {
      status: "SUBMITTING",
      providerId: null,
      leaseOwner: "lease_direct_fence",
    });
    scenario.claim.mockResolvedValue({
      kind: "SEND",
      submission: scenario.submission,
      leaseOwner: "lease_direct_fence",
    });
    scenario.outbox.assertDirectProviderMutationFenceCurrent.mockRejectedValue(
      new SideEffectDispatchFencedError(),
    );

    await expect(
      scenario.service.sendSponsoredCryptoPayment(
        {
          paymentId: scenario.cryptoPayment.id,
          idempotencyKey: "crypto-direct-fence-race",
        },
        { userId: order.userId, role: "FAN" } as never,
      ),
    ).rejects.toMatchObject({ status: 503 });

    expect(
      scenario.outbox.captureDirectProviderMutationFence,
    ).toHaveBeenCalledTimes(1);
    expect(
      scenario.outbox.assertDirectProviderMutationFenceCurrent,
    ).toHaveBeenCalledWith({ revision: 7n });
    expect(
      scenario.privyWallets.sendSponsoredEthereumTransaction,
    ).not.toHaveBeenCalled();
    expect(
      scenario.prisma.sponsoredCryptoSubmission.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: scenario.submission.id,
          leaseOwner: "lease_direct_fence",
          status: "SUBMITTING",
        }),
        data: expect.objectContaining({
          status: "RETRYABLE",
          leaseOwner: null,
          leaseExpiresAt: null,
        }),
      }),
    );
  });

  it("keeps pending Privy transactions poll-only across retries", async () => {
    const scenario = buildSponsoredPollService("pending");
    const request = {
      paymentId: scenario.cryptoPayment.id,
      idempotencyKey: "crypto-pending",
    };
    const session = { userId: order.userId, role: "FAN" } as never;

    await expect(
      scenario.service.sendSponsoredCryptoPayment(request, session),
    ).rejects.toThrow("Wallet payment is still processing");
    await expect(
      scenario.service.sendSponsoredCryptoPayment(request, session),
    ).rejects.toThrow("Wallet payment is still processing");

    expect(scenario.claim).toHaveBeenCalledTimes(2);
    expect(scenario.privyWallets.waitForTransactionHash).toHaveBeenCalledTimes(
      2,
    );
    expect(
      scenario.privyWallets.sendSponsoredEthereumTransaction,
    ).not.toHaveBeenCalled();
    expect(scenario.submission.status).toBe("PROVIDER_ACCEPTED");
  });

  it("sends a sponsored Sepolia USDC transfer through Privy and settles the order", async () => {
    jest.spyOn(Date, "now").mockReturnValue(2_000_000);
    const payer = "0x0000000000000000000000000000000000003000";
    const receiver = "0x0000000000000000000000000000000000002000";
    const token = "0x0000000000000000000000000000000000001000";
    const transactionHash =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const cryptoPayment = {
      ...incompletePayment,
      id: "pay_crypto_sponsored_demo",
      stripePaymentIntentId: null,
      clientSecret: null,
      currency: "usdc",
      order: {
        ...order,
        user: verifiedPrivyUser(payer),
      },
    };
    const updatedPayment = {
      ...cryptoPayment,
      stripePaymentIntentId: `crypto:${transactionHash}`,
      status: "crypto_confirmed",
      captureStatus: "CAPTURED",
    };
    let submission: Record<string, any> | null = null;
    const sponsoredCryptoSubmission = {
      findUnique: jest.fn(async () => submission),
      findUniqueOrThrow: jest.fn(async () => submission),
      create: jest.fn(async ({ data }: { data: Record<string, any> }) => {
        submission = {
          providerId: null,
          transactionHash: null,
          submittedAt: null,
          completedAt: null,
          lastErrorCode: null,
          createdAt,
          updatedAt,
          ...data,
        };
        return submission;
      }),
      update: jest.fn(
        async ({ data }: { data: Record<string, any> }) =>
          (submission = { ...submission, ...data, updatedAt }),
      ),
      updateMany: jest.fn(async ({ data }: { data: Record<string, any> }) => {
        submission = { ...submission, ...data, updatedAt };
        return { count: 1 };
      }),
    };
    const tx = {
      $queryRaw: jest.fn(async () => [{ status: "PUBLISHED" }]),
      payment: {
        update: jest.fn(async () => updatedPayment),
        findUniqueOrThrow: jest.fn(async () => cryptoPayment),
      },
      order: {
        updateMany: jest.fn(),
      },
      sponsoredCryptoSubmission,
      auditLog: {
        create: jest.fn(),
      },
    };
    const prisma = {
      payment: {
        findUnique: jest.fn(async () => cryptoPayment),
      },
      sponsoredCryptoSubmission,
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const outbox = {
      enqueue: jest.fn(),
      markCompleted: jest.fn(),
      captureDirectProviderMutationFence: jest.fn(async () => ({
        revision: 7n,
      })),
      assertDirectProviderMutationFenceCurrent: jest.fn(async () => undefined),
    };
    const audit = {
      record: jest.fn(),
    };
    const privyWallets = {
      resolveUserEmbeddedEthereumWallet: jest.fn(async () => ({
        walletId: "wallet_privy_demo",
        walletAddress: payer,
      })),
      sendSponsoredEthereumTransaction: jest.fn(async () => ({
        hash: transactionHash,
        providerId: "privy_tx_demo",
        rawStatus: "submitted",
        userOperationHash: null,
      })),
      waitForTransactionHash: jest.fn(),
    };
    jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.method === "eth_call") {
        return {
          ok: true,
          json: async () => ({
            result: `0x${999999999999n.toString(16)}`,
          }),
        } as Response;
      }
      if (body.method === "eth_getTransactionByHash") {
        return {
          ok: true,
          json: async () => ({
            result: {
              hash: transactionHash,
              from: "0x0000000000000000000000000000000000009999",
              to: token,
            },
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          result: {
            status: "0x1",
            blockNumber: "0x20",
            logs: [
              {
                address: token,
                topics: [
                  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
                  `0x${payer.slice(2).padStart(64, "0")}`,
                  `0x${receiver.slice(2).padStart(64, "0")}`,
                ],
                data: `0x${999999999999n.toString(16).padStart(64, "0")}`,
              },
            ],
          },
        }),
      } as Response;
    });
    const service = new PaymentsService(
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.example.test",
        FANPASS_USDC_CONTRACT_ADDRESS: token,
        FANPASS_USDC_RECEIVER_ADDRESS: receiver,
        FANPASS_USDC_HKD_RATE: "7.8355",
        FANPASS_ALLOW_UNVERIFIED_USDC_RATE: "true",
      }),
      prisma as never,
      outbox as never,
      audit as never,
      privyWallets as never,
    );

    const result = await service.sendSponsoredCryptoPayment(
      {
        paymentId: cryptoPayment.id,
        idempotencyKey: "ios-v4-crypto-sponsored-demo",
        privyAccessToken: "privy.jwt.fixture",
        privyAuthorizationSignature: "clientSignatureFixture==",
        privyRequestExpiry: 2_060_000,
      },
      {
        userId: order.userId,
        role: "FAN",
      } as never,
    );

    expect(result.ok).toBe(true);
    expect("transactionHash" in result ? result.transactionHash : null).toBe(
      transactionHash,
    );
    expect(privyWallets.resolveUserEmbeddedEthereumWallet).toHaveBeenCalledWith(
      {
        privyUserId: "did:privy:fan-demo",
        walletId: "wallet_privy_demo",
        walletAddress: payer,
      },
    );
    expect(outbox.captureDirectProviderMutationFence).toHaveBeenCalledTimes(1);
    expect(
      outbox.assertDirectProviderMutationFenceCurrent,
    ).toHaveBeenCalledWith({ revision: 7n });
    expect(
      outbox.assertDirectProviderMutationFenceCurrent.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      privyWallets.sendSponsoredEthereumTransaction.mock.invocationCallOrder[0],
    );
    expect(privyWallets.sendSponsoredEthereumTransaction).toHaveBeenCalledWith({
      walletId: "wallet_privy_demo",
      caip2: "eip155:11155111",
      idempotencyKey: "ios-v4-crypto-sponsored-demo",
      userJwt: "privy.jwt.fixture",
      userAuthorizationSignature: "clientSignatureFixture==",
      requestExpiry: 2_060_000,
      transaction: expect.objectContaining({
        to: token,
        value: "0x0",
      }),
    });
    expect(submission).toEqual(
      expect.objectContaining({
        paymentId: cryptoPayment.id,
        providerIdempotencyKey: "ios-v4-crypto-sponsored-demo",
        requestKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        providerId: "privy_tx_demo",
        transactionHash,
        status: "CONFIRMED",
      }),
    );
    expect(submission).not.toHaveProperty("privyAccessToken");
    expect(submission).not.toHaveProperty("privyAuthorizationSignature");
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: cryptoPayment.id },
      data: {
        stripePaymentIntentId: `crypto:${transactionHash}`,
        status: "crypto_confirmed",
        captureStatus: "CAPTURED",
      },
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: "ORDER_MATCH_AFTER_PAYMENT_AUTH",
        aggregateId: order.id,
      }),
    );
  });

  it("admits one sponsored sender, reuses the client-signed provider key, and fails closed after the safe window", async () => {
    const payer = "0x0000000000000000000000000000000000003000";
    const payment = {
      ...incompletePayment,
      id: "pay_sponsored_claim",
      currency: "usdc",
      order: {
        ...order,
        user: verifiedPrivyUser(payer),
      },
    };
    let submission: Record<string, any> | null = null;
    const updateSubmission = (data: Record<string, any>) => {
      const next = { ...(submission ?? {}) } as Record<string, any>;
      for (const [key, value] of Object.entries(data)) {
        next[key] =
          value &&
          typeof value === "object" &&
          "increment" in (value as Record<string, unknown>)
            ? Number(next[key] ?? 0) + Number((value as any).increment)
            : value;
      }
      submission = next;
      return submission;
    };
    const delegate = {
      findUnique: jest.fn(async () => submission),
      create: jest.fn(async ({ data }: { data: Record<string, any> }) => {
        submission = {
          providerId: null,
          transactionHash: null,
          submittedAt: null,
          completedAt: null,
          lastErrorCode: null,
          createdAt,
          updatedAt,
          ...data,
        };
        return submission;
      }),
      update: jest.fn(async ({ data }: { data: Record<string, any> }) =>
        updateSubmission(data),
      ),
    };
    const tx = {
      $queryRaw: jest.fn(async () => [{ status: "PUBLISHED" }]),
      sponsoredCryptoSubmission: delegate,
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new PaymentsService(
      new ConfigService({
        FANPASS_ONSALE_QUEUE_SECRET:
          "fanpass-test-payment-idempotency-secret-00000000",
      }),
      prisma as never,
      { enqueue: jest.fn() } as never,
      { record: jest.fn() } as never,
    );
    const claimInput = {
      payment,
      idempotencyKey: "client-signed-idempotency-key",
      walletId: "wallet_privy_demo",
      walletAddress: payer,
      walletBindingVersion: 1,
      walletBindingFingerprint: payment.order.user.walletBindingFingerprint,
      quote: {
        asset: "USDC",
        chainId: "11155111",
        tokenContractAddress: "0x0000000000000000000000000000000000001000",
        receiverAddress: "0x0000000000000000000000000000000000002000",
        amountAtomic: "1000000",
        amountDecimal: "1",
        decimals: 6,
        hkdRate: "7.8",
        hkdRateSource: "test",
        hkdRateAsOf: null,
        hkdRateFetchedAt: createdAt.toISOString(),
        usdcUsdRate: "1",
        usdcPegStatus: "stable",
        expiresAt: updatedAt.toISOString(),
        erc20TransferData: "0xa9059cbbfixture",
      },
    };

    const first = await (service as any).claimSponsoredCryptoSubmission(
      claimInput,
    );
    const concurrent = await (service as any).claimSponsoredCryptoSubmission(
      claimInput,
    );
    expect(first.kind).toBe("SEND");
    expect(concurrent.kind).toBe("WAIT");
    expect(delegate.create).toHaveBeenCalledTimes(1);
    expect(submission).toEqual(
      expect.objectContaining({
        providerIdempotencyKey: "client-signed-idempotency-key",
        requestKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        attemptCount: 1,
      }),
    );

    await expect(
      (service as any).claimSponsoredCryptoSubmission({
        ...claimInput,
        idempotencyKey: "different-key",
      }),
    ).rejects.toThrow(
      "A different payment request is already bound to this USDC quote",
    );

    submission = {
      ...(submission ?? {}),
      status: "RETRYABLE",
      leaseOwner: null,
      leaseExpiresAt: null,
      ambiguityDeadlineAt: new Date(0),
    };
    const expired = await (service as any).claimSponsoredCryptoSubmission(
      claimInput,
    );
    expect(expired.kind).toBe("AMBIGUOUS");
    expect(submission).toEqual(
      expect.objectContaining({
        status: "AMBIGUOUS",
        lastErrorCode: "provider_idempotency_window_expired",
      }),
    );
  });

  it("rejects arbitrary manual transaction hashes in production-like environments", async () => {
    const payer = "0x0000000000000000000000000000000000003000";
    const cryptoPayment = {
      ...incompletePayment,
      id: "pay_crypto_manual_blocked",
      stripePaymentIntentId: null,
      currency: "usdc",
      order: {
        ...order,
        user: verifiedPrivyUser(payer),
      },
    };
    const prisma = {
      payment: {
        findUnique: jest.fn(async () => cryptoPayment),
      },
    };
    const fetchSpy = jest.spyOn(global, "fetch");
    const service = new PaymentsService(
      new ConfigService({
        NODE_ENV: "production",
        FANPASS_ENV: "staging",
      }),
      prisma as never,
      { enqueue: jest.fn() } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.confirmCryptoPayment(
        {
          paymentId: cryptoPayment.id,
          transactionHash:
            "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          idempotencyKey: "manual-production-blocked",
        },
        { userId: order.userId, role: "FAN" } as never,
      ),
    ).rejects.toThrow("Manual USDC transaction confirmation is unavailable");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects sponsored USDC payment before Privy when wallet balance is too low", async () => {
    const payer = "0x0000000000000000000000000000000000003000";
    const receiver = "0x0000000000000000000000000000000000002000";
    const token = "0x0000000000000000000000000000000000001000";
    const cryptoPayment = {
      ...incompletePayment,
      id: "pay_crypto_sponsored_low_balance",
      stripePaymentIntentId: null,
      clientSecret: null,
      currency: "usdc",
      order: {
        ...order,
        user: verifiedPrivyUser(payer),
      },
    };
    const prisma = {
      payment: {
        findUnique: jest.fn(async () => cryptoPayment),
      },
    };
    const outbox = {
      enqueue: jest.fn(),
      markCompleted: jest.fn(),
    };
    const audit = {
      record: jest.fn(),
    };
    const privyWallets = {
      resolveUserEmbeddedEthereumWallet: jest.fn(async () => ({
        walletId: "wallet_privy_demo",
        walletAddress: payer,
      })),
      sendSponsoredEthereumTransaction: jest.fn(),
      waitForTransactionHash: jest.fn(),
    };
    jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.method).toBe("eth_call");
      return {
        ok: true,
        json: async () => ({
          result: "0x0",
        }),
      } as Response;
    });
    const service = new PaymentsService(
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.example.test",
        FANPASS_USDC_CONTRACT_ADDRESS: token,
        FANPASS_USDC_RECEIVER_ADDRESS: receiver,
        FANPASS_USDC_HKD_RATE: "7.8355",
        FANPASS_ALLOW_UNVERIFIED_USDC_RATE: "true",
      }),
      prisma as never,
      outbox as never,
      audit as never,
      privyWallets as never,
    );
    jest
      .spyOn(service as any, "claimSponsoredCryptoSubmission")
      .mockImplementation(async (input: any) => ({
        kind: "SEND",
        leaseOwner: "lease_low_balance",
        submission: {
          id: "scs_low_balance",
          paymentId: input.payment.id,
          providerIdempotencyKey: input.idempotencyKey,
          walletId: input.walletId,
          walletAddress: input.walletAddress,
          walletBindingVersion: input.walletBindingVersion,
          walletBindingFingerprint: input.walletBindingFingerprint,
          chainId: input.quote.chainId,
          tokenContractAddress: input.quote.tokenContractAddress,
          receiverAddress: input.quote.receiverAddress,
          amountAtomic: input.quote.amountAtomic,
          tokenDecimals: input.quote.decimals,
          transactionData: input.quote.erc20TransferData,
        },
      }));

    await expect(
      service.sendSponsoredCryptoPayment(
        {
          paymentId: cryptoPayment.id,
          idempotencyKey: "ios-v4-crypto-sponsored-low-balance",
        },
        {
          userId: order.userId,
          role: "FAN",
        } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        result: "INSUFFICIENT_USDC_BALANCE",
        message:
          "Your FanPass wallet does not have enough USDC for this order.",
      },
      status: 400,
    });
    expect(
      privyWallets.sendSponsoredEthereumTransaction,
    ).not.toHaveBeenCalled();
  });

  it("maps Privy sponsored wallet authorization failures to payment-unavailable copy", async () => {
    const payer = "0x0000000000000000000000000000000000003000";
    const receiver = "0x0000000000000000000000000000000000002000";
    const token = "0x0000000000000000000000000000000000001000";
    const cryptoPayment = {
      ...incompletePayment,
      id: "pay_crypto_sponsored_auth_error",
      stripePaymentIntentId: null,
      clientSecret: null,
      currency: "usdc",
      order: {
        ...order,
        user: verifiedPrivyUser(payer),
      },
    };
    const prisma = {
      payment: {
        findUnique: jest.fn(async () => cryptoPayment),
      },
      sponsoredCryptoSubmission: {
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
    };
    const outbox = {
      enqueue: jest.fn(),
      markCompleted: jest.fn(),
      captureDirectProviderMutationFence: jest.fn(async () => ({
        revision: 7n,
      })),
      assertDirectProviderMutationFenceCurrent: jest.fn(async () => undefined),
    };
    const audit = {
      record: jest.fn(),
    };
    const privyWallets = {
      resolveUserEmbeddedEthereumWallet: jest.fn(async () => ({
        walletId: "wallet_privy_demo",
        walletAddress: payer,
      })),
      sendSponsoredEthereumTransaction: jest.fn(async () => {
        throw new Error(
          "No valid authorization keys or user signing keys available",
        );
      }),
      waitForTransactionHash: jest.fn(),
    };
    jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.method).toBe("eth_call");
      return {
        ok: true,
        json: async () => ({
          result: `0x${999999999999n.toString(16)}`,
        }),
      } as Response;
    });
    const service = new PaymentsService(
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.example.test",
        FANPASS_USDC_CONTRACT_ADDRESS: token,
        FANPASS_USDC_RECEIVER_ADDRESS: receiver,
        FANPASS_USDC_HKD_RATE: "7.8355",
        FANPASS_ALLOW_UNVERIFIED_USDC_RATE: "true",
      }),
      prisma as never,
      outbox as never,
      audit as never,
      privyWallets as never,
    );
    jest
      .spyOn(service as any, "claimSponsoredCryptoSubmission")
      .mockImplementation(async (input: any) => ({
        kind: "SEND",
        leaseOwner: "lease_auth_error",
        submission: {
          id: "scs_auth_error",
          paymentId: input.payment.id,
          providerIdempotencyKey: input.idempotencyKey,
          walletId: input.walletId,
          walletAddress: input.walletAddress,
          walletBindingVersion: input.walletBindingVersion,
          walletBindingFingerprint: input.walletBindingFingerprint,
          chainId: input.quote.chainId,
          tokenContractAddress: input.quote.tokenContractAddress,
          receiverAddress: input.quote.receiverAddress,
          amountAtomic: input.quote.amountAtomic,
          tokenDecimals: input.quote.decimals,
          transactionData: input.quote.erc20TransferData,
        },
      }));
    jest
      .spyOn(service as any, "assertSponsoredSubmissionMaySend")
      .mockResolvedValue(undefined);

    await expect(
      service.sendSponsoredCryptoPayment(
        {
          paymentId: cryptoPayment.id,
          idempotencyKey: "ios-v4-crypto-sponsored-auth-error",
        },
        {
          userId: order.userId,
          role: "FAN",
        } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        message:
          "Wallet payment is temporarily unavailable. Try card payment or try again later.",
      },
      status: 503,
    });
    expect(privyWallets.sendSponsoredEthereumTransaction).toHaveBeenCalled();
    expect(privyWallets.waitForTransactionHash).not.toHaveBeenCalled();
  });
});
