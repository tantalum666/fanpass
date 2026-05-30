import { BadRequestException } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { OrderbookRealtimeService } from "./orderbook-realtime.service";
import { OrderbookService } from "./orderbook.service";

interface SubscribeOrderbookInput {
  eventId?: unknown;
  ticketTypeId?: unknown;
}

@WebSocketGateway({
  namespace: "/orderbook",
})
export class OrderbookGateway implements OnGatewayInit {
  constructor(
    private readonly orderbook: OrderbookService,
    private readonly realtime: OrderbookRealtimeService,
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
    await client.join(room);
    const snapshot = await this.orderbook.getOrderbook(eventId, ticketTypeId);
    client.emit("orderbook.snapshot", {
      eventId,
      ticketTypeId,
      snapshot,
      subscribedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      eventId,
      ticketTypeId,
    };
  }

  @SubscribeMessage("orderbook.unsubscribe")
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeOrderbookInput,
  ) {
    const { eventId, ticketTypeId } = this.parseSubscription(body);
    await client.leave(this.realtime.roomName(eventId, ticketTypeId));
    return {
      ok: true,
      eventId,
      ticketTypeId,
    };
  }

  private parseSubscription(body: SubscribeOrderbookInput) {
    if (
      typeof body?.eventId !== "string" ||
      typeof body.ticketTypeId !== "string" ||
      !body.eventId.trim() ||
      !body.ticketTypeId.trim()
    ) {
      throw new BadRequestException("eventId and ticketTypeId are required");
    }
    return {
      eventId: body.eventId.trim(),
      ticketTypeId: body.ticketTypeId.trim(),
    };
  }
}
