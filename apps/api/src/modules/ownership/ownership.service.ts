import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "crypto";
import {
  FANPASS_TICKET_CONTRACT_VERSION,
  OwnershipContractRoute,
} from "../../common/domain";
import {
  allowsPrivateKeyTestnetWrites,
  isProductionLikeEnvironment,
} from "../../config/security-config";
import { PrivyWalletService } from "../privy/privy-wallet.service";

export interface OwnershipReceipt {
  adapter: "mock" | "testnet" | "privy";
  status: "CONFIRMED" | "PENDING" | "FAILED";
  tokenId: string;
  ownershipRef: string;
  transactionHash: string | null;
  contractRoute: OwnershipContractRoute | null;
}

export type OwnershipSubmissionDisposition =
  "DEFINITELY_NOT_SUBMITTED" | "AMBIGUOUS";

export const OWNERSHIP_AMBIGUOUS_ERROR_MARKER = "OWNERSHIP_OUTCOME_AMBIGUOUS";

export class OwnershipOperationError extends Error {
  readonly name = "OwnershipOperationError";

  constructor(
    readonly submissionDisposition: OwnershipSubmissionDisposition,
    readonly retryable: boolean,
    message: string,
    readonly originalError: unknown,
  ) {
    super(message);
  }

  static definitelyNotSubmitted(
    error: unknown,
    context: string,
    retryable = true,
  ) {
    if (error instanceof OwnershipOperationError) {
      return error;
    }
    return new OwnershipOperationError(
      "DEFINITELY_NOT_SUBMITTED",
      retryable,
      `${context}: ${this.errorMessage(error)}`,
      error,
    );
  }

  static ambiguous(error: unknown, context: string) {
    if (
      error instanceof OwnershipOperationError &&
      error.submissionDisposition === "AMBIGUOUS"
    ) {
      return error;
    }
    return new OwnershipOperationError(
      "AMBIGUOUS",
      true,
      `${OWNERSHIP_AMBIGUOUS_ERROR_MARKER}: ${context}: ${this.errorMessage(error)}. The provider outcome may have been submitted; manual reconciliation is required`,
      error,
    );
  }

  private static errorMessage(error: unknown) {
    return error instanceof Error
      ? error.message
      : "Ownership operation failed";
  }
}

export interface ResolveOwnershipReceiptInput {
  adapter: OwnershipReceipt["adapter"];
  tokenId: string;
  ownershipRef: string;
  transactionHash: string;
  contractRoute: OwnershipContractRoute | null;
  operation:
    | { type: "ISSUE"; localTicketId: string }
    | {
        type: "TRANSFER";
        fromWalletAddress: string | null;
        toWalletAddress: string | null;
      }
    | { type: "REDEEM" };
}

export interface IssueOwnershipInput {
  localTicketId: string;
  tokenIdHint: string;
  eventId: string;
  ticketTypeId: string;
  ownerId: string;
  ownerWalletAddress: string | null;
  ownerWalletBindingVersion?: number;
  ownerWalletBindingFingerprint?: string;
  transferable: boolean;
  resaleCap: number | null;
  maxTransferCount: number;
  metadataUri: string | null;
  contractRoute?: OwnershipContractRoute | null;
  idempotencyKey?: string;
}

export interface TransferOwnershipInput {
  ticketId: string;
  tokenId: string | null;
  fromOwnerId: string;
  fromWalletAddress: string | null;
  fromWalletBindingVersion?: number;
  fromWalletBindingFingerprint?: string;
  toOwnerId: string;
  toWalletAddress: string | null;
  toWalletBindingVersion?: number;
  toWalletBindingFingerprint?: string;
  contractRoute?: OwnershipContractRoute | null;
  idempotencyKey?: string;
}

export interface RedeemOwnershipInput {
  ticketId: string;
  tokenId: string | null;
  contractRoute?: OwnershipContractRoute | null;
  idempotencyKey?: string;
}

export interface OwnershipSubmissionHooks {
  beforeProviderSubmission?: () => Promise<void>;
}

interface OwnershipAdapter {
  readonly name: OwnershipReceipt["adapter"];
  issueTicket(
    input: IssueOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ): Promise<OwnershipReceipt>;
  transferTicket(
    input: TransferOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ): Promise<OwnershipReceipt>;
  redeemTicket(
    input: RedeemOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ): Promise<OwnershipReceipt>;
  resolveReceipt(
    input: ResolveOwnershipReceiptInput,
  ): Promise<OwnershipReceipt>;
}

interface ParsedContractLog {
  name: string;
  args: {
    tokenId: {
      toString(): string;
    };
  };
}

interface TestnetContract {
  interface: {
    parseLog(log: unknown): ParsedContractLog | null;
  };
  mintTicketWithProof(
    to: string,
    eventId: bigint,
    ticketIdHash: string,
    ticketTypeHash: string,
    policyHash: string,
    metadataHash: string,
    transferable: boolean,
    resaleCap: number,
    maxTransferCount: number,
    metadataUri: string,
  ): Promise<TestnetTransaction>;
  syncTicketTransfer(
    from: string,
    to: string,
    tokenId: bigint,
  ): Promise<TestnetTransaction>;
  redeem(tokenId: bigint): Promise<TestnetTransaction>;
}

