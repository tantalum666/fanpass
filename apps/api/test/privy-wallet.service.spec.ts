import { ConfigService } from "@nestjs/config";
import { generateKeyPairSync } from "crypto";
import {
  classifyPrivyTransactionStatus,
  PrivyWalletService,
} from "../src/modules/privy/privy-wallet.service";

describe("PrivyWalletService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves an embedded Ethereum wallet only from the matching Privy user", async () => {
    const walletAddress = "0x0000000000000000000000000000000000003001";
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "did:privy:fan-demo",
        linked_accounts: [
          {
            type: "wallet",
            id: "wallet_privy_demo",
            address: walletAddress,
            chain_type: "ethereum",
            wallet_client_type: "privy",
          },
        ],
      }),
    } as Response);
    const service = new PrivyWalletService(
      new ConfigService({
        PRIVY_APP_ID: "app_fixture",
        PRIVY_APP_SECRET: "secret_fixture",
      }),
    );

    await expect(
      service.resolveUserEmbeddedEthereumWallet({
        privyUserId: "did:privy:fan-demo",
        walletId: "wallet_privy_demo",
        walletAddress,
      }),
    ).resolves.toEqual({
      walletId: "wallet_privy_demo",
      walletAddress,
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.privy.io/v1/users/did%3Aprivy%3Afan-demo",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "privy-app-id": "app_fixture",
        }),
      }),
    );
  });

  it("rejects a wallet that is not linked to the verified Privy subject", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "did:privy:fan-demo",
        linked_accounts: [
          {
            type: "wallet",
            id: "wallet_other",
            address: "0x0000000000000000000000000000000000003999",
            chain_type: "ethereum",
            wallet_client_type: "privy",
          },
        ],
      }),
    } as Response);
    const service = new PrivyWalletService(
      new ConfigService({
        PRIVY_APP_ID: "app_fixture",
        PRIVY_APP_SECRET: "secret_fixture",
      }),
    );

    await expect(
      service.resolveUserEmbeddedEthereumWallet({
        privyUserId: "did:privy:fan-demo",
        walletId: "wallet_attacker_supplied",
        walletAddress: "0x0000000000000000000000000000000000003001",
      }),
    ).rejects.toThrow("Wallet is not linked to the authenticated Privy user");
  });

  it("extracts a sponsored transaction hash from nested Privy wallet RPC responses", async () => {
    const hash =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "wallet_rpc_fixture",
        result: {
          transactionHash: hash,
        },
        status: "submitted",
      }),
    } as Response);
    const service = new PrivyWalletService(
      new ConfigService({
        PRIVY_APP_ID: "app_fixture",
        PRIVY_APP_SECRET: "secret_fixture",
      }),
    );

    await expect(
      service.sendSponsoredEthereumTransaction({
        walletId: "wallet_fixture",
        caip2: "eip155:11155111",
        idempotencyKey: "wallet-rpc:test:extract-hash",
        transaction: {
          to: "0x0000000000000000000000000000000000001000",
          data: "0x1234",
        },
      }),
    ).resolves.toMatchObject({
      hash,
      providerId: "wallet_rpc_fixture",
      rawStatus: "submitted",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.privy.io/v1/wallets/wallet_fixture/rpc",
      expect.objectContaining({
        headers: expect.objectContaining({
          "privy-idempotency-key": "wallet-rpc:test:extract-hash",
        }),
        body: JSON.stringify({
          caip2: "eip155:11155111",
          chain_type: "ethereum",
          method: "eth_sendTransaction",
          params: {
            transaction: {
              to: "0x0000000000000000000000000000000000001000",
              data: "0x1234",
              value: "0x0",
            },
          },
          sponsor: true,
        }),
      }),
    );
  });

  it("polls Privy transaction status until the Sepolia hash is available", async () => {
    const hash =
      "0x2222222222222222222222222222222222222222222222222222222222222222";
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "tx_fixture",
          status: "broadcasted",
          transaction_hash: null,
          user_operation_hash: "0xuserop",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "tx_fixture",
          status: "confirmed",
          transaction_hash: hash,
        }),
      } as Response);
    const service = new PrivyWalletService(
      new ConfigService({
        PRIVY_APP_ID: "app_fixture",
        PRIVY_APP_SECRET: "secret_fixture",
      }),
    );
    await expect(
      service.waitForTransactionHash({
        transactionId: "tx_fixture",
        timeoutMs: 5_000,
        intervalMs: 1,
      }),
    ).resolves.toMatchObject({
      hash,
      providerId: "tx_fixture",
      rawStatus: "confirmed",
    });
  });

  it.each([
    ["submitted", null, "PENDING"],
    ["pending", null, "PENDING"],
    ["broadcasted", null, "PENDING"],
    ["confirmed", "valid", "SUCCESS"],
    ["finalized", "valid", "SUCCESS"],
    ["confirmed", null, "AMBIGUOUS"],
    ["finalized", null, "AMBIGUOUS"],
    ["failed", null, "DEFINITIVE_FAILURE"],
    ["execution_reverted", null, "DEFINITIVE_FAILURE"],
    ["provider_error", null, "AMBIGUOUS"],
    ["replaced", null, "AMBIGUOUS"],
    ["provider_future_terminal", null, "AMBIGUOUS"],
  ])(
    "classifies Privy transaction status %s as %s",
    (rawStatus, hashKind, expectedKind) => {
      expect(
        classifyPrivyTransactionStatus({
          rawStatus,
          hash:
            hashKind === "valid"
              ? "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
              : null,
        }).kind,
      ).toBe(expectedKind);
    },
  );

  it("reads nested Privy transaction status fields through the shared parser", async () => {
    const hash =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "tx_nested_fixture",
          status: "finalized",
          transaction_hash: hash,
          user_operation_hash: "0xuserop_nested",
        },
      }),
    } as Response);
    const service = new PrivyWalletService(
      new ConfigService({
        PRIVY_APP_ID: "app_fixture",
        PRIVY_APP_SECRET: "secret_fixture",
      }),
    );

    await expect(
      service.getTransactionStatus("tx_nested_fixture"),
    ).resolves.toEqual({
      hash,
      providerId: "tx_nested_fixture",
      rawStatus: "finalized",
      userOperationHash: "0xuserop_nested",
    });
  });

  it.each(["failed", "execution_reverted", "provider_error", "replaced"])(
    "stops polling on terminal Privy status %s without a transaction hash",
    async (rawStatus) => {
      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ id: "tx_terminal", status: rawStatus }),
      } as Response);
      const service = new PrivyWalletService(
        new ConfigService({
          PRIVY_APP_ID: "app_fixture",
          PRIVY_APP_SECRET: "secret_fixture",
        }),
      );

      await expect(
        service.waitForTransactionHash({
          transactionId: "tx_terminal",
          timeoutMs: 5_000,
          intervalMs: 1,
        }),
      ).resolves.toMatchObject({ rawStatus, hash: null });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    },
  );

  it("signs sponsored wallet RPC requests with a Privy authorization private key", async () => {
    const keyPair = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const privateKey = keyPair.privateKey
      .export({ format: "der", type: "pkcs8" })
      .toString("base64");
    jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "wallet_rpc_fixture",
        result: {
          transactionHash:
            "0x3333333333333333333333333333333333333333333333333333333333333333",
        },
      }),
    } as Response);
    const service = new PrivyWalletService(
      new ConfigService({
        PRIVY_APP_ID: "app_fixture",
        PRIVY_APP_SECRET: "secret_fixture",
        PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY: privateKey,
        PRIVY_WALLET_AUTHORIZATION_EXPIRY_MS: "45000",
      }),
    );
    const signatureSpy = jest.spyOn(
      service as unknown as {
        generateAuthorizationSignature(input: unknown): string;
      },
      "generateAuthorizationSignature",
    );

    await service.sendSponsoredEthereumTransaction({
      walletId: "wallet_fixture",
      caip2: "eip155:11155111",
      idempotencyKey: "wallet-rpc:test:authorization-key",
      transaction: {
        to: "0x0000000000000000000000000000000000001000",
        data: "0x1234",
      },
    });

    const headers = (fetch as jest.Mock).mock.calls[0][1].headers as Record<
      string,
      string
    >;
    expect(headers["privy-authorization-signature"]).toMatch(
      /^[A-Za-z0-9+/=]+$/,
    );
    expect(headers["privy-request-expiry"]).toBe("1045000");
    expect(headers["privy-idempotency-key"]).toBe(
      "wallet-rpc:test:authorization-key",
    );
    expect(signatureSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          headers: {
            "privy-app-id": "app_fixture",
            "privy-request-expiry": "1045000",
            "privy-idempotency-key": "wallet-rpc:test:authorization-key",
          },
        }),
      }),
    );
  });

  it("exchanges a Privy user JWT before signing sponsored wallet RPC requests", async () => {
    const keyPair = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const privateKey = keyPair.privateKey
      .export({ format: "der", type: "pkcs8" })
      .toString("base64");
    jest.spyOn(Date, "now").mockReturnValue(2_000_000);
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorization_key: privateKey,
          expires_at: 2_120_000,
          wallets: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "wallet_rpc_fixture",
          result: {
            transactionHash:
              "0x4444444444444444444444444444444444444444444444444444444444444444",
          },
        }),
      } as Response);
    const service = new PrivyWalletService(
      new ConfigService({
        PRIVY_APP_ID: "app_fixture",
        PRIVY_APP_SECRET: "secret_fixture",
        PRIVY_WALLET_AUTHORIZATION_EXPIRY_MS: "45000",
      }),
    );

    await service.sendSponsoredEthereumTransaction({
      walletId: "wallet_fixture",
      caip2: "eip155:11155111",
      idempotencyKey: "wallet-rpc:test:user-jwt",
      userJwt: "privy.jwt.fixture",
      transaction: {
        to: "0x0000000000000000000000000000000000001000",
        data: "0x1234",
      },
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.privy.io/v1/wallets/authenticate",
      expect.objectContaining({
        body: expect.any(String),
      }),
    );
    const authenticateBody = JSON.parse(
      String((fetch as jest.Mock).mock.calls[0][1].body),
    );
    expect(authenticateBody).toMatchObject({
      user_jwt: "privy.jwt.fixture",
      encryption_type: "HPKE",
    });
    expect(authenticateBody.recipient_public_key).toEqual(expect.any(String));
    const rpcHeaders = (fetch as jest.Mock).mock.calls[1][1].headers as Record<
      string,
      string
    >;
    expect(rpcHeaders["privy-authorization-signature"]).toMatch(
      /^[A-Za-z0-9+/=]+$/,
    );
    expect(rpcHeaders["privy-request-expiry"]).toBe("2045000");
  });

  it("does not retain decrypted user authorization keys between requests", async () => {
    const keyPair = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const privateKey = keyPair.privateKey
      .export({ format: "der", type: "pkcs8" })
      .toString("base64");
    jest.spyOn(Date, "now").mockReturnValue(2_500_000);
    const fetchSpy = jest.spyOn(global, "fetch");
    for (let index = 0; index < 2; index += 1) {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            authorization_key: privateKey,
            expires_at: 2_620_000,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: `wallet_rpc_fixture_${index}`,
            result: {
              transactionHash:
                "0x4545454545454545454545454545454545454545454545454545454545454545",
            },
          }),
        } as Response);
    }
    const service = new PrivyWalletService(
      new ConfigService({
        PRIVY_APP_ID: "app_fixture",
        PRIVY_APP_SECRET: "secret_fixture",
      }),
    );

    for (let index = 0; index < 2; index += 1) {
      await service.sendSponsoredEthereumTransaction({
        walletId: "wallet_fixture",
        caip2: "eip155:11155111",
        idempotencyKey: `wallet-rpc:test:no-cache:${index}`,
        userJwt: "privy.jwt.fixture",
        transaction: {
          to: "0x0000000000000000000000000000000000001000",
          data: "0x1234",
        },
      });
    }

    const authenticateCalls = fetchSpy.mock.calls.filter(
      ([url]) => url === "https://api.privy.io/v1/wallets/authenticate",
    );
    expect(authenticateCalls).toHaveLength(2);
  });

  it("uses a client-generated user authorization signature without exchanging the JWT", async () => {
    jest.spyOn(Date, "now").mockReturnValue(3_000_000);
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "wallet_rpc_fixture",
        result: {
          transactionHash:
            "0x5555555555555555555555555555555555555555555555555555555555555555",
        },
      }),
    } as Response);
    const service = new PrivyWalletService(
      new ConfigService({
        PRIVY_APP_ID: "app_fixture",
        PRIVY_APP_SECRET: "secret_fixture",
      }),
    );

    await service.sendSponsoredEthereumTransaction({
      walletId: "wallet_fixture",
      caip2: "eip155:11155111",
      idempotencyKey: "wallet-rpc:test:client-signature",
      userJwt: "privy.jwt.fixture",
      userAuthorizationSignature: "clientSignatureFixture==",
      requestExpiry: 3_060_000,
      transaction: {
        to: "0x0000000000000000000000000000000000001000",
        data: "0x1234",
      },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.privy.io/v1/wallets/wallet_fixture/rpc",
      expect.objectContaining({
        headers: expect.objectContaining({
          "privy-authorization-signature": "clientSignatureFixture==",
          "privy-request-expiry": "3060000",
          "privy-idempotency-key": "wallet-rpc:test:client-signature",
        }),
      }),
    );
  });

  it.each(["", "x".repeat(257)])(
    "rejects invalid Privy idempotency key %p before network I/O",
    async (idempotencyKey) => {
      const fetchSpy = jest.spyOn(global, "fetch");
      const service = new PrivyWalletService(
        new ConfigService({
          PRIVY_APP_ID: "app_fixture",
          PRIVY_APP_SECRET: "secret_fixture",
        }),
      );

      await expect(
        service.sendSponsoredEthereumTransaction({
          walletId: "wallet_fixture",
          caip2: "eip155:11155111",
          idempotencyKey,
          transaction: {
            to: "0x0000000000000000000000000000000000001000",
            data: "0x1234",
          },
        }),
      ).rejects.toThrow(/idempotency key/);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );
});
