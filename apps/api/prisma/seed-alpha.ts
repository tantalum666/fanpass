import { PrismaClient } from "@prisma/client";
import { createDemoSeed } from "../src/common/demo-seed";

const prisma = new PrismaClient();

async function reset() {
  await prisma.$transaction([
    prisma.sideEffectOutbox.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.paymentWebhookEvent.deleteMany(),
    prisma.entryCredential.deleteMany(),
    prisma.checkin.deleteMany(),
    prisma.staffInvite.deleteMany(),
    prisma.inventoryHold.deleteMany(),
    prisma.trade.deleteMany(),
    prisma.sponsoredCryptoSubmission.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.order.deleteMany(),
    prisma.queueEntry.deleteMany(),
    prisma.fanEntitlement.deleteMany(),
    prisma.fanWalletLink.deleteMany(),
    prisma.fanScore.deleteMany(),
    prisma.fanTaskSubmission.deleteMany(),
    prisma.fanTask.deleteMany(),
    prisma.fanCampaign.deleteMany(),
    prisma.gateAssignment.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.onsale.deleteMany(),
    prisma.ticketType.deleteMany(),
    prisma.event.deleteMany(),
    prisma.venue.deleteMany(),
    prisma.organizer.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.sideEffectDispatchControl.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      paused: true,
      revision: 1n,
      remainingClaims: null,
      probeJobId: null,
    },
    update: {
      paused: true,
      revision: { increment: 1 },
      remainingClaims: null,
      probeJobId: null,
    },
  });
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

  for (const user of seedData.users) {
    if (!user.walletAddress) {
      continue;
    }
    await prisma.fanWalletLink.create({
      data: {
        id: `fwl_${user.id}`,
        userId: user.id,
        address: user.walletAddress.toLowerCase(),
        chainType: "EVM",
        status: "ACTIVE",
        isPrimary: true,
        verifiedAt: new Date("2026-07-16T00:00:00.000Z"),
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

  for (const campaign of seedData.fanCampaigns) {
    await prisma.fanCampaign.create({
      data: {
        ...campaign,
        startsAt: new Date(campaign.startsAt),
        closesAt: new Date(campaign.closesAt),
      },
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
