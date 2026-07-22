import { ConfigService } from "@nestjs/config";
import { TicketOwnershipSideEffectsService } from "../src/modules/side-effects/ticket-ownership-side-effects.service";
import { SettlementSideEffectsService } from "../src/modules/side-effects/settlement-side-effects.service";

const contractRoute = {
  contractAddress: "0x0000000000000000000000000000000000001000",
  chainId: "11155111",
  contractVersion: "fanpass-ticket-v1" as const,
};

describe("TicketOwnershipSideEffectsService", () => {
  const issueInput = {
    localTicketId: "tkt_demo_new",
    tokenIdHint: "42",
    eventId: "evt_weekend_demo",
    ticketTypeId: "tt_cat2_demo",
    ownerId: "usr_fan_demo",
    ownerWalletAddress: null,
    ownerWalletBindingVersion: 3,
    ownerWalletBindingFingerprint: "a".repeat(64),
    transferable: true,
    resaleCap: 1200,
    maxTransferCount: 2,
    metadataUri: null,
  };

  it("uses direct ownership calls by default", async () => {
    const ownership = {
      issueTicket: jest.fn(async () => ({
        adapter: "mock",
        status: "CONFIRMED",
        tokenId: "42",
        ownershipRef: "mock:ticket:tkt_demo_new",
        transactionHash: "mock_tx",
      })),
      adapterName: jest.fn(() => "mock"),
      routeForNewTicket: jest.fn(() => null),
    };
    const service = new TicketOwnershipSideEffectsService(ownership as never);

    const receipt = await service.issueTicket(issueInput);

    expect(receipt).toMatchObject({
      status: "CONFIRMED",
      ownershipRef: "mock:ticket:tkt_demo_new",
    });
    expect(ownership.issueTicket).toHaveBeenCalledWith(issueInput);
  });

  it("enqueues ticket issue proof sync when the outbox flag is enabled", async () => {
    const outbox = new FakeOutbox();
    const ownership = {
      issueTicket: jest.fn(),
      adapterName: jest.fn(() => "mock"),
      routeForNewTicket: jest.fn(() => contractRoute),
    };
    const service = new TicketOwnershipSideEffectsService(
      ownership as never,
      outbox as never,
      new ConfigService({ FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "true" }),
    );

    const receipt = await service.issueTicket(issueInput);

    expect(receipt).toMatchObject({
      adapter: "mock",
      status: "PENDING",
      tokenId: "42",
      ownershipRef: "pending:ownership-issue:tkt_demo_new",
      transactionHash: null,
    });
    expect(ownership.issueTicket).not.toHaveBeenCalled();
    expect(outbox.enqueued[0]).toMatchObject({
      type: "OWNERSHIP_ISSUE",
      idempotencyKey: "ownership-issue:tkt_demo_new",
      aggregateType: "ticket",
      aggregateId: "tkt_demo_new",
      payload: expect.objectContaining({
        ownershipAdapter: "mock",
        localTicketId: "tkt_demo_new",
        ticketTypeId: "tt_cat2_demo",
        contractRoute,
        ownerWalletBindingVersion: 3,
        ownerWalletBindingFingerprint: "a".repeat(64),
      }),
    });
  });

  it("enqueues ticket redemption proof sync with a deterministic idempotency key", async () => {
    const outbox = new FakeOutbox();
    const ownership = {
      redeemTicket: jest.fn(),
      adapterName: jest.fn(() => "mock"),
    };
    const service = new TicketOwnershipSideEffectsService(
      ownership as never,
      outbox as never,
      new ConfigService({ FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "true" }),
    );

    const receipt = await service.redeemTicket({
      ticketId: "tkt_demo_001",
      tokenId: "1",
    });

    expect(receipt).toMatchObject({
      adapter: "mock",
      status: "PENDING",
      tokenId: "1",
      ownershipRef: "pending:ownership-redeem:tkt_demo_001",
      transactionHash: null,
    });
    expect(ownership.redeemTicket).not.toHaveBeenCalled();
    expect(outbox.enqueued[0]).toMatchObject({
      type: "OWNERSHIP_REDEEM",
      idempotencyKey: "ownership-redeem:tkt_demo_001:1",
      aggregateType: "ticket",
      aggregateId: "tkt_demo_001",
      payload: {
        ticketId: "tkt_demo_001",
        tokenId: "1",
      },
    });
  });
});

