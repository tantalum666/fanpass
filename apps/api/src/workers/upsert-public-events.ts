import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { createDemoSeed } from "../common/demo-seed";

export interface PublicEventsUpsertResult {
  ok: true;
  mode: "upsert-public-events";
  events: number;
  ticketTypes: number;
  fanTasks: number;
}

export async function upsertPublicEvents(
  prisma: PrismaClient,
): Promise<PublicEventsUpsertResult> {
  const seed = createDemoSeed();

  for (const user of seed.users) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        privyId: user.privyId,
        walletAddress: user.walletAddress,
        riskScore: user.riskScore,
      },
      update: {
        name: user.name,
        email: user.email,
        role: user.role,
        privyId: user.privyId,
        walletAddress: user.walletAddress,
        riskScore: user.riskScore,
      },
    });
  }

  for (const organizer of seed.organizers) {
    await prisma.organizer.upsert({
      where: { id: organizer.id },
      create: organizer,
      update: {
        userId: organizer.userId,
        organizationName: organizer.organizationName,
        verificationStatus: organizer.verificationStatus,
        payoutAccountId: organizer.payoutAccountId,
      },
    });
  }

  for (const venue of seed.venues) {
    await prisma.venue.upsert({
      where: { id: venue.id },
      create: venue,
      update: venue,
    });
  }

  for (const event of seed.events) {
    await prisma.event.upsert({
      where: { id: event.id },
      create: {
        ...event,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
      },
      update: {
        organizerId: event.organizerId,
        title: event.title,
        venueId: event.venueId,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        status: event.status,
        posterUrl: event.posterUrl,
      },
    });
  }

  for (const ticketType of seed.ticketTypes) {
    await prisma.ticketType.upsert({
      where: { id: ticketType.id },
      create: ticketType,
      update: {
        eventId: ticketType.eventId,
        name: ticketType.name,
        faceValue: ticketType.faceValue,
        currency: ticketType.currency,
        supply: ticketType.supply,
        transferable: ticketType.transferable,
        resaleCap: ticketType.resaleCap,
        maxTransferCount: ticketType.maxTransferCount,
      },
    });
  }

  for (const task of seed.fanTasks) {
    await prisma.fanTask.upsert({
      where: { id: task.id },
      create: task,
      update: {
        eventId: task.eventId,
        title: task.title,
        taskType: task.taskType,
        points: task.points,
        verificationMethod: task.verificationMethod,
      },
    });
  }

  for (const assignment of seed.gateAssignments) {
    await prisma.gateAssignment.upsert({
      where: {
        eventId_gate_staffUserId: {
          eventId: assignment.eventId,
          gate: assignment.gate,
          staffUserId: assignment.staffUserId,
        },
      },
      create: assignment,
      update: {
        active: assignment.active,
      },
    });
  }

  await markLegacyDuplicateEvents(prisma);

  const publicEventIds = seed.events.map((event) => event.id);
  const [events, ticketTypes, fanTasks] = await Promise.all([
    prisma.event.count({ where: { id: { in: publicEventIds } } }),
    prisma.ticketType.count({ where: { eventId: { in: publicEventIds } } }),
    prisma.fanTask.count({ where: { eventId: { in: publicEventIds } } }),
  ]);

  return {
    ok: true,
    mode: "upsert-public-events",
    events,
    ticketTypes,
    fanTasks,
  };
}

async function markLegacyDuplicateEvents(prisma: PrismaClient) {
  await prisma.event.updateMany({
    where: {
      id: {
        in: ["evt_arena_demo", "evt_finals_demo", "evt_theatre_demo"],
      },
    },
    data: {
      title: "Staging legacy internal event",
      status: "DRAFT",
    },
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await upsertPublicEvents(prisma);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
