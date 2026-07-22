import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Payment, Prisma, SponsoredCryptoSubmission } from "@prisma/client";
import { createHmac, randomUUID } from "crypto";
import Stripe = require("stripe");
import { PrismaService } from "../../common/prisma.service";
import { FanPassSession } from "../../common/session";
import { requireVerifiedWalletBinding } from "../../common/wallet-binding";
import { isProductionLikeEnvironment } from "../../config/security-config";
import { AuditService } from "../audit/audit.service";
import {
  assertMarketplaceEventPublished,
  lockMarketplaceEvent,
} from "../events/event-marketplace-policy";
import { OnsaleInventoryService } from "../onsales/onsale-inventory.service";
import {
  classifyPrivyTransactionStatus,
  PrivyWalletService,
} from "../privy/privy-wallet.service";
import {
  SideEffectDispatchFencedError,
  SideEffectOutboxService,
} from "../side-effects/side-effect-outbox.service";
import {
  SponsoredCryptoSubmissionStore,
  SponsoredSubmissionAction,
  validSponsoredTransactionHash,
} from "./sponsored-crypto-submission.store";

const STRIPE_API_VERSION = "2026-05-27.dahlia";

export interface CreatePaymentIntentInput {
  orderId: string;
  idempotencyKey: string | undefined;
}

export interface CreateCryptoQuoteInput {
  orderId: string;
  asset: "USDC";
  idempotencyKey: string | undefined;
}

export interface ConfirmCryptoPaymentInput {
  paymentId: string;
  transactionHash: string;
  idempotencyKey: string | undefined;
}

export interface SendSponsoredCryptoPaymentInput {
  paymentId: string;
  idempotencyKey: string | undefined;
  privyAccessToken?: string;
  privyAuthorizationSignature?: string;
  privyRequestExpiry?: number;
}

type PaymentOperation = "cancel_authorization" | "refund" | "reconcile";

interface RequestPaymentOperationInput {
  operation: PaymentOperation;
  paymentId: string;
  idempotencyKey: string | undefined;
  reason?: string;
}

interface PaymentIntentResult {
  id: string;
  clientSecret: string | null;
  status: string;
  captureStatus: string;
}

export interface PaymentProviderSubmissionHooks {
  beforeProviderSubmission?: () => Promise<void>;
}

interface StripeChargeLike {
  deleted?: boolean;
  payment_method_details?: {
    card?: { fingerprint?: string | null };
    card_present?: { fingerprint?: string | null };
  } | null;
}

interface StripePaymentIntentLike {
  id: string;
  status: string;
  client_secret?: string | null;
  latest_charge?: string | StripeChargeLike | null;
}

interface StripeEventLike {
  id?: string;
  type: string;
  data: {
    object: StripePaymentIntentLike;
  };
}

export interface CryptoQuote {
  asset: "USDC";
  chainId: string;
  tokenContractAddress: string;
  receiverAddress: string;
  amountAtomic: string;
  amountDecimal: string;
  decimals: number;
  hkdRate: string;
  hkdRateSource: string;
  hkdRateAsOf: string | null;
  hkdRateFetchedAt: string;
  usdcUsdRate: string | null;
  usdcPegStatus: UsdcPegStatus;
  expiresAt: string;
  erc20TransferData: string;
}

interface RpcReceipt {
  status?: string;
  from?: string;
  to?: string;
  logs?: Array<{
    address?: string;
    topics?: string[];
    data?: string;
  }>;
  blockNumber?: string;
}

type CryptoPaymentWithOrder = Payment & {
  sponsoredCryptoSubmission?: SponsoredCryptoSubmission | null;
  order: {
    id: string;
    eventId: string;
    fulfillmentMode: string;
    user: {
      walletAddress: string | null;
      privyWalletId: string | null;
      privyId: string | null;
      walletBindingStatus: "UNVERIFIED" | "VERIFIED" | "REVOKED";
      walletBindingVerifiedAt: Date | null;
      walletBindingVersion: number;
      walletBindingFingerprint: string | null;
    };
    event: {
      status: "DRAFT" | "PUBLISHED" | "CANCELLED";
    };
  };
};

interface UsdcHkdRate {
  value: number;
  source: string;
  asOf: string | null;
  fetchedAt: Date;
  usdcUsdRate: number | null;
  pegStatus: UsdcPegStatus;
}

type UsdcPegStatus = "stable" | "watch" | "blocked" | "not_checked";

