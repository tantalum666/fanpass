import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { FanPassSession } from "../../common/session";

export interface CreateAlphaEventInput {
  title: string;
  venueName: string;
  city: string;
  startTime: string;
  endTime: string;
}

export interface CreateAlphaTicketTypeInput {
  name: string;
  faceValue: number;
  currency: string;
  supply: number;
  transferable: boolean;
  resaleCap?: number;
  maxTransferCount: number;
}

export interface CreateGateAssignmentInput {
  eventId: string;
  gate: string;
  staffName: string;
  staffEmail: string;
}

const STAFF_INVITE_TTL_DAYS = 7;

@Injectable()
export class AlphaPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async status(session?: FanPassSession) {
    try {
      const scope = session ? await this.resolveConsoleScope(session) : null;
      const eventWhere = scope?.eventWhere ?? {};
      const eventIds = scope ? await this.eventIdsForScope(scope) : undefined;
      const scopedEventFilter = eventIds ? { eventId: { in: eventIds } } : {};
      const scopedTicketFilter = eventIds
        ? {
            ticket: {
              eventId: {
                in: eventIds,
              },
            },
          }
        : {};
      const scopedTaskFilter = eventIds
        ? {
            task: {
              eventId: {
                in: eventIds,
              },
            },
          }
        : {};
      const scopedPaymentFilter = eventIds
        ? {
            order: {
              is: {
                eventId: {
                  in: eventIds,
                },
              },
            },
          }
        : {};
      const [
        users,
        events,
        ticketTypes,
        tickets,
        orders,
        trades,
        payments,
        checkins,
        fanTasks,
        fanTaskSubmissions,
        auditLogs,
        sideEffects,
        paymentWebhookEvents,
        gateAssignments,
        staffInvites,
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.event.count({ where: eventWhere }),
        this.prisma.ticketType.count({ where: scopedEventFilter }),
        this.prisma.ticket.count({ where: scopedEventFilter }),
        this.prisma.order.count({ where: scopedEventFilter }),
        this.prisma.trade.count({ where: scopedTicketFilter }),
        this.prisma.payment.count({ where: scopedPaymentFilter }),
        this.prisma.checkin.count({ where: scopedTicketFilter }),
        this.prisma.fanTask.count({ where: scopedEventFilter }),
        this.prisma.fanTaskSubmission.count({ where: scopedTaskFilter }),
        this.prisma.auditLog.count(),
        this.prisma.sideEffectOutbox.count(),
        this.prisma.paymentWebhookEvent.count(),
        this.prisma.gateAssignment.count({ where: scopedEventFilter }),
        this.prisma.staffInvite.count({ where: scopedEventFilter }),
      ]);

