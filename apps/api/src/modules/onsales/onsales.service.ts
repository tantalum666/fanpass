import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Onsale, Prisma } from "@prisma/client";
import { createHash, createHmac, randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { isProductionLikeEnvironment } from "../../config/security-config";
import {
  EventInventorySnapshot,
  OnsaleInventoryService,
} from "./onsale-inventory.service";

export interface AllocationCategory {
  key: string;
  label: string;
  quantity: number;
  publicSale: boolean;
}

@Injectable()
export class OnsalesService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly inventory: OnsaleInventoryService,
  ) {}

  async publicSnapshot(eventId: string) {
    return this.buildPublicSnapshot(eventId, true);
  }

  private async buildPublicSnapshot(eventId: string, progressQueue: boolean) {
    this.assertPrismaDataSource();
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        venue: {
          select: {
            name: true,
            capacity: true,
          },
        },
        onsale: true,
      },
    });
    if (!event) {
      throw new BadRequestException("Event is not available");
    }

    if (event.onsale && progressQueue) {
      await this.progressOnsale(event.onsale.id);
    }
    const [onsale, inventory] = await Promise.all([
      this.prisma.onsale.findUnique({ where: { eventId } }),
      this.inventory.inventorySnapshot(eventId),
    ]);
    const now = new Date();
    const allocation = this.allocationSnapshot(
      onsale,
      inventory,
      event.venue.capacity,
    );

    return {
      eventId,
      eventTitle: event.title,
      venueName: event.venue.name,
      phase: this.phaseFor(onsale, now),
      allocation,
      inventory,
      queue: await this.queueSnapshot(onsale, now),
      fairness: onsale ? this.fairnessSnapshot(onsale, now) : null,
      definitions: {
        sold: "Primary tickets already issued from the public allocation.",
        held: "Tickets reserved by live checkout or authorized payment and not available to another buyer.",
        available:
          "Public allocation minus sold tickets and active checkout holds.",
        queuePosition:
          "A private account position; it does not guarantee a ticket.",
      },
      updatedAt: now.toISOString(),
    };
  }

  async joinQueue(eventId: string, userId: string, clientInstanceId: string) {
    this.assertPrismaDataSource();
    this.assertProductionQueueAttestationAvailable();
    this.assertClientInstanceId(clientInstanceId);
    const clientInstanceHash = this.identityHash(clientInstanceId);
    const now = new Date();

    let entryId: string;
    try {
      entryId = await this.prisma.$transaction(async (tx) => {
        await this.lockEvent(tx, eventId);
        const event = await tx.event.findFirst({
          where: { id: eventId, status: "PUBLISHED" },
          select: { id: true },
        });
        if (!event) {
          throw new ConflictException("Event is not available");
        }
        const initialOnsale = await tx.onsale.findUnique({
          where: { eventId },
        });
        if (!initialOnsale || !initialOnsale.queueEnabled) {
          throw new ConflictException("This event does not use a sale queue");
        }
        await this.lockOnsale(tx, initialOnsale.id);
        const onsale = await tx.onsale.findUniqueOrThrow({
          where: { id: initialOnsale.id },
        });
        this.assertQueueJoinable(onsale, now);

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, privyId: true },
        });
        if (!user?.privyId) {
          throw new ForbiddenException(
            "A verified FanPass account is required for this sale",
          );
        }

        await this.progressLocked(tx, onsale, now);
        const refreshedOnsale = await tx.onsale.findUniqueOrThrow({
          where: { id: onsale.id },
        });
        const existing = await tx.queueEntry.findUnique({
          where: {
            onsaleId_userId: {
              onsaleId: onsale.id,
              userId,
            },
          },
        });
        if (existing) {
          if (existing.status === "BLOCKED") {
            throw new ForbiddenException("Queue access is unavailable");
          }
          if (existing.status === "COMPLETED") {
            throw new ConflictException(
              "This account already completed its queue checkout",
            );
          }
          if (existing.status !== "EXPIRED") {
            await tx.queueEntry.update({
              where: { id: existing.id },
              data: { lastSeenAt: now },
            });
            return existing.id;
          }

          await tx.inventoryHold.updateMany({
            where: {
              queueEntryId: existing.id,
              status: { in: ["EXPIRED", "RELEASED", "BLOCKED"] },
            },
            data: { queueEntryId: null },
          });
          const assignment = await this.queueAssignment(
            tx,
            refreshedOnsale,
            existing.id,
            now,
          );
          await tx.queueEntry.update({
            where: { id: existing.id },
            data: {
              phase: assignment.phase,
              position: assignment.position,
              fairnessKey: assignment.fairnessKey,
              status: "WAITING",
              riskDecision: "ALLOW",
              attempt: { increment: 1 },
              joinedAt: now,
              admittedAt: null,
              accessExpiresAt: null,
              completedAt: null,
              lastSeenAt: now,
            },
          });
          await this.recordQueueJoin(tx, existing.id, userId, eventId, true);
          return existing.id;
        }

        const clientConflict = await tx.queueEntry.findFirst({
          where: {
            onsaleId: onsale.id,
            clientInstanceHash,
            userId: { not: userId },
          },
          select: { id: true },
        });
        if (clientConflict) {
          throw new ConflictException(
            "This app installation already has a queue place for this sale",
          );
        }

        const id = `queue_${randomUUID()}`;
        const assignment = await this.queueAssignment(
          tx,
          refreshedOnsale,
          id,
          now,
        );
        await tx.queueEntry.create({
          data: {
            id,
            onsaleId: onsale.id,
            userId,
            phase: assignment.phase,
            position: assignment.position,
            fairnessKey: assignment.fairnessKey,
            clientInstanceHash,
            status: "WAITING",
            riskDecision: "ALLOW",
            joinedAt: now,
            lastSeenAt: now,
          },
        });
        await this.recordQueueJoin(tx, id, userId, eventId, false);
        return id;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "This account or app installation already has a queue place",
        );
      }
      throw error;
    }

    await this.progressOnsaleByEvent(eventId);
    return this.queueStatus(eventId, userId, entryId, false);
  }

  async queueStatus(
    eventId: string,
    userId: string,
    expectedEntryId?: string,
    progressQueue = true,
  ) {
    this.assertPrismaDataSource();
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!event) {
      throw new ConflictException("Event is not available");
    }
    const onsale = await this.prisma.onsale.findUnique({
      where: { eventId },
    });
    if (!onsale || !onsale.queueEnabled) {
      return {
        snapshot: await this.buildPublicSnapshot(eventId, false),
        queueEntry: null,
      };
    }

    if (progressQueue) {
      await this.progressOnsale(onsale.id);
    }
    const entry = await this.prisma.queueEntry.findUnique({
      where: {
        onsaleId_userId: {
          onsaleId: onsale.id,
          userId,
        },
      },
    });
    if (expectedEntryId && entry?.id !== expectedEntryId) {
      throw new ConflictException("Queue entry changed during this request");
    }
    if (!entry) {
      return {
        snapshot: await this.buildPublicSnapshot(eventId, false),
        queueEntry: null,
      };
    }

    const now = new Date();
    await this.prisma.queueEntry.update({
      where: { id: entry.id },
      data: { lastSeenAt: now },
    });
    const usersAhead = entry.position
      ? await this.prisma.queueEntry.count({
          where: {
            onsaleId: onsale.id,
            status: "WAITING",
            position: { lt: entry.position },
          },
        })
      : null;
    const canCheckout =
      ["ADMITTED", "CHECKOUT"].includes(entry.status) &&
      Boolean(entry.accessExpiresAt && entry.accessExpiresAt > now);

    return {
      snapshot: await this.buildPublicSnapshot(eventId, false),
      queueEntry: {
        reference: this.safeQueueReference(entry.id),
        status: entry.status,
        phase: entry.phase,
        position: entry.position,
        positionFinalized: entry.position !== null,
        usersAhead,
        canCheckout,
        joinedAt: entry.joinedAt.toISOString(),
        admittedAt: entry.admittedAt?.toISOString() ?? null,
        checkoutExpiresAt: entry.accessExpiresAt?.toISOString() ?? null,
        attempt: entry.attempt,
        message: this.queueMessage(entry.status, entry.position),
      },
    };
  }

  private async progressOnsaleByEvent(eventId: string) {
    const onsale = await this.prisma.onsale.findUnique({
      where: { eventId },
      select: { id: true },
    });
    if (onsale) {
      await this.progressOnsale(onsale.id);
    }
  }

  private async progressOnsale(onsaleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const progressLock = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(
          hashtextextended(${`onsale-progress:${onsaleId}`}, 0)
        ) AS "acquired"
      `;
      if (progressLock[0]?.acquired !== true) {
        return;
      }
      await this.lockOnsale(tx, onsaleId);
      const onsale = await tx.onsale.findUniqueOrThrow({
        where: { id: onsaleId },
      });
      await this.progressLocked(tx, onsale, new Date());
    });
  }

  private async progressLocked(
    tx: Prisma.TransactionClient,
    onsale: Onsale,
    now: Date,
  ) {
    const event = await tx.event.findFirst({
      where: { id: onsale.eventId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!event) {
      return;
    }
    const expiredHolds = await tx.inventoryHold.findMany({
      where: {
        onsaleId: onsale.id,
        status: "ACTIVE",
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        queueEntryId: true,
      },
    });
    if (expiredHolds.length > 0) {
      await tx.inventoryHold.updateMany({
        where: {
          id: { in: expiredHolds.map((hold) => hold.id) },
          status: "ACTIVE",
          expiresAt: { lte: now },
        },
        data: {
          status: "EXPIRED",
          releasedAt: now,
          releaseReason: "checkout_window_expired",
        },
      });
      const queueEntryIds = expiredHolds.flatMap((hold) =>
        hold.queueEntryId ? [hold.queueEntryId] : [],
      );
      if (queueEntryIds.length > 0) {
        await tx.$executeRaw`
          UPDATE "queue_entries" AS queue
          SET
            "status" = 'EXPIRED',
            "access_expires_at" = ${now},
            "last_seen_at" = ${now},
            "updated_at" = ${now}
          WHERE queue."id" IN (${Prisma.join([...new Set(queueEntryIds)])})
            AND queue."status" = 'CHECKOUT'
            AND NOT EXISTS (
              SELECT 1
              FROM "inventory_holds" AS hold
              WHERE hold."queue_entry_id" = queue."id"
                AND (
                  hold."status" = 'AUTHORIZED'
                  OR (
                    hold."status" = 'ACTIVE'
                    AND hold."expires_at" > ${now}
                  )
                )
            )
        `;
      }
    }
    await tx.queueEntry.updateMany({
      where: {
        onsaleId: onsale.id,
        status: "ADMITTED",
        accessExpiresAt: { lte: now },
      },
      data: {
        status: "EXPIRED",
        lastSeenAt: now,
      },
    });

    if (this.phaseFor(onsale, now) !== "OPEN" || !onsale.queueEnabled) {
      return;
    }

    const unpositioned = await tx.queueEntry.count({
      where: {
        onsaleId: onsale.id,
        phase: "PREQUEUE",
        status: "WAITING",
        position: null,
      },
    });
    let lastQueuePosition = onsale.lastQueuePosition;
    if (unpositioned > 0) {
      await tx.$executeRaw`
        WITH ranked AS (
          SELECT
            "id",
            (ROW_NUMBER() OVER (
              ORDER BY "fairness_key" ASC, "joined_at" ASC, "id" ASC
            ) + ${lastQueuePosition})::int AS "position"
          FROM "queue_entries"
          WHERE "onsale_id" = ${onsale.id}
            AND "phase" = 'PREQUEUE'
            AND "status" = 'WAITING'
            AND "position" IS NULL
        )
        UPDATE "queue_entries" AS queue
        SET "position" = ranked."position"
        FROM ranked
        WHERE queue."id" = ranked."id"
      `;
      lastQueuePosition += unpositioned;
    }
    if (unpositioned > 0 || !onsale.queueFinalizedAt) {
      await tx.onsale.update({
        where: { id: onsale.id },
        data: {
          lastQueuePosition,
          queueFinalizedAt: onsale.queueFinalizedAt ?? now,
        },
      });
    }

    const activeCheckouts = await tx.queueEntry.count({
      where: {
        onsaleId: onsale.id,
        status: { in: ["ADMITTED", "CHECKOUT"] },
      },
    });
    const openSlots = Math.max(onsale.maxActiveCheckouts - activeCheckouts, 0);
    const admissionCount = Math.min(openSlots, onsale.admissionBatchSize);
    if (admissionCount <= 0) {
      return;
    }

    const candidates = await tx.queueEntry.findMany({
      where: {
        onsaleId: onsale.id,
        status: "WAITING",
        position: { not: null },
      },
      orderBy: [{ position: "asc" }, { joinedAt: "asc" }],
      take: admissionCount,
    });
    if (candidates.length === 0) {
      return;
    }
    const checkoutExpiresAt = new Date(
      Math.min(
        now.getTime() + onsale.checkoutWindowSeconds * 1_000,
        onsale.closesAt.getTime(),
      ),
    );
    await tx.queueEntry.updateMany({
      where: { id: { in: candidates.map((candidate) => candidate.id) } },
      data: {
        status: "ADMITTED",
        admittedAt: now,
        accessExpiresAt: checkoutExpiresAt,
        lastSeenAt: now,
      },
    });
    const admittedThrough = Math.max(
      onsale.admittedThrough,
      ...candidates.flatMap((candidate) =>
        candidate.position === null ? [] : [candidate.position],
      ),
    );
    await tx.onsale.update({
      where: { id: onsale.id },
      data: { admittedThrough },
    });
    await tx.auditLog.createMany({
      data: candidates.map((candidate) => ({
        actorId: candidate.userId,
        action: "ONSALE_QUEUE_ADMITTED",
        entityType: "queue_entry",
        entityId: candidate.id,
        metadataJson: {
          eventId: onsale.eventId,
          position: candidate.position,
          checkoutExpiresAt: checkoutExpiresAt.toISOString(),
        },
      })),
    });
  }

  private async queueAssignment(
    tx: Prisma.TransactionClient,
    onsale: Onsale,
    entryId: string,
    now: Date,
  ) {
    const phase = now < onsale.opensAt ? "PREQUEUE" : "LIVE";
    if (phase === "PREQUEUE") {
      return {
        phase,
        position: null,
        fairnessKey: this.fairnessKey(onsale, entryId),
      };
    }

    const position = onsale.lastQueuePosition + 1;
    await tx.onsale.update({
      where: { id: onsale.id },
      data: { lastQueuePosition: position },
    });
    return {
      phase,
      position,
      fairnessKey: this.fairnessKey(onsale, entryId),
    };
  }

  private async queueSnapshot(onsale: Onsale | null, now: Date) {
    if (!onsale) {
      return {
        enabled: false,
        joined: 0,
        waiting: 0,
        inCheckout: 0,
        completed: 0,
        expired: 0,
        blocked: 0,
        currentBatch: null,
        admittedThrough: 0,
        lastAssignedPosition: 0,
        checkoutWindowSeconds: null,
        purchaseLimitPerAccount: null,
      };
    }

    const [statusGroups, activeRange] = await Promise.all([
      this.prisma.queueEntry.groupBy({
        by: ["status"],
        where: { onsaleId: onsale.id },
        _count: { _all: true },
      }),
      this.prisma.queueEntry.aggregate({
        where: {
          onsaleId: onsale.id,
          status: { in: ["ADMITTED", "CHECKOUT"] },
        },
        _min: { position: true },
        _max: { position: true },
      }),
    ]);
    const count = new Map(
      statusGroups.map((group) => [group.status, group._count._all]),
    );
    const currentBatch =
      activeRange._min.position !== null && activeRange._max.position !== null
        ? {
            from: activeRange._min.position,
            to: activeRange._max.position,
          }
        : null;
    return {
      enabled: onsale.queueEnabled,
      joined: statusGroups.reduce(
        (total, group) => total + group._count._all,
        0,
      ),
      waiting: count.get("WAITING") ?? 0,
      inCheckout: (count.get("ADMITTED") ?? 0) + (count.get("CHECKOUT") ?? 0),
      completed: count.get("COMPLETED") ?? 0,
      expired: count.get("EXPIRED") ?? 0,
      blocked: count.get("BLOCKED") ?? 0,
      currentBatch,
      admittedThrough: onsale.admittedThrough,
      lastAssignedPosition: onsale.lastQueuePosition,
      checkoutWindowSeconds: onsale.checkoutWindowSeconds,
      purchaseLimitPerAccount: onsale.purchaseLimitPerUser,
      waitingRoomOpensAt: onsale.waitingRoomOpensAt.toISOString(),
      opensAt: onsale.opensAt.toISOString(),
      closesAt: onsale.closesAt.toISOString(),
      positionFinalized: Boolean(
        onsale.queueFinalizedAt && now >= onsale.opensAt,
      ),
    };
  }

  private allocationSnapshot(
    onsale: Onsale | null,
    inventory: EventInventorySnapshot,
    venueCapacity: number,
  ) {
    const categories = this.allocationCategories(
      onsale?.allocationBreakdown,
      inventory.publicSaleAllocation,
      venueCapacity,
    );
    const disclosedTotal = categories.reduce(
      (total, category) => total + category.quantity,
      0,
    );
    return {
      venueCapacity,
      publicSaleAllocation: inventory.publicSaleAllocation,
      notInPublicSale: Math.max(
        venueCapacity - inventory.publicSaleAllocation,
        0,
      ),
      categories,
      fullyDisclosed: disclosedTotal === venueCapacity,
      policyVersion: onsale?.allocationPolicyVersion ?? "catalog-supply-v1",
      publishedAt: onsale?.allocationPublishedAt.toISOString() ?? null,
    };
  }

  private allocationCategories(
    value: Prisma.JsonValue | undefined,
    publicSaleAllocation: number,
    venueCapacity: number,
  ): AllocationCategory[] {
    const parsed = Array.isArray(value)
      ? value.flatMap((candidate) => {
          if (!this.isJsonObject(candidate)) {
            return [];
          }
          const key = candidate.key;
          const label = candidate.label;
          const quantity = candidate.quantity;
          const publicSale = candidate.publicSale;
          if (
            typeof key !== "string" ||
            typeof label !== "string" ||
            typeof quantity !== "number" ||
            !Number.isInteger(quantity) ||
            quantity < 0 ||
            typeof publicSale !== "boolean"
          ) {
            return [];
          }
          return [{ key, label, quantity, publicSale }];
        })
      : [];
    const normalized = parsed.map((category) =>
      category.publicSale
        ? { ...category, quantity: publicSaleAllocation }
        : category,
    );
    if (!normalized.some((category) => category.publicSale)) {
      normalized.unshift({
        key: "public_sale",
        label: "Public sale",
        quantity: publicSaleAllocation,
        publicSale: true,
      });
    }
    const disclosed = normalized.reduce(
      (total, category) => total + category.quantity,
      0,
    );
    if (disclosed < venueCapacity) {
      normalized.push({
        key: "not_disclosed",
        label: "Not yet disclosed",
        quantity: venueCapacity - disclosed,
        publicSale: false,
      });
    }
    return normalized;
  }

  private fairnessSnapshot(onsale: Onsale, now: Date) {
    const seed = this.onsaleSeed(onsale);
    const closed = this.phaseFor(onsale, now) === "CLOSED";
    return {
      method: "RANDOMIZED_PREQUEUE_THEN_FIFO",
      version: onsale.fairnessVersion,
      commitment: createHash("sha256").update(seed).digest("hex"),
      reveal: closed ? seed.toString("hex") : null,
      explanation:
        "Accounts present before opening are shuffled once; later arrivals are appended in arrival order.",
    };
  }

  private fairnessKey(onsale: Onsale, entryId: string) {
    return createHmac("sha256", this.onsaleSeed(onsale))
      .update(entryId)
      .digest("hex");
  }

  private onsaleSeed(onsale: Onsale) {
    return createHmac("sha256", this.queueSecret())
      .update(
        `onsale-seed:${onsale.id}:${onsale.opensAt.toISOString()}:${onsale.fairnessVersion}`,
      )
      .digest();
  }

  private identityHash(clientInstanceId: string) {
    return createHmac("sha256", this.queueSecret())
      .update(`client-instance:${clientInstanceId}`)
      .digest("hex");
  }

  private queueSecret() {
    return (
      this.config.get<string>("FANPASS_ONSALE_QUEUE_SECRET") ??
      process.env.FANPASS_ONSALE_QUEUE_SECRET ??
      "fanpass-local-onsale-queue-secret-only"
    );
  }

  private phaseFor(onsale: Onsale | null, now: Date) {
    if (!onsale) {
      return "DIRECT";
    }
    if (onsale.status === "PAUSED") {
      return "PAUSED";
    }
    if (onsale.status === "CLOSED" || now >= onsale.closesAt) {
      return "CLOSED";
    }
    if (now < onsale.waitingRoomOpensAt) {
      return "SCHEDULED";
    }
    if (now < onsale.opensAt) {
      return "WAITING_ROOM";
    }
    return onsale.status === "OPEN" ? "OPEN" : "SCHEDULED";
  }

  private assertQueueJoinable(onsale: Onsale, now: Date) {
    const phase = this.phaseFor(onsale, now);
    if (phase === "PAUSED") {
      throw new ConflictException("This sale is temporarily paused");
    }
    if (phase === "CLOSED") {
      throw new ConflictException("This sale is closed");
    }
    if (phase === "SCHEDULED") {
      throw new ConflictException("The waiting room is not open yet");
    }
  }

  private assertClientInstanceId(value: string) {
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
      throw new BadRequestException("A valid app installation ID is required");
    }
  }

  private async lockOnsale(tx: Prisma.TransactionClient, onsaleId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "onsales"
      WHERE "id" = ${onsaleId}
      FOR UPDATE
    `;
    if (rows.length !== 1) {
      throw new BadRequestException("Sale configuration is unavailable");
    }
  }

  private async lockEvent(tx: Prisma.TransactionClient, eventId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "events"
      WHERE "id" = ${eventId}
      FOR UPDATE
    `;
    if (rows.length !== 1) {
      throw new ConflictException("Event is not available");
    }
  }

  private async recordQueueJoin(
    tx: Prisma.TransactionClient,
    entryId: string,
    userId: string,
    eventId: string,
    rejoined: boolean,
  ) {
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: rejoined ? "ONSALE_QUEUE_REJOINED" : "ONSALE_QUEUE_JOINED",
        entityType: "queue_entry",
        entityId: entryId,
        metadataJson: {
          eventId,
          accountBound: true,
          clientInstanceBound: false,
          clientInstanceSignal: "UNATTESTED_LOCAL_ONLY",
        },
      },
    });
  }

  private safeQueueReference(entryId: string) {
    return `FPQ-${createHash("sha256")
      .update(entryId)
      .digest("hex")
      .slice(0, 8)
      .toUpperCase()}`;
  }

  private queueMessage(status: string, position: number | null) {
    if (status === "WAITING") {
      return position
        ? `Queue position ${position}. Tickets are not guaranteed.`
        : "Your position will be finalized when the sale opens.";
    }
    if (status === "ADMITTED" || status === "CHECKOUT") {
      return "Your checkout window is open.";
    }
    if (status === "COMPLETED") {
      return "This queue checkout is complete.";
    }
    if (status === "BLOCKED") {
      return "Queue access is unavailable for this account.";
    }
    return "This queue place expired. You can rejoin at the end of the line.";
  }

  private isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private assertPrismaDataSource() {
    const dataSource =
      this.config.get<string>("FANPASS_DATA_SOURCE") ??
      process.env.FANPASS_DATA_SOURCE;
    if (dataSource !== "prisma") {
      throw new ServiceUnavailableException(
        "On-sale transparency requires the Prisma data source",
      );
    }
  }

  private assertProductionQueueAttestationAvailable() {
    if (
      isProductionLikeEnvironment({
        NODE_ENV: this.config.get<string>("NODE_ENV") ?? process.env.NODE_ENV,
        FANPASS_ENV:
          this.config.get<string>("FANPASS_ENV") ?? process.env.FANPASS_ENV,
      })
    ) {
      throw new ServiceUnavailableException(
        "High-demand queue access is unavailable until device attestation is enabled",
      );
    }
  }
}
