import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, SideEffectOutbox } from "@prisma/client";
import type { OwnershipContractRoute } from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import {
  requireVerifiedWalletBinding,
  WalletBindingNotVerifiedError,
} from "../../common/wallet-binding";
import {
  IssueOwnershipInput,
  OWNERSHIP_AMBIGUOUS_ERROR_MARKER,
  OwnershipOperationError,
  OwnershipReceipt,
  OwnershipService,
  RedeemOwnershipInput,
  TransferOwnershipInput,
} from "../ownership/ownership.service";
import { OrderbookService } from "../orders/orderbook.service";
import { PaymentsService } from "../payments/payments.service";
import {
  OWNERSHIP_SUBMISSION_STARTED_MARKER,
  OWNERSHIP_SUBMISSION_STARTED_PAYLOAD_KEY,
  SideEffectOutboxService,
} from "./side-effect-outbox.service";

interface WorkerResult {
  recovered: number;
  processed: number;
  completed: number;
  retried: number;
  dead: number;
}

class OwnershipReceiptPendingError extends Error {}
class OwnershipReceiptTerminalError extends Error {}

@Injectable()
export class SideEffectWorkerService {
  constructor(
    private readonly outbox: SideEffectOutboxService,
    private readonly ownership: OwnershipService,
    private readonly payments: PaymentsService,
    private readonly orderbook: OrderbookService,
    @Optional() private readonly prisma?: PrismaService,
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
        await this.outbox.assertClaimRevisionCurrent(claimed);
        const payload = await this.dispatch(claimed);
        const completed = await this.outbox.completeJob(claimed, payload);
        if (!completed) {
          continue;
        }
        result.completed += 1;
      } catch (error) {
        const terminal =
          error instanceof OwnershipReceiptTerminalError ||
          (error instanceof OwnershipOperationError && !error.retryable) ||
          error instanceof WalletBindingNotVerifiedError ||
          error instanceof UnauthorizedException;
        if (error instanceof OwnershipReceiptPendingError) {
          const updated =
            await this.outbox.reschedulePendingReceiptJob(claimed);
          if (!updated) {
            continue;
          }
          if (updated?.status === "DEAD") {
            result.dead += 1;
          } else {
            result.retried += 1;
          }
          continue;
        }
        const attempts = terminal ? 1 : claimed.attempts;
        const maxAttempts = terminal ? 1 : 5;
        if (
          attempts >= maxAttempts &&
          this.definitelyNotSubmitted(error) &&
          !this.hasPriorOwnershipSubmissionRisk(claimed)
        ) {
          try {
            await this.compensateDefinitelyNotSubmittedOwnershipFailure(
              claimed,
              error,
            );
          } catch (compensationError) {
            const compensationUpdate = await this.outbox.retryOrDeadJob(
              claimed,
              this.compensationRetryError(error, compensationError),
              claimed.attempts,
              5,
            );
            if (!compensationUpdate) {
              continue;
            }
            if (compensationUpdate?.status === "DEAD") {
              result.dead += 1;
            } else {
              result.retried += 1;
            }
            continue;
          }
        }
        const updated = await this.outbox.retryOrDeadJob(
          claimed,
          error,
          attempts,
          maxAttempts,
        );
        if (!updated) {
          continue;
        }
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
      case "OWNERSHIP_ISSUE":
        return this.issueOwnership(job);
      case "OWNERSHIP_ISSUE_RECEIPT_POLL":
        return this.pollIssueOwnershipReceipt(job);
      case "OWNERSHIP_TRANSFER":
        return this.transferOwnership(job);
      case "OWNERSHIP_RECEIPT_POLL":
        return this.pollOwnershipReceipt(job);
      case "OWNERSHIP_REDEEM":
        return this.redeemOwnership(job);
      case "OWNERSHIP_REDEEM_RECEIPT_POLL":
        return this.pollRedeemOwnershipReceipt(job);
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
    this.assertInitialOwnershipAdapterSnapshot(job.payloadJson);
    const payload = this.readOwnershipSettlementPayload(job.payloadJson);
    this.assertWriteContractRoute(payload.transfer);
    await this.verifyTransferWalletBindings(payload.transfer);
    const input = {
      ...payload.transfer,
      idempotencyKey: job.idempotencyKey,
    };
    const submissionHooks = this.ownershipSubmissionHooks(job);
    const ownership = submissionHooks
      ? await this.ownership.transferTicket(input, submissionHooks)
      : await this.ownership.transferTicket(input);
    const result = {
      ...payload.transfer,
      ownershipAdapter: ownership.adapter,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
      status: ownership.status,
      contractRoute: ownership.contractRoute,
    };
    if (payload.buyOrderId && payload.sellOrderId) {
      const settlement = {
        transfer: payload.transfer,
        buyOrderId: payload.buyOrderId,
        sellOrderId: payload.sellOrderId,
      };
      if (ownership.status === "CONFIRMED") {
        await this.enqueueOwnershipFinalization(settlement, ownership);
      } else if (ownership.status === "PENDING") {
        await this.enqueueOwnershipReceiptPoll(settlement, ownership);
      } else {
        await this.orderbook.failOwnershipTransfer({
          buyOrderId: payload.buyOrderId,
          sellOrderId: payload.sellOrderId,
          ticketId: payload.transfer.ticketId,
          reason: "Ownership transaction reverted",
        });
      }
    }
    return result;
  }