describe("SettlementSideEffectsService wallet snapshots", () => {
  it("persists both verified binding versions and fingerprints in the transfer job", async () => {
    const outbox = new FakeOutbox();
    const service = new SettlementSideEffectsService(
      { adapterName: jest.fn(() => "privy") } as never,
      outbox as never,
    );

    await service.enqueueOwnershipTransfer({} as never, {
      ticketId: "tkt_demo_001",
      tokenId: "1",
      fromOwnerId: "usr_seller",
      fromWalletAddress: "0x0000000000000000000000000000000000003001",
      fromWalletBindingVersion: 2,
      fromWalletBindingFingerprint: "b".repeat(64),
      toOwnerId: "usr_buyer",
      toWalletAddress: "0x0000000000000000000000000000000000003002",
      toWalletBindingVersion: 4,
      toWalletBindingFingerprint: "c".repeat(64),
      contractRoute,
      buyOrderId: "ord_buy",
      sellOrderId: "ord_sell",
    });

    expect(outbox.enqueued[0]).toMatchObject({
      type: "OWNERSHIP_TRANSFER",
      payload: expect.objectContaining({
        ownershipAdapter: "privy",
        fromWalletBindingVersion: 2,
        fromWalletBindingFingerprint: "b".repeat(64),
        toWalletBindingVersion: 4,
        toWalletBindingFingerprint: "c".repeat(64),
        contractRoute,
      }),
    });
  });

  it.each([
    ["AUTHORIZED", "PAYMENT_CANCEL_AUTHORIZATION"],
    ["CAPTURED", "PAYMENT_REFUND"],
  ])(
    "enqueues the correct %s payment compensation",
    async (captureStatus, expectedType) => {
      const outbox = new FakeOutbox();
      const service = new SettlementSideEffectsService(
        {} as never,
        outbox as never,
      );

      await service.enqueuePaymentCompensation({} as never, {
        paymentId: "pay_primary",
        buyOrderId: "ord_primary",
        captureStatus,
        reason: "primary_ticket_issue_failed",
      });

      expect(outbox.enqueued[0]).toMatchObject({
        type: expectedType,
        aggregateId: "pay_primary",
        payload: expect.objectContaining({
          orderId: "ord_primary",
          reason: "primary_ticket_issue_failed",
        }),
      });
    },
  );

  it("keeps the fulfilled ticket identity in both capture job variants", async () => {
    const outbox = new FakeOutbox();
    const service = new SettlementSideEffectsService(
      {} as never,
      outbox as never,
    );

    await service.enqueuePaymentCaptureForTrade({} as never, {
      paymentId: "pay_resale",
      buyOrderId: "ord_buy",
      tradeId: "trd_resale",
      ticketId: "tkt_resale",
    });
    await service.enqueuePaymentCaptureForPrimaryTicket({} as never, {
      paymentId: "pay_primary",
      buyOrderId: "ord_primary",
      ticketId: "tkt_primary",
    });

    expect(outbox.enqueued).toEqual([
      expect.objectContaining({
        type: "PAYMENT_CAPTURE",
        payload: expect.objectContaining({
          paymentId: "pay_resale",
          tradeId: "trd_resale",
          ticketId: "tkt_resale",
        }),
      }),
      expect.objectContaining({
        type: "PAYMENT_CAPTURE",
        payload: expect.objectContaining({
          paymentId: "pay_primary",
          tradeId: null,
          ticketId: "tkt_primary",
        }),
      }),
    ]);
  });
});

class FakeOutbox {
  enqueued: unknown[] = [];

  async enqueueStandalone(input: unknown) {
    this.enqueued.push(input);
    return input;
  }

  async enqueue(_writer: unknown, input: unknown) {
    this.enqueued.push(input);
    return input;
  }
}
