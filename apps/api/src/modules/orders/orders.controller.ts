import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";
import {
  CurrentSession,
  PublicRoute,
  Roles,
} from "../../common/auth.decorators";
import { FanPassAuthGuard } from "../../common/fanpass-auth.guard";
import { FanPassIdParamPipe } from "../../common/route-param.pipe";
import { FanPassSession } from "../../common/session";
import { OrderbookService } from "./orderbook.service";

class CreateOrderDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  userId?: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  eventId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  ticketTypeId!: string;

  @IsIn(["BUY", "SELL"])
  side!: "BUY" | "SELL";

  @IsNumber()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  price!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  ticketId?: string;
}

class CancelOrderDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  userId?: string;
}

@Controller("/orders")
export class OrdersController {
  constructor(private readonly orderbook: OrderbookService) {}

  @Get("/events/:eventId/ticket-types/:ticketTypeId/book")
  @PublicRoute()
  getOrderbook(
    @Param("eventId", FanPassIdParamPipe) eventId: string,
    @Param("ticketTypeId", FanPassIdParamPipe) ticketTypeId: string,
  ) {
    return this.orderbook.getOrderbook(eventId, ticketTypeId);
  }

  @Get("/users/:userId")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  listUserOrders(
    @Param("userId", FanPassIdParamPipe) userId: string,
    @CurrentSession() session: FanPassSession,
  ) {
    if (session.role === "FAN" && session.userId !== userId) {
      throw new ForbiddenException("Fans can only view their own orders");
    }
    return this.orderbook.listUserOrders(userId);
  }

  @Post()
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  createOrder(
    @Body() body: CreateOrderDto,
    @CurrentSession() session: FanPassSession,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.orderbook.createOrder({
      ...body,
      userId: session.userId,
      idempotencyKey,
    });
  }

  @Post("/:orderId/match")
  @UseGuards(FanPassAuthGuard)
  @Roles("ADMIN")
  matchOrder(@Param("orderId", FanPassIdParamPipe) orderId: string) {
    return this.orderbook.tryMatch(orderId);
  }

  @Post("/:orderId/cancel")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  cancelOrder(
    @Param("orderId", FanPassIdParamPipe) orderId: string,
    @Body() _body: CancelOrderDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.orderbook.cancelOrder(orderId, {
      userId: session.userId,
    });
  }
}