interface TestnetTransaction {
  hash?: string;
  wait(): Promise<TestnetReceipt | null>;
}

interface TestnetReceipt {
  hash?: string;
  logs?: unknown[];
}

interface EthersRuntime {
  Contract: new (
    address: string,
    abi: string[],
    signer: unknown,
  ) => TestnetContract;
  Interface: new (abi: string[]) => {
    encodeFunctionData(name: string, args: unknown[]): string;
    parseLog(log: unknown): ParsedContractLog | null;
  };
  JsonRpcProvider: new (url: string) => unknown;
  Wallet: new (privateKey: string, provider: unknown) => unknown;
}

@Injectable()
export class OwnershipService {
  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly privyWallets?: PrivyWalletService,
  ) {}

  adapterName() {
    return this.adapter().name;
  }

  routeForNewTicket(): OwnershipContractRoute | null {
    const adapter = this.adapter();
    if (adapter.name === "mock") {
      return null;
    }
    return this.currentContractRoute();
  }

  issueTicket(input: IssueOwnershipInput, hooks?: OwnershipSubmissionHooks) {
    const adapter = this.adapter();
    return adapter.issueTicket(
      adapter.name === "mock"
        ? input
        : {
            ...input,
            contractRoute: input.contractRoute ?? this.currentContractRoute(),
          },
      hooks,
    );
  }

  transferTicket(
    input: TransferOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ) {
    return this.adapter().transferTicket(input, hooks);
  }

  redeemTicket(input: RedeemOwnershipInput, hooks?: OwnershipSubmissionHooks) {
    return this.adapter().redeemTicket(input, hooks);
  }

  async verifyPrivyWalletBinding(input: {
    privyUserId: string;
    walletId: string;
    walletAddress: string;
  }) {
    if (this.adapter().name !== "privy") {
      return;
    }
    const privyWallets =
      this.privyWallets ?? new PrivyWalletService(this.config);
    await privyWallets.resolveUserEmbeddedEthereumWallet(input);
  }

  resolveReceipt(input: ResolveOwnershipReceiptInput) {
    const adapter = this.adapter();
    if (adapter.name !== input.adapter) {
      throw new Error(
        "Ownership receipt adapter does not match runtime configuration",
      );
    }
    return adapter.resolveReceipt(input);
  }

  private adapter(): OwnershipAdapter {
    const adapter = this.config.get<string>("OWNERSHIP_ADAPTER")?.trim();
    if (adapter === "privy") {
      return new PrivySponsoredOwnershipAdapter(
        this.config,
        this.privyWallets ?? new PrivyWalletService(this.config),
      );
    }
    if (adapter === "mock") {
      if (this.productionLike()) {
        throw new Error(
          "OWNERSHIP_ADAPTER=mock is forbidden in production-like environments",
        );
      }
      return new MockOwnershipAdapter();
    }
    if (adapter !== "testnet") {
      throw new Error(
        "OWNERSHIP_ADAPTER must be explicitly set to mock, testnet, or privy",
      );
    }
    if (this.productionLike() && !this.privateKeyTestnetWritesAllowed()) {
      throw new Error(
        "OWNERSHIP_ADAPTER=testnet is blocked in production-like environments unless FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES=true is explicitly set outside production",
      );
    }
    return new TestnetOwnershipAdapter(this.config);
  }

  private productionLike() {
    return isProductionLikeEnvironment({
      NODE_ENV: this.config.get<string>("NODE_ENV") ?? process.env.NODE_ENV,
      FANPASS_ENV:
        this.config.get<string>("FANPASS_ENV") ?? process.env.FANPASS_ENV,
    });
  }

  private privateKeyTestnetWritesAllowed() {
    return allowsPrivateKeyTestnetWrites({
      FANPASS_ENV:
        this.config.get<string>("FANPASS_ENV") ?? process.env.FANPASS_ENV,
      FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES:
        this.config.get<string>("FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES") ??
        process.env.FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES,
    });
  }

  private currentContractRoute(): OwnershipContractRoute {
    const contractAddress = this.config
      .get<string>("FANPASS_TICKET_CONTRACT_ADDRESS")
      ?.trim()
      .toLowerCase();
    if (!contractAddress || !/^0x[a-f0-9]{40}$/.test(contractAddress)) {
      throw new Error(
        "FANPASS_TICKET_CONTRACT_ADDRESS must be a valid EVM address",
      );
    }
    const caip2 = this.config
      .get<string>("FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2")
      ?.trim();
    const configuredChainId = this.config
      .get<string>("TESTNET_CHAIN_ID")
      ?.trim();
    const chainId =
      caip2?.match(/^eip155:([1-9][0-9]*)$/)?.[1] ??
      configuredChainId ??
      "11155111";
    if (!/^[1-9][0-9]*$/.test(chainId)) {
      throw new Error("Ticket ownership chain id must be a positive integer");
    }
    return {
      contractAddress,
      chainId,
      contractVersion: FANPASS_TICKET_CONTRACT_VERSION,
    };
  }
}

class MockOwnershipAdapter implements OwnershipAdapter {
  readonly name = "mock" as const;

  async issueTicket(
    input: IssueOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ): Promise<OwnershipReceipt> {
    return this.receipt(
      input.tokenIdHint,
      `mock:ticket:${input.localTicketId}`,
    );
  }