      return {
        ok: true,
        dataSource: "prisma",
        counts: {
          users,
          events,
          ticketTypes,
          tickets,
          orders,
          trades,
          payments,
          checkins,
          fanTasks,
          fanTaskSubmissions,
          auditLogs,
          sideEffects,
          paymentWebhookEvents,
          gateAssignments,
          staffInvites,
        },
      };
    } catch (error) {
      return {
        ok: false,
        dataSource: "prisma",
        message:
          error instanceof Error ? error.message : "Unknown persistence error",
      };
    }
  }

  async operationsSnapshot(session: FanPassSession) {
    try {
      const scope = await this.resolveConsoleScope(session);
      const events = await this.prisma.event.findMany({
        where: scope.eventWhere,
        include: {
          venue: true,
          ticketTypes: true,
        },
        orderBy: {
          startTime: "asc",
        },
      });
      const eventIds = events.map((event) => event.id);
      const eventTitles = new Map(
        events.map((event) => [event.id, event.title]),
      );
      const eventScopedWhere = { eventId: { in: eventIds } };
      const [
        tickets,
        orders,
        trades,
        payments,
        checkins,
        submissions,
        gateAssignments,
        staffInvites,
        auditLogCandidates,
        sideEffectCandidates,
      ] = await Promise.all([
        this.prisma.ticket.findMany({
          where: eventScopedWhere,
          include: {
            event: true,
            ticketType: true,
            owner: true,
          },
          orderBy: {
            id: "asc",
          },
        }),
        this.prisma.order.findMany({
          where: eventScopedWhere,
          orderBy: {
            createdAt: "desc",
          },
        }),
        this.prisma.trade.findMany({
          where: {
            ticket: {
              eventId: {
                in: eventIds,
              },
            },
          },
          include: {
            ticket: {
              include: {
                event: true,
                ticketType: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
        this.prisma.payment.findMany({
          where: {
            order: {
              is: {
                eventId: {
                  in: eventIds,
                },
              },
            },
          },
          include: {
            order: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
        this.prisma.checkin.findMany({
          where: {
            ticket: {
              eventId: {
                in: eventIds,
              },
            },
          },
          include: {
            ticket: true,
            scanner: true,
          },
          orderBy: {
            checkedInAt: "desc",
          },
        }),
        this.prisma.fanTaskSubmission.findMany({
          where: {
            task: {
              eventId: {
                in: eventIds,
              },
            },
          },
          include: {
            task: true,
          },
          orderBy: {
            id: "desc",
          },
        }),
        this.prisma.gateAssignment.findMany({
          where: eventScopedWhere,
          include: {
            event: true,
            staff: true,
          },
          orderBy: [
            {
              eventId: "asc",
            },
            {
              gate: "asc",
            },
            {
              createdAt: "desc",
            },
          ],
        }),
        this.prisma.staffInvite.findMany({
          where: eventScopedWhere,
          orderBy: {
            createdAt: "desc",
          },
        }),
        this.prisma.auditLog.findMany({
          orderBy: {
            createdAt: "desc",
          },
          take: 100,
        }),
        this.prisma.sideEffectOutbox.findMany({
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        }),
      ]);
      const scopedOrderPairIds = new Set(
        trades.map((trade) => `${trade.buyOrderId}:${trade.sellOrderId}`),
      );
      const scopedOrderIds = new Set(orders.map((order) => order.id));
      const sideEffects = sideEffectCandidates
        .filter(
          (sideEffect) =>
            scope.isAdmin ||
            scopedOrderPairIds.has(sideEffect.aggregateId) ||
            scopedOrderIds.has(sideEffect.aggregateId) ||
            eventIds.some((eventId) =>
              JSON.stringify(sideEffect.payloadJson).includes(eventId),
            ),
        )
        .slice(0, 20);
      const scopedEntityIds = new Set<string>([
        ...events.map((event) => event.id),
        ...events.flatMap((event) =>
          event.ticketTypes.map((ticketType) => ticketType.id),
        ),
        ...tickets.map((ticket) => ticket.id),
        ...orders.map((order) => order.id),
        ...trades.map((trade) => trade.id),
        ...checkins.map((checkin) => checkin.id),
        ...gateAssignments.map((assignment) => assignment.id),
        ...gateAssignments.map((assignment) => assignment.staffUserId),
        ...staffInvites.map((invite) => invite.id),
        ...submissions.map((submission) => submission.id),
        ...submissions.map((submission) => submission.taskId),
      ]);
      const auditLogs = auditLogCandidates
        .filter(
          (log) =>
            scope.isAdmin ||
            log.actorId === session.userId ||
            scopedEntityIds.has(log.entityId),
        )
        .slice(0, 20);
      const primaryEvent = events[0] ?? null;
      const primaryTicketType = primaryEvent?.ticketTypes[0] ?? null;
      const marketOrders =
        primaryEvent && primaryTicketType
          ? orders.filter(
              (order) =>
                order.eventId === primaryEvent.id &&
                order.ticketTypeId === primaryTicketType.id,
            )
          : [];
      const marketTrades =
        primaryEvent && primaryTicketType
          ? trades.filter(
              (trade) =>
                trade.ticket.eventId === primaryEvent.id &&
                trade.ticket.ticketTypeId === primaryTicketType.id,
            )
          : [];
      const latestInviteByAssignment = new Map<
        string,
        (typeof staffInvites)[number]
      >();
      for (const invite of staffInvites) {
        if (!latestInviteByAssignment.has(invite.gateAssignmentId)) {
          latestInviteByAssignment.set(invite.gateAssignmentId, invite);
        }
      }
      const asks = this.aggregateLevels(
        marketOrders.filter(
          (order) => order.status === "OPEN" && order.side === "SELL",
        ),
        "asc",
      );
      const bids = this.aggregateLevels(
        marketOrders.filter(
          (order) => order.status === "OPEN" && order.side === "BUY",
        ),
        "desc",
      );
      const lastTradePrice = marketTrades[0]?.price ?? null;
      const floorPrice = asks[0]?.price ?? null;
      const highestBid = bids[0]?.price ?? null;
      const spread =
        floorPrice !== null && highestBid !== null
          ? floorPrice - highestBid
          : null;
      const faceValue = primaryTicketType?.faceValue ?? null;
      const privacy = this.operationsPrivacy(session);

      return {
        ok: true,
        dataSource: "prisma",
        privacy,
        events: events.map((event) => ({
          id: event.id,
          title: event.title,
          status: event.status,
          startTime: event.startTime.toISOString(),
          endTime: event.endTime.toISOString(),
          venue: {
            id: event.venue.id,
            name: event.venue.name,
            city: event.venue.city,
            capacity: event.venue.capacity,
          },
          ticketTypes: event.ticketTypes.map((ticketType) => ({
            id: ticketType.id,
            name: ticketType.name,
            faceValue: ticketType.faceValue,
            currency: ticketType.currency,
            supply: ticketType.supply,
            transferable: ticketType.transferable,
            resaleCap: ticketType.resaleCap,
            maxTransferCount: ticketType.maxTransferCount,
          })),
        })),
        market:
          primaryEvent && primaryTicketType
            ? {
                eventId: primaryEvent.id,
                eventTitle: primaryEvent.title,
                ticketTypeId: primaryTicketType.id,
                ticketTypeName: primaryTicketType.name,
                currency: primaryTicketType.currency,
                faceValue: primaryTicketType.faceValue,
                resaleCap: primaryTicketType.resaleCap,
                bids,
                asks,
                lastTradePrice,
                floorPrice,
                highestBid,
                spread,
                volume: marketTrades.length,
                premiumPercent:
                  lastTradePrice === null || faceValue === null
                    ? null
                    : ((lastTradePrice - faceValue) / faceValue) * 100,
                priceHistory: marketTrades
                  .slice()
                  .reverse()
                  .map((trade) => ({
                    tradeId: trade.id,
                    price: trade.price,
                    fee: trade.fee,
                    premiumPercent:
                      ((trade.price - primaryTicketType.faceValue) /
                        primaryTicketType.faceValue) *
                      100,
                    createdAt: trade.createdAt.toISOString(),
                  })),
              }
            : null,
        tickets: tickets.map((ticket) => ({
          id: ticket.id,
          tokenId: ticket.tokenId,
          eventId: ticket.eventId,
          eventTitle: ticket.event.title,
          ticketTypeId: ticket.ticketTypeId,
          ticketTypeName: ticket.ticketType.name,
          transferable: ticket.ticketType.transferable,
          ownerId: this.userReference(ticket.ownerId, privacy.piiVisible),
          ownerEmail: privacy.piiVisible ? ticket.owner.email : null,
          status: ticket.status,
          transferCount: ticket.transferCount,
        })),
        orders: orders.map((order) => ({
          id: order.id,
          userId: this.userReference(order.userId, privacy.piiVisible),
          eventId: order.eventId,
          ticketTypeId: order.ticketTypeId,
          ticketId: order.ticketId,
          side: order.side,
          price: order.price,
          remainingQuantity: order.remainingQuantity,
          status: order.status,
          createdAt: order.createdAt.toISOString(),
        })),
        payments: payments.map((payment) => ({
          id: payment.id,
          userId: this.userReference(payment.userId, privacy.piiVisible),
          orderId: payment.orderId,
          eventId: payment.order?.eventId ?? null,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          captureStatus: payment.captureStatus,
          stripePaymentIntentId: privacy.piiVisible
            ? payment.stripePaymentIntentId
            : null,
          clientSecret: null,
          createdAt: payment.createdAt.toISOString(),
          updatedAt: payment.updatedAt.toISOString(),
        })),
        trades: trades.map((trade) => ({
          id: trade.id,
          buyOrderId: trade.buyOrderId,
          sellOrderId: trade.sellOrderId,
          ticketId: trade.ticketId,
          eventId: trade.ticket.eventId,
          eventTitle: trade.ticket.event.title,
          ticketTypeId: trade.ticket.ticketTypeId,
          ticketTypeName: trade.ticket.ticketType.name,
          price: trade.price,
          fee: trade.fee,
          settlementStatus: trade.settlementStatus,
          createdAt: trade.createdAt.toISOString(),
        })),
        sideEffects: sideEffects.map((sideEffect) => ({
          id: sideEffect.id,
          type: sideEffect.type,
          status: sideEffect.status,
          aggregateType: sideEffect.aggregateType,
          aggregateId: sideEffect.aggregateId,
          attempts: sideEffect.attempts,
          lastError: sideEffect.lastError,
          payload: privacy.piiVisible ? sideEffect.payloadJson : null,
          createdAt: sideEffect.createdAt.toISOString(),
          completedAt: sideEffect.completedAt?.toISOString() ?? null,
        })),
        gateAssignments: gateAssignments.map((assignment) =>
          this.mapGateAssignment(
            assignment,
            privacy,
            latestInviteByAssignment.get(assignment.id),
          ),
        ),
        checkins: checkins.map((checkin) => ({
          id: checkin.id,
          eventId: checkin.ticket.eventId,
          eventTitle:
            eventTitles.get(checkin.ticket.eventId) ?? "Unknown event",
          ticketId: checkin.ticketId,
          scannerUserId: this.userReference(
            checkin.scannerUserId,
            privacy.piiVisible,
          ),
          scannerEmail: privacy.piiVisible ? checkin.scanner.email : null,
          gate: checkin.gate,
          nonce: privacy.piiVisible ? checkin.nonce : null,
          result: checkin.result,
          checkedInAt: checkin.checkedInAt.toISOString(),
        })),
        fanTaskSubmissions: submissions.map((submission) => ({
          id: submission.id,
          eventId: submission.task.eventId,
          eventTitle:
            eventTitles.get(submission.task.eventId) ?? "Unknown event",
          userId: this.userReference(submission.userId, privacy.piiVisible),
          taskId: submission.taskId,
          taskTitle: submission.task.title,
          proof: privacy.piiVisible ? submission.proof : "Hidden by default",
          status: submission.status,
        })),
        auditLogs: auditLogs.map((log) => ({
          id: log.id,
          actorId: this.userReference(log.actorId, privacy.piiVisible),
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          metadata: privacy.piiVisible ? log.metadataJson : null,
          createdAt: log.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      return {
        ok: false,
        dataSource: "prisma",
        privacy: this.operationsPrivacy(session),
        message:
          error instanceof Error
            ? error.message
            : "Unknown operations snapshot error",
        events: [],
        market: null,
        tickets: [],
        orders: [],
        payments: [],
        trades: [],
        sideEffects: [],
        gateAssignments: [],
        checkins: [],
        fanTaskSubmissions: [],
        auditLogs: [],
      };
    }
  }

  async createEvent(input: CreateAlphaEventInput, session: FanPassSession) {
    const scope = await this.resolveConsoleScope(session);
    const organizerId = await this.organizerIdForWrite(scope);
    const venue = await this.prisma.venue.create({
      data: {
        id: `ven_${randomUUID()}`,
        name: input.venueName,
        country: "HK",
        city: input.city,
        address: input.venueName,
        timezone: "Asia/Hong_Kong",
        capacity: 1000,
      },
    });

    const event = await this.prisma.event.create({
      data: {
        id: `evt_${randomUUID()}`,
        organizerId,
        title: input.title,
        venueId: venue.id,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        status: "DRAFT",
        posterUrl: null,
      },
      include: {
        venue: true,
        ticketTypes: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: session.userId,
        action: "EVENT_CREATED",
        entityType: "event",
        entityId: event.id,
        metadataJson: {
          title: input.title,
        },
      },
    });

    return {
      ...event,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
    };
  }

  async createTicketType(
    eventId: string,
    input: CreateAlphaTicketTypeInput,
    session: FanPassSession,
  ) {
    const scope = await this.resolveConsoleScope(session);
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        ...scope.eventWhere,
      },
    });
    if (!event) {
      throw new ForbiddenException("Event is outside this organizer scope");
    }
    const ticketType = await this.prisma.ticketType.create({
      data: {
        id: `tt_${randomUUID()}`,
        eventId,
        name: input.name,
        faceValue: input.faceValue,
        currency: input.currency,
        supply: input.supply,
        transferable: input.transferable,
        resaleCap: input.resaleCap ?? null,
        maxTransferCount: input.maxTransferCount,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: session.userId,
        action: "TICKET_TYPE_CREATED",
        entityType: "ticket_type",
        entityId: ticketType.id,
        metadataJson: {
          eventId,
          name: input.name,
        },
      },
    });

    return ticketType;
  }

  async createGateAssignment(
    input: CreateGateAssignmentInput,
    session: FanPassSession,
  ) {
    const scope = await this.resolveConsoleScope(session);
    const gate = this.normalizeGate(input.gate);
    const staffEmail = this.normalizeEmail(input.staffEmail);
    const staffName = this.normalizeName(input.staffName);

    const event = await this.prisma.event.findFirst({
      where: {
        id: input.eventId,
        ...scope.eventWhere,
      },
    });
    if (!event) {
      throw new ForbiddenException("Event is outside this organizer scope");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: {
          email: staffEmail,
        },
      });
      if (existingUser && existingUser.role !== "GATE_STAFF") {
        throw new BadRequestException(
          "Staff email already belongs to a non-gate-staff account",
        );
      }

      const staff =
        existingUser ??
        (await tx.user.create({
          data: {
            id: `usr_gate_${randomUUID()}`,
            name: staffName,
            email: staffEmail,
            role: "GATE_STAFF",
            privyId: null,
            walletAddress: null,
            riskScore: 0,
          },
        }));

      if (!existingUser) {
        await tx.auditLog.create({
          data: {
            actorId: session.userId,
            action: "GATE_STAFF_CREATED",
            entityType: "user",
            entityId: staff.id,
            metadataJson: {
              email: staffEmail,
              eventId: event.id,
              gate,
            },
          },
        });
      }

      const existingAssignment = await tx.gateAssignment.findFirst({
        where: {
          eventId: event.id,
          gate,
          staffUserId: staff.id,
        },
      });

      const assignment = existingAssignment
        ? await tx.gateAssignment.update({
            where: {
              id: existingAssignment.id,
            },
            data: {
              active: true,
            },
            include: {
              event: true,
              staff: true,
            },
          })
        : await tx.gateAssignment.create({
            data: {
              id: `ga_${randomUUID()}`,
              eventId: event.id,
              gate,
              staffUserId: staff.id,
              active: true,
            },
            include: {
              event: true,
              staff: true,
            },
          });

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: existingAssignment
            ? "GATE_ASSIGNMENT_REACTIVATED"
            : "GATE_ASSIGNMENT_CREATED",
          entityType: "gate_assignment",
          entityId: assignment.id,
          metadataJson: {
            eventId: event.id,
            gate,
            staffUserId: staff.id,
          },
        },
      });

      await tx.staffInvite.updateMany({
        where: {
          gateAssignmentId: assignment.id,
          status: "PENDING",
        },
        data: {
          status: "SUPERSEDED",
        },
      });

      const inviteToken = this.generateStaffInviteToken();
      const invite = await tx.staffInvite.create({
        data: {
          id: `inv_${randomUUID()}`,
          eventId: event.id,
          gateAssignmentId: assignment.id,
          staffUserId: staff.id,
          email: staff.email,
          tokenHash: this.hashStaffInviteToken(inviteToken),
          status: "PENDING",
          expiresAt: this.staffInviteExpiry(),
          createdByUserId: session.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: "STAFF_INVITE_CREATED",
          entityType: "staff_invite",
          entityId: invite.id,
          metadataJson: {
            eventId: event.id,
            gate,
            gateAssignmentId: assignment.id,
            staffUserId: staff.id,
          },
        },
      });

      return { assignment, invite, inviteToken };
    });

    return {
      ...this.mapGateAssignment(
        result.assignment,
        this.operationsPrivacy(session),
        result.invite,
      ),
      inviteToken: result.inviteToken,
    };
  }

  async deactivateGateAssignment(
    assignmentId: string,
    session: FanPassSession,
  ) {
    const scope = await this.resolveConsoleScope(session);
    const assignment = await this.prisma.gateAssignment.findFirst({
      where: {
        id: assignmentId,
        event: {
          is: scope.eventWhere,
        },
      },
      include: {
        event: true,
        staff: true,
      },
    });
    if (!assignment) {
      throw new ForbiddenException("Gate assignment is outside this scope");
    }

    const updated = await this.prisma.gateAssignment.update({
      where: {
        id: assignment.id,
      },
      data: {
        active: false,
      },
      include: {
        event: true,
        staff: true,
      },
    });
    await this.prisma.staffInvite.updateMany({
      where: {
        gateAssignmentId: assignment.id,
        status: "PENDING",
      },
      data: {
        status: "REVOKED",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: session.userId,
        action: "GATE_ASSIGNMENT_DEACTIVATED",
        entityType: "gate_assignment",
        entityId: updated.id,
        metadataJson: {
          eventId: updated.eventId,
          gate: updated.gate,
          staffUserId: updated.staffUserId,
        },
      },
    });

    return this.mapGateAssignment(updated, this.operationsPrivacy(session));
  }

  async rotateStaffInvite(assignmentId: string, session: FanPassSession) {
    const scope = await this.resolveConsoleScope(session);
    const result = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.gateAssignment.findFirst({
        where: {
          id: assignmentId,
          event: {
            is: scope.eventWhere,
          },
        },
        include: {
          event: true,
          staff: true,
        },
      });
      if (!assignment) {
        throw new ForbiddenException("Gate assignment is outside this scope");
      }
      if (!assignment.active) {
        throw new BadRequestException(
          "Inactive gate assignments cannot receive new invites",
        );
      }
      if (assignment.staff.privyId) {
        throw new BadRequestException(
          "Gate staff account is already linked to Privy",
        );
      }

      await tx.staffInvite.updateMany({
        where: {
          gateAssignmentId: assignment.id,
          status: "PENDING",
        },
        data: {
          status: "SUPERSEDED",
        },
      });

      const inviteToken = this.generateStaffInviteToken();
      const invite = await tx.staffInvite.create({
        data: {
          id: `inv_${randomUUID()}`,
          eventId: assignment.eventId,
          gateAssignmentId: assignment.id,
          staffUserId: assignment.staffUserId,
          email: assignment.staff.email,
          tokenHash: this.hashStaffInviteToken(inviteToken),
          status: "PENDING",
          expiresAt: this.staffInviteExpiry(),
          createdByUserId: session.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: "STAFF_INVITE_ROTATED",
          entityType: "staff_invite",
          entityId: invite.id,
          metadataJson: {
            eventId: assignment.eventId,
            gate: assignment.gate,
            gateAssignmentId: assignment.id,
            staffUserId: assignment.staffUserId,
          },
        },
      });

      return { assignment, invite, inviteToken };
    });

    return {
      ...this.mapGateAssignment(
        result.assignment,
        this.operationsPrivacy(session),
        result.invite,
      ),
      inviteToken: result.inviteToken,
    };
  }

  private aggregateLevels(
    orders: { price: number; remainingQuantity: number }[],
    direction: "asc" | "desc",
  ) {
    const levels = new Map<number, number>();
    for (const order of orders) {
      levels.set(
        order.price,
        (levels.get(order.price) ?? 0) + order.remainingQuantity,
      );
    }
    return [...levels.entries()]
      .map(([price, quantity]) => ({ price, quantity }))
      .sort((left, right) =>
        direction === "asc"
          ? left.price - right.price
          : right.price - left.price,
      )
      .slice(0, 10);
  }

  private operationsPrivacy(session: FanPassSession) {
    const piiVisible = session.role === "ADMIN";
    return {
      viewerRole: session.role,
      piiVisible,
      piiRedacted: !piiVisible,
    };
  }

  private userReference(userId: string, piiVisible: boolean) {
    if (piiVisible || userId === "system") {
      return userId;
    }
    const digest = createHash("sha256")
      .update(userId)
      .digest("hex")
      .slice(0, 10);
    return `user_ref_${digest}`;
  }

  private mapGateAssignment(
    assignment: {
      id: string;
      eventId: string;
      gate: string;
      active: boolean;
      staffUserId: string;
      createdAt: Date;
      event: {
        title: string;
      };
      staff: {
        name: string;
        email: string;
        privyId?: string | null;
      };
    },
    privacy: ReturnType<AlphaPersistenceService["operationsPrivacy"]>,
    invite?: {
      id: string;
      status: string;
      expiresAt: Date;
      acceptedAt: Date | null;
    } | null,
  ) {
    return {
      id: assignment.id,
      eventId: assignment.eventId,
      eventTitle: assignment.event.title,
      gate: assignment.gate,
      active: assignment.active,
      linked: Boolean(assignment.staff.privyId),
      staffUserId: this.userReference(
        assignment.staffUserId,
        privacy.piiVisible,
      ),
      staffName: assignment.staff.name,
      staffEmail: privacy.piiVisible ? assignment.staff.email : null,
      invite: invite
        ? {
            id: invite.id,
            status: invite.status,
            expiresAt: invite.expiresAt.toISOString(),
            acceptedAt: invite.acceptedAt?.toISOString() ?? null,
          }
        : null,
      createdAt: assignment.createdAt.toISOString(),
    };
  }

  private generateStaffInviteToken() {
    return `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
  }

  private hashStaffInviteToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private staffInviteExpiry() {
    return new Date(Date.now() + STAFF_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  private normalizeGate(gate: string) {
    const normalized = gate.trim().toUpperCase();
    if (!normalized || normalized.length > 24) {
      throw new BadRequestException("Gate is required");
    }
    return normalized;
  }

  private normalizeEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@") || normalized.length > 254) {
      throw new BadRequestException("Valid staff email is required");
    }
    return normalized;
  }

  private normalizeName(name: string) {
    const normalized = name.trim();
    if (!normalized || normalized.length > 120) {
      throw new BadRequestException("Staff name is required");
    }
    return normalized;
  }

  private async resolveConsoleScope(session: FanPassSession) {
    if (session.role === "ADMIN") {
      return {
        isAdmin: true,
        organizerId: null,
        eventWhere: {},
      };
    }

    const organizer = await this.prisma.organizer.findFirst({
      where: {
        userId: session.userId,
      },
    });
    if (!organizer) {
      throw new ForbiddenException("Organizer profile is not linked");
    }

    return {
      isAdmin: false,
      organizerId: organizer.id,
      eventWhere: {
        organizerId: organizer.id,
      },
    };
  }

  private async eventIdsForScope(
    scope: Awaited<ReturnType<AlphaPersistenceService["resolveConsoleScope"]>>,
  ) {
    const events = await this.prisma.event.findMany({
      where: scope.eventWhere,
      select: {
        id: true,
      },
    });
    return events.map((event) => event.id);
  }

  private async organizerIdForWrite(
    scope: Awaited<ReturnType<AlphaPersistenceService["resolveConsoleScope"]>>,
  ) {
    if (scope.organizerId) {
      return scope.organizerId;
    }
    const organizer = await this.prisma.organizer.findFirst({
      orderBy: {
        id: "asc",
      },
    });
    if (!organizer) {
      throw new ForbiddenException("No organizer profile exists");
    }
    return organizer.id;
  }
}
