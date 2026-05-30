import {
  BadRequestException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, Payment } from "@prisma/client";
import { randomUUID } from "crypto";
import Stripe = require("stripe");
import { PrismaService } from "../../common/prisma.service";
import { FanPassSession } from "../../common/session";
import { isProductionLikeEnvironment } from "../../config/security-config";
import { AuditService } from "../audit/audit.service";
import { SideEffectOutboxService } from "../side-effects/side-effect-outbox.service";

const STRIPE_API_VERSION = "2026-02-25.clover";

export interface CreatePaymentIntentInput {
  orderId: string;
  idempotencyKey: string | undefined;
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

interface StripePaymentIntentLike {
  id: string;
  status: string;
  client_secret?: string | null;
}

interface StripeEventLike {
  id?: string;
  type: string;
  data: {
    object: StripePaymentIntentLike;
  };
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly outbox: SideEffectOutboxService,
    private readonly audit: AuditService,
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

    const existing = await this.prisma.payment.findFirst({
      where: {
        userId: order.userId,
        idempotencyKey,
      },
    });
    if (existing) {
      this.assertPaymentMatchesOrder(
        existing,
        order.id,
        this.amountMinor(order.price),
      );
      return this.mapPayment(existing);
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          id: `pay_${randomUUID()}`,
          userId: order.userId,
          orderId: order.id,
          stripePaymentIntentId: null,
          clientSecret: null,
          amount: this.amountMinor(order.price),
          currency: "hkd",
          status: "PENDING",
          captureStatus: "NOT_CAPTURED",
          idempotencyKey,
        },
      });
      await this.outbox.enqueue(tx, {
        type: "PAYMENT_INTENT_CREATE",
        idempotencyKey: this.paymentIntentSideEffectKey(created.id),
        aggregateType: "payment",
        aggregateId: created.id,
        payload: {
          paymentId: created.id,
          orderId: order.id,
          eventId: order.eventId,
          ticketTypeId: order.ticketTypeId,
          userId: order.userId,
          amount: created.amount,
          currency: created.currency,
        },
      });
      return created;
    });

    const providerResult = await this.createProviderPaymentIntent(payment);
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
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        stripePaymentIntentId: providerResult.id,
        status: providerResult.status,
        captureStatus: providerResult.captureStatus,
      },
    );
    await this.audit.record(
      updated.userId,
      "PAYMENT_INTENT_CREATED",
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

    return this.mapPayment(updated);
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
  ): Promise<Prisma.InputJsonValue> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: {
        id: paymentId,
      },
      include: {
        order: true,
      },
    });
    if (payment.stripePaymentIntentId) {
      return this.paymentJobPayload(payment);
    }
    const providerResult = await this.createProviderPaymentIntent(payment);
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
      include: {
        order: true,
      },
    });
    return this.paymentJobPayload(updated);
  }

  async processCaptureJob(
    paymentId: string,
    tradeId: string | null,
    sideEffectIdempotencyKey?: string,
  ): Promise<Prisma.InputJsonValue> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: true },
    });
    if (payment.captureStatus === "CAPTURED") {
      return this.paymentJobPayload(payment);
    }
    if (payment.captureStatus !== "AUTHORIZED") {
      throw new BadRequestException(
        `Payment capture requires AUTHORIZED status, got ${payment.captureStatus}`,
      );
    }

    const providerResult = await this.captureProviderPaymentIntent(
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
      "PAYMENT_CAPTURED",
      "payment",
      updated.id,
      {
        orderId: updated.orderId,
        tradeId,
        stripePaymentIntentId: updated.stripePaymentIntentId,
        captureStatus: updated.captureStatus,
        sideEffectIdempotencyKey,
      },
    );
    return this.paymentJobPayload(updated);
  }

  async processCancelAuthorizationJob(
    paymentId: string,
    reason: string | null,
    sideEffectIdempotencyKey?: string,
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
      );
    }

    const providerResult = await this.cancelProviderPaymentIntent(
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
      );
    }

    const providerResult = await this.refundProviderPaymentIntent(
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

  async processReconcileJob(paymentId: string): Promise<Prisma.InputJsonValue> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: true },
    });
    const providerResult = await this.reconcileProviderPaymentIntent(payment);
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
        },
      });
      if (captureStatus === "AUTHORIZED" && nextPayment.orderId) {
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
      }
      await tx.paymentWebhookEvent.update({
        where: {
          stripeEventId,
        },
        data: {
          paymentId: nextPayment.id,
          status: "PROCESSED",
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

  private async createProviderPaymentIntent(
    payment: Payment,
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

    const intent = await stripe.paymentIntents.create(
      {
        amount: payment.amount,
        currency: payment.currency,
        capture_method: "manual",
        automatic_payment_methods: {
          enabled: true,
        },
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

  private async captureProviderPaymentIntent(
    payment: Payment,
    sideEffectIdempotencyKey?: string,
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

    const intent = await stripe.paymentIntents.capture(
      paymentIntentId,
      {},
      {
        idempotencyKey:
          sideEffectIdempotencyKey ??
          this.paymentCaptureSideEffectKey(payment.id),
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

  private amountMinor(price: number) {
    return price * 100;
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
