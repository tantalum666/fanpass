import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  IsBoolean,
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
import {
  CurrentSession,
  PublicRoute,
  Roles,
} from "../../common/auth.decorators";
import { FanPassAuthGuard } from "../../common/fanpass-auth.guard";
import { FanPassIdParamPipe } from "../../common/route-param.pipe";
import { FanPassSession } from "../../common/session";
import { EventsService } from "./events.service";

class CreateEventDto {
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

class CreateTicketTypeDto {
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

@Controller("/events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @PublicRoute()
  listEvents() {
    return this.events.listEvents();
  }

  @Get(":id")
  @PublicRoute()
  getEvent(@Param("id", FanPassIdParamPipe) id: string) {
    return this.events.getEvent(id);
  }

  @Post()
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  createEvent(
    @Body() body: CreateEventDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.events.createEvent(body, session);
  }

  @Post(":eventId/ticket-types")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  createTicketType(
    @Param("eventId", FanPassIdParamPipe) eventId: string,
    @Body() body: CreateTicketTypeDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.events.createTicketType(eventId, body, session);
  }
}