  async transferTicket(
    input: TransferOwnershipInput,
  ): Promise<OwnershipReceipt> {
    return this.receipt(
      this.requiredTokenId(input.tokenId),
      `mock:transfer:${input.ticketId}:${input.toOwnerId}`,
    );
  }

  async redeemTicket(input: RedeemOwnershipInput): Promise<OwnershipReceipt> {
    return this.receipt(
      this.requiredTokenId(input.tokenId),
      `mock:redeem:${input.ticketId}`,
    );
  }

  async resolveReceipt(
    input: ResolveOwnershipReceiptInput,
  ): Promise<OwnershipReceipt> {
    return {
      ...input,
      status: "CONFIRMED",
      contractRoute: null,
    };
  }

  private receipt(tokenId: string, ownershipRef: string): OwnershipReceipt {
    return {
      adapter: this.name,
      status: "CONFIRMED",
      tokenId,
      ownershipRef,
      transactionHash: `mock_${randomUUID()}`,
      contractRoute: null,
    };
  }

  private requiredTokenId(tokenId: string | null) {
    if (!tokenId) {
      throw new Error("Mock ownership transfer requires an issued token id");
    }
    return tokenId;
  }
}

class TestnetOwnershipAdapter implements OwnershipAdapter {
  readonly name = "testnet" as const;

  private readonly abi = [
    "function mintTicketWithProof(address to,uint256 eventId,bytes32 ticketIdHash,bytes32 ticketTypeHash,bytes32 policyHash,bytes32 metadataHash,bool transferable,uint256 resaleCap,uint256 maxTransferCount,string metadataUri) returns (uint256)",
    "function tokenIdByTicketIdHash(bytes32 ticketIdHash) view returns (uint256)",
    "function syncTicketTransfer(address from,address to,uint256 tokenId)",
    "function redeem(uint256 tokenId)",
    "event TicketMinted(uint256 indexed tokenId,uint256 indexed eventId,address indexed owner)",
    "event TicketTransferSynced(uint256 indexed tokenId,address indexed from,address indexed to)",
  ];

  constructor(private readonly config: ConfigService) {}

  async issueTicket(
    input: IssueOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ): Promise<OwnershipReceipt> {
    const route = this.requiredRoute(input.contractRoute, true);
    const contract = await this.contract(route);
    const ownerWallet = this.requiredWallet(input.ownerWalletAddress, "owner");
    const policyHash = this.bytes32Hash(
      [
        "policy",
        input.eventId,
        input.ticketTypeId,
        String(input.transferable),
        String(input.resaleCap ?? 0),
        String(input.maxTransferCount),
      ].join(":"),
    );
    await hooks?.beforeProviderSubmission?.();
    const tx = await contract.mintTicketWithProof(
      ownerWallet,
      this.chainEventId(input.eventId),
      this.bytes32Hash(`ticket:${input.localTicketId}`),
      this.bytes32Hash(`ticket-type:${input.ticketTypeId}`),
      policyHash,
      this.bytes32Hash(`metadata:${input.metadataUri ?? input.localTicketId}`),
      input.transferable,
      input.resaleCap ?? 0,
      input.maxTransferCount,
      input.metadataUri ?? "",
    );
    const receipt = await tx.wait();
    const tokenId =
      this.extractMintedTokenId(contract, receipt) ?? input.tokenIdHint;
    return {
      adapter: this.name,
      status: "CONFIRMED",
      tokenId,
      ownershipRef: `${route.contractAddress}:${tokenId}`,
      transactionHash: receipt?.hash ?? tx.hash ?? null,
      contractRoute: route,
    };
  }

  async transferTicket(
    input: TransferOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ): Promise<OwnershipReceipt> {
    const tokenId = this.requiredTokenId(input.tokenId);
    const route = this.requiredRoute(input.contractRoute);
    const contract = await this.contract(route);
    await hooks?.beforeProviderSubmission?.();
    const tx = await contract.syncTicketTransfer(
      this.requiredWallet(input.fromWalletAddress, "from owner"),
      this.requiredWallet(input.toWalletAddress, "to owner"),
      BigInt(tokenId),
    );
    const receipt = await tx.wait();
    return {
      adapter: this.name,
      status: "CONFIRMED",
      tokenId,
      ownershipRef: `${route.contractAddress}:${tokenId}`,
      transactionHash: receipt?.hash ?? tx.hash ?? null,
      contractRoute: route,
    };
  }

  async redeemTicket(
    input: RedeemOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ): Promise<OwnershipReceipt> {
    const tokenId = this.requiredTokenId(input.tokenId);
    const route = this.requiredRoute(input.contractRoute);
    const contract = await this.contract(route);
    await hooks?.beforeProviderSubmission?.();
    const tx = await contract.redeem(BigInt(tokenId));
    const receipt = await tx.wait();
    return {
      adapter: this.name,
      status: "CONFIRMED",
      tokenId,
      ownershipRef: `${route.contractAddress}:${tokenId}`,
      transactionHash: receipt?.hash ?? tx.hash ?? null,
      contractRoute: route,
    };
  }

  async resolveReceipt(
    input: ResolveOwnershipReceiptInput,
  ): Promise<OwnershipReceipt> {
    const route = this.requiredRoute(input.contractRoute);
    return {
      ...input,
      status: "CONFIRMED",
      ownershipRef: `${route.contractAddress}:${input.tokenId}`,
      contractRoute: route,
    };
  }

