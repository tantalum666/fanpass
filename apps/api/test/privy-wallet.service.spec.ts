import { ConfigService } from "@nestjs/config";
import { PrivyWalletService } from "../src/modules/privy/privy-wallet.service";

describe("PrivyWalletService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
});
