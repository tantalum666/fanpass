import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "crypto";
import { isProductionLikeEnvironment } from "../../config/security-config";

export interface OwnershipReceipt {
  adapter: "mock" | "testnet";
  status: "CONFIRMED" | "PENDING";
  tokenId: string;
  ownershipRef: string;
  transactionHash: string | null;
}

export interface IssueOwnershipInput {
  localTicketId: string;
  tokenIdHint: string;
  eventId: string;
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
  mintTicket(
    to: string,
    eventId: bigint,
    transferable: boolean,
    resaleCap: number,
    maxTransferCount: number,
    metadataUri: string,
  ): Promise<TestnetTransaction>;
  transferFrom(
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
  JsonRpcProvider: new (url: string) => unknown;
  Wallet: new (privateKey: string, provider: unknown) => unknown;
}

@Injectable()
export class OwnershipService {
  constructor(private readonly config: ConfigService) {}

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
    if (this.config.get<string>("OWNERSHIP_ADAPTER") !== "testnet") {
      return new MockOwnershipAdapter();
    }
    if (this.productionLike()) {
      throw new Error(
        "OWNERSHIP_ADAPTER=testnet is blocked in production-like environments until real chain ownership settlement runs only through the durable async saga",
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
    "function mintTicket(address to,uint256 eventId,bool transferable,uint256 resaleCap,uint256 maxTransferCount,string metadataUri) returns (uint256)",
    "function transferFrom(address from,address to,uint256 tokenId)",
    "function redeem(uint256 tokenId)",
    "event TicketMinted(uint256 indexed tokenId,uint256 indexed eventId,address indexed owner)",
  ];

  constructor(private readonly config: ConfigService) {}

  async issueTicket(input: IssueOwnershipInput): Promise<OwnershipReceipt> {
    const contract = await this.contract();
    const ownerWallet = this.requiredWallet(input.ownerWalletAddress, "owner");
    const tx = await contract.mintTicket(
      ownerWallet,
      this.chainEventId(input.eventId),
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
    const tx = await contract.transferFrom(
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
