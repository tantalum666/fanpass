import { readFileSync } from "fs";
import { resolve } from "path";
import {
  DISPATCH_RESUME_CONFIRMATION,
  parseDispatchControlArguments,
  redactedDispatchControlError,
  runSideEffectDispatchControl,
} from "../src/workers/side-effect-dispatch-control";

describe("side-effect dispatch control", () => {
  it("installs a default-paused singleton and a revision-fenced DB trigger", () => {
    const sql = readFileSync(
      resolve(
        __dirname,
        "../prisma/deploy/20260720_side_effect_dispatch_control.sql",
      ),
      "utf8",
    );

    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS side_effect_dispatch_control",
    );
    expect(sql).toContain("VALUES ('global', true, 1, NULL, NULL)");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS dispatch_revision bigint");
    expect(sql).toContain("fanpass_guard_side_effect_dispatch_claim");
    expect(sql).toContain("NEW.dispatch_revision := NULL");
    expect(sql).toContain("side_effect_outbox_dispatch_guard");
    expect(sql).toContain("side_effect_dispatch_control_state_check");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("NEW.dispatch_revision <> dispatch_control.revision");
    expect(sql).toContain("paused = remaining_claims = 1");
  });

  it("accepts only an explicit one-job controlled probe", () => {
    expect(
      parseDispatchControlArguments([
        "resume",
        "--confirm",
        DISPATCH_RESUME_CONFIRMATION,
        "--probe-limit",
        "1",
      ]),
    ).toEqual({
      action: "resume",
      confirmation: DISPATCH_RESUME_CONFIRMATION,
      probeLimit: 1,
    });
    expect(() =>
      parseDispatchControlArguments([
        "resume",
        "--confirm",
        DISPATCH_RESUME_CONFIRMATION,
        "--probe-limit",
        "2",
      ]),
    ).toThrow("Controlled probe limit must be exactly 1");
  });

  it("rejects resume without the exact confirmation", async () => {
    const prisma = mockPrisma([]);
    await expect(
      runSideEffectDispatchControl(prisma as never, ["resume"]),
    ).rejects.toThrow(
      `Resume requires --confirm ${DISPATCH_RESUME_CONFIRMATION}`,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks unlimited resume while active backlog exists", async () => {
    const before = aggregate({ activeBacklog: 2n });
    const prisma = mockPrisma([[{ id: "global" }], [before]]);

    await expect(
      runSideEffectDispatchControl(prisma as never, [
        "resume",
        "--confirm",
        DISPATCH_RESUME_CONFIRMATION,
      ]),
    ).rejects.toThrow("active backlog must be zero");
    expect(prisma.writer.$executeRaw).not.toHaveBeenCalled();
  });

  it("resumes only one exact claimable job with a database-enforced one-claim budget", async () => {
    const before = aggregate({ activeBacklog: 1n, claimableBacklog: 1n });
    const after = aggregate({
      paused: false,
      revision: 8n,
      remainingClaims: 1,
      activeBacklog: 1n,
      claimableBacklog: 1n,
    });
    const prisma = mockPrisma([
      [{ id: "global" }],
      [before],
      [{ id: "sfx_exact_probe" }],
      [after],
    ]);

    await expect(
      runSideEffectDispatchControl(prisma as never, [
        "resume",
        `--confirm=${DISPATCH_RESUME_CONFIRMATION}`,
        "--probe-limit=1",
      ]),
    ).resolves.toEqual({
      ok: true,
      action: "resume",
      control: { paused: false, revision: "8", remainingClaims: 1 },
      counts: outputCounts(after),
    });
    expect(prisma.writer.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.writer.$executeRaw.mock.calls[0]?.[1]).toBe(1);
    expect(prisma.writer.$executeRaw.mock.calls[0]?.[2]).toBe(
      "sfx_exact_probe",
    );
  });

  it("rejects an arbitrary queue when more than one probe job is claimable", async () => {
    const prisma = mockPrisma([
      [{ id: "global" }],
      [aggregate({ activeBacklog: 2n, claimableBacklog: 2n })],
    ]);

    await expect(
      runSideEffectDispatchControl(prisma as never, [
        "resume",
        `--confirm=${DISPATCH_RESUME_CONFIRMATION}`,
        "--probe-limit=1",
      ]),
    ).rejects.toThrow("exactly one active and claimable job");
    expect(prisma.writer.$executeRaw).not.toHaveBeenCalled();
  });

  it.each([
    ["processing", { processing: 1n }],
    ["failed", { failed: 1n }],
    ["dead", { dead: 1n }],
    ["unknown outbox", { unknownOutboxState: 1n }],
    ["unknown active type", { activeUnknownType: 1n }],
    ["ownership ambiguous", { ownershipAmbiguous: 1n }],
    ["ownership adapter", { activeOwnershipWrongAdapter: 1n }],
    ["ownership route", { activeOwnershipInvalidRoute: 1n }],
    ["ticket route", { activeOwnershipTicketRouteMismatch: 1n }],
    ["provider unknown", { providerUnknownState: 1n }],
    ["sponsored nonterminal", { sponsoredNonterminal: 1n }],
    ["sponsored ambiguous", { sponsoredAmbiguous: 1n }],
    ["sponsored compensation", { sponsoredCompensationRequired: 1n }],
    ["sponsored failed", { sponsoredFailed: 1n }],
    ["sponsored expired lease", { sponsoredExpiredLease: 1n }],
    ["sponsored unknown state", { sponsoredUnknownState: 1n }],
  ])("blocks resume for %s jobs", async (_label, overrides) => {
    const prisma = mockPrisma([[{ id: "global" }], [aggregate(overrides)]]);
    await expect(
      runSideEffectDispatchControl(prisma as never, [
        "resume",
        `--confirm=${DISPATCH_RESUME_CONFIRMATION}`,
        "--probe-limit=1",
      ]),
    ).rejects.toThrow("must all be zero");
    expect(prisma.writer.$executeRaw).not.toHaveBeenCalled();
  });

  it("commits pause before returning an unsafe in-flight aggregate", async () => {
    const after = aggregate({ processing: 1n });
    const prisma = mockPrisma([[{ id: "global" }], [after]]);

    await expect(
      runSideEffectDispatchControl(prisma as never, ["pause"]),
    ).resolves.toEqual({
      ok: false,
      action: "pause",
      error: {
        code: "PAUSED_WITH_UNRESOLVED_SIDE_EFFECTS",
        message: expect.stringContaining("Dispatch is paused"),
      },
      control: { paused: true, revision: "7", remainingClaims: null },
      counts: outputCounts(after),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.writer.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("redacts unexpected database failures", () => {
    const redacted = redactedDispatchControlError(
      new Error("postgresql://operator:secret@private-db/internal"),
    );
    expect(redacted).toEqual({
      ok: false,
      error: {
        code: "DISPATCH_CONTROL_UNAVAILABLE",
        message: "Side-effect dispatch control is unavailable",
      },
    });
    expect(JSON.stringify(redacted)).not.toContain("secret");
  });
});

function aggregate(
  overrides: Partial<{
    paused: boolean;
    revision: bigint;
    remainingClaims: number | null;
    processing: bigint;
    failed: bigint;
    dead: bigint;
    activeBacklog: bigint;
    claimableBacklog: bigint;
    unknownOutboxState: bigint;
    activeUnknownType: bigint;
    ownershipAmbiguous: bigint;
    activeOwnershipWrongAdapter: bigint;
    activeOwnershipInvalidRoute: bigint;
    activeOwnershipTicketRouteMismatch: bigint;
    providerUnresolved: bigint;
    providerUnknownState: bigint;
    sponsoredNonterminal: bigint;
    sponsoredAmbiguous: bigint;
    sponsoredCompensationRequired: bigint;
    sponsoredFailed: bigint;
    sponsoredExpiredLease: bigint;
    sponsoredUnknownState: bigint;
  }> = {},
) {
  return {
    paused: true,
    revision: 7n,
    remainingClaims: null,
    processing: 0n,
    failed: 0n,
    dead: 0n,
    activeBacklog: 0n,
    claimableBacklog: 0n,
    unknownOutboxState: 0n,
    activeUnknownType: 0n,
    ownershipAmbiguous: 0n,
    activeOwnershipWrongAdapter: 0n,
    activeOwnershipInvalidRoute: 0n,
    activeOwnershipTicketRouteMismatch: 0n,
    providerUnresolved: 0n,
    providerUnknownState: 0n,
    sponsoredNonterminal: 0n,
    sponsoredAmbiguous: 0n,
    sponsoredCompensationRequired: 0n,
    sponsoredFailed: 0n,
    sponsoredExpiredLease: 0n,
    sponsoredUnknownState: 0n,
    ...overrides,
  };
}

function outputCounts(row: ReturnType<typeof aggregate>) {
  return {
    processing: Number(row.processing),
    failed: Number(row.failed),
    dead: Number(row.dead),
    activeBacklog: Number(row.activeBacklog),
    claimableBacklog: Number(row.claimableBacklog),
    unknownOutboxState: Number(row.unknownOutboxState),
    activeUnknownType: Number(row.activeUnknownType),
    ownershipAmbiguous: Number(row.ownershipAmbiguous),
    activeOwnershipWrongAdapter: Number(row.activeOwnershipWrongAdapter),
    activeOwnershipInvalidRoute: Number(row.activeOwnershipInvalidRoute),
    activeOwnershipTicketRouteMismatch: Number(
      row.activeOwnershipTicketRouteMismatch,
    ),
    providerUnresolved: Number(row.providerUnresolved),
    providerUnknownState: Number(row.providerUnknownState),
    sponsoredNonterminal: Number(row.sponsoredNonterminal),
    sponsoredAmbiguous: Number(row.sponsoredAmbiguous),
    sponsoredCompensationRequired: Number(row.sponsoredCompensationRequired),
    sponsoredFailed: Number(row.sponsoredFailed),
    sponsoredExpiredLease: Number(row.sponsoredExpiredLease),
    sponsoredUnknownState: Number(row.sponsoredUnknownState),
  };
}

function mockPrisma(queryResults: unknown[][]) {
  const writer = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  for (const result of queryResults) {
    writer.$queryRaw.mockResolvedValueOnce(result);
  }
  const prisma = {
    writer,
    $queryRaw: writer.$queryRaw,
    $executeRaw: writer.$executeRaw,
    $transaction: jest.fn(
      async (callback: (tx: typeof writer) => Promise<unknown>) =>
        callback(writer),
    ),
  };
  return prisma;
}
