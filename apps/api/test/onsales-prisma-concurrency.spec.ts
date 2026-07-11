import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../src/common/prisma.service";
import { OnsaleInventoryService } from "../src/modules/onsales/onsale-inventory.service";
import { OnsalesService } from "../src/modules/onsales/onsales.service";

const runDatabaseTests = process.env.FANPASS_RUN_DATABASE_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;

describeDatabase("on-sale PostgreSQL concurrency invariants", () => {
  const prisma = new PrismaService();
  const inventory = new OnsaleInventoryService(prisma);
  const onsales = new OnsalesService(
    new ConfigService({
      FANPASS_DATA_SOURCE: "prisma",
      FANPASS_ONSALE_QUEUE_SECRET:
        "fanpass-test-onsale-queue-secret-000000000000",
    }),
    prisma,
    inventory,
  );
  const eventId = "evt_onsale_concurrency_test";
  const ticketTypeId = "tt_onsale_concurrency_test";
  const onsaleId = "onsale_concurrency_test";
  const fanOneId = "usr_onsale_fan_one";
  const fanTwoId = "usr_onsale_fan_two";
  const fanThreeId = "usr_onsale_fan_three";

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanup();
    await seedOnsale(2);
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("allows only one transaction to reserve the final ticket", async () => {
    await prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: { supply: 1 },
    });
    await onsales.joinQueue(eventId, fanOneId, "client_instance_fan_one_0001");
    await onsales.joinQueue(eventId, fanTwoId, "client_instance_fan_two_0002");

    const results = await Promise.allSettled([
      createPrimaryOrderWithHold("ord_onsale_one", fanOneId),
      createPrimaryOrderWithHold("ord_onsale_two", fanTwoId),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      await prisma.inventoryHold.count({
        where: {
          eventId,
          status: "ACTIVE",
        },
      }),
    ).toBe(1);
    expect(
      await prisma.order.count({
        where: { eventId },
      }),
    ).toBe(1);
  });

  it("keeps one queue lease per app installation across accounts", async () => {
    await onsales.joinQueue(eventId, fanOneId, "client_instance_shared_0001");

    await expect(
      onsales.joinQueue(eventId, fanThreeId, "client_instance_shared_0001"),
    ).rejects.toThrow(
      "This app installation already has a queue place for this sale",
    );
  });

  it("serializes the per-account purchase limit across simultaneous orders", async () => {
    await prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: { supply: 3 },
    });
    await onsales.joinQueue(eventId, fanOneId, "client_instance_fan_one_0001");

    const firstTwo = await Promise.allSettled([
      createPrimaryOrderWithHold("ord_limit_one", fanOneId),
      createPrimaryOrderWithHold("ord_limit_two", fanOneId),
    ]);

    expect(
      firstTwo.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(2);
    await expect(
      createPrimaryOrderWithHold("ord_limit_three", fanOneId),
    ).rejects.toThrow("Event purchase limit reached");
    expect(
      await prisma.inventoryHold.aggregate({
        where: { eventId, userId: fanOneId, status: "ACTIVE" },
        _sum: { quantity: true },
      }),
    ).toMatchObject({ _sum: { quantity: 2 } });
  });

  it("blocks a second account linked to the same card fingerprint", async () => {
    await onsales.joinQueue(eventId, fanOneId, "client_instance_fan_one_0001");
    await onsales.joinQueue(eventId, fanTwoId, "client_instance_fan_two_0002");
    await createPrimaryOrderWithHold("ord_identity_one", fanOneId);
    await createPrimaryOrderWithHold("ord_identity_two", fanTwoId);
    const fingerprintHash = "hashed_payment_identity_for_test";

    await prisma.payment.createMany({
      data: [
        {
          id: "pay_identity_one",
          userId: fanOneId,
          orderId: "ord_identity_one",
          amount: 10000,
          currency: "hkd",
          status: "requires_payment_method",
          captureStatus: "NOT_CAPTURED",
        },
        {
          id: "pay_identity_two",
          userId: fanTwoId,
          orderId: "ord_identity_two",
          amount: 10000,
          currency: "hkd",
          status: "requires_payment_method",
          captureStatus: "NOT_CAPTURED",
        },
      ],
    });

    const results = await Promise.all([
      authorizePaymentIdentity(
        "pay_identity_one",
        "ord_identity_one",
        fingerprintHash,
      ),
      authorizePaymentIdentity(
        "pay_identity_two",
        "ord_identity_two",
        fingerprintHash,
      ),
    ]);

    expect(results.filter((result) => result.authorized)).toHaveLength(1);
    expect(
      results.filter(
        (result) => !result.authorized && result.reason === "identity_limit",
      ),
    ).toHaveLength(1);
    expect(
      await prisma.inventoryHold.count({
        where: { eventId, status: "BLOCKED" },
      }),
    ).toBe(1);
  });

  it("does not let a late payment webhook reclaim an expired queue hold", async () => {
    await onsales.joinQueue(eventId, fanOneId, "client_instance_fan_one_0001");
    await createPrimaryOrderWithHold("ord_expired_hold", fanOneId);
    await prisma.inventoryHold.update({
      where: { orderId: "ord_expired_hold" },
      data: {
        status: "EXPIRED",
        expiresAt: new Date(Date.now() - 1_000),
        releasedAt: new Date(),
        releaseReason: "checkout_window_expired",
      },
    });

    const result = await prisma.$transaction((tx) =>
      inventory.authorizeOrderHold(tx, {
        orderId: "ord_expired_hold",
        paymentMethodFingerprintHash: "late_payment_identity_hash",
      }),
    );

    expect(result).toMatchObject({
      hasPrimaryHold: true,
      authorized: false,
      reason: "inventory_unavailable",
    });
    await expect(
      prisma.inventoryHold.findUniqueOrThrow({
        where: { orderId: "ord_expired_hold" },
      }),
    ).resolves.toMatchObject({ status: "EXPIRED" });
  });

  it("does not authorize a queued hold without a Stripe card identity signal", async () => {
    await onsales.joinQueue(eventId, fanOneId, "client_instance_fan_one_0001");
    await createPrimaryOrderWithHold("ord_missing_identity", fanOneId);

    const result = await prisma.$transaction((tx) =>
      inventory.authorizeOrderHold(tx, {
        orderId: "ord_missing_identity",
        paymentMethodFingerprintHash: null,
      }),
    );

    expect(result).toMatchObject({
      hasPrimaryHold: true,
      authorized: false,
      reason: "identity_signal_unavailable",
    });
    await expect(
      prisma.inventoryHold.findUniqueOrThrow({
        where: { orderId: "ord_missing_identity" },
      }),
    ).resolves.toMatchObject({ status: "ACTIVE" });
  });

  async function authorizePaymentIdentity(
    paymentId: string,
    orderId: string,
    fingerprintHash: string,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "requires_capture",
          captureStatus: "AUTHORIZED",
          paymentMethodFingerprintHash: fingerprintHash,
        },
      });
      return inventory.authorizeOrderHold(tx, {
        orderId,
        paymentMethodFingerprintHash: fingerprintHash,
      });
    });
  }

  async function createPrimaryOrderWithHold(orderId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await inventory.lockPrimaryOrderCreation(tx, ticketTypeId);
      const order = await tx.order.create({
        data: {
          id: orderId,
          userId,
          eventId,
          ticketTypeId,
          side: "BUY",
          fulfillmentMode: "PRIMARY_ONLY",
          price: 100,
          quantity: 1,
          remainingQuantity: 1,
          status: "OPEN",
        },
      });
      await inventory.reservePrimaryInventory(tx, {
        orderId,
        eventId,
        ticketTypeId,
        userId,
        quantity: 1,
      });
      return order;
    });
  }

  async function seedOnsale(supply: number) {
    const now = Date.now();
    await prisma.user.createMany({
      data: [
        {
          id: "usr_onsale_organizer",
          name: "Onsale Organizer",
          email: "onsale-organizer@example.com",
          role: "ORGANIZER",
        },
        {
          id: fanOneId,
          name: "Fan One",
          email: "onsale-fan-one@example.com",
          role: "FAN",
          privyId: "privy-onsale-fan-one",
        },
        {
          id: fanTwoId,
          name: "Fan Two",
          email: "onsale-fan-two@example.com",
          role: "FAN",
          privyId: "privy-onsale-fan-two",
        },
        {
          id: fanThreeId,
          name: "Fan Three",
          email: "onsale-fan-three@example.com",
          role: "FAN",
          privyId: "privy-onsale-fan-three",
        },
      ],
    });
    await prisma.organizer.create({
      data: {
        id: "org_onsale_test",
        userId: "usr_onsale_organizer",
        organizationName: "Onsale Test",
        verificationStatus: "VERIFIED",
      },
    });
    await prisma.venue.create({
      data: {
        id: "venue_onsale_test",
        name: "Onsale Test Venue",
        country: "HK",
        city: "Hong Kong",
        address: "Test",
        timezone: "Asia/Hong_Kong",
        capacity: supply,
      },
    });
    await prisma.event.create({
      data: {
        id: eventId,
        organizerId: "org_onsale_test",
        venueId: "venue_onsale_test",
        title: "Onsale Concurrency Test",
        startTime: new Date(now + 7 * 24 * 60 * 60 * 1_000),
        endTime: new Date(now + 7 * 24 * 60 * 60 * 1_000 + 7_200_000),
        status: "PUBLISHED",
      },
    });
    await prisma.ticketType.create({
      data: {
        id: ticketTypeId,
        eventId,
        name: "General Admission",
        faceValue: 100,
        currency: "HKD",
        supply,
        transferable: true,
        resaleCap: 110,
        maxTransferCount: 1,
      },
    });
    await prisma.onsale.create({
      data: {
        id: onsaleId,
        eventId,
        status: "OPEN",
        queueEnabled: true,
        waitingRoomOpensAt: new Date(now - 7_200_000),
        opensAt: new Date(now - 3_600_000),
        closesAt: new Date(now + 3_600_000),
        checkoutWindowSeconds: 600,
        maxActiveCheckouts: 10,
        admissionBatchSize: 10,
        purchaseLimitPerUser: 2,
        maxAccountsPerPaymentMethod: 1,
        allocationPolicyVersion: "test-v1",
        allocationPublishedAt: new Date(now - 7_200_000),
        allocationBreakdown: [
          {
            key: "public_sale",
            label: "Public sale",
            quantity: supply,
            publicSale: true,
          },
        ],
      },
    });
  }

  async function cleanup() {
    await prisma.auditLog.deleteMany({
      where: {
        actorId: {
          in: [fanOneId, fanTwoId, fanThreeId],
        },
      },
    });
    await prisma.payment.deleteMany({
      where: { order: { is: { eventId } } },
    });
    await prisma.inventoryHold.deleteMany({ where: { eventId } });
    await prisma.order.deleteMany({ where: { eventId } });
    await prisma.queueEntry.deleteMany({ where: { onsaleId } });
    await prisma.onsale.deleteMany({ where: { id: onsaleId } });
    await prisma.ticket.deleteMany({ where: { eventId } });
    await prisma.ticketType.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.venue.deleteMany({ where: { id: "venue_onsale_test" } });
    await prisma.organizer.deleteMany({ where: { id: "org_onsale_test" } });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: ["usr_onsale_organizer", fanOneId, fanTwoId, fanThreeId],
        },
      },
    });
  }
});
