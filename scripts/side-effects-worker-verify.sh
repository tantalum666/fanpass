#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgresql://fanpass:fanpass@localhost:5432/fanpass}"
NODE_BIN="${FANPASS_NODE_BIN:-$(command -v node)}"
TS_NODE_CLI="$ROOT_DIR/node_modules/ts-node/dist/bin.js"

cd "$ROOT_DIR"

set_local_dispatch_paused() {
  local require_open="$1"
  DATABASE_URL="$DATABASE_URL" \
    FANPASS_REQUIRE_OPEN_DISPATCH="$require_open" \
    "$NODE_BIN" <<'NODE'
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

const control = await prisma.sideEffectDispatchControl.findUnique({
  where: { id: "global" }
});
if (!control) {
  throw new Error("Local side-effect dispatch control is missing");
}
if (
  process.env.FANPASS_REQUIRE_OPEN_DISPATCH === "true" &&
  (
    control.paused !== false ||
    control.remainingClaims !== null ||
    control.probeJobId !== null
  )
) {
  throw new Error("Local side-effect dispatch fence was not open before the required pause");
}
if (!control.paused) {
  const paused = await prisma.sideEffectDispatchControl.updateMany({
    where: {
      id: "global",
      revision: control.revision
    },
    data: {
      paused: true,
      revision: { increment: 1 },
      remainingClaims: null,
      probeJobId: null
    }
  });
  if (paused.count !== 1) {
    throw new Error("Local side-effect dispatch fence changed before pausing");
  }
}
const finalControl = await prisma.sideEffectDispatchControl.findUnique({
  where: { id: "global" }
});
await prisma.$disconnect();
if (
  !finalControl ||
  finalControl.paused !== true ||
  finalControl.remainingClaims !== null ||
  finalControl.probeJobId !== null
) {
  throw new Error("Local side-effect dispatch fence did not return to paused");
}
console.log(JSON.stringify({ ok: true, control: { paused: true } }));
NODE
}

pause_dispatch_strict() {
  set_local_dispatch_paused true
}

pause_dispatch_best_effort() {
  set_local_dispatch_paused false >/dev/null 2>&1 || true
}

# This verifier temporarily opens the local-only dispatch fence. Always return
# it to the safe paused state, including when a worker assertion fails.
trap pause_dispatch_best_effort EXIT

/bin/bash "$ROOT_DIR/scripts/alpha-db-reset.sh"

"$NODE_BIN" <<'NODE'
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://fanpass:fanpass@localhost:5432/fanpass"
    }
  }
});
const localDemoOwnershipSnapshot = {
  ownershipAdapter: "mock",
  contractRoute: {
    contractAddress: "0x0000000000000000000000000000000000003137",
    chainId: "31337",
    contractVersion: "fanpass-ticket-v1"
  }
};

await prisma.sideEffectOutbox.create({
  data: {
    id: "sfx_worker_verify",
    type: "OWNERSHIP_TRANSFER",
    status: "PENDING",
    idempotencyKey: "worker-verify:ownership-transfer",
    aggregateType: "trade",
    aggregateId: "worker-verify",
    payloadJson: {
      ...localDemoOwnershipSnapshot,
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
    status: "PENDING",
    idempotencyKey: "worker-verify:stale-ownership-transfer",
    aggregateType: "trade",
    aggregateId: "worker-verify-stale",
    attempts: 1,
    payloadJson: {
      ...localDemoOwnershipSnapshot,
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
      ...localDemoOwnershipSnapshot,
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

// The production/runtime default remains paused. This local integration
// fixture opens unlimited dispatch with a compare-and-swap only after its
// synthetic jobs are fully prepared; the shell EXIT trap closes every exit.
const dispatchControl = await prisma.sideEffectDispatchControl.findUnique({
  where: { id: "global" }
});
if (
  !dispatchControl ||
  dispatchControl.paused !== true ||
  dispatchControl.remainingClaims !== null ||
  dispatchControl.probeJobId !== null
) {
  throw new Error("Expected the local side-effect dispatch fence to start paused");
}
const opened = await prisma.sideEffectDispatchControl.updateMany({
  where: {
    id: "global",
    paused: true,
    revision: dispatchControl.revision,
    remainingClaims: null,
    probeJobId: null
  },
  data: {
    paused: false,
    revision: { increment: 1 },
    remainingClaims: null,
    probeJobId: null
  }
});
if (opened.count !== 1) {
  throw new Error("Local side-effect dispatch fence changed before opening");
}
const staleClaim = await prisma.sideEffectOutbox.updateMany({
  where: {
    id: "sfx_worker_stale_recovery",
    status: "PENDING"
  },
  data: {
    status: "PROCESSING",
    lockedAt: new Date(Date.now() - 10 * 60 * 1000),
    dispatchRevision: dispatchControl.revision + 1n
  }
});
if (staleClaim.count !== 1) {
  throw new Error("Failed to create the stale worker claim under the open local dispatch revision");
}

await prisma.$disconnect();
NODE

(
  cd "$ROOT_DIR/apps/api"
  FANPASS_DATA_SOURCE=prisma OWNERSHIP_ADAPTER=mock DATABASE_URL="$DATABASE_URL" \
    "$NODE_BIN" "$TS_NODE_CLI" src/workers/side-effect-worker-once.ts
  FANPASS_DATA_SOURCE=prisma OWNERSHIP_ADAPTER=mock DATABASE_URL="$DATABASE_URL" \
    "$NODE_BIN" "$TS_NODE_CLI" src/workers/side-effect-worker-once.ts
)

"$NODE_BIN" <<'NODE'
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
if (
  ticket.ownershipContractAddress !== "0x0000000000000000000000000000000000003137" ||
  ticket.ownershipChainId !== "31337" ||
  ticket.ownershipContractVersion !== "fanpass-ticket-v1"
) {
  throw new Error(`Expected async ownership finalization to preserve the immutable ticket route: ${JSON.stringify(ticket)}`);
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

pause_output="$(pause_dispatch_strict)"
if [[ "$pause_output" != *'"paused":true'* ]]; then
  printf 'Side-effect worker verifier did not restore the paused dispatch fence.\n' >&2
  exit 1
fi
trap - EXIT
