import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsString, Matches } from "class-validator";
import {
  CurrentSession,
  PublicRoute,
  Roles,
} from "../../common/auth.decorators";
import { FanPassAuthGuard } from "../../common/fanpass-auth.guard";
import { FanPassIdParamPipe } from "../../common/route-param.pipe";
import { FanPassSession } from "../../common/session";
import { OnsalesService } from "./onsales.service";

class JoinOnsaleQueueDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,128}$/)
  clientInstanceId!: string;
}

@Controller("/onsales")
export class OnsalesController {
  constructor(private readonly onsales: OnsalesService) {}

  @Get("/events/:eventId/snapshot")
  @PublicRoute()
  snapshot(@Param("eventId", FanPassIdParamPipe) eventId: string) {
    return this.onsales.publicSnapshot(eventId);
  }

  @Get("/events/:eventId/queue/me")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  queueStatus(
    @Param("eventId", FanPassIdParamPipe) eventId: string,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.onsales.queueStatus(eventId, session.userId);
  }

  @Post("/events/:eventId/queue/join")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  joinQueue(
    @Param("eventId", FanPassIdParamPipe) eventId: string,
    @Body() body: JoinOnsaleQueueDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.onsales.joinQueue(
      eventId,
      session.userId,
      body.clientInstanceId,
    );
  }
}
