import { ConfigService } from "@nestjs/config";
import { walletBindingFingerprint } from "../src/common/wallet-binding";
import { PrismaService } from "../src/common/prisma.service";
import { PaymentsService } from "../src/modules/payments/payments.service";

const runDatabaseTests = process.env.FANPASS_RUN_DATABASE_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;

describeDatabase("sponsored USDC PostgreSQL concurrency invariants", () => {
  const prisma = new PrismaService();
  const service = new PaymentsService(
    new ConfigService({
      FANPASS_ONSALE_QUEUE_SECRET:
        "fanpass-test-payment-concurrency-secret-0000000000",
    }),
    prisma,
    { enqueue: jest.fn(), markCompleted: jest.fn() } as never,
    { record: jest.fn() } as never,
  );
  const userId = "usr_payment_concurrency";
  const organizerId = "org_payment_concurrency";
  const venueId = "venue_payment_concurrency";
  const eventId = "evt_payment_concurrency";
  const ticketTypeId = "tt_payment_concurrency";
  const orderId = "ord_payment_concurrency";
  const paymentId = "pay_payment_concurrency";
  const privyId = "did:privy:payment-concurrency";
  const walletId = "wallet_payment_concurrency";
  const walletAddress = "0x0000000000000000000000000000000000003000";
  const bindingFingerprint = walletBindingFingerprint({
    privyId,
    walletId,
    walletAddress,
  });

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanup();
    await seedPayment();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("admits exactly one sender for simultaneous requests", async () => {
    const input = await claimInput();
    const [first, second] = await Promise.all([
      (service as any).claimSponsoredCryptoSubmission(input),
      (service as any).claimSponsoredCryptoSubmission(input),
    ]);

    expect([first.kind, second.kind].sort()).toEqual(["SEND", "WAIT"]);
    expect(
      await prisma.sponsoredCryptoSubmission.count({
        where: { paymentId },
      }),
    ).toBe(1);
    await expect(
      prisma.sponsoredCryptoSubmission.findUniqueOrThrow({
        where: { paymentId },
        select: {
          providerIdempotencyKey: true,
          requestKeyHash: true,
          attemptCount: true,
        },
      }),
    ).resolves.toMatchObject({
      providerIdempotencyKey: "ios-concurrent-sponsored-payment",
      requestKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      attemptCount: 1,
    });
  });

  it("polls a durable provider checkpoint after closure instead of resending", async () => {
    const input = await claimInput();
    const first = await (service as any).claimSponsoredCryptoSubmission(input);
    expect(first.kind).toBe("SEND");
    await prisma.sponsoredCryptoSubmission.update({
      where: { paymentId },
      data: {
        status: "PROVIDER_ACCEPTED",
        providerId: "privy_provider_payment_concurrency",
        leaseOwner: null,
        leaseExpiresAt: null,
        ambiguityDeadlineAt: new Date(0),
      },
    });
    await prisma.event.update({
      where: { id: eventId },
      data: { status: "CANCELLED" },
    });

    await expect(
      (service as any).claimSponsoredCryptoSubmission(input),
    ).resolves.toMatchObject({
      kind: "POLL",
      submission: {
        providerId: "privy_provider_payment_concurrency",
      },
    });
    await expect(
      prisma.sponsoredCryptoSubmission.findUniqueOrThrow({
        where: { paymentId },
        select: { attemptCount: true },
      }),
    ).resolves.toEqual({ attemptCount: 1 });
  });

  async function claimInput() {
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            user: true,
            event: { select: { status: true } },
          },
        },
      },
    });
    return {
      payment,
      idempotencyKey: "ios-concurrent-sponsored-payment",
      walletId,
      walletAddress,
      walletBindingVersion: 1,
      walletBindingFingerprint: bindingFingerprint,
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
        hkdRateFetchedAt: new Date().toISOString(),
        usdcUsdRate: "1",
        usdcPegStatus: "stable",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        erc20TransferData:
          "0xa9059cbb000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000f4240",
      },
    };
  }

  async function seedPayment() {
    await prisma.user.create({
      data: {
        id: userId,
        name: "Payment concurrency fan",
        email: "payment-concurrency@fanpass.test",
        privyId,
        privyWalletId: walletId,
        walletAddress,
        walletBindingStatus: "VERIFIED",
        walletBindingVerifiedAt: new Date(),
        walletBindingVersion: 1,
        walletBindingFingerprint: bindingFingerprint,
      },
    });
    await prisma.organizer.create({
      data: {
        id: organizerId,
        userId,
        organizationName: "Payment concurrency organizer",
      },
    });
    await prisma.venue.create({
      data: {
        id: venueId,
        name: "Payment concurrency venue",
        country: "US",
        city: "New York",
        address: "1 Test Way",
        timezone: "America/New_York",
        capacity: 10,
      },
    });
    await prisma.event.create({
      data: {
        id: eventId,
        organizerId,
        venueId,
        title: "Payment concurrency event",
        startTime: new Date(Date.now() + 86_400_000),
        endTime: new Date(Date.now() + 90_000_000),
        status: "PUBLISHED",
      },
    });
    await prisma.ticketType.create({
      data: {
        id: ticketTypeId,
        eventId,
        name: "General admission",
        faceValue: 100,
        currency: "HKD",
        supply: 10,
      },
    });
    await prisma.order.create({
      data: {
        id: orderId,
        userId,
        eventId,
        ticketTypeId,
        side: "BUY",
        fulfillmentMode: "ANY",
        price: 100,
      },
    });
    await prisma.payment.create({
      data: {
        id: paymentId,
        userId,
        orderId,
        amount: 10_000,
        currency: "usdc",
        status: "PENDING",
        captureStatus: "NOT_CAPTURED",
      },
    });
  }

  async function cleanup() {
    await prisma.sponsoredCryptoSubmission.deleteMany({
      where: { paymentId },
    });
    await prisma.payment.deleteMany({ where: { id: paymentId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.ticketType.deleteMany({ where: { id: ticketTypeId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.venue.deleteMany({ where: { id: venueId } });
    await prisma.organizer.deleteMany({ where: { id: organizerId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});
