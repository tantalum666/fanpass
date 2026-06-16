import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { DemoStore } from "../../common/demo-store";
import { TicketRecord } from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import { FanPassSession } from "../../common/session";
import { AuditService } from "../audit/audit.service";
import { TicketOwnershipSideEffectsService } from "../side-effects/ticket-ownership-side-effects.service";

export interface IssueTicketInput {
  eventId: string;
  ticketTypeId: string;
  ownerId: string;
  seatHash?: string;
}

export interface TicketProofHistoryItem {
  id: string;
  label: string;
  state: string;
  timestamp: string;
  description: string;
  safeTicketRef: string;
  proofReference?: string;
  externalUrl?: string;
}

export interface TicketChainProofResponse {
  status:
    | "linked"
    | "no_chain_record"
    | "not_configured"
    | "rpc_unavailable"
    | "mismatch";
  chainId: string | null;
  contractAddress: string | null;
  contractExplorerUrl: string | null;
  ticket: {
    id: string;
    safeTicketRef: string;
    tokenId: string | null;
    eventId: string;
    ticketTypeId: string;
  };
  wallet: {
    expectedOwnerAddress: string | null;
    onChainOwnerAddress: string | null;
    matches: boolean | null;
  };
  event: {
    expectedChainEventId: string;
    onChainEventId: string | null;
    matches: boolean | null;
  };
  proof: {
    ticketIdHashMatches: boolean | null;
    ticketTypeHashMatches: boolean | null;
    policyHashMatches: boolean | null;
    metadataHashMatches: boolean | null;
    state: string | null;
    transferCount: string | null;
  };
  transaction: {
    hash: string;
    status: "success" | "failed" | "pending" | "not_found";
    blockNumber: number | null;
    blockTimestamp: string | null;
    explorerUrl: string;
  } | null;
  checkedAt: string;
  message: string;
}

interface TicketChainLookupInput {
  id: string;
  tokenId: string | null;
  eventId: string;
  ticketTypeId: string;
  transferable: boolean;
  resaleCap: number | null;
  maxTransferCount: number;
  metadataUri: string | null;
  ownerWalletAddress: string | null;
  auditLogs: Array<{ action: string; createdAt: string; metadata?: unknown }>;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly store: DemoStore,
    private readonly audit: AuditService,
    private readonly ticketOwnership: TicketOwnershipSideEffectsService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  listTickets(session?: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      const eventWhere = this.prismaTicketEventScope(session);
      return prisma.ticket
        .findMany({
          where: eventWhere,
          include: {
            event: true,
            ticketType: true,
          },
          orderBy: {
            id: "asc",
          },
        })
        .then((tickets) =>
          tickets.map((ticket) => this.mapExpandedPrismaTicket(ticket)),
        );
    }

