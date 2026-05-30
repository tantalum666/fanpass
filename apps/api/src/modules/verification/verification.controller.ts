import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  IsISO8601,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { CurrentSession, Roles } from "../../common/auth.decorators";
import { FanPassAuthGuard } from "../../common/fanpass-auth.guard";
import {
  FanPassIdParamPipe,
  GateCodeParamPipe,
} from "../../common/route-param.pipe";
import { FanPassSession } from "../../common/session";
import { SignedQrPayload, VerificationService } from "./verification.service";

class GenerateQrDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  ticketId!: string;
}

class RedeemDto implements SignedQrPayload {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  ticketId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  eventId!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  ownerIdHash!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,80}$/)
  nonce!: string;

  @IsString()
  @IsISO8601()
  issuedAt!: string;

  @IsString()
  @IsISO8601()
  expiresAt!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  signature!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(24)
  gate!: string;
}

@Controller("/verification")
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post("/qr")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  generateQr(
    @Body() body: GenerateQrDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.verification.createPayload(body.ticketId, session);
  }

  @Post("/redeem")
  @UseGuards(FanPassAuthGuard)
  @Roles("GATE_STAFF", "ADMIN")
  redeem(@Body() body: RedeemDto, @CurrentSession() session: FanPassSession) {
    return this.verification.redeem(body, session.userId, body.gate, session);
  }

  @Get("/events/:eventId/gates/:gate/checkins/summary")
  @UseGuards(FanPassAuthGuard)
  @Roles("GATE_STAFF", "ORGANIZER", "ADMIN")
  checkinSummary(
    @Param("eventId", FanPassIdParamPipe) eventId: string,
    @Param("gate", GateCodeParamPipe) gate: string,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.verification.checkinSummary(eventId, gate, session);
  }

  @Post("/tickets/:ticketId/qr")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  generateTicketQr(
    @Param("ticketId", FanPassIdParamPipe) ticketId: string,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.verification.createPayload(ticketId, session);
  }
}
