import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
import { CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from "@hpke/core";
import { ConfigService } from "@nestjs/config";
import { createPrivateKey, sign, webcrypto } from "crypto";

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

export type PrivyTransactionDisposition =
  | { kind: "PENDING"; status: "submitted" | "pending" | "broadcasted" }
  | {
      kind: "SUCCESS";
      status: "confirmed" | "finalized";
      transactionHash: string;
    }
  | {
      kind: "DEFINITIVE_FAILURE";
      status: "failed" | "execution_reverted";
      reason: string;
    }
  | {
      kind: "AMBIGUOUS";
      status: string | null;
      reason: string;
    };

/**
 * Classifies the durable Privy transaction states FanPass is prepared to act
 * on. Unknown or internally inconsistent terminal states fail closed instead
 * of being treated as indefinitely pending.
 */
export function classifyPrivyTransactionStatus(
  transaction: Pick<PrivyTransactionStatus, "hash" | "rawStatus">,
): PrivyTransactionDisposition {
  const status = transaction.rawStatus?.trim().toLowerCase() || null;
  const transactionHash = normalizePrivyTransactionHash(transaction.hash);
  if (
    status === "submitted" ||
    status === "pending" ||
    status === "broadcasted"
  ) {
    return { kind: "PENDING", status };
  }
  if (status === "confirmed" || status === "finalized") {
    return transactionHash
      ? { kind: "SUCCESS", status, transactionHash }
      : {
          kind: "AMBIGUOUS",
          status,
          reason: `privy_${status}_without_transaction_hash`,
        };
  }
  if (status === "failed" || status === "execution_reverted") {
    return {
      kind: "DEFINITIVE_FAILURE",
      status,
      reason: `privy_${status}`,
    };
  }
  if (status === "provider_error" || status === "replaced") {
    return {
      kind: "AMBIGUOUS",
      status,
      reason: `privy_${status}`,
    };
  }
  return {
    kind: "AMBIGUOUS",
    status,
    reason: status ? `privy_unknown_status_${status}` : "privy_status_missing",
  };
}

function normalizePrivyTransactionHash(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return /^0x[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

export interface VerifiedPrivyWallet {
  walletId: string;
  walletAddress: string;
}

interface HpkeRecipient {
  publicKeySpki: Uint8Array;
  decryptPayload: (
    encapsulatedKey: Uint8Array,
    ciphertext: Uint8Array,
  ) => Promise<Uint8Array>;
}

@Injectable()
export class PrivyWalletService {
  private hpkeRecipient: Promise<HpkeRecipient> | null = null;

  constructor(private readonly config: ConfigService) {}

  async resolveUserEmbeddedEthereumWallet(input: {
    privyUserId: string;
    walletId?: string;
    walletAddress?: string;
  }): Promise<VerifiedPrivyWallet> {
    const requestedWalletId = input.walletId?.trim() || null;
    const requestedWalletAddress = this.normalizeEthereumAddress(
      input.walletAddress,
    );
    if (!requestedWalletId && !requestedWalletAddress) {
      throw new UnauthorizedException(
        "A Privy wallet identifier or address is required",
      );
    }

    const userUrl = `${this.apiBaseUrl()}/v1/users/${encodeURIComponent(
      input.privyUserId,
    )}`;
    let response: Response;
    try {
      response = await fetch(userUrl, {
        method: "GET",
        headers: this.baseHeaders(),
        signal: AbortSignal.timeout(
          this.configInteger(
            "PRIVY_USER_LOOKUP_TIMEOUT_MS",
            5_000,
            1_000,
            15_000,
          ),
        ),
      });
    } catch {
      throw new ServiceUnavailableException(
        "Privy wallet ownership verification is unavailable",
      );
    }

    const body = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok) {
      if (response.status === 404) {
        throw new UnauthorizedException(
          "Privy user could not be verified for this wallet",
        );
      }
      throw new ServiceUnavailableException(
        "Privy wallet ownership verification is unavailable",
      );
    }
    if (this.readString(body?.id) !== input.privyUserId) {
      throw new UnauthorizedException(
        "Privy user could not be verified for this wallet",
      );
    }

    const linkedAccounts = Array.isArray(body?.linked_accounts)
      ? body.linked_accounts
      : [];
    const wallet = linkedAccounts
      .map((account) => this.readEmbeddedEthereumWallet(account))
      .find(
        (candidate): candidate is VerifiedPrivyWallet =>
          Boolean(candidate) &&
          (!requestedWalletId || candidate?.walletId === requestedWalletId) &&
          (!requestedWalletAddress ||
            candidate?.walletAddress === requestedWalletAddress),
      );
    if (!wallet) {
      throw new UnauthorizedException(
        "Wallet is not linked to the authenticated Privy user",
      );
    }
    return wallet;
  }

  async sendSponsoredEthereumTransaction(input: {
    walletId: string;
    caip2: string;
    idempotencyKey: string;
    transaction: PrivyEthereumTransaction;
    userJwt?: string | null;
    userAuthorizationSignature?: string | null;
    requestExpiry?: number | null;
  }): Promise<PrivySponsoredTransactionReceipt> {
    const url = this.walletRpcUrl(input.walletId);
    const idempotencyKey = this.requiredIdempotencyKey(input.idempotencyKey);
    const requestBody = {
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
    };
    const response = await fetch(url, {
      method: "POST",
      headers: await this.headers({
        method: "POST",
        url,
        body: requestBody,
        userJwt: input.userJwt,
        userAuthorizationSignature: input.userAuthorizationSignature,
        requestExpiry: input.requestExpiry,
        idempotencyKey,
      }),
      body: JSON.stringify(requestBody),
    });

    const responseBody = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok) {
      const message =
        this.readString(responseBody?.error) ??
        this.readString(responseBody?.message) ??
        `Privy wallet RPC failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    return this.readTransactionStatus(responseBody);
  }

  async getTransactionStatus(
    transactionId: string,
  ): Promise<PrivyTransactionStatus> {
    const response = await fetch(this.transactionUrl(transactionId), {
      method: "GET",
      headers: await this.headers(),
    });
    const body = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
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
      if (
        latest.rawStatus !== null &&
        classifyPrivyTransactionStatus(latest).kind !== "PENDING"
      ) {
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

  private async headers(signedRequest?: {
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    url: string;
    body: unknown;
    userJwt?: string | null;
    userAuthorizationSignature?: string | null;
    requestExpiry?: number | null;
    idempotencyKey?: string | null;
  }) {
    const headers = this.baseHeaders();
    const appId = this.requiredConfig("PRIVY_APP_ID");
    if (signedRequest) {
      const requestExpiry =
        typeof signedRequest.requestExpiry === "number"
          ? signedRequest.requestExpiry
          : this.privyRequestExpiry();
      if (!Number.isSafeInteger(requestExpiry)) {
        throw new Error("Privy wallet authorization expiry is invalid");
      }
      const authorizationSignatures = await this.authorizationSignatures({
        ...signedRequest,
        appId,
        requestExpiry,
      });
      if (authorizationSignatures.length > 0) {
        headers["privy-authorization-signature"] =
          authorizationSignatures.join(",");
        headers["privy-request-expiry"] = String(requestExpiry);
      }
      if (signedRequest.idempotencyKey) {
        headers["privy-idempotency-key"] = signedRequest.idempotencyKey;
      }
    }
    return headers;
  }

  private baseHeaders(): Record<string, string> {
    const appId = this.requiredConfig("PRIVY_APP_ID");
    const appSecret = this.requiredConfig("PRIVY_APP_SECRET");
    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
      "privy-app-id": appId,
    };
  }

  private async authorizationSignatures(input: {
    appId: string;
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    url: string;
    body: unknown;
    requestExpiry: number;
    userJwt?: string | null;
    userAuthorizationSignature?: string | null;
    idempotencyKey?: string | null;
  }) {
    const staticSignature = this.nonEmptyConfig(
      "PRIVY_WALLET_AUTHORIZATION_SIGNATURE",
    );
    const providedUserAuthorizationSignature =
      input.userAuthorizationSignature?.trim() || null;
    const userAuthorizationKey = providedUserAuthorizationSignature
      ? null
      : await this.userAuthorizationPrivateKey(input.userJwt);
    const privateKeys = [
      ...this.authorizationPrivateKeys(),
      ...(userAuthorizationKey ? [userAuthorizationKey] : []),
    ];
    const privyHeaders: Record<string, string> = {
      "privy-app-id": input.appId,
      "privy-request-expiry": String(input.requestExpiry),
    };
    if (input.idempotencyKey) {
      privyHeaders["privy-idempotency-key"] = input.idempotencyKey;
    }
    const generated = privateKeys.map((authorizationPrivateKey) =>
      this.generateAuthorizationSignature({
        authorizationPrivateKey,
        input: {
          version: 1,
          method: input.method,
          url: input.url,
          body: input.body,
          headers: privyHeaders,
        },
      }),
    );
    return [
      ...(providedUserAuthorizationSignature
        ? [providedUserAuthorizationSignature]
        : []),
      ...(staticSignature ? [staticSignature] : []),
      ...generated,
    ];
  }

  private async userAuthorizationPrivateKey(userJwt?: string | null) {
    const normalizedJwt = userJwt?.trim();
    if (!normalizedJwt) {
      return null;
    }
    const { authorizationKey } =
      await this.exchangeJwtForAuthorizationKey(normalizedJwt);
    return authorizationKey;
  }

  private async exchangeJwtForAuthorizationKey(userJwt: string) {
    const hpkeRecipient = await this.getHpkeRecipient();
    const requestBody = {
      user_jwt: userJwt,
      encryption_type: "HPKE",
      recipient_public_key: Buffer.from(hpkeRecipient.publicKeySpki).toString(
        "base64",
      ),
    };
    const response = await fetch(
      `${this.apiBaseUrl()}/v1/wallets/authenticate`,
      {
        method: "POST",
        headers: this.baseHeaders(),
        body: JSON.stringify(requestBody),
      },
    );
    const responseBody = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok) {
      const message =
        this.readString(responseBody?.error) ??
        this.readString(responseBody?.message) ??
        `Privy wallet JWT exchange failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    const expiresAt =
      this.readNumber(responseBody?.expires_at) ?? Date.now() + 60_000;
    const rawAuthorizationKey = this.readString(
      responseBody?.authorization_key,
    );
    if (rawAuthorizationKey) {
      const authorizationKey =
        this.normalizePkcs8PrivateKey(rawAuthorizationKey);
      if (!authorizationKey) {
        throw new Error("Privy wallet JWT exchange returned an empty key");
      }
      return {
        authorizationKey,
        expiresAt,
      };
    }

    const encrypted = this.readPath(responseBody, [
      "encrypted_authorization_key",
    ]);
    if (
      !encrypted ||
      typeof encrypted !== "object" ||
      Array.isArray(encrypted)
    ) {
      throw new Error(
        "Privy wallet JWT exchange did not return an authorization key",
      );
    }
    const encryptedRecord = encrypted as Record<string, unknown>;
    if (encryptedRecord.encryption_type !== "HPKE") {
      throw new Error(
        "Privy wallet JWT exchange returned an unsupported key type",
      );
    }
    const encapsulatedKey = this.readString(encryptedRecord.encapsulated_key);
    const ciphertext = this.readString(encryptedRecord.ciphertext);
    if (!encapsulatedKey || !ciphertext) {
      throw new Error(
        "Privy wallet JWT exchange returned an invalid encrypted key",
      );
    }

    const decrypted = await hpkeRecipient.decryptPayload(
      Buffer.from(encapsulatedKey, "base64"),
      Buffer.from(ciphertext, "base64"),
    );
    const authorizationKey = this.normalizePkcs8PrivateKey(
      new TextDecoder().decode(decrypted),
    );
    if (!authorizationKey) {
      throw new Error(
        "Privy wallet JWT exchange returned an empty encrypted key",
      );
    }
    return {
      authorizationKey,
      expiresAt,
    };
  }

  private getHpkeRecipient() {
    if (!this.hpkeRecipient) {
      this.hpkeRecipient = this.setupHpkeRecipient();
    }
    return this.hpkeRecipient;
  }

  private async setupHpkeRecipient(): Promise<HpkeRecipient> {
    const suite = new CipherSuite({
      kem: new DhkemP256HkdfSha256(),
      kdf: new HkdfSha256(),
      aead: new Chacha20Poly1305(),
    });
    const keypair = await suite.kem.generateKeyPair();
    const publicKeySpki = await webcrypto.subtle.exportKey(
      "spki",
      keypair.publicKey,
    );
    return {
      publicKeySpki: new Uint8Array(publicKeySpki),
      decryptPayload: async (encapsulatedKey, ciphertext) => {
        const recipient = await suite.createRecipientContext({
          recipientKey: keypair.privateKey,
          enc: encapsulatedKey,
        });
        const decoded = await recipient.open(ciphertext);
        return new Uint8Array(decoded);
      },
    };
  }

  private generateAuthorizationSignature(input: {
    authorizationPrivateKey: string;
    input: {
      version: 1;
      method: "POST" | "PUT" | "PATCH" | "DELETE";
      url: string;
      body: unknown;
      headers: Record<string, string>;
    };
  }) {
    const serializedInput = this.canonicalJson({
      ...input.input,
      body: this.authorizationBody(input.input.body),
    });
    const key = createPrivateKey({
      key: Buffer.from(input.authorizationPrivateKey, "base64"),
      format: "der",
      type: "pkcs8",
    });
    return sign("sha256", Buffer.from(serializedInput), key).toString("base64");
  }

  private canonicalJson(value: unknown): string {
    if (value === null) {
      return "null";
    }
    if (typeof value === "string") {
      return JSON.stringify(value);
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalJson(item)).join(",")}]`;
    }
    if (typeof value === "object") {
      return `{${Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(
          ([key, entryValue]) =>
            `${JSON.stringify(key)}:${this.canonicalJson(entryValue)}`,
        )
        .join(",")}}`;
    }
    throw new Error("Unsupported Privy wallet authorization payload value");
  }

  private authorizationBody(body: unknown) {
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      Object.keys(body).length === 0
    ) {
      return "";
    }
    return body;
  }

  private authorizationPrivateKeys() {
    const raw =
      this.nonEmptyConfig("PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEYS") ??
      this.nonEmptyConfig("PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY");
    if (!raw) {
      return [];
    }
    return raw
      .split(",")
      .map((value) => this.normalizePkcs8PrivateKey(value))
      .filter((value): value is string => Boolean(value));
  }

  private normalizePkcs8PrivateKey(value: string) {
    const normalized = value
      .replace(/\\n/g, "\n")
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s+/g, "");
    return normalized || null;
  }

  private privyRequestExpiry() {
    const ttlMs = this.configInteger(
      "PRIVY_WALLET_AUTHORIZATION_EXPIRY_MS",
      60_000,
      5_000,
      300_000,
    );
    return Date.now() + ttlMs;
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

  private requiredIdempotencyKey(value: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new Error("Privy idempotency key is required");
    }
    if (normalized.length > 256) {
      throw new Error("Privy idempotency key exceeds 256 characters");
    }
    return normalized;
  }

  private configInteger(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const raw = this.nonEmptyConfig(key);
    if (!raw) {
      return fallback;
    }
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(Math.max(value, minimum), maximum);
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

  private readEmbeddedEthereumWallet(
    value: unknown,
  ): VerifiedPrivyWallet | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const account = value as Record<string, unknown>;
    const chainType =
      this.readString(account.chain_type) ?? this.readString(account.chainType);
    const walletClientType =
      this.readString(account.wallet_client_type) ??
      this.readString(account.walletClientType);
    const walletId = this.readString(account.id);
    const walletAddress = this.normalizeEthereumAddress(
      this.readString(account.address) ?? undefined,
    );
    if (
      account.type !== "wallet" ||
      chainType !== "ethereum" ||
      walletClientType !== "privy" ||
      !walletId ||
      !walletAddress
    ) {
      return null;
    }
    return { walletId, walletAddress };
  }

  private normalizeEthereumAddress(value: string | undefined) {
    const normalized = value?.trim().toLowerCase() ?? "";
    return /^0x[0-9a-f]{40}$/.test(normalized) ? normalized : null;
  }

  private readNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
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
}
