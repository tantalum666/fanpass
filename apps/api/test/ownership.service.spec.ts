import { ConfigService } from "@nestjs/config";
import { OwnershipService } from "../src/modules/ownership/ownership.service";

describe("OwnershipService", () => {
  it("uses the mock adapter by default for local Alpha ownership receipts", async () => {
    const ownership = new OwnershipService(new ConfigService());

    const receipt = await ownership.issueTicket({
      localTicketId: "tkt_local",
      tokenIdHint: "7",
      eventId: "evt_weekend_demo",
      ownerId: "usr_fan_demo",
      ownerWalletAddress: "0x0000000000000000000000000000000000002001",
      transferable: true,
      resaleCap: 1545,
      maxTransferCount: 2,
      metadataUri: null,
    });

    expect(receipt).toMatchObject({
      adapter: "mock",
      status: "CONFIRMED",
      tokenId: "7",
      ownershipRef: "mock:ticket:tkt_local",
    });
    expect(receipt.transactionHash).toMatch(/^mock_/);
  });

  it("requires testnet config only when the testnet adapter is selected", async () => {
    const ownership = new OwnershipService(
      new ConfigService({ OWNERSHIP_ADAPTER: "testnet" }),
    );

    expect(() =>
      ownership.issueTicket({
        localTicketId: "tkt_local",
        tokenIdHint: "7",
        eventId: "evt_weekend_demo",
        ownerId: "usr_fan_demo",
        ownerWalletAddress: "0x0000000000000000000000000000000000002001",
        transferable: true,
        resaleCap: 1545,
        maxTransferCount: 2,
        metadataUri: null,
      }),
    ).rejects.toThrow("TESTNET_RPC_URL is required");
  });

  it("blocks testnet ownership calls in production-like environments until the async saga owns real chain settlement", async () => {
    const ownership = new OwnershipService(
      new ConfigService({
        FANPASS_ENV: "staging",
        OWNERSHIP_ADAPTER: "testnet",
      }),
    );

    expect(() =>
      ownership.issueTicket({
        localTicketId: "tkt_local",
        tokenIdHint: "7",
        eventId: "evt_weekend_demo",
        ownerId: "usr_fan_demo",
        ownerWalletAddress: "0x0000000000000000000000000000000000002001",
        transferable: true,
        resaleCap: 1545,
        maxTransferCount: 2,
        metadataUri: null,
      }),
    ).toThrow(/OWNERSHIP_ADAPTER=testnet/);
  });
});
