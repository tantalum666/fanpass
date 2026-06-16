import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "crypto";
import {
  allowsPrivateKeyTestnetWrites,
  isProductionLikeEnvironment,
} from "../../config/security-config";
import { PrivyWalletService } from "../privy/privy-wallet.service";

export interface OwnershipReceipt {
  adapter: "mock" | "testnet" | "privy";
  status: "CONFIRMED" | "PENDING";
  tokenId: string;
  ownershipRef: string;
  transactionHash: string | null;
}

export interface IssueOwnershipInput {
  localTicketId: string;
  tokenIdHint: string;
  eventId: string;
  ticketTypeId: string;
  ownerId: string;
  ownerWalletAddress: string | null;
  transferable: boolean;
  resaleCap: number | null;
  maxTransferCount: number;
  metadataUri: string | null;
}

export interface TransferOwnershipInput {
  ticketId: string;
  tokenId: string | null;
  fromOwnerId: string;
  fromWalletAddress: string | null;
  toOwnerId: string;
  toWalletAddress: string | null;
}

export interface RedeemOwnershipInput {
  ticketId: string;
  tokenId: string | null;
}

interface OwnershipAdapter {
  readonly name: OwnershipReceipt["adapter"];
  issueTicket(input: IssueOwnershipInput): Promise<OwnershipReceipt>;
  transferTicket(input: TransferOwnershipInput): Promise<OwnershipReceipt>;
  redeemTicket(input: RedeemOwnershipInput): Promise<OwnershipReceipt>;
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

  issueTicket(input: IssueOwnershipInput) {
    return this.adapter().issueTicket(input);
  }

  transferTicket(input: TransferOwnershipInput) {
    return this.adapter().transferTicket(input);
  }

  redeemTicket(input: RedeemOwnershipInput) {
    return this.adapter().redeemTicket(input);
  }

