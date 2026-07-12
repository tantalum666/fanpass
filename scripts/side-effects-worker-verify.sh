#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgresql://fanpass:fanpass@localhost:5432/fanpass}"

cd "$ROOT_DIR"

npm run alpha:db:reset

node <<'NODE'
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://fanpass:fanpass@localhost:5432/fanpass"
    }
  }
});

await prisma.sideEffectOutbox.create({
  data: {
    id: "sfx_worker_verify",
    type: "OWNERSHIP_TRANSFER",
    status: "PENDING",
    idempotencyKey: "worker-verify:ownership-transfer",
    aggregateType: "trade",
    aggregateId: "worker-verify",
    payloadJson: {
      ticketId: "tkt_demo_001",
      tokenId: "1",
      fromOwnerId: "usr_fan_demo",
      fromWalletAddress: null,
      toOwnerId: "usr_buyer_demo",
      toWalletAddress: null
    }
  }
});

await prisma.sideEffectOutbox.create({
  data: {
    id: "sfx_worker_stale_recovery",
    type: "OWNERSHIP_TRANSFER",
    status: "PROCESSING",
    idempotencyKey: "worker-verify:stale-ownership-transfer",
    aggregateType: "trade",
    aggregateId: "worker-verify-stale",
    attempts: 1,
    lockedAt: new Date(Date.now() - 10 * 60 * 1000),
    payloadJson: {
      ticketId: "tkt_worker_stale_recovery",
      tokenId: "99",
      fromOwnerId: "usr_fan_demo",
      fromWalletAddress: null,
      toOwnerId: "usr_buyer_demo",
      toWalletAddress: null
    }
  }
});

await prisma.ticket.update({
  where: {
    id: "tkt_demo_001"
  },
  data: {
    status: "TRANSFER_PENDING"
  }
});

await prisma.order.createMany({
  data: [
    {
      id: "ord_worker_async_buy",
      userId: "usr_buyer_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "BUY",
      price: 1288,
      quantity: 1,
      remainingQuantity: 1,
      status: "MATCHED"
    },
    {
      id: "ord_worker_async_sell",
      userId: "usr_fan_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ticketId: "tkt_demo_001",
      side: "SELL",
      price: 1288,
      quantity: 1,
      remainingQuantity: 1,
      status: "MATCHED"
    }
  ]
});

await prisma.sideEffectOutbox.create({
  data: {
    id: "sfx_worker_async_transfer",
    type: "OWNERSHIP_TRANSFER",
    status: "PENDING",
    idempotencyKey: "ownership-transfer:ord_worker_async_buy:ord_worker_async_sell",
    aggregateType: "trade",
    aggregateId: "ord_worker_async_buy:ord_worker_async_sell",
    payloadJson: {
      ticketId: "tkt_demo_001",
      tokenId: "1",
      fromOwnerId: "usr_fan_demo",
      fromWalletAddress: null,
      toOwnerId: "usr_buyer_demo",
      toWalletAddress: null,
      buyOrderId: "ord_worker_async_buy",
      sellOrderId: "ord_worker_async_sell"
    }
  }
});

await prisma.$disconnect();
NODE

FANPASS_DATA_SOURCE=prisma OWNERSHIP_ADAPTER=mock DATABASE_URL="$DATABASE_URL" npm run side-effects:work-once -w @fanpass/api
FANPASS_DATA_SOURCE=prisma OWNERSHIP_ADAPTER=mock DATABASE_URL="$DATABASE_URL" npm run side-effects:work-once -w @fanpass/api

node <<'NODE'
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://fanpass:fanpass@localhost:5432/fanpass"
    }
  }
});

const job = await prisma.sideEffectOutbox.findUniqueOrThrow({
  where: {
    id: "sfx_worker_verify"
  }
});
const transferJob = await prisma.sideEffectOutbox.findUniqueOrThrow({
  where: {
    id: "sfx_worker_async_transfer"
  }
});
const staleJob = await prisma.sideEffectOutbox.findUniqueOrThrow({
  where: {
    id: "sfx_worker_stale_recovery"
  }
});
const finalizeJob = await prisma.sideEffectOutbox.findUniqueOrThrow({
  where: {
    idempotencyKey: "ownership-finalize:ord_worker_async_buy:ord_worker_async_sell"
  }
});
const trade = await prisma.trade.findFirst({
  where: {
    buyOrderId: "ord_worker_async_buy",
    sellOrderId: "ord_worker_async_sell"
  }
});
const ticket = await prisma.ticket.findUniqueOrThrow({
  where: {
    id: "tkt_demo_001"
  }
});
const buyOrder = await prisma.order.findUniqueOrThrow({
  where: {
    id: "ord_worker_async_buy"
  }
});
const sellOrder = await prisma.order.findUniqueOrThrow({
  where: {
    id: "ord_worker_async_sell"
  }
});
await prisma.$disconnect();

if (job.status !== "COMPLETED" || job.attempts !== 1 || !job.payloadJson.transactionHash) {
  throw new Error(`Expected completed worker job: ${JSON.stringify(job)}`);
}
if (transferJob.status !== "COMPLETED" || !transferJob.payloadJson.transactionHash) {
  throw new Error(`Expected completed async ownership transfer job: ${JSON.stringify(transferJob)}`);
}
if (staleJob.status !== "COMPLETED" || staleJob.attempts !== 2 || !staleJob.payloadJson.transactionHash) {
  throw new Error(`Expected recovered stale worker job to complete on retry: ${JSON.stringify(staleJob)}`);
}
if (finalizeJob.status !== "COMPLETED" || finalizeJob.payloadJson.tradeId !== trade?.id) {
  throw new Error(`Expected completed async ownership finalization job: ${JSON.stringify(finalizeJob)}`);
}
if (!trade || trade.settlementStatus !== "SETTLED") {
  throw new Error(`Expected finalized async ownership trade: ${JSON.stringify(trade)}`);
}
if (ticket.ownerId !== "usr_buyer_demo" || ticket.status !== "TRANSFERRED") {
  throw new Error(`Expected async ownership finalization to transfer ticket: ${JSON.stringify(ticket)}`);
}
if (buyOrder.status !== "SETTLED" || sellOrder.status !== "SETTLED") {
  throw new Error(`Expected async ownership finalization to settle orders: ${JSON.stringify({ buyOrder, sellOrder })}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      transactionHash: job.payloadJson.transactionHash,
      staleRecovery: {
        id: staleJob.id,
        status: staleJob.status,
        attempts: staleJob.attempts
      },
      asyncOwnership: {
        transferJob: transferJob.status,
        finalizeJob: finalizeJob.status,
        tradeId: trade.id,
        ticketOwner: ticket.ownerId
      }
    },
    null,
    2
  )
);
NODE
