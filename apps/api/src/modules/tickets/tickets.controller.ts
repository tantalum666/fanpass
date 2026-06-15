import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { CurrentSession, Roles } from "../../common/auth.decorators";
import { FanPassAuthGuard } from "../../common/fanpass-auth.guard";
import { FanPassIdParamPipe } from "../../common/route-param.pipe";
import { FanPassSession } from "../../common/session";
import { TicketsService } from "./tickets.service";

class IssueTicketDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  eventId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  ticketTypeId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  ownerId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  seatHash?: string;
}

@Controller("/tickets")
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  listTickets(@CurrentSession() session: FanPassSession) {
    return this.tickets.listTickets(session);
  }

  @Get("/owner/:ownerId")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ORGANIZER", "ADMIN")
  listOwnedTickets(
    @Param("ownerId", FanPassIdParamPipe) ownerId: string,
    @CurrentSession() session: FanPassSession,
  ) {
    if (session.role === "FAN" && session.userId !== ownerId) {
      throw new ForbiddenException("Fans can only view their own tickets");
    }
    return this.tickets.listOwnedTickets(ownerId, session);
  }

  @Post("/issue")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  issueTicket(
    @Body() body: IssueTicketDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.tickets.issueTicket(body, session);
  }

  @Get(":id/proof-history")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ORGANIZER", "ADMIN")
  getProofHistory(
    @Param("id", FanPassIdParamPipe) id: string,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.tickets.getProofHistory(id, session);
  }

  @Get(":id/chain-proof")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ORGANIZER", "ADMIN")
  getChainProof(
    @Param("id", FanPassIdParamPipe) id: string,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.tickets.getChainProof(id, session);
  }

  @Get(":id")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  getTicket(
    @Param("id", FanPassIdParamPipe) id: string,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.tickets.getTicket(id, session);
  }
}
