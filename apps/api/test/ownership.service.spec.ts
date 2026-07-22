import { ConfigService } from "@nestjs/config";
import {
  OwnershipOperationError,
  OwnershipService,
} from "../src/modules/ownership/ownership.service";

const mockMintTicketWithProof = jest.fn();
const mockSyncTicketTransfer = jest.fn();
const mockRedeem = jest.fn();
const ZERO_WORD = `0x${"0".repeat(64)}`;
const OLD_CONTRACT_ROUTE = {
  contractAddress: "0x0000000000000000000000000000000000001000",
  chainId: "11155111",
  contractVersion: "fanpass-ticket-v1" as const,
};
const addressWord = (address: string) =>
  `0x${address.slice(2).padStart(64, "0")}`;
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
  Interface: jest.fn((abi: string[]) => ({
    encodeFunctionData: jest.fn((name: string, args: unknown[]) => {
      if (!abi.some((fragment) => fragment.includes(` ${name}(`))) {
        throw new Error(`unknown function ${name}`);
      }
      return `0xencoded_${name}_${args.length}`;
    }),
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

  it.each([undefined, "", "mock", "prviy", "Privy"])(
    "fails closed for production-like ownership adapter value %p",
    (adapter) => {
      const ownership = new OwnershipService(
        new ConfigService({
          FANPASS_ENV: "staging",
          OWNERSHIP_ADAPTER: adapter,
        }),
      );

      expect(() => ownership.adapterName()).toThrow(/OWNERSHIP_ADAPTER/);
    },
  );

  it("rejects an unknown ownership adapter in local mode", () => {
    const ownership = new OwnershipService(
      new ConfigService({
        FANPASS_ENV: "local",
        OWNERSHIP_ADAPTER: "prviy",
      }),
    );

    expect(() => ownership.adapterName()).toThrow(
      "OWNERSHIP_ADAPTER must be explicitly set to mock, testnet, or privy",
    );
  });

  it("requires testnet config only when the testnet adapter is selected", async () => {
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "testnet",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
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
      contractRoute: OLD_CONTRACT_ROUTE,
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
        json: async () => ({ result: ZERO_WORD }),
      } as Response)
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
      idempotencyKey: "ownership-issue:tkt_privy_sensitive",
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
      idempotencyKey: "ownership-issue:tkt_privy_sensitive",
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
        json: async () => ({ result: ZERO_WORD }),
      } as Response)
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
        idempotencyKey: "ownership-issue:tkt_privy_async_hash",
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

  it("reconciles an existing logical ticket mint before submitting a retry", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: `0x${"2a".padStart(64, "0")}` }),
    } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn(),
      waitForTransactionHash: jest.fn(),
    };
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "privy",
        FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_fixture_operator",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );

    await expect(
      ownership.issueTicket({
        localTicketId: "tkt_privy_recovered",
        tokenIdHint: "7",
        eventId: "evt_weekend_demo",
        ticketTypeId: "tt_cat2_demo",
        ownerId: "usr_fan_demo",
        ownerWalletAddress: "0x0000000000000000000000000000000000002001",
        transferable: true,
        resaleCap: 1545,
        maxTransferCount: 2,
        metadataUri: null,
        idempotencyKey: "ownership-issue:tkt_privy_recovered",
      }),
    ).resolves.toEqual({
      adapter: "privy",
      status: "CONFIRMED",
      tokenId: "42",
      ownershipRef: "0x0000000000000000000000000000000000001000:42",
      transactionHash: null,
      contractRoute: OLD_CONTRACT_ROUTE,
    });
    expect(
      privyWallets.sendSponsoredEthereumTransaction,
    ).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("classifies reconciliation failure before Privy submission as definitely not submitted", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: "rpc unavailable" }),
    } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn(),
      waitForTransactionHash: jest.fn(),
    };
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "privy",
        FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_fixture_operator",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );
    const beforeProviderSubmission = jest.fn().mockResolvedValue(undefined);

    await expect(
      ownership.issueTicket(
        {
          localTicketId: "tkt_privy_rpc_unavailable",
          tokenIdHint: "7",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: "0x0000000000000000000000000000000000002001",
          transferable: true,
          resaleCap: 1545,
          maxTransferCount: 2,
          metadataUri: null,
          idempotencyKey: "ownership-issue:tkt_privy_rpc_unavailable",
        },
        { beforeProviderSubmission },
      ),
    ).rejects.toMatchObject<Partial<OwnershipOperationError>>({
      submissionDisposition: "DEFINITELY_NOT_SUBMITTED",
      retryable: true,
    });
    expect(
      privyWallets.sendSponsoredEthereumTransaction,
    ).not.toHaveBeenCalled();
    expect(beforeProviderSubmission).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("classifies a Privy submission timeout as ambiguous", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: ZERO_WORD }),
    } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest
        .fn()
        .mockRejectedValue(new Error("Privy request timed out")),
      waitForTransactionHash: jest.fn(),
    };
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "privy",
        FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_fixture_operator",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );
    const beforeProviderSubmission = jest.fn().mockResolvedValue(undefined);

    await expect(
      ownership.issueTicket(
        {
          localTicketId: "tkt_privy_submit_timeout",
          tokenIdHint: "7",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: "0x0000000000000000000000000000000000002001",
          transferable: true,
          resaleCap: 1545,
          maxTransferCount: 2,
          metadataUri: null,
          idempotencyKey: "ownership-issue:tkt_privy_submit_timeout",
        },
        { beforeProviderSubmission },
      ),
    ).rejects.toMatchObject<Partial<OwnershipOperationError>>({
      submissionDisposition: "AMBIGUOUS",
      retryable: true,
      message: expect.stringContaining("manual reconciliation is required"),
    });
    expect(beforeProviderSubmission).toHaveBeenCalledTimes(1);
    expect(beforeProviderSubmission.mock.invocationCallOrder[0]).toBeLessThan(
      privyWallets.sendSponsoredEthereumTransaction.mock.invocationCallOrder[0],
    );
    expect(privyWallets.waitForTransactionHash).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("does not call Privy when the durable submission fence cannot be persisted", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: ZERO_WORD }),
    } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn(),
      waitForTransactionHash: jest.fn(),
    };
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "privy",
        FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_fixture_operator",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );
    const beforeProviderSubmission = jest
      .fn()
      .mockRejectedValue(new Error("outbox write unavailable"));

    await expect(
      ownership.issueTicket(
        {
          localTicketId: "tkt_privy_fence_unavailable",
          tokenIdHint: "7",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: "0x0000000000000000000000000000000000002001",
          transferable: true,
          resaleCap: 1545,
          maxTransferCount: 2,
          metadataUri: null,
          idempotencyKey: "ownership-issue:tkt_privy_fence_unavailable",
        },
        { beforeProviderSubmission },
      ),
    ).rejects.toMatchObject<Partial<OwnershipOperationError>>({
      submissionDisposition: "DEFINITELY_NOT_SUBMITTED",
      retryable: true,
      message: expect.stringContaining("fence could not be persisted"),
    });
    expect(beforeProviderSubmission).toHaveBeenCalledTimes(1);
    expect(
      privyWallets.sendSponsoredEthereumTransaction,
    ).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("reconciles an already-applied transfer before submitting a retry", async () => {
    const buyerWallet = "0x0000000000000000000000000000000000002002";
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: addressWord(buyerWallet) }),
    } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn(),
      waitForTransactionHash: jest.fn(),
    };
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "privy",
        FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_fixture_operator",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );

    await expect(
      ownership.transferTicket({
        ticketId: "tkt_privy_transfer_recovered",
        tokenId: "42",
        fromOwnerId: "usr_fan_demo",
        fromWalletAddress: "0x0000000000000000000000000000000000002001",
        toOwnerId: "usr_buyer_demo",
        toWalletAddress: buyerWallet,
        contractRoute: OLD_CONTRACT_ROUTE,
        idempotencyKey: "ownership-transfer:buy:sell",
      }),
    ).resolves.toMatchObject({
      adapter: "privy",
      status: "CONFIRMED",
      tokenId: "42",
      transactionHash: null,
    });
    expect(
      privyWallets.sendSponsoredEthereumTransaction,
    ).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("keeps an existing ticket on its snapshotted contract after the global address changes", async () => {
    const sellerWallet = "0x0000000000000000000000000000000000002001";
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: addressWord(sellerWallet) }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { status: "0x1", logs: [] } }),
      } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn().mockResolvedValue({
        hash: "0x5555555555555555555555555555555555555555555555555555555555555555",
        providerId: "tx_old_contract_fixture",
        rawStatus: "broadcasted",
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
          "0x0000000000000000000000000000000000002000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );

    await ownership.transferTicket({
      ticketId: "tkt_old_contract",
      tokenId: "42",
      fromOwnerId: "usr_fan_demo",
      fromWalletAddress: sellerWallet,
      toOwnerId: "usr_buyer_demo",
      toWalletAddress: "0x0000000000000000000000000000000000002002",
      contractRoute: OLD_CONTRACT_ROUTE,
      idempotencyKey: "ownership-transfer:old-contract:42",
    });

    expect(privyWallets.sendSponsoredEthereumTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction: expect.objectContaining({
          to: OLD_CONTRACT_ROUTE.contractAddress,
        }),
      }),
    );
    const reconciliationRequest = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body),
    ) as { params: Array<{ to?: string }> };
    expect(reconciliationRequest.params[0]?.to).toBe(
      OLD_CONTRACT_ROUTE.contractAddress,
    );
    fetchMock.mockRestore();
  });

  it("reconciles an already-redeemed ticket before submitting a retry", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: addressWord("0x0000000000000000000000000000000000002001"),
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: `0x${"1".padStart(64, "0")}` }),
      } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn(),
      waitForTransactionHash: jest.fn(),
    };
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "privy",
        FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_fixture_operator",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );

    await expect(
      ownership.redeemTicket({
        ticketId: "tkt_privy_redeem_recovered",
        tokenId: "42",
        contractRoute: OLD_CONTRACT_ROUTE,
        idempotencyKey: "ownership-redeem:tkt_privy_redeem_recovered:42",
      }),
    ).resolves.toMatchObject({
      adapter: "privy",
      status: "CONFIRMED",
      tokenId: "42",
      transactionHash: null,
    });
    expect(
      privyWallets.sendSponsoredEthereumTransaction,
    ).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("fails closed when the on-chain owner is outside transfer participants", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: addressWord("0x0000000000000000000000000000000000002999"),
      }),
    } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn(),
      waitForTransactionHash: jest.fn(),
    };
    const ownership = new OwnershipService(
      new ConfigService({
        OWNERSHIP_ADAPTER: "privy",
        FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_fixture_operator",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );

    await expect(
      ownership.transferTicket({
        ticketId: "tkt_privy_transfer_stale",
        tokenId: "42",
        fromOwnerId: "usr_fan_demo",
        fromWalletAddress: "0x0000000000000000000000000000000000002001",
        toOwnerId: "usr_buyer_demo",
        toWalletAddress: "0x0000000000000000000000000000000000002002",
        contractRoute: OLD_CONTRACT_ROUTE,
        idempotencyKey: "ownership-transfer:stale:binding",
      }),
    ).rejects.toThrow("expected transfer participants");
    expect(
      privyWallets.sendSponsoredEthereumTransaction,
    ).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("classifies a reverted Privy ownership receipt as failed", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: addressWord("0x0000000000000000000000000000000000002001"),
        }),
      } as Response)
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
            status: "0x0",
            logs: [],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: addressWord("0x0000000000000000000000000000000000002001"),
        }),
      } as Response);
    const privyWallets = {
      sendSponsoredEthereumTransaction: jest.fn().mockResolvedValue({
        hash: "0x4444444444444444444444444444444444444444444444444444444444444444",
        providerId: "tx_reverted_fixture",
        rawStatus: "broadcasted",
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
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
      }),
      privyWallets as never,
    );

    await expect(
      ownership.transferTicket({
        ticketId: "tkt_privy_reverted",
        tokenId: "7",
        fromOwnerId: "usr_fan_demo",
        fromWalletAddress: "0x0000000000000000000000000000000000002001",
        toOwnerId: "usr_buyer_demo",
        toWalletAddress: "0x0000000000000000000000000000000000002002",
        contractRoute: OLD_CONTRACT_ROUTE,
        idempotencyKey: "ownership-transfer:buy:reverted",
      }),
    ).resolves.toMatchObject({
      adapter: "privy",
      status: "FAILED",
      tokenId: "7",
      transactionHash:
        "0x4444444444444444444444444444444444444444444444444444444444444444",
    });
    fetchMock.mockRestore();
  });

  it("rejects Privy sponsored ownership writes when no transaction hash or transaction id is returned", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: ZERO_WORD }),
    } as Response);
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
        TESTNET_RPC_URL: "https://rpc.testnet.example",
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
        idempotencyKey: "ownership-issue:tkt_privy_no_hash",
      }),
    ).rejects.toThrow("Sepolia transaction hash or transaction id");
    expect(privyWallets.waitForTransactionHash).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