  private async pollOwnershipReceipt(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readOwnershipFinalizePayload(job.payloadJson);
    if (!payload.ownership.transactionHash) {
      throw new BadRequestException(
        "transactionHash is required for ownership receipt polling",
      );
    }
    await this.outbox.assertClaimRevisionCurrent(job);
    const ownership = await this.ownership.resolveReceipt({
      adapter: payload.ownership.adapter,
      tokenId: payload.ownership.tokenId,
      ownershipRef: payload.ownership.ownershipRef,
      transactionHash: payload.ownership.transactionHash,
      contractRoute: payload.ownership.contractRoute,
      operation: {
        type: "TRANSFER",
        fromWalletAddress: payload.transfer.fromWalletAddress,
        toWalletAddress: payload.transfer.toWalletAddress,
      },
    });
    const settlement = {
      transfer: payload.transfer,
      buyOrderId: payload.buyOrderId,
      sellOrderId: payload.sellOrderId,
    };
    if (ownership.status === "CONFIRMED") {
      await this.enqueueOwnershipFinalization(settlement, ownership);
    } else if (ownership.status === "FAILED") {
      await this.orderbook.failOwnershipTransfer({
        buyOrderId: payload.buyOrderId,
        sellOrderId: payload.sellOrderId,
        ticketId: payload.transfer.ticketId,
        reason: "Ownership transaction reverted",
      });
    } else {
      throw new OwnershipReceiptPendingError(
        "Ownership transaction receipt is still pending",
      );
    }
    return {
      ...payload.transfer,
      buyOrderId: payload.buyOrderId,
      sellOrderId: payload.sellOrderId,
      ownershipAdapter: ownership.adapter,
      ownershipStatus: ownership.status,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
      contractRoute: ownership.contractRoute,
    };
  }

  private async issueOwnership(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    this.assertInitialOwnershipAdapterSnapshot(job.payloadJson);
    const payload = this.readOwnershipIssuePayload(job.payloadJson);
    this.assertWriteContractRoute(payload);
    await this.verifyIssueWalletBinding(payload);
    const input = {
      ...payload,
      idempotencyKey: job.idempotencyKey,
    };
    const submissionHooks = this.ownershipSubmissionHooks(job);
    const ownership = submissionHooks
      ? await this.ownership.issueTicket(input, submissionHooks)
      : await this.ownership.issueTicket(input);
    if (ownership.status === "PENDING") {
      await this.enqueueIssueOwnershipReceiptPoll(payload, ownership);
    }
    await this.recordIssuedOwnership(payload, ownership);
    await this.settlePrimaryOwnershipOutcome(payload, ownership);
    return {
      ...payload,
      tokenId: ownership.tokenId,
      ownershipAdapter: ownership.adapter,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
      status: ownership.status,
      contractRoute: ownership.contractRoute,
    };
  }

  private async pollIssueOwnershipReceipt(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readOwnershipIssueReceiptPayload(job.payloadJson);
    await this.outbox.assertClaimRevisionCurrent(job);
    const ownership = await this.ownership.resolveReceipt({
      ...payload.ownership,
      operation: {
        type: "ISSUE",
        localTicketId: payload.issue.localTicketId,
      },
    });
    if (ownership.status === "PENDING") {
      throw new OwnershipReceiptPendingError(
        "Ownership issuance receipt is still pending",
      );
    }
    await this.recordIssuedOwnership(payload.issue, ownership);
    await this.settlePrimaryOwnershipOutcome(payload.issue, ownership);
    return {
      ...payload.issue,
      tokenId: ownership.tokenId,
      ownershipAdapter: ownership.adapter,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
      status: ownership.status,
      contractRoute: ownership.contractRoute,
    };
  }