  private async contract(route: OwnershipContractRoute) {
    const rpcUrl = this.requiredConfig("TESTNET_RPC_URL");
    const privateKey = this.requiredConfig("TESTNET_OPERATOR_PRIVATE_KEY");
    const { Contract, JsonRpcProvider, Wallet } = await this.loadEthers();
    const provider = new JsonRpcProvider(rpcUrl);
    const signer = new Wallet(privateKey, provider);
    return new Contract(route.contractAddress, this.abi, signer);
  }

  private requiredConfig(key: string) {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`${key} is required when OWNERSHIP_ADAPTER=testnet`);
    }
    return value;
  }

  private requiredWallet(value: string | null, label: string) {
    if (!value) {
      throw new Error(
        `A ${label} wallet address is required for testnet ownership calls`,
      );
    }
    return value;
  }

  private requiredTokenId(tokenId: string | null) {
    if (!tokenId) {
      throw new Error("A token id is required for testnet ownership calls");
    }
    return tokenId;
  }

  private requiredRoute(
    route: OwnershipContractRoute | null | undefined,
    requireCurrentAddress = false,
  ) {
    const normalized = this.normalizeRoute(route);
    const configuredChainId =
      this.config.get<string>("TESTNET_CHAIN_ID")?.trim() ?? "11155111";
    if (normalized.chainId !== configuredChainId) {
      throw new Error(
        "Ticket ownership route chain does not match the configured testnet RPC",
      );
    }
    if (
      requireCurrentAddress &&
      normalized.contractAddress !==
        this.requiredConfig("FANPASS_TICKET_CONTRACT_ADDRESS").toLowerCase()
    ) {
      throw new Error(
        "New ticket issuance route does not match the configured FanPassTicket contract",
      );
    }
    return normalized;
  }

  private normalizeRoute(route: OwnershipContractRoute | null | undefined) {
    if (!route) {
      throw new Error(
        "A ticket ownership contract route snapshot is required for testnet ownership calls",
      );
    }
    const contractAddress = route.contractAddress.trim().toLowerCase();
    const chainId = route.chainId.trim();
    if (!/^0x[a-f0-9]{40}$/.test(contractAddress)) {
      throw new Error("Ticket ownership contract route address is invalid");
    }
    if (!/^[1-9][0-9]*$/.test(chainId)) {
      throw new Error("Ticket ownership contract route chain id is invalid");
    }
    if (route.contractVersion !== FANPASS_TICKET_CONTRACT_VERSION) {
      throw new Error("Ticket ownership contract route version is unsupported");
    }
    return { contractAddress, chainId, contractVersion: route.contractVersion };
  }

  private chainEventId(eventId: string) {
    if (/^\d+$/.test(eventId)) {
      return BigInt(eventId);
    }
    return BigInt(
      `0x${createHash("sha256").update(eventId).digest("hex").slice(0, 16)}`,
    );
  }

  private bytes32Hash(value: string) {
    return `0x${createHash("sha256").update(value).digest("hex")}`;
  }

  private async loadEthers(): Promise<EthersRuntime> {
    try {
      return (await import("ethers")) as unknown as EthersRuntime;
    } catch (error) {
      throw new Error(
        `ethers is required when OWNERSHIP_ADAPTER=testnet: ${(error as Error).message}`,
      );
    }
  }

  private extractMintedTokenId(
    contract: TestnetContract,
    receipt: { logs?: unknown[] } | null,
  ) {
    for (const log of receipt?.logs ?? []) {
      try {
        const parsed = contract.interface.parseLog(log as never);
        if (parsed?.name === "TicketMinted") {
          return parsed.args.tokenId.toString();
        }
      } catch {
        // Ignore unrelated logs.
      }
    }
    return null;
  }
}

class PrivySponsoredOwnershipAdapter implements OwnershipAdapter {
  readonly name = "privy" as const;

  private readonly abi = [
    "function mintTicketWithProof(address to,uint256 eventId,bytes32 ticketIdHash,bytes32 ticketTypeHash,bytes32 policyHash,bytes32 metadataHash,bool transferable,uint256 resaleCap,uint256 maxTransferCount,string metadataUri) returns (uint256)",
    "function tokenIdByTicketIdHash(bytes32 ticketIdHash) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function states(uint256 tokenId) view returns (uint8)",
    "function syncTicketTransfer(address from,address to,uint256 tokenId)",
    "function redeem(uint256 tokenId)",
    "event TicketMinted(uint256 indexed tokenId,uint256 indexed eventId,address indexed owner)",
    "event TicketTransferSynced(uint256 indexed tokenId,address indexed from,address indexed to)",
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly privyWallets: PrivyWalletService,
  ) {}

