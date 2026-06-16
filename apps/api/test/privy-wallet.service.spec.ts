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
  });
});
