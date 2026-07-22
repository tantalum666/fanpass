import { createDemoSeed, demoSeedIds } from "../src/common/demo-seed";

describe("createDemoSeed", () => {
  it("keeps the 5 HKD family ticket uncapped for checkout", () => {
    const seed = createDemoSeed();

    expect(
      seed.ticketTypes.find((ticketType) => ticketType.id === "evt_family_ga"),
    ).toMatchObject({
      eventId: "evt_family",
      faceValue: 5,
      resaleCap: null,
      maxTransferCount: 2,
    });
  });

  it("adds a 6 HKD ticket with two allowed transfers to another event", () => {
    const seed = createDemoSeed();

    expect(
      seed.ticketTypes.find(
        (ticketType) => ticketType.id === demoSeedIds.comedyPreviewTicketTypeId,
      ),
    ).toMatchObject({
      eventId: "evt_comedy",
      name: "Preview Pass",
      faceValue: 6,
      resaleCap: null,
      maxTransferCount: 2,
      transferable: true,
    });
  });

  it("gives every tokenized demo ticket a complete immutable contract route", () => {
    const seed = createDemoSeed({ includeMarketDepth: true });
    const tokenizedTickets = seed.tickets.filter(
      (ticket) => ticket.tokenId !== null,
    );

    expect(tokenizedTickets).not.toHaveLength(0);
    for (const ticket of tokenizedTickets) {
      expect(ticket).toMatchObject({
        ownershipContractAddress: "0x0000000000000000000000000000000000003137",
        ownershipChainId: "31337",
        ownershipContractVersion: "fanpass-ticket-v1",
      });
    }
  });
});
