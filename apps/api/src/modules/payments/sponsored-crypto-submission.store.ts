import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { SponsoredCryptoSubmission } from "@prisma/client";
import { createHmac, randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { requireVerifiedWalletBinding } from "../../common/wallet-binding";
import {
  assertMarketplaceEventPublished,
  lockMarketplaceEvent,
} from "../events/event-marketplace-policy";

const SAFE_PROVIDER_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1_000;

export type SponsoredSubmissionAction =
  | { kind: "SEND"; submission: SponsoredCryptoSubmission; leaseOwner: string }
  | { kind: "POLL"; submission: SponsoredCryptoSubmission; leaseOwner: string }
  | { kind: "CONFIRM"; submission: SponsoredCryptoSubmission }
  | { kind: "WAIT"; submission: SponsoredCryptoSubmission }
  | { kind: "AMBIGUOUS"; submission: SponsoredCryptoSubmission };

export interface SponsoredCryptoSubmissionIntent {
  paymentId: string;
  eventId: string;
  idempotencyKey: string;
  walletId: string;
  walletAddress: string;
  walletBindingVersion: number;
  walletBindingFingerprint: string;
  chainId: string;
  tokenContractAddress: string;
  receiverAddress: string;
  amountAtomic: string;
  tokenDecimals: number;
  transactionData: string;
}

interface SponsoredCryptoSubmissionStoreOptions {
  requestHashSecret: string;
  leaseSeconds: number;
}

/**
 * Owns the durable admission and provider-checkpoint state machine for a
 * sponsored transfer. It deliberately has no access to Privy credentials.
 */
export class SponsoredCryptoSubmissionStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly options: SponsoredCryptoSubmissionStoreOptions,
  ) {}

  async claim(
    input: SponsoredCryptoSubmissionIntent,
  ): Promise<SponsoredSubmissionAction> {
    const requestKeyHash = this.requestKeyHash(input.idempotencyKey);
    // iOS signs this exact value as the Privy idempotency header.
    const providerIdempotencyKey = input.idempotencyKey;
    const now = new Date();
    const leaseOwner = `sponsor_lease_${randomUUID()}`;
    const leaseExpiresAt = new Date(
      now.getTime() + this.options.leaseSeconds * 1_000,
    );

    return this.prisma.$transaction(async (tx) => {
      const eventStatus = await lockMarketplaceEvent(tx, input.eventId);
      let submission = await tx.sponsoredCryptoSubmission.findUnique({
        where: { paymentId: input.paymentId },
      });
      if (!submission) {
        assertMarketplaceEventPublished(eventStatus);
        try {
          submission = await tx.sponsoredCryptoSubmission.create({
            data: {
              id: `scs_${randomUUID()}`,
              paymentId: input.paymentId,
              requestKeyHash,
              providerIdempotencyKey,
              walletId: input.walletId,
              walletAddress: input.walletAddress,
              walletBindingVersion: input.walletBindingVersion,
              walletBindingFingerprint: input.walletBindingFingerprint,
              chainId: input.chainId,
              tokenContractAddress: input.tokenContractAddress,
              receiverAddress: input.receiverAddress,
              amountAtomic: input.amountAtomic,
              tokenDecimals: input.tokenDecimals,
              transactionData: input.transactionData,
              status: "SUBMITTING",
              leaseOwner,
              leaseExpiresAt,
              ambiguityDeadlineAt: new Date(
                now.getTime() + SAFE_PROVIDER_IDEMPOTENCY_WINDOW_MS,
              ),
              attemptCount: 1,
            },
          });
        } catch (error) {
          if (isUniqueConstraint(error)) {
            throw new ConflictException(
              "Idempotency key is already bound to another sponsored payment",
            );
          }
          throw error;
        }
        return { kind: "SEND", submission, leaseOwner };
      }

      if (submission.requestKeyHash !== requestKeyHash) {
        throw new ConflictException(
          "A different payment request is already bound to this USDC quote",
        );
      }
      if (
        submission.status === "AMBIGUOUS" ||
        submission.status === "COMPENSATION_REQUIRED" ||
        submission.status === "FAILED"
      ) {
        return { kind: "AMBIGUOUS", submission };
      }
      if (submission.transactionHash) {
        return { kind: "CONFIRM", submission };
      }
      if (leaseIsActive(submission, now)) {
        return { kind: "WAIT", submission };
      }
      if (submission.providerId) {
        const claimed = await tx.sponsoredCryptoSubmission.update({
          where: { id: submission.id },
          data: {
            status: "PROVIDER_ACCEPTED",
            leaseOwner,
            leaseExpiresAt,
            lastErrorCode: null,
          },
        });
        return { kind: "POLL", submission: claimed, leaseOwner };
      }
      if (
        submission.ambiguityDeadlineAt.getTime() <= now.getTime() ||
        eventStatus !== "PUBLISHED"
      ) {
        const ambiguous = await tx.sponsoredCryptoSubmission.update({
          where: { id: submission.id },
          data: {
            status: "AMBIGUOUS",
            leaseOwner: null,
            leaseExpiresAt: null,
            lastErrorCode:
              eventStatus === "PUBLISHED"
                ? "provider_idempotency_window_expired"
                : "event_not_published_before_retry",
          },
        });
        return { kind: "AMBIGUOUS", submission: ambiguous };
      }

      const claimed = await tx.sponsoredCryptoSubmission.update({
        where: { id: submission.id },
        data: {
          status: "SUBMITTING",
          leaseOwner,
          leaseExpiresAt,
          lastErrorCode: null,
          attemptCount: { increment: 1 },
        },
      });
      return { kind: "SEND", submission: claimed, leaseOwner };
    });
  }

  async assertMaySend(input: {
    submissionId: string;
    leaseOwner: string;
    eventId: string;
  }) {
    await this.prisma.$transaction(async (tx) => {
      const eventStatus = await lockMarketplaceEvent(tx, input.eventId);
      assertMarketplaceEventPublished(eventStatus);
      const submission = await tx.sponsoredCryptoSubmission.findUniqueOrThrow({
        where: { id: input.submissionId },
      });
      if (
        submission.status !== "SUBMITTING" ||
        submission.leaseOwner !== input.leaseOwner ||
        !submission.leaseExpiresAt ||
        submission.leaseExpiresAt.getTime() <= Date.now() ||
        submission.ambiguityDeadlineAt.getTime() <= Date.now()
      ) {
        throw new ServiceUnavailableException(
          "Wallet payment send lease is no longer valid",
        );
      }
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: submission.paymentId },
        include: { order: { include: { user: true } } },
      });
      if (!payment.order) {
        throw new ServiceUnavailableException(
          "Wallet payment is not attached to an order",
        );
      }
      const binding = requireVerifiedWalletBinding(
        payment.order.user,
        "USDC payer wallet",
      );
      if (
        binding.privyWalletId !== submission.walletId ||
        binding.walletAddress !== submission.walletAddress ||
        binding.walletBindingVersion !== submission.walletBindingVersion ||
        binding.walletBindingFingerprint !== submission.walletBindingFingerprint
      ) {
        throw new ConflictException(
          "Wallet binding changed before the USDC transfer was submitted",
        );
      }
    });
  }

  async checkpoint(input: {
    submissionId: string;
    providerId?: string | null;
    transactionHash?: string | null;
  }) {
    const providerId = input.providerId?.trim() || null;
    const transactionHash = validSponsoredTransactionHash(
      input.transactionHash,
    );
    return this.prisma.sponsoredCryptoSubmission.update({
      where: { id: input.submissionId },
      data: {
        providerId,
        transactionHash,
        status: transactionHash
          ? "HASH_AVAILABLE"
          : providerId
            ? "PROVIDER_ACCEPTED"
            : "AMBIGUOUS",
        submittedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCode:
          transactionHash || providerId
            ? null
            : "provider_response_missing_checkpoint",
      },
    });
  }

  async markRetryable(input: {
    submissionId: string;
    leaseOwner: string;
    reason: string;
  }) {
    return this.prisma.sponsoredCryptoSubmission.updateMany({
      where: {
        id: input.submissionId,
        leaseOwner: input.leaseOwner,
        status: "SUBMITTING",
      },
      data: {
        status: "RETRYABLE",
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCode: input.reason,
      },
    });
  }

  async markAmbiguous(submissionId: string, reason: string) {
    return this.prisma.sponsoredCryptoSubmission.update({
      where: { id: submissionId },
      data: {
        status: "AMBIGUOUS",
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCode: reason,
      },
    });
  }

  private requestKeyHash(idempotencyKey: string) {
    return createHmac("sha256", this.options.requestHashSecret)
      .update(`sponsored-usdc-request-v1\0${idempotencyKey}`)
      .digest("hex");
  }
}

export function validSponsoredTransactionHash(
  value: string | null | undefined,
) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return /^0x[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

function leaseIsActive(submission: SponsoredCryptoSubmission, now: Date) {
  return Boolean(
    submission.leaseOwner &&
    submission.leaseExpiresAt &&
    submission.leaseExpiresAt.getTime() > now.getTime(),
  );
}

function isUniqueConstraint(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
