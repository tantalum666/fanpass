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
import {
  CurrentSession,
  PublicRoute,
  Roles,
} from "../../common/auth.decorators";
import { FanPassAuthGuard } from "../../common/fanpass-auth.guard";
import { FanPassIdParamPipe } from "../../common/route-param.pipe";
import { FanPassSession } from "../../common/session";
import { FanAccessService } from "./fan-access.service";

class SubmitTaskDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  userId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  proof!: string;
}

@Controller("/fan-access")
export class FanAccessController {
  constructor(private readonly fanAccess: FanAccessService) {}

  @Get("/events/:eventId/tasks")
  @PublicRoute()
  listTasks(@Param("eventId", FanPassIdParamPipe) eventId: string) {
    return this.fanAccess.listTasks(eventId);
  }

  @Post("/tasks/:taskId/submissions")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  submitTask(
    @Param("taskId", FanPassIdParamPipe) taskId: string,
    @Body() body: SubmitTaskDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.fanAccess.submitTask(taskId, {
      ...body,
      userId: session.userId,
    });
  }

  @Get("/events/:eventId/users/:userId/score")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ORGANIZER", "ADMIN")
  getScore(
    @Param("eventId", FanPassIdParamPipe) eventId: string,
    @Param("userId", FanPassIdParamPipe) userId: string,
    @CurrentSession() session: FanPassSession,
  ) {
    if (session.role === "FAN" && session.userId !== userId) {
      throw new ForbiddenException(
        "Fans can only view their own fan access score",
      );
    }
    return this.fanAccess.getScore(eventId, userId);
  }
}
