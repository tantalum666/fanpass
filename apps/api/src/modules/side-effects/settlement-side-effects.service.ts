import { Injectable, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  OwnershipReceipt,
  OwnershipService,
  TransferOwnershipInput,
} from "../ownership/ownership.service";
import { SideEffectOutboxService } from "./side-effect-outbox.service";

interface OwnershipTransferJobInput extends TransferOwnershipInput {
  buyOrderId: string;
  sellOrderId: string;
}

interface PaymentCaptureJobInput {
  paymentId: string;
  buyOrderId: string;
  tradeId: string;
}

interface PrimaryPaymentCaptureJobInput {
  paymentId: string;
  buyOrderId: string;
  ticketId: string;
}

interface PaymentCompensationJobInput {
  paymentId: string;
  buyOrderId: string;
  captureStatus: string;
  reason: string;
}

@Injectable()
export class SettlementSideEffectsService {
  constructor(
    private readonly ownership: OwnershipService,
    @Optional() private readonly outbox?: SideEffectOutboxService,
  ) {}

  transferOwnership(input: TransferOwnershipInput) {
    return this.ownership.transferTicket(input);
  }

  async enqueueOwnershipTransfer(
    prisma: Prisma.TransactionClient,
    input: OwnershipTransferJobInput,
  ) {
    const idempotencyKey = this.ownershipTransferSideEffectKey(
      input.buyOrderId,
      input.sellOrderId,
    );
    await this.outbox?.enqueue(prisma, {
      type: "OWNERSHIP_TRANSFER",
      idempotencyKey,
      aggregateType: "trade",
      aggregateId: `${input.buyOrderId}:${input.sellOrderId}`,
      payload: {
        ticketId: input.ticketId,
        tokenId: input.tokenId,
        fromOwnerId: input.fromOwnerId,
        fromWalletAddress: input.fromWalletAddress,
        toOwnerId: input.toOwnerId,
        toWalletAddress: input.toWalletAddress,
        buyOrderId: input.buyOrderId,
        sellOrderId: input.sellOrderId,
      },
    });
    return idempotencyKey;
  }

  async markOwnershipTransferCompleted(
    idempotencyKey: string,
    ticketId: string,
    receipt: OwnershipReceipt,
  ) {
    await this.outbox?.markCompleted(idempotencyKey, {
      ticketId,
      tokenId: receipt.tokenId,
      ownershipAdapter: receipt.adapter,
      ownershipRef: receipt.ownershipRef,
      transactionHash: receipt.transactionHash,
    });
  }

  async markOwnershipTransferFailed(idempotencyKey: string, error: unknown) {
    await this.outbox?.markFailed(idempotencyKey, error);
  }

  async enqueuePaymentCaptureForTrade(
    prisma: Prisma.TransactionClient,
    input: PaymentCaptureJobInput,
  ) {
    await this.outbox?.enqueue(prisma, {
      type: "PAYMENT_CAPTURE",
      idempotencyKey: this.paymentCaptureSideEffectKey(
        input.paymentId,
        input.tradeId,
      ),
      aggregateType: "payment",
      aggregateId: input.paymentId,
      payload: {
        paymentId: input.paymentId,
        orderId: input.buyOrderId,
        tradeId: input.tradeId,
      },
    });
  }

  async enqueuePaymentCaptureForPrimaryTicket(
    prisma: Prisma.TransactionClient,
    input: PrimaryPaymentCaptureJobInput,
  ) {
    await this.outbox?.enqueue(prisma, {
      type: "PAYMENT_CAPTURE",
      idempotencyKey: this.paymentCaptureSideEffectKey(
        input.paymentId,
        `primary:${input.ticketId}`,
      ),
      aggregateType: "payment",
      aggregateId: input.paymentId,
      payload: {
        paymentId: input.paymentId,
        orderId: input.buyOrderId,
        ticketId: input.ticketId,
        tradeId: null,
      },
    });
  }

  async enqueuePaymentCompensation(
    prisma: Prisma.TransactionClient,
    input: PaymentCompensationJobInput,
  ) {
    const refundRequired = input.captureStatus === "CAPTURED";
    await this.outbox?.enqueue(prisma, {
      type: refundRequired ? "PAYMENT_REFUND" : "PAYMENT_CANCEL_AUTHORIZATION",
      idempotencyKey: refundRequired
        ? this.paymentRefundSideEffectKey(input.paymentId, input.reason)
        : this.paymentCancelSideEffectKey(input.paymentId, input.reason),
      aggregateType: "payment",
      aggregateId: input.paymentId,
      payload: {
        paymentId: input.paymentId,
        orderId: input.buyOrderId,
        reason: input.reason,
      },
    });
  }

  private ownershipTransferSideEffectKey(
    buyOrderId: string,
    sellOrderId: string,
  ) {
    return `ownership-transfer:${buyOrderId}:${sellOrderId}`;
  }

  private paymentCaptureSideEffectKey(paymentId: string, tradeId: string) {
    return `payment-capture:${paymentId}:${tradeId}`;
  }

  private paymentCancelSideEffectKey(paymentId: string, reason: string) {
    return `payment-cancel:${paymentId}:${reason}`;
  }

  private paymentRefundSideEffectKey(paymentId: string, reason: string) {
    return `payment-refund:${paymentId}:${reason}`;
  }
}
