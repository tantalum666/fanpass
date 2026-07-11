import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InventoryHoldStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";

const SOLD_TICKET_STATUSES = [
  "CREATED",
  "ACTIVE",
  "LISTED_FOR_RESALE",
  "TRANSFER_PENDING",
  "TRANSFERRED",
  "REDEEMED",
  "EXPIRED",
] as const;

type PrismaReader = PrismaService | Prisma.TransactionClient;

export interface TicketTypeInventorySnapshot {
  ticketTypeId: string;
  name: string;
  allocation: number;
  sold: number;
  held: number;
  available: number;
  returned: number;
  releasedHolds: number;
}

export interface EventInventorySnapshot {
  venueCapacity: number;
  publicSaleAllocation: number;
  sold: number;
  held: number;
  available: number;
  returned: number;
  releasedHolds: number;
  ticketTypes: TicketTypeInventorySnapshot[];
}

export interface ReservePrimaryInventoryInput {
  orderId: string;
  eventId: string;
  ticketTypeId: string;
  userId: string;
  quantity: number;
}

export interface PaymentIdentityAuthorizationResult {
  hasPrimaryHold: boolean;
  authorized: boolean;
  reason:
    | "not_primary"
    | "authorized"
    | "inventory_unavailable"
    | "identity_signal_unavailable"
    | "identity_limit";
}

