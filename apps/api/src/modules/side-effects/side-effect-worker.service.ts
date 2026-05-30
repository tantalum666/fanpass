import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, SideEffectOutbox } from "@prisma/client";
import {
  OwnershipReceipt,
  OwnershipService,
  TransferOwnershipInput,
} from "../ownership/ownership.service";
import { OrderbookService } from "../orders/orderbook.service";
import { PaymentsService } from "../payments/payments.service";
import { SideEffectOutboxService } from "./side-effect-outbox.service";

interface WorkerResult {
  recovered: number;
  processed: number;
  completed: number;
  retried: number;
  dead: number;
}

@Injectable()
export class SideEffectWorkerService {
  constructor(
    private readonly outbox: SideEffectOutboxService,
    private readonly ownership: OwnershipService,
    private readonly payments: PaymentsService,
    private readonly orderbook: OrderbookService,
  ) {}

  async workOnce(limit = 10): Promise<WorkerResult> {
    const recovered = await this.outbox.recoverStaleProcessingJobs();
    const jobs = await this.outbox.pending(limit);
    const result: WorkerResult = {
      recovered: recovered.count,
      processed: 0,
      completed: 0,
      retried: 0,
      dead: 0,
    };

    for (const job of jobs) {
      const claimed = await this.outbox.claim(job);
      if (!claimed) {
        continue;
      }
      result.processed += 1;
      try {
        const payload = await this.dispatch(claimed);
        await this.outbox.completeJob(claimed.id, payload);
        result.completed += 1;
      } catch (error) {
        const updated = await this.outbox.retryOrDeadJob(
          claimed.id,
          error,
          claimed.attempts,
        );
        if (updated?.status === "DEAD") {
          result.dead += 1;
        } else {
          result.retried += 1;
        }
      }
    }

    return result;
  }

  private async dispatch(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    switch (job.type) {
      case "OWNERSHIP_TRANSFER":
        return this.transferOwnership(job);
      case "OWNERSHIP_SETTLEMENT_FINALIZE":
        return this.finalizeOwnershipSettlement(job);
      case "PAYMENT_INTENT_CREATE":
        return this.createPaymentIntent(job);
      case "PAYMENT_CAPTURE":
        return this.capturePayment(job);
      case "PAYMENT_CANCEL_AUTHORIZATION":
        return this.cancelPaymentAuthorization(job);
      case "PAYMENT_REFUND":
        return this.refundPayment(job);
      case "PAYMENT_RECONCILE":
        return this.reconcilePayment(job);
      case "ORDER_MATCH_AFTER_PAYMENT_AUTH":
        return this.matchOrderAfterPaymentAuthorization(job);
      default:
        throw new BadRequestException(`Unknown side-effect type ${job.type}`);
    }
  }

  private async transferOwnership(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readOwnershipSettlementPayload(job.payloadJson);
    const ownership = await this.ownership.transferTicket(payload.transfer);
    const result = {
      ...payload.transfer,
      ownershipAdapter: ownership.adapter,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
      status: ownership.status,
    };
    if (payload.buyOrderId && payload.sellOrderId) {
      await this.outbox.enqueueStandalone({
        type: "OWNERSHIP_SETTLEMENT_FINALIZE",
        idempotencyKey: this.ownershipSettlementFinalizeKey(
          payload.buyOrderId,
          payload.sellOrderId,
        ),
        aggregateType: "trade",
        aggregateId: `${payload.buyOrderId}:${payload.sellOrderId}`,
        payload: {
          ...payload.transfer,
          buyOrderId: payload.buyOrderId,
          sellOrderId: payload.sellOrderId,
          ownershipAdapter: ownership.adapter,
          ownershipStatus: ownership.status,
          ownershipRef: ownership.ownershipRef,
          transactionHash: ownership.transactionHash,
        },
      });
    }
    return result;
  }

  private async finalizeOwnershipSettlement(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readOwnershipFinalizePayload(job.payloadJson);
    const trade = await this.orderbook.finalizeOwnershipTransfer({
      buyOrderId: payload.buyOrderId,
      sellOrderId: payload.sellOrderId,
      ticketId: payload.transfer.ticketId,
      ownership: payload.ownership,
    });
    return {
      buyOrderId: payload.buyOrderId,
      sellOrderId: payload.sellOrderId,
      ticketId: payload.transfer.ticketId,
      tradeId: trade?.id ?? null,
      finalized: Boolean(trade),
    };
  }