    return this.store.tickets
      .filter((ticket) => this.memoryCanAccessEvent(ticket.eventId, session))
      .map((ticket) => this.expandTicket(ticket.id));
  }

  getTicket(id: string, session?: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      return prisma.ticket
        .findUniqueOrThrow({
          where: { id },
          include: {
            event: true,
            ticketType: true,
          },
        })
        .then((ticket) => {
          this.assertPrismaExpandedTicketAccess(ticket, session);
          return this.mapExpandedPrismaTicket(ticket);
        });
    }

    const ticket = this.store.getTicket(id);
    this.assertMemoryEventAccess(ticket.eventId, session);
    return this.expandTicket(ticket.id);
  }

  async getProofHistory(id: string, session?: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      const ticket = await prisma.ticket.findUniqueOrThrow({
        where: { id },
        include: {
          event: {
            include: {
              organizer: true,
            },
          },
          ticketType: true,
          checkins: {
            orderBy: {
              checkedInAt: "desc",
            },
            take: 1,
          },
        },
      });
      this.assertPrismaProofAccess(ticket, session);
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: "ticket",
          entityId: ticket.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 12,
      });

      return this.buildProofHistory({
        id: ticket.id,
        status: ticket.status,
        transferCount: ticket.transferCount,
        eventTitle: ticket.event.title,
        ticketTypeName: ticket.ticketType.name,
        auditLogs: auditLogs.map((log) => ({
          action: log.action,
          createdAt: log.createdAt.toISOString(),
          metadata: log.metadataJson,
        })),
        latestCheckinAt: ticket.checkins[0]?.checkedInAt.toISOString(),
      });
    }

    const ticket = this.store.getTicket(id);
    this.assertMemoryProofAccess(ticket, session);
    const event = this.store.getEvent(ticket.eventId);
    const ticketType = this.store.getTicketType(ticket.ticketTypeId);
    const auditLogs = this.store.auditLogs
      .filter((log) => log.entityType === "ticket" && log.entityId === id)
      .map((log) => ({
        action: log.action,
        createdAt: log.createdAt,
        metadata: log.metadata,
      }));
    const latestCheckinAt = this.store.checkins.find(
      (checkin) => checkin.ticketId === id,
    )?.checkedInAt;

    return this.buildProofHistory({
      id: ticket.id,
      status: ticket.status,
      transferCount: ticket.transferCount,
      eventTitle: event.title,
      ticketTypeName: ticketType.name,
      auditLogs,
      latestCheckinAt,
    });
  }

  async getChainProof(
    id: string,
    session?: FanPassSession,
  ): Promise<TicketChainProofResponse> {
    const prisma = this.prismaClient();
    if (prisma) {
      const ticket = await prisma.ticket.findUniqueOrThrow({
        where: { id },
        include: {
          event: {
            include: {
              organizer: true,
            },
          },
          ticketType: true,
          owner: true,
        },
      });
      this.assertPrismaProofAccess(ticket, session);
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: "ticket",
          entityId: ticket.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      });
      return this.buildChainProof({
        id: ticket.id,
        tokenId: ticket.tokenId,
        eventId: ticket.eventId,
        ticketTypeId: ticket.ticketTypeId,
        transferable: ticket.ticketType.transferable,
        resaleCap: ticket.ticketType.resaleCap,
        maxTransferCount: ticket.ticketType.maxTransferCount,
        metadataUri: ticket.metadataUri,
        ownerWalletAddress: ticket.owner.walletAddress,
        auditLogs: auditLogs.map((log) => ({
          action: log.action,
          createdAt: log.createdAt.toISOString(),
          metadata: log.metadataJson,
        })),
      });
    }

    const ticket = this.store.getTicket(id);
    this.assertMemoryProofAccess(ticket, session);
    const ticketType = this.store.getTicketType(ticket.ticketTypeId);
    const owner = this.store.users.find((user) => user.id === ticket.ownerId);
    const auditLogs = this.store.auditLogs
      .filter((log) => log.entityType === "ticket" && log.entityId === id)
      .map((log) => ({
        action: log.action,
        createdAt: log.createdAt,
        metadata: log.metadata,
      }));
    return this.buildChainProof({
      id: ticket.id,
      tokenId: ticket.tokenId,
      eventId: ticket.eventId,
      ticketTypeId: ticket.ticketTypeId,
      transferable: ticketType.transferable,
      resaleCap: ticketType.resaleCap,
      maxTransferCount: ticketType.maxTransferCount,
      metadataUri: ticket.metadataUri,
      ownerWalletAddress: owner?.walletAddress ?? null,
      auditLogs,
    });
  }

  getRawTicket(id: string) {
    return this.store.getTicket(id);
  }

  listOwnedTickets(ownerId: string, session?: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      const eventScope = this.prismaTicketEventScope(session);
      return prisma.ticket
        .findMany({
          where: {
            ownerId,
            ...eventScope,
          },
          orderBy: {
            id: "asc",
          },
        })
        .then((tickets) =>
          tickets.map((ticket) => this.mapPrismaTicket(ticket)),
        );
    }

    return this.store.tickets.filter(
      (ticket) =>
        ticket.ownerId === ownerId &&
        this.memoryCanAccessEvent(ticket.eventId, session),
    );
  }

  async issueTicket(input: IssueTicketInput, session?: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.issuePrismaTicket(prisma, input, session);
    }

    this.store.getEvent(input.eventId);
    this.assertMemoryEventAccess(input.eventId, session);
    const ticketType = this.store.getTicketType(input.ticketTypeId);
    if (ticketType.eventId !== input.eventId) {
      throw new BadRequestException("Ticket type does not belong to event");
    }
    const owner = this.store.users.find(
      (candidate) => candidate.id === input.ownerId,
    );
    if (!owner) {
      throw new BadRequestException(`Owner ${input.ownerId} not found`);
    }
    const ticketId = `tkt_${randomUUID()}`;
    const ownership = await this.ticketOwnership.issueTicket({
      localTicketId: ticketId,
      tokenIdHint: String(this.store.tickets.length + 1),
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ownerId: input.ownerId,
      ownerWalletAddress: owner.walletAddress,
      transferable: ticketType.transferable,
      resaleCap: ticketType.resaleCap,
      maxTransferCount: ticketType.maxTransferCount,
      metadataUri: null,
    });
    const ticket: TicketRecord = {
      id: ticketId,
      tokenId: ownership.tokenId,
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ownerId: input.ownerId,
      seatHash: input.seatHash ?? null,
      status: "ACTIVE",
      transferCount: 0,
      metadataUri: null,
    };
    this.store.tickets.unshift(ticket);
    this.audit.record(input.ownerId, "TICKET_ISSUED", "ticket", ticket.id, {
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ownershipAdapter: ownership.adapter,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
    });
    return ticket;
  }

  assertCanGenerateEntryPayload(ticket: TicketRecord) {
    if (ticket.status !== "ACTIVE" && ticket.status !== "TRANSFERRED") {
      throw new BadRequestException(
        `Ticket status ${ticket.status} cannot generate an entry code`,
      );
    }
  }

  assertCanList(ticket: TicketRecord) {
    const ticketType = this.store.getTicketType(ticket.ticketTypeId);
    if (
      !ticketType.transferable ||
      ticket.transferCount >= ticketType.maxTransferCount
    ) {
      throw new BadRequestException("Ticket transfer policy blocks resale");
    }
    if (ticket.status !== "ACTIVE" && ticket.status !== "TRANSFERRED") {
      throw new BadRequestException(
        `Ticket status ${ticket.status} cannot be listed`,
      );
    }
  }

  assertCanRedeem(ticket: TicketRecord) {
    this.store.assertCanRedeem(ticket);
  }

  markListedForResale(ticketId: string, actorId: string, orderPrice: number) {
    const ticket = this.store.getTicket(ticketId);
    this.assertCanList(ticket);
    ticket.status = "LISTED_FOR_RESALE";
    this.audit.record(
      actorId,
      "TICKET_LISTED_FOR_RESALE",
      "ticket",
      ticket.id,
      {
        orderPrice,
      },
    );
    return ticket;
  }

  private expandTicket(id: string) {
    const ticket = this.store.getTicket(id);
    return {
      ...ticket,
      event: this.store.getEvent(ticket.eventId),
      ticketType: this.store.getTicketType(ticket.ticketTypeId),
    };
  }

  private buildProofHistory(input: {
    id: string;
    status: TicketRecord["status"];
    transferCount: number;
    eventTitle: string;
    ticketTypeName: string;
    auditLogs: Array<{
      action: string;
      createdAt: string;
      metadata?: unknown;
    }>;
    latestCheckinAt?: string;
  }): { items: TicketProofHistoryItem[] } {
    const safeTicketRef = this.safeTicketRef(input.id);
    const issuedAt =
      this.auditTimestamp(input.auditLogs, "TICKET_ISSUED") ??
      this.auditTimestamp(input.auditLogs, "TICKET_PURCHASED") ??
      null;
    const listedAt = this.auditTimestamp(
      input.auditLogs,
      "TICKET_LISTED_FOR_RESALE",
    );
    const redeemedAt =
      input.latestCheckinAt ??
      this.auditTimestamp(input.auditLogs, "TICKET_REDEEMED");
    const latestOwnership = this.latestOwnershipProof(input.auditLogs);

    const items: TicketProofHistoryItem[] = [
      {
        id: "issued",
        label: "Verified issue",
        state: "OK",
        timestamp: issuedAt ?? "Not recorded",
        description: `${input.eventTitle} ${input.ticketTypeName} is linked to ${safeTicketRef}.`,
        safeTicketRef,
      },
      {
        id: "holder-boundary",
        label: "Holder boundary",
        state: "Redacted",
        timestamp: "Current",
        description:
          "Current holder check passed. Full holder, wallet, signing, and scanner data remain hidden.",
        safeTicketRef,
      },
      {
        id: "lifecycle",
        label: "Lifecycle state",
        state: this.safeStatus(input.status),
        timestamp: listedAt ?? redeemedAt ?? "Current",
        description: this.lifecycleDescription(
          input.status,
          input.transferCount,
        ),
        safeTicketRef,
      },
      {
        id: "entry-code",
        label: "Dynamic code window",
        state: this.entryState(input.status),
        timestamp: "Short-lived",
        description:
          "Entry credentials are generated by the backend and rendered on web without exposing raw credential internals.",
        safeTicketRef,
      },
    ];
    if (
      latestOwnership &&
      this.isSepoliaOwnershipAdapter(latestOwnership.adapter)
    ) {
      items.push({
        id: "chain-proof",
        label: "On-chain proof",
        state: "Sepolia",
        timestamp: latestOwnership.createdAt,
        description:
          "Ticket lifecycle proof was written to the configured Sepolia contract and can be checked on the block explorer.",
        safeTicketRef,
        proofReference: latestOwnership.proofReference,
        externalUrl: latestOwnership.externalUrl,
      });
    }

    return { items };
  }

  private async buildChainProof(
    input: TicketChainLookupInput,
  ): Promise<TicketChainProofResponse> {
    const checkedAt = new Date().toISOString();
    const latestOwnership = this.latestOwnershipProof(input.auditLogs);
    const tokenId = input.tokenId ?? this.tokenIdFromOwnershipRef(
      latestOwnership?.ownershipRef ?? null,
    );
    const contractAddress =
      this.contractFromOwnershipRef(latestOwnership?.ownershipRef ?? null) ??
      this.configAddress("FANPASS_TICKET_CONTRACT_ADDRESS");
    const rpcUrl = this.firstConfigValue([
      "TESTNET_RPC_URL",
      "FANPASS_SEPOLIA_RPC_URL",
      "FANPASS_WALLET_RPC_URL",
    ]);
    const chainId =
      this.firstConfigValue(["TESTNET_CHAIN_ID", "FANPASS_WALLET_CHAIN_ID"]) ??
      (rpcUrl ? "11155111" : null);
    const contractExplorerUrl =
      contractAddress && chainId === "11155111"
        ? `https://sepolia.etherscan.io/address/${contractAddress}`
        : null;
    const base = this.chainProofBase(
      input,
      tokenId,
      chainId,
      contractAddress,
      contractExplorerUrl,
      checkedAt,
    );

    if (!rpcUrl || !contractAddress) {
      return {
        ...base,
        status: "not_configured",
        message:
          "FanPass API does not have enough Sepolia configuration to query this ticket on-chain.",
      };
    }

    try {
      const code = await this.rpcCall<string>(rpcUrl, "eth_getCode", [
        contractAddress,
        "latest",
      ]);
      if (code === "0x") {
        return {
          ...base,
          status: "no_chain_record",
          message: "The configured FanPass ticket contract has no bytecode on the selected chain.",
        };
      }
      if (!tokenId || !/^\d+$/.test(tokenId)) {
        return {
          ...base,
          status: "no_chain_record",
          message:
            "FanPass API queried Sepolia, but this ticket does not have a numeric token id to check on-chain.",
        };
      }

      const [
        ownerResult,
        eventResult,
        stateResult,
        transferCountResult,
        proofResult,
      ] = await Promise.all([
        this.ethCall(rpcUrl, contractAddress, this.uint256Call("6352211e", tokenId)),
        this.ethCall(rpcUrl, contractAddress, this.uint256Call("998f6ac0", tokenId)),
        this.ethCall(rpcUrl, contractAddress, this.uint256Call("017a9105", tokenId)),
        this.ethCall(rpcUrl, contractAddress, this.uint256Call("ed810d30", tokenId)),
        this.ethCall(rpcUrl, contractAddress, this.uint256Call("9ddaf5aa", tokenId)),
      ]);

      const onChainOwnerAddress = this.decodeAddress(ownerResult);
      const onChainEventId = this.decodeUint(eventResult);
      const expectedChainEventId = this.chainEventId(input.eventId).toString();
      const proofWords = this.decodeWords(proofResult, 4);
      const expectedProof = this.expectedProofHashes(input);
      const expectedOwnerAddress = this.normalizeAddress(
        input.ownerWalletAddress,
      );

      const walletMatches =
        expectedOwnerAddress && onChainOwnerAddress
          ? expectedOwnerAddress.toLowerCase() ===
            onChainOwnerAddress.toLowerCase()
          : null;
      const eventMatches = onChainEventId === expectedChainEventId;
      const stateValue = this.decodeUint(stateResult);
      const proof = {
        ticketIdHashMatches: proofWords[0]
          ? proofWords[0].toLowerCase() === expectedProof.ticketIdHash
          : null,
        ticketTypeHashMatches: proofWords[1]
          ? proofWords[1].toLowerCase() === expectedProof.ticketTypeHash
          : null,
        policyHashMatches: proofWords[2]
          ? proofWords[2].toLowerCase() === expectedProof.policyHash
          : null,
        metadataHashMatches: proofWords[3]
          ? proofWords[3].toLowerCase() === expectedProof.metadataHash
          : null,
        state: stateValue === null ? null : this.ticketStateLabel(Number(stateValue)),
        transferCount: this.decodeUint(transferCountResult),
      };
      const transaction = await this.bestTransactionProof(
        rpcUrl,
        contractAddress,
        tokenId,
        latestOwnership?.transactionHash ?? null,
        proof.transferCount,
      );
      const proofMatches = [
        proof.ticketIdHashMatches,
        proof.ticketTypeHashMatches,
        proof.policyHashMatches,
        proof.metadataHashMatches,
      ].every((value) => value === true);
      const transactionMatches =
        transaction !== null &&
        (transaction.status === "success" || transaction.status === "pending");
      const linked =
        walletMatches === true &&
        eventMatches &&
        proofMatches &&
        transactionMatches;

      return {
        ...base,
        status: linked ? "linked" : "mismatch",
        wallet: {
          expectedOwnerAddress,
          onChainOwnerAddress,
          matches: walletMatches,
        },
        event: {
          expectedChainEventId,
          onChainEventId,
          matches: eventMatches,
        },
        proof,
        transaction,
        message: linked
          ? "Sepolia owner, event, ticket proof, wallet, and transaction metadata match this FanPass ticket."
          : transaction === null
            ? "FanPass API did not find a Sepolia transaction hash for this ticket, and the chain token currently referenced by the ticket record did not fully match."
            : "FanPass API queried Sepolia, but one or more ticket, wallet, event, proof, or transaction checks did not match.",
      };
    } catch (error) {
      if (
        error instanceof Error &&
        /revert|nonexistent|not found|invalid token/i.test(error.message)
      ) {
        return {
          ...base,
          status: "no_chain_record",
          message:
            "FanPass API queried Sepolia, but the configured contract has no token record for this ticket.",
        };
      }
      return {
        ...base,
        status: "rpc_unavailable",
        message:
          "FanPass API could not complete the Sepolia RPC check for this ticket.",
      };
    }
  }

  private chainProofBase(
    input: TicketChainLookupInput,
    tokenId: string | null,
    chainId: string | null,
    contractAddress: string | null,
    contractExplorerUrl: string | null,
    checkedAt: string,
  ): TicketChainProofResponse {
    return {
      status: "no_chain_record",
      chainId,
      contractAddress,
      contractExplorerUrl,
      ticket: {
        id: input.id,
        safeTicketRef: this.safeTicketRef(input.id),
        tokenId,
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
      },
      wallet: {
        expectedOwnerAddress: this.normalizeAddress(input.ownerWalletAddress),
        onChainOwnerAddress: null,
        matches: null,
      },
      event: {
        expectedChainEventId: this.chainEventId(input.eventId).toString(),
        onChainEventId: null,
        matches: null,
      },
      proof: {
        ticketIdHashMatches: null,
        ticketTypeHashMatches: null,
        policyHashMatches: null,
        metadataHashMatches: null,
        state: null,
        transferCount: null,
      },
      transaction: null,
      checkedAt,
      message: "No Sepolia record has been resolved for this ticket yet.",
    };
  }

  private async transactionProof(
    rpcUrl: string,
    transactionHash: string | null,
  ): Promise<TicketChainProofResponse["transaction"]> {
    if (!transactionHash || !/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
      return null;
    }
    const receipt = await this.rpcCall<{
      status?: string;
      blockNumber?: string;
    } | null>(rpcUrl, "eth_getTransactionReceipt", [transactionHash]);
    if (!receipt) {
      return {
        hash: transactionHash,
        status: "pending",
        blockNumber: null,
        blockTimestamp: null,
        explorerUrl: `https://sepolia.etherscan.io/tx/${transactionHash}`,
      };
    }
    const blockNumber =
      typeof receipt.blockNumber === "string"
        ? Number.parseInt(receipt.blockNumber, 16)
        : null;
    const block = receipt.blockNumber
      ? await this.rpcCall<{ timestamp?: string } | null>(
          rpcUrl,
          "eth_getBlockByNumber",
          [receipt.blockNumber, false],
        )
      : null;
    const blockTimestamp =
      typeof block?.timestamp === "string"
        ? new Date(Number.parseInt(block.timestamp, 16) * 1000).toISOString()
        : null;
    return {
      hash: transactionHash,
      status: receipt.status === "0x1" ? "success" : "failed",
      blockNumber,
      blockTimestamp,
      explorerUrl: `https://sepolia.etherscan.io/tx/${transactionHash}`,
    };
  }

  private async bestTransactionProof(
    rpcUrl: string,
    contractAddress: string,
    tokenId: string,
    auditTransactionHash: string | null,
    transferCount: string | null,
  ) {
    const auditTransaction = await this.transactionProof(
      rpcUrl,
      auditTransactionHash,
    );
    if (auditTransaction?.status === "success") {
      return auditTransaction;
    }

    try {
      const transferHash = await this.latestTokenTransferHash(
        rpcUrl,
        contractAddress,
        tokenId,
        transferCount,
      );
      const transferTransaction = await this.transactionProof(rpcUrl, transferHash);
      if (transferTransaction?.status === "success") {
        return transferTransaction;
      }
      return transferTransaction ?? auditTransaction;
    } catch {
      return auditTransaction;
    }
  }

  private async latestTokenTransferHash(
    rpcUrl: string,
    contractAddress: string,
    tokenId: string,
    transferCount: string | null,
  ) {
    const logs = await this.rpcCall<
      Array<{
        transactionHash?: string;
        blockNumber?: string;
        logIndex?: string;
        topics?: string[];
      }>
    >(rpcUrl, "eth_getLogs", [
      {
        address: contractAddress,
        fromBlock: "0x0",
        toBlock: "latest",
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          null,
          null,
          this.uint256Topic(tokenId),
        ],
      },
    ]);
    const matchingLogs = logs
      .filter((log) => /^0x[a-fA-F0-9]{64}$/.test(log.transactionHash ?? ""));
    const candidates =
      transferCount === "0"
        ? matchingLogs.filter((log) => this.isMintTransferLog(log))
        : matchingLogs;
    const latest = candidates
      .sort((left, right) => {
        const leftBlock = this.hexQuantity(left.blockNumber);
        const rightBlock = this.hexQuantity(right.blockNumber);
        if (leftBlock !== rightBlock) {
          return rightBlock - leftBlock;
        }
        return this.hexQuantity(right.logIndex) - this.hexQuantity(left.logIndex);
      })[0];
    return latest?.transactionHash ?? null;
  }

  private async ethCall(rpcUrl: string, to: string, data: string) {
    return this.rpcCall<string>(rpcUrl, "eth_call", [{ to, data }, "latest"]);
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

  private uint256Call(selector: string, value: string) {
    const numeric = BigInt(value);
    return `0x${selector}${numeric.toString(16).padStart(64, "0")}`;
  }

  private uint256Topic(value: string) {
    const numeric = BigInt(value);
    return `0x${numeric.toString(16).padStart(64, "0")}`;
  }

  private isMintTransferLog(log: { topics?: string[] }) {
    return (
      Array.isArray(log.topics) &&
      log.topics[1]?.toLowerCase() ===
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
  }

  private hexQuantity(value: string | undefined) {
    if (!value || !/^0x[a-fA-F0-9]+$/.test(value)) {
      return 0;
    }
    return Number.parseInt(value, 16);
  }

  private decodeAddress(value: string) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
      return null;
    }
    return `0x${value.slice(-40)}`;
  }

  private decodeUint(value: string) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
      return null;
    }
    return BigInt(value).toString();
  }

  private decodeWords(value: string, count: number) {
    if (!/^0x[a-fA-F0-9]+$/.test(value)) {
      return [];
    }
    const body = value.slice(2);
    return Array.from({ length: count }, (_, index) => {
      const word = body.slice(index * 64, index * 64 + 64);
      return word.length === 64 ? `0x${word}` : null;
    });
  }

  private expectedProofHashes(input: TicketChainLookupInput) {
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
    return {
      ticketIdHash: this.bytes32Hash(`ticket:${input.id}`).toLowerCase(),
      ticketTypeHash: this.bytes32Hash(
        `ticket-type:${input.ticketTypeId}`,
      ).toLowerCase(),
      policyHash: policyHash.toLowerCase(),
      metadataHash: this.bytes32Hash(
        `metadata:${input.metadataUri ?? input.id}`,
      ).toLowerCase(),
    };
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

  private tokenIdFromOwnershipRef(value: string | null) {
    const tokenId = value?.split(":").at(-1);
    return tokenId && /^\d+$/.test(tokenId) ? tokenId : null;
  }

  private contractFromOwnershipRef(value: string | null) {
    const contract = value?.split(":")[0];
    return this.normalizeAddress(contract);
  }

  private configAddress(key: string) {
    return this.normalizeAddress(this.configValue(key));
  }

  private firstConfigValue(keys: string[]) {
    for (const key of keys) {
      const value = this.configValue(key);
      if (value) {
        return value;
      }
    }
    return null;
  }

  private configValue(key: string) {
    return this.config?.get<string>(key)?.trim() || process.env[key] || null;
  }

  private normalizeAddress(value: string | null | undefined) {
    const trimmed = value?.trim();
    if (!trimmed || !/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  private ticketStateLabel(value: number) {
    switch (value) {
      case 0:
        return "Minted";
      case 1:
        return "Redeemed";
      case 2:
        return "Cancelled";
      case 3:
        return "Refunded";
      default:
        return null;
    }
  }

  private auditTimestamp(
    logs: Array<{ action: string; createdAt: string; metadata?: unknown }>,
    action: string,
  ) {
    return logs.find((log) => log.action === action)?.createdAt;
  }

  private latestOwnershipProof(
    logs: Array<{ action: string; createdAt: string; metadata?: unknown }>,
  ) {
    for (const log of logs) {
      const metadata = this.recordMetadata(log.metadata);
      const adapter = this.optionalMetadataString(metadata, "ownershipAdapter");
      const ownershipRef = this.optionalMetadataString(metadata, "ownershipRef");
      const transactionHash = this.optionalMetadataString(
        metadata,
        "transactionHash",
      );
      if (!adapter && !ownershipRef && !transactionHash) {
        continue;
      }
      return {
        adapter: adapter ?? "unknown",
        createdAt: log.createdAt,
        ownershipRef,
        transactionHash,
        proofReference:
          transactionHash !== null
            ? `tx ${this.shortHex(transactionHash)}`
            : ownershipRef !== null
              ? `proof ${this.shortOwnershipRef(ownershipRef)}`
              : "proof pending",
        externalUrl:
          this.isSepoliaOwnershipAdapter(adapter) && transactionHash !== null
            ? `https://sepolia.etherscan.io/tx/${transactionHash}`
            : undefined,
      };
    }
    return null;
  }

  private isSepoliaOwnershipAdapter(adapter: string | null | undefined) {
    return adapter === "testnet" || adapter === "privy";
  }

  private recordMetadata(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private optionalMetadataString(
    metadata: Record<string, unknown>,
    key: string,
  ) {
    const value = metadata[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private shortHex(value: string) {
    return /^0x[a-fA-F0-9]{8,}$/.test(value)
      ? `${value.slice(0, 8)}...${value.slice(-6)}`
      : this.safeTicketRef(value);
  }

  private shortOwnershipRef(value: string) {
    return value
      .split(":")
      .map((part) => (part.startsWith("0x") ? this.shortHex(part) : part))
      .join(":");
  }

  private lifecycleDescription(
    status: TicketRecord["status"],
    transferCount: number,
  ) {
    if (status === "LISTED_FOR_RESALE") {
      return "Entry is paused while the resale listing is open.";
    }
    if (status === "REDEEMED") {
      return "Ticket has been redeemed; entry code generation is closed.";
    }
    if (status === "CANCELLED" || status === "REFUNDED") {
      return "Ticket is no longer eligible for entry.";
    }
    if (transferCount > 0) {
      return `Ownership has changed ${transferCount} time${transferCount === 1 ? "" : "s"} under organizer rules.`;
    }
    return "No public transfer details are exposed in the web fallback preview.";
  }

  private entryState(status: TicketRecord["status"]) {
    return status === "ACTIVE" || status === "TRANSFERRED"
      ? "Ready"
      : "Paused";
  }

  private safeStatus(status: TicketRecord["status"]) {
    return status
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private safeTicketRef(id: string) {
    const compact = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `FP-${compact.slice(-6).padStart(6, "0")}`;
  }

  private async issuePrismaTicket(
    prisma: PrismaService,
    input: IssueTicketInput,
    session?: FanPassSession,
  ) {
    const event = await prisma.event.findUniqueOrThrow({
      where: { id: input.eventId },
      include: {
        organizer: true,
      },
    });
    this.assertPrismaEventAccess(event, session);
    const ticketType = await prisma.ticketType.findUniqueOrThrow({
      where: { id: input.ticketTypeId },
    });
    if (ticketType.eventId !== input.eventId) {
      throw new BadRequestException("Ticket type does not belong to event");
    }
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: input.ownerId },
    });
    const ticketId = `tkt_${randomUUID()}`;
    const tokenIdHint = String((await prisma.ticket.count()) + 1);
    const ownershipInput = {
      localTicketId: ticketId,
      tokenIdHint,
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ownerId: input.ownerId,
      ownerWalletAddress: owner.walletAddress,
      transferable: ticketType.transferable,
      resaleCap: ticketType.resaleCap,
      maxTransferCount: ticketType.maxTransferCount,
      metadataUri: null,
    };

    if (this.ticketOwnership.usesOutboxProofSync()) {
      const ticket = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const ownership = await this.ticketOwnership.issueTicket(
            ownershipInput,
            { writer: tx },
          );
          const issued = await tx.ticket.create({
            data: {
              id: ticketId,
              tokenId: ownership.tokenId,
              eventId: input.eventId,
              ticketTypeId: input.ticketTypeId,
              ownerId: input.ownerId,
              seatHash: input.seatHash ?? null,
              status: "ACTIVE",
              transferCount: 0,
              metadataUri: null,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: input.ownerId,
              action: "TICKET_ISSUED",
              entityType: "ticket",
              entityId: issued.id,
              metadataJson: {
                eventId: input.eventId,
                ticketTypeId: input.ticketTypeId,
                ownershipAdapter: ownership.adapter,
                ownershipRef: ownership.ownershipRef,
                transactionHash: ownership.transactionHash,
              },
            },
          });
          return issued;
        },
      );

      return this.mapPrismaTicket(ticket);
    }

    const ownership = await this.ticketOwnership.issueTicket({
      ...ownershipInput,
    });

    const ticket = await prisma.ticket.create({
      data: {
        id: ticketId,
        tokenId: ownership.tokenId,
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
        ownerId: input.ownerId,
        seatHash: input.seatHash ?? null,
        status: "ACTIVE",
        transferCount: 0,
        metadataUri: null,
      },
    });

    await this.audit.record(
      input.ownerId,
      "TICKET_ISSUED",
      "ticket",
      ticket.id,
      {
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
        ownershipAdapter: ownership.adapter,
        ownershipRef: ownership.ownershipRef,
        transactionHash: ownership.transactionHash,
      },
    );

    return this.mapPrismaTicket(ticket);
  }

  private mapPrismaTicket(ticket: {
    id: string;
    tokenId: string | null;
    eventId: string;
    ticketTypeId: string;
    ownerId: string;
    seatHash: string | null;
    status: TicketRecord["status"];
    transferCount: number;
    metadataUri: string | null;
  }): TicketRecord {
    return {
      id: ticket.id,
      tokenId: ticket.tokenId,
      eventId: ticket.eventId,
      ticketTypeId: ticket.ticketTypeId,
      ownerId: ticket.ownerId,
      seatHash: ticket.seatHash,
      status: ticket.status,
      transferCount: ticket.transferCount,
      metadataUri: ticket.metadataUri,
    };
  }

  private mapExpandedPrismaTicket(ticket: {
    id: string;
    tokenId: string | null;
    eventId: string;
    ticketTypeId: string;
    ownerId: string;
    seatHash: string | null;
    status: TicketRecord["status"];
    transferCount: number;
    metadataUri: string | null;
    event: unknown;
    ticketType: unknown;
  }) {
    return {
      ...this.mapPrismaTicket(ticket),
      event: ticket.event,
      ticketType: ticket.ticketType,
    };
  }

  private prismaClient() {
    return process.env.FANPASS_DATA_SOURCE === "prisma"
      ? this.prisma
      : undefined;
  }

  private prismaTicketEventScope(session: FanPassSession | undefined) {
    if (!session || session.role === "ADMIN") {
      return {};
    }
    if (session.role !== "ORGANIZER") {
      return {};
    }
    return {
      event: {
        organizer: {
          userId: session.userId,
        },
      },
    };
  }

  private assertPrismaExpandedTicketAccess(
    ticket: { event: unknown },
    session: FanPassSession | undefined,
  ) {
    const event = ticket.event as { organizer?: { userId?: string } };
    this.assertPrismaEventAccess(event, session);
  }

  private assertPrismaProofAccess(
    ticket: {
      ownerId: string;
      event: { organizer?: { userId?: string } };
    },
    session: FanPassSession | undefined,
  ) {
    if (!session || session.role === "ADMIN") {
      return;
    }
    if (session.role === "FAN" && ticket.ownerId === session.userId) {
      return;
    }
    if (
      session.role === "ORGANIZER" &&
      ticket.event.organizer?.userId === session.userId
    ) {
      return;
    }
    throw new ForbiddenException("Ticket proof history is not accessible");
  }

  private assertPrismaEventAccess(
    event: { organizer?: { userId?: string } },
    session: FanPassSession | undefined,
  ) {
    if (!session || session.role === "ADMIN") {
      return;
    }
    if (
      session.role === "ORGANIZER" &&
      event.organizer?.userId === session.userId
    ) {
      return;
    }
    if (session.role === "ORGANIZER") {
      throw new ForbiddenException("Organizer is not assigned to this event");
    }
  }

  private memoryCanAccessEvent(
    eventId: string,
    session: FanPassSession | undefined,
  ) {
    if (!session || session.role === "ADMIN") {
      return true;
    }
    if (session.role !== "ORGANIZER") {
      return true;
    }
    const organizer = this.store.organizers.find(
      (candidate) => candidate.userId === session.userId,
    );
    return this.store.events.some(
      (event) => event.id === eventId && event.organizerId === organizer?.id,
    );
  }

  private assertMemoryEventAccess(
    eventId: string,
    session: FanPassSession | undefined,
  ) {
    if (!this.memoryCanAccessEvent(eventId, session)) {
      throw new ForbiddenException("Organizer is not assigned to this event");
    }
  }

  private assertMemoryProofAccess(
    ticket: TicketRecord,
    session: FanPassSession | undefined,
  ) {
    if (!session || session.role === "ADMIN") {
      return;
    }
    if (session.role === "FAN" && ticket.ownerId === session.userId) {
      return;
    }
    if (session.role === "ORGANIZER") {
      this.assertMemoryEventAccess(ticket.eventId, session);
      return;
    }
    throw new ForbiddenException("Ticket proof history is not accessible");
  }
}
