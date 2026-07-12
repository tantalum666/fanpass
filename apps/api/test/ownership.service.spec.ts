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
  Interface: jest.fn(() => ({
    encodeFunctionData: jest.fn(
      (name: string, args: unknown[]) => `0xencoded_${name}_${args.length}`,
    ),
    parseLog: jest.fn(() => ({
      name: "TicketMinted",
      args: {
        tokenId: {
          toString: () => "42",
        },
      },
    })),
  })),
  JsonRpcProvider: jest.fn(),
  Wallet: jest.fn(),
}));

describe("OwnershipService", () => {
  it("pins unit tests to the mock ownership adapter", () => {
    expect(process.env.OWNERSHIP_ADAPTER).toBe("mock");
    expect(process.env.FANPASS_ENABLE_PAYMENTS).toBe("false");
  });

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

  it("sends Sepolia ownership writes through Privy gas sponsorship when selected", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result:
            "0x0000000000000000000000000000000000000000000000000000000000009000",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            status: "0x1",
            logs: [{}],
          },
        }),
      } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn().mockResolvedValue({
        hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        providerId: "wallet_rpc_fixture",
        rawStatus: null,
        userOperationHash: null,
      }),
      waitForTransactionHash: jest.fn(),
    };
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "privy",
        FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_fixture_operator",
        FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS:
          "0x0000000000000000000000000000000000009000",
        FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2: "eip155:11155111",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );

    const receipt = await ownership.issueTicket({
      localTicketId: "tkt_privy_sensitive",
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
      adapter: "privy",
      status: "CONFIRMED",
      tokenId: "42",
      transactionHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
    });
    expect(privyWallets.sendSponsoredEthereumTransaction).toHaveBeenCalledWith({
      walletId: "wallet_fixture_operator",
      caip2: "eip155:11155111",
      transaction: {
        to: "0x0000000000000000000000000000000000001000",
        data: "0xencoded_mintTicketWithProof_10",
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://rpc.testnet.example",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(privyWallets.waitForTransactionHash).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("resolves Privy sponsored ownership writes through transaction status polling", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result:
            "0x0000000000000000000000000000000000000000000000000000000000009000",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            status: "0x1",
            logs: [],
          },
        }),
      } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn().mockResolvedValue({
        hash: null,
        providerId: "tx_fixture",
        rawStatus: "broadcasted",
        userOperationHash: "0xuserop",
      }),
      waitForTransactionHash: jest.fn().mockResolvedValue({
        hash: "0x3333333333333333333333333333333333333333333333333333333333333333",
        providerId: "tx_fixture",
        rawStatus: "confirmed",
        userOperationHash: "0xuserop",
      }),
    };
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "privy",
        FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_fixture_operator",
        FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS:
          "0x0000000000000000000000000000000000009000",
        FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2: "eip155:11155111",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );

    await expect(
      ownership.issueTicket({
        localTicketId: "tkt_privy_async_hash",
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
    ).resolves.toMatchObject({
      adapter: "privy",
      transactionHash:
        "0x3333333333333333333333333333333333333333333333333333333333333333",
    });
    expect(privyWallets.waitForTransactionHash).toHaveBeenCalledWith({
      transactionId: "tx_fixture",
      timeoutMs: 45_000,
    });
    fetchMock.mockRestore();
  });

  it("rejects Privy sponsored ownership writes when no transaction hash or transaction id is returned", async () => {
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn().mockResolvedValue({
        hash: null,
        providerId: null,
        rawStatus: "submitted",
        userOperationHash: null,
      }),
      waitForTransactionHash: jest.fn(),
    };
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "privy",
        FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_fixture_operator",
        FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2: "eip155:11155111",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
      }),
      privyWallets as never,
    );

    await expect(
      ownership.issueTicket({
        localTicketId: "tkt_privy_no_hash",
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
    ).rejects.toThrow("Sepolia transaction hash or transaction id");
    expect(privyWallets.waitForTransactionHash).not.toHaveBeenCalled();
  });
});
