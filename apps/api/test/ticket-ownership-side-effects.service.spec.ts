import { ConfigService } from "@nestjs/config";
import { TicketOwnershipSideEffectsService } from "../src/modules/side-effects/ticket-ownership-side-effects.service";

describe("TicketOwnershipSideEffectsService", () => {
  const issueInput = {
    localTicketId: "tkt_demo_new",
    tokenIdHint: "42",
    eventId: "evt_weekend_demo",
    ticketTypeId: "tt_cat2_demo",
    ownerId: "usr_fan_demo",
    ownerWalletAddress: null,
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
        localTicketId: "tkt_demo_new",
        ticketTypeId: "tt_cat2_demo",
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

class FakeOutbox {
  enqueued: unknown[] = [];

  async enqueueStandalone(input: unknown) {
    this.enqueued.push(input);
    return input;
  }
}
