import { Prisma, PrismaClient } from "@prisma/client";
import { createDemoSeed } from "../src/common/demo-seed";
import { upsertPublicEvents } from "../src/workers/upsert-public-events";

describe("upsertPublicEvents", () => {
  it("upserts every campaign before its tasks inside one transaction", async () => {
    const operations: string[] = [];
    const userUpserts: Array<Record<string, unknown>> = [];
    const seed = createDemoSeed();
    const transaction = createTransactionMock(operations, seed, userUpserts);
    const prisma = {
      $transaction: jest.fn(
        async (
          operation: (client: Prisma.TransactionClient) => Promise<unknown>,
        ) => operation(transaction),
      ),
    } as unknown as PrismaClient;

    const result = await upsertPublicEvents(prisma);

    const lastCampaign = operations.lastIndexOf("fanCampaign.upsert");
    const firstTask = operations.indexOf("fanTask.upsert");
    expect(lastCampaign).toBeGreaterThanOrEqual(0);
    expect(firstTask).toBeGreaterThan(lastCampaign);
    expect(result).toMatchObject({
      ok: true,
      events: seed.events.length,
      ticketTypes: seed.ticketTypes.length,
      fanCampaigns: seed.fanCampaigns.length,
      fanTasks: seed.fanTasks.length,
      onsales: 1,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(userUpserts).toHaveLength(seed.users.length);
    for (const args of userUpserts) {
      expect(args.create).not.toEqual(
        expect.objectContaining({
          privyId: expect.anything(),
          walletAddress: expect.anything(),
        }),
      );
      expect(args.update).not.toEqual(
        expect.objectContaining({
          privyId: expect.anything(),
          privyWalletId: expect.anything(),
          walletAddress: expect.anything(),
          walletBindingStatus: expect.anything(),
          walletBindingVerifiedAt: expect.anything(),
          walletBindingVersion: expect.anything(),
          walletBindingFingerprint: expect.anything(),
        }),
      );
    }
  });
});

function createTransactionMock(
  operations: string[],
  seed: ReturnType<typeof createDemoSeed>,
  userUpserts: Array<Record<string, unknown>>,
) {
  const upsert = (name: string) =>
    jest.fn(async () => {
      operations.push(`${name}.upsert`);
      return {};
    });
  const count = (value: number) => jest.fn(async () => value);

  return {
    user: {
      upsert: jest.fn(async (args: Record<string, unknown>) => {
        operations.push("user.upsert");
        userUpserts.push(args);
        return {};
      }),
    },
    organizer: { upsert: upsert("organizer") },
    venue: { upsert: upsert("venue") },
    event: {
      upsert: upsert("event"),
      updateMany: jest.fn(async () => ({ count: 0 })),
      count: count(seed.events.length),
    },
    ticketType: {
      upsert: upsert("ticketType"),
      count: count(seed.ticketTypes.length),
    },
    onsale: { upsert: upsert("onsale"), count: count(1) },
    fanCampaign: {
      upsert: upsert("fanCampaign"),
      count: count(seed.fanCampaigns.length),
    },
    fanTask: {
      upsert: upsert("fanTask"),
      count: count(seed.fanTasks.length),
    },
    gateAssignment: { upsert: upsert("gateAssignment") },
  } as unknown as Prisma.TransactionClient;
}
