import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { DemoStore } from "../../common/demo-store";
import { OrderRecord } from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../audit/audit.service";
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
    adapter: "mock" | "testnet";
    ownershipRef: string;
    transactionHash: string | null;
  };
}

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
  ) {}

  getOrderbook(eventId: string, ticketTypeId: string) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.getPrismaOrderbook(prisma, eventId, ticketTypeId);
    }

    const orders = this.store.orders.filter(
      (order) =>
        order.eventId === eventId &&
        order.ticketTypeId === ticketTypeId &&
        order.status === "OPEN",
    );
    const bids = this.aggregateLevels(
      orders.filter((order) => order.side === "BUY"),
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
        ticket?.eventId === eventId && ticket.ticketTypeId === ticketTypeId
      );
    });
    const ticketType = this.store.getTicketType(ticketTypeId);
    const lastTradePrice = trades[0]?.price ?? null;
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
    };
  }

  async createOrder(input: CreateOrderInput) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.createPrismaOrder(prisma, input);
    }

    this.store.getEvent(input.eventId);
    const ticketType = this.store.getTicketType(input.ticketTypeId);
    const existingOrder = this.findIdempotentMemoryOrder(input);
    if (existingOrder) {
      this.assertIdempotentOrderMatches(existingOrder, input);
      return {
        order: existingOrder,
        trade: this.findMemoryTradeForOrder(existingOrder.id),
      };
    }

    if (input.price > (ticketType.resaleCap ?? Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException("Order price exceeds organizer resale cap");
    }

    if (input.side === "SELL") {
      if (!input.ticketId) {
        throw new BadRequestException("Sell orders require a ticket ID");
      }
      const ticket = this.store.getTicket(input.ticketId);
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
    const prisma = this.prismaClient();
    if (!prisma) {
      throw new BadRequestException(
        "Ownership settlement finalization requires Prisma persistence",
      );
    }

    const settledTrade = await prisma.$transaction(async (tx) => {
      const existing = await tx.trade.findFirst({
        where: {
          OR: [
            { buyOrderId: input.buyOrderId },
            { sellOrderId: input.sellOrderId },
          ],
        },
      });
      if (existing) {
        return this.mapPrismaTrade(existing);
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
        return null;
      }

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
      await this.enqueuePaymentCaptureForTrade(tx, input.buyOrderId, trade.id);
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

  private async tryMemoryMatch(
    orderId: string,
    options: { skipPaymentAuthorizationGate?: boolean } = {},
  ) {
    const incoming = this.store.orders.find((order) => order.id === orderId);
    if (!incoming || incoming.status !== "OPEN") {
      return null;
    }
    if (
      this.requiresPaymentAuthorization() &&
      !options.skipPaymentAuthorizationGate
    ) {
      return null;
    }

    if (incoming.side === "BUY") {
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

    const ticket = await this.tickets.issueTicket({
      eventId: order.eventId,
      ticketTypeId: order.ticketTypeId,
      ownerId: order.userId,
      seatHash: `primary-order:${order.id}`,
    });

    order.status = "SETTLED";
    order.remainingQuantity = 0;
    order.ticketId = ticket.id;
    this.audit.record(
      order.userId,
      "ORDER_PRIMARY_TICKET_ISSUED",
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
      reason: "primary_ticket_issued",
      orderId: order.id,
    });

    return {
      orderId: order.id,
      ticketId: ticket.id,
      tradeId: null,
      fulfillmentType: "PRIMARY",
      matched: false,
      issued: true,
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
    const ticket = this.store.getTicket(sellOrder.ticketId);
    const seller = this.store.users.find((user) => user.id === ticket.ownerId);
    const buyer = this.store.users.find((user) => user.id === buyOrder.userId);
    if (!seller || !buyer) {
      throw new BadRequestException(
        "Cannot settle ownership transfer without both users",
      );
    }

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
      fromWalletAddress: seller.walletAddress,
      toOwnerId: buyer.id,
      toWalletAddress: buyer.walletAddress,
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

  private async getPrismaOrderbook(
    prisma: PrismaService,
    eventId: string,
    ticketTypeId: string,
  ) {
    const [orders, trades, ticketType] = await Promise.all([
      prisma.order.findMany({
        where: {
          eventId,
          ticketTypeId,
          status: "OPEN",
        },
      }),
      prisma.trade.findMany({
        where: {
          ticket: {
            eventId,
            ticketTypeId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.ticketType.findUniqueOrThrow({
        where: {
          id: ticketTypeId,
        },
      }),
    ]);
    const bids = this.aggregateLevels(
      orders.filter((order) => order.side === "BUY"),
      "desc",
    );
    const asks = this.aggregateLevels(
      orders.filter((order) => order.side === "SELL"),
      "asc",
    );
    const lastTradePrice = trades[0]?.price ?? null;
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
    };
  }

  private async createPrismaOrder(
    prisma: PrismaService,
    input: CreateOrderInput,
  ) {
    await prisma.event.findUniqueOrThrow({ where: { id: input.eventId } });
    const ticketType = await prisma.ticketType.findUniqueOrThrow({
      where: { id: input.ticketTypeId },
    });
    const existingOrder = await this.findIdempotentPrismaOrder(prisma, input);
    if (existingOrder) {
      const mappedOrder = this.mapPrismaOrder(existingOrder);
      this.assertIdempotentOrderMatches(mappedOrder, input);
      return {
        order: mappedOrder,
        trade: await this.findPrismaTradeForOrder(prisma, existingOrder.id),
      };
    }

    if (input.price > (ticketType.resaleCap ?? Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException("Order price exceeds organizer resale cap");
    }

    if (input.side === "SELL") {
      if (!input.ticketId) {
        throw new BadRequestException("Sell orders require a ticket ID");
      }
      const ticket = await prisma.ticket.findUniqueOrThrow({
        where: { id: input.ticketId },
      });
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
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "LISTED_FOR_RESALE" },
      });
      await this.audit.record(
        input.userId,
        "TICKET_LISTED_FOR_RESALE",
        "ticket",
        ticket.id,
        {
          orderPrice: input.price,
        },
      );
    }

    const order = await prisma.order.create({
      data: {
        id: `ord_${randomUUID()}`,
        userId: input.userId,
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
        ticketId: input.ticketId ?? null,
        side: input.side,
        price: input.price,
        quantity: 1,
        remainingQuantity: 1,
        status: "OPEN",
        idempotencyKey: this.normalizeIdempotencyKey(input.idempotencyKey),
      },
    });
    await this.audit.record(input.userId, "ORDER_CREATED", "order", order.id, {
      side: input.side,
      price: input.price,
    });

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

      const cancelled = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          remainingQuantity: 0,
        },
      });

      if (order.side === "SELL" && order.ticketId) {
        const ticket = await tx.ticket.findUniqueOrThrow({
          where: { id: order.ticketId },
        });
        if (ticket.status === "LISTED_FOR_RESALE") {
          await tx.ticket.update({
            where: { id: ticket.id },
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
    if (order.status !== "OPEN") {
      return null;
    }
    if (!(await this.hasAuthorizedPaymentForOrder(prisma, order.id))) {
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
      return null;
    }

    let ticket;
    try {
      ticket = await this.tickets.issueTicket({
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        ownerId: order.userId,
        seatHash: `primary-order:${order.id}`,
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

    try {
      await prisma.$transaction(async (tx) => {
        const settled = await tx.order.updateMany({
          where: {
            id: order.id,
            status: "MATCHED",
            side: "BUY",
            ticketId: null,
          },
          data: {
            status: "SETTLED",
            remainingQuantity: 0,
            ticketId: ticket.id,
          },
        });
        if (settled.count !== 1) {
          throw new BadRequestException(
            "Primary ticket settlement lost its matched order claim",
          );
        }
        await this.enqueuePaymentCaptureForPrimaryTicket(
          tx,
          order.id,
          ticket.id,
        );
        await tx.auditLog.create({
          data: {
            actorId: order.userId,
            action: "ORDER_PRIMARY_TICKET_ISSUED",
            entityType: "order",
            entityId: order.id,
            metadataJson: {
              ticketId: ticket.id,
              eventId: order.eventId,
              ticketTypeId: order.ticketTypeId,
              price: order.price,
            },
          },
        });
      });
    } catch (error) {
      await this.rejectPrimarySettlementAfterFailure(
        prisma,
        order.id,
        order.userId,
        error,
        ticket.id,
      );
      throw error;
    }

    await this.publishOrderbookUpdate({
      eventId: order.eventId,
      ticketTypeId: order.ticketTypeId,
      reason: "primary_ticket_issued",
      orderId: order.id,
    });

    return {
      orderId: order.id,
      ticketId: ticket.id,
      tradeId: null,
      fulfillmentType: "PRIMARY",
      matched: false,
      issued: true,
    };
  }

  private async settlePrisma(
    prisma: PrismaService,
    buyOrderId: string,
    sellOrderId: string,
    price: number,
  ) {
    const existingTrade = await prisma.trade.findFirst({
      where: {
        OR: [{ buyOrderId }, { sellOrderId }],
      },
    });
    if (existingTrade) {
      return this.mapPrismaTrade(existingTrade);
    }

    const claimed = await prisma.$transaction(async (tx) => {
      const buyOrder = await tx.order.findUnique({ where: { id: buyOrderId } });
      const sellOrder = await tx.order.findUnique({
        where: { id: sellOrderId },
      });
      if (!buyOrder || !sellOrder || !sellOrder.ticketId) {
        throw new BadRequestException("Cannot settle invalid order pair");
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
        },
      });
      const buyer = await tx.user.findUniqueOrThrow({
        where: { id: buyOrder.userId },
      });

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
        return null;
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
          fromWalletAddress: ticket.owner.walletAddress,
          toOwnerId: buyOrder.userId,
          toWalletAddress: buyer.walletAddress,
          buyOrderId: buyOrder.id,
          sellOrderId: sellOrder.id,
        });

      return {
        buyOrder,
        sellOrder,
        ticket,
        buyer,
        sideEffectKey,
      };
    });

    if (!claimed) {
      const trade = await prisma.trade.findFirst({
        where: {
          OR: [{ buyOrderId }, { sellOrderId }],
        },
      });
      return trade ? this.mapPrismaTrade(trade) : null;
    }

    if (this.usesAsyncOwnershipSettlement()) {
      return null;
    }

    let ownership;
    try {
      ownership = await this.settlementSideEffects.transferOwnership({
        ticketId: claimed.ticket.id,
        tokenId: claimed.ticket.tokenId,
        fromOwnerId: claimed.ticket.ownerId,
        fromWalletAddress: claimed.ticket.owner.walletAddress,
        toOwnerId: claimed.buyOrder.userId,
        toWalletAddress: claimed.buyer.walletAddress,
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
      await prisma.$transaction(async (tx) => {
        await tx.order.updateMany({
          where: {
            id: {
              in: [buyOrderId, sellOrderId],
            },
            status: "MATCHED",
          },
          data: {
            status: "REJECTED",
            remainingQuantity: 0,
          },
        });
        await tx.ticket.updateMany({
          where: {
            id: claimed.ticket.id,
            status: "TRANSFER_PENDING",
          },
          data: {
            status: claimed.ticket.transferCount > 0 ? "TRANSFERRED" : "ACTIVE",
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: claimed.buyOrder.userId,
            action: "TRADE_SETTLEMENT_FAILED",
            entityType: "order",
            entityId: buyOrderId,
            metadataJson: {
              sellOrderId,
              ticketId: claimed.ticket.id,
              message:
                error instanceof Error
                  ? error.message
                  : "Ownership transfer failed",
            },
          },
        });
        await this.enqueuePaymentCompensationForFailedSettlement(
          tx,
          buyOrderId,
          "ownership_transfer_failed",
        );
      });
      throw error;
    }

    return this.finalizeOwnershipTransfer({
      buyOrderId,
      sellOrderId,
      ticketId: claimed.ticket.id,
      ownership: {
        adapter: ownership.adapter,
        ownershipRef: ownership.ownershipRef,
        transactionHash: ownership.transactionHash,
      },
    });
  }

  private async enqueuePaymentCaptureForTrade(
    prisma: Prisma.TransactionClient,
    buyOrderId: string,
    tradeId: string,
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
        captureStatus: "AUTHORIZED",
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    if (!payment) {
      return;
    }
    await this.settlementSideEffects.enqueuePaymentCaptureForPrimaryTicket(
      prisma,
      {
        paymentId: payment.id,
        buyOrderId,
        ticketId,
      },
    );
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
            status: "ACTIVE",
          },
          data: {
            status: "CANCELLED",
          },
        });
      }
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

  private mapPrismaOrder(order: {
    id: string;
    userId: string;
    eventId: string;
    ticketTypeId: string;
    ticketId: string | null;
    side: "BUY" | "SELL";
    price: number;
    quantity: number;
    remainingQuantity: number;
    status: OrderRecord["status"];
    idempotencyKey?: string | null;
    createdAt: Date;
  }): OrderRecord {
    return {
      ...order,
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

  private prismaClient() {
    return process.env.FANPASS_DATA_SOURCE === "prisma"
      ? this.prisma
      : undefined;
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
      | "trade_settled"
      | "primary_ticket_issued";
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