const ERC20_TRANSFER_SELECTOR = "a9059cbb";
const ERC20_BALANCE_OF_SELECTOR = "70a08231";
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const COINGECKO_USDC_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=hkd,usd&include_last_updated_at=true";
const HKMA_USD_HKD_RATE_URL =
  "https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily?offset=0&pagesize=1";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private usdcHkdRateCache: {
    rate: UsdcHkdRate;
    expiresAt: number;
  } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly outbox: SideEffectOutboxService,
    private readonly audit: AuditService,
    @Optional() private readonly privyWallets?: PrivyWalletService,
    @Optional() private readonly onsaleInventory?: OnsaleInventoryService,
  ) {}

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
    session: FanPassSession,
  ) {
    if (!this.prismaPaymentDataSourceEnabled()) {
      throw new ServiceUnavailableException(
        "Payment authorization requires the Prisma Alpha data source. Start the API with FANPASS_DATA_SOURCE=prisma before testing checkout.",
      );
    }

    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) {
      throw new BadRequestException("Idempotency-Key is required for payments");
    }

    const order = await this.prisma.order.findUnique({
      where: {
        id: input.orderId,
      },
      include: {
        event: {
          select: { status: true },
        },
      },
    });
    if (!order) {
      throw new BadRequestException(
        "Order is not available for payment authorization",
      );
    }
    if (session.role === "FAN" && order.userId !== session.userId) {
      throw new BadRequestException("Fans can only pay for their own orders");
    }
    if (order.side !== "BUY") {
      throw new BadRequestException("Only buy orders can be paid");
    }
    if (order.status === "CANCELLED" || order.status === "REJECTED") {
      throw new BadRequestException(
        `Order status ${order.status} cannot be paid`,
      );
    }
    assertMarketplaceEventPublished(order.event.status);
    if (order.fulfillmentMode === "PRIMARY_ONLY") {
      await this.requireOnsaleInventory().assertOrderPayable(
        this.prisma,
        order,
      );
    }

    const amount = this.amountMinor(order.price);
    const paymentResult = await this.prisma.$transaction(async (tx) => {
      await this.lockPublishedMarketplaceEvent(tx, order.eventId);
      const existing = await tx.payment.findFirst({
        where: {
          userId: order.userId,
          idempotencyKey,
        },
      });
      if (existing) {
        this.assertPaymentMatchesOrder(existing, order.id, amount);
        if (existing.currency !== "hkd") {
          throw new BadRequestException(
            "Idempotency key already belongs to a non-card payment request",
          );
        }
        if (this.providerPaymentIntentIncomplete(existing)) {
          await this.ensurePaymentIntentCreateMarker(tx, existing, order);
        }
        return { payment: existing, existing: true };
      }
      const created = await tx.payment.create({
        data: {
          id: `pay_${randomUUID()}`,
          userId: order.userId,
          orderId: order.id,
          stripePaymentIntentId: null,
          clientSecret: null,
          amount,
          currency: "hkd",
          status: "PENDING",
          captureStatus: "NOT_CAPTURED",
          idempotencyKey,
        },
      });
      await this.ensurePaymentIntentCreateMarker(tx, created, order);
      return { payment: created, existing: false };
    });

    await this.assertMarketplaceEventOpenForExternalPayment(order.eventId);
    let updated: Payment;
    try {
      const providerHooks = !this.providerPaymentIntentIncomplete(
        paymentResult.payment,
      )
        ? undefined
        : await this.directProviderSubmissionHooks();
      updated = await this.ensureProviderPaymentIntent(
        paymentResult.payment,
        {
          eventId: order.eventId,
          ticketTypeId: order.ticketTypeId,
        },
        paymentResult.existing
          ? "PAYMENT_INTENT_REPAIRED"
          : "PAYMENT_INTENT_CREATED",
        providerHooks,
      );
    } catch (error) {
      this.rethrowDirectProviderDispatchFence(error);
    }

    return this.mapPayment(updated);
  }

  async createCryptoQuote(
    input: CreateCryptoQuoteInput,
    session: FanPassSession,
  ) {
    if (!this.prismaPaymentDataSourceEnabled()) {
      throw new ServiceUnavailableException(
        "Crypto payment requires the Prisma Alpha data source. Start the API with FANPASS_DATA_SOURCE=prisma before testing checkout.",
      );
    }
    if (input.asset !== "USDC") {
      throw new BadRequestException("Only USDC crypto checkout is supported");
    }

    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) {
      throw new BadRequestException("Idempotency-Key is required for payments");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        event: {
          select: { status: true },
        },
      },
    });
    if (!order) {
      throw new BadRequestException(
        "Order is not available for crypto payment",
      );
    }
    if (session.role === "FAN" && order.userId !== session.userId) {
      throw new BadRequestException("Fans can only pay for their own orders");
    }
    if (order.side !== "BUY") {
      throw new BadRequestException("Only buy orders can be paid");
    }
    if (order.status === "CANCELLED" || order.status === "REJECTED") {
      throw new BadRequestException(
        `Order status ${order.status} cannot be paid`,
      );
    }
    assertMarketplaceEventPublished(order.event.status);
    if (order.fulfillmentMode === "PRIMARY_ONLY") {
      const inventory = this.requireOnsaleInventory();
      await inventory.assertOrderPayable(this.prisma, order);
      if (await inventory.isQueueManagedOrder(this.prisma, order.id)) {
        throw new BadRequestException(
          "Queued on-sales currently require card authorization so failed inventory claims can be released safely",
        );
      }
    }

    const config = await this.cryptoPaymentConfig();

    const amountMinor = this.amountMinor(order.price);
    const payment = await this.prisma.$transaction(async (tx) => {
      await this.lockPublishedMarketplaceEvent(tx, order.eventId);
      const existing = await tx.payment.findFirst({
        where: {
          userId: order.userId,
          idempotencyKey,
        },
      });
      if (existing) {
        return existing;
      }
      return tx.payment.create({
        data: {
          id: `pay_${randomUUID()}`,
          userId: order.userId,
          orderId: order.id,
          stripePaymentIntentId: null,
          clientSecret: null,
          amount: amountMinor,
          currency: "usdc",
          status: "PENDING",
          captureStatus: "NOT_CAPTURED",
          idempotencyKey,
        },
      });
    });

    this.assertPaymentMatchesOrder(payment, order.id, amountMinor);
    if (payment.currency !== "usdc") {
      throw new BadRequestException(
        "Idempotency key already belongs to a non-crypto payment request",
      );
    }

    const quote = this.cryptoQuoteForPayment(payment, config);
    return {
      payment: this.mapRedactedPayment(payment),
      quote,
    };
  }

  async confirmCryptoPayment(
    input: ConfirmCryptoPaymentInput,
    session: FanPassSession,
  ) {
    if (!this.prismaPaymentDataSourceEnabled()) {
      throw new ServiceUnavailableException(
        "Crypto payment confirmation requires the Prisma Alpha data source.",
      );
    }
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) {
      throw new BadRequestException("Idempotency-Key is required for payments");
    }

    const payment = await this.loadCryptoPayment(input.paymentId);
    this.assertCryptoPaymentAccess(payment, session, "confirm");
    const terminal = this.cryptoPaymentTerminalResponse(payment);
    if (terminal) {
      return terminal;
    }
    const registeredHash = this.registeredCryptoTransactionHash(payment);
    const submittedHash = input.transactionHash.toLowerCase();
    if (registeredHash && registeredHash !== submittedHash) {
      throw new BadRequestException(
        "USDC transaction is not bound to this payment",
      );
    }
    if (!registeredHash && !this.manualCryptoConfirmationAllowed()) {
      throw new ServiceUnavailableException(
        "Manual USDC transaction confirmation is unavailable. Use the FanPass wallet payment flow.",
      );
    }

    const config = await this.cryptoPaymentConfig();
    const quote = this.cryptoQuoteForPayment(payment, config);
    return this.confirmCryptoPaymentRecord(
      payment,
      submittedHash,
      quote,
      config,
    );
  }

  async sendSponsoredCryptoPayment(
    input: SendSponsoredCryptoPaymentInput,
    session: FanPassSession,
  ) {
    if (!this.prismaPaymentDataSourceEnabled()) {
      throw new ServiceUnavailableException(
        "Sponsored crypto payment requires the Prisma Alpha data source.",
      );
    }
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) {
      throw new BadRequestException("Idempotency-Key is required for payments");
    }

    const payment = await this.loadCryptoPayment(input.paymentId);
    this.assertCryptoPaymentAccess(payment, session, "pay");
    const terminal = this.cryptoPaymentTerminalResponse(payment);
    if (terminal) {
      return terminal;
    }

    const registeredHash = this.registeredCryptoTransactionHash(payment);
    if (registeredHash) {
      const config = await this.cryptoPaymentConfig();
      const quote = this.cryptoQuoteForPayment(payment, config);
      return this.confirmCryptoPaymentRecord(
        payment,
        registeredHash,
        quote,
        config,
      );
    }

    assertMarketplaceEventPublished(payment.order.event.status);
    const walletBinding = this.requireCryptoWalletBinding(payment);
    const privyUserId = payment.order.user.privyId?.trim();
    if (!privyUserId) {
      throw new BadRequestException(
        "Reconnect your FanPass wallet before paying with USDC",
      );
    }
    const config = await this.cryptoPaymentConfig();
    const currentQuote = this.cryptoQuoteForPayment(payment, config);
    const claim = await this.claimSponsoredCryptoSubmission({
      payment,
      idempotencyKey,
      walletId: walletBinding.walletId,
      walletAddress: walletBinding.walletAddress,
      walletBindingVersion: payment.order.user.walletBindingVersion,
      walletBindingFingerprint:
        payment.order.user.walletBindingFingerprint ?? "",
      quote: currentQuote,
    });
    if (claim.kind === "AMBIGUOUS") {
      throw new ServiceUnavailableException(
        "Wallet payment outcome requires manual reconciliation. No new transfer will be sent.",
      );
    }
    if (claim.kind === "WAIT") {
      throw new ServiceUnavailableException(
        "Wallet payment is already processing. Try again shortly.",
      );
    }
    const quote = this.cryptoQuoteFromSubmission(
      claim.submission,
      currentQuote,
    );
    if (claim.kind === "CONFIRM") {
      const hash = this.validSponsoredTransactionHash(
        claim.submission.transactionHash,
      );
      if (!hash) {
        await this.markSponsoredSubmissionAmbiguous(
          claim.submission.id,
          "missing_confirmable_transaction_hash",
        );
        throw new ServiceUnavailableException(
          "Wallet payment outcome requires manual reconciliation.",
        );
      }
      return this.confirmCryptoPaymentRecord(payment, hash, quote, config);
    }

    const sponsor = this.privyWallets ?? new PrivyWalletService(this.config);
    if (claim.kind === "POLL") {
      return this.pollAndConfirmSponsoredCryptoPayment({
        sponsor,
        payment,
        submission: claim.submission,
        quote,
        config,
      });
    }

    const privyRequestExpiry = this.validatedPrivyAuthorizationExpiry({
      signature: input.privyAuthorizationSignature,
      requestExpiry: input.privyRequestExpiry,
    });
    await sponsor.resolveUserEmbeddedEthereumWallet({
      privyUserId,
      walletId: claim.submission.walletId,
      walletAddress: claim.submission.walletAddress,
    });
    await this.assertSufficientUsdcBalance({
      rpcUrl: config.rpcUrl,
      tokenContractAddress: quote.tokenContractAddress,
      payerAddress: claim.submission.walletAddress,
      amountAtomic: BigInt(quote.amountAtomic),
    });
    let dispatchFence: Awaited<
      ReturnType<SideEffectOutboxService["captureDirectProviderMutationFence"]>
    >;
    try {
      dispatchFence = await this.outbox.captureDirectProviderMutationFence();
    } catch (error) {
      await this.markSponsoredSubmissionRetryable(
        claim.submission.id,
        claim.leaseOwner,
        this.sponsoredCryptoPaymentFailureReason(error),
      );
      throw this.sponsoredCryptoPaymentUnavailable(error, {
        stage: "privy_send",
        paymentId: payment.id,
        orderId: payment.orderId ?? payment.order.id,
        userId: payment.userId,
        payerAddress: claim.submission.walletAddress,
        walletId: claim.submission.walletId,
        hasPrivyAccessToken: Boolean(input.privyAccessToken?.trim()),
        hasPrivyAuthorizationSignature: Boolean(
          input.privyAuthorizationSignature?.trim(),
        ),
      });
    }
    await this.assertSponsoredSubmissionMaySend({
      submissionId: claim.submission.id,
      leaseOwner: claim.leaseOwner,
      eventId: payment.order.eventId,
    });
    let sponsored: Awaited<
      ReturnType<PrivyWalletService["sendSponsoredEthereumTransaction"]>
    >;
    try {
      await this.outbox.assertDirectProviderMutationFenceCurrent(dispatchFence);
      sponsored = await sponsor.sendSponsoredEthereumTransaction({
        walletId: claim.submission.walletId,
        caip2: this.cryptoCaip2(claim.submission.chainId),
        idempotencyKey: claim.submission.providerIdempotencyKey,
        userJwt: input.privyAccessToken,
        userAuthorizationSignature: input.privyAuthorizationSignature,
        requestExpiry: privyRequestExpiry,
        transaction: {
          to: claim.submission.tokenContractAddress,
          data: claim.submission.transactionData,
          value: "0x0",
        },
      });
    } catch (error) {
      await this.markSponsoredSubmissionRetryable(
        claim.submission.id,
        claim.leaseOwner,
        this.sponsoredCryptoPaymentFailureReason(error),
      );
      throw this.sponsoredCryptoPaymentUnavailable(error, {
        stage: "privy_send",
        paymentId: payment.id,
        orderId: payment.orderId ?? payment.order.id,
        userId: payment.userId,
        payerAddress: claim.submission.walletAddress,
        walletId: claim.submission.walletId,
        hasPrivyAccessToken: Boolean(input.privyAccessToken?.trim()),
        hasPrivyAuthorizationSignature: Boolean(
          input.privyAuthorizationSignature?.trim(),
        ),
      });
    }

    const checkpoint = await this.checkpointSponsoredProviderSubmission({
      submissionId: claim.submission.id,
      providerId: sponsored.providerId,
      transactionHash: sponsored.hash,
    });
    const submissionDisposition = sponsored.rawStatus
      ? classifyPrivyTransactionStatus(sponsored)
      : null;
    if (submissionDisposition?.kind === "DEFINITIVE_FAILURE") {
      const failedPayment = await this.failSponsoredCryptoPayment({
        payment,
        submission: checkpoint,
        reason: submissionDisposition.reason,
      });
      return this.requireCryptoPaymentTerminalResponse(failedPayment);
    }
    if (submissionDisposition?.kind === "AMBIGUOUS") {
      const ambiguous = await this.sponsoredSubmissionStore().markAmbiguous(
        checkpoint.id,
        submissionDisposition.reason,
      );
      this.logSponsoredSubmissionAmbiguous(ambiguous);
      return this.requireCryptoPaymentTerminalResponse({
        ...payment,
        sponsoredCryptoSubmission: ambiguous,
      });
    }
    if (checkpoint.transactionHash) {
      return this.confirmCryptoPaymentRecord(
        payment,
        checkpoint.transactionHash,
        quote,
        config,
        checkpoint.walletAddress,
      );
    }
    if (checkpoint.providerId) {
      return this.pollAndConfirmSponsoredCryptoPayment({
        sponsor,
        payment,
        submission: checkpoint,
        quote,
        config,
      });
    }

    await this.markSponsoredSubmissionAmbiguous(
      checkpoint.id,
      "provider_response_missing_checkpoint",
    );
    if (!checkpoint.transactionHash) {
      throw new ServiceUnavailableException(
        "Wallet payment outcome requires manual reconciliation. No new transfer will be sent.",
      );
    }
    throw new ServiceUnavailableException("Wallet payment is still processing");
  }

  private sponsoredCryptoPaymentUnavailable(
    error: unknown,
    context: {
      stage: "privy_send" | "privy_status";
      paymentId: string;
      orderId: string;
      userId: string;
      payerAddress: string;
      walletId: string;
      providerId?: string | null;
      rawStatus?: string | null;
      userOperationHash?: string | null;
      hasPrivyAccessToken: boolean;
      hasPrivyAuthorizationSignature: boolean;
    },
  ) {
    this.logger.warn(
      JSON.stringify({
        event: "sponsored_usdc_payment_failed",
        stage: context.stage,
        reason: this.sponsoredCryptoPaymentFailureReason(error),
        errorMessage: this.safeProviderErrorMessage(error),
        paymentId: this.shortIdentifier(context.paymentId),
        orderId: this.shortIdentifier(context.orderId),
        userId: this.shortIdentifier(context.userId),
        payerAddress: this.shortAddress(context.payerAddress),
        walletId: this.shortIdentifier(context.walletId),
        providerId: this.shortIdentifier(context.providerId),
        rawStatus: context.rawStatus ?? null,
        userOperationHash: this.shortHash(context.userOperationHash),
        hasPrivyAccessToken: context.hasPrivyAccessToken,
        hasPrivyAuthorizationSignature: context.hasPrivyAuthorizationSignature,
      }),
    );
    return new ServiceUnavailableException(
      "Wallet payment is temporarily unavailable. Try card payment or try again later.",
    );
  }

  private async directProviderSubmissionHooks(): Promise<PaymentProviderSubmissionHooks> {
    const fence = await this.outbox.captureDirectProviderMutationFence();
    return {
      beforeProviderSubmission: () =>
        this.outbox.assertDirectProviderMutationFenceCurrent(fence),
    };
  }

  private providerPaymentIntentIncomplete(payment: Payment) {
    return !(
      payment.stripePaymentIntentId?.trim() && payment.clientSecret?.trim()
    );
  }

  private async ensurePaymentIntentCreateMarker(
    tx: Prisma.TransactionClient,
    payment: Payment,
    order: {
      id: string;
      eventId: string;
      ticketTypeId: string;
      userId: string;
    },
  ) {
    const idempotencyKey = this.paymentIntentSideEffectKey(payment.id);
    const marker = await this.outbox.enqueue(tx, {
      type: "PAYMENT_INTENT_CREATE",
      idempotencyKey,
      aggregateType: "payment",
      aggregateId: payment.id,
      payload: {
        paymentId: payment.id,
        orderId: order.id,
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        userId: order.userId,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
    const payload =
      marker.payloadJson &&
      typeof marker.payloadJson === "object" &&
      !Array.isArray(marker.payloadJson)
        ? (marker.payloadJson as Prisma.JsonObject)
        : null;
    if (
      payment.currency !== "hkd" ||
      marker.type !== "PAYMENT_INTENT_CREATE" ||
      marker.idempotencyKey !== idempotencyKey ||
      marker.aggregateType !== "payment" ||
      marker.aggregateId !== payment.id ||
      !["PENDING", "RETRYING"].includes(marker.status) ||
      payload?.paymentId !== payment.id ||
      payload.orderId !== order.id ||
      payload.eventId !== order.eventId ||
      payload.ticketTypeId !== order.ticketTypeId ||
      payload.userId !== order.userId ||
      payload.amount !== payment.amount ||
      payload.currency !== payment.currency
    ) {
      throw new ServiceUnavailableException(
        "Payment authorization is awaiting a safe retry.",
      );
    }
    return marker;
  }

  private rethrowDirectProviderDispatchFence(error: unknown): never {
    if (error instanceof SideEffectDispatchFencedError) {
      throw new ServiceUnavailableException(
        "Payment processing is temporarily paused. Try again shortly.",
      );
    }
    throw error;
  }

  async requestPaymentOperation(
    input: RequestPaymentOperationInput,
    session: FanPassSession,
  ) {
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) {
      throw new BadRequestException(
        "Idempotency-Key is required for payment operations",
      );
    }

    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: {
        id: input.paymentId,
      },
      include: {
        order: true,
      },
    });
    const reason = input.reason?.trim() || input.operation;
    const sideEffectIdempotencyKey = this.paymentOperationSideEffectKey(
      input.operation,
      payment.id,
      idempotencyKey,
    );
    const job = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.sideEffectOutbox.findUnique({
        where: {
          idempotencyKey: sideEffectIdempotencyKey,
        },
      });
      if (existing) {
        return existing;
      }

      const sideEffect = await this.outbox.enqueue(tx, {
        type: this.sideEffectTypeForOperation(input.operation),
        idempotencyKey: sideEffectIdempotencyKey,
        aggregateType: "payment",
        aggregateId: payment.id,
        payload: {
          paymentId: payment.id,
          orderId: payment.orderId,
          eventId: payment.order?.eventId ?? null,
          ticketTypeId: payment.order?.ticketTypeId ?? null,
          requestedBy: session.userId,
          reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: this.auditActionForOperation(input.operation),
          entityType: "payment",
          entityId: payment.id,
          metadataJson: {
            orderId: payment.orderId,
            sideEffectId: sideEffect.id,
            sideEffectStatus: sideEffect.status,
            reason,
          },
        },
      });
      return sideEffect;
    });

    return {
      ok: true,
      payment: this.mapRedactedPayment(payment),
      sideEffect: {
        id: job.id,
        type: job.type,
        status: job.status,
        idempotencyKey: job.idempotencyKey,
      },
    };
  }

  async processCreateIntentJob(
    paymentId: string,
    providerHooks?: PaymentProviderSubmissionHooks,
  ): Promise<Prisma.InputJsonValue> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: {
        id: paymentId,
      },
      include: {
        order: {
          include: {
            event: {
              select: { status: true },
            },
          },
        },
      },
    });
    if (payment.stripePaymentIntentId && payment.clientSecret?.trim()) {
      return this.paymentJobPayload(payment);
    }
    if (!payment.order) {
      throw new BadRequestException(
        "Payment is not attached to a marketplace order",
      );
    }
    assertMarketplaceEventPublished(payment.order.event.status);
    await this.assertMarketplaceEventOpenForExternalPayment(
      payment.order.eventId,
    );
    const updated = await this.ensureProviderPaymentIntent(
      payment,
      {
        eventId: payment.order?.eventId ?? null,
        ticketTypeId: payment.order?.ticketTypeId ?? null,
      },
      payment.stripePaymentIntentId
        ? "PAYMENT_INTENT_REPAIRED"
        : "PAYMENT_INTENT_CREATED",
      providerHooks,
    );
    return this.paymentJobPayload({
      ...updated,
      order: payment.order,
    });
  }

  async processCaptureJob(
    paymentId: string,
    tradeId: string | null,
    ticketId: string,
    sideEffectIdempotencyKey?: string,
    providerHooks?: PaymentProviderSubmissionHooks,
  ): Promise<Prisma.InputJsonValue> {
    const providerTimeoutMs = this.configInteger(
      "FANPASS_STRIPE_CAPTURE_TIMEOUT_MS",
      10_000,
      1_000,
      30_000,
    );
    const transactionTimeoutMs = Math.max(
      providerTimeoutMs + 5_000,
      this.configInteger(
        "FANPASS_STRIPE_CAPTURE_TX_TIMEOUT_MS",
        20_000,
        5_000,
        60_000,
      ),
    );
    const result = await this.prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
          include: { order: true },
        });
        if (payment.captureStatus === "CAPTURED") {
          return { kind: "CAPTURED" as const, payment };
        }
        if (
          payment.captureStatus === "CANCELLED" ||
          payment.captureStatus === "REFUNDED"
        ) {
          return {
            kind: "BLOCKED" as const,
            payment,
            reason: "payment_already_compensated",
          };
        }
        if (payment.captureStatus !== "AUTHORIZED") {
          throw new BadRequestException(
            `Payment capture requires AUTHORIZED status, got ${payment.captureStatus}`,
          );
        }
        if (!payment.order) {
          throw new BadRequestException(
            "Payment is not attached to a marketplace order",
          );
        }

        const eventStatus = await lockMarketplaceEvent(
          tx,
          payment.order.eventId,
        );
        const [ticket, trade] = await Promise.all([
          tx.ticket.findUnique({ where: { id: ticketId } }),
          tradeId
            ? tx.trade.findUnique({
                where: { id: tradeId },
                include: { sellOrder: true },
              })
            : Promise.resolve(null),
        ]);
        const preconditionFailure =
          eventStatus === "PUBLISHED"
            ? this.capturePreconditionFailure({
                order: payment.order,
                ticket,
                ticketId,
                trade,
                tradeId,
              })
            : "event_not_published_before_capture";
        if (preconditionFailure) {
          await this.compensateBlockedCapture(tx, {
            payment,
            ticket,
            ticketId,
            trade,
            tradeId,
            reason: preconditionFailure,
          });
          return {
            kind: "BLOCKED" as const,
            payment,
            reason: preconditionFailure,
          };
        }

        const providerResult = providerHooks
          ? await this.captureProviderPaymentIntent(
              payment,
              sideEffectIdempotencyKey,
              providerTimeoutMs,
              providerHooks,
            )
          : await this.captureProviderPaymentIntent(
              payment,
              sideEffectIdempotencyKey,
              providerTimeoutMs,
            );
        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: providerResult.status,
            captureStatus: providerResult.captureStatus,
          },
          include: { order: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: updated.userId,
            action: "PAYMENT_CAPTURED",
            entityType: "payment",
            entityId: updated.id,
            metadataJson: {
              orderId: updated.orderId,
              tradeId,
              ticketId,
              stripePaymentIntentId: updated.stripePaymentIntentId,
              captureStatus: updated.captureStatus,
              sideEffectIdempotencyKey,
            },
          },
        });
        return { kind: "CAPTURED" as const, payment: updated };
      },
      {
        maxWait: 5_000,
        timeout: transactionTimeoutMs,
      },
    );
    if (result.kind === "BLOCKED") {
      return {
        ...(this.paymentJobPayload(result.payment) as Prisma.JsonObject),
        captureBlocked: true,
        compensationRequired: true,
        compensationReason: result.reason,
        ticketId,
        tradeId,
      };
    }
    return this.paymentJobPayload(result.payment);
  }

  private capturePreconditionFailure(input: {
    order: {
      id: string;
      userId: string;
      eventId: string;
      ticketTypeId: string;
      ticketId: string | null;
      side: string;
      status: string;
    };
    ticket: {
      id: string;
      tokenId: string | null;
      eventId: string;
      ticketTypeId: string;
      ownerId: string;
      status: string;
    } | null;
    ticketId: string;
    trade: {
      id: string;
      buyOrderId: string;
      sellOrderId: string;
      ticketId: string;
      settlementStatus: string;
      sellOrder: {
        id: string;
        eventId: string;
        ticketTypeId: string;
        ticketId: string | null;
        status: string;
      };
    } | null;
    tradeId: string | null;
  }) {
    if (input.order.side !== "BUY" || input.order.status !== "SETTLED") {
      return "capture_order_not_settled";
    }
    if (!input.ticket || input.ticket.id !== input.ticketId) {
      return "capture_ticket_missing";
    }
    if (!input.ticket.tokenId?.trim()) {
      return "capture_ticket_token_missing";
    }
    if (
      input.ticket.eventId !== input.order.eventId ||
      input.ticket.ticketTypeId !== input.order.ticketTypeId ||
      input.ticket.ownerId !== input.order.userId
    ) {
      return "capture_ticket_order_mismatch";
    }
    if (input.tradeId) {
      if (
        !input.trade ||
        input.trade.id !== input.tradeId ||
        input.trade.buyOrderId !== input.order.id ||
        input.trade.ticketId !== input.ticketId ||
        input.trade.settlementStatus !== "SETTLED" ||
        input.trade.sellOrder.status !== "SETTLED" ||
        input.trade.sellOrder.ticketId !== input.ticketId ||
        input.trade.sellOrder.eventId !== input.order.eventId ||
        input.trade.sellOrder.ticketTypeId !== input.order.ticketTypeId
      ) {
        return "capture_trade_order_mismatch";
      }
      return input.ticket.status === "TRANSFERRED"
        ? null
        : "capture_resale_ticket_not_active";
    }
    if (input.order.ticketId !== input.ticketId) {
      return "capture_primary_ticket_order_mismatch";
    }
    return input.ticket.status === "ACTIVE"
      ? null
      : "capture_primary_ticket_not_active";
  }

  private async compensateBlockedCapture(
    tx: Prisma.TransactionClient,
    input: {
      payment: Payment & {
        order: {
          id: string;
          userId: string;
          eventId: string;
          ticketTypeId: string;
          ticketId: string | null;
          fulfillmentMode: string;
        } | null;
      };
      ticket: {
        id: string;
        status: string;
      } | null;
      ticketId: string;
      trade: {
        id: string;
        buyOrderId: string;
        sellOrderId: string;
        ticketId: string;
        sellOrder?: unknown;
      } | null;
      tradeId: string | null;
      reason: string;
    },
  ) {
    const order = input.payment.order;
    if (!order) {
      throw new BadRequestException(
        "Payment is not attached to a marketplace order",
      );
    }
    const trustedPrimaryLink =
      !input.tradeId &&
      order.ticketId === input.ticketId &&
      input.ticket?.id === input.ticketId;
    const trustedResaleLink = Boolean(
      input.tradeId &&
      input.trade?.id === input.tradeId &&
      input.trade.buyOrderId === order.id &&
      input.trade.ticketId === input.ticketId &&
      input.ticket?.id === input.ticketId,
    );
    const relatedOrderIds = trustedResaleLink
      ? [order.id, input.trade!.sellOrderId]
      : [order.id];
    await tx.order.updateMany({
      where: {
        id: { in: relatedOrderIds },
        status: { in: ["OPEN", "MATCHED", "SETTLED"] },
      },
      data: { status: "REJECTED", remainingQuantity: 0 },
    });
    if (trustedPrimaryLink || trustedResaleLink) {
      await tx.ticket.updateMany({
        where: {
          id: input.ticketId,
          status: { in: ["CREATED", "ACTIVE", "TRANSFERRED"] },
        },
        data: { status: "CANCELLED" },
      });
    }
    if (trustedResaleLink) {
      await tx.trade.updateMany({
        where: {
          id: input.tradeId!,
          buyOrderId: order.id,
          ticketId: input.ticketId,
          settlementStatus: "SETTLED",
        },
        data: { settlementStatus: "FAILED" },
      });
    }
    if (!input.tradeId && this.onsaleInventory) {
      await this.onsaleInventory.releaseOrderHold(
        tx,
        order.id,
        input.reason,
        true,
      );
    }
    await this.outbox.enqueue(tx, {
      type: "PAYMENT_CANCEL_AUTHORIZATION",
      idempotencyKey: `payment-cancel:${input.payment.id}:${input.reason}`,
      aggregateType: "payment",
      aggregateId: input.payment.id,
      payload: {
        paymentId: input.payment.id,
        orderId: order.id,
        ticketId: input.ticketId,
        tradeId: input.tradeId,
        reason: input.reason,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.payment.userId,
        action: "PAYMENT_CAPTURE_BLOCKED",
        entityType: "payment",
        entityId: input.payment.id,
        metadataJson: {
          orderId: order.id,
          ticketId: input.ticketId,
          tradeId: input.tradeId,
          reason: input.reason,
          captureStatus: input.payment.captureStatus,
        },
      },
    });
  }

  async processCancelAuthorizationJob(
    paymentId: string,
    reason: string | null,
    sideEffectIdempotencyKey?: string,
    providerHooks?: PaymentProviderSubmissionHooks,
  ): Promise<Prisma.InputJsonValue> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: true },
    });
    if (payment.captureStatus === "CANCELLED") {
      return this.paymentJobPayload(payment);
    }
    if (payment.captureStatus === "CAPTURED") {
      return this.processRefundJob(
        payment.id,
        reason ?? "captured_payment",
        sideEffectIdempotencyKey,
        providerHooks,
      );
    }

    const providerResult = providerHooks
      ? await this.cancelProviderPaymentIntent(
          payment,
          sideEffectIdempotencyKey,
          providerHooks,
        )
      : await this.cancelProviderPaymentIntent(
          payment,
          sideEffectIdempotencyKey,
        );
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: providerResult.status,
        captureStatus: providerResult.captureStatus,
      },
      include: { order: true },
    });
    await this.audit.record(
      updated.userId,
      "PAYMENT_AUTHORIZATION_CANCELLED",
      "payment",
      updated.id,
      {
        orderId: updated.orderId,
        stripePaymentIntentId: updated.stripePaymentIntentId,
        captureStatus: updated.captureStatus,
        reason,
        sideEffectIdempotencyKey,
      },
    );
    return this.paymentJobPayload(updated);
  }

  async processRefundJob(
    paymentId: string,
    reason: string | null,
    sideEffectIdempotencyKey?: string,
    providerHooks?: PaymentProviderSubmissionHooks,
  ): Promise<Prisma.InputJsonValue> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: true },
    });
    if (payment.captureStatus === "REFUNDED") {
      return this.paymentJobPayload(payment);
    }
    if (payment.captureStatus !== "CAPTURED") {
      return this.processCancelAuthorizationJob(
        payment.id,
        reason ?? "refund_requested_before_capture",
        sideEffectIdempotencyKey,
        providerHooks,
      );
    }

    const providerResult = providerHooks
      ? await this.refundProviderPaymentIntent(
          payment,
          sideEffectIdempotencyKey,
          providerHooks,
        )
      : await this.refundProviderPaymentIntent(
          payment,
          sideEffectIdempotencyKey,
        );
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: providerResult.status,
        captureStatus: providerResult.captureStatus,
      },
      include: { order: true },
    });
    await this.audit.record(
      updated.userId,
      "PAYMENT_REFUNDED",
      "payment",
      updated.id,
      {
        orderId: updated.orderId,
        stripePaymentIntentId: updated.stripePaymentIntentId,
        captureStatus: updated.captureStatus,
        reason,
        sideEffectIdempotencyKey,
      },
    );
    return this.paymentJobPayload(updated);
  }

  async processReconcileJob(
    paymentId: string,
    providerHooks?: PaymentProviderSubmissionHooks,
  ): Promise<Prisma.InputJsonValue> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: true },
    });
    const providerResult = providerHooks
      ? await this.reconcileProviderPaymentIntent(payment, providerHooks)
      : await this.reconcileProviderPaymentIntent(payment);
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: providerResult.status,
        captureStatus: providerResult.captureStatus,
      },
      include: { order: true },
    });
    await this.audit.record(
      updated.userId,
      "PAYMENT_RECONCILED",
      "payment",
      updated.id,
      {
        orderId: updated.orderId,
        stripePaymentIntentId: updated.stripePaymentIntentId,
        captureStatus: updated.captureStatus,
      },
    );
    return this.paymentJobPayload(updated);
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const event = this.constructWebhookEvent(rawBody, signature);
    if (
      event.type !== "payment_intent.succeeded" &&
      event.type !== "payment_intent.payment_failed" &&
      event.type !== "payment_intent.canceled" &&
      event.type !== "payment_intent.amount_capturable_updated"
    ) {
      return {
        received: true,
        ignored: true,
        type: event.type,
      };
    }

    const stripeEventId = this.requiredWebhookEventId(event);
    const intent = event.data.object;
    const paymentMethodFingerprintHash =
      await this.paymentMethodFingerprintHashForIntent(intent);
    const result = await this.prisma.$transaction(async (tx) => {
      const webhookEvent = await this.claimWebhookEvent(tx, {
        stripeEventId,
        type: event.type,
        stripePaymentIntentId: intent.id,
        payload: {
          stripeEventId,
          type: event.type,
          paymentIntentId: intent.id,
          status: intent.status,
        },
      });
      if (!webhookEvent) {
        return {
          duplicate: true,
        };
      }

      const payment = await tx.payment.findFirst({
        where: {
          stripePaymentIntentId: intent.id,
        },
        include: {
          order: true,
        },
      });
      if (!payment) {
        await tx.paymentWebhookEvent.update({
          where: {
            stripeEventId,
          },
          data: {
            status: "IGNORED",
            reason: "payment_not_found",
            processedAt: new Date(),
          },
        });
        return {
          ignored: true,
          reason: "payment_not_found",
        };
      }

      const captureStatus = this.captureStatusForIntent(intent.status);
      const nextPayment = await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: intent.status,
          captureStatus,
          ...(paymentMethodFingerprintHash
            ? { paymentMethodFingerprintHash }
            : {}),
        },
      });
      let authorizationRejectionReason: string | null = null;
      if (captureStatus === "AUTHORIZED" && nextPayment.orderId) {
        let inventoryAuthorized = true;
        const eventStatus = payment.order
          ? await lockMarketplaceEvent(tx, payment.order.eventId)
          : null;
        if (eventStatus !== "PUBLISHED") {
          inventoryAuthorized = false;
          authorizationRejectionReason = "event_not_published";
        } else if (this.onsaleInventory) {
          const authorization = await this.onsaleInventory.authorizeOrderHold(
            tx,
            {
              orderId: nextPayment.orderId,
              paymentMethodFingerprintHash,
            },
          );
          inventoryAuthorized = authorization.authorized;
          authorizationRejectionReason = authorization.authorized
            ? null
            : authorization.reason;
          if (authorization.reason === "identity_signal_unavailable") {
            throw new ServiceUnavailableException(
              "Stripe card identity verification is temporarily unavailable",
            );
          }
        }
        if (inventoryAuthorized) {
          await this.outbox.enqueue(tx, {
            type: "ORDER_MATCH_AFTER_PAYMENT_AUTH",
            idempotencyKey: this.orderMatchAfterPaymentAuthSideEffectKey(
              nextPayment.orderId,
              nextPayment.id,
            ),
            aggregateType: "order",
            aggregateId: nextPayment.orderId,
            payload: {
              paymentId: nextPayment.id,
              orderId: nextPayment.orderId,
              stripePaymentIntentId: intent.id,
              captureStatus,
            },
          });
        } else {
          await this.rejectOnsalePaymentAuthorization(tx, {
            paymentId: nextPayment.id,
            orderId: nextPayment.orderId,
            userId: nextPayment.userId,
            reason: authorizationRejectionReason ?? "inventory_unavailable",
            primaryOnly: authorizationRejectionReason !== "event_not_published",
          });
        }
      }
      if (
        event.type === "payment_intent.canceled" &&
        nextPayment.orderId &&
        this.onsaleInventory
      ) {
        await this.onsaleInventory.releaseOrderHold(
          tx,
          nextPayment.orderId,
          "payment_authorization_cancelled",
        );
      }
      await tx.paymentWebhookEvent.update({
        where: {
          stripeEventId,
        },
        data: {
          paymentId: nextPayment.id,
          status: "PROCESSED",
          reason: authorizationRejectionReason,
          processedAt: new Date(),
        },
      });

      return {
        payment: nextPayment,
      };
    });
    if (result.duplicate) {
      return {
        received: true,
        duplicate: true,
        type: event.type,
      };
    }
    if (result.ignored || !result.payment) {
      return {
        received: true,
        ignored: true,
        type: event.type,
        reason: result.reason ?? "payment_not_found",
      };
    }

    const updated = result.payment;
    await this.audit.record(
      updated.userId,
      "PAYMENT_WEBHOOK_APPLIED",
      "payment",
      updated.id,
      {
        eventType: event.type,
        stripePaymentIntentId: intent.id,
        status: intent.status,
        captureStatus: updated.captureStatus,
      },
    );

    return {
      received: true,
      type: event.type,
      payment: this.mapRedactedPayment(updated),
    };
  }

  private async paymentMethodFingerprintHashForIntent(
    intent: StripePaymentIntentLike,
  ) {
    if (!["requires_capture", "succeeded"].includes(intent.status)) {
      return null;
    }
    const stripe = this.stripeClient();
    if (!stripe || !intent.latest_charge) {
      return null;
    }
    try {
      const charge =
        typeof intent.latest_charge === "string"
          ? await stripe.charges.retrieve(intent.latest_charge)
          : intent.latest_charge;
      if ("deleted" in charge && charge.deleted) {
        return null;
      }
      const fingerprint =
        charge.payment_method_details?.card?.fingerprint ??
        charge.payment_method_details?.card_present?.fingerprint ??
        null;
      if (!fingerprint) {
        return null;
      }
      return createHmac("sha256", this.onsaleQueueSecret())
        .update(`stripe-payment-identity:${fingerprint}`)
        .digest("hex");
    } catch {
      this.logger.warn(
        "Stripe payment identity lookup failed; queued settlement will retry instead of bypassing the card-link gate",
      );
      return null;
    }
  }

  private async createProviderPaymentIntent(
    payment: Payment,
    providerHooks?: PaymentProviderSubmissionHooks,
  ): Promise<PaymentIntentResult> {
    const stripe = this.stripeClient();
    if (!stripe) {
      if (isProductionLikeEnvironment()) {
        throw new ServiceUnavailableException("Stripe is not configured");
      }
      return {
        id: `pi_mock_${payment.id}`,
        clientSecret: `pi_mock_${payment.id}_secret_local`,
        status: "requires_payment_method",
        captureStatus: "NOT_CAPTURED",
      };
    }

    const queueManaged =
      Boolean(payment.orderId) &&
      Boolean(
        this.onsaleInventory &&
        (await this.onsaleInventory.isQueueManagedOrder(
          this.prisma,
          payment.orderId!,
        )),
      );
    await providerHooks?.beforeProviderSubmission?.();
    const intent = await stripe.paymentIntents.create(
      {
        amount: payment.amount,
        currency: payment.currency,
        capture_method: "manual",
        ...(queueManaged
          ? { payment_method_types: ["card"] }
          : {
              automatic_payment_methods: {
                enabled: true,
              },
            }),
        metadata: {
          fanpassPaymentId: payment.id,
          orderId: payment.orderId ?? "",
          userId: payment.userId,
        },
      },
      {
        idempotencyKey:
          payment.idempotencyKey ?? this.paymentIntentSideEffectKey(payment.id),
      },
    );

    return {
      id: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      captureStatus: this.captureStatusForIntent(intent.status),
    };
  }

  private async ensureProviderPaymentIntent(
    payment: Payment,
    orderContext: {
      eventId: string | null;
      ticketTypeId: string | null;
    },
    auditAction: "PAYMENT_INTENT_CREATED" | "PAYMENT_INTENT_REPAIRED",
    providerHooks?: PaymentProviderSubmissionHooks,
  ) {
    if (payment.stripePaymentIntentId && payment.clientSecret?.trim()) {
      return payment;
    }

    const providerResult = payment.stripePaymentIntentId
      ? providerHooks
        ? await this.reconcileProviderPaymentIntent(payment, providerHooks)
        : await this.reconcileProviderPaymentIntent(payment)
      : providerHooks
        ? await this.createProviderPaymentIntent(payment, providerHooks)
        : await this.createProviderPaymentIntent(payment);
    const updated = await this.prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        stripePaymentIntentId: providerResult.id,
        clientSecret: providerResult.clientSecret,
        status: providerResult.status,
        captureStatus: providerResult.captureStatus,
      },
    });
    await this.outbox.markCompleted(
      this.paymentIntentSideEffectKey(payment.id),
      {
        paymentId: updated.id,
        orderId: updated.orderId,
        eventId: orderContext.eventId,
        ticketTypeId: orderContext.ticketTypeId,
        stripePaymentIntentId: providerResult.id,
        status: providerResult.status,
        captureStatus: providerResult.captureStatus,
      },
    );
    await this.audit.record(
      updated.userId,
      auditAction,
      "payment",
      updated.id,
      {
        orderId: updated.orderId,
        amount: updated.amount,
        currency: updated.currency,
        stripePaymentIntentId: updated.stripePaymentIntentId,
        stripeMode: this.stripeConfigured() ? "stripe" : "mock",
      },
    );
    return updated;
  }

  private async captureProviderPaymentIntent(
    payment: Payment,
    sideEffectIdempotencyKey?: string,
    timeoutMs?: number,
    providerHooks?: PaymentProviderSubmissionHooks,
  ): Promise<PaymentIntentResult> {
    const stripe = this.stripeClient();
    const paymentIntentId = this.requireProviderPaymentIntentId(payment);
    if (!stripe) {
      if (isProductionLikeEnvironment()) {
        throw new ServiceUnavailableException("Stripe is not configured");
      }
      return {
        id: paymentIntentId,
        clientSecret: payment.clientSecret,
        status: "succeeded",
        captureStatus: "CAPTURED",
      };
    }

    await providerHooks?.beforeProviderSubmission?.();
    const intent = await stripe.paymentIntents.capture(
      paymentIntentId,
      {},
      {
        idempotencyKey:
          sideEffectIdempotencyKey ??
          this.paymentCaptureSideEffectKey(payment.id),
        ...(timeoutMs ? { timeout: timeoutMs } : {}),
      },
    );
    return {
      id: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      captureStatus: this.captureStatusForIntent(intent.status),
    };
  }

  private async cancelProviderPaymentIntent(
    payment: Payment,
    sideEffectIdempotencyKey?: string,
    providerHooks?: PaymentProviderSubmissionHooks,
  ): Promise<PaymentIntentResult> {
    const stripe = this.stripeClient();
    const paymentIntentId = this.requireProviderPaymentIntentId(payment);
    if (!stripe) {
      if (isProductionLikeEnvironment()) {
        throw new ServiceUnavailableException("Stripe is not configured");
      }
      return {
        id: paymentIntentId,
        clientSecret: payment.clientSecret,
        status: "canceled",
        captureStatus: "CANCELLED",
      };
    }

    await providerHooks?.beforeProviderSubmission?.();
    const intent = await stripe.paymentIntents.cancel(
      paymentIntentId,
      {},
      {
        idempotencyKey:
          sideEffectIdempotencyKey ??
          this.paymentCancelSideEffectKey(payment.id),
      },
    );
    return {
      id: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      captureStatus: this.captureStatusForIntent(intent.status),
    };
  }

  private async refundProviderPaymentIntent(
    payment: Payment,
    sideEffectIdempotencyKey?: string,
    providerHooks?: PaymentProviderSubmissionHooks,
  ): Promise<PaymentIntentResult> {
    const stripe = this.stripeClient();
    const paymentIntentId = this.requireProviderPaymentIntentId(payment);
    if (!stripe) {
      if (isProductionLikeEnvironment()) {
        throw new ServiceUnavailableException("Stripe is not configured");
      }
      return {
        id: paymentIntentId,
        clientSecret: payment.clientSecret,
        status: "refunded",
        captureStatus: "REFUNDED",
      };
    }

    await providerHooks?.beforeProviderSubmission?.();
    await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        metadata: {
          fanpassPaymentId: payment.id,
          orderId: payment.orderId ?? "",
        },
      },
      {
        idempotencyKey:
          sideEffectIdempotencyKey ??
          this.paymentRefundSideEffectKey(payment.id),
      },
    );
    return {
      id: paymentIntentId,
      clientSecret: payment.clientSecret,
      status: "refunded",
      captureStatus: "REFUNDED",
    };
  }

  private async reconcileProviderPaymentIntent(
    payment: Payment,
    providerHooks?: PaymentProviderSubmissionHooks,
  ): Promise<PaymentIntentResult> {
    const stripe = this.stripeClient();
    const paymentIntentId = this.requireProviderPaymentIntentId(payment);
    if (!stripe) {
      if (isProductionLikeEnvironment()) {
        throw new ServiceUnavailableException("Stripe is not configured");
      }
      return {
        id: paymentIntentId,
        clientSecret: payment.clientSecret,
        status: payment.status,
        captureStatus: payment.captureStatus,
      };
    }

    await providerHooks?.beforeProviderSubmission?.();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      id: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      captureStatus: this.captureStatusForIntent(intent.status),
    };
  }

  private constructWebhookEvent(
    rawBody: Buffer,
    signature: string | undefined,
  ): StripeEventLike {
    const webhookSecret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    const stripe = this.stripeClient();
    if (stripe && webhookSecret) {
      if (!signature) {
        throw new BadRequestException("Stripe signature is required");
      }
      return stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      ) as StripeEventLike;
    }
    if (isProductionLikeEnvironment()) {
      throw new ServiceUnavailableException(
        "Stripe webhook verification is not configured",
      );
    }
    return JSON.parse(rawBody.toString("utf8")) as StripeEventLike;
  }

  private async cryptoPaymentConfig() {
    const rpcUrl =
      this.nonEmptyConfig("FANPASS_WALLET_RPC_URL") ??
      this.nonEmptyConfig("TESTNET_RPC_URL") ??
      this.nonEmptyConfig("FANPASS_SEPOLIA_RPC_URL");
    const chainId =
      this.nonEmptyConfig("FANPASS_WALLET_CHAIN_ID") ??
      this.nonEmptyConfig("TESTNET_CHAIN_ID") ??
      "11155111";
    const tokenContractAddress = this.normalizeAddress(
      this.nonEmptyConfig("FANPASS_USDC_CONTRACT_ADDRESS"),
    );
    const receiverAddress = this.normalizeAddress(
      this.nonEmptyConfig("FANPASS_USDC_RECEIVER_ADDRESS") ??
        this.nonEmptyConfig("FANPASS_TREASURY_WALLET_ADDRESS") ??
        this.nonEmptyConfig("FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS"),
    );
    const decimals = this.configInteger("FANPASS_USDC_DECIMALS", 6, 0, 36);
    const hkdRate = await this.usdcHkdRate();
    const quoteTtlSeconds = this.configInteger(
      "FANPASS_USDC_QUOTE_TTL_SECONDS",
      300,
      30,
      900,
    );

    if (!rpcUrl || !tokenContractAddress || !receiverAddress) {
      throw new ServiceUnavailableException(
        "USDC checkout is not configured. Set RPC, token contract, and receiver address before testing crypto payment.",
      );
    }
    if (hkdRate.pegStatus === "blocked") {
      throw new ServiceUnavailableException(
        "USDC checkout is temporarily disabled because USDC/USD is outside the configured peg guard.",
      );
    }
    if (
      hkdRate.pegStatus === "not_checked" &&
      !this.unverifiedUsdcRateAllowed()
    ) {
      throw new ServiceUnavailableException(
        "USDC checkout is temporarily unavailable because peg verification could not be completed.",
      );
    }

    return {
      rpcUrl,
      chainId,
      tokenContractAddress,
      receiverAddress,
      decimals,
      hkdRate: hkdRate.value,
      hkdRateSource: hkdRate.source,
      hkdRateAsOf: hkdRate.asOf,
      hkdRateFetchedAt: hkdRate.fetchedAt,
      usdcUsdRate: hkdRate.usdcUsdRate,
      usdcPegStatus: hkdRate.pegStatus,
      quoteTtlSeconds,
    };
  }

  private cryptoQuoteForPayment(
    payment: Payment,
    config: Awaited<ReturnType<PaymentsService["cryptoPaymentConfig"]>>,
  ): CryptoQuote {
    const amountAtomic = this.usdcAtomicAmount(
      payment.amount,
      config.hkdRate,
      config.decimals,
    );
    const expiresAt = new Date(
      payment.createdAt.getTime() + config.quoteTtlSeconds * 1_000,
    ).toISOString();
    return {
      asset: "USDC",
      chainId: config.chainId,
      tokenContractAddress: config.tokenContractAddress,
      receiverAddress: config.receiverAddress,
      amountAtomic: amountAtomic.toString(),
      amountDecimal: this.formatUnits(amountAtomic, config.decimals),
      decimals: config.decimals,
      hkdRate: config.hkdRate.toFixed(4),
      hkdRateSource: config.hkdRateSource,
      hkdRateAsOf: config.hkdRateAsOf,
      hkdRateFetchedAt: config.hkdRateFetchedAt.toISOString(),
      usdcUsdRate:
        config.usdcUsdRate === null ? null : config.usdcUsdRate.toFixed(6),
      usdcPegStatus: config.usdcPegStatus,
      expiresAt,
      erc20TransferData: this.erc20TransferData(
        config.receiverAddress,
        amountAtomic,
      ),
    };
  }

  private async loadCryptoPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        sponsoredCryptoSubmission: true,
        order: {
          include: {
            user: true,
            event: {
              select: { status: true },
            },
          },
        },
      },
    });
    if (!payment || !payment.order) {
      throw new BadRequestException("Crypto payment is not available");
    }
    if (payment.currency !== "usdc") {
      throw new BadRequestException("Payment is not a USDC crypto quote");
    }
    return payment as CryptoPaymentWithOrder;
  }

  private cryptoPaymentTerminalResponse(payment: CryptoPaymentWithOrder) {
    const submission = payment.sponsoredCryptoSubmission;
    if (
      payment.status === "crypto_compensation_required" ||
      submission?.status === "COMPENSATION_REQUIRED"
    ) {
      return {
        ok: false,
        payment: this.mapRedactedPayment(payment),
        alreadyConfirmed: false,
        compensationRequired: true,
        compensationReason:
          submission?.lastErrorCode ?? "operations_reconciliation_required",
      };
    }
    if (submission?.status === "AMBIGUOUS") {
      return {
        ok: false,
        payment: this.mapRedactedPayment(payment),
        alreadyConfirmed: false,
        compensationRequired: false,
        ambiguous: true,
        ambiguityReason:
          submission.lastErrorCode ??
          "provider_outcome_requires_reconciliation",
      };
    }
    if (payment.status === "crypto_failed" || submission?.status === "FAILED") {
      return {
        ok: false,
        payment: this.mapRedactedPayment(payment),
        alreadyConfirmed: false,
        compensationRequired: false,
        failed: true,
        retryableCheckout: true,
        failureReason:
          submission?.lastErrorCode ?? "sponsored_transaction_failed",
      };
    }
    if (
      payment.captureStatus === "CAPTURED" &&
      payment.status === "crypto_confirmed"
    ) {
      return {
        ok: true,
        payment: this.mapRedactedPayment(payment),
        alreadyConfirmed: true,
        compensationRequired: false,
      };
    }
    if (payment.captureStatus === "CAPTURED") {
      return {
        ok: false,
        payment: this.mapRedactedPayment(payment),
        alreadyConfirmed: false,
        compensationRequired: false,
        ambiguous: true,
        ambiguityReason: "captured_crypto_payment_has_unknown_terminal_state",
      };
    }
    return null;
  }

  private requireCryptoPaymentTerminalResponse(
    payment: CryptoPaymentWithOrder,
  ) {
    const response = this.cryptoPaymentTerminalResponse(payment);
    if (!response) {
      throw new ServiceUnavailableException(
        "Crypto payment terminal state could not be resolved",
      );
    }
    return response;
  }

  private assertCryptoPaymentAccess(
    payment: Payment,
    session: FanPassSession,
    verb: "confirm" | "pay",
  ) {
    if (session.role === "FAN" && payment.userId !== session.userId) {
      throw new BadRequestException(`Fans can only ${verb} their own payments`);
    }
  }

  private async confirmCryptoPaymentRecord(
    payment: CryptoPaymentWithOrder,
    transactionHash: string,
    quote: CryptoQuote,
    config: Awaited<ReturnType<PaymentsService["cryptoPaymentConfig"]>>,
    payerAddressOverride?: string,
  ) {
    const payerAddress =
      this.normalizeAddress(payerAddressOverride) ??
      this.requireCryptoPayerAddress(payment);
    const registeredHash = this.registeredCryptoTransactionHash(payment);
    if (registeredHash && registeredHash !== transactionHash) {
      throw new BadRequestException(
        "USDC transaction is not bound to this payment",
      );
    }

    await this.assertConfirmedUsdcTransfer({
      rpcUrl: config.rpcUrl,
      transactionHash,
      tokenContractAddress: quote.tokenContractAddress,
      payerAddress,
      receiverAddress: quote.receiverAddress,
      amountAtomic: BigInt(quote.amountAtomic),
    });

    const orderId = payment.orderId ?? payment.order.id;
    const result = await this.prisma.$transaction(async (tx) => {
      const eventStatus = await lockMarketplaceEvent(tx, payment.order.eventId);
      let settlementAllowed = eventStatus === "PUBLISHED";
      let compensationReason = settlementAllowed ? null : "event_not_published";
      if (
        settlementAllowed &&
        payment.order.fulfillmentMode === "PRIMARY_ONLY"
      ) {
        const holdAuthorization =
          await this.requireOnsaleInventory().authorizeOrderHold(tx, {
            orderId,
          });
        if (!holdAuthorization.authorized) {
          settlementAllowed = false;
          compensationReason =
            holdAuthorization.reason ?? "primary_inventory_unavailable";
        }
      }
      const nextPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          stripePaymentIntentId: `crypto:${transactionHash}`,
          status: settlementAllowed
            ? "crypto_confirmed"
            : "crypto_compensation_required",
          captureStatus: "CAPTURED",
        },
      });
      if (settlementAllowed) {
        await this.outbox.enqueue(tx, {
          type: "ORDER_MATCH_AFTER_PAYMENT_AUTH",
          idempotencyKey: this.orderMatchAfterPaymentAuthSideEffectKey(
            orderId,
            payment.id,
          ),
          aggregateType: "order",
          aggregateId: orderId,
          payload: {
            paymentId: payment.id,
            orderId,
            cryptoTransactionHash: transactionHash,
            captureStatus: "CAPTURED",
          },
        });
      } else {
        await tx.order.updateMany({
          where: {
            id: orderId,
            status: { in: ["OPEN", "MATCHED"] },
          },
          data: {
            status: "REJECTED",
            remainingQuantity: 0,
          },
        });
      }
      await tx.sponsoredCryptoSubmission.updateMany({
        where: { paymentId: payment.id },
        data: {
          status: settlementAllowed ? "CONFIRMED" : "COMPENSATION_REQUIRED",
          transactionHash,
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: new Date(),
          lastErrorCode: compensationReason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: payment.userId,
          action: settlementAllowed
            ? "CRYPTO_PAYMENT_CONFIRMED"
            : "CRYPTO_PAYMENT_COMPENSATION_REQUIRED",
          entityType: "payment",
          entityId: payment.id,
          metadataJson: {
            orderId: payment.orderId,
            asset: quote.asset,
            chainId: quote.chainId,
            tokenContractAddress: quote.tokenContractAddress,
            receiverAddress: quote.receiverAddress,
            amountAtomic: quote.amountAtomic,
            transactionHash,
            compensationReason,
          },
        },
      });
      return {
        payment: nextPayment,
        compensationRequired: !settlementAllowed,
        compensationReason,
      };
    });

    await this.audit.record(
      result.payment.userId,
      "PAYMENT_WEBHOOK_APPLIED",
      "payment",
      result.payment.id,
      {
        provider: "crypto",
        orderId: result.payment.orderId,
        transactionHash,
        status: result.payment.status,
        captureStatus: result.payment.captureStatus,
        compensationRequired: result.compensationRequired,
        compensationReason: result.compensationReason,
      },
    );
    if (result.compensationRequired) {
      this.logger.error(
        JSON.stringify({
          event: "sponsored_usdc_compensation_required",
          paymentId: this.shortIdentifier(result.payment.id),
          orderId: this.shortIdentifier(result.payment.orderId),
          transactionHash: this.shortHash(transactionHash),
          reason: result.compensationReason,
        }),
      );
    }

    return {
      ok: !result.compensationRequired,
      payment: this.mapRedactedPayment(result.payment),
      transactionHash,
      compensationRequired: result.compensationRequired,
      compensationReason: result.compensationReason,
    };
  }

  private requireCryptoWalletBinding(payment: CryptoPaymentWithOrder) {
    try {
      const binding = requireVerifiedWalletBinding(
        payment.order.user,
        "USDC payer wallet",
      );
      return {
        walletId: binding.privyWalletId,
        walletAddress: binding.walletAddress,
      };
    } catch {
      throw new BadRequestException(
        "Reconnect and verify your FanPass wallet before paying with USDC",
      );
    }
  }

  private requireCryptoPayerAddress(payment: CryptoPaymentWithOrder) {
    return this.requireCryptoWalletBinding(payment).walletAddress;
  }

  private registeredCryptoTransactionHash(payment: Payment) {
    const reference = payment.stripePaymentIntentId?.trim().toLowerCase();
    if (!reference?.startsWith("crypto:")) {
      return null;
    }
    const transactionHash = reference.slice("crypto:".length);
    return /^0x[0-9a-f]{64}$/.test(transactionHash) ? transactionHash : null;
  }

  private manualCryptoConfirmationAllowed() {
    if (
      isProductionLikeEnvironment({
        NODE_ENV: this.config.get<string>("NODE_ENV") ?? process.env.NODE_ENV,
        FANPASS_ENV:
          this.config.get<string>("FANPASS_ENV") ?? process.env.FANPASS_ENV,
      })
    ) {
      return false;
    }
    return (
      this.config.get<string>("FANPASS_ALLOW_MANUAL_CRYPTO_CONFIRMATION") ===
      "true"
    );
  }

  private unverifiedUsdcRateAllowed() {
    if (
      isProductionLikeEnvironment({
        NODE_ENV: this.config.get<string>("NODE_ENV") ?? process.env.NODE_ENV,
        FANPASS_ENV:
          this.config.get<string>("FANPASS_ENV") ?? process.env.FANPASS_ENV,
      })
    ) {
      return false;
    }
    return (
      this.config.get<string>("FANPASS_ALLOW_UNVERIFIED_USDC_RATE") === "true"
    );
  }

  private async claimSponsoredCryptoSubmission(input: {
    payment: CryptoPaymentWithOrder;
    idempotencyKey: string;
    walletId: string;
    walletAddress: string;
    walletBindingVersion: number;
    walletBindingFingerprint: string;
    quote: CryptoQuote;
  }): Promise<SponsoredSubmissionAction> {
    return this.sponsoredSubmissionStore().claim({
      paymentId: input.payment.id,
      eventId: input.payment.order.eventId,
      idempotencyKey: input.idempotencyKey,
      walletId: input.walletId,
      walletAddress: input.walletAddress,
      walletBindingVersion: input.walletBindingVersion,
      walletBindingFingerprint: input.walletBindingFingerprint,
      chainId: input.quote.chainId,
      tokenContractAddress: input.quote.tokenContractAddress,
      receiverAddress: input.quote.receiverAddress,
      amountAtomic: input.quote.amountAtomic,
      tokenDecimals: input.quote.decimals,
      transactionData: input.quote.erc20TransferData,
    });
  }

  private async assertSponsoredSubmissionMaySend(input: {
    submissionId: string;
    leaseOwner: string;
    eventId: string;
  }) {
    await this.sponsoredSubmissionStore().assertMaySend(input);
  }

  private async checkpointSponsoredProviderSubmission(input: {
    submissionId: string;
    providerId?: string | null;
    transactionHash?: string | null;
  }) {
    return this.sponsoredSubmissionStore().checkpoint({
      submissionId: input.submissionId,
      providerId: input.providerId,
      transactionHash: input.transactionHash,
    });
  }

  private async pollAndConfirmSponsoredCryptoPayment(input: {
    sponsor: PrivyWalletService;
    payment: CryptoPaymentWithOrder;
    submission: SponsoredCryptoSubmission;
    quote: CryptoQuote;
    config: Awaited<ReturnType<PaymentsService["cryptoPaymentConfig"]>>;
  }) {
    const providerId = input.submission.providerId?.trim();
    if (!providerId) {
      await this.markSponsoredSubmissionAmbiguous(
        input.submission.id,
        "provider_checkpoint_missing",
      );
      throw new ServiceUnavailableException(
        "Wallet payment outcome requires manual reconciliation.",
      );
    }
    let status: Awaited<
      ReturnType<PrivyWalletService["waitForTransactionHash"]>
    >;
    try {
      status = await input.sponsor.waitForTransactionHash({
        transactionId: providerId,
        timeoutMs: this.configInteger(
          "FANPASS_PRIVY_TRANSACTION_HASH_TIMEOUT_MS",
          45_000,
          5_000,
          180_000,
        ),
      });
    } catch (error) {
      await this.prisma.sponsoredCryptoSubmission.update({
        where: { id: input.submission.id },
        data: {
          status: "PROVIDER_ACCEPTED",
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: this.sponsoredCryptoPaymentFailureReason(error),
        },
      });
      throw this.sponsoredCryptoPaymentUnavailable(error, {
        stage: "privy_status",
        paymentId: input.payment.id,
        orderId: input.payment.orderId ?? input.payment.order.id,
        userId: input.payment.userId,
        payerAddress: input.submission.walletAddress,
        walletId: input.submission.walletId,
        providerId,
        rawStatus: null,
        userOperationHash: null,
        hasPrivyAccessToken: false,
        hasPrivyAuthorizationSignature: false,
      });
    }
    const disposition = classifyPrivyTransactionStatus(status);
    if (disposition.kind === "PENDING") {
      await this.prisma.sponsoredCryptoSubmission.update({
        where: { id: input.submission.id },
        data: {
          status: "PROVIDER_ACCEPTED",
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: "provider_transaction_still_pending",
        },
      });
      throw new ServiceUnavailableException(
        "Wallet payment is still processing. Try again shortly.",
      );
    }
    if (disposition.kind === "DEFINITIVE_FAILURE") {
      const failedPayment = await this.failSponsoredCryptoPayment({
        payment: input.payment,
        submission: input.submission,
        reason: disposition.reason,
      });
      return this.requireCryptoPaymentTerminalResponse(failedPayment);
    }
    if (disposition.kind === "AMBIGUOUS") {
      const ambiguous = await this.sponsoredSubmissionStore().markAmbiguous(
        input.submission.id,
        disposition.reason,
      );
      this.logSponsoredSubmissionAmbiguous(ambiguous);
      return this.requireCryptoPaymentTerminalResponse({
        ...input.payment,
        sponsoredCryptoSubmission: ambiguous,
      });
    }
    const transactionHash = disposition.transactionHash;
    const checkpoint = await this.checkpointSponsoredProviderSubmission({
      submissionId: input.submission.id,
      providerId,
      transactionHash,
    });
    return this.confirmCryptoPaymentRecord(
      input.payment,
      transactionHash,
      input.quote,
      input.config,
      checkpoint.walletAddress,
    );
  }

  private async failSponsoredCryptoPayment(input: {
    payment: CryptoPaymentWithOrder;
    submission: SponsoredCryptoSubmission;
    reason: string;
  }) {
    const failed = await this.prisma.$transaction(async (tx) => {
      await lockMarketplaceEvent(tx, input.payment.order.eventId);
      const submission = await tx.sponsoredCryptoSubmission.update({
        where: { id: input.submission.id },
        data: {
          status: "FAILED",
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: new Date(),
          lastErrorCode: input.reason,
        },
      });
      const payment = await tx.payment.update({
        where: { id: input.payment.id },
        data: {
          status: "crypto_failed",
          captureStatus: "CANCELLED",
        },
      });
      await tx.order.updateMany({
        where: {
          id: input.payment.order.id,
          status: { in: ["OPEN", "MATCHED"] },
        },
        data: {
          status: "REJECTED",
          remainingQuantity: 0,
        },
      });
      if (input.payment.order.fulfillmentMode === "PRIMARY_ONLY") {
        await this.requireOnsaleInventory().releaseOrderHold(
          tx,
          input.payment.order.id,
          "sponsored_crypto_transaction_failed",
        );
      }
      await tx.auditLog.create({
        data: {
          actorId: input.payment.userId,
          action: "SPONSORED_CRYPTO_PAYMENT_FAILED",
          entityType: "payment",
          entityId: input.payment.id,
          metadataJson: {
            orderId: input.payment.order.id,
            providerId: input.submission.providerId,
            reason: input.reason,
          },
        },
      });
      return {
        ...payment,
        order: input.payment.order,
        sponsoredCryptoSubmission: submission,
      } as CryptoPaymentWithOrder;
    });
    await this.audit.record(
      failed.userId,
      "SPONSORED_CRYPTO_PAYMENT_FAILED",
      "payment",
      failed.id,
      {
        orderId: failed.order.id,
        providerId: input.submission.providerId,
        reason: input.reason,
      },
    );
    return failed;
  }

  private async markSponsoredSubmissionRetryable(
    submissionId: string,
    leaseOwner: string,
    reason: string,
  ) {
    await this.sponsoredSubmissionStore().markRetryable({
      submissionId,
      leaseOwner,
      reason,
    });
  }

  private async markSponsoredSubmissionAmbiguous(
    submissionId: string,
    reason: string,
  ) {
    const submission = await this.sponsoredSubmissionStore().markAmbiguous(
      submissionId,
      reason,
    );
    this.logSponsoredSubmissionAmbiguous(submission);
  }

  private logSponsoredSubmissionAmbiguous(
    submission: SponsoredCryptoSubmission,
  ) {
    this.logger.error(
      JSON.stringify({
        event: "sponsored_usdc_manual_reconciliation_required",
        submissionId: this.shortIdentifier(submission.id),
        paymentId: this.shortIdentifier(submission.paymentId),
        providerId: this.shortIdentifier(submission.providerId),
        transactionHash: this.shortHash(submission.transactionHash),
        reason: submission.lastErrorCode,
      }),
    );
  }

  private cryptoQuoteFromSubmission(
    submission: SponsoredCryptoSubmission,
    current: CryptoQuote,
  ): CryptoQuote {
    return {
      ...current,
      chainId: submission.chainId,
      tokenContractAddress: submission.tokenContractAddress,
      receiverAddress: submission.receiverAddress,
      amountAtomic: submission.amountAtomic,
      amountDecimal: this.formatUnits(
        BigInt(submission.amountAtomic),
        submission.tokenDecimals,
      ),
      decimals: submission.tokenDecimals,
      erc20TransferData: submission.transactionData,
    };
  }

  private validSponsoredTransactionHash(value: string | null | undefined) {
    return validSponsoredTransactionHash(value);
  }

  private sponsoredSubmissionStore() {
    return new SponsoredCryptoSubmissionStore(this.prisma, {
      requestHashSecret: this.onsaleQueueSecret(),
      leaseSeconds: this.configInteger(
        "FANPASS_SPONSORED_PAYMENT_LEASE_SECONDS",
        120,
        30,
        600,
      ),
    });
  }

  private async assertSufficientUsdcBalance(input: {
    rpcUrl: string;
    tokenContractAddress: string;
    payerAddress: string;
    amountAtomic: bigint;
  }) {
    const balance = await this.readErc20Balance({
      rpcUrl: input.rpcUrl,
      tokenContractAddress: input.tokenContractAddress,
      walletAddress: input.payerAddress,
    });
    if (balance < input.amountAtomic) {
      throw new BadRequestException({
        result: "INSUFFICIENT_USDC_BALANCE",
        message:
          "Your FanPass wallet does not have enough USDC for this order.",
      });
    }
  }

  private async readErc20Balance(input: {
    rpcUrl: string;
    tokenContractAddress: string;
    walletAddress: string;
  }) {
    const result = await this.rpcCall<string>(input.rpcUrl, "eth_call", [
      {
        to: input.tokenContractAddress,
        data: this.erc20BalanceOfData(input.walletAddress),
      },
      "latest",
    ]);
    if (typeof result !== "string" || !/^0x[0-9a-fA-F]+$/.test(result)) {
      throw new ServiceUnavailableException("Invalid ERC20 balance response");
    }
    return BigInt(result);
  }

  private async assertConfirmedUsdcTransfer(input: {
    rpcUrl: string;
    transactionHash: string;
    tokenContractAddress: string;
    payerAddress: string;
    receiverAddress: string;
    amountAtomic: bigint;
  }) {
    const receipt = await this.rpcCall<RpcReceipt | null>(
      input.rpcUrl,
      "eth_getTransactionReceipt",
      [input.transactionHash],
    );
    if (!receipt) {
      throw new BadRequestException(
        "USDC transaction is not confirmed on Sepolia yet",
      );
    }
    if (receipt.status !== "0x1" || !receipt.blockNumber) {
      throw new BadRequestException("USDC transaction failed or is pending");
    }

    const matchingTransfer = receipt.logs?.some((log) =>
      this.isMatchingUsdcTransferLog(log, input),
    );
    if (!matchingTransfer) {
      throw new BadRequestException(
        "USDC transaction does not contain the required FanPass transfer",
      );
    }
  }

  private isMatchingUsdcTransferLog(
    log: NonNullable<RpcReceipt["logs"]>[number],
    expected: {
      tokenContractAddress: string;
      payerAddress: string;
      receiverAddress: string;
      amountAtomic: bigint;
    },
  ) {
    const topics = log.topics ?? [];
    if (
      this.normalizeAddress(log.address) !== expected.tokenContractAddress ||
      topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC ||
      topics.length < 3
    ) {
      return false;
    }
    const from = this.addressFromTopic(topics[1]);
    const to = this.addressFromTopic(topics[2]);
    if (from !== expected.payerAddress || to !== expected.receiverAddress) {
      return false;
    }
    const value = this.bigIntFromHex(log.data);
    return value >= expected.amountAtomic;
  }

  private async rpcCall<T>(
    rpcUrl: string,
    method: string,
    params: unknown[],
  ): Promise<T> {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Chain RPC request failed with HTTP ${response.status}`,
      );
    }
    const body = (await response.json()) as {
      result?: T;
      error?: { message?: string };
    };
    if (body.error || body.result === undefined) {
      throw new ServiceUnavailableException(
        body.error?.message ?? "Chain RPC response missing result",
      );
    }
    return body.result;
  }

  private async claimWebhookEvent(
    tx: Prisma.TransactionClient,
    input: {
      stripeEventId: string;
      type: string;
      stripePaymentIntentId: string;
      payload: Prisma.InputJsonValue;
    },
  ) {
    try {
      return await tx.paymentWebhookEvent.create({
        data: {
          id: `pwe_${randomUUID()}`,
          stripeEventId: input.stripeEventId,
          type: input.type,
          stripePaymentIntentId: input.stripePaymentIntentId,
          status: "PROCESSING",
          payloadJson: input.payload,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        return null;
      }
      throw error;
    }
  }

  private stripeClient() {
    const secretKey = this.config.get<string>("STRIPE_SECRET_KEY");
    if (!secretKey) {
      return null;
    }
    return new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION as never,
    });
  }

  private stripeConfigured() {
    return Boolean(this.config.get<string>("STRIPE_SECRET_KEY"));
  }

  private prismaPaymentDataSourceEnabled() {
    return process.env.FANPASS_DATA_SOURCE === "prisma";
  }

  private requireOnsaleInventory() {
    if (!this.onsaleInventory) {
      throw new ServiceUnavailableException(
        "Primary inventory service is unavailable",
      );
    }
    return this.onsaleInventory;
  }

  private async lockPublishedMarketplaceEvent(
    tx: Prisma.TransactionClient,
    eventId: string,
  ) {
    const status = await lockMarketplaceEvent(tx, eventId);
    assertMarketplaceEventPublished(status);
    return status;
  }

  private async assertMarketplaceEventOpenForExternalPayment(eventId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockPublishedMarketplaceEvent(tx, eventId);
    });
  }

  private onsaleQueueSecret() {
    return (
      this.config.get<string>("FANPASS_ONSALE_QUEUE_SECRET") ??
      "fanpass-local-onsale-queue-secret-only"
    );
  }

  private requiredWebhookEventId(event: StripeEventLike) {
    const id = event.id?.trim();
    if (!id) {
      throw new BadRequestException("Stripe event id is required");
    }
    return id.slice(0, 255);
  }

  private isUniqueConstraint(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    );
  }

  private normalizeIdempotencyKey(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed.slice(0, 255) : null;
  }

  private validatedPrivyAuthorizationExpiry(input: {
    signature?: string;
    requestExpiry?: number;
  }) {
    const signature = input.signature?.trim();
    if (!signature && input.requestExpiry !== undefined) {
      throw new BadRequestException("Wallet payment authorization is invalid");
    }
    if (!signature) {
      return undefined;
    }
    const requestExpiry = input.requestExpiry;
    const now = Date.now();
    if (
      typeof requestExpiry !== "number" ||
      !Number.isSafeInteger(requestExpiry) ||
      requestExpiry <= now + 1_000 ||
      requestExpiry > now + 300_000
    ) {
      throw new BadRequestException("Wallet payment authorization expired");
    }
    return requestExpiry;
  }

  private amountMinor(price: number) {
    return price * 100;
  }

  private usdcAtomicAmount(
    hkdMinorAmount: number,
    hkdPerUsdc: number,
    decimals: number,
  ) {
    const multiplier = 10 ** decimals;
    return BigInt(
      Math.ceil((hkdMinorAmount * multiplier) / (hkdPerUsdc * 100)),
    );
  }

  private async usdcHkdRate(): Promise<UsdcHkdRate> {
    const configured = this.configPositiveNumberOrNull("FANPASS_USDC_HKD_RATE");
    if (configured) {
      return {
        value: configured,
        source: "configured:FANPASS_USDC_HKD_RATE",
        asOf: null,
        fetchedAt: new Date(),
        usdcUsdRate: null,
        pegStatus: "not_checked",
      };
    }

    const now = Date.now();
    if (this.usdcHkdRateCache && this.usdcHkdRateCache.expiresAt > now) {
      return this.usdcHkdRateCache.rate;
    }

    try {
      const rate = await this.fetchCoinGeckoUsdcHkdRate();
      this.usdcHkdRateCache = {
        rate,
        expiresAt:
          now +
          this.configInteger(
            "FANPASS_USDC_HKD_RATE_CACHE_SECONDS",
            900,
            60,
            86_400,
          ) *
            1_000,
      };
      return rate;
    } catch {
      try {
        const rate = await this.fetchHkmaUsdHkdRate();
        this.usdcHkdRateCache = {
          rate,
          expiresAt:
            now +
            this.configInteger(
              "FANPASS_USDC_HKD_RATE_CACHE_SECONDS",
              900,
              60,
              86_400,
            ) *
              1_000,
        };
        return rate;
      } catch {
        const fallback = this.configPositiveNumber(
          "FANPASS_USDC_HKD_RATE_FALLBACK",
          7.8355,
        );
        return {
          value: fallback,
          source: "fallback:FANPASS_USDC_HKD_RATE_FALLBACK",
          asOf: null,
          fetchedAt: new Date(),
          usdcUsdRate: null,
          pegStatus: "not_checked",
        };
      }
    }
  }

  private async fetchCoinGeckoUsdcHkdRate(): Promise<UsdcHkdRate> {
    const url =
      this.nonEmptyConfig("FANPASS_USDC_COINGECKO_PRICE_URL") ??
      COINGECKO_USDC_PRICE_URL;
    const timeoutMs = this.configInteger(
      "FANPASS_USDC_HKD_RATE_TIMEOUT_MS",
      4_000,
      500,
      15_000,
    );
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(
        `CoinGecko USDC rate request failed with HTTP ${response.status}`,
      );
    }
    const body = (await response.json()) as {
      "usd-coin"?: {
        hkd?: unknown;
        usd?: unknown;
        last_updated_at?: unknown;
      };
    };
    const quote = body["usd-coin"];
    const hkd = Number(quote?.hkd);
    const usd = Number(quote?.usd);
    if (!Number.isFinite(hkd) || hkd <= 0) {
      throw new Error("CoinGecko USDC rate response missing HKD value");
    }
    if (!Number.isFinite(usd) || usd <= 0) {
      throw new Error("CoinGecko USDC rate response missing USD value");
    }
    const lastUpdatedAt = Number(quote?.last_updated_at);
    const asOf =
      Number.isFinite(lastUpdatedAt) && lastUpdatedAt > 0
        ? new Date(lastUpdatedAt * 1_000).toISOString()
        : null;
    return {
      value: hkd,
      source: "coingecko:simple-price",
      asOf,
      fetchedAt: new Date(),
      usdcUsdRate: usd,
      pegStatus: this.usdcPegStatus(usd),
    };
  }

  private async fetchHkmaUsdHkdRate(): Promise<UsdcHkdRate> {
    const url =
      this.nonEmptyConfig("FANPASS_USDC_HKD_RATE_URL") ?? HKMA_USD_HKD_RATE_URL;
    const timeoutMs = this.configInteger(
      "FANPASS_USDC_HKD_RATE_TIMEOUT_MS",
      4_000,
      500,
      15_000,
    );
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`HKMA rate request failed with HTTP ${response.status}`);
    }
    const body = (await response.json()) as {
      header?: { success?: boolean };
      result?: {
        records?: Array<{
          end_of_day?: unknown;
          usd?: unknown;
        }>;
      };
    };
    if (body.header?.success === false) {
      throw new Error("HKMA rate response was not successful");
    }
    const record = body.result?.records?.[0];
    const value = Number(record?.usd);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("HKMA rate response missing USD/HKD value");
    }
    return {
      value,
      source: "hkma:er-eeri-daily",
      asOf: typeof record?.end_of_day === "string" ? record.end_of_day : null,
      fetchedAt: new Date(),
      usdcUsdRate: null,
      pegStatus: "not_checked",
    };
  }

  private usdcPegStatus(usdcUsdRate: number): UsdcPegStatus {
    const blockBelow = this.configPositiveNumber(
      "FANPASS_USDC_DEPEG_BLOCK_BELOW",
      0.98,
    );
    const blockAbove = this.configPositiveNumber(
      "FANPASS_USDC_DEPEG_BLOCK_ABOVE",
      1.02,
    );
    const warnBelow = this.configPositiveNumber(
      "FANPASS_USDC_DEPEG_WARN_BELOW",
      0.995,
    );
    const warnAbove = this.configPositiveNumber(
      "FANPASS_USDC_DEPEG_WARN_ABOVE",
      1.005,
    );
    if (usdcUsdRate < blockBelow || usdcUsdRate > blockAbove) {
      return "blocked";
    }
    if (usdcUsdRate < warnBelow || usdcUsdRate > warnAbove) {
      return "watch";
    }
    return "stable";
  }

  private erc20TransferData(receiverAddress: string, amountAtomic: bigint) {
    const receiver = receiverAddress.slice(2).toLowerCase().padStart(64, "0");
    const amount = amountAtomic.toString(16).padStart(64, "0");
    return `0x${ERC20_TRANSFER_SELECTOR}${receiver}${amount}`;
  }

  private erc20BalanceOfData(walletAddress: string) {
    const wallet = walletAddress.slice(2).toLowerCase().padStart(64, "0");
    return `0x${ERC20_BALANCE_OF_SELECTOR}${wallet}`;
  }

  private sponsoredCryptoPaymentFailureReason(error: unknown) {
    const message = this.safeProviderErrorMessage(error).toLowerCase();
    if (message.includes("wallet jwt exchange")) {
      return "privy_wallet_jwt_exchange_failed";
    }
    if (
      message.includes("authorization keys") ||
      message.includes("authorization key") ||
      message.includes("user signing keys")
    ) {
      return "privy_authorization_key_unavailable";
    }
    if (message.includes("policy")) {
      return "privy_policy_rejected";
    }
    if (message.includes("sponsor") || message.includes("paymaster")) {
      return "privy_sponsorship_unavailable";
    }
    if (
      message.includes("insufficient funds") ||
      message.includes("gas * price") ||
      message.includes("gas")
    ) {
      return "provider_gas_or_value_unavailable";
    }
    if (message.includes("http 401") || message.includes("unauthorized")) {
      return "privy_api_unauthorized";
    }
    if (message.includes("http 403") || message.includes("forbidden")) {
      return "privy_api_forbidden";
    }
    if (message.includes("http 429") || message.includes("rate")) {
      return "privy_api_rate_limited";
    }
    if (
      message.includes("rpc failed") ||
      message.includes("transaction lookup")
    ) {
      return "privy_rpc_failed";
    }
    return "privy_provider_failed";
  }

  private safeProviderErrorMessage(error: unknown) {
    const raw =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";
    const message = raw || "Unknown sponsored USDC payment failure";
    return message
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>")
      .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic <redacted>")
      .replace(/eyJ[A-Za-z0-9._-]+/g, "<jwt:redacted>")
      .replace(/0x[a-fA-F0-9]{64}/g, "<hash:redacted>")
      .replace(
        /0x[a-fA-F0-9]{40}/g,
        (value) => this.shortAddress(value) ?? "<address:redacted>",
      );
  }

  private shortIdentifier(value: string | null | undefined) {
    if (!value) {
      return null;
    }
    if (value.length <= 12) {
      return value;
    }
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }

  private shortAddress(value: string | null | undefined) {
    const normalized = this.normalizeAddress(value);
    if (!normalized) {
      return null;
    }
    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
  }

  private shortHash(value: string | null | undefined) {
    if (!value) {
      return null;
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
      return this.shortIdentifier(value);
    }
    return `${value.slice(0, 10)}...${value.slice(-6)}`;
  }

  private cryptoCaip2(chainId: string) {
    return chainId.startsWith("eip155:") ? chainId : `eip155:${chainId}`;
  }

  private formatUnits(value: bigint, decimals: number) {
    const base = 10n ** BigInt(decimals);
    const whole = value / base;
    const fraction = value % base;
    if (fraction === 0n) {
      return whole.toString();
    }
    const fractionText = fraction
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
    return `${whole}.${fractionText}`;
  }

  private addressFromTopic(topic: string | undefined) {
    const normalized = topic?.toLowerCase();
    if (!normalized || !/^0x[0-9a-f]{64}$/.test(normalized)) {
      return null;
    }
    return this.normalizeAddress(`0x${normalized.slice(-40)}`);
  }

  private bigIntFromHex(value: string | undefined) {
    if (!value || !/^0x[0-9a-fA-F]+$/.test(value)) {
      return 0n;
    }
    return BigInt(value);
  }

  private normalizeAddress(value: string | null | undefined) {
    const trimmed = value?.trim();
    if (!trimmed || !/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      return null;
    }
    return trimmed.toLowerCase();
  }

  private configInteger(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const value = Number(this.config.get<string>(key));
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      return fallback;
    }
    return value;
  }

  private configPositiveNumber(key: string, fallback: number) {
    return this.configPositiveNumberOrNull(key) ?? fallback;
  }

  private configPositiveNumberOrNull(key: string) {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private nonEmptyConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();
    return value ? value : null;
  }

  private assertPaymentMatchesOrder(
    payment: Payment,
    orderId: string,
    amount: number,
  ) {
    if (payment.orderId !== orderId || payment.amount !== amount) {
      throw new BadRequestException(
        "Idempotency key already belongs to another payment request",
      );
    }
  }

  private captureStatusForIntent(status: string) {
    if (status === "requires_capture") {
      return "AUTHORIZED";
    }
    if (status === "succeeded") {
      return "CAPTURED";
    }
    if (status === "canceled") {
      return "CANCELLED";
    }
    if (status === "refunded") {
      return "REFUNDED";
    }
    return "NOT_CAPTURED";
  }

  private paymentIntentSideEffectKey(paymentId: string) {
    return `payment-intent-create:${paymentId}`;
  }

  private paymentCaptureSideEffectKey(paymentId: string) {
    return `payment-capture:${paymentId}`;
  }

  private paymentCancelSideEffectKey(paymentId: string) {
    return `payment-cancel:${paymentId}`;
  }

  private paymentRefundSideEffectKey(paymentId: string) {
    return `payment-refund:${paymentId}`;
  }

  private paymentOperationSideEffectKey(
    operation: PaymentOperation,
    paymentId: string,
    idempotencyKey: string,
  ) {
    return `payment-operation:${operation}:${paymentId}:${idempotencyKey}`;
  }

  private orderMatchAfterPaymentAuthSideEffectKey(
    orderId: string,
    paymentId: string,
  ) {
    return `order-match-after-payment-auth:${orderId}:${paymentId}`;
  }

  private async rejectOnsalePaymentAuthorization(
    tx: Prisma.TransactionClient,
    input: {
      paymentId: string;
      orderId: string;
      userId: string;
      reason: string;
      primaryOnly?: boolean;
    },
  ) {
    await tx.order.updateMany({
      where: {
        id: input.orderId,
        status: { in: ["OPEN", "MATCHED"] },
        ...(input.primaryOnly === false
          ? {}
          : { fulfillmentMode: "PRIMARY_ONLY" }),
      },
      data: {
        status: "REJECTED",
        remainingQuantity: 0,
      },
    });
    if (input.reason === "event_not_published" && this.onsaleInventory) {
      await this.onsaleInventory.releaseOrderHold(
        tx,
        input.orderId,
        "event_not_published",
      );
    }
    await this.outbox.enqueue(tx, {
      type: "PAYMENT_CANCEL_AUTHORIZATION",
      idempotencyKey: `payment-cancel:${input.paymentId}:${input.reason}`,
      aggregateType: "payment",
      aggregateId: input.paymentId,
      payload: {
        paymentId: input.paymentId,
        orderId: input.orderId,
        reason: input.reason,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action:
          input.reason === "event_not_published"
            ? "PAYMENT_AUTHORIZATION_REJECTED_EVENT_CLOSED"
            : "ONSALE_PAYMENT_AUTHORIZATION_REJECTED",
        entityType: "payment",
        entityId: input.paymentId,
        metadataJson: {
          orderId: input.orderId,
          reason: input.reason,
        },
      },
    });
  }

  private sideEffectTypeForOperation(operation: PaymentOperation) {
    switch (operation) {
      case "cancel_authorization":
        return "PAYMENT_CANCEL_AUTHORIZATION";
      case "refund":
        return "PAYMENT_REFUND";
      case "reconcile":
        return "PAYMENT_RECONCILE";
    }
  }

  private auditActionForOperation(operation: PaymentOperation) {
    switch (operation) {
      case "cancel_authorization":
        return "PAYMENT_AUTHORIZATION_CANCEL_REQUESTED";
      case "refund":
        return "PAYMENT_REFUND_REQUESTED";
      case "reconcile":
        return "PAYMENT_RECONCILE_REQUESTED";
    }
  }

  private paymentJobPayload(
    payment: Payment & {
      order?: {
        eventId: string;
        ticketTypeId: string;
      } | null;
    },
  ): Prisma.InputJsonValue {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      eventId: payment.order?.eventId ?? null,
      ticketTypeId: payment.order?.ticketTypeId ?? null,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      status: payment.status,
      captureStatus: payment.captureStatus,
    };
  }

  private requireProviderPaymentIntentId(payment: Payment) {
    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException("PaymentIntent has not been created yet");
    }
    return payment.stripePaymentIntentId;
  }

  private mapPayment(payment: Payment) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      clientSecret: payment.clientSecret,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      captureStatus: payment.captureStatus,
      idempotencyKey: payment.idempotencyKey,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  private mapRedactedPayment(payment: Payment) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      captureStatus: payment.captureStatus,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }
}
