import { BadRequestException } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { isFanPassId } from "../../common/route-param.pipe";
import {
  OrderbookAdmissionError,
  OrderbookAdmissionLease,
  OrderbookAdmissionService,
} from "./orderbook-admission.service";
import { OrderbookRealtimeService } from "./orderbook-realtime.service";
import { OrderbookService } from "./orderbook.service";

interface SubscribeOrderbookInput {
  eventId?: unknown;
  ticketTypeId?: unknown;
}

interface OrderbookSubscriptionState {
  activeRooms: Set<string>;
  pendingRooms: Set<string>;
  roomGenerations: Map<string, number>;
}

const MAX_ACTIVE_ORDERBOOK_ROOMS = 8;

@WebSocketGateway({
  namespace: "/orderbook",
})
export class OrderbookGateway implements OnGatewayInit {
  constructor(
    private readonly orderbook: OrderbookService,
    private readonly realtime: OrderbookRealtimeService,
    private readonly admission: OrderbookAdmissionService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
  }

  @SubscribeMessage("orderbook.subscribe")
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeOrderbookInput,
  ) {
    const { eventId, ticketTypeId } = this.parseSubscription(body);
    const room = this.realtime.roomName(eventId, ticketTypeId);
    const state = this.subscriptionState(client);
    if (state.activeRooms.has(room)) {
      return {
        ok: true,
        eventId,
        ticketTypeId,
        alreadySubscribed: true,
      };
    }
    if (state.pendingRooms.has(room)) {
      throw this.subscriptionError(
        "Orderbook subscription is already being prepared",
      );
    }
    if (
      state.activeRooms.size + state.pendingRooms.size >=
      MAX_ACTIVE_ORDERBOOK_ROOMS
    ) {
      throw this.subscriptionError("Orderbook subscription limit reached");
    }

    const actorKey = this.actorKey(client);
    try {
      this.admission.consumeSubscriptionAttempt(actorKey);
    } catch (error) {
      throw this.subscriptionError(error);
    }
    const generation = this.nextGeneration(state, room);
    const initialRevision = this.realtime.captureRevision(room);
    state.pendingRooms.add(room);
    let snapshotLease: OrderbookAdmissionLease | null = null;
    try {
      snapshotLease = this.admission.acquireSnapshot(actorKey);
      const snapshot = await this.orderbook.getOrderbook(eventId, ticketTypeId);
      if (!this.isCurrentGeneration(state, room, generation)) {
        return this.cancelledSubscription(eventId, ticketTypeId);
      }
      await client.join(room);
      if (!this.isCurrentGeneration(state, room, generation)) {
        await client.leave(room);
        return this.cancelledSubscription(eventId, ticketTypeId);
      }
      const latest = this.realtime.latestSnapshotSince(room, initialRevision);
      state.activeRooms.add(room);
      client.emit("orderbook.snapshot", {
        eventId,
        ticketTypeId,
        snapshot: latest?.snapshot ?? snapshot,
        revision: latest?.revision ?? initialRevision,
        subscribedAt: new Date().toISOString(),
      });
      return {
        ok: true,
        eventId,
        ticketTypeId,
        alreadySubscribed: false,
      };
    } finally {
      state.pendingRooms.delete(room);
      if (!state.activeRooms.has(room)) {
        state.roomGenerations.delete(room);
      }
      snapshotLease?.release();
    }
  }

  @SubscribeMessage("orderbook.unsubscribe")
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeOrderbookInput,
  ) {
    const { eventId, ticketTypeId } = this.parseSubscription(body);
    const room = this.realtime.roomName(eventId, ticketTypeId);
    const state = this.subscriptionState(client);
    if (state.activeRooms.has(room) || state.pendingRooms.has(room)) {
      this.nextGeneration(state, room);
    }
    state.activeRooms.delete(room);
    await client.leave(room);
    if (!state.pendingRooms.has(room)) {
      state.roomGenerations.delete(room);
    }
    return {
      ok: true,
      eventId,
      ticketTypeId,
    };
  }

  private parseSubscription(body: SubscribeOrderbookInput) {
    if (!isFanPassId(body?.eventId) || !isFanPassId(body.ticketTypeId)) {
      throw new BadRequestException("eventId and ticketTypeId are invalid");
    }
    return {
      eventId: body.eventId,
      ticketTypeId: body.ticketTypeId,
    };
  }

  private subscriptionState(client: Socket): OrderbookSubscriptionState {
    const existing = client.data.orderbookSubscriptions as
      OrderbookSubscriptionState | undefined;
    if (existing) {
      return existing;
    }
    const state: OrderbookSubscriptionState = {
      activeRooms: new Set<string>(),
      pendingRooms: new Set<string>(),
      roomGenerations: new Map<string, number>(),
    };
    client.data.orderbookSubscriptions = state;
    return state;
  }

  private actorKey(client: Socket) {
    return this.admission.actorKey(client.request);
  }

  private nextGeneration(state: OrderbookSubscriptionState, room: string) {
    const generation = (state.roomGenerations.get(room) ?? 0) + 1;
    state.roomGenerations.set(room, generation);
    return generation;
  }

  private isCurrentGeneration(
    state: OrderbookSubscriptionState,
    room: string,
    generation: number,
  ) {
    return state.roomGenerations.get(room) === generation;
  }

  private cancelledSubscription(eventId: string, ticketTypeId: string) {
    return {
      ok: true,
      eventId,
      ticketTypeId,
      alreadySubscribed: false,
      cancelled: true,
    };
  }

  private subscriptionError(error: unknown) {
    if (error instanceof OrderbookAdmissionError) {
      return new WsException({
        code: error.code,
        message: error.message,
        retryAfterMs: error.retryAfterMs,
      });
    }
    const message =
      typeof error === "string" ? error : "Orderbook subscription rejected";
    return new WsException({
      code: "ORDERBOOK_SUBSCRIPTION_REJECTED",
      message,
      retryAfterMs: 250,
    });
  }
}
