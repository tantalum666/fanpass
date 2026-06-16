import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface PrivyEthereumTransaction {
  to: string;
  data: string;
  value?: string;
}

export interface PrivySponsoredTransactionReceipt {
  hash: string | null;
  providerId: string | null;
  rawStatus: string | null;
}

@Injectable()
export class PrivyWalletService {
  constructor(private readonly config: ConfigService) {}

  async sendSponsoredEthereumTransaction(input: {
    walletId: string;
    caip2: string;
    transaction: PrivyEthereumTransaction;
  }): Promise<PrivySponsoredTransactionReceipt> {
    const response = await fetch(this.walletRpcUrl(input.walletId), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        caip2: input.caip2,
        method: "eth_sendTransaction",
        params: {
          transaction: {
            to: input.transaction.to,
            data: input.transaction.data,
            value: input.transaction.value ?? "0x0",
          },
        },
        sponsor: true,
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!response.ok) {
      const message =
        this.readString(body?.error) ??
        this.readString(body?.message) ??
        `Privy wallet RPC failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    return {
      hash: this.readHash(body),
      providerId:
        this.readString(body?.id) ??
        this.readString(body?.transactionId) ??
        this.readString(body?.transaction_id),
      rawStatus: this.readString(body?.status),
    };
  }

  private walletRpcUrl(walletId: string) {
    return `${this.apiBaseUrl()}/v1/wallets/${encodeURIComponent(walletId)}/rpc`;
  }

  private headers() {
    const appId = this.requiredConfig("PRIVY_APP_ID");
    const appSecret = this.requiredConfig("PRIVY_APP_SECRET");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
      "privy-app-id": appId,
    };
    const authorizationSignature = this.nonEmptyConfig(
      "PRIVY_WALLET_AUTHORIZATION_SIGNATURE",
    );
    if (authorizationSignature) {
      headers["privy-authorization-signature"] = authorizationSignature;
    }
    return headers;
  }

  private apiBaseUrl() {
    return (
      this.nonEmptyConfig("PRIVY_API_BASE_URL") ?? "https://api.privy.io"
    ).replace(/\/+$/, "");
  }

  private requiredConfig(key: string) {
    const value = this.nonEmptyConfig(key);
    if (!value) {
      throw new Error(`${key} is required for Privy wallet sponsorship`);
    }
    return value;
  }

  private nonEmptyConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();
    return value ? value : null;
  }

  private readHash(body: Record<string, unknown> | null) {
    const candidates = [
      body?.hash,
      body?.transactionHash,
      body?.transaction_hash,
      body?.result,
    ];
    for (const candidate of candidates) {
      const value = this.readString(candidate);
      if (value && /^0x[a-fA-F0-9]{64}$/.test(value)) {
        return value;
      }
    }
    return null;
  }

  private readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}