  private async recordIssuedOwnership(
    payload: IssueOwnershipInput,
    ownership: OwnershipReceipt,
  ) {
    if (!this.prisma) {
      return;
    }
    if (
      !this.sameOwnershipRoute(payload.contractRoute, ownership.contractRoute)
    ) {
      throw new ConflictException(
        "Ownership receipt route does not match the immutable ticket issuance route",
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const ownershipRouteUpdate = ownership.contractRoute
        ? {
            ownershipContractAddress: ownership.contractRoute.contractAddress,
            ownershipChainId: ownership.contractRoute.chainId,
            ownershipContractVersion: ownership.contractRoute.contractVersion,
          }
        : {};
      const ticketUpdate =
        ownership.status === "CONFIRMED"
          ? {
              status: "ACTIVE" as const,
              tokenId: ownership.tokenId,
              ...ownershipRouteUpdate,
            }
          : ownership.status === "FAILED"
            ? { status: "CANCELLED" as const, ...ownershipRouteUpdate }
            : { status: "CREATED" as const, ...ownershipRouteUpdate };
      const update = await tx.ticket.updateMany({
        where: {
          id: payload.localTicketId,
          status: "CREATED",
          ...(payload.contractRoute
            ? {
                ownershipContractAddress: payload.contractRoute.contractAddress,
                ownershipChainId: payload.contractRoute.chainId,
                ownershipContractVersion: payload.contractRoute.contractVersion,
              }
            : {}),
        },
        data: ticketUpdate,
      });
      if (update.count !== 1) {
        const existing = await tx.ticket.findUnique({
          where: { id: payload.localTicketId },
        });
        const expectedStatus =
          ownership.status === "CONFIRMED"
            ? "ACTIVE"
            : ownership.status === "FAILED"
              ? "CANCELLED"
              : "CREATED";
        if (
          !existing ||
          existing.status !== expectedStatus ||
          (ownership.status === "CONFIRMED" &&
            existing.tokenId !== ownership.tokenId) ||
          !this.sameOwnershipRoute(
            payload.contractRoute,
            existing.ownershipContractAddress &&
              existing.ownershipChainId &&
              existing.ownershipContractVersion === "fanpass-ticket-v1"
              ? {
                  contractAddress: existing.ownershipContractAddress,
                  chainId: existing.ownershipChainId,
                  contractVersion: "fanpass-ticket-v1",
                }
              : null,
          )
        ) {
          throw new ConflictException(
            "Ticket ownership route or issuance state changed during confirmation",
          );
        }
      }
      await tx.auditLog.create({
        data: {
          actorId: payload.ownerId,
          action: "TICKET_OWNERSHIP_SYNCED",
          entityType: "ticket",
          entityId: payload.localTicketId,
          metadataJson: {
            eventId: payload.eventId,
            ticketTypeId: payload.ticketTypeId,
            ownershipAdapter: ownership.adapter,
            ownershipStatus: ownership.status,
            ownershipRef: ownership.ownershipRef,
            transactionHash: ownership.transactionHash,
            contractRoute: ownership.contractRoute,
          },
        },
      });
    });
  }

  private async settlePrimaryOwnershipOutcome(
    payload: IssueOwnershipInput,
    ownership: OwnershipReceipt,
  ) {
    if (ownership.status === "CONFIRMED") {
      await this.orderbook.finalizePrimaryOwnershipIssue(payload.localTicketId);
      return;
    }
    if (ownership.status === "FAILED") {
      await this.orderbook.failPrimaryOwnershipIssue(
        payload.localTicketId,
        new Error("Ownership issuance transaction reverted"),
      );
    }
  }

