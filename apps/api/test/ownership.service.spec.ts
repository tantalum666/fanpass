import { ConfigService } from "@nestjs/config";
import { OwnershipService } from "../src/modules/ownership/ownership.service";

const mockMintTicketWithProof = jest.fn();
const mockSyncTicketTransfer = jest.fn();
const mockRedeem = jest.fn();
const mockContract = {
  interface: {
    parseLog: jest.fn(),
  },
  mintTicketWithProof: mockMintTicketWithProof,
  syncTicketTransfer: mockSyncTicketTransfer,
  redeem: mockRedeem,
};

jest.mock("ethers", () => ({
  Contract: jest.fn(() => mockContract),
  JsonRpcProvider: jest.fn(),
  Wallet: jest.fn(),
}));

describe("OwnershipService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContract.interface.parseLog.mockReturnValue({
      name: "TicketMinted",
      args: {
        tokenId: {
          toString: () => "42",
        },
      },
    });
    mockMintTicketWithProof.mockResolvedValue({
      hash: "0xtx_mint",
      wait: async () => ({
        hash: "0xreceipt_mint",
        logs: [{}],
      }),
    });
    mockSyncTicketTransfer.mockResolvedValue({
      hash: "0xtx_transfer",
      wait: async () => ({
        hash: "0xreceipt_transfer",
      }),
    });
    mockRedeem.mockResolvedValue({
      hash: "0xtx_redeem",
      wait: async () => ({
        hash: "0xreceipt_redeem",
      }),
    });
  });

  it("uses the mock adapter by default for local Alpha ownership receipts", async () => {
    const ownership = new OwnershipService(new ConfigService());

    const receipt = await ownership.issueTicket({
      localTicketId: "tkt_local",
      tokenIdHint: "7",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
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
        ticketTypeId: "tt_cat2_demo",
        ownerId: "usr_fan_demo",
        ownerWalletAddress: "0x0000000000000000000000000000000000002001",
        transferable: true,
        resaleCap: 1545,
        maxTransferCount: 2,
        metadataUri: null,
      }),
    ).rejects.toThrow("TESTNET_RPC_URL is required");
  });

  it("blocks testnet ownership calls in production-like environments unless explicitly enabled for non-production", async () => {
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
        ticketTypeId: "tt_cat2_demo",
        ownerId: "usr_fan_demo",
        ownerWalletAddress: "0x0000000000000000000000000000000000002001",
        transferable: true,
        resaleCap: 1545,
        maxTransferCount: 2,
        metadataUri: null,
      }),
    ).toThrow(/OWNERSHIP_ADAPTER=testnet/);
  });

  it("allows explicit staging private-key testnet writes while production remains blocked", async () => {
    const ownership = new OwnershipService(
      new ConfigService({
        NODE_ENV: "production",
        FANPASS_ENV: "staging",
        FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES: "true",
        OWNERSHIP_ADAPTER: "testnet",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
        TESTNET_OPERATOR_PRIVATE_KEY:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
      }),
    );

    const receipt = await ownership.issueTicket({
      localTicketId: "tkt_staging_dev",
      tokenIdHint: "7",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ownerId: "usr_fan_demo",
      ownerWalletAddress: "0x0000000000000000000000000000000000002001",
      transferable: true,
      resaleCap: 1545,
      maxTransferCount: 2,
      metadataUri: null,
    });

    expect(receipt).toMatchObject({
      adapter: "testnet",
      tokenId: "42",
      transactionHash: "0xreceipt_mint",
    });

    const productionOwnership = new OwnershipService(
      new ConfigService({
        NODE_ENV: "production",
        FANPASS_ENV: "production",
        FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES: "true",
        OWNERSHIP_ADAPTER: "testnet",
      }),
    );
    expect(() =>
      productionOwnership.issueTicket({
        localTicketId: "tkt_prod",
        tokenIdHint: "8",
        eventId: "evt_weekend_demo",
        ticketTypeId: "tt_cat2_demo",
        ownerId: "usr_fan_demo",
        ownerWalletAddress: "0x0000000000000000000000000000000000002001",
        transferable: true,
        resaleCap: 1545,
        maxTransferCount: 2,
        metadataUri: null,
      }),
    ).toThrow(/OWNERSHIP_ADAPTER=testnet/);
  });

  it("uses proof-hash minting for testnet ticket issuance", async () => {
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "testnet",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
        TESTNET_OPERATOR_PRIVATE_KEY:
          "replace-with-non-production-testnet-operator-private-key",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
      }),
    );

    const receipt = await ownership.issueTicket({
      localTicketId: "tkt_local_sensitive",
      tokenIdHint: "7",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ownerId: "usr_fan_demo",
      ownerWalletAddress: "0x0000000000000000000000000000000000002001",
      transferable: true,
      resaleCap: 1545,
      maxTransferCount: 2,
      metadataUri: null,
    });

    expect(receipt).toMatchObject({
      adapter: "testnet",
      status: "CONFIRMED",
      tokenId: "42",
      transactionHash: "0xreceipt_mint",
    });
    expect(mockMintTicketWithProof).toHaveBeenCalledTimes(1);
    const call = mockMintTicketWithProof.mock.calls[0];
    expect(call[0]).toBe("0x0000000000000000000000000000000000002001");
    expect(call.slice(2, 6)).toEqual([
      expect.stringMatching(/^0x[a-f0-9]{64}$/),
      expect.stringMatching(/^0x[a-f0-9]{64}$/),
      expect.stringMatching(/^0x[a-f0-9]{64}$/),
      expect.stringMatching(/^0x[a-f0-9]{64}$/),
    ]);
    const callText = (call as unknown[])
      .map((value: unknown) => String(value))
      .join(" ");
    expect(callText).not.toContain("tkt_local_sensitive");
    expect(callText).not.toContain("tt_cat2_demo");
  });

  it("uses owner-only sync transfer instead of requiring fan wallet approval", async () => {
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "testnet",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
        TESTNET_OPERATOR_PRIVATE_KEY:
          "replace-with-non-production-testnet-operator-private-key",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
      }),
    );

    const receipt = await ownership.transferTicket({
      ticketId: "tkt_local_sensitive",
      tokenId: "42",
      fromOwnerId: "usr_fan_demo",
      fromWalletAddress: "0x0000000000000000000000000000000000002001",
      toOwnerId: "usr_buyer_demo",
      toWalletAddress: "0x0000000000000000000000000000000000002002",
    });

    expect(receipt).toMatchObject({
      adapter: "testnet",
      status: "CONFIRMED",
      tokenId: "42",
      transactionHash: "0xreceipt_transfer",
    });
    expect(mockSyncTicketTransfer).toHaveBeenCalledWith(
      "0x0000000000000000000000000000000000002001",
      "0x0000000000000000000000000000000000002002",
      42n,
    );
  });
});
