import { backfillTicketOwnershipRoutes } from "../src/workers/backfill-ticket-ownership-routes";

describe("ticket ownership route backfill", () => {
  it("fails closed when an active job adapter conflicts with the reviewed legacy adapter", async () => {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ count: 0n }])
        .mockResolvedValueOnce([{ count: 1n }])
        .mockResolvedValueOnce([{ count: 0n }])
        .mockResolvedValueOnce([{ count: 0n }])
        .mockResolvedValueOnce([{ count: 1n }]),
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (writer: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };

    await expect(
      backfillTicketOwnershipRoutes(prisma as never, {
        FANPASS_LEGACY_OWNERSHIP_ADAPTER: "privy",
        FANPASS_LEGACY_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        FANPASS_LEGACY_TICKET_CHAIN_ID: "11155111",
      }),
    ).rejects.toThrow(
      "adapter snapshot that conflicts with FANPASS_LEGACY_OWNERSHIP_ADAPTER",
    );
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("blocks legacy issuance jobs that cannot be safely reconciled", async () => {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      $executeRaw: jest.fn(),
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ count: 0n }])
        .mockResolvedValueOnce([{ count: 1n }])
        .mockResolvedValueOnce([{ count: 1n }]),
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (writer: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };

    await expect(
      backfillTicketOwnershipRoutes(prisma as never, {}),
    ).rejects.toThrow(
      "old contract may not support logical-ticket reconciliation",
    );
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});