  private async redeemOwnership(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    this.assertInitialOwnershipAdapterSnapshot(job.payloadJson);
    const payload = this.readOwnershipRedeemPayload(job.payloadJson);
    this.assertWriteContractRoute(payload);
    const input = {
      ...payload,
      idempotencyKey: job.idempotencyKey,
    };
    const submissionHooks = this.ownershipSubmissionHooks(job);
    const ownership = submissionHooks
      ? await this.ownership.redeemTicket(input, submissionHooks)
      : await this.ownership.redeemTicket(input);
    if (ownership.status === "PENDING") {
      await this.enqueueRedeemOwnershipReceiptPoll(payload, ownership);
    } else if (ownership.status === "FAILED") {
      throw new OwnershipReceiptTerminalError(
        "Ownership redemption transaction reverted and requires reconciliation",
      );
    }
    return {
      ...payload,
      tokenId: ownership.tokenId,
      ownershipAdapter: ownership.adapter,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
      status: ownership.status,
      contractRoute: ownership.contractRoute,
    };
  }

  private async pollRedeemOwnershipReceipt(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readOwnershipRedeemReceiptPayload(job.payloadJson);
    await this.outbox.assertClaimRevisionCurrent(job);
    const ownership = await this.ownership.resolveReceipt({
      ...payload.ownership,
      operation: { type: "REDEEM" },
    });
    if (ownership.status === "PENDING") {
      throw new OwnershipReceiptPendingError(
        "Ownership redemption receipt is still pending",
      );
    }
    if (ownership.status === "FAILED") {
      throw new OwnershipReceiptTerminalError(
        "Ownership redemption transaction reverted and requires reconciliation",
      );
    }
    return {
      ...payload.redeem,
      tokenId: ownership.tokenId,
      ownershipAdapter: ownership.adapter,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
      status: ownership.status,
      contractRoute: ownership.contractRoute,
    };
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
      this.providerSubmissionHooks(job),
    );
  }

  private async capturePayment(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readRecordPayload(job.payloadJson);
    return this.payments.processCaptureJob(
      this.requiredString(payload.paymentId, "paymentId"),
      this.optionalString(payload.tradeId),
      this.requiredString(payload.ticketId, "ticketId"),
      job.idempotencyKey,
      this.providerSubmissionHooks(job),
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
      this.providerSubmissionHooks(job),
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
      this.providerSubmissionHooks(job),
    );
  }

  private async reconcilePayment(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readRecordPayload(job.payloadJson);
    return this.payments.processReconcileJob(
      this.requiredString(payload.paymentId, "paymentId"),
      this.providerSubmissionHooks(job),
    );
  }

  private async matchOrderAfterPaymentAuthorization(
    job: SideEffectOutbox,
  ): Promise<Prisma.InputJsonValue> {
    const payload = this.readRecordPayload(job.payloadJson);
    const orderId = this.requiredString(payload.orderId, "orderId");
    const settlement =
      await this.orderbook.settleAfterPaymentAuthorization(orderId);
    return {
      orderId,
      paymentId: this.optionalString(payload.paymentId),
      ticketId: settlement?.ticketId ?? null,
      tradeId: settlement?.tradeId ?? null,
      fulfillmentType: settlement?.fulfillmentType ?? null,
      matched: settlement?.matched ?? false,
      issued: settlement?.issued ?? false,
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
      fromWalletBindingVersion: this.optionalInteger(
        record.fromWalletBindingVersion,
      ),
      fromWalletBindingFingerprint:
        this.optionalString(record.fromWalletBindingFingerprint) ?? undefined,
      toOwnerId: this.requiredString(record.toOwnerId, "toOwnerId"),
      toWalletAddress: this.optionalString(record.toWalletAddress),
      toWalletBindingVersion: this.optionalInteger(
        record.toWalletBindingVersion,
      ),
      toWalletBindingFingerprint:
        this.optionalString(record.toWalletBindingFingerprint) ?? undefined,
      contractRoute: this.readOwnershipContractRoute(record.contractRoute),
    };
  }

  private readOwnershipIssuePayload(
    payload: Prisma.JsonValue,
  ): IssueOwnershipInput {
    const record = this.readRecordPayload(payload);
    return {
      localTicketId: this.requiredString(record.localTicketId, "localTicketId"),
      tokenIdHint: this.requiredString(record.tokenIdHint, "tokenIdHint"),
      eventId: this.requiredString(record.eventId, "eventId"),
      ticketTypeId: this.requiredString(record.ticketTypeId, "ticketTypeId"),
      ownerId: this.requiredString(record.ownerId, "ownerId"),
      ownerWalletAddress: this.optionalString(record.ownerWalletAddress),
      ownerWalletBindingVersion: this.optionalInteger(
        record.ownerWalletBindingVersion,
      ),
      ownerWalletBindingFingerprint:
        this.optionalString(record.ownerWalletBindingFingerprint) ?? undefined,
      transferable: this.requiredBoolean(record.transferable, "transferable"),
      resaleCap: this.optionalNumber(record.resaleCap),
      maxTransferCount: this.requiredInteger(
        record.maxTransferCount,
        "maxTransferCount",
      ),
      metadataUri: this.optionalString(record.metadataUri),
      contractRoute: this.readOwnershipContractRoute(record.contractRoute),
    };
  }

  private readOwnershipIssueReceiptPayload(payload: Prisma.JsonValue) {
    const record = this.readRecordPayload(payload);
    this.ownershipStatus(record.ownershipStatus);
    const adapter = this.ownershipAdapter(record.ownershipAdapter);
    return {
      issue: this.readOwnershipIssuePayload(payload),
      ownership: {
        adapter,
        tokenId: this.requiredString(record.tokenId, "tokenId"),
        ownershipRef: this.requiredString(record.ownershipRef, "ownershipRef"),
        transactionHash: this.requiredString(
          record.transactionHash,
          "transactionHash",
        ),
        contractRoute: this.readOwnershipContractRoute(
          record.contractRoute,
          adapter !== "mock",
        ),
      },
    };
  }

  private readOwnershipRedeemPayload(
    payload: Prisma.JsonValue,
  ): RedeemOwnershipInput {
    const record = this.readRecordPayload(payload);
    return {
      ticketId: this.requiredString(record.ticketId, "ticketId"),
      tokenId: this.optionalString(record.tokenId),
      contractRoute: this.readOwnershipContractRoute(record.contractRoute),
    };
  }

  private readOwnershipRedeemReceiptPayload(payload: Prisma.JsonValue) {
    const record = this.readRecordPayload(payload);
    this.ownershipStatus(record.ownershipStatus);
    const adapter = this.ownershipAdapter(record.ownershipAdapter);
    return {
      redeem: this.readOwnershipRedeemPayload(payload),
      ownership: {
        adapter,
        tokenId: this.requiredString(record.tokenId, "tokenId"),
        ownershipRef: this.requiredString(record.ownershipRef, "ownershipRef"),
        transactionHash: this.requiredString(
          record.transactionHash,
          "transactionHash",
        ),
        contractRoute: this.readOwnershipContractRoute(
          record.contractRoute,
          adapter !== "mock",
        ),
      },
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
    const adapter = this.ownershipAdapter(record.ownershipAdapter);
    return {
      transfer: this.readOwnershipTransferPayload(payload),
      buyOrderId: this.requiredString(record.buyOrderId, "buyOrderId"),
      sellOrderId: this.requiredString(record.sellOrderId, "sellOrderId"),
      ownership: {
        adapter,
        status: this.ownershipStatus(record.ownershipStatus),
        tokenId: this.requiredString(record.tokenId, "tokenId"),
        ownershipRef: this.requiredString(record.ownershipRef, "ownershipRef"),
        transactionHash: this.optionalString(record.transactionHash),
        contractRoute: this.readOwnershipContractRoute(
          record.contractRoute,
          adapter !== "mock",
        ),
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

  private requiredBoolean(value: unknown, key: string) {
    if (typeof value !== "boolean") {
      throw new BadRequestException(`${key} must be a boolean`);
    }
    return value;
  }

  private requiredInteger(value: unknown, key: string) {
    if (!Number.isInteger(value)) {
      throw new BadRequestException(`${key} must be an integer`);
    }
    return value as number;
  }

  private optionalInteger(value: unknown) {
    return Number.isSafeInteger(value) ? (value as number) : undefined;
  }

  private optionalNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private readOwnershipContractRoute(
    value: unknown,
    required = false,
  ): OwnershipContractRoute | null {
    if (value === null || value === undefined) {
      if (required) {
        throw new BadRequestException(
          "contractRoute is required for ownership side effects",
        );
      }
      return null;
    }
    const record = this.readRecordPayload(value as Prisma.JsonValue);
    const contractAddress = this.requiredString(
      record.contractAddress,
      "contractRoute.contractAddress",
    )
      .trim()
      .toLowerCase();
    const chainId = this.requiredString(
      record.chainId,
      "contractRoute.chainId",
    ).trim();
    const contractVersion = this.requiredString(
      record.contractVersion,
      "contractRoute.contractVersion",
    );
    if (!/^0x[a-f0-9]{40}$/.test(contractAddress)) {
      throw new BadRequestException("contractRoute.contractAddress is invalid");
    }
    if (!/^[1-9][0-9]*$/.test(chainId)) {
      throw new BadRequestException("contractRoute.chainId is invalid");
    }
    if (contractVersion !== "fanpass-ticket-v1") {
      throw new BadRequestException(
        "contractRoute.contractVersion is unsupported",
      );
    }
    return {
      contractAddress,
      chainId,
      contractVersion,
    };
  }

  private assertWriteContractRoute(input: {
    contractRoute?: OwnershipContractRoute | null;
  }) {
    if (this.ownership.adapterName() === "mock" || input.contractRoute) {
      return;
    }
    throw OwnershipOperationError.definitelyNotSubmitted(
      new BadRequestException(
        "Legacy ownership side effect is missing its immutable contract route and must not be submitted",
      ),
      "Ticket ownership route validation failed",
      false,
    );
  }

  private assertInitialOwnershipAdapterSnapshot(payload: Prisma.JsonValue) {
    const record = this.readRecordPayload(payload);
    const currentAdapter = this.ownership.adapterName();
    if (record.ownershipAdapter === undefined && currentAdapter === "mock") {
      return;
    }
    let snapshottedAdapter: OwnershipReceipt["adapter"];
    try {
      snapshottedAdapter = this.ownershipAdapter(record.ownershipAdapter);
    } catch (error) {
      throw OwnershipOperationError.definitelyNotSubmitted(
        error,
        "Ticket ownership adapter snapshot validation failed",
        false,
      );
    }
    if (snapshottedAdapter !== currentAdapter) {
      throw OwnershipOperationError.definitelyNotSubmitted(
        new BadRequestException(
          `Ownership job adapter ${snapshottedAdapter} does not match runtime adapter ${currentAdapter}`,
        ),
        "Ticket ownership adapter snapshot validation failed",
        false,
      );
    }
  }

  private sameOwnershipRoute(
    left: OwnershipContractRoute | null | undefined,
    right: OwnershipContractRoute | null | undefined,
  ) {
    if (!left || !right) {
      return !left && !right;
    }
    return (
      left.contractAddress === right.contractAddress &&
      left.chainId === right.chainId &&
      left.contractVersion === right.contractVersion
    );
  }

  private ownershipAdapter(value: unknown): OwnershipReceipt["adapter"] {
    if (value === "mock" || value === "testnet" || value === "privy") {
      return value;
    }
    throw new BadRequestException("ownershipAdapter is invalid");
  }

  private ownershipStatus(value: unknown): OwnershipReceipt["status"] {
    if (value === "CONFIRMED" || value === "PENDING" || value === "FAILED") {
      return value;
    }
    throw new BadRequestException("ownershipStatus is invalid");
  }

  private async verifyIssueWalletBinding(payload: IssueOwnershipInput) {
    try {
      if (this.ownership.adapterName() !== "privy") {
        return false;
      }
      await this.verifyWalletBindingSnapshot({
        userId: payload.ownerId,
        walletAddress: payload.ownerWalletAddress,
        walletBindingVersion: payload.ownerWalletBindingVersion,
        walletBindingFingerprint: payload.ownerWalletBindingFingerprint,
        label: "Ticket owner wallet",
      });
      return true;
    } catch (error) {
      throw OwnershipOperationError.definitelyNotSubmitted(
        error,
        "Ticket ownership issuance validation failed",
        this.walletBindingFailureIsRetryable(error),
      );
    }
  }

  private async verifyTransferWalletBindings(payload: TransferOwnershipInput) {
    try {
      if (this.ownership.adapterName() !== "privy") {
        return false;
      }
      await this.verifyWalletBindingSnapshot({
        userId: payload.fromOwnerId,
        walletAddress: payload.fromWalletAddress,
        walletBindingVersion: payload.fromWalletBindingVersion,
        walletBindingFingerprint: payload.fromWalletBindingFingerprint,
        label: "Seller wallet",
      });
      await this.verifyWalletBindingSnapshot({
        userId: payload.toOwnerId,
        walletAddress: payload.toWalletAddress,
        walletBindingVersion: payload.toWalletBindingVersion,
        walletBindingFingerprint: payload.toWalletBindingFingerprint,
        label: "Buyer wallet",
      });
      return true;
    } catch (error) {
      throw OwnershipOperationError.definitelyNotSubmitted(
        error,
        "Ticket ownership transfer validation failed",
        this.walletBindingFailureIsRetryable(error),
      );
    }
  }

  private walletBindingFailureIsRetryable(error: unknown) {
    return !(
      error instanceof WalletBindingNotVerifiedError ||
      error instanceof UnauthorizedException
    );
  }

  private definitelyNotSubmitted(
    error: unknown,
  ): error is OwnershipOperationError {
    return (
      error instanceof OwnershipOperationError &&
      error.submissionDisposition === "DEFINITELY_NOT_SUBMITTED"
    );
  }

  private hasPriorOwnershipSubmissionRisk(job: SideEffectOutbox) {
    if (
      job.lastError?.includes(OWNERSHIP_AMBIGUOUS_ERROR_MARKER) ||
      job.lastError?.includes(OWNERSHIP_SUBMISSION_STARTED_MARKER)
    ) {
      return true;
    }
    if (
      !job.payloadJson ||
      typeof job.payloadJson !== "object" ||
      Array.isArray(job.payloadJson)
    ) {
      return false;
    }
    return (
      (job.payloadJson as Prisma.JsonObject)[
        OWNERSHIP_SUBMISSION_STARTED_PAYLOAD_KEY
      ] === true
    );
  }

  private async persistOwnershipSubmissionStarted(job: SideEffectOutbox) {
    if (this.ownership.adapterName() !== "privy") {
      return;
    }
    const marked = await this.outbox.markOwnershipSubmissionStarted(job);
    if (!marked) {
      throw OwnershipOperationError.definitelyNotSubmitted(
        new Error("Ownership submission safety marker could not be persisted"),
        "Ownership provider request was not submitted",
      );
    }
    job.payloadJson = marked.payloadJson;
    job.lastError = marked.lastError;
  }

  private providerSubmissionHooks(job: SideEffectOutbox) {
    return {
      beforeProviderSubmission: () =>
        this.outbox.assertClaimRevisionCurrent(job),
    };
  }

  private ownershipSubmissionHooks(job: SideEffectOutbox) {
    if (this.ownership.adapterName() === "mock") {
      return undefined;
    }
    return {
      beforeProviderSubmission: async () => {
        await this.outbox.assertClaimRevisionCurrent(job);
        await this.persistOwnershipSubmissionStarted(job);
        await this.outbox.assertClaimRevisionCurrent(job);
      },
    };
  }

  private async compensateDefinitelyNotSubmittedOwnershipFailure(
    job: SideEffectOutbox,
    error: OwnershipOperationError,
  ) {
    if (job.type === "OWNERSHIP_ISSUE") {
      const payload = this.readOwnershipIssuePayload(job.payloadJson);
      await this.orderbook.failPrimaryOwnershipIssue(
        payload.localTicketId,
        this.ownershipFailureCause(error),
      );
      return;
    }
    if (job.type !== "OWNERSHIP_TRANSFER") {
      return;
    }
    const payload = this.readOwnershipSettlementPayload(job.payloadJson);
    if (!payload.buyOrderId || !payload.sellOrderId) {
      return;
    }
    await this.orderbook.failOwnershipTransfer({
      buyOrderId: payload.buyOrderId,
      sellOrderId: payload.sellOrderId,
      ticketId: payload.transfer.ticketId,
      reason: this.ownershipFailureCause(error).message,
    });
  }

  private ownershipFailureCause(error: OwnershipOperationError) {
    return error.originalError instanceof Error ? error.originalError : error;
  }

  private compensationRetryError(
    ownershipError: unknown,
    compensationError: unknown,
  ) {
    const ownershipMessage =
      ownershipError instanceof Error
        ? ownershipError.message
        : "Ownership operation failed";
    const compensationMessage =
      compensationError instanceof Error
        ? compensationError.message
        : "ownership compensation failed";
    return new Error(
      `${ownershipMessage}; business compensation will retry: ${compensationMessage}`,
    );
  }

  private async verifyWalletBindingSnapshot(input: {
    userId: string;
    walletAddress: string | null;
    walletBindingVersion?: number;
    walletBindingFingerprint?: string;
    label: string;
  }) {
    if (
      !this.prisma ||
      !input.walletAddress ||
      !Number.isSafeInteger(input.walletBindingVersion) ||
      Number(input.walletBindingVersion) <= 0 ||
      !/^[a-f0-9]{64}$/i.test(input.walletBindingFingerprint ?? "")
    ) {
      throw new WalletBindingNotVerifiedError(input.label);
    }
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        privyId: true,
        privyWalletId: true,
        walletAddress: true,
        walletBindingStatus: true,
        walletBindingVerifiedAt: true,
        walletBindingVersion: true,
        walletBindingFingerprint: true,
      },
    });
    const binding = requireVerifiedWalletBinding(user ?? {}, input.label);
    if (
      binding.walletAddress !== input.walletAddress.trim().toLowerCase() ||
      binding.walletBindingVersion !== input.walletBindingVersion ||
      binding.walletBindingFingerprint !==
        input.walletBindingFingerprint?.trim().toLowerCase()
    ) {
      throw new WalletBindingNotVerifiedError(input.label);
    }
    await this.ownership.verifyPrivyWalletBinding({
      privyUserId: binding.privyId,
      walletId: binding.privyWalletId,
      walletAddress: binding.walletAddress,
    });
  }

  private ownershipSettlementFinalizeKey(
    buyOrderId: string,
    sellOrderId: string,
  ) {
    return `ownership-finalize:${buyOrderId}:${sellOrderId}`;
  }

  private async enqueueOwnershipFinalization(
    payload: {
      transfer: TransferOwnershipInput;
      buyOrderId: string;
      sellOrderId: string;
    },
    ownership: OwnershipReceipt,
  ) {
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
        contractRoute:
          ownership.contractRoute ?? payload.transfer.contractRoute ?? null,
      },
    });
  }

  private async enqueueIssueOwnershipReceiptPoll(
    payload: IssueOwnershipInput,
    ownership: OwnershipReceipt,
  ) {
    if (!ownership.transactionHash) {
      throw new BadRequestException(
        "Pending ownership issuance is missing a transaction hash",
      );
    }
    await this.outbox.enqueueStandalone({
      type: "OWNERSHIP_ISSUE_RECEIPT_POLL",
      idempotencyKey: `ownership-issue-receipt:${ownership.transactionHash}`,
      aggregateType: "ticket",
      aggregateId: payload.localTicketId,
      payload: {
        ...payload,
        ownershipAdapter: ownership.adapter,
        ownershipStatus: ownership.status,
        tokenId: ownership.tokenId,
        ownershipRef: ownership.ownershipRef,
        transactionHash: ownership.transactionHash,
        contractRoute: ownership.contractRoute ?? payload.contractRoute ?? null,
      },
    });
  }

  private async enqueueOwnershipReceiptPoll(
    payload: {
      transfer: TransferOwnershipInput;
      buyOrderId: string;
      sellOrderId: string;
    },
    ownership: OwnershipReceipt,
  ) {
    if (!ownership.transactionHash) {
      throw new BadRequestException(
        "Pending ownership transfer is missing a transaction hash",
      );
    }
    await this.outbox.enqueueStandalone({
      type: "OWNERSHIP_RECEIPT_POLL",
      idempotencyKey: `ownership-receipt:${ownership.transactionHash}`,
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
        contractRoute:
          ownership.contractRoute ?? payload.transfer.contractRoute ?? null,
      },
    });
  }

  private async enqueueRedeemOwnershipReceiptPoll(
    payload: RedeemOwnershipInput,
    ownership: OwnershipReceipt,
  ) {
    if (!ownership.transactionHash) {
      throw new BadRequestException(
        "Pending ownership redemption is missing a transaction hash",
      );
    }
    await this.outbox.enqueueStandalone({
      type: "OWNERSHIP_REDEEM_RECEIPT_POLL",
      idempotencyKey: `ownership-redeem-receipt:${ownership.transactionHash}`,
      aggregateType: "ticket",
      aggregateId: payload.ticketId,
      payload: {
        ticketId: payload.ticketId,
        tokenId: ownership.tokenId,
        ownershipAdapter: ownership.adapter,
        ownershipStatus: ownership.status,
        ownershipRef: ownership.ownershipRef,
        transactionHash: ownership.transactionHash,
        contractRoute: ownership.contractRoute ?? payload.contractRoute ?? null,
      },
    });
  }
}
