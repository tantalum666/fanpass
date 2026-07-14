import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";

export interface OrderbookSnapshot {
  eventId: string;
  ticketTypeId: string;
  bids: { price: number; quantity: number }[];
  asks: { price: number; quantity: number }[];
  lastTradePrice: number | null;
  floorPrice: number | null;
  volume: number;
  premiumPercent: number | null;
  priceHistory: { price: number; tradedAt: string }[];
}

export interface OrderbookUpdatePayload {
  eventId: string;
  ticketTypeId: string;
  reason:
    | "order_created"
    | "order_cancelled"
    | "order_rejected"
    | "trade_settled"
    | "primary_ticket_issued";
  orderId?: string;
  tradeId?: string;
  snapshot: OrderbookSnapshot;
  emittedAt: string;
}

@Injectable()
export class OrderbookRealtimeService {
  private server: Server | null = null;

  attach(server: Server) {
    this.server = server;
  }

  roomName(eventId: string, ticketTypeId: string) {
    return `orderbook:${eventId}:${ticketTypeId}`;
  }

  publish(payload: Omit<OrderbookUpdatePayload, "emittedAt">) {
    if (!this.server) {
      return;
    }
    this.server
      .to(this.roomName(payload.eventId, payload.ticketTypeId))
      .emit("orderbook.updated", {
        ...payload,
        emittedAt: new Date().toISOString(),
      });
  }
}