  private async createPaymentIntent(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readRecordPayload(job.payloadJson);
    return this.payments.processCreateIntentJob(
      this.requiredString(payload.paymentId, "paymentId"),
    );
  }

  private async capturePayment(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readRecordPayload(job.payloadJson);
    return this.payments.processCaptureJob(
      this.requiredString(payload.paymentId, "paymentId"),
      this.optionalString(payload.tradeId),
      job.idempotencyKey,
    );
  }

  private async cancelPaymentAuthorization(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readRecordPayload(job.payloadJson);
    return this.payments.processCancelAuthorizationJob(
      this.requiredString(payload.paymentId, "paymentId"),
      this.optionalString(payload.reason),
      job.idempotencyKey,
    );
  }

  private async refundPayment(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readRecordPayload(job.payloadJson);
    return this.payments.processRefundJob(
      this.requiredString(payload.paymentId, "paymentId"),
      this.optionalString(payload.reason),
      job.idempotencyKey,
    );
  }

  private async reconcilePayment(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readRecordPayload(job.payloadJson);
    return this.payments.processReconcileJob(
      this.requiredString(payload.paymentId, "paymentId"),
    );
  }

  private async matchOrderAfterPaymentAuthorization(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readRecordPayload(job.payloadJson);
    const orderId = this.requiredString(payload.orderId, "orderId");
    const trade = await this.orderbook.tryMatch(orderId);
    return {
      orderId,
      paymentId: this.optionalString(payload.paymentId),
      tradeId: trade?.id ?? null,
      matched: Boolean(trade),
    };
  }

  private readOwnershipTransferPayload(
    payload: Prisma.JsonValue,
  ): TransferOwnershipInput {
    const record = this.readRecordPayload(payload);
    return {
      ticketId: this.requiredString(record.ticketId, "ticketId"),
      tokenId: this.optionalString(record.tokenId),
      fromOwnerId: this.requiredString(record.fromOwnerId, "fromOwnerId"),
      fromWalletAddress: this.optionalString(record.fromWalletAddress),
      toOwnerId: this.requiredString(record.toOwnerId, "toOwnerId"),
      toWalletAddress: this.optionalString(record.toWalletAddress),
    };
  }

  private readOwnershipSettlementPayload(payload: Prisma.JsonValue) {
    const record = this.readRecordPayload(payload);
    return {
      transfer: this.readOwnershipTransferPayload(payload),
      buyOrderId: this.optionalString(record.buyOrderId),
      sellOrderId: this.optionalString(record.sellOrderId),
    };
  }

  private readOwnershipFinalizePayload(payload: Prisma.JsonValue) {
    const record = this.readRecordPayload(payload);
    return {
      transfer: this.readOwnershipTransferPayload(payload),
      buyOrderId: this.requiredString(record.buyOrderId, "buyOrderId"),
      sellOrderId: this.requiredString(record.sellOrderId, "sellOrderId"),
      ownership: {
        adapter: this.ownershipAdapter(record.ownershipAdapter),
        status: this.ownershipStatus(record.ownershipStatus),
        tokenId: this.requiredString(record.tokenId, "tokenId"),
        ownershipRef: this.requiredString(record.ownershipRef, "ownershipRef"),
        transactionHash: this.optionalString(record.transactionHash),
      },
    };
  }

  private readRecordPayload(payload: Prisma.JsonValue) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Side-effect payload is invalid");
    }
    return payload as Record<string, unknown>;
  }

  private requiredString(value: unknown, key: string) {
    if (typeof value !== "string" || value.length === 0) {
      throw new BadRequestException(`${key} is required`);
    }
    return value;
  }

  private optionalString(value: unknown) {
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private ownershipAdapter(value: unknown): OwnershipReceipt["adapter"] {
    if (value === "mock" || value === "testnet") {
      return value;
    }
    throw new BadRequestException("ownershipAdapter is invalid");
  }

  private ownershipStatus(value: unknown): OwnershipReceipt["status"] {
    if (value === "CONFIRMED" || value === "PENDING") {
      return value;
    }
    throw new BadRequestException("ownershipStatus is invalid");
  }

  private ownershipSettlementFinalizeKey(
    buyOrderId: string,
    sellOrderId: string,
  ) {
    return `ownership-finalize:${buyOrderId}:${sellOrderId}`;
  }
}
