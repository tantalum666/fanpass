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
  userOperationHash: string | null;
}

export interface PrivyTransactionStatus {
  hash: string | null;
  providerId: string | null;
  rawStatus: string | null;
  userOperationHash: string | null;
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
        chain_type: "ethereum",
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
        this.readString(body?.transaction_id) ??
        this.readString(this.readPath(body, ["data", "id"])) ??
        this.readString(this.readPath(body, ["data", "transactionId"])) ??
        this.readString(this.readPath(body, ["data", "transaction_id"])),
      rawStatus:
        this.readString(body?.status) ??
        this.readString(this.readPath(body, ["data", "status"])),
      userOperationHash:
        this.readString(body?.userOperationHash) ??
        this.readString(body?.user_operation_hash) ??
        this.readString(this.readPath(body, ["data", "userOperationHash"])) ??
        this.readString(this.readPath(body, ["data", "user_operation_hash"])),
    };
  }

  async getTransactionStatus(
    transactionId: string,
  ): Promise<PrivyTransactionStatus> {
    const response = await fetch(this.transactionUrl(transactionId), {
      method: "GET",
      headers: this.headers(),
    });
    const body = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!response.ok) {
      const message =
        this.readString(body?.error) ??
        this.readString(body?.message) ??
        `Privy transaction lookup failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    return this.readTransactionStatus(body);
  }

  async waitForTransactionHash(input: {
    transactionId: string;
    timeoutMs: number;
    intervalMs?: number;
  }): Promise<PrivyTransactionStatus> {
    const startedAt = Date.now();
    let latest: PrivyTransactionStatus = {
      hash: null,
      providerId: input.transactionId,
      rawStatus: null,
      userOperationHash: null,
    };
    do {
      latest = await this.getTransactionStatus(input.transactionId);
      if (latest.hash || this.isTerminalFailedStatus(latest.rawStatus)) {
        return latest;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, input.intervalMs ?? 1_500),
      );
    } while (Date.now() - startedAt < input.timeoutMs);
    return latest;
  }

  private walletRpcUrl(walletId: string) {
    return `${this.apiBaseUrl()}/v1/wallets/${encodeURIComponent(walletId)}/rpc`;
  }

  private transactionUrl(transactionId: string) {
    return `${this.apiBaseUrl()}/v1/transactions/${encodeURIComponent(
      transactionId,
    )}`;
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
    const candidates = this.hashCandidates(body);
    for (const candidate of candidates) {
      const value = this.readString(candidate);
      if (value && /^0x[a-fA-F0-9]{64}$/.test(value)) {
        return value;
      }
    }
    return null;
  }

  private hashCandidates(value: unknown): unknown[] {
    if (!value || typeof value !== "object") {
      return [value];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.hashCandidates(item));
    }
    const record = value as Record<string, unknown>;
    return [
      record.hash,
      record.transactionHash,
      record.transaction_hash,
      record.txHash,
      record.tx_hash,
      record.result,
      record.data,
      record.response,
    ].flatMap((candidate) => this.hashCandidates(candidate));
  }

  private readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private readPath(value: unknown, path: string[]) {
    let current = value;
    for (const key of path) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return null;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private readTransactionStatus(
    body: Record<string, unknown> | null,
  ): PrivyTransactionStatus {
    return {
      hash: this.readHash(body),
      providerId:
        this.readString(body?.id) ??
        this.readString(body?.transactionId) ??
        this.readString(body?.transaction_id),
      rawStatus: this.readString(body?.status),
      userOperationHash:
        this.readString(body?.userOperationHash) ??
        this.readString(body?.user_operation_hash),
    };
  }

  private isTerminalFailedStatus(status: string | null) {
    return (
      status === "failed" ||
      status === "execution_reverted" ||
      status === "provider_error"
    );
  }
}
