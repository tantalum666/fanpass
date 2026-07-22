import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { DemoStore } from "../../common/demo-store";
import {
  OrderFulfillmentMode,
  OrderRecord,
  OwnershipContractRoute,
} from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import { requireVerifiedWalletBinding } from "../../common/wallet-binding";
import { requiresDurableOwnershipDispatch } from "../../config/security-config";
import { AuditService } from "../audit/audit.service";
import {
  assertMarketplaceEventPublished,
  lockMarketplaceEvent,
} from "../events/event-marketplace-policy";
import { OnsaleInventoryService } from "../onsales/onsale-inventory.service";
import { SettlementSideEffectsService } from "../side-effects/settlement-side-effects.service";
import { TicketsService } from "../tickets/tickets.service";
import {
  OrderbookRealtimeService,
  OrderbookSnapshot,
} from "./orderbook-realtime.service";

export interface CreateOrderInput {
  userId: string;
  eventId: string;
  ticketTypeId: string;
  side: "BUY" | "SELL";
  fulfillmentMode?: OrderFulfillmentMode;
  price: number;
  ticketId?: string;
  idempotencyKey?: string;
}

export interface CancelOrderInput {
  userId: string;
}

interface FinalizeOwnershipTransferInput {
  buyOrderId: string;
  sellOrderId: string;
  ticketId: string;
  ownership: {
    status: "CONFIRMED" | "PENDING" | "FAILED";
    adapter: "mock" | "testnet" | "privy";
    ownershipRef: string;
    transactionHash: string | null;
    contractRoute?: OwnershipContractRoute | null;
  };
}

interface FailOwnershipTransferInput {
  buyOrderId: string;
  sellOrderId: string;
  ticketId: string;
  reason: string;
}

class OrderClaimConflictError extends Error {}

export interface PaymentAuthorizedSettlementResult {
  orderId: string;
  ticketId: string;
  tradeId: string | null;
  fulfillmentType: "RESALE" | "PRIMARY";
  matched: boolean;
  issued: boolean;
}

@Injectable()
export class OrderbookService {
  constructor(
    private readonly store: DemoStore,
    private readonly audit: AuditService,
    private readonly settlementSideEffects: SettlementSideEffectsService,
    private readonly tickets: TicketsService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly realtime?: OrderbookRealtimeService,
    @Optional() private readonly onsaleInventory?: OnsaleInventoryService,
  ) {}

