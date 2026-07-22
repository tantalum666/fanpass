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
    | "primary_ticket_issued"
    | "primary_ticket_pending";
  orderId?: string;
  tradeId?: string;
  snapshot: OrderbookSnapshot;
  revision: number;
  emittedAt: string;
}

export interface OrderbookSnapshotReplay {
  snapshot: OrderbookSnapshot;
  revision: number;
  emittedAt: string;
}

const MAX_REPLAY_ROOMS = 4_096;

@Injectable()
export class OrderbookRealtimeService {
  private server: Server | null = null;
  private readonly latestByRoom = new Map<string, OrderbookSnapshotReplay>();
  private revision = 0;

  attach(server: Server) {
    this.server = server;
  }

  roomName(eventId: string, ticketTypeId: string) {
    return `orderbook:${eventId}:${ticketTypeId}`;
  }

  captureRevision(room: string) {
    const latest = this.latestByRoom.get(room);
    if (!latest) {
      return 0;
    }
    this.latestByRoom.delete(room);
    this.latestByRoom.set(room, latest);
    return latest.revision;
  }

  latestSnapshotSince(room: string, revision: number) {
    const latest = this.latestByRoom.get(room);
    if (!latest || latest.revision <= revision) {
      return null;
    }
    this.latestByRoom.delete(room);
    this.latestByRoom.set(room, latest);
    return latest;
  }

  publish(payload: Omit<OrderbookUpdatePayload, "emittedAt" | "revision">) {
    const room = this.roomName(payload.eventId, payload.ticketTypeId);
    const emittedAt = new Date().toISOString();
    const revision = (this.revision += 1);
    const replay = {
      snapshot: payload.snapshot,
      revision,
      emittedAt,
    };
    this.remember(room, replay);
    if (!this.server) {
      return;
    }
    this.server.to(room).emit("orderbook.updated", {
      ...payload,
      revision,
      emittedAt,
    });
  }

  private remember(room: string, replay: OrderbookSnapshotReplay) {
    this.latestByRoom.delete(room);
    if (this.latestByRoom.size >= MAX_REPLAY_ROOMS) {
      const oldestRoom = this.latestByRoom.keys().next().value as
        string | undefined;
      if (oldestRoom) {
        this.latestByRoom.delete(oldestRoom);
      }
    }
    this.latestByRoom.set(room, replay);
  }
}
