import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import {
  IssueOwnershipInput,
  OwnershipReceipt,
  OwnershipService,
  RedeemOwnershipInput,
} from "../ownership/ownership.service";
import { SideEffectOutboxService } from "./side-effect-outbox.service";

type PrismaWriter = Prisma.TransactionClient | PrismaService;

interface OwnershipSideEffectOptions {
  writer?: PrismaWriter;
}

@Injectable()
export class TicketOwnershipSideEffectsService {
  constructor(
    private readonly ownership: OwnershipService,
    @Optional() private readonly outbox?: SideEffectOutboxService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  issueTicket(
    input: IssueOwnershipInput,
    options: OwnershipSideEffectOptions = {},
  ) {
    if (this.usesOutboxProofSync()) {
      return this.enqueueIssueTicket(input, options.writer);
    }
    return this.ownership.issueTicket(input);
  }

  redeemTicket(
    input: RedeemOwnershipInput,
    options: OwnershipSideEffectOptions = {},
  ) {
    if (this.usesOutboxProofSync()) {
      return this.enqueueRedeemTicket(input, options.writer);
    }
    return this.ownership.redeemTicket(input);
  }

  usesOutboxProofSync() {
    const enabled =
      this.config?.get<string>("FANPASS_CHAIN_PROOF_SYNC_OUTBOX") ??
      process.env.FANPASS_CHAIN_PROOF_SYNC_OUTBOX;
    return enabled === "true" && Boolean(this.outbox);
  }

  private async enqueueIssueTicket(
    input: IssueOwnershipInput,
    writer?: PrismaWriter,
  ): Promise<OwnershipReceipt> {
    const payload: Prisma.InputJsonValue = {
      localTicketId: input.localTicketId,
      tokenIdHint: input.tokenIdHint,
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ownerId: input.ownerId,
      ownerWalletAddress: input.ownerWalletAddress,
      transferable: input.transferable,
      resaleCap: input.resaleCap,
      maxTransferCount: input.maxTransferCount,
      metadataUri: input.metadataUri,
    };
    await this.enqueue(
      {
        type: "OWNERSHIP_ISSUE",
        idempotencyKey: this.issueSideEffectKey(input.localTicketId),
        aggregateType: "ticket",
        aggregateId: input.localTicketId,
        payload,
      },
      writer,
    );
    return this.pendingReceipt(
      input.tokenIdHint,
      `pending:ownership-issue:${input.localTicketId}`,
    );
  }

  private async enqueueRedeemTicket(
    input: RedeemOwnershipInput,
    writer?: PrismaWriter,
  ): Promise<OwnershipReceipt> {
    const payload: Prisma.InputJsonValue = {
      ticketId: input.ticketId,
      tokenId: input.tokenId,
    };
    await this.enqueue(
      {
        type: "OWNERSHIP_REDEEM",
        idempotencyKey: this.redeemSideEffectKey(input.ticketId, input.tokenId),
        aggregateType: "ticket",
        aggregateId: input.ticketId,
        payload,
      },
      writer,
    );
    return this.pendingReceipt(
      input.tokenId ?? "pending",
      `pending:ownership-redeem:${input.ticketId}`,
    );
  }

  private async enqueue(
    input: Parameters<SideEffectOutboxService["enqueue"]>[1],
    writer?: PrismaWriter,
  ) {
    if (!this.outbox) {
      return null;
    }
    if (writer) {
      return this.outbox.enqueue(writer, input);
    }
    return this.outbox.enqueueStandalone(input);
  }

  private pendingReceipt(
    tokenId: string,
    ownershipRef: string,
  ): OwnershipReceipt {
    return {
      adapter: this.ownership.adapterName(),
      status: "PENDING",
      tokenId,
      ownershipRef,
      transactionHash: null,
    };
  }

  private issueSideEffectKey(localTicketId: string) {
    return `ownership-issue:${localTicketId}`;
  }

  private redeemSideEffectKey(ticketId: string, tokenId: string | null) {
    return `ownership-redeem:${ticketId}:${tokenId ?? "missing-token"}`;
  }
}