  private adapter(): OwnershipAdapter {
    if (this.config.get<string>("OWNERSHIP_ADAPTER") === "privy") {
      return new PrivySponsoredOwnershipAdapter(
        this.config,
        this.privyWallets ?? new PrivyWalletService(this.config),
      );
    }
    if (this.config.get<string>("OWNERSHIP_ADAPTER") !== "testnet") {
      return new MockOwnershipAdapter();
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
}

class MockOwnershipAdapter implements OwnershipAdapter {
  readonly name = "mock" as const;

  async issueTicket(input: IssueOwnershipInput): Promise<OwnershipReceipt> {
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

  private receipt(tokenId: string, ownershipRef: string): OwnershipReceipt {
    return {
      adapter: this.name,
      status: "CONFIRMED",
      tokenId,
      ownershipRef,
      transactionHash: `mock_${randomUUID()}`,
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
    "function syncTicketTransfer(address from,address to,uint256 tokenId)",
    "function redeem(uint256 tokenId)",
    "event TicketMinted(uint256 indexed tokenId,uint256 indexed eventId,address indexed owner)",
    "event TicketTransferSynced(uint256 indexed tokenId,address indexed from,address indexed to)",
  ];

  constructor(private readonly config: ConfigService) {}

  async issueTicket(input: IssueOwnershipInput): Promise<OwnershipReceipt> {
    const contract = await this.contract();
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
      ownershipRef: `${this.contractAddress()}:${tokenId}`,
      transactionHash: receipt?.hash ?? tx.hash ?? null,
    };
  }

  async transferTicket(
    input: TransferOwnershipInput,
  ): Promise<OwnershipReceipt> {
    const tokenId = this.requiredTokenId(input.tokenId);
    const contract = await this.contract();
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
      ownershipRef: `${this.contractAddress()}:${tokenId}`,
      transactionHash: receipt?.hash ?? tx.hash ?? null,
    };
  }

  async redeemTicket(input: RedeemOwnershipInput): Promise<OwnershipReceipt> {
    const tokenId = this.requiredTokenId(input.tokenId);
    const contract = await this.contract();
    const tx = await contract.redeem(BigInt(tokenId));
    const receipt = await tx.wait();
    return {
      adapter: this.name,
      status: "CONFIRMED",
      tokenId,
      ownershipRef: `${this.contractAddress()}:${tokenId}`,
      transactionHash: receipt?.hash ?? tx.hash ?? null,
    };
  }

  private async contract() {
    const rpcUrl = this.requiredConfig("TESTNET_RPC_URL");
    const privateKey = this.requiredConfig("TESTNET_OPERATOR_PRIVATE_KEY");
    const contractAddress = this.contractAddress();
    const { Contract, JsonRpcProvider, Wallet } = await this.loadEthers();
    const provider = new JsonRpcProvider(rpcUrl);
    const signer = new Wallet(privateKey, provider);
    return new Contract(contractAddress, this.abi, signer);
  }

  private contractAddress() {
    return this.requiredConfig("FANPASS_TICKET_CONTRACT_ADDRESS");
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
    "function syncTicketTransfer(address from,address to,uint256 tokenId)",
    "function redeem(uint256 tokenId)",
    "event TicketMinted(uint256 indexed tokenId,uint256 indexed eventId,address indexed owner)",
    "event TicketTransferSynced(uint256 indexed tokenId,address indexed from,address indexed to)",
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly privyWallets: PrivyWalletService,
  ) {}

  async issueTicket(input: IssueOwnershipInput): Promise<OwnershipReceipt> {
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
    const data = await this.encodeFunctionData("mintTicketWithProof", [
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
    ]);
    const submitted = await this.send(data);
    const receipt = await this.waitForReceipt(submitted.hash);
    const tokenId =
      (await this.extractMintedTokenId(receipt?.logs ?? [])) ??
      input.tokenIdHint;
    return {
      adapter: this.name,
      status: receipt?.status === "0x1" ? "CONFIRMED" : "PENDING",
      tokenId,
      ownershipRef: `${this.contractAddress()}:${tokenId}`,
      transactionHash: submitted.hash,
    };
  }

  async transferTicket(
    input: TransferOwnershipInput,
  ): Promise<OwnershipReceipt> {
    const tokenId = this.requiredTokenId(input.tokenId);
    const data = await this.encodeFunctionData("syncTicketTransfer", [
      this.requiredWallet(input.fromWalletAddress, "from owner"),
      this.requiredWallet(input.toWalletAddress, "to owner"),
      BigInt(tokenId),
    ]);
    const submitted = await this.send(data);
    const receipt = await this.waitForReceipt(submitted.hash);
    return {
      adapter: this.name,
      status: receipt?.status === "0x1" ? "CONFIRMED" : "PENDING",
      tokenId,
      ownershipRef: `${this.contractAddress()}:${tokenId}`,
      transactionHash: submitted.hash,
    };
  }

  async redeemTicket(input: RedeemOwnershipInput): Promise<OwnershipReceipt> {
    const tokenId = this.requiredTokenId(input.tokenId);
    const data = await this.encodeFunctionData("redeem", [BigInt(tokenId)]);
    const submitted = await this.send(data);
    const receipt = await this.waitForReceipt(submitted.hash);
    return {
      adapter: this.name,
      status: receipt?.status === "0x1" ? "CONFIRMED" : "PENDING",
      tokenId,
      ownershipRef: `${this.contractAddress()}:${tokenId}`,
      transactionHash: submitted.hash,
    };
  }

  private async send(data: string) {
    await this.assertSponsorOwnsContract();
    const submitted = await this.privyWallets.sendSponsoredEthereumTransaction({
      walletId: this.requiredConfig("FANPASS_PRIVY_SPONSOR_WALLET_ID"),
      caip2: this.caip2(),
      transaction: {
        to: this.contractAddress(),
        data,
      },
    });
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
  }

  private async assertSponsorOwnsContract() {
    const sponsorAddress = this.optionalConfig(
      "FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS",
    );
    const rpcUrl = this.optionalConfig("TESTNET_RPC_URL");
    if (!sponsorAddress || !rpcUrl) {
      return;
    }
    const owner = await this.contractOwner(rpcUrl);
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

  private async contractOwner(rpcUrl: string) {
    const result = await this.rpcCall<string>(rpcUrl, "eth_call", [
      {
        to: this.contractAddress(),
        data: "0x8da5cb5b",
      },
      "latest",
    ]);
    if (!result || !/^0x[a-fA-F0-9]{64}$/.test(result)) {
      return null;
    }
    return `0x${result.slice(-40)}`;
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

  private contractAddress() {
    return this.requiredConfig("FANPASS_TICKET_CONTRACT_ADDRESS");
  }

  private caip2() {
    return (
      this.optionalConfig("FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2") ??
      `eip155:${this.optionalConfig("TESTNET_CHAIN_ID") ?? "11155111"}`
    );
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
