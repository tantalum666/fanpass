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
});
