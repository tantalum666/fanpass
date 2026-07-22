import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DemoStore } from "../src/common/demo-store";
import { walletBindingFingerprint } from "../src/common/wallet-binding";
import { AuditService } from "../src/modules/audit/audit.service";
import { OwnershipService } from "../src/modules/ownership/ownership.service";
import { TicketOwnershipSideEffectsService } from "../src/modules/side-effects/ticket-ownership-side-effects.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";

describe("TicketsService", () => {
  let store: DemoStore;
  let tickets: TicketsService;

  beforeEach(() => {
    store = new DemoStore();
    tickets = new TicketsService(
      store,
      new AuditService(store),
      new TicketOwnershipSideEffectsService(
        new OwnershipService(new ConfigService()),
      ),
    );
  });

  it("issues active tickets and writes an audit entry", async () => {
    verifyTestWallet(store, "usr_fan_demo", "wal_test_fan");
    const ticket = await tickets.issueTicket({
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ownerId: "usr_fan_demo",
      seatHash: "section-101-row-a-seat-1",
    });

    expect(ticket).toMatchObject({
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ownerId: "usr_fan_demo",
      status: "ACTIVE",
    });
    expect(store.auditLogs[0]).toMatchObject({
      action: "TICKET_ISSUED",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: expect.objectContaining({
        ownershipAdapter: "mock",
      }),
    });
  });

  it("keeps a ticket unusable while ownership issuance is pending", async () => {
    verifyTestWallet(store, "usr_fan_demo", "wal_test_fan");
    const issueTicket = jest.fn().mockResolvedValue({
      adapter: "privy",
      status: "PENDING",
      tokenId: "provisional",
      ownershipRef: "pending:ownership-issue:tkt_pending",
      transactionHash: "0xpending",
    });
    const pendingTickets = new TicketsService(store, new AuditService(store), {
      issueTicket,
    } as never);

    const ticket = await pendingTickets.issueTicket({
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ownerId: "usr_fan_demo",
    });

    expect(ticket).toMatchObject({ status: "CREATED", tokenId: null });
    expect(issueTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerWalletAddress: "0x0000000000000000000000000000000000002001",
        ownerWalletBindingVersion: 1,
        ownerWalletBindingFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(() => pendingTickets.assertCanGenerateEntryPayload(ticket)).toThrow(
      "cannot generate an entry code",
    );
    expect(() =>
      pendingTickets.markListedForResale(ticket.id, ticket.ownerId, 1200),
    ).toThrow("cannot be listed");
  });

  it("fails closed before minting when the owner wallet binding is unverified", async () => {
    const issueTicket = jest.fn();
    const unverifiedTickets = new TicketsService(
      store,
      new AuditService(store),
      { issueTicket } as never,
    );

    await expect(
      unverifiedTickets.issueTicket({
        eventId: "evt_weekend_demo",
        ticketTypeId: "tt_cat2_demo",
        ownerId: "usr_fan_demo",
      }),
    ).rejects.toThrow("Ticket owner wallet is not verified for custody");
    expect(issueTicket).not.toHaveBeenCalled();
    expect(store.tickets).toHaveLength(1);
  });

  it("creates the pending ticket, consumes its hold, and links the matched order in one transaction", async () => {
    verifyTestWallet(store, "usr_fan_demo", "wal_test_fan");
    const owner = store.users.find(
      (candidate) => candidate.id === "usr_fan_demo",
    )!;
    const issueTicket = jest.fn().mockResolvedValue({
      adapter: "privy",
      status: "PENDING",
      tokenId: "17",
      ownershipRef: "pending:ownership-issue:tkt_atomic",
      transactionHash: null,
    });
    const createTicket = jest.fn(async ({ data }: { data: any }) => data);
    const linkOrder = jest.fn().mockResolvedValue({ count: 1 });
    const createAudit = jest.fn().mockResolvedValue({});
    const tx = {
      ticket: { create: createTicket },
      order: { updateMany: linkOrder },
      auditLog: { create: createAudit },
    };
    const transaction = jest.fn(
      async (operation: (client: typeof tx) => Promise<unknown>) =>
        operation(tx),
    );
    const consumeHold = jest.fn().mockResolvedValue({});
    const prisma = {
      event: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "evt_weekend_demo",
          organizer: { userId: "usr_organizer_demo" },
        }),
      },
      ticketType: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "tt_cat2_demo",
          eventId: "evt_weekend_demo",
          transferable: true,
          resaleCap: 1400,
          maxTransferCount: 1,
        }),
      },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue(owner) },
      inventoryHold: {
        findUnique: jest.fn().mockResolvedValue({
          id: "hold_primary_atomic",
          orderId: "ord_primary_atomic",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          userId: "usr_fan_demo",
        }),
      },
      ticket: { count: jest.fn().mockResolvedValue(16) },
      $transaction: transaction,
    };
    const prismaTickets = new TicketsService(
      store,
      new AuditService(store),
      {
        usesOutboxProofSync: jest.fn(() => true),
        issueTicket,
      } as never,
      new ConfigService({ FANPASS_DATA_SOURCE: "prisma" }),
      prisma as never,
      { consumeHold } as never,
    );

    await expect(
      prismaTickets.issueTicket({
        eventId: "evt_weekend_demo",
        ticketTypeId: "tt_cat2_demo",
        ownerId: "usr_fan_demo",
        inventoryHoldId: "hold_primary_atomic",
        orderId: "ord_primary_atomic",
      }),
    ).resolves.toMatchObject({ status: "CREATED", tokenId: null });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(issueTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerWalletBindingVersion: 1,
        ownerWalletBindingFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      { writer: tx },
    );
    expect(consumeHold).toHaveBeenCalledWith(tx, {
      holdId: "hold_primary_atomic",
      ticketId: expect.stringMatching(/^tkt_/),
    });
    expect(linkOrder).toHaveBeenCalledWith({
      where: {
        id: "ord_primary_atomic",
        userId: "usr_fan_demo",
        eventId: "evt_weekend_demo",
        ticketTypeId: "tt_cat2_demo",
        side: "BUY",
        status: "MATCHED",
        ticketId: null,
      },
      data: { ticketId: expect.stringMatching(/^tkt_/) },
    });
    expect(createTicket.mock.invocationCallOrder[0]).toBeLessThan(
      linkOrder.mock.invocationCallOrder[0],
    );
  });

  it("blocks listing redeemed tickets", () => {
    const ticket = store.getTicket("tkt_demo_001");
    ticket.status = "REDEEMED";

    expect(() =>
      tickets.markListedForResale(ticket.id, ticket.ownerId, 1300),
    ).toThrow(BadRequestException);
    expect(ticket.status).toBe("REDEEMED");
  });

  it("blocks listing tickets over transfer limit", () => {
    const ticket = store.getTicket("tkt_demo_001");
    ticket.transferCount = store.getTicketType(
      ticket.ticketTypeId,
    ).maxTransferCount;

    expect(() =>
      tickets.markListedForResale(ticket.id, ticket.ownerId, 1300),
    ).toThrow(BadRequestException);
    expect(ticket.status).toBe("ACTIVE");
  });

  it("allows fans to fetch only their own ticket by id", () => {
    expect(
      tickets.getTicket("tkt_demo_001", {
        userId: "usr_fan_demo",
        role: "FAN",
      }),
    ).toMatchObject({
      id: "tkt_demo_001",
      ownerId: "usr_fan_demo",
    });

    expect(() =>
      tickets.getTicket("tkt_demo_001", {
        userId: "usr_buyer_demo",
        role: "FAN",
      }),
    ).toThrow(ForbiddenException);
  });

  it("scopes organizer ticket inventory to owned events", async () => {
    store.users.push({
      id: "usr_other_organizer",
      name: "Other Organizer",
      email: "other-organizer@fanpass.test",
      role: "ORGANIZER",
      privyId: "did:privy:other-organizer-demo",
      walletAddress: null,
      riskScore: 0,
    });
    store.organizers.push({
      id: "org_other_demo",
      userId: "usr_other_organizer",
      organizationName: "Other Events Ltd",
      verificationStatus: "APPROVED",
      payoutAccountId: null,
    });
    store.events.push({
      id: "evt_other_demo",
      organizerId: "org_other_demo",
      title: "Other Organizer Private Event",
      venueId: "ven_kaitak_demo",
      startTime: "2026-12-01T20:00:00+08:00",
      endTime: "2026-12-01T23:00:00+08:00",
      status: "PUBLISHED",
      posterUrl: null,
    });
    store.ticketTypes.push({
      id: "tt_other_demo",
      eventId: "evt_other_demo",
      name: "PRIVATE",
      faceValue: 999,
      currency: "HKD",
      supply: 10,
      transferable: true,
      resaleCap: 1199,
      maxTransferCount: 1,
    });
    store.tickets.push({
      id: "tkt_other_demo",
      tokenId: "99",
      eventId: "evt_other_demo",
      ticketTypeId: "tt_other_demo",
      ownerId: "usr_fan_demo",
      seatHash: null,
      status: "ACTIVE",
      transferCount: 0,
      metadataUri: null,
    });

    const scopedTickets = await tickets.listTickets({
      userId: "usr_organizer_demo",
      role: "ORGANIZER",
    });

    expect(scopedTickets.map((ticket) => ticket.id)).toEqual(["tkt_demo_001"]);
    expect(() =>
      tickets.getTicket("tkt_other_demo", {
        userId: "usr_organizer_demo",
        role: "ORGANIZER",
      }),
    ).toThrow(ForbiddenException);
    await expect(
      tickets.issueTicket(
        {
          eventId: "evt_other_demo",
          ticketTypeId: "tt_other_demo",
          ownerId: "usr_fan_demo",
        },
        {
          userId: "usr_organizer_demo",
          role: "ORGANIZER",
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("returns redacted proof history only to the ticket owner", async () => {
    const proofStore = new DemoStore({ includeMarketDepth: true });
    const proofTickets = new TicketsService(
      proofStore,
      new AuditService(proofStore),
      new TicketOwnershipSideEffectsService(
        new OwnershipService(new ConfigService()),
      ),
    );
    const proofHistory = await proofTickets.getProofHistory("tkt_demo_003", {
      userId: "usr_buyer_demo",
      role: "FAN",
    });

    expect(proofHistory.items).toHaveLength(4);
    expect(proofHistory.items[0]).toMatchObject({
      id: "issued",
      safeTicketRef: "FP-EMO003",
    });
    expect(JSON.stringify(proofHistory)).not.toMatch(
      /ownerId|ownerIdHash|nonce|signature|walletAddress|provider|accessToken|bearer/i,
    );

    await expect(
      proofTickets.getProofHistory("tkt_demo_003", {
        userId: "usr_fan_demo",
        role: "FAN",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("queries chain proof from the ticket route instead of the current global contract", async () => {
    const oldContract = "0x0000000000000000000000000000000000001000";
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: "0x" }),
    } as Response);
    const routedTickets = new TicketsService(
      store,
      new AuditService(store),
      new TicketOwnershipSideEffectsService(
        new OwnershipService(new ConfigService()),
      ),
      new ConfigService({
        TESTNET_RPC_URL: "https://rpc.testnet.example",
        TESTNET_CHAIN_ID: "11155111",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000002000",
      }),
    );

    await (
      routedTickets as unknown as {
        buildChainProof(input: Record<string, unknown>): Promise<unknown>;
      }
    ).buildChainProof({
      id: "tkt_old_contract",
      tokenId: "42",
      ownershipContractAddress: oldContract,
      ownershipChainId: "11155111",
      ownershipContractVersion: "fanpass-ticket-v1",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      transferable: true,
      resaleCap: 1200,
      maxTransferCount: 2,
      metadataUri: null,
      ownerWalletAddress: null,
      auditLogs: [],
    });

    const rpcRequest = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body),
    ) as { method: string; params: unknown[] };
    expect(rpcRequest).toMatchObject({
      method: "eth_getCode",
      params: [oldContract, "latest"],
    });
    fetchMock.mockRestore();
  });
});

function verifyTestWallet(store: DemoStore, userId: string, walletId: string) {
  const user = store.users.find((candidate) => candidate.id === userId);
  if (!user?.privyId || !user.walletAddress) {
    throw new Error(`Missing wallet fixture for ${userId}`);
  }
  user.privyWalletId = walletId;
  user.walletBindingStatus = "VERIFIED";
  user.walletBindingVerifiedAt = "2026-07-20T00:00:00.000Z";
  user.walletBindingVersion = 1;
  user.walletBindingFingerprint = walletBindingFingerprint({
    privyId: user.privyId,
    walletId,
    walletAddress: user.walletAddress,
  });
}