  async issueTicket(
    input: IssueOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ): Promise<OwnershipReceipt> {
    const route = this.requiredRoute(input.contractRoute, true);
    const prepared = await this.beforeSubmission(
      "Ownership issuance was not submitted",
      async () => {
        const ownerWallet = this.requiredWallet(
          input.ownerWalletAddress,
          "owner",
        );
        const ticketIdHash = this.bytes32Hash(`ticket:${input.localTicketId}`);
        const existingTokenId = await this.tokenIdForTicketHash(
          ticketIdHash,
          route,
        );
        if (existingTokenId) {
          return {
            kind: "RECONCILED" as const,
            receipt: this.reconciledIssueReceipt(existingTokenId, route),
          };
        }
        const policyHash = this.bytes32Hash(
          [
            "policy",
            input.eventId,
            input.ticketTypeId,
            String(input.transferable),
            String(input.resaleCap ?? 0),
            String(input.maxTransferCount),
          ].join(":"),
        );
        const data = await this.encodeFunctionData("mintTicketWithProof", [
          ownerWallet,
          this.chainEventId(input.eventId),
          ticketIdHash,
          this.bytes32Hash(`ticket-type:${input.ticketTypeId}`),
          policyHash,
          this.bytes32Hash(
            `metadata:${input.metadataUri ?? input.localTicketId}`,
          ),
          input.transferable,
          input.resaleCap ?? 0,
          input.maxTransferCount,
          input.metadataUri ?? "",
        ]);
        return { kind: "READY" as const, data, ticketIdHash };
      },
    );
    if (prepared.kind === "RECONCILED") {
      return prepared.receipt;
    }
    const submitted = await this.send(
      prepared.data,
      input.idempotencyKey,
      hooks,
      route,
    );
    return this.afterSubmission(
      "Ownership issuance outcome is ambiguous",
      async () => {
        const receipt = await this.waitForReceipt(submitted.hash);
        const status = this.receiptStatus(receipt);
        if (status === "FAILED") {
          const reconciledTokenId = await this.tokenIdForTicketHash(
            prepared.ticketIdHash,
            route,
          );
          if (reconciledTokenId) {
            return this.reconciledIssueReceipt(reconciledTokenId, route);
          }
        }
        const tokenId =
          (await this.extractMintedTokenId(receipt?.logs ?? [])) ??
          input.tokenIdHint;
        return {
          adapter: this.name,
          status,
          tokenId,
          ownershipRef: `${route.contractAddress}:${tokenId}`,
          transactionHash: submitted.hash,
          contractRoute: route,
        };
      },
    );
  }

  async transferTicket(
    input: TransferOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ): Promise<OwnershipReceipt> {
    const route = this.requiredRoute(input.contractRoute);
    const prepared = await this.beforeSubmission(
      "Ownership transfer was not submitted",
      async () => {
        const tokenId = this.requiredTokenId(input.tokenId);
        const fromWallet = this.requiredWallet(
          input.fromWalletAddress,
          "from owner",
        );
        const toWallet = this.requiredWallet(input.toWalletAddress, "to owner");
        const reconciled = await this.reconcileTransferState(
          {
            tokenId,
            fromWalletAddress: fromWallet,
            toWalletAddress: toWallet,
          },
          route,
        );
        if (reconciled) {
          return {
            kind: "RECONCILED" as const,
            receipt: this.reconciledReceipt(tokenId, route),
          };
        }
        const data = await this.encodeFunctionData("syncTicketTransfer", [
          fromWallet,
          toWallet,
          BigInt(tokenId),
        ]);
        return { kind: "READY" as const, tokenId, fromWallet, toWallet, data };
      },
    );
    if (prepared.kind === "RECONCILED") {
      return prepared.receipt;
    }
    const submitted = await this.send(
      prepared.data,
      input.idempotencyKey,
      hooks,
      route,
    );
    return this.afterSubmission(
      "Ownership transfer outcome is ambiguous",
      async () => {
        const receipt = await this.waitForReceipt(submitted.hash);
        let status = this.receiptStatus(receipt);
        if (
          status === "FAILED" &&
          (await this.reconcileTransferState(
            {
              tokenId: prepared.tokenId,
              fromWalletAddress: prepared.fromWallet,
              toWalletAddress: prepared.toWallet,
            },
            route,
          ))
        ) {
          status = "CONFIRMED";
        }
        return {
          adapter: this.name,
          status,
          tokenId: prepared.tokenId,
          ownershipRef: `${route.contractAddress}:${prepared.tokenId}`,
          transactionHash: submitted.hash,
          contractRoute: route,
        };
      },
    );
  }

  async redeemTicket(
    input: RedeemOwnershipInput,
    hooks?: OwnershipSubmissionHooks,
  ): Promise<OwnershipReceipt> {
    const route = this.requiredRoute(input.contractRoute);
    const prepared = await this.beforeSubmission(
      "Ownership redemption was not submitted",
      async () => {
        const tokenId = this.requiredTokenId(input.tokenId);
        const reconciled = await this.reconcileRedeemState(tokenId, route);
        if (reconciled) {
          return {
            kind: "RECONCILED" as const,
            receipt: this.reconciledReceipt(tokenId, route),
          };
        }
        const data = await this.encodeFunctionData("redeem", [BigInt(tokenId)]);
        return { kind: "READY" as const, tokenId, data };
      },
    );
    if (prepared.kind === "RECONCILED") {
      return prepared.receipt;
    }
    const submitted = await this.send(
      prepared.data,
      input.idempotencyKey,
      hooks,
      route,
    );
    return this.afterSubmission(
      "Ownership redemption outcome is ambiguous",
      async () => {
        const receipt = await this.waitForReceipt(submitted.hash);
        let status = this.receiptStatus(receipt);
        if (
          status === "FAILED" &&
          (await this.reconcileRedeemState(prepared.tokenId, route))
        ) {
          status = "CONFIRMED";
        }
        return {
          adapter: this.name,
          status,
          tokenId: prepared.tokenId,
          ownershipRef: `${route.contractAddress}:${prepared.tokenId}`,
          transactionHash: submitted.hash,
          contractRoute: route,
        };
      },
    );
  }