@Injectable()
export class OnsaleInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async lockPrimaryOrderCreation(
    tx: Prisma.TransactionClient,
    ticketTypeId: string,
  ) {
    await this.lockTicketType(tx, ticketTypeId);
  }

  async inventorySnapshot(eventId: string): Promise<EventInventorySnapshot> {
    const now = new Date();
    await this.expireActiveHolds(this.prisma, { eventId }, now);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        venue: true,
        ticketTypes: {
          orderBy: { faceValue: "asc" },
        },
      },
    });
    if (!event) {
      throw new BadRequestException("Event is not available");
    }

    const [soldGroups, activeHoldGroups, returnedGroups, releasedHoldGroups] =
      await Promise.all([
        this.prisma.ticket.groupBy({
          by: ["ticketTypeId"],
          where: {
            eventId,
            status: { in: [...SOLD_TICKET_STATUSES] },
          },
          _count: { _all: true },
        }),
        this.prisma.inventoryHold.groupBy({
          by: ["ticketTypeId"],
          where: {
            eventId,
            OR: [
              { status: "ACTIVE", expiresAt: { gt: now } },
              { status: "AUTHORIZED" },
            ],
          },
          _sum: { quantity: true },
        }),
        this.prisma.ticket.groupBy({
          by: ["ticketTypeId"],
          where: {
            eventId,
            status: { in: ["CANCELLED", "REFUNDED"] },
          },
          _count: { _all: true },
        }),
        this.prisma.inventoryHold.groupBy({
          by: ["ticketTypeId"],
          where: {
            eventId,
            status: { in: ["EXPIRED", "RELEASED"] },
          },
          _sum: { quantity: true },
        }),
      ]);

    const soldByType = new Map(
      soldGroups.map((group) => [group.ticketTypeId, group._count._all]),
    );
    const heldByType = new Map(
      activeHoldGroups.map((group) => [
        group.ticketTypeId,
        group._sum.quantity ?? 0,
      ]),
    );
    const returnedByType = new Map(
      returnedGroups.map((group) => [group.ticketTypeId, group._count._all]),
    );
    const releasedByType = new Map(
      releasedHoldGroups.map((group) => [
        group.ticketTypeId,
        group._sum.quantity ?? 0,
      ]),
    );

    const ticketTypes = event.ticketTypes.map((ticketType) => {
      const sold = soldByType.get(ticketType.id) ?? 0;
      const held = heldByType.get(ticketType.id) ?? 0;
      return {
        ticketTypeId: ticketType.id,
        name: ticketType.name,
        allocation: ticketType.supply,
        sold,
        held,
        available: Math.max(ticketType.supply - sold - held, 0),
        returned: returnedByType.get(ticketType.id) ?? 0,
        releasedHolds: releasedByType.get(ticketType.id) ?? 0,
      };
    });

    return {
      venueCapacity: event.venue.capacity,
      publicSaleAllocation: ticketTypes.reduce(
        (total, ticketType) => total + ticketType.allocation,
        0,
      ),
      sold: ticketTypes.reduce(
        (total, ticketType) => total + ticketType.sold,
        0,
      ),
      held: ticketTypes.reduce(
        (total, ticketType) => total + ticketType.held,
        0,
      ),
      available: ticketTypes.reduce(
        (total, ticketType) => total + ticketType.available,
        0,
      ),
      returned: ticketTypes.reduce(
        (total, ticketType) => total + ticketType.returned,
        0,
      ),
      releasedHolds: ticketTypes.reduce(
        (total, ticketType) => total + ticketType.releasedHolds,
        0,
      ),
      ticketTypes,
    };
  }

  async reservePrimaryInventory(
    tx: Prisma.TransactionClient,
    input: ReservePrimaryInventoryInput,
  ) {
    if (input.quantity !== 1) {
      throw new BadRequestException(
        "Primary orders currently reserve one ticket",
      );
    }

    const now = new Date();
    await this.lockTicketType(tx, input.ticketTypeId);
    await this.expireActiveHolds(tx, { ticketTypeId: input.ticketTypeId }, now);

    const [ticketType, onsale] = await Promise.all([
      tx.ticketType.findUnique({ where: { id: input.ticketTypeId } }),
      tx.onsale.findUnique({ where: { eventId: input.eventId } }),
    ]);
    if (!ticketType || ticketType.eventId !== input.eventId) {
      throw new BadRequestException("Ticket category is not available");
    }

    let queueEntryId: string | null = null;
    if (onsale?.queueEnabled) {
      this.assertOnsaleOpen(onsale, now);
      const queueEntry = await tx.queueEntry.findUnique({
        where: {
          onsaleId_userId: {
            onsaleId: onsale.id,
            userId: input.userId,
          },
        },
      });
      if (
        !queueEntry ||
        !["ADMITTED", "CHECKOUT"].includes(queueEntry.status) ||
        !queueEntry.accessExpiresAt ||
        queueEntry.accessExpiresAt <= now
      ) {
        throw new ForbiddenException(
          "A live queue checkout window is required for this sale",
        );
      }

      const purchasedOrReserved = await tx.inventoryHold.aggregate({
        where: {
          eventId: input.eventId,
          userId: input.userId,
          OR: [
            { status: "ACTIVE", expiresAt: { gt: now } },
            { status: "AUTHORIZED" },
            { status: "CONVERTED" },
          ],
        },
        _sum: { quantity: true },
      });
      if (
        (purchasedOrReserved._sum.quantity ?? 0) + input.quantity >
        onsale.purchaseLimitPerUser
      ) {
        throw new ConflictException("Event purchase limit reached");
      }
      queueEntryId = queueEntry.id;
    }

    await this.assertCapacity(
      tx,
      ticketType.id,
      ticketType.supply,
      input.quantity,
      now,
    );

    const checkoutWindowSeconds = onsale?.checkoutWindowSeconds ?? 600;
    const requestedExpiry = new Date(
      now.getTime() + checkoutWindowSeconds * 1_000,
    );
    const expiresAt = onsale
      ? new Date(Math.min(requestedExpiry.getTime(), onsale.closesAt.getTime()))
      : requestedExpiry;
    if (expiresAt <= now) {
      throw new ConflictException("This sale is closed");
    }

    const hold = await tx.inventoryHold.create({
      data: {
        id: `hold_${randomUUID()}`,
        onsaleId: onsale?.id ?? null,
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
        userId: input.userId,
        queueEntryId,
        orderId: input.orderId,
        source: "PRIMARY_ORDER",
        status: "ACTIVE",
        quantity: input.quantity,
        expiresAt,
      },
    });

    if (queueEntryId) {
      await tx.queueEntry.update({
        where: { id: queueEntryId },
        data: {
          status: "CHECKOUT",
          accessExpiresAt: expiresAt,
          lastSeenAt: now,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: "PRIMARY_INVENTORY_HELD",
        entityType: "inventory_hold",
        entityId: hold.id,
        metadataJson: {
          eventId: input.eventId,
          ticketTypeId: input.ticketTypeId,
          orderId: input.orderId,
          quantity: input.quantity,
          expiresAt: expiresAt.toISOString(),
          queueManaged: Boolean(onsale?.queueEnabled),
        },
      },
    });
    return hold;
  }

  async reserveAdministrativeInventory(input: {
    eventId: string;
    ticketTypeId: string;
    ownerId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await this.lockTicketType(tx, input.ticketTypeId);
      await this.expireActiveHolds(
        tx,
        { ticketTypeId: input.ticketTypeId },
        now,
      );
      const ticketType = await tx.ticketType.findUnique({
        where: { id: input.ticketTypeId },
      });
      if (!ticketType || ticketType.eventId !== input.eventId) {
        throw new BadRequestException("Ticket category is not available");
      }
      await this.assertCapacity(tx, ticketType.id, ticketType.supply, 1, now);
      const onsale = await tx.onsale.findUnique({
        where: { eventId: input.eventId },
      });
      return tx.inventoryHold.create({
        data: {
          id: `hold_${randomUUID()}`,
          onsaleId: onsale?.id ?? null,
          eventId: input.eventId,
          ticketTypeId: input.ticketTypeId,
          userId: input.ownerId,
          source: "ADMIN_ISSUE",
          status: "ACTIVE",
          quantity: 1,
          expiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
        },
      });
    });
  }

  async assertOrderPayable(
    prisma: PrismaReader,
    order: { id: string; fulfillmentMode: string },
  ) {
    if (order.fulfillmentMode !== "PRIMARY_ONLY") {
      return;
    }
    const hold = await prisma.inventoryHold.findUnique({
      where: { orderId: order.id },
    });
    const now = new Date();
    if (
      !hold ||
      hold.status === "BLOCKED" ||
      hold.status === "RELEASED" ||
      hold.status === "EXPIRED" ||
      (hold.status === "ACTIVE" && hold.expiresAt <= now)
    ) {
      throw new ConflictException(
        "Ticket hold expired or is unavailable; rejoin the sale queue",
      );
    }
  }

  async isQueueManagedOrder(prisma: PrismaReader, orderId: string) {
    const hold = await prisma.inventoryHold.findUnique({
      where: { orderId },
      select: {
        onsale: {
          select: { queueEnabled: true },
        },
      },
    });
    return hold?.onsale?.queueEnabled === true;
  }

  async authorizeOrderHold(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      paymentMethodFingerprintHash?: string | null;
    },
  ): Promise<PaymentIdentityAuthorizationResult> {
    const initialHold = await tx.inventoryHold.findUnique({
      where: { orderId: input.orderId },
      include: { onsale: true },
    });
    if (!initialHold) {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: { fulfillmentMode: true },
      });
      return {
        hasPrimaryHold: order?.fulfillmentMode === "PRIMARY_ONLY",
        authorized: order?.fulfillmentMode !== "PRIMARY_ONLY",
        reason: "not_primary",
      };
    }

    await this.lockTicketType(tx, initialHold.ticketTypeId);
    await this.lockInventoryHold(tx, initialHold.id);
    const hold = await tx.inventoryHold.findUniqueOrThrow({
      where: { id: initialHold.id },
      include: { onsale: true },
    });

    if (hold.status === "CONVERTED") {
      return {
        hasPrimaryHold: true,
        authorized: true,
        reason: "authorized",
      };
    }
    if (hold.status === "BLOCKED" || hold.status === "RELEASED") {
      return {
        hasPrimaryHold: true,
        authorized: false,
        reason:
          hold.status === "BLOCKED"
            ? "identity_limit"
            : "inventory_unavailable",
      };
    }

    const now = new Date();
    const canUseExistingHold = hold.status === "ACTIVE" && hold.expiresAt > now;
    const alreadyAuthorized = hold.status === "AUTHORIZED";
    if (
      hold.onsale?.queueEnabled &&
      !canUseExistingHold &&
      !alreadyAuthorized
    ) {
      if (hold.status !== "EXPIRED") {
        await this.expireHold(tx, hold.id, "queue_checkout_expired");
      }
      return {
        hasPrimaryHold: true,
        authorized: false,
        reason: "inventory_unavailable",
      };
    }

    if (hold.onsale?.queueEnabled && !input.paymentMethodFingerprintHash) {
      return {
        hasPrimaryHold: true,
        authorized: false,
        reason: "identity_signal_unavailable",
      };
    }

    if (hold.onsale?.queueEnabled && input.paymentMethodFingerprintHash) {
      await this.lockPaymentIdentity(
        tx,
        hold.onsale.id,
        input.paymentMethodFingerprintHash,
      );
      const linkedAccounts = await tx.payment.findMany({
        where: {
          paymentMethodFingerprintHash: input.paymentMethodFingerprintHash,
          userId: { not: hold.userId },
          captureStatus: { in: ["AUTHORIZED", "CAPTURED"] },
          order: { is: { eventId: hold.eventId } },
        },
        distinct: ["userId"],
        select: { userId: true },
        take: hold.onsale.maxAccountsPerPaymentMethod,
      });
      if (linkedAccounts.length >= hold.onsale.maxAccountsPerPaymentMethod) {
        await this.blockHoldForIdentityRisk(tx, hold);
        return {
          hasPrimaryHold: true,
          authorized: false,
          reason: "identity_limit",
        };
      }
    }

    if (alreadyAuthorized) {
      return {
        hasPrimaryHold: true,
        authorized: true,
        reason: "authorized",
      };
    }
    if (!canUseExistingHold) {
      if (hold.onsale && hold.onsale.closesAt <= now) {
        await this.expireHold(tx, hold.id, "sale_closed");
        return {
          hasPrimaryHold: true,
          authorized: false,
          reason: "inventory_unavailable",
        };
      }
      const ticketType = await tx.ticketType.findUniqueOrThrow({
        where: { id: hold.ticketTypeId },
      });
      try {
        await this.assertCapacity(
          tx,
          ticketType.id,
          ticketType.supply,
          hold.quantity,
          now,
        );
      } catch {
        await this.expireHold(tx, hold.id, "inventory_reallocated");
        return {
          hasPrimaryHold: true,
          authorized: false,
          reason: "inventory_unavailable",
        };
      }
    }

    await tx.inventoryHold.update({
      where: { id: hold.id },
      data: {
        status: "AUTHORIZED",
        authorizedAt: now,
        releaseReason: null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: hold.userId,
        action: "PRIMARY_INVENTORY_AUTHORIZED",
        entityType: "inventory_hold",
        entityId: hold.id,
        metadataJson: {
          orderId: hold.orderId,
          eventId: hold.eventId,
          ticketTypeId: hold.ticketTypeId,
        },
      },
    });
    return {
      hasPrimaryHold: true,
      authorized: true,
      reason: "authorized",
    };
  }

  async orderHoldForIssuance(prisma: PrismaReader, orderId: string) {
    const hold = await prisma.inventoryHold.findUnique({
      where: { orderId },
    });
    if (!hold) {
      throw new ConflictException("Primary inventory hold is missing");
    }
    return hold;
  }

  async consumeHold(
    tx: Prisma.TransactionClient,
    input: {
      holdId: string;
      ticketId: string;
    },
  ) {
    const initialHold = await tx.inventoryHold.findUnique({
      where: { id: input.holdId },
    });
    if (!initialHold) {
      throw new ConflictException("Primary inventory hold is missing");
    }
    await this.lockTicketType(tx, initialHold.ticketTypeId);
    await this.lockInventoryHold(tx, initialHold.id);
    const hold = await tx.inventoryHold.findUniqueOrThrow({
      where: { id: initialHold.id },
      include: { onsale: true },
    });
    const now = new Date();
    if (
      hold.status !== "AUTHORIZED" &&
      !(hold.status === "ACTIVE" && hold.expiresAt > now)
    ) {
      throw new ConflictException("Primary inventory hold is no longer valid");
    }

    const converted = await tx.inventoryHold.update({
      where: { id: hold.id },
      data: {
        status: "CONVERTED",
        ticketId: input.ticketId,
        convertedAt: now,
      },
    });
    if (hold.queueEntryId) {
      const [convertedQuantity, unresolvedHolds] = await Promise.all([
        tx.inventoryHold.aggregate({
          where: {
            queueEntryId: hold.queueEntryId,
            status: "CONVERTED",
          },
          _sum: { quantity: true },
        }),
        tx.inventoryHold.count({
          where: {
            queueEntryId: hold.queueEntryId,
            OR: [
              { status: "ACTIVE", expiresAt: { gt: now } },
              { status: "AUTHORIZED" },
            ],
          },
        }),
      ]);
      const purchaseLimit = hold.onsale?.purchaseLimitPerUser ?? 1;
      const limitReached =
        (convertedQuantity._sum.quantity ?? 0) >= purchaseLimit;
      await tx.queueEntry.update({
        where: { id: hold.queueEntryId },
        data: {
          status: limitReached
            ? "COMPLETED"
            : unresolvedHolds > 0
              ? "CHECKOUT"
              : "ADMITTED",
          completedAt: limitReached ? now : null,
          lastSeenAt: now,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: hold.userId,
        action: "PRIMARY_INVENTORY_CONVERTED",
        entityType: "inventory_hold",
        entityId: hold.id,
        metadataJson: {
          orderId: hold.orderId,
          ticketId: input.ticketId,
          eventId: hold.eventId,
          ticketTypeId: hold.ticketTypeId,
        },
      },
    });
    return converted;
  }

  async releaseOrderHold(
    tx: Prisma.TransactionClient,
    orderId: string,
    reason: string,
    includeConverted = false,
  ) {
    const initialHold = await tx.inventoryHold.findUnique({
      where: { orderId },
    });
    if (!initialHold) {
      return null;
    }
    await this.lockTicketType(tx, initialHold.ticketTypeId);
    await this.lockInventoryHold(tx, initialHold.id);
    const hold = await tx.inventoryHold.findUniqueOrThrow({
      where: { id: initialHold.id },
    });
    const releasable: InventoryHoldStatus[] = [
      "ACTIVE",
      "AUTHORIZED",
      "EXPIRED",
      "BLOCKED",
    ];
    if (includeConverted) {
      releasable.push("CONVERTED");
    }
    if (!releasable.includes(hold.status)) {
      return hold;
    }

    const now = new Date();
    const released = await tx.inventoryHold.update({
      where: { id: hold.id },
      data: {
        status: "RELEASED",
        releasedAt: now,
        releaseReason: reason,
      },
    });
    if (hold.queueEntryId) {
      await this.expireQueueEntryWithoutLiveHold(tx, hold.queueEntryId, now);
    }
    await tx.auditLog.create({
      data: {
        actorId: hold.userId,
        action: "PRIMARY_INVENTORY_RELEASED",
        entityType: "inventory_hold",
        entityId: hold.id,
        metadataJson: {
          orderId,
          reason,
          previousStatus: hold.status,
        },
      },
    });
    return released;
  }

  async releaseHoldById(holdId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const initialHold = await tx.inventoryHold.findUnique({
        where: { id: holdId },
      });
      if (!initialHold) {
        return null;
      }
      await this.lockTicketType(tx, initialHold.ticketTypeId);
      await this.lockInventoryHold(tx, initialHold.id);
      const hold = await tx.inventoryHold.findUniqueOrThrow({
        where: { id: initialHold.id },
      });
      if (hold.status === "RELEASED" || hold.status === "CONVERTED") {
        return hold;
      }
      const now = new Date();
      return tx.inventoryHold.update({
        where: { id: hold.id },
        data: {
          status: "RELEASED",
          releasedAt: now,
          releaseReason: reason,
        },
      });
    });
  }

  private async assertCapacity(
    tx: Prisma.TransactionClient,
    ticketTypeId: string,
    supply: number,
    requestedQuantity: number,
    now: Date,
  ) {
    const [sold, held] = await Promise.all([
      tx.ticket.count({
        where: {
          ticketTypeId,
          status: { in: [...SOLD_TICKET_STATUSES] },
        },
      }),
      tx.inventoryHold.aggregate({
        where: {
          ticketTypeId,
          OR: [
            { status: "ACTIVE", expiresAt: { gt: now } },
            { status: "AUTHORIZED" },
          ],
        },
        _sum: { quantity: true },
      }),
    ]);
    if (sold + (held._sum.quantity ?? 0) + requestedQuantity > supply) {
      throw new ConflictException("Ticket allocation is currently exhausted");
    }
  }

  private async expireActiveHolds(
    prisma: PrismaReader,
    scope: { eventId?: string; ticketTypeId?: string },
    now: Date,
  ) {
    return prisma.inventoryHold.updateMany({
      where: {
        ...scope,
        status: "ACTIVE",
        expiresAt: { lte: now },
      },
      data: {
        status: "EXPIRED",
        releasedAt: now,
        releaseReason: "checkout_window_expired",
      },
    });
  }

  private async expireHold(
    tx: Prisma.TransactionClient,
    holdId: string,
    reason: string,
  ) {
    const now = new Date();
    await tx.inventoryHold.update({
      where: { id: holdId },
      data: {
        status: "EXPIRED",
        releasedAt: now,
        releaseReason: reason,
      },
    });
  }

  private async blockHoldForIdentityRisk(
    tx: Prisma.TransactionClient,
    hold: {
      id: string;
      userId: string;
      orderId: string | null;
      queueEntryId: string | null;
      eventId: string;
    },
  ) {
    const now = new Date();
    await tx.inventoryHold.update({
      where: { id: hold.id },
      data: {
        status: "BLOCKED",
        releasedAt: now,
        releaseReason: "payment_identity_limit",
      },
    });
    if (hold.queueEntryId) {
      await tx.queueEntry.update({
        where: { id: hold.queueEntryId },
        data: {
          status: "BLOCKED",
          riskDecision: "BLOCK",
          accessExpiresAt: now,
          lastSeenAt: now,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: hold.userId,
        action: "ONSALE_PAYMENT_IDENTITY_BLOCKED",
        entityType: "inventory_hold",
        entityId: hold.id,
        metadataJson: {
          orderId: hold.orderId,
          eventId: hold.eventId,
          reason: "linked_payment_identity_limit",
        },
      },
    });
  }

  private assertOnsaleOpen(
    onsale: {
      status: string;
      opensAt: Date;
      closesAt: Date;
    },
    now: Date,
  ) {
    if (
      onsale.status !== "OPEN" ||
      now < onsale.opensAt ||
      now >= onsale.closesAt
    ) {
      throw new ConflictException("This sale is not open");
    }
  }

  private async lockTicketType(
    tx: Prisma.TransactionClient,
    ticketTypeId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "ticket_types"
      WHERE "id" = ${ticketTypeId}
      FOR UPDATE
    `;
    if (rows.length !== 1) {
      throw new BadRequestException("Ticket category is not available");
    }
  }

  private async lockPaymentIdentity(
    tx: Prisma.TransactionClient,
    onsaleId: string,
    paymentMethodFingerprintHash: string,
  ) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${onsaleId}:${paymentMethodFingerprintHash}`}, 0)
      )
    `;
  }

  private async lockInventoryHold(
    tx: Prisma.TransactionClient,
    holdId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "inventory_holds"
      WHERE "id" = ${holdId}
      FOR UPDATE
    `;
    if (rows.length !== 1) {
      throw new ConflictException("Primary inventory hold is missing");
    }
  }

  private async expireQueueEntryWithoutLiveHold(
    tx: Prisma.TransactionClient,
    queueEntryId: string,
    now: Date,
  ) {
    const liveHolds = await tx.inventoryHold.count({
      where: {
        queueEntryId,
        OR: [
          { status: "ACTIVE", expiresAt: { gt: now } },
          { status: "AUTHORIZED" },
        ],
      },
    });
    if (liveHolds > 0) {
      return;
    }
    await tx.queueEntry.updateMany({
      where: {
        id: queueEntryId,
        status: { in: ["ADMITTED", "CHECKOUT", "COMPLETED"] },
      },
      data: {
        status: "EXPIRED",
        accessExpiresAt: now,
        lastSeenAt: now,
      },
    });
  }
}
