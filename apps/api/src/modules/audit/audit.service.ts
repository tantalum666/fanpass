import { Injectable, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DemoStore } from "../../common/demo-store";
import { PrismaService } from "../../common/prisma.service";

@Injectable()
export class AuditService {
  constructor(
    private readonly store: DemoStore,
    @Optional() private readonly prisma?: PrismaService
  ) {}

  record(actorId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
    const prisma = this.prismaClient();
    if (prisma) {
      return prisma.auditLog.create({
        data: {
          actorId,
          action,
          entityType,
          entityId,
          metadataJson: metadata as Prisma.InputJsonValue
        }
      });
    }

    this.store.audit(actorId, action, entityType, entityId, metadata);
    return undefined;
  }

  list() {
    const prisma = this.prismaClient();
    if (prisma) {
      return prisma.auditLog
        .findMany({
          orderBy: {
            createdAt: "desc"
          }
        })
        .then((logs) =>
          logs.map((log) => ({
            id: log.id,
            actorId: log.actorId,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            metadata: log.metadataJson as Record<string, unknown>,
            createdAt: log.createdAt.toISOString()
          }))
        );
    }

    return this.store.auditLogs;
  }

  private prismaClient() {
    return process.env.FANPASS_DATA_SOURCE === "prisma" ? this.prisma : undefined;
  }
}
