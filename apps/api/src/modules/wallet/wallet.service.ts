import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DemoStore } from "../../common/demo-store";
import { UserRecord } from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import { FanPassSession } from "../../common/session";

type WalletBalanceStatus =
  | "ok"
  | "not_configured"
  | "rpc_unavailable"
  | "wallet_missing";

interface WalletTokenConfig {
  asset: "USDC";
  contractKey: string;
  decimalsKey: string;
  defaultDecimals: number;
}

export interface WalletBalanceRow {
  asset: "USDC";
  amount: string | null;
  rawAmount: string | null;
  decimals: number;
  contractAddress: string | null;
  status: WalletBalanceStatus;
  updatedAt: string;
}

export interface WalletBalancesResponse {
  address: string | null;
  chainId: string | null;
  balances: WalletBalanceRow[];
}

const BALANCE_OF_SELECTOR = "70a08231";
const WALLET_TOKENS: WalletTokenConfig[] = [
  {
    asset: "USDC",
    contractKey: "FANPASS_USDC_CONTRACT_ADDRESS",
    decimalsKey: "FANPASS_USDC_DECIMALS",
    defaultDecimals: 6,
  },
];

@Injectable()
export class WalletService {
  constructor(
    private readonly config: ConfigService,
    private readonly store: DemoStore,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async balances(session: FanPassSession): Promise<WalletBalancesResponse> {
    const user = await this.findUserById(session.userId);
    if (!user) {
      throw new NotFoundException("User profile not found");
    }

    const walletAddress = this.normalizeAddress(user.walletAddress);
    const rpcUrl = this.readRpcUrl();
    const chainId = this.readChainId();

    const balances = await Promise.all(
      WALLET_TOKENS.map((token) =>
        this.readBalanceRow({
          token,
          walletAddress,
          rpcUrl,
        }),
      ),
    );

    return {
      address: walletAddress,
      chainId,
      balances,
    };
  }

  private async readBalanceRow(input: {
    token: WalletTokenConfig;
    walletAddress: string | null;
    rpcUrl: string | null;
  }): Promise<WalletBalanceRow> {
    const decimals = this.readDecimals(
      input.token.decimalsKey,
      input.token.defaultDecimals,
    );
    const contractAddress = this.normalizeAddress(
      this.config.get<string>(input.token.contractKey),
    );
    const updatedAt = new Date().toISOString();

    if (!input.walletAddress) {
      return {
        asset: input.token.asset,
        amount: null,
        rawAmount: null,
        decimals,
        contractAddress,
        status: "wallet_missing",
        updatedAt,
      };
    }

    if (!input.rpcUrl || !contractAddress) {
      return {
        asset: input.token.asset,
        amount: null,
        rawAmount: null,
        decimals,
        contractAddress,
        status: "not_configured",
        updatedAt,
      };
    }

    try {
      const raw = await this.readErc20Balance(
        input.rpcUrl,
        contractAddress,
        input.walletAddress,
      );
      return {
        asset: input.token.asset,
        amount: this.formatUnits(raw, decimals),
        rawAmount: raw.toString(),
        decimals,
        contractAddress,
        status: "ok",
        updatedAt,
      };
    } catch {
      return {
        asset: input.token.asset,
        amount: null,
        rawAmount: null,
        decimals,
        contractAddress,
        status: "rpc_unavailable",
        updatedAt,
      };
    }
  }

  private async readErc20Balance(
    rpcUrl: string,
    contractAddress: string,
    walletAddress: string,
  ) {
    const result = await this.rpcCall<string>(rpcUrl, "eth_call", [
      {
        to: contractAddress,
        data: this.balanceOfData(walletAddress),
      },
      "latest",
    ]);
    if (typeof result !== "string" || !/^0x[0-9a-fA-F]*$/.test(result)) {
      throw new Error("Invalid ERC20 balance response");
    }
    return BigInt(result);
  }

  private async rpcCall<T>(
    rpcUrl: string,
    method: string,
    params: unknown[],
  ): Promise<T> {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });
    if (!response.ok) {
      throw new Error(`RPC request failed with ${response.status}`);
    }

    const body = (await response.json()) as {
      result?: T;
      error?: { message?: string };
    };
    if (body.error || body.result === undefined) {
      throw new Error(body.error?.message ?? "RPC response missing result");
    }
    return body.result;
  }

  private balanceOfData(walletAddress: string) {
    const address = this.normalizeAddress(walletAddress);
    if (!address) {
      throw new Error("Invalid wallet address");
    }
    return `0x${BALANCE_OF_SELECTOR}${address.slice(2).padStart(64, "0")}`;
  }

  private formatUnits(value: bigint, decimals: number) {
    const base = 10n ** BigInt(decimals);
    const whole = value / base;
    const fraction = value % base;
    if (fraction === 0n) {
      return whole.toString();
    }
    const fractionText = fraction
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
    return `${whole}.${fractionText}`;
  }

  private readRpcUrl() {
    return (
      this.nonEmptyConfig("FANPASS_WALLET_RPC_URL") ??
      this.nonEmptyConfig("TESTNET_RPC_URL") ??
      this.nonEmptyConfig("FANPASS_SEPOLIA_RPC_URL")
    );
  }

  private readChainId() {
    return (
      this.nonEmptyConfig("FANPASS_WALLET_CHAIN_ID") ??
      this.nonEmptyConfig("TESTNET_CHAIN_ID")
    );
  }

  private readDecimals(key: string, fallback: number) {
    const configured = Number(this.config.get<string>(key));
    if (!Number.isInteger(configured) || configured < 0 || configured > 36) {
      return fallback;
    }
    return configured;
  }

  private nonEmptyConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();
    return value ? value : null;
  }

  private normalizeAddress(value: string | null | undefined) {
    const trimmed = value?.trim();
    if (!trimmed || !/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  private async findUserById(userId: string): Promise<UserRecord | null> {
    const prisma = this.prismaClient();
    if (prisma) {
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });
      return user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            privyId: user.privyId,
            walletAddress: user.walletAddress,
            riskScore: user.riskScore,
          }
        : null;
    }
    return this.store.users.find((user) => user.id === userId) ?? null;
  }

  private prismaClient() {
    const dataSource =
      this.config.get<string>("FANPASS_DATA_SOURCE") ??
      process.env.FANPASS_DATA_SOURCE;
    return dataSource === "prisma" ? this.prisma : undefined;
  }
}
