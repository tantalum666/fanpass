import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "../src/modules/payments/payments.service";

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
      $transaction: jest.fn(),
    };
    const outbox = {
      markCompleted: jest.fn(),
      enqueue: jest.fn(),
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

  it("repairs an idempotent payment retry when the prior attempt did not persist a provider intent", async () => {
    const { service, prisma, outbox, audit } = buildService(incompletePayment);
    const createProviderPaymentIntent = jest
      .spyOn(service as any, "createProviderPaymentIntent")
      .mockResolvedValue({
        id: "pi_demo",
        clientSecret: "pi_demo_secret_test",
        status: "requires_payment_method",
        captureStatus: "NOT_CAPTURED",
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

  it("uses the HKMA USD/HKD reference rate when no configured USDC rate is provided", async () => {
    const cryptoPayment = {
      ...incompletePayment,
      id: "pay_crypto_hkma_demo",
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
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        header: { success: true },
        result: {
          records: [
            {
              end_of_day: "2026-05-30",
              usd: 7.8385,
            },
          ],
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
        idempotencyKey: "ios-v4-crypto-payment-hkma",
      },
      {
        userId: order.userId,
        role: "FAN",
      } as never,
    );

    expect(quote.quote.hkdRate).toBe("7.8385");
    expect(quote.quote.hkdRateSource).toBe("hkma:er-eeri-daily");
    expect(quote.quote.hkdRateAsOf).toBe("2026-05-30");
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
        user: {
          walletAddress: payer,
          privyWalletId: null,
        },
      },
    };
    const updatedPayment = {
      ...cryptoPayment,
      stripePaymentIntentId: `crypto:${transactionHash}`,
      status: "crypto_confirmed",
      captureStatus: "CAPTURED",
    };
    const tx = {
      payment: {
        update: jest.fn(async () => updatedPayment),
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
              from: payer,
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
                data: `0x${(999999999999n).toString(16).padStart(64, "0")}`,
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

  it("sends a sponsored Sepolia USDC transfer through Privy and settles the order", async () => {
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
        user: {
          walletAddress: payer,
          privyWalletId: "wallet_privy_demo",
        },
      },
    };
    const updatedPayment = {
      ...cryptoPayment,
      stripePaymentIntentId: `crypto:${transactionHash}`,
      status: "crypto_confirmed",
      captureStatus: "CAPTURED",
    };
    const tx = {
      payment: {
        update: jest.fn(async () => updatedPayment),
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
    const privyWallets = {
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
      if (body.method === "eth_getTransactionByHash") {
        return {
          ok: true,
          json: async () => ({
            result: {
              hash: transactionHash,
              from: payer,
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
                data: `0x${(999999999999n).toString(16).padStart(64, "0")}`,
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
    expect(privyWallets.sendSponsoredEthereumTransaction).toHaveBeenCalledWith({
      walletId: "wallet_privy_demo",
      caip2: "eip155:11155111",
      transaction: expect.objectContaining({
        to: token,
        value: "0x0",
      }),
    });
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
});