  getOrderbook(eventId: string, ticketTypeId: string) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.getPrismaOrderbook(prisma, eventId, ticketTypeId);
    }

    const event = this.store.events.find(
      (candidate) =>
        candidate.id === eventId && candidate.status === "PUBLISHED",
    );
    const ticketType = this.store.ticketTypes.find(
      (candidate) =>
        candidate.id === ticketTypeId && candidate.eventId === eventId,
    );
    if (!event || !ticketType) {
      throw new BadRequestException(
        "Event or ticket category is not available",
      );
    }
    const orders = this.store.orders.filter(
      (order) =>
        order.eventId === eventId &&
        order.ticketTypeId === ticketTypeId &&
        order.status === "OPEN",
    );
    const bids = this.aggregateLevels(
      orders.filter(
        (order) =>
          order.side === "BUY" &&
          this.allowsResaleFulfillment(order.fulfillmentMode),
      ),
      "desc",
    );
    const asks = this.aggregateLevels(
      orders.filter((order) => order.side === "SELL"),
      "asc",
    );
    const trades = this.store.trades.filter((trade) => {
      const ticket = this.store.tickets.find(
        (candidate) => candidate.id === trade.ticketId,
      );
      return (
        trade.settlementStatus === "SETTLED" &&
        ticket?.eventId === eventId &&
        ticket.ticketTypeId === ticketTypeId
      );
    });
    const priceHistory = this.publicPriceHistory(trades);
    const lastTradePrice = priceHistory.at(-1)?.price ?? null;
    const floorPrice = asks[0]?.price ?? null;
    return {
      eventId,
      ticketTypeId,
      bids,
      asks,
      lastTradePrice,
      floorPrice,
      volume: trades.length,
      premiumPercent:
        lastTradePrice === null
          ? null
          : ((lastTradePrice - ticketType.faceValue) / ticketType.faceValue) *
            100,
      priceHistory,
    };
  }

  async createOrder(input: CreateOrderInput) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.createPrismaOrder(prisma, input);
    }

    const event = this.store.getEvent(input.eventId);
    const ticketType = this.store.getTicketType(input.ticketTypeId);
    const fulfillmentMode = this.fulfillmentModeFor(input);
    const existingOrder = this.findIdempotentMemoryOrder(input);
    if (existingOrder) {
      this.assertIdempotentOrderMatches(existingOrder, input);
      return {
        order: existingOrder,
        trade: this.findMemoryTradeForOrder(existingOrder.id),
      };
    }
    assertMarketplaceEventPublished(
      event.status,
      this.marketplaceUnavailableMessage(input.side, fulfillmentMode),
    );

    if (input.price > (ticketType.resaleCap ?? Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException("Order price exceeds organizer resale cap");
    }
    if (
      input.side === "BUY" &&
      fulfillmentMode === "PRIMARY_ONLY" &&
      input.price !== ticketType.faceValue
    ) {
      throw new BadRequestException(
        "Primary checkout price must match the published face value",
      );
    }

    if (input.side === "SELL") {
      if (!input.ticketId) {
        throw new BadRequestException("Sell orders require a ticket ID");
      }
      const ticket = this.store.getTicket(input.ticketId);
      if (
        ticket.eventId !== input.eventId ||
        ticket.ticketTypeId !== input.ticketTypeId
      ) {
        throw new BadRequestException(
          "Ticket is not available for this market",
        );
      }
      if (ticket.ownerId !== input.userId) {
        throw new BadRequestException(
          "Only the ticket owner can place a sell order",
        );
      }
      this.tickets.markListedForResale(ticket.id, input.userId, input.price);
    }

    const order: OrderRecord = {
      id: `ord_${randomUUID()}`,
      userId: input.userId,
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ticketId: input.ticketId ?? null,
      side: input.side,
      fulfillmentMode: this.fulfillmentModeFor(input),
      price: input.price,
      quantity: 1,
      remainingQuantity: 1,
      status: "OPEN",
      idempotencyKey: this.normalizeIdempotencyKey(input.idempotencyKey),
      createdAt: this.store.now(),
    };
    this.store.orders.push(order);
    this.audit.record(input.userId, "ORDER_CREATED", "order", order.id, {
      side: input.side,
      price: input.price,
    });
    const trade = await this.tryMemoryMatch(order.id);
    if (!trade) {
      await this.publishOrderbookUpdate({
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        reason: "order_created",
        orderId: order.id,
      });
    }
    return {
      order,
      trade,
    };
  }

  listUserOrders(userId: string) {
    const prisma = this.prismaClient();
    if (prisma) {
      return prisma.order
        .findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        })
        .then((orders) => orders.map((order) => this.mapPrismaOrder(order)));
    }

    return this.store.orders
      .filter((order) => order.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  cancelOrder(orderId: string, input: CancelOrderInput) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.cancelPrismaOrder(prisma, orderId, input);
    }

    const order = this.store.orders.find(
      (candidate) => candidate.id === orderId,
    );
    if (!order) {
      throw new BadRequestException("Order not found");
    }
    if (order.userId !== input.userId) {
      throw new BadRequestException(
        "Only the order owner can cancel this order",
      );
    }
    if (order.status !== "OPEN") {
      throw new BadRequestException(
        `Order status ${order.status} cannot be cancelled`,
      );
    }

    order.status = "CANCELLED";
    order.remainingQuantity = 0;

    if (order.side === "SELL" && order.ticketId) {
      const ticket = this.store.getTicket(order.ticketId);
      if (ticket.status === "LISTED_FOR_RESALE") {
        ticket.status = ticket.transferCount > 0 ? "TRANSFERRED" : "ACTIVE";
      }
    }

    this.audit.record(input.userId, "ORDER_CANCELLED", "order", order.id, {
      side: order.side,
      ticketId: order.ticketId,
    });

    this.publishOrderbookUpdate({
      eventId: order.eventId,
      ticketTypeId: order.ticketTypeId,
      reason: "order_cancelled",
      orderId: order.id,
    }).catch(() => undefined);

    return order;
  }

  async tryMatch(orderId: string) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.tryPrismaMatch(prisma, orderId);
    }

    return this.tryMemoryMatch(orderId);
  }

  async settleAfterPaymentAuthorization(
    orderId: string,
  ): Promise<PaymentAuthorizedSettlementResult | null> {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.settlePrismaAfterPaymentAuthorization(prisma, orderId);
    }

    const trade = await this.tryMemoryMatch(orderId, {
      skipPaymentAuthorizationGate: true,
    });
    if (trade) {
      return {
        orderId,
        ticketId: trade.ticketId,
        tradeId: trade.id,
        fulfillmentType: "RESALE",
        matched: true,
        issued: false,
      };
    }
    return this.issuePrimaryMemoryTicketForAuthorizedBuy(orderId);
  }

  async finalizeOwnershipTransfer(input: FinalizeOwnershipTransferInput) {
    if (input.ownership.status !== "CONFIRMED") {
      throw new BadRequestException(
        "Ownership transfer must be confirmed before settlement",
      );
    }
    const prisma = this.prismaClient();
    if (!prisma) {
      throw new BadRequestException(
        "Ownership settlement finalization requires Prisma persistence",
      );
    }

    const settledTrade = await prisma.$transaction(async (tx) => {
      const existing = await tx.trade.findUnique({
        where: { buyOrderId: input.buyOrderId },
      });
      if (existing) {
        if (
          existing.sellOrderId !== input.sellOrderId ||
          existing.ticketId !== input.ticketId
        ) {
          throw new BadRequestException(
            "Ownership settlement does not match the existing trade",
          );
        }
        return this.mapPrismaTrade(existing);
      }
      const existingSellTrade = await tx.trade.findUnique({
        where: { sellOrderId: input.sellOrderId },
      });
      if (existingSellTrade) {
        throw new BadRequestException(
          "Sell order has already settled with another buyer",
        );
      }

      const [buyOrder, sellOrder, ticket] = await Promise.all([
        tx.order.findUnique({
          where: { id: input.buyOrderId },
        }),
        tx.order.findUnique({
          where: { id: input.sellOrderId },
        }),
        tx.ticket.findUnique({
          where: { id: input.ticketId },
          include: { ticketType: true },
        }),
      ]);
      if (
        !buyOrder ||
        !sellOrder ||
        !ticket ||
        buyOrder.status !== "MATCHED" ||
        sellOrder.status !== "MATCHED" ||
        ticket.status !== "TRANSFER_PENDING"
      ) {
        throw new ConflictException(
          "Confirmed ownership transfer requires settlement reconciliation",
        );
      }
      this.assertResaleSettlementIntegrity(buyOrder, sellOrder, ticket);

      const [ticketUpdate, buyUpdate, sellUpdate] = await Promise.all([
        tx.ticket.updateMany({
          where: {
            id: ticket.id,
            status: "TRANSFER_PENDING",
          },
          data: {
            ownerId: buyOrder.userId,
            transferCount: ticket.transferCount + 1,
            status: "TRANSFERRED",
          },
        }),
        tx.order.updateMany({
          where: { id: input.buyOrderId, status: "MATCHED" },
          data: { status: "SETTLED", remainingQuantity: 0 },
        }),
        tx.order.updateMany({
          where: { id: input.sellOrderId, status: "MATCHED" },
          data: { status: "SETTLED", remainingQuantity: 0 },
        }),
      ]);
      if (
        ticketUpdate.count !== 1 ||
        buyUpdate.count !== 1 ||
        sellUpdate.count !== 1
      ) {
        throw new BadRequestException(
          "Ownership settlement finalization lost its matched order claim",
        );
      }

      const trade = await tx.trade.create({
        data: {
          id: `trd_${randomUUID()}`,
          buyOrderId: input.buyOrderId,
          sellOrderId: input.sellOrderId,
          ticketId: ticket.id,
          price: sellOrder.price,
          fee: Math.round(sellOrder.price * 0.03),
          settlementStatus: "SETTLED",
        },
      });
      await this.enqueuePaymentCaptureForTrade(
        tx,
        input.buyOrderId,
        trade.id,
        ticket.id,
      );
      await tx.auditLog.create({
        data: {
          actorId: buyOrder.userId,
          action: "TRADE_SETTLED",
          entityType: "trade",
          entityId: trade.id,
          metadataJson: {
            ticketId: ticket.id,
            price: sellOrder.price,
            ownershipAdapter: input.ownership.adapter,
            ownershipRef: input.ownership.ownershipRef,
            transactionHash: input.ownership.transactionHash,
            contractRoute: input.ownership.contractRoute,
          },
        },
      });
      return this.mapPrismaTrade(trade);
    });
    if (settledTrade) {
      const buyOrder = await prisma.order.findUnique({
        where: { id: input.buyOrderId },
      });
      if (buyOrder) {
        await this.publishOrderbookUpdate({
          eventId: buyOrder.eventId,
          ticketTypeId: buyOrder.ticketTypeId,
          reason: "trade_settled",
          orderId: buyOrder.id,
          tradeId: settledTrade.id,
        });
      }
    }
    return settledTrade;
  }

  async failOwnershipTransfer(input: FailOwnershipTransferInput) {
    const prisma = this.prismaClient();
    if (!prisma) {
      throw new BadRequestException(
        "Ownership settlement failure handling requires Prisma persistence",
      );
    }
    return prisma.$transaction(async (tx) => {
      const [buyOrder, ticket] = await Promise.all([
        tx.order.findUnique({ where: { id: input.buyOrderId } }),
        tx.ticket.findUnique({ where: { id: input.ticketId } }),
      ]);
      await tx.order.updateMany({
        where: {
          id: { in: [input.buyOrderId, input.sellOrderId] },
          status: "MATCHED",
        },
        data: { status: "REJECTED", remainingQuantity: 0 },
      });
      if (ticket) {
        await tx.ticket.updateMany({
          where: { id: ticket.id, status: "TRANSFER_PENDING" },
          data: {
            status: ticket.transferCount > 0 ? "TRANSFERRED" : "ACTIVE",
          },
        });
      }
      if (buyOrder) {
        await tx.auditLog.create({
          data: {
            actorId: buyOrder.userId,
            action: "TRADE_SETTLEMENT_FAILED",
            entityType: "order",
            entityId: input.buyOrderId,
            metadataJson: {
              sellOrderId: input.sellOrderId,
              ticketId: input.ticketId,
              message: input.reason,
            },
          },
        });
      }
      await this.enqueuePaymentCompensationForFailedSettlement(
        tx,
        input.buyOrderId,
        "ownership_transfer_failed",
      );
      return { failed: true };
    });
  }

  async finalizePrimaryOwnershipIssue(
    ticketId: string,
  ): Promise<PaymentAuthorizedSettlementResult | null> {
    const prisma = this.prismaClient();
    if (!prisma) {
      throw new BadRequestException(
        "Primary ownership finalization requires Prisma persistence",
      );
    }

    const finalized = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) {
        throw new BadRequestException("Primary ticket is not available");
      }
      const order = await tx.order.findFirst({
        where: {
          ticketId,
          side: "BUY",
          fulfillmentMode: { in: ["ANY", "PRIMARY_ONLY"] },
        },
      });
      if (!order) {
        return null;
      }
      if (order.status === "SETTLED") {
        if (ticket.status !== "ACTIVE" || !ticket.tokenId) {
          throw new ConflictException(
            "Settled primary order is missing confirmed ownership",
          );
        }
        return this.primarySettlementResult(order.id, ticket.id, true);
      }
      if (order.status === "REJECTED" || order.status === "CANCELLED") {
        return null;
      }
      if (
        order.status !== "MATCHED" ||
        ticket.status !== "ACTIVE" ||
        !ticket.tokenId
      ) {
        throw new ConflictException(
          "Primary ownership must be confirmed before settlement",
        );
      }
      if (
        ticket.ownerId !== order.userId ||
        ticket.eventId !== order.eventId ||
        ticket.ticketTypeId !== order.ticketTypeId
      ) {
        throw new ConflictException(
          "Primary ticket does not match its authorized order",
        );
      }

      const eventStatus = await lockMarketplaceEvent(tx, order.eventId);
      if (eventStatus !== "PUBLISHED") {
        await this.failPrimaryOwnershipIssueInTransaction(
          tx,
          order,
          ticket,
          "primary_event_closed_after_ownership_confirmation",
        );
        return null;
      }

      const paymentReady = await this.enqueuePaymentCaptureForPrimaryTicket(
        tx,
        order.id,
        ticket.id,
      );
      if (!paymentReady) {
        await this.failPrimaryOwnershipIssueInTransaction(
          tx,
          order,
          ticket,
          "primary_payment_authorization_missing",
        );
        return null;
      }

      const claim = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "MATCHED",
          side: "BUY",
          ticketId,
        },
        data: { status: "SETTLED", remainingQuantity: 0 },
      });
      if (claim.count !== 1) {
        throw new ConflictException(
          "Primary ownership finalization lost its matched order claim",
        );
      }
      await tx.auditLog.create({
        data: {
          actorId: order.userId,
          action: "ORDER_PRIMARY_TICKET_ISSUED",
          entityType: "order",
          entityId: order.id,
          metadataJson: {
            ticketId: ticket.id,
            tokenId: ticket.tokenId,
            eventId: order.eventId,
            ticketTypeId: order.ticketTypeId,
            price: order.price,
          },
        },
      });
      return this.primarySettlementResult(order.id, ticket.id, true);
    });

    if (finalized) {
      const order = await prisma.order.findUnique({
        where: { id: finalized.orderId },
      });
      if (order) {
        await this.publishOrderbookUpdate({
          eventId: order.eventId,
          ticketTypeId: order.ticketTypeId,
          reason: "primary_ticket_issued",
          orderId: order.id,
        });
      }
    }
    return finalized;
  }

  async failPrimaryOwnershipIssue(ticketId: string, error?: unknown) {
    const prisma = this.prismaClient();
    if (!prisma) {
      throw new BadRequestException(
        "Primary ownership failure handling requires Prisma persistence",
      );
    }
    const reason = this.primaryOwnershipFailureReason(error);
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) {
        return null;
      }
      const order = await tx.order.findFirst({
        where: {
          ticketId,
          side: "BUY",
          fulfillmentMode: { in: ["ANY", "PRIMARY_ONLY"] },
        },
      });
      if (!order) {
        return null;
      }
      if (order.status === "SETTLED") {
        throw new ConflictException(
          "A settled primary order cannot be failed as unconfirmed",
        );
      }
      if (order.status === "REJECTED" && ticket.status === "CANCELLED") {
        return { failed: true };
      }
      const failed = await this.failPrimaryOwnershipIssueInTransaction(
        tx,
        order,
        ticket,
        "primary_ticket_issue_failed",
        reason,
      );
      return failed ? { failed: true } : null;
    });
  }

  private async tryMemoryMatch(
    orderId: string,
    options: { skipPaymentAuthorizationGate?: boolean } = {},
  ) {
    const incoming = this.store.orders.find((order) => order.id === orderId);
    if (!incoming || incoming.status !== "OPEN") {
      return null;
    }
    assertMarketplaceEventPublished(
      this.store.getEvent(incoming.eventId).status,
    );
    if (
      this.requiresPaymentAuthorization() &&
      !options.skipPaymentAuthorizationGate
    ) {
      return null;
    }

    if (incoming.side === "BUY") {
      if (!this.allowsResaleFulfillment(incoming.fulfillmentMode)) {
        return null;
      }
      const ask = this.store.orders
        .filter(
          (order) =>
            order.status === "OPEN" &&
            order.side === "SELL" &&
            order.eventId === incoming.eventId &&
            order.ticketTypeId === incoming.ticketTypeId &&
            order.price <= incoming.price,
        )
        .sort(
          (left, right) =>
            left.price - right.price ||
            left.createdAt.localeCompare(right.createdAt),
        )[0];
      return ask ? this.settle(incoming.id, ask.id, ask.price) : null;
    }

    const bid = this.store.orders
      .filter(
        (order) =>
          order.status === "OPEN" &&
          order.side === "BUY" &&
          order.eventId === incoming.eventId &&
          order.ticketTypeId === incoming.ticketTypeId &&
          this.allowsResaleFulfillment(order.fulfillmentMode) &&
          order.price >= incoming.price,
      )
      .sort(
        (left, right) =>
          right.price - left.price ||
          left.createdAt.localeCompare(right.createdAt),
      )[0];
    return bid ? this.settle(bid.id, incoming.id, incoming.price) : null;
  }

  private async issuePrimaryMemoryTicketForAuthorizedBuy(
    orderId: string,
  ): Promise<PaymentAuthorizedSettlementResult | null> {
    const order = this.store.orders.find(
      (candidate) => candidate.id === orderId,
    );
    if (!order || order.side !== "BUY") {
      return null;
    }
    if (order.status === "SETTLED" && order.ticketId) {
      return {
        orderId: order.id,
        ticketId: order.ticketId,
        tradeId: null,
        fulfillmentType: "PRIMARY",
        matched: false,
        issued: true,
      };
    }
    if (order.status !== "OPEN") {
      return null;
    }
    if (!this.allowsPrimaryFulfillment(order.fulfillmentMode)) {
      order.status = "REJECTED";
      order.remainingQuantity = 0;
      this.audit.record(
        order.userId,
        "RESALE_ORDER_UNAVAILABLE",
        "order",
        order.id,
        {
          eventId: order.eventId,
          ticketTypeId: order.ticketTypeId,
          price: order.price,
        },
      );
      await this.publishOrderbookUpdate({
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        reason: "order_rejected",
        orderId: order.id,
      });
      return null;
    }

    const ticket = await this.tickets.issueTicket({
      eventId: order.eventId,
      ticketTypeId: order.ticketTypeId,
      ownerId: order.userId,
      seatHash: `primary-order:${order.id}`,
    });

    const ownershipConfirmed =
      ticket.status === "ACTIVE" && Boolean(ticket.tokenId);
    order.status = ownershipConfirmed ? "SETTLED" : "MATCHED";
    order.remainingQuantity = ownershipConfirmed ? 0 : order.remainingQuantity;
    order.ticketId = ticket.id;
    this.audit.record(
      order.userId,
      ownershipConfirmed
        ? "ORDER_PRIMARY_TICKET_ISSUED"
        : "ORDER_PRIMARY_TICKET_PENDING",
      "order",
      order.id,
      {
        ticketId: ticket.id,
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        price: order.price,
      },
    );
    await this.publishOrderbookUpdate({
      eventId: order.eventId,
      ticketTypeId: order.ticketTypeId,
      reason: ownershipConfirmed
        ? "primary_ticket_issued"
        : "primary_ticket_pending",
      orderId: order.id,
    });

    return {
      orderId: order.id,
      ticketId: ticket.id,
      tradeId: null,
      fulfillmentType: "PRIMARY",
      matched: !ownershipConfirmed,
      issued: ownershipConfirmed,
    };
  }

  private async settle(buyOrderId: string, sellOrderId: string, price: number) {
    const buyOrder = this.store.orders.find((order) => order.id === buyOrderId);
    const sellOrder = this.store.orders.find(
      (order) => order.id === sellOrderId,
    );
    if (!buyOrder || !sellOrder || !sellOrder.ticketId) {
      throw new BadRequestException("Cannot settle invalid order pair");
    }
    this.assertSynchronousOwnershipSettlementAllowed();
    assertMarketplaceEventPublished(
      this.store.getEvent(buyOrder.eventId).status,
    );
    const ticket = this.store.getTicket(sellOrder.ticketId);
    const seller = this.store.users.find((user) => user.id === ticket.ownerId);
    const buyer = this.store.users.find((user) => user.id === buyOrder.userId);
    if (!seller || !buyer) {
      throw new BadRequestException(
        "Cannot settle ownership transfer without both users",
      );
    }
    const sellerWallet = requireVerifiedWalletBinding(
      seller,
      "Ticket seller wallet",
    );
    const buyerWallet = requireVerifiedWalletBinding(
      buyer,
      "Ticket buyer wallet",
    );

    buyOrder.status = "MATCHED";
    sellOrder.status = "MATCHED";
    ticket.status = "TRANSFER_PENDING";
    this.audit.record(buyOrder.userId, "ORDER_MATCHED", "order", buyOrder.id, {
      sellOrderId,
      ticketId: ticket.id,
      price,
    });

    const ownership = await this.settlementSideEffects.transferOwnership({
      ticketId: ticket.id,
      tokenId: ticket.tokenId,
      fromOwnerId: seller.id,
      fromWalletAddress: sellerWallet.walletAddress,
      fromWalletBindingVersion: sellerWallet.walletBindingVersion,
      fromWalletBindingFingerprint: sellerWallet.walletBindingFingerprint,
      toOwnerId: buyer.id,
      toWalletAddress: buyerWallet.walletAddress,
      toWalletBindingVersion: buyerWallet.walletBindingVersion,
      toWalletBindingFingerprint: buyerWallet.walletBindingFingerprint,
      contractRoute: this.ticketContractRoute(ticket),
    });
    ticket.ownerId = buyOrder.userId;
    ticket.transferCount += 1;
    ticket.status = "TRANSFERRED";

    buyOrder.status = "SETTLED";
    buyOrder.remainingQuantity = 0;
    sellOrder.status = "SETTLED";
    sellOrder.remainingQuantity = 0;

    const trade = {
      id: `trd_${randomUUID()}`,
      buyOrderId,
      sellOrderId,
      ticketId: ticket.id,
      price,
      fee: Math.round(price * 0.03),
      settlementStatus: "SETTLED" as const,
      createdAt: this.store.now(),
    };
    this.store.trades.unshift(trade);
    this.audit.record(buyOrder.userId, "TRADE_SETTLED", "trade", trade.id, {
      ticketId: ticket.id,
      price,
      ownershipAdapter: ownership.adapter,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
      contractRoute: ownership.contractRoute,
    });
    await this.publishOrderbookUpdate({
      eventId: buyOrder.eventId,
      ticketTypeId: buyOrder.ticketTypeId,
      reason: "trade_settled",
      orderId: buyOrder.id,
      tradeId: trade.id,
    });
    return trade;
  }

  private aggregateLevels(
    orders: { price: number; remainingQuantity: number }[],
    direction: "asc" | "desc",
  ) {
    const levels = new Map<number, number>();
    for (const order of orders) {
      levels.set(
        order.price,
        (levels.get(order.price) ?? 0) + order.remainingQuantity,
      );
    }
    return [...levels.entries()]
      .map(([price, quantity]) => ({ price, quantity }))
      .sort((left, right) =>
        direction === "asc"
          ? left.price - right.price
          : right.price - left.price,
      )
      .slice(0, 10);
  }

  private publicPriceHistory(
    trades: { price: number; createdAt: string | Date }[],
  ) {
    return trades
      .map((trade) => ({
        price: trade.price,
        tradedAt:
          trade.createdAt instanceof Date
            ? trade.createdAt.toISOString()
            : new Date(trade.createdAt).toISOString(),
      }))
      .sort((left, right) => left.tradedAt.localeCompare(right.tradedAt))
      .slice(-120);
  }

  private async getPrismaOrderbook(
    prisma: PrismaService,
    eventId: string,
    ticketTypeId: string,
  ) {
    const ticketType = await prisma.ticketType.findFirst({
      where: {
        id: ticketTypeId,
        eventId,
        event: {
          status: "PUBLISHED",
        },
      },
    });
    if (!ticketType) {
      throw new BadRequestException(
        "Event or ticket category is not available",
      );
    }
    const [orders, trades] = await Promise.all([
      prisma.order.findMany({
        where: {
          eventId,
          ticketTypeId,
          status: "OPEN",
        },
      }),
      prisma.trade.findMany({
        where: {
          settlementStatus: "SETTLED",
          ticket: {
            eventId,
            ticketTypeId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 120,
      }),
    ]);
    const bids = this.aggregateLevels(
      orders.filter(
        (order) =>
          order.side === "BUY" &&
          this.allowsResaleFulfillment(order.fulfillmentMode),
      ),
      "desc",
    );
    const asks = this.aggregateLevels(
      orders.filter((order) => order.side === "SELL"),
      "asc",
    );
    const priceHistory = this.publicPriceHistory(trades);
    const lastTradePrice = priceHistory.at(-1)?.price ?? null;
    const floorPrice = asks[0]?.price ?? null;
    return {
      eventId,
      ticketTypeId,
      bids,
      asks,
      lastTradePrice,
      floorPrice,
      volume: trades.length,
      premiumPercent:
        lastTradePrice === null
          ? null
          : ((lastTradePrice - ticketType.faceValue) / ticketType.faceValue) *
            100,
      priceHistory,
    };
  }

  private async createPrismaOrder(
    prisma: PrismaService,
    input: CreateOrderInput,
  ) {
    const [event, ticketType] = await Promise.all([
      prisma.event.findUnique({ where: { id: input.eventId } }),
      prisma.ticketType.findUnique({
        where: { id: input.ticketTypeId },
      }),
    ]);
    if (!event) {
      throw new BadRequestException("Event is not available for checkout");
    }
    if (!ticketType || ticketType.eventId !== input.eventId) {
      throw new BadRequestException(
        "Ticket category is not available for checkout",
      );
    }
    const fulfillmentMode = this.fulfillmentModeFor(input);
    const existingOrder = await this.findIdempotentPrismaOrder(prisma, input);
    if (existingOrder) {
      const mappedOrder = this.mapPrismaOrder(existingOrder);
      this.assertIdempotentOrderMatches(mappedOrder, input);
      return {
        order: mappedOrder,
        trade: await this.findPrismaTradeForOrder(prisma, existingOrder.id),
      };
    }
    assertMarketplaceEventPublished(
      event.status,
      this.marketplaceUnavailableMessage(input.side, fulfillmentMode),
    );

    if (input.price > (ticketType.resaleCap ?? Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException("Order price exceeds organizer resale cap");
    }
    if (
      input.side === "BUY" &&
      fulfillmentMode === "PRIMARY_ONLY" &&
      input.price !== ticketType.faceValue
    ) {
      throw new BadRequestException(
        "Primary checkout price must match the published face value",
      );
    }

    if (input.side === "SELL") {
      if (!input.ticketId) {
        throw new BadRequestException("Sell orders require a ticket ID");
      }
      const ticket = await prisma.ticket.findUnique({
        where: { id: input.ticketId },
      });
      this.assertSellOrderTicket(ticket, ticketType, input);
    }

    const orderId = `ord_${randomUUID()}`;
    const orderData = {
      id: orderId,
      userId: input.userId,
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ticketId: input.ticketId ?? null,
      side: input.side,
      fulfillmentMode,
      price: input.price,
      quantity: 1,
      remainingQuantity: 1,
      status: "OPEN" as const,
      idempotencyKey: this.normalizeIdempotencyKey(input.idempotencyKey),
    };
    const primaryOnlyBuy =
      input.side === "BUY" && fulfillmentMode === "PRIMARY_ONLY";
    let order;
    try {
      order = primaryOnlyBuy
        ? await prisma.$transaction(async (tx) => {
            await this.requireOnsaleInventory().lockPrimaryOrderCreation(
              tx,
              input.ticketTypeId,
            );
            const eventStatus = await lockMarketplaceEvent(tx, input.eventId);
            assertMarketplaceEventPublished(
              eventStatus,
              "Event is not available for checkout",
            );
            const created = await tx.order.create({ data: orderData });
            await this.requireOnsaleInventory().reservePrimaryInventory(tx, {
              orderId: created.id,
              eventId: created.eventId,
              ticketTypeId: created.ticketTypeId,
              userId: created.userId,
              quantity: created.quantity,
            });
            await tx.auditLog.create({
              data: {
                actorId: input.userId,
                action: "ORDER_CREATED",
                entityType: "order",
                entityId: created.id,
                metadataJson: {
                  side: input.side,
                  price: input.price,
                  fulfillmentMode,
                },
              },
            });
            return created;
          })
        : await prisma.$transaction(async (tx) => {
            const eventStatus = await lockMarketplaceEvent(tx, input.eventId);
            assertMarketplaceEventPublished(eventStatus);

            if (input.side === "SELL") {
              const ticket = await tx.ticket.findUnique({
                where: { id: input.ticketId! },
              });
              this.assertSellOrderTicket(ticket, ticketType, input);
              const ticketClaim = await tx.ticket.updateMany({
                where: {
                  id: ticket.id,
                  ownerId: input.userId,
                  status: { in: ["ACTIVE", "TRANSFERRED"] },
                },
                data: { status: "LISTED_FOR_RESALE" },
              });
              if (ticketClaim.count !== 1) {
                throw new ConflictException(
                  "Ticket is no longer available for resale",
                );
              }
              await tx.auditLog.create({
                data: {
                  actorId: input.userId,
                  action: "TICKET_LISTED_FOR_RESALE",
                  entityType: "ticket",
                  entityId: ticket.id,
                  metadataJson: {
                    orderPrice: input.price,
                  },
                },
              });
            }

            const created = await tx.order.create({ data: orderData });
            await tx.auditLog.create({
              data: {
                actorId: input.userId,
                action: "ORDER_CREATED",
                entityType: "order",
                entityId: created.id,
                metadataJson: {
                  side: input.side,
                  price: input.price,
                  fulfillmentMode,
                },
              },
            });
            return created;
          });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        this.normalizeIdempotencyKey(input.idempotencyKey)
      ) {
        const concurrentOrder = await this.findIdempotentPrismaOrder(
          prisma,
          input,
        );
        if (concurrentOrder) {
          const mappedOrder = this.mapPrismaOrder(concurrentOrder);
          this.assertIdempotentOrderMatches(mappedOrder, input);
          return {
            order: mappedOrder,
            trade: await this.findPrismaTradeForOrder(
              prisma,
              concurrentOrder.id,
            ),
          };
        }
      }
      throw error;
    }
    const trade = await this.tryPrismaMatch(prisma, order.id);
    if (!trade) {
      await this.publishOrderbookUpdate({
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        reason: "order_created",
        orderId: order.id,
      });
    }
    return {
      order: this.mapPrismaOrder(order),
      trade,
    };
  }

  private async cancelPrismaOrder(
    prisma: PrismaService,
    orderId: string,
    input: CancelOrderInput,
  ) {
    const cancelled = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new BadRequestException("Order not found");
      }
      if (order.userId !== input.userId) {
        throw new BadRequestException(
          "Only the order owner can cancel this order",
        );
      }
      if (order.status !== "OPEN") {
        throw new BadRequestException(
          `Order status ${order.status} cannot be cancelled`,
        );
      }

      const claim = await tx.order.updateMany({
        where: {
          id: order.id,
          userId: input.userId,
          status: "OPEN",
        },
        data: {
          status: "CANCELLED",
          remainingQuantity: 0,
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException("Order is no longer open and cancellable");
      }
      const cancelled = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
      });

      if (order.side === "BUY" && order.fulfillmentMode === "PRIMARY_ONLY") {
        await this.requireOnsaleInventory().releaseOrderHold(
          tx,
          order.id,
          "order_cancelled",
        );
        await this.enqueuePaymentCompensationForFailedSettlement(
          tx,
          order.id,
          "order_cancelled",
        );
      }

      if (order.side === "SELL" && order.ticketId) {
        const ticket = await tx.ticket.findUniqueOrThrow({
          where: { id: order.ticketId },
        });
        if (ticket.status === "LISTED_FOR_RESALE") {
          await tx.ticket.updateMany({
            where: { id: ticket.id, status: "LISTED_FOR_RESALE" },
            data: {
              status: ticket.transferCount > 0 ? "TRANSFERRED" : "ACTIVE",
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: input.userId,
          action: "ORDER_CANCELLED",
          entityType: "order",
          entityId: order.id,
          metadataJson: {
            side: order.side,
            ticketId: order.ticketId,
          },
        },
      });

      return this.mapPrismaOrder(cancelled);
    });
    await this.publishOrderbookUpdate({
      eventId: cancelled.eventId,
      ticketTypeId: cancelled.ticketTypeId,
      reason: "order_cancelled",
      orderId: cancelled.id,
    });
    return cancelled;
  }

  private async tryPrismaMatch(prisma: PrismaService, orderId: string) {
    const incoming = await prisma.order.findUnique({ where: { id: orderId } });
    if (!incoming || incoming.status !== "OPEN") {
      return null;
    }
    const paymentAuthorizationRequired = this.requiresPaymentAuthorization();

    if (incoming.side === "BUY") {
      if (!this.allowsResaleFulfillment(incoming.fulfillmentMode)) {
        return null;
      }
      if (
        paymentAuthorizationRequired &&
        !(await this.hasAuthorizedPaymentForOrder(prisma, incoming.id))
      ) {
        return null;
      }
      const ask = await prisma.order.findFirst({
        where: {
          status: "OPEN",
          side: "SELL",
          eventId: incoming.eventId,
          ticketTypeId: incoming.ticketTypeId,
          fulfillmentMode: {
            in: ["ANY", "RESALE_ONLY"],
          },
          price: {
            lte: incoming.price,
          },
        },
        orderBy: [{ price: "asc" }, { createdAt: "asc" }],
      });
      return ask
        ? this.settlePrisma(prisma, incoming.id, ask.id, ask.price)
        : null;
    }

    const bid = await prisma.order.findFirst({
      where: {
        status: "OPEN",
        side: "BUY",
        eventId: incoming.eventId,
        ticketTypeId: incoming.ticketTypeId,
        fulfillmentMode: {
          in: ["ANY", "RESALE_ONLY"],
        },
        price: {
          gte: incoming.price,
        },
        ...(paymentAuthorizationRequired
          ? {
              payments: {
                some: this.authorizedPaymentWhere(),
              },
            }
          : {}),
      },
      orderBy: [{ price: "desc" }, { createdAt: "asc" }],
    });
    return bid
      ? this.settlePrisma(prisma, bid.id, incoming.id, incoming.price)
      : null;
  }

  private async settlePrismaAfterPaymentAuthorization(
    prisma: PrismaService,
    orderId: string,
  ): Promise<PaymentAuthorizedSettlementResult | null> {
    this.assertAsyncOwnershipSettlementConfigured();
    const trade = await this.tryPrismaMatch(prisma, orderId);
    if (trade) {
      return {
        orderId,
        ticketId: trade.ticketId,
        tradeId: trade.id,
        fulfillmentType: "RESALE",
        matched: true,
        issued: false,
      };
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.side !== "BUY") {
      return null;
    }
    if (order.status === "SETTLED" && order.ticketId) {
      return {
        orderId: order.id,
        ticketId: order.ticketId,
        tradeId: null,
        fulfillmentType: "PRIMARY",
        matched: false,
        issued: true,
      };
    }
    if (order.status === "MATCHED" && order.ticketId) {
      const pendingTicket = await prisma.ticket.findUnique({
        where: { id: order.ticketId },
      });
      if (pendingTicket?.status === "ACTIVE" && pendingTicket.tokenId) {
        return this.finalizePrimaryOwnershipIssue(pendingTicket.id);
      }
      return pendingTicket
        ? this.primarySettlementResult(order.id, pendingTicket.id, false)
        : null;
    }
    if (order.status !== "OPEN") {
      return null;
    }
    if (!(await this.hasAuthorizedPaymentForOrder(prisma, order.id))) {
      return null;
    }
    if (!this.allowsPrimaryFulfillment(order.fulfillmentMode)) {
      await this.rejectUnavailableResaleOrder(prisma, order);
      return null;
    }

    const claim = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: "OPEN",
        side: "BUY",
        ticketId: null,
      },
      data: {
        status: "MATCHED",
      },
    });
    if (claim.count !== 1) {
      const settled = await prisma.order.findUnique({
        where: { id: order.id },
      });
      if (settled?.status === "SETTLED" && settled.ticketId) {
        return {
          orderId: settled.id,
          ticketId: settled.ticketId,
          tradeId: null,
          fulfillmentType: "PRIMARY",
          matched: false,
          issued: true,
        };
      }
      if (settled?.status === "MATCHED" && settled.ticketId) {
        return this.primarySettlementResult(
          settled.id,
          settled.ticketId,
          false,
        );
      }
      return null;
    }

    let ticket;
    try {
      const inventoryHold =
        await this.requireOnsaleInventory().orderHoldForIssuance(
          prisma,
          order.id,
        );
      ticket = await this.tickets.issueTicket({
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        ownerId: order.userId,
        seatHash: `primary-order:${order.id}`,
        inventoryHoldId: inventoryHold.id,
        orderId: order.id,
      });
    } catch (error) {
      await this.rejectPrimarySettlementAfterFailure(
        prisma,
        order.id,
        order.userId,
        error,
      );
      throw error;
    }

    const [linkedOrder, persistedTicket] = await Promise.all([
      prisma.order.findUnique({ where: { id: order.id } }),
      prisma.ticket.findUnique({ where: { id: ticket.id } }),
    ]);
    if (!linkedOrder || linkedOrder.ticketId !== ticket.id) {
      throw new ConflictException(
        "Primary ticket is not linked to its matched order",
      );
    }
    if (linkedOrder.status === "SETTLED") {
      return this.primarySettlementResult(linkedOrder.id, ticket.id, true);
    }
    if (
      linkedOrder.status === "REJECTED" ||
      linkedOrder.status === "CANCELLED"
    ) {
      return null;
    }
    if (linkedOrder.status !== "MATCHED") {
      throw new ConflictException(
        "Primary ticket is not attached to a matched order",
      );
    }
    if (persistedTicket?.status === "ACTIVE" && persistedTicket.tokenId) {
      return this.finalizePrimaryOwnershipIssue(persistedTicket.id);
    }
    if (!persistedTicket || persistedTicket.status !== "CREATED") {
      return null;
    }

    await this.publishOrderbookUpdate({
      eventId: order.eventId,
      ticketTypeId: order.ticketTypeId,
      reason: "primary_ticket_pending",
      orderId: order.id,
    });

    return {
      orderId: order.id,
      ticketId: ticket.id,
      tradeId: null,
      fulfillmentType: "PRIMARY",
      matched: true,
      issued: false,
    };
  }

  private async settlePrisma(
    prisma: PrismaService,
    buyOrderId: string,
    sellOrderId: string,
    price: number,
  ) {
    this.assertAsyncOwnershipSettlementConfigured();
    const existingTrade = await prisma.trade.findUnique({
      where: { buyOrderId },
    });
    if (existingTrade) {
      return this.mapPrismaTrade(existingTrade);
    }

    let claimed;
    try {
      claimed = await prisma.$transaction(async (tx) => {
        const buyOrder = await tx.order.findUnique({
          where: { id: buyOrderId },
        });
        const sellOrder = await tx.order.findUnique({
          where: { id: sellOrderId },
        });
        if (!buyOrder || !sellOrder || !sellOrder.ticketId) {
          throw new BadRequestException("Cannot settle invalid order pair");
        }
        const eventStatus = await lockMarketplaceEvent(tx, buyOrder.eventId);
        assertMarketplaceEventPublished(eventStatus);
        if (!this.allowsResaleFulfillment(buyOrder.fulfillmentMode)) {
          throw new BadRequestException(
            "Primary-only orders cannot match resale listings",
          );
        }
        if (buyOrder.status !== "OPEN" || sellOrder.status !== "OPEN") {
          return null;
        }
        if (
          this.requiresPaymentAuthorization() &&
          !(await this.hasAuthorizedPaymentForOrder(tx, buyOrder.id))
        ) {
          return null;
        }

        const ticket = await tx.ticket.findUniqueOrThrow({
          where: { id: sellOrder.ticketId },
          include: {
            owner: true,
            ticketType: true,
          },
        });
        const buyer = await tx.user.findUniqueOrThrow({
          where: { id: buyOrder.userId },
        });
        this.assertResaleSettlementIntegrity(buyOrder, sellOrder, ticket);
        const sellerWallet = requireVerifiedWalletBinding(
          ticket.owner,
          "Ticket seller wallet",
        );
        const buyerWallet = requireVerifiedWalletBinding(
          buyer,
          "Ticket buyer wallet",
        );
        if (price !== sellOrder.price) {
          throw new BadRequestException(
            "Matched resale price does not match the sell order",
          );
        }

        const [buyClaim, sellClaim, ticketClaim] = await Promise.all([
          tx.order.updateMany({
            where: {
              id: buyOrderId,
              status: "OPEN",
              side: "BUY",
            },
            data: { status: "MATCHED" },
          }),
          tx.order.updateMany({
            where: {
              id: sellOrderId,
              status: "OPEN",
              side: "SELL",
              ticketId: ticket.id,
            },
            data: { status: "MATCHED" },
          }),
          tx.ticket.updateMany({
            where: {
              id: ticket.id,
              ownerId: sellOrder.userId,
              status: "LISTED_FOR_RESALE",
            },
            data: { status: "TRANSFER_PENDING" },
          }),
        ]);
        if (
          buyClaim.count !== 1 ||
          sellClaim.count !== 1 ||
          ticketClaim.count !== 1
        ) {
          throw new OrderClaimConflictError();
        }

        await tx.auditLog.create({
          data: {
            actorId: buyOrder.userId,
            action: "ORDER_MATCHED",
            entityType: "order",
            entityId: buyOrder.id,
            metadataJson: {
              sellOrderId,
              ticketId: ticket.id,
              price,
            },
          },
        });

        const sideEffectKey =
          await this.settlementSideEffects.enqueueOwnershipTransfer(tx, {
            ticketId: ticket.id,
            tokenId: ticket.tokenId,
            fromOwnerId: ticket.ownerId,
            fromWalletAddress: sellerWallet.walletAddress,
            fromWalletBindingVersion: sellerWallet.walletBindingVersion,
            fromWalletBindingFingerprint: sellerWallet.walletBindingFingerprint,
            toOwnerId: buyOrder.userId,
            toWalletAddress: buyerWallet.walletAddress,
            toWalletBindingVersion: buyerWallet.walletBindingVersion,
            toWalletBindingFingerprint: buyerWallet.walletBindingFingerprint,
            contractRoute: this.ticketContractRoute(ticket),
            buyOrderId: buyOrder.id,
            sellOrderId: sellOrder.id,
          });

        return {
          buyOrder,
          sellOrder,
          ticket,
          buyer,
          sellerWallet,
          buyerWallet,
          sideEffectKey,
        };
      });
    } catch (error) {
      if (error instanceof OrderClaimConflictError) {
        return null;
      }
      throw error;
    }

    if (!claimed) {
      const trade = await prisma.trade.findUnique({
        where: { buyOrderId },
      });
      return trade ? this.mapPrismaTrade(trade) : null;
    }

    if (this.usesAsyncOwnershipSettlement()) {
      return null;
    }
    this.assertSynchronousOwnershipSettlementAllowed();

    let ownership;
    try {
      ownership = await this.settlementSideEffects.transferOwnership({
        ticketId: claimed.ticket.id,
        tokenId: claimed.ticket.tokenId,
        fromOwnerId: claimed.ticket.ownerId,
        fromWalletAddress: claimed.sellerWallet.walletAddress,
        fromWalletBindingVersion: claimed.sellerWallet.walletBindingVersion,
        fromWalletBindingFingerprint:
          claimed.sellerWallet.walletBindingFingerprint,
        toOwnerId: claimed.buyOrder.userId,
        toWalletAddress: claimed.buyerWallet.walletAddress,
        toWalletBindingVersion: claimed.buyerWallet.walletBindingVersion,
        toWalletBindingFingerprint:
          claimed.buyerWallet.walletBindingFingerprint,
        contractRoute: this.ticketContractRoute(claimed.ticket),
      });
      await this.settlementSideEffects.markOwnershipTransferCompleted(
        claimed.sideEffectKey,
        claimed.ticket.id,
        ownership,
      );
    } catch (error) {
      await this.settlementSideEffects.markOwnershipTransferFailed(
        claimed.sideEffectKey,
        error,
      );
      await this.failOwnershipTransfer({
        buyOrderId,
        sellOrderId,
        ticketId: claimed.ticket.id,
        reason:
          error instanceof Error ? error.message : "Ownership transfer failed",
      });
      throw error;
    }

    return this.finalizeOwnershipTransfer({
      buyOrderId,
      sellOrderId,
      ticketId: claimed.ticket.id,
      ownership: {
        status: ownership.status,
        adapter: ownership.adapter,
        ownershipRef: ownership.ownershipRef,
        transactionHash: ownership.transactionHash,
        contractRoute: ownership.contractRoute,
      },
    });
  }

  private async enqueuePaymentCaptureForTrade(
    prisma: Prisma.TransactionClient,
    buyOrderId: string,
    tradeId: string,
    ticketId: string,
  ) {
    const payment = await prisma.payment.findFirst({
      where: {
        orderId: buyOrderId,
        captureStatus: "AUTHORIZED",
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    if (!payment) {
      return;
    }
    await this.settlementSideEffects.enqueuePaymentCaptureForTrade(prisma, {
      paymentId: payment.id,
      buyOrderId,
      tradeId,
      ticketId,
    });
  }

  private async enqueuePaymentCaptureForPrimaryTicket(
    prisma: Prisma.TransactionClient,
    buyOrderId: string,
    ticketId: string,
  ) {
    const payment = await prisma.payment.findFirst({
      where: {
        orderId: buyOrderId,
        captureStatus: { in: ["AUTHORIZED", "CAPTURED"] },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    if (!payment) {
      return false;
    }
    if (payment.captureStatus === "CAPTURED") {
      return true;
    }
    await this.settlementSideEffects.enqueuePaymentCaptureForPrimaryTicket(
      prisma,
      {
        paymentId: payment.id,
        buyOrderId,
        ticketId,
      },
    );
    return true;
  }

  private async rejectPrimarySettlementAfterFailure(
    prisma: PrismaService,
    buyOrderId: string,
    actorId: string,
    error: unknown,
    issuedTicketId?: string,
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: {
          id: buyOrderId,
          status: "MATCHED",
          side: "BUY",
        },
        data: {
          status: "REJECTED",
          remainingQuantity: 0,
        },
      });
      if (issuedTicketId) {
        await tx.ticket.updateMany({
          where: {
            id: issuedTicketId,
            status: { in: ["CREATED", "ACTIVE"] },
          },
          data: {
            status: "CANCELLED",
          },
        });
      }
      await this.requireOnsaleInventory().releaseOrderHold(
        tx,
        buyOrderId,
        "primary_ticket_issue_failed",
        Boolean(issuedTicketId),
      );
      await tx.auditLog.create({
        data: {
          actorId,
          action: "PRIMARY_TICKET_ISSUE_FAILED",
          entityType: "order",
          entityId: buyOrderId,
          metadataJson: {
            ticketId: issuedTicketId ?? null,
            message:
              error instanceof Error
                ? error.message
                : "Primary ticket issue failed",
          },
        },
      });
      await this.enqueuePaymentCompensationForFailedSettlement(
        tx,
        buyOrderId,
        "primary_ticket_issue_failed",
      );
    });
  }

  private async rejectUnavailableResaleOrder(
    prisma: PrismaService,
    order: {
      id: string;
      userId: string;
      eventId: string;
      ticketTypeId: string;
      price: number;
    },
  ) {
    const rejected = await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "OPEN",
          side: "BUY",
          fulfillmentMode: "RESALE_ONLY",
        },
        data: {
          status: "REJECTED",
          remainingQuantity: 0,
        },
      });
      if (claim.count !== 1) {
        return false;
      }
      await tx.auditLog.create({
        data: {
          actorId: order.userId,
          action: "RESALE_ORDER_UNAVAILABLE",
          entityType: "order",
          entityId: order.id,
          metadataJson: {
            eventId: order.eventId,
            ticketTypeId: order.ticketTypeId,
            price: order.price,
          },
        },
      });
      await this.enqueuePaymentCompensationForFailedSettlement(
        tx,
        order.id,
        "resale_listing_unavailable",
      );
      return true;
    });
    if (rejected) {
      await this.publishOrderbookUpdate({
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        reason: "order_rejected",
        orderId: order.id,
      });
    }
  }

  private async enqueuePaymentCompensationForFailedSettlement(
    prisma: Prisma.TransactionClient,
    buyOrderId: string,
    reason: string,
  ) {
    const payment = await prisma.payment.findFirst({
      where: {
        orderId: buyOrderId,
        captureStatus: {
          in: ["AUTHORIZED", "CAPTURED"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    if (!payment) {
      return;
    }
    await this.settlementSideEffects.enqueuePaymentCompensation(prisma, {
      paymentId: payment.id,
      buyOrderId,
      captureStatus: payment.captureStatus,
      reason,
    });
  }

  private async failPrimaryOwnershipIssueInTransaction(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      userId: string;
      status: string;
    },
    ticket: { id: string; status: string },
    compensationReason: string,
    failureMessage = compensationReason,
  ) {
    const orderClaim = await tx.order.updateMany({
      where: {
        id: order.id,
        status: "MATCHED",
        side: "BUY",
        ticketId: ticket.id,
      },
      data: { status: "REJECTED", remainingQuantity: 0 },
    });
    if (orderClaim.count !== 1) {
      return false;
    }
    await tx.ticket.updateMany({
      where: {
        id: ticket.id,
        status: { in: ["CREATED", "ACTIVE"] },
      },
      data: { status: "CANCELLED" },
    });
    await this.requireOnsaleInventory().releaseOrderHold(
      tx,
      order.id,
      compensationReason,
      true,
    );
    await tx.auditLog.create({
      data: {
        actorId: order.userId,
        action: "PRIMARY_TICKET_ISSUE_FAILED",
        entityType: "order",
        entityId: order.id,
        metadataJson: {
          ticketId: ticket.id,
          message: failureMessage,
        },
      },
    });
    await this.enqueuePaymentCompensationForFailedSettlement(
      tx,
      order.id,
      compensationReason,
    );
    return true;
  }

  private primaryOwnershipFailureReason(error: unknown) {
    return error instanceof Error
      ? error.message
      : typeof error === "string" && error.trim()
        ? error.trim()
        : "Primary ticket ownership issuance failed";
  }

  private primarySettlementResult(
    orderId: string,
    ticketId: string,
    issued: boolean,
  ): PaymentAuthorizedSettlementResult {
    return {
      orderId,
      ticketId,
      tradeId: null,
      fulfillmentType: "PRIMARY",
      matched: !issued,
      issued,
    };
  }

  private mapPrismaOrder(order: {
    id: string;
    userId: string;
    eventId: string;
    ticketTypeId: string;
    ticketId: string | null;
    side: "BUY" | "SELL";
    fulfillmentMode: string;
    price: number;
    quantity: number;
    remainingQuantity: number;
    status: OrderRecord["status"];
    idempotencyKey?: string | null;
    createdAt: Date;
  }): OrderRecord {
    return {
      ...order,
      fulfillmentMode: order.fulfillmentMode as OrderFulfillmentMode,
      createdAt: order.createdAt.toISOString(),
    };
  }

  private mapPrismaTrade(trade: {
    id: string;
    buyOrderId: string;
    sellOrderId: string;
    ticketId: string;
    price: number;
    fee: number;
    settlementStatus: string;
    createdAt: Date;
  }) {
    return {
      ...trade,
      settlementStatus: trade.settlementStatus as "SETTLED" | "FAILED",
      createdAt: trade.createdAt.toISOString(),
    };
  }

  private requireOnsaleInventory() {
    if (!this.onsaleInventory) {
      throw new BadRequestException("Primary inventory service is unavailable");
    }
    return this.onsaleInventory;
  }

  private prismaClient() {
    const dataSource =
      this.config?.get<string>("FANPASS_DATA_SOURCE") ??
      process.env.FANPASS_DATA_SOURCE;
    return dataSource === "prisma" ? this.prisma : undefined;
  }

  private requiresPaymentAuthorization() {
    return (
      (this.config?.get<string>("FANPASS_REQUIRE_PAYMENT_AUTHORIZATION") ??
        process.env.FANPASS_REQUIRE_PAYMENT_AUTHORIZATION) === "true"
    );
  }

  private usesAsyncOwnershipSettlement() {
    return (
      (this.config?.get<string>("FANPASS_ASYNC_OWNERSHIP_SETTLEMENT") ??
        process.env.FANPASS_ASYNC_OWNERSHIP_SETTLEMENT) === "true"
    );
  }

  private assertAsyncOwnershipSettlementConfigured() {
    if (
      requiresDurableOwnershipDispatch(this.ownershipDispatchConfig()) &&
      !this.usesAsyncOwnershipSettlement()
    ) {
      throw new ServiceUnavailableException(
        "Provider-backed settlement requires FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true",
      );
    }
  }

  private assertSynchronousOwnershipSettlementAllowed() {
    if (requiresDurableOwnershipDispatch(this.ownershipDispatchConfig())) {
      throw new ServiceUnavailableException(
        "Synchronous provider-backed ownership settlement is disabled; use the durable async worker",
      );
    }
  }

  private ownershipDispatchConfig() {
    return {
      NODE_ENV: this.config?.get<string>("NODE_ENV") ?? process.env.NODE_ENV,
      FANPASS_ENV:
        this.config?.get<string>("FANPASS_ENV") ?? process.env.FANPASS_ENV,
      FANPASS_DATA_SOURCE:
        this.config?.get<string>("FANPASS_DATA_SOURCE") ??
        process.env.FANPASS_DATA_SOURCE,
      OWNERSHIP_ADAPTER:
        this.config?.get<string>("OWNERSHIP_ADAPTER") ??
        process.env.OWNERSHIP_ADAPTER,
    };
  }

  private authorizedPaymentWhere() {
    return {
      captureStatus: {
        in: ["AUTHORIZED", "CAPTURED"],
      },
    };
  }

  private async hasAuthorizedPaymentForOrder(
    prisma:
      | Pick<PrismaService, "payment">
      | Pick<Prisma.TransactionClient, "payment">,
    orderId: string,
  ) {
    const count = await prisma.payment.count({
      where: {
        orderId,
        ...this.authorizedPaymentWhere(),
      },
    });
    return count > 0;
  }

  private normalizeIdempotencyKey(idempotencyKey: string | undefined) {
    const normalized = idempotencyKey?.trim();
    return normalized ? normalized.slice(0, 128) : null;
  }

  private fulfillmentModeFor(
    input: Pick<CreateOrderInput, "side" | "fulfillmentMode">,
  ): OrderFulfillmentMode {
    if (input.side === "SELL") {
      return "RESALE_ONLY";
    }
    return input.fulfillmentMode ?? "ANY";
  }

  private allowsPrimaryFulfillment(fulfillmentMode: string | null | undefined) {
    return fulfillmentMode !== "RESALE_ONLY";
  }

  private allowsResaleFulfillment(fulfillmentMode: string | null | undefined) {
    return fulfillmentMode !== "PRIMARY_ONLY";
  }

  private marketplaceUnavailableMessage(
    side: CreateOrderInput["side"],
    fulfillmentMode: OrderFulfillmentMode,
  ) {
    return side === "BUY" && this.allowsPrimaryFulfillment(fulfillmentMode)
      ? "Event is not available for checkout"
      : "Event is not available for marketplace operations";
  }

  private assertSellOrderTicket(
    ticket: {
      id: string;
      eventId: string;
      ticketTypeId: string;
      ownerId: string;
      status: string;
      transferCount: number;
    } | null,
    ticketType: {
      transferable: boolean;
      maxTransferCount: number;
    },
    input: CreateOrderInput,
  ): asserts ticket is {
    id: string;
    eventId: string;
    ticketTypeId: string;
    ownerId: string;
    status: string;
    transferCount: number;
  } {
    if (!ticket) {
      throw new BadRequestException("Ticket is not available for resale");
    }
    if (
      ticket.eventId !== input.eventId ||
      ticket.ticketTypeId !== input.ticketTypeId
    ) {
      throw new BadRequestException("Ticket is not available for this market");
    }
    if (ticket.ownerId !== input.userId) {
      throw new BadRequestException(
        "Only the ticket owner can place a sell order",
      );
    }
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

  private assertResaleSettlementIntegrity(
    buyOrder: {
      side: string;
      eventId: string;
      ticketTypeId: string;
    },
    sellOrder: {
      side: string;
      userId: string;
      eventId: string;
      ticketTypeId: string;
      ticketId: string | null;
      price: number;
    },
    ticket: {
      id: string;
      eventId: string;
      ticketTypeId: string;
      ownerId: string;
      transferCount: number;
      ticketType: {
        eventId: string;
        transferable: boolean;
        resaleCap: number | null;
        maxTransferCount: number;
      };
    },
  ) {
    if (
      buyOrder.side !== "BUY" ||
      sellOrder.side !== "SELL" ||
      sellOrder.ticketId !== ticket.id ||
      sellOrder.userId !== ticket.ownerId ||
      buyOrder.eventId !== sellOrder.eventId ||
      buyOrder.ticketTypeId !== sellOrder.ticketTypeId ||
      sellOrder.eventId !== ticket.eventId ||
      sellOrder.ticketTypeId !== ticket.ticketTypeId ||
      ticket.ticketType.eventId !== ticket.eventId
    ) {
      throw new BadRequestException(
        "Resale order and ticket market do not match",
      );
    }
    if (
      !ticket.ticketType.transferable ||
      ticket.transferCount >= ticket.ticketType.maxTransferCount ||
      sellOrder.price > (ticket.ticketType.resaleCap ?? Number.MAX_SAFE_INTEGER)
    ) {
      throw new BadRequestException(
        "Ticket resale policy no longer allows this settlement",
      );
    }
  }

  private ticketContractRoute(ticket: {
    ownershipContractAddress?: string | null;
    ownershipChainId?: string | null;
    ownershipContractVersion?: string | null;
  }): OwnershipContractRoute | null {
    if (
      !ticket.ownershipContractAddress ||
      !ticket.ownershipChainId ||
      ticket.ownershipContractVersion !== "fanpass-ticket-v1"
    ) {
      return null;
    }
    return {
      contractAddress: ticket.ownershipContractAddress,
      chainId: ticket.ownershipChainId,
      contractVersion: "fanpass-ticket-v1",
    };
  }

  private findIdempotentMemoryOrder(input: CreateOrderInput) {
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) {
      return null;
    }
    return (
      this.store.orders.find(
        (order) =>
          order.userId === input.userId &&
          order.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  private async findIdempotentPrismaOrder(
    prisma: PrismaService,
    input: CreateOrderInput,
  ) {
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) {
      return null;
    }
    return prisma.order.findFirst({
      where: {
        userId: input.userId,
        idempotencyKey,
      },
    });
  }

  private assertIdempotentOrderMatches(
    order: OrderRecord,
    input: CreateOrderInput,
  ) {
    const expectedTicketId = input.ticketId ?? null;
    if (
      order.eventId !== input.eventId ||
      order.ticketTypeId !== input.ticketTypeId ||
      order.side !== input.side ||
      (order.fulfillmentMode ?? "ANY") !== this.fulfillmentModeFor(input) ||
      order.price !== input.price ||
      order.ticketId !== expectedTicketId
    ) {
      throw new BadRequestException(
        "Idempotency key already belongs to a different order",
      );
    }
  }

  private findMemoryTradeForOrder(orderId: string) {
    return (
      this.store.trades.find(
        (trade) =>
          trade.buyOrderId === orderId || trade.sellOrderId === orderId,
      ) ?? null
    );
  }

  private async findPrismaTradeForOrder(
    prisma: PrismaService,
    orderId: string,
  ) {
    const trade = await prisma.trade.findFirst({
      where: {
        OR: [{ buyOrderId: orderId }, { sellOrderId: orderId }],
      },
    });
    return trade ? this.mapPrismaTrade(trade) : null;
  }

  private async publishOrderbookUpdate(input: {
    eventId: string;
    ticketTypeId: string;
    reason:
      | "order_created"
      | "order_cancelled"
      | "order_rejected"
      | "trade_settled"
      | "primary_ticket_issued"
      | "primary_ticket_pending";
    orderId?: string;
    tradeId?: string;
  }) {
    if (!this.realtime) {
      return;
    }
    const snapshot = (await this.getOrderbook(
      input.eventId,
      input.ticketTypeId,
    )) as OrderbookSnapshot;
    this.realtime.publish({
      ...input,
      snapshot,
    });
  }
}