  async resolveReceipt(
    input: ResolveOwnershipReceiptInput,
  ): Promise<OwnershipReceipt> {
    const route = this.requiredRoute(input.contractRoute);
    return this.afterSubmission(
      "Ownership receipt outcome is ambiguous",
      async () => {
        const reconciledTokenId = await this.reconcileOperation(input, route);
        if (reconciledTokenId) {
          return {
            ...input,
            status: "CONFIRMED",
            tokenId: reconciledTokenId,
            ownershipRef: `${route.contractAddress}:${reconciledTokenId}`,
            contractRoute: route,
          };
        }
        const receipt = await this.waitForReceipt(input.transactionHash);
        let status = this.receiptStatus(receipt);
        const tokenId =
          status === "CONFIRMED"
            ? ((await this.extractMintedTokenId(receipt?.logs ?? [])) ??
              input.tokenId)
            : input.tokenId;
        if (status !== "CONFIRMED") {
          const reconciledAfterReceipt = await this.reconcileOperation(
            {
              ...input,
              tokenId,
            },
            route,
          );
          if (reconciledAfterReceipt) {
            status = "CONFIRMED";
            return {
              ...input,
              status,
              tokenId: reconciledAfterReceipt,
              ownershipRef: `${route.contractAddress}:${reconciledAfterReceipt}`,
              contractRoute: route,
            };
          }
        }
        return {
          ...input,
          status,
          tokenId,
          ownershipRef: `${route.contractAddress}:${tokenId}`,
          contractRoute: route,
        };
      },
    );
  }

  private async send(
    data: string,
    idempotencyKey?: string,
    hooks?: OwnershipSubmissionHooks,
    route?: OwnershipContractRoute,
  ) {
    const requiredRoute = this.requiredRoute(route);
    const request = await this.beforeSubmission(
      "Privy ownership request was not submitted",
      async () => {
        const stableIdempotencyKey =
          this.requiredIdempotencyKey(idempotencyKey);
        await this.assertSponsorOwnsContract(requiredRoute);
        return {
          walletId: this.requiredConfig("FANPASS_PRIVY_SPONSOR_WALLET_ID"),
          caip2: this.caip2(requiredRoute),
          idempotencyKey: stableIdempotencyKey,
          transaction: {
            to: requiredRoute.contractAddress,
            data,
          },
        };
      },
    );
    let submitted: Awaited<
      ReturnType<PrivyWalletService["sendSponsoredEthereumTransaction"]>
    >;
    try {
      await hooks?.beforeProviderSubmission?.();
    } catch (error) {
      throw OwnershipOperationError.definitelyNotSubmitted(
        error,
        "Privy ownership submission fence could not be persisted",
      );
    }
    try {
      submitted =
        await this.privyWallets.sendSponsoredEthereumTransaction(request);
    } catch (error) {
      throw OwnershipOperationError.ambiguous(
        error,
        "Privy ownership submission is ambiguous",
      );
    }
    return this.afterSubmission(
      "Privy ownership submission is ambiguous",
      async () => {
        if (submitted.hash) {
          return submitted;
        }
        if (submitted.providerId) {
          const resolved = await this.privyWallets.waitForTransactionHash({
            transactionId: submitted.providerId,
            timeoutMs: this.integerConfig(
              "FANPASS_PRIVY_TRANSACTION_HASH_TIMEOUT_MS",
              45_000,
            ),
          });
          if (resolved.hash) {
            return {
              hash: resolved.hash,
              providerId: resolved.providerId ?? submitted.providerId,
              rawStatus: resolved.rawStatus ?? submitted.rawStatus,
              userOperationHash:
                resolved.userOperationHash ?? submitted.userOperationHash,
            };
          }
          throw new Error(
            `Privy sponsored transaction did not resolve a Sepolia transaction hash (status=${resolved.rawStatus ?? submitted.rawStatus ?? "unknown"}, transactionId=${submitted.providerId})`,
          );
        }
        throw new Error(
          `Privy sponsored transaction did not return a Sepolia transaction hash or transaction id (status=${submitted.rawStatus ?? "unknown"})`,
        );
      },
    );
  }

