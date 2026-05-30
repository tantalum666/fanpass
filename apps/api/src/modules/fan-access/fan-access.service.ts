import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { randomUUID } from "crypto";
import { DemoStore } from "../../common/demo-store";
import { FanTaskRecord, FanTaskSubmissionRecord } from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../audit/audit.service";

export interface SubmitTaskInput {
  userId: string;
  proof: string;
}

@Injectable()
export class FanAccessService {
  constructor(
    private readonly store: DemoStore,
    private readonly audit: AuditService,
    @Optional() private readonly prisma?: PrismaService
  ) {}

  listTasks(eventId: string) {
    const prisma = this.prismaClient();
    if (prisma) {
      return prisma.fanTask
        .findMany({
          where: { eventId },
          orderBy: { id: "asc" }
        })
        .then((tasks) => tasks.map((task) => this.mapPrismaTask(task)));
    }

    return this.store.fanTasks.filter((task) => task.eventId === eventId);
  }

  submitTask(taskId: string, input: SubmitTaskInput) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.submitPrismaTask(prisma, taskId, input);
    }

    const task = this.store.fanTasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    const status = task.verificationMethod === "AUTO" ? "APPROVED" : "PENDING";
    const submission = {
      id: `fts_${randomUUID()}`,
      userId: input.userId,
      taskId,
      proof: input.proof,
      status: status as "PENDING" | "APPROVED" | "REJECTED"
    };
    this.store.fanTaskSubmissions.unshift(submission);
    this.audit.record(input.userId, "FAN_TASK_SUBMITTED", "fan_task", taskId, { status });
    return submission;
  }

  getScore(eventId: string, userId: string) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.getPrismaScore(prisma, eventId, userId);
    }

    const approvedTaskIds = new Set(
      this.store.fanTaskSubmissions
        .filter((submission) => submission.userId === userId && submission.status === "APPROVED")
        .map((submission) => submission.taskId)
    );
    const verifiedTaskScore = this.store.fanTasks
      .filter((task) => task.eventId === eventId && approvedTaskIds.has(task.id))
      .reduce((sum, task) => sum + task.points, 0);
    const attendanceScore = this.store.tickets.some(
      (ticket) => ticket.ownerId === userId && ticket.eventId === eventId && ticket.status === "REDEEMED"
    )
      ? 30
      : 0;
    const riskPenalty = this.store.users.find((user) => user.id === userId)?.riskScore ?? 0;
    const score = Math.max(0, Math.min(100, attendanceScore + verifiedTaskScore - riskPenalty * 30));
    return {
      userId,
      eventId,
      score,
      entitlementStatus: score >= 30 ? "ELIGIBLE" : "WAITLIST"
    };
  }

  private async submitPrismaTask(prisma: PrismaService, taskId: string, input: SubmitTaskInput) {
    const task = await prisma.fanTask.findUnique({
      where: { id: taskId }
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const status = task.verificationMethod === "AUTO" ? "APPROVED" : "PENDING";
    const submission = await prisma.fanTaskSubmission.create({
      data: {
        id: `fts_${randomUUID()}`,
        userId: input.userId,
        taskId,
        proof: input.proof,
        status
      }
    });

    await this.audit.record(input.userId, "FAN_TASK_SUBMITTED", "fan_task", taskId, { status });
    return this.mapPrismaSubmission(submission);
  }

  private async getPrismaScore(prisma: PrismaService, eventId: string, userId: string) {
    const approvedSubmissions = await prisma.fanTaskSubmission.findMany({
      where: {
        userId,
        status: "APPROVED",
        task: {
          eventId
        }
      },
      include: {
        task: true
      }
    });
    const verifiedTaskScore = approvedSubmissions.reduce((sum, submission) => sum + submission.task.points, 0);
    const attendanceScore = await prisma.ticket.count({
      where: {
        eventId,
        ownerId: userId,
        status: "REDEEMED"
      }
    });
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    const riskPenalty = user?.riskScore ?? 0;
    const score = Math.max(0, Math.min(100, (attendanceScore > 0 ? 30 : 0) + verifiedTaskScore - riskPenalty * 30));
    return {
      userId,
      eventId,
      score,
      entitlementStatus: score >= 30 ? "ELIGIBLE" : "WAITLIST"
    };
  }

  private mapPrismaTask(task: {
    id: string;
    eventId: string;
    title: string;
    taskType: string;
    points: number;
    verificationMethod: string;
  }): FanTaskRecord {
    return {
      id: task.id,
      eventId: task.eventId,
      title: task.title,
      taskType: task.taskType as FanTaskRecord["taskType"],
      points: task.points,
      verificationMethod: task.verificationMethod as FanTaskRecord["verificationMethod"]
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
      status: submission.status
    };
  }

  private prismaClient() {
    return process.env.FANPASS_DATA_SOURCE === "prisma" ? this.prisma : undefined;
  }
}
