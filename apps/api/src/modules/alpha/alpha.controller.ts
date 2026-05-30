import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { CurrentSession, Roles } from "../../common/auth.decorators";
import { FanPassAuthGuard } from "../../common/fanpass-auth.guard";
import { FanPassIdParamPipe } from "../../common/route-param.pipe";
import { FanPassSession } from "../../common/session";
import { SideEffectHealthService } from "../side-effects/side-effect-health.service";
import { AlphaPersistenceService } from "./alpha-persistence.service";

class CreateAlphaEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  venueName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  city!: string;

  @IsISO8601()
  startTime!: string;

  @IsISO8601()
  endTime!: string;
}

class CreateAlphaTicketTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsNumber()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  faceValue!: number;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsNumber()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  supply!: number;

  @IsBoolean()
  transferable!: boolean;

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  resaleCap?: number;

  @IsNumber()
  @IsInt()
  @Min(0)
  @Max(100)
  maxTransferCount!: number;
}

class CreateGateAssignmentDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  eventId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(24)
  gate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  staffName!: string;

  @IsEmail()
  staffEmail!: string;
}

@Controller("/alpha")
export class AlphaController {
  constructor(
    private readonly persistence: AlphaPersistenceService,
    private readonly sideEffectHealth: SideEffectHealthService,
  ) {}

  @Get("/persistence/status")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  persistenceStatus(@CurrentSession() session: FanPassSession) {
    return this.persistence.status(session);
  }

  @Get("/operations")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  operationsSnapshot(@CurrentSession() session: FanPassSession) {
    return this.persistence.operationsSnapshot(session);
  }

  @Get("/side-effects/health")
  @UseGuards(FanPassAuthGuard)
  @Roles("ADMIN")
  sideEffectHealthStatus() {
    return this.sideEffectHealth.check();
  }

  @Post("/events")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  createEvent(
    @Body() body: CreateAlphaEventDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.persistence.createEvent(body, session);
  }

  @Post("/events/:eventId/ticket-types")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  createTicketType(
    @Param("eventId", FanPassIdParamPipe) eventId: string,
    @Body() body: CreateAlphaTicketTypeDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.persistence.createTicketType(eventId, body, session);
  }

  @Post("/gate-assignments")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  createGateAssignment(
    @Body() body: CreateGateAssignmentDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.persistence.createGateAssignment(body, session);
  }

  @Post("/gate-assignments/:assignmentId/deactivate")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  deactivateGateAssignment(
    @Param("assignmentId", FanPassIdParamPipe) assignmentId: string,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.persistence.deactivateGateAssignment(assignmentId, session);
  }

  @Post("/gate-assignments/:assignmentId/invites")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  rotateStaffInvite(
    @Param("assignmentId", FanPassIdParamPipe) assignmentId: string,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.persistence.rotateStaffInvite(assignmentId, session);
  }
}
