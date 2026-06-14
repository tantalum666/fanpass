import { ConfigService } from "@nestjs/config";
import { DemoStore } from "../src/common/demo-store";
import { WalletService } from "../src/modules/wallet/wallet.service";

describe("WalletService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns wallet_missing without fabricating token balances", async () => {
    const store = new DemoStore();
    store.users.push({
      id: "usr_no_wallet",
      name: "No Wallet",
      email: "no-wallet@fanpass.test",
      role: "FAN",
      privyId: null,
      walletAddress: null,
      riskScore: 0,
    });
    const service = new WalletService(new ConfigService({}), store);

    const result = await service.balances({
      userId: "usr_no_wallet",
      role: "FAN",
    });

    expect(result.address).toBeNull();
    expect(result.balances).toEqual(
      [
        expect.objectContaining({
          asset: "USDC",
          amount: null,
          rawAmount: null,
          status: "wallet_missing",
        }),
      ],
    );
  });

  it("reads configured ERC20 balances over backend RPC", async () => {
    const rawAmount = 123_456_789n;
    const rpcResult = `0x${rawAmount.toString(16).padStart(64, "0")}`;
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: rpcResult,
      }),
    } as Response);
    const store = new DemoStore();
    const service = new WalletService(
      new ConfigService({
        FANPASS_WALLET_RPC_URL: "https://rpc.testnet.example",
        FANPASS_WALLET_CHAIN_ID: "11155111",
        FANPASS_USDC_CONTRACT_ADDRESS:
          "0x00000000000000000000000000000000000000a0",
      }),
      store,
    );

    const result = await service.balances({
      userId: "usr_fan_demo",
      role: "FAN",
    });

    expect(result).toMatchObject({
      address: "0x0000000000000000000000000000000000002001",
      chainId: "11155111",
    });
    expect(result.balances).toEqual(
      [
        expect.objectContaining({
          asset: "USDC",
          amount: "123.456789",
          rawAmount: "123456789",
          decimals: 6,
          status: "ok",
        }),
      ],
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      method: "eth_call",
      params: [
        {
          to: "0x00000000000000000000000000000000000000a0",
          data:
            "0x70a082310000000000000000000000000000000000000000000000000000000000002001",
        },
        "latest",
      ],
    });
  });
});
