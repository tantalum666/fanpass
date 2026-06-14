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
});
