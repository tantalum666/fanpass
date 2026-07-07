import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";
import {
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  CurrentSession,
  PublicRoute,
  Roles,
} from "../../common/auth.decorators";
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
  @IsOptional()
  @IsInt()
  v?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  credentialId?: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  ticketId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  eventId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  ticketTypeId?: string;

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

  @IsOptional()
  @IsString()
  @IsIn(["qr", "nfc"])
  entryMode?: "qr" | "nfc";

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.-]{1,63}$/)
  kid?: string;

  @IsString()
  @Matches(/^([a-f0-9]{64}|[A-Za-z0-9_-]{32,96})$/i)
  signature!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(24)
  gate!: string;
}

class ValidateNfcDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  eventId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(24)
  gate!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  ndefPayload!: string;
}

@Controller("/verification")
export class VerificationController {
  constructor(
    private readonly verification: VerificationService,
    private readonly config: ConfigService,
  ) {}

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

  @Post("/turnstile/redeem")
  @PublicRoute()
  redeemTurnstile(
    @Body() body: RedeemDto,
    @Headers("x-fanpass-turnstile-key") turnstileKey: string | string[] | undefined,
  ) {
    const scannerUserId = this.verifyTurnstileKey(turnstileKey);
    return this.verification.redeem(body, scannerUserId, body.gate, {
      userId: scannerUserId,
      role: "GATE_STAFF",
    });
  }

  @Post("/nfc/validate")
  @UseGuards(FanPassAuthGuard)
  @Roles("GATE_STAFF", "ADMIN")
  validateNfc(
    @Body() body: ValidateNfcDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.verification.validateNfcPayload(
      body.ndefPayload,
      body.eventId,
      session.userId,
      body.gate,
      session,
    );
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

  @Get("/checkins/recent")
  @UseGuards(FanPassAuthGuard)
  @Roles("GATE_STAFF", "ADMIN")
  recentCheckins(@CurrentSession() session: FanPassSession) {
    return this.verification.recentCheckins(session);
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

  private verifyTurnstileKey(header: string | string[] | undefined) {
    const configuredKey = this.config
      .get<string>("FANPASS_TURNSTILE_REDEEM_KEY")
      ?.trim();
    if (!configuredKey) {
      throw new ServiceUnavailableException("Turnstile redemption is not configured");
    }

    const suppliedKey = (Array.isArray(header) ? header[0] : header)?.trim();
    if (!suppliedKey || !this.constantTimeEqual(suppliedKey, configuredKey)) {
      throw new UnauthorizedException("Invalid turnstile key");
    }

    return (
      this.config.get<string>("FANPASS_TURNSTILE_STAFF_USER_ID")?.trim() ||
      "usr_gate_demo"
    );
  }

  private constantTimeEqual(actual: string, expected: string) {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }
}