  private async beforeSubmission<T>(
    context: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw OwnershipOperationError.definitelyNotSubmitted(error, context);
    }
  }

  private async afterSubmission<T>(
    context: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw OwnershipOperationError.ambiguous(error, context);
    }
  }

  private async assertSponsorOwnsContract(route: OwnershipContractRoute) {
    const sponsorAddress = this.optionalConfig(
      "FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS",
    );
    const rpcUrl = this.optionalConfig("TESTNET_RPC_URL");
    if (!sponsorAddress || !rpcUrl) {
      return;
    }
    const owner = await this.contractOwner(rpcUrl, route);
    if (!owner) {
      throw new Error(
        "Unable to verify FanPassTicket owner before Privy sponsored transaction",
      );
    }
    if (owner.toLowerCase() !== sponsorAddress.toLowerCase()) {
      throw new Error(
        "FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS does not match the FanPassTicket contract owner",
      );
    }
  }

  private async contractOwner(rpcUrl: string, route: OwnershipContractRoute) {
    const result = await this.rpcCall<string>(rpcUrl, "eth_call", [
      {
        to: route.contractAddress,
        data: "0x8da5cb5b",
      },
      "latest",
    ]);
    if (!result || !/^0x[a-fA-F0-9]{64}$/.test(result)) {
      return null;
    }
    return `0x${result.slice(-40)}`;
  }

  private async tokenIdForTicketHash(
    ticketIdHash: string,
    route: OwnershipContractRoute,
  ) {
    const rpcUrl = this.reconciliationRpcUrl();
    const data = await this.encodeFunctionData("tokenIdByTicketIdHash", [
      ticketIdHash,
    ]);
    const result = await this.rpcCall<string>(rpcUrl, "eth_call", [
      {
        to: route.contractAddress,
        data,
      },
      "latest",
    ]);
    if (result === null) {
      throw new Error(
        "Unable to reconcile logical ticket identity before ownership issuance",
      );
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(result)) {
      throw new Error(
        "FanPassTicket logical ticket lookup returned an invalid token id",
      );
    }
    const tokenId = BigInt(result);
    return tokenId === 0n ? null : tokenId.toString();
  }

  private reconciledIssueReceipt(
    tokenId: string,
    route: OwnershipContractRoute,
  ): OwnershipReceipt {
    return this.reconciledReceipt(tokenId, route);
  }

  private reconciledReceipt(
    tokenId: string,
    route: OwnershipContractRoute,
  ): OwnershipReceipt {
    return {
      adapter: this.name,
      status: "CONFIRMED",
      tokenId,
      ownershipRef: `${route.contractAddress}:${tokenId}`,
      transactionHash: null,
      contractRoute: route,
    };
  }

  private async reconcileOperation(
    input: ResolveOwnershipReceiptInput,
    route: OwnershipContractRoute,
  ) {
    switch (input.operation.type) {
      case "ISSUE":
        return this.tokenIdForTicketHash(
          this.bytes32Hash(`ticket:${input.operation.localTicketId}`),
          route,
        );
      case "TRANSFER":
        return (await this.reconcileTransferState(
          {
            tokenId: input.tokenId,
            fromWalletAddress: this.requiredWallet(
              input.operation.fromWalletAddress,
              "from owner",
            ),
            toWalletAddress: this.requiredWallet(
              input.operation.toWalletAddress,
              "to owner",
            ),
          },
          route,
        ))
          ? input.tokenId
          : null;
      case "REDEEM":
        return (await this.reconcileRedeemState(input.tokenId, route))
          ? input.tokenId
          : null;
    }
  }

  private async reconcileTransferState(
    input: {
      tokenId: string;
      fromWalletAddress: string;
      toWalletAddress: string;
    },
    route: OwnershipContractRoute,
  ) {
    const currentOwner = await this.ticketOwner(input.tokenId, route);
    if (this.sameAddress(currentOwner, input.toWalletAddress)) {
      return true;
    }
    if (!this.sameAddress(currentOwner, input.fromWalletAddress)) {
      throw new Error(
        "FanPassTicket owner does not match the expected transfer participants",
      );
    }
    return false;
  }

  private async reconcileRedeemState(
    tokenId: string,
    route: OwnershipContractRoute,
  ) {
    await this.ticketOwner(tokenId, route);
    const state = await this.ticketState(tokenId, route);
    if (state === 1) {
      return true;
    }
    if (state !== 0) {
      throw new Error(`FanPassTicket is not redeemable (state=${state})`);
    }
    return false;
  }

  private async ticketOwner(tokenId: string, route: OwnershipContractRoute) {
    const data = await this.encodeFunctionData("ownerOf", [BigInt(tokenId)]);
    const result = await this.rpcCall<string>(
      this.reconciliationRpcUrl(),
      "eth_call",
      [{ to: route.contractAddress, data }, "latest"],
    );
    if (!result || !/^0x[a-fA-F0-9]{64}$/.test(result)) {
      throw new Error("Unable to reconcile FanPassTicket owner");
    }
    const owner = `0x${result.slice(-40)}`;
    if (/^0x0{40}$/i.test(owner)) {
      throw new Error("FanPassTicket does not exist");
    }
    return owner;
  }

  private async ticketState(tokenId: string, route: OwnershipContractRoute) {
    const data = await this.encodeFunctionData("states", [BigInt(tokenId)]);
    const result = await this.rpcCall<string>(
      this.reconciliationRpcUrl(),
      "eth_call",
      [{ to: route.contractAddress, data }, "latest"],
    );
    if (!result || !/^0x[a-fA-F0-9]{64}$/.test(result)) {
      throw new Error("Unable to reconcile FanPassTicket state");
    }
    const state = Number(BigInt(result));
    if (!Number.isSafeInteger(state) || state < 0 || state > 3) {
      throw new Error("FanPassTicket returned an invalid state");
    }
    return state;
  }

  private sameAddress(left: string, right: string) {
    return left.toLowerCase() === right.toLowerCase();
  }

  private reconciliationRpcUrl() {
    return this.requiredConfig("TESTNET_RPC_URL");
  }

  private requiredIdempotencyKey(value?: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new Error(
        "A stable idempotency key is required for Privy ownership writes",
      );
    }
    if (normalized.length > 256) {
      throw new Error("Privy ownership idempotency key exceeds 256 characters");
    }
    return normalized;
  }

  private async encodeFunctionData(name: string, args: unknown[]) {
    const { Interface } = await this.loadEthers();
    return new Interface(this.abi).encodeFunctionData(name, args);
  }

  private async waitForReceipt(hash: string | null): Promise<{
    status?: string;
    logs?: unknown[];
  } | null> {
    if (!hash) {
      return null;
    }
    const rpcUrl = this.optionalConfig("TESTNET_RPC_URL");
    if (!rpcUrl) {
      return null;
    }
    const timeoutMs = this.integerConfig(
      "FANPASS_PRIVY_TX_RECEIPT_TIMEOUT_MS",
      45_000,
    );
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const receipt = await this.rpcCall<{
        status?: string;
        logs?: unknown[];
      }>(rpcUrl, "eth_getTransactionReceipt", [hash]);
      if (receipt) {
        return receipt;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    return null;
  }

  private receiptStatus(receipt: { status?: string } | null) {
    if (!receipt) {
      return "PENDING" as const;
    }
    return receipt.status === "0x1"
      ? ("CONFIRMED" as const)
      : ("FAILED" as const);
  }

  private async rpcCall<T>(
    rpcUrl: string,
    method: string,
    params: unknown[],
  ): Promise<T | null> {
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
      signal: AbortSignal.timeout(
        this.integerConfig("FANPASS_RPC_TIMEOUT_MS", 10_000),
      ),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      result?: T | null;
      error?: { message?: string };
    };
    if (body.error) {
      return null;
    }
    return body.result ?? null;
  }

  private caip2(route: OwnershipContractRoute) {
    return `eip155:${route.chainId}`;
  }

  private requiredRoute(
    route: OwnershipContractRoute | null | undefined,
    requireCurrentAddress = false,
  ): OwnershipContractRoute {
    if (!route) {
      throw new Error(
        "A ticket ownership contract route snapshot is required for Privy ownership calls",
      );
    }
    const contractAddress = route.contractAddress.trim().toLowerCase();
    const chainId = route.chainId.trim();
    if (!/^0x[a-f0-9]{40}$/.test(contractAddress)) {
      throw new Error("Ticket ownership contract route address is invalid");
    }
    if (!/^[1-9][0-9]*$/.test(chainId)) {
      throw new Error("Ticket ownership contract route chain id is invalid");
    }
    if (route.contractVersion !== FANPASS_TICKET_CONTRACT_VERSION) {
      throw new Error("Ticket ownership contract route version is unsupported");
    }
    const configuredCaip2 =
      this.optionalConfig("FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2") ??
      `eip155:${this.optionalConfig("TESTNET_CHAIN_ID") ?? "11155111"}`;
    if (configuredCaip2 !== `eip155:${chainId}`) {
      throw new Error(
        "Ticket ownership route chain does not match the configured Privy sponsor chain",
      );
    }
    if (
      requireCurrentAddress &&
      contractAddress !==
        this.requiredConfig("FANPASS_TICKET_CONTRACT_ADDRESS").toLowerCase()
    ) {
      throw new Error(
        "New ticket issuance route does not match the configured FanPassTicket contract",
      );
    }
    return {
      contractAddress,
      chainId,
      contractVersion: FANPASS_TICKET_CONTRACT_VERSION,
    };
  }

  private requiredConfig(key: string) {
    const value = this.optionalConfig(key);
    if (!value) {
      throw new Error(`${key} is required when OWNERSHIP_ADAPTER=privy`);
    }
    return value;
  }

  private optionalConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();
    return value ? value : null;
  }

  private integerConfig(key: string, fallback: number) {
    const value = Number(this.config.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private requiredWallet(value: string | null, label: string) {
    if (!value) {
      throw new Error(
        `A ${label} wallet address is required for Privy sponsored ownership calls`,
      );
    }
    return value;
  }

  private requiredTokenId(tokenId: string | null) {
    if (!tokenId) {
      throw new Error("A token id is required for Privy ownership calls");
    }
    return tokenId;
  }

  private chainEventId(eventId: string) {
    if (/^\d+$/.test(eventId)) {
      return BigInt(eventId);
    }
    return BigInt(
      `0x${createHash("sha256").update(eventId).digest("hex").slice(0, 16)}`,
    );
  }

  private bytes32Hash(value: string) {
    return `0x${createHash("sha256").update(value).digest("hex")}`;
  }

  private async loadEthers(): Promise<EthersRuntime> {
    try {
      return (await import("ethers")) as unknown as EthersRuntime;
    } catch (error) {
      throw new Error(
        `ethers is required when OWNERSHIP_ADAPTER=privy: ${(error as Error).message}`,
      );
    }
  }

  private async extractMintedTokenId(logs: unknown[]) {
    const { Interface } = await this.loadEthers();
    const iface = new Interface(this.abi);
    for (const log of logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "TicketMinted") {
          return parsed.args.tokenId.toString();
        }
      } catch {
        // Ignore unrelated logs.
      }
    }
    return null;
  }
}
