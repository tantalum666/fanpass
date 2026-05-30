import { PrismaClient } from "@prisma/client";
import { createDemoSeed } from "../src/common/demo-seed";

const prisma = new PrismaClient();

async function reset() {
  await prisma.sideEffectOutbox.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.paymentWebhookEvent.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.staffInvite.deleteMany();
  await prisma.gateAssignment.deleteMany();
  await prisma.fanScore.deleteMany();
  await prisma.fanTaskSubmission.deleteMany();
  await prisma.fanTask.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.organizer.deleteMany();
  await prisma.user.deleteMany();
}

async function seed() {
  const seedData = createDemoSeed();

  for (const user of seedData.users) {
    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        privyId: user.privyId,
        walletAddress: user.walletAddress,
        riskScore: user.riskScore,
      },
    });
  }

  for (const organizer of seedData.organizers) {
    await prisma.organizer.create({
      data: {
        id: organizer.id,
        userId: organizer.userId,
        organizationName: organizer.organizationName,
        verificationStatus: organizer.verificationStatus,
        payoutAccountId: organizer.payoutAccountId,
      },
    });
  }

  for (const venue of seedData.venues) {
    await prisma.venue.create({
      data: venue,
    });
  }

  for (const event of seedData.events) {
    await prisma.event.create({
      data: {
        ...event,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
      },
    });
  }

  for (const ticketType of seedData.ticketTypes) {
    await prisma.ticketType.create({
      data: ticketType,
    });
  }

  for (const ticket of seedData.tickets) {
    await prisma.ticket.create({
      data: ticket,
    });
  }

  for (const task of seedData.fanTasks) {
    await prisma.fanTask.create({
      data: task,
    });
  }

  for (const assignment of seedData.gateAssignments) {
    await prisma.gateAssignment.create({
      data: assignment,
    });
  }

  await prisma.auditLog.create({
    data: {
      id: "aud_alpha_seed",
      actorId: "system",
      action: "ALPHA_SEEDED",
      entityType: "database",
      entityId: "alpha",
      metadataJson: {
        users: seedData.users.length,
        events: seedData.events.length,
        tickets: seedData.tickets.length,
      },
    },
  });
}

async function main() {
  await reset();
  await seed();
  const [users, events, tickets, fanTasks] = await Promise.all([
    prisma.user.count(),
    prisma.event.count(),
    prisma.ticket.count(),
    prisma.fanTask.count(),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        users,
        events,
        tickets,
        fanTasks,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
