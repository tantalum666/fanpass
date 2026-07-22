import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export type MarketplaceEventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

type MarketplaceEventLockClient = Pick<Prisma.TransactionClient, "$queryRaw">;

export async function lockMarketplaceEvent(
  transaction: MarketplaceEventLockClient,
  eventId: string,
): Promise<MarketplaceEventStatus | null> {
  const rows = await transaction.$queryRaw<Array<{ status: unknown }>>`
    SELECT "status"::text AS "status"
    FROM "events"
    WHERE "id" = ${eventId}
    FOR UPDATE
  `;
  return normalizeMarketplaceEventStatus(rows[0]?.status);
}

export function assertMarketplaceEventPublished(
  status: unknown,
  message = "Event is not available for marketplace operations",
): asserts status is "PUBLISHED" {
  if (normalizeMarketplaceEventStatus(status) !== "PUBLISHED") {
    throw new ConflictException(message);
  }
}

function normalizeMarketplaceEventStatus(
  status: unknown,
): MarketplaceEventStatus | null {
  return status === "DRAFT" || status === "PUBLISHED" || status === "CANCELLED"
    ? status
    : null;
}
