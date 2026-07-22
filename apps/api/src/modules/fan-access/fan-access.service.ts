import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { DemoStore } from "../../common/demo-store";
import {
  FanCampaignRecord,
  FanTaskRecord,
  FanTaskSubmissionRecord,
} from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import { FanPassSession } from "../../common/session";
import { AuditService } from "../audit/audit.service";

export interface SubmitTaskInput {
  userId: string;
  proof?: string;
}

export interface SaveCampaignTaskInput {
  id?: string;
  title: string;
  description: string;
  taskType: FanTaskRecord["taskType"];
  points: number;
  verificationMethod: FanTaskRecord["verificationMethod"];
  verificationLabel: string;
  actionKind: string;
  optional: boolean;
}

export interface SaveCampaignInput {
  title: string;
  description: string;
  rewardTitle: string;
  rewardDescription: string;
  rewardSupply: number;
  qualificationPoints: number;
  allocationMethod: "EQUAL_DRAW" | "GUARANTEED";
  status: "DRAFT" | "ACTIVE";
  startsAt: string;
  closesAt: string;
  tasks: SaveCampaignTaskInput[];
}

export interface ReviewSubmissionInput {
  decision: "APPROVED" | "REJECTED";
  reason: string;
}

@Injectable()
export class FanAccessService {
  constructor(
    private readonly store: DemoStore,
    private readonly audit: AuditService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async listTasks(eventId: string) {
    const campaign = await this.getCampaign(eventId);
    return campaign?.tasks ?? [];
  }

  getCampaign(eventId: string) {
    const now = new Date();
    const prisma = this.prismaClient();
    if (prisma) {
      return prisma.fanCampaign
        .findFirst({
          where: {
            eventId,
            event: { status: "PUBLISHED" },
            status: "ACTIVE",
            startsAt: { lte: now },
            closesAt: { gt: now },
          },
          include: {
            tasks: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            },
          },
          orderBy: { createdAt: "desc" },
        })
        .then((campaign) =>
          campaign
            ? {
                ...this.publicCampaign(this.mapPrismaCampaign(campaign)),
                tasks: campaign.tasks.map((task) => this.mapPrismaTask(task)),
              }
            : null,
        );
    }

    const event = this.store.events.find(
      (candidate) =>
        candidate.id === eventId && candidate.status === "PUBLISHED",
    );
    if (!event) {
      return null;
    }
    const campaign = this.store.fanCampaigns.find(
      (candidate) =>
        candidate.eventId === eventId &&
        candidate.status === "ACTIVE" &&
        this.isCampaignOpen(candidate, now),
    );
    if (!campaign) {
      return null;
    }
    return {
      ...this.publicCampaign(campaign),
      tasks: this.store.fanTasks
        .filter((task) => task.campaignId === campaign.id)
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)),
    };
  }

  async submitTask(taskId: string, input: SubmitTaskInput) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.submitPrismaTask(prisma, taskId, input);
    }

    const task = this.store.fanTasks.find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    const campaign = this.store.fanCampaigns.find(
      (candidate) => candidate.id === task.campaignId,
    );
    if (
      this.store.events.find((event) => event.id === task.eventId)?.status !==
        "PUBLISHED" ||
      !campaign ||
      campaign.status !== "ACTIVE" ||
      !this.isCampaignOpen(campaign)
    ) {
      throw new BadRequestException("This Fan Access task is not available");
    }
    const existing = this.store.fanTaskSubmissions.find(
      (submission) =>
        submission.userId === input.userId && submission.taskId === taskId,
    );
    if (existing) {
      return existing;
    }

    const status = await this.submissionStatusForTask(task, input);
    const submission: FanTaskSubmissionRecord = {
      id: `fts_${randomUUID()}`,
      userId: input.userId,
      taskId,
      proof: status === "APPROVED" ? "server-verified" : input.proof!.trim(),
      status,
    };
    this.store.fanTaskSubmissions.unshift(submission);
    this.audit.record(input.userId, "FAN_TASK_SUBMITTED", "fan_task", taskId, {
      status,
      verificationMethod: task.verificationMethod,
    });
    return submission;
  }

  async getScore(eventId: string, userId: string, session: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      await this.assertPrismaFanScoreReader(prisma, eventId, userId, session);
      return this.getPrismaScore(prisma, eventId, userId);
    }

    this.assertDemoFanScoreReader(eventId, userId, session);
    const campaign = this.store.fanCampaigns.find(
      (candidate) =>
        candidate.eventId === eventId &&
        candidate.status === "ACTIVE" &&
        this.isCampaignOpen(candidate),
    );
    const tasks = this.store.fanTasks.filter((task) =>
      campaign ? task.campaignId === campaign.id : task.eventId === eventId,
    );
    const approvedTaskIds = new Set(
      this.store.fanTaskSubmissions
        .filter(
          (submission) =>
            submission.userId === userId && submission.status === "APPROVED",
        )
        .map((submission) => submission.taskId),
    );
    const completedTaskIds: string[] = [];
    let fanScore = 0;
    for (const task of tasks) {
      const completed =
        approvedTaskIds.has(task.id) ||
        (task.verificationMethod === "AUTO" &&
          this.isDemoTaskSatisfied(task, userId));
      if (completed) {
        completedTaskIds.push(task.id);
        fanScore += task.points;
      }
    }
    return this.scoreResponse(
      eventId,
      userId,
      campaign?.id ?? null,
      fanScore,
      campaign?.qualificationPoints ?? 40,
      completedTaskIds,
    );
  }

  async saveCampaign(
    eventId: string,
    input: SaveCampaignInput,
    session: FanPassSession,
  ) {
    this.assertCampaignInput(input);
    const prisma = this.prismaClient();
    if (prisma) {
      const event = await this.assertPrismaEventManager(
        prisma,
        eventId,
        session,
      );
      if (input.status === "ACTIVE" && event.status !== "PUBLISHED") {
        throw new BadRequestException(
          "A Fan Access campaign can only activate for a published event",
        );
      }
      return prisma.$transaction(async (tx) => {
        const existing = await tx.fanCampaign.findFirst({
          where: { eventId, status: { not: "ARCHIVED" } },
          include: { tasks: true },
          orderBy: { createdAt: "desc" },
        });
        const campaign = existing
          ? await tx.fanCampaign.update({
              where: { id: existing.id },
              data: this.prismaCampaignWrite(input),
            })
          : await tx.fanCampaign.create({
              data: {
                id: `fac_${randomUUID()}`,
                eventId,
                createdByUserId: session.userId,
                ...this.prismaCampaignWrite(input),
              },
            });

        const existingTaskIds = new Set(
          existing?.tasks.map((task) => task.id) ?? [],
        );
        for (const [sortOrder, task] of input.tasks.entries()) {
          const taskId = task.id ?? `fat_${randomUUID()}`;
          if (task.id && !existingTaskIds.has(task.id)) {
            throw new BadRequestException(
              "Campaign task does not belong to this campaign",
            );
          }
          await tx.fanTask.upsert({
            where: { id: taskId },
            create: {
              id: taskId,
              eventId,
              campaignId: campaign.id,
              sortOrder,
              ...this.prismaTaskWrite(task),
            },
            update: {
              sortOrder,
              ...this.prismaTaskWrite(task),
            },
          });
        }

        const retainedTaskIds = input.tasks.flatMap((task) =>
          task.id ? [task.id] : [],
        );
        const omittedTasks = existing?.tasks.filter(
          (task) => !retainedTaskIds.includes(task.id),
        );
        if (omittedTasks?.length) {
          const submissionCount = await tx.fanTaskSubmission.count({
            where: { taskId: { in: omittedTasks.map((task) => task.id) } },
          });
          if (submissionCount > 0) {
            throw new ConflictException(
              "Tasks with submissions cannot be removed from a campaign",
            );
          }
          await tx.fanTask.deleteMany({
            where: { id: { in: omittedTasks.map((task) => task.id) } },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: session.userId,
            action: existing ? "FAN_CAMPAIGN_UPDATED" : "FAN_CAMPAIGN_CREATED",
            entityType: "fan_campaign",
            entityId: campaign.id,
            metadataJson: {
              eventId,
              taskCount: input.tasks.length,
              status: input.status,
            } as Prisma.InputJsonValue,
          },
        });
        const saved = await tx.fanCampaign.findUniqueOrThrow({
          where: { id: campaign.id },
          include: {
            tasks: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            },
          },
        });
        return {
          ...this.publicCampaign(this.mapPrismaCampaign(saved)),
          tasks: saved.tasks.map((task) => this.mapPrismaTask(task)),
        };
      });
    }

    const event = this.assertDemoEventManager(eventId, session);
    if (input.status === "ACTIVE" && event.status !== "PUBLISHED") {
      throw new BadRequestException(
        "A Fan Access campaign can only activate for a published event",
      );
    }
    const existing = this.store.fanCampaigns.find(
      (candidate) =>
        candidate.eventId === eventId && candidate.status !== "ARCHIVED",
    );
    const campaign: FanCampaignRecord = {
      id: existing?.id ?? `fac_${randomUUID()}`,
      eventId,
      title: input.title,
      description: input.description,
      rewardTitle: input.rewardTitle,
      rewardDescription: input.rewardDescription,
      rewardSupply: input.rewardSupply,
      qualificationPoints: input.qualificationPoints,
      allocationMethod: input.allocationMethod,
      status: input.status,
      startsAt: new Date(input.startsAt).toISOString(),
      closesAt: new Date(input.closesAt).toISOString(),
      maxLinkedWallets: 5,
      maxActiveEarningWallets: 3,
      createdByUserId: existing?.createdByUserId ?? session.userId,
    };
    if (existing) {
      Object.assign(existing, campaign);
    } else {
      this.store.fanCampaigns.push(campaign);
    }
    this.store.fanTasks.splice(
      0,
      this.store.fanTasks.length,
      ...this.store.fanTasks.filter((task) => task.campaignId !== campaign.id),
      ...input.tasks.map((task, sortOrder) => ({
        id: task.id ?? `fat_${randomUUID()}`,
        eventId,
        campaignId: campaign.id,
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        points: task.points,
        verificationMethod: task.verificationMethod,
        verificationLabel: task.verificationLabel,
        actionKind: task.actionKind,
        optional: task.optional,
        sortOrder,
      })),
    );
    this.audit.record(
      session.userId,
      existing ? "FAN_CAMPAIGN_UPDATED" : "FAN_CAMPAIGN_CREATED",
      "fan_campaign",
      campaign.id,
      { eventId, taskCount: input.tasks.length, status: input.status },
    );
    return {
      ...this.publicCampaign(campaign),
      tasks: this.store.fanTasks
        .filter((task) => task.campaignId === campaign.id)
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)),
    };
  }

  async reviewSubmission(
    submissionId: string,
    input: ReviewSubmissionInput,
    session: FanPassSession,
  ) {
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException("A review reason is required");
    }
    const prisma = this.prismaClient();
    if (prisma) {
      const submission = await prisma.fanTaskSubmission.findUnique({
        where: { id: submissionId },
        include: { task: true },
      });
      if (!submission) {
        throw new NotFoundException(`Submission ${submissionId} not found`);
      }
      const event = await this.assertPrismaEventManager(
        prisma,
        submission.task.eventId,
        session,
      );
      if (event.status !== "PUBLISHED") {
        throw new BadRequestException(
          "Fan Access submissions cannot be reviewed before event publication",
        );
      }
      if (submission.status !== "PENDING") {
        if (submission.status === input.decision) {
          return this.mapPrismaSubmission(submission);
        }
        throw new ConflictException("Submission already has a final decision");
      }
      const updated = await prisma.fanTaskSubmission.update({
        where: { id: submissionId },
        data: {
          status: input.decision,
          reviewReason: reason,
          reviewedBy: session.userId,
          reviewedAt: new Date(),
        },
      });
      await this.audit.record(
        session.userId,
        "FAN_TASK_REVIEWED",
        "fan_task_submission",
        submissionId,
        { decision: input.decision, reason },
      );
      return this.mapPrismaSubmission(updated);
    }

    const submission = this.store.fanTaskSubmissions.find(
      (candidate) => candidate.id === submissionId,
    );
    if (!submission) {
      throw new NotFoundException(`Submission ${submissionId} not found`);
    }
    const task = this.store.fanTasks.find(
      (candidate) => candidate.id === submission.taskId,
    );
    if (!task) {
      throw new NotFoundException(`Task ${submission.taskId} not found`);
    }
    const event = this.assertDemoEventManager(task.eventId, session);
    if (event.status !== "PUBLISHED") {
      throw new BadRequestException(
        "Fan Access submissions cannot be reviewed before event publication",
      );
    }
    if (submission.status !== "PENDING") {
      if (submission.status === input.decision) {
        return submission;
      }
      throw new ConflictException("Submission already has a final decision");
    }
    submission.status = input.decision;
    this.audit.record(
      session.userId,
      "FAN_TASK_REVIEWED",
      "fan_task_submission",
      submissionId,
      { decision: input.decision, reason },
    );
    return submission;
  }

  private async submitPrismaTask(
    prisma: PrismaService,
    taskId: string,
    input: SubmitTaskInput,
  ) {
    const now = new Date();
    const task = await prisma.fanTask.findUnique({
      where: { id: taskId },
      include: { campaign: true, event: { select: { status: true } } },
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    if (
      task.event.status !== "PUBLISHED" ||
      !task.campaign ||
      task.campaign.status !== "ACTIVE" ||
      task.campaign.startsAt > now ||
      task.campaign.closesAt <= now
    ) {
      throw new BadRequestException("This Fan Access task is not available");
    }

    const status =
      task.verificationMethod === "AUTO"
        ? (await this.isPrismaTaskSatisfied(prisma, task, input.userId))
          ? "APPROVED"
          : null
        : "PENDING";
    if (!status) {
      throw new BadRequestException(
        "This task has not been verified by FanPass yet",
      );
    }
    const proof =
      status === "APPROVED"
        ? "server-verified"
        : this.requiredManualProof(input.proof);
    const submission = await prisma.fanTaskSubmission.upsert({
      where: {
        userId_taskId: { userId: input.userId, taskId },
      },
      create: {
        id: `fts_${randomUUID()}`,
        userId: input.userId,
        taskId,
        proof,
        status,
      },
      update: {},
    });

    await this.audit.record(
      input.userId,
      "FAN_TASK_SUBMITTED",
      "fan_task",
      taskId,
      { status, verificationMethod: task.verificationMethod },
    );
    return this.mapPrismaSubmission(submission);
  }

  private async getPrismaScore(
    prisma: PrismaService,
    eventId: string,
    userId: string,
  ) {
    const now = new Date();
    const campaign = await prisma.fanCampaign.findFirst({
      where: {
        eventId,
        status: "ACTIVE",
        startsAt: { lte: now },
        closesAt: { gt: now },
      },
      include: { tasks: true },
      orderBy: { createdAt: "desc" },
    });
    const tasks = campaign
      ? campaign.tasks
      : await prisma.fanTask.findMany({ where: { eventId } });
    const approvedSubmissions = await prisma.fanTaskSubmission.findMany({
      where: {
        userId,
        status: "APPROVED",
        taskId: { in: tasks.map((task) => task.id) },
      },
    });
    const approvedTaskIds = new Set(
      approvedSubmissions.map((submission) => submission.taskId),
    );
    const completedTaskIds: string[] = [];
    let fanScore = 0;
    for (const task of tasks) {
      const completed =
        approvedTaskIds.has(task.id) ||
        (task.verificationMethod === "AUTO" &&
          (await this.isPrismaTaskSatisfied(prisma, task, userId)));
      if (completed) {
        completedTaskIds.push(task.id);
        fanScore += task.points;
      }
    }
    return this.scoreResponse(
      eventId,
      userId,
      campaign?.id ?? null,
      fanScore,
      campaign?.qualificationPoints ?? 40,
      completedTaskIds,
    );
  }

  private scoreResponse(
    eventId: string,
    userId: string,
    campaignId: string | null,
    fanScore: number,
    qualificationPoints: number,
    completedTaskIds: string[],
  ) {
    const boundedScore = Math.max(0, fanScore);
    const eligible = boundedScore >= qualificationPoints;
    return {
      userId,
      eventId,
      campaignId,
      score: boundedScore,
      fanScore: boundedScore,
      qualificationPoints,
      pointsToQualify: Math.max(0, qualificationPoints - boundedScore),
      completedTaskIds,
      entitlementStatus: eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
    };
  }

  private isCampaignOpen(
    campaign: Pick<FanCampaignRecord, "startsAt" | "closesAt">,
    now = new Date(),
  ) {
    const nowMs = now.getTime();
    return (
      Date.parse(campaign.startsAt) <= nowMs &&
      Date.parse(campaign.closesAt) > nowMs
    );
  }

  private async submissionStatusForTask(
    task: FanTaskRecord,
    input: SubmitTaskInput,
  ): Promise<FanTaskSubmissionRecord["status"]> {
    if (task.verificationMethod === "AUTO") {
      if (!this.isDemoTaskSatisfied(task, input.userId)) {
        throw new BadRequestException(
          "This task has not been verified by FanPass yet",
        );
      }
      return "APPROVED";
    }
    this.requiredManualProof(input.proof);
    return "PENDING";
  }

  private requiredManualProof(proof: string | undefined) {
    const value = proof?.trim() ?? "";
    if (!value) {
      throw new BadRequestException("Manual tasks require proof");
    }
    return value;
  }

  private isDemoTaskSatisfied(task: FanTaskRecord, userId: string) {
    if (task.taskType === "TICKET_HOLD") {
      return this.store.tickets.some(
        (ticket) =>
          ticket.ownerId === userId &&
          ticket.eventId === task.eventId &&
          !["CANCELLED", "REFUNDED", "EXPIRED"].includes(ticket.status),
      );
    }
    if (task.taskType === "CHECK_IN") {
      return this.store.tickets.some(
        (ticket) =>
          ticket.ownerId === userId &&
          ticket.eventId === task.eventId &&
          ticket.status === "REDEEMED",
      );
    }
    if (task.taskType === "PURCHASE_HISTORY") {
      return this.store.orders.some(
        (order) =>
          order.userId === userId &&
          order.eventId === task.eventId &&
          ["MATCHED", "SETTLED"].includes(order.status),
      );
    }
    return false;
  }

  private async isPrismaTaskSatisfied(
    prisma: PrismaService,
    task: { eventId: string; taskType: string },
    userId: string,
  ) {
    if (task.taskType === "TICKET_HOLD") {
      return (
        (await prisma.ticket.count({
          where: {
            eventId: task.eventId,
            ownerId: userId,
            status: {
              in: ["ACTIVE", "LISTED_FOR_RESALE", "TRANSFERRED", "REDEEMED"],
            },
          },
        })) > 0
      );
    }
    if (task.taskType === "CHECK_IN") {
      return (
        (await prisma.ticket.count({
          where: { eventId: task.eventId, ownerId: userId, status: "REDEEMED" },
        })) > 0
      );
    }
    if (task.taskType === "PURCHASE_HISTORY") {
      return (
        (await prisma.order.count({
          where: {
            eventId: task.eventId,
            userId,
            status: { in: ["MATCHED", "SETTLED"] },
          },
        })) > 0
      );
    }
    return false;
  }

  private assertCampaignInput(input: SaveCampaignInput) {
    if (input.tasks.length < 1 || input.tasks.length > 3) {
      throw new BadRequestException("Campaigns require one to three tasks");
    }
    const startsAt = Date.parse(input.startsAt);
    const closesAt = Date.parse(input.closesAt);
    if (!Number.isFinite(startsAt) || !Number.isFinite(closesAt)) {
      throw new BadRequestException("Campaign dates must be valid ISO dates");
    }
    if (closesAt <= startsAt) {
      throw new BadRequestException(
        "Campaign close must be after campaign start",
      );
    }
    const availablePoints = input.tasks.reduce(
      (sum, task) => sum + task.points,
      0,
    );
    if (input.qualificationPoints > availablePoints) {
      throw new BadRequestException(
        "Qualification points must be reachable from campaign tasks",
      );
    }
    const requiredPoints = input.tasks
      .filter((task) => !task.optional)
      .reduce((sum, task) => sum + task.points, 0);
    if (
      input.tasks.every((task) => !task.optional) &&
      requiredPoints === input.qualificationPoints
    ) {
      throw new BadRequestException(
        "At least one task must remain optional when every task is needed to qualify",
      );
    }
    const socialPoints = input.tasks
      .filter((task) => ["FOLLOW", "SHARE"].includes(task.taskType))
      .reduce((sum, task) => sum + task.points, 0);
    if (socialPoints > Math.max(5, Math.floor(availablePoints * 0.1))) {
      throw new BadRequestException(
        "Social task points cannot exceed the V1 campaign cap",
      );
    }
  }

  private async assertPrismaEventManager(
    prisma: PrismaService,
    eventId: string,
    session: FanPassSession,
  ) {
    if (session.role === "ADMIN") {
      return prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    }
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { organizer: true },
    });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    if (
      session.role !== "ORGANIZER" ||
      event.organizer.userId !== session.userId
    ) {
      throw new ForbiddenException("Event is outside this organizer workspace");
    }
    return event;
  }

  private assertDemoEventManager(eventId: string, session: FanPassSession) {
    const event = this.store.events.find(
      (candidate) => candidate.id === eventId,
    );
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    if (session.role === "ADMIN") {
      return event;
    }
    const organizer = this.store.organizers.find(
      (candidate) => candidate.id === event.organizerId,
    );
    if (session.role !== "ORGANIZER" || organizer?.userId !== session.userId) {
      throw new ForbiddenException("Event is outside this organizer workspace");
    }
    return event;
  }

  private async assertPrismaFanScoreReader(
    prisma: PrismaService,
    eventId: string,
    userId: string,
    session: FanPassSession,
  ) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { organizer: true },
    });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    if (session.role === "ADMIN") {
      return;
    }
    if (session.role === "FAN") {
      if (session.userId !== userId) {
        throw new ForbiddenException(
          "Fans can only view their own fan access score",
        );
      }
      if (event.status !== "PUBLISHED") {
        throw new BadRequestException("Fan Access is not available");
      }
      return;
    }
    if (
      session.role !== "ORGANIZER" ||
      event.organizer.userId !== session.userId
    ) {
      throw new ForbiddenException("Event is outside this organizer workspace");
    }
  }

  private assertDemoFanScoreReader(
    eventId: string,
    userId: string,
    session: FanPassSession,
  ) {
    const event = this.store.events.find(
      (candidate) => candidate.id === eventId,
    );
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    if (session.role === "ADMIN") {
      return;
    }
    if (session.role === "FAN") {
      if (session.userId !== userId) {
        throw new ForbiddenException(
          "Fans can only view their own fan access score",
        );
      }
      if (event.status !== "PUBLISHED") {
        throw new BadRequestException("Fan Access is not available");
      }
      return;
    }
    const organizer = this.store.organizers.find(
      (candidate) => candidate.id === event.organizerId,
    );
    if (session.role !== "ORGANIZER" || organizer?.userId !== session.userId) {
      throw new ForbiddenException("Event is outside this organizer workspace");
    }
  }

  private prismaCampaignWrite(input: SaveCampaignInput) {
    return {
      title: input.title,
      description: input.description,
      rewardTitle: input.rewardTitle,
      rewardDescription: input.rewardDescription,
      rewardSupply: input.rewardSupply,
      qualificationPoints: input.qualificationPoints,
      allocationMethod: input.allocationMethod,
      status: input.status,
      startsAt: new Date(input.startsAt),
      closesAt: new Date(input.closesAt),
      maxLinkedWallets: 5,
      maxActiveEarningWallets: 3,
    } as const;
  }

  private prismaTaskWrite(task: SaveCampaignTaskInput) {
    return {
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      points: task.points,
      verificationMethod: task.verificationMethod,
      verificationLabel: task.verificationLabel,
      actionKind: task.actionKind,
      optional: task.optional,
    };
  }

  private mapPrismaCampaign(campaign: {
    id: string;
    eventId: string;
    title: string;
    description: string;
    rewardTitle: string;
    rewardDescription: string;
    rewardSupply: number;
    qualificationPoints: number;
    allocationMethod: string;
    status: string;
    startsAt: Date;
    closesAt: Date;
    maxLinkedWallets: number;
    maxActiveEarningWallets: number;
    createdByUserId: string;
  }): FanCampaignRecord {
    return {
      id: campaign.id,
      eventId: campaign.eventId,
      title: campaign.title,
      description: campaign.description,
      rewardTitle: campaign.rewardTitle,
      rewardDescription: campaign.rewardDescription,
      rewardSupply: campaign.rewardSupply,
      qualificationPoints: campaign.qualificationPoints,
      allocationMethod:
        campaign.allocationMethod as FanCampaignRecord["allocationMethod"],
      status: campaign.status as FanCampaignRecord["status"],
      startsAt: campaign.startsAt.toISOString(),
      closesAt: campaign.closesAt.toISOString(),
      maxLinkedWallets: campaign.maxLinkedWallets,
      maxActiveEarningWallets: campaign.maxActiveEarningWallets,
      createdByUserId: campaign.createdByUserId,
    };
  }

  private publicCampaign(campaign: FanCampaignRecord) {
    const {
      createdByUserId: _createdByUserId,
      maxLinkedWallets: _maxLinkedWallets,
      maxActiveEarningWallets: _maxActiveEarningWallets,
      ...publicCampaign
    } = campaign;
    return publicCampaign;
  }

  private mapPrismaTask(task: {
    id: string;
    eventId: string;
    campaignId: string | null;
    title: string;
    description: string;
    taskType: string;
    points: number;
    verificationMethod: string;
    verificationLabel: string;
    actionKind: string;
    actionTarget: string | null;
    optional: boolean;
    sortOrder: number;
  }): FanTaskRecord {
    return {
      id: task.id,
      eventId: task.eventId,
      campaignId: task.campaignId,
      title: task.title,
      description: task.description,
      taskType: task.taskType as FanTaskRecord["taskType"],
      points: task.points,
      verificationMethod:
        task.verificationMethod as FanTaskRecord["verificationMethod"],
      verificationLabel: task.verificationLabel,
      actionKind: task.actionKind,
      actionTarget: task.actionTarget,
      optional: task.optional,
      sortOrder: task.sortOrder,
    };
  }

  private mapPrismaSubmission(submission: {
    id: string;
    userId: string;
    taskId: string;
    proof: string;
    status: FanTaskSubmissionRecord["status"];
  }): FanTaskSubmissionRecord {
    return {
      id: submission.id,
      userId: submission.userId,
      taskId: submission.taskId,
      proof: submission.proof,
      status: submission.status,
    };
  }

  private prismaClient() {
    return process.env.FANPASS_DATA_SOURCE === "prisma"
      ? this.prisma
      : undefined;
  }
}
