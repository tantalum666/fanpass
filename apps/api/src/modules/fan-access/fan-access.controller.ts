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
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
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

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  proof?: string;
}

class SaveCampaignTaskDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  description!: string;

  @IsIn([
    "FOLLOW",
    "TICKET_HOLD",
    "CHECK_IN",
    "PURCHASE_HISTORY",
    "QUIZ",
    "SHARE",
    "MANUAL",
  ])
  taskType!:
    | "FOLLOW"
    | "TICKET_HOLD"
    | "CHECK_IN"
    | "PURCHASE_HISTORY"
    | "QUIZ"
    | "SHARE"
    | "MANUAL";

  @IsInt()
  @Min(1)
  @Max(100)
  points!: number;

  @IsIn(["AUTO", "MANUAL"])
  verificationMethod!: "AUTO" | "MANUAL";

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  verificationLabel!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  actionKind!: string;

  @IsBoolean()
  optional!: boolean;
}

class SaveCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(280)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  rewardTitle!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(280)
  rewardDescription!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  rewardSupply!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  qualificationPoints!: number;

  @IsIn(["EQUAL_DRAW", "GUARANTEED"])
  allocationMethod!: "EQUAL_DRAW" | "GUARANTEED";

  @IsIn(["DRAFT", "ACTIVE"])
  status!: "DRAFT" | "ACTIVE";

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  closesAt!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveCampaignTaskDto)
  tasks!: SaveCampaignTaskDto[];
}

class ReviewSubmissionDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";

  @IsString()
  @MinLength(1)
  @MaxLength(280)
  reason!: string;
}

@Controller("/fan-access")
export class FanAccessController {
  constructor(private readonly fanAccess: FanAccessService) {}

  @Get("/events/:eventId/tasks")
  @PublicRoute()
  listTasks(@Param("eventId", FanPassIdParamPipe) eventId: string) {
    return this.fanAccess.listTasks(eventId);
  }

  @Get("/events/:eventId/campaign")
  @PublicRoute()
  getCampaign(@Param("eventId", FanPassIdParamPipe) eventId: string) {
    return this.fanAccess.getCampaign(eventId);
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

  @Post("/events/:eventId/campaign")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  saveCampaign(
    @Param("eventId", FanPassIdParamPipe) eventId: string,
    @Body() body: SaveCampaignDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.fanAccess.saveCampaign(eventId, body, session);
  }

  @Post("/submissions/:submissionId/decision")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  reviewSubmission(
    @Param("submissionId", FanPassIdParamPipe) submissionId: string,
    @Body() body: ReviewSubmissionDto,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.fanAccess.reviewSubmission(submissionId, body, session);
  }
}
