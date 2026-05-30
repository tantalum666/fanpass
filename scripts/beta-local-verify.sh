#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
CONSOLE_URL="${CONSOLE_URL:-http://localhost:3000}"
DATABASE_URL="${DATABASE_URL:-postgresql://fanpass:fanpass@localhost:5432/fanpass}"

curl --max-time 5 -fsS "$API_BASE_URL/health" >/dev/null
curl --max-time 8 -fsS "$CONSOLE_URL/" | grep -q "FanPass Console"

if [[ "${FANPASS_BETA_VERIFY_SKIP_DB_RESET:-false}" != "true" ]]; then
  DATABASE_URL="$DATABASE_URL" npm run alpha:db:reset >/dev/null
fi

printf 'Waiting for Beta local API after reset'
for _ in {1..30}; do
  if curl --max-time 2 -fsS "$API_BASE_URL/health" >/dev/null 2>&1; then
    printf '\n'
    break
  fi
  printf '.'
  sleep 1
done

if ! curl --max-time 2 -fsS "$API_BASE_URL/health" >/dev/null 2>&1; then
  printf '\nBeta local API did not recover after reset.\n' >&2
  exit 1
fi

API_BASE_URL="$API_BASE_URL" DATABASE_URL="$DATABASE_URL" node <<'NODE'
const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";

async function ensureLocalAdminDemoUser() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || "postgresql://fanpass:fanpass@localhost:5432/fanpass"
      }
    }
  });
  try {
    await prisma.user.upsert({
      where: { id: "usr_admin_demo" },
      update: {
        name: "Demo Admin",
        email: "admin@fanpass.test",
        role: "ADMIN",
        privyId: "did:privy:admin-demo",
        walletAddress: null,
        riskScore: 0
      },
      create: {
        id: "usr_admin_demo",
        name: "Demo Admin",
        email: "admin@fanpass.test",
        role: "ADMIN",
        privyId: "did:privy:admin-demo",
        walletAddress: null,
        riskScore: 0
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function demoToken(userId) {
  const session = await request("/auth/demo-session", {
    method: "POST",
    body: JSON.stringify({ userId })
  });
  if (!session.accessToken) {
    throw new Error(`Demo session failed for ${userId}: ${JSON.stringify(session)}`);
  }
  return session.accessToken;
}

function auth(accessToken, extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...extra
  };
}

async function waitFor(label, check, attempts = 20) {
  let last;
  for (let index = 0; index < attempts; index += 1) {
    try {
      last = await check();
    } catch (error) {
      last = null;
    }
    if (last) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

await ensureLocalAdminDemoUser();

const fanToken = await demoToken("usr_fan_demo");
const buyerToken = await demoToken("usr_buyer_demo");
const organizerToken = await demoToken("usr_organizer_demo");
const adminToken = await demoToken("usr_admin_demo");

const status = await request("/alpha/persistence/status", {
  headers: auth(organizerToken)
});
if (!status.ok || status.dataSource !== "prisma") {
  throw new Error(`Expected Prisma status from Beta local API: ${JSON.stringify(status)}`);
}

const initialBook = await request("/orders/events/evt_weekend_demo/ticket-types/tt_cat2_demo/book");
if (initialBook.eventId !== "evt_weekend_demo" || initialBook.ticketTypeId !== "tt_cat2_demo") {
  throw new Error(`Unexpected initial orderbook: ${JSON.stringify(initialBook)}`);
}

const buy = await request("/orders", {
  method: "POST",
  headers: auth(buyerToken, { "Idempotency-Key": `beta-local-buy-${Date.now()}` }),
  body: JSON.stringify({
    eventId: "evt_weekend_demo",
    ticketTypeId: "tt_cat2_demo",
    side: "BUY",
    price: 1288
  })
});
if (!buy.order?.id || buy.order.status !== "OPEN") {
  throw new Error(`Expected open buy order: ${JSON.stringify(buy)}`);
}

const payment = await request("/payments/intents", {
  method: "POST",
  headers: auth(buyerToken, { "Idempotency-Key": `beta-local-payment-${buy.order.id}` }),
  body: JSON.stringify({
    orderId: buy.order.id
  })
});
if (!payment.id || !payment.stripePaymentIntentId || payment.captureStatus !== "NOT_CAPTURED") {
  throw new Error(`Expected local mock PaymentIntent: ${JSON.stringify(payment)}`);
}

await request("/payments/webhook", {
  method: "POST",
  body: JSON.stringify({
    id: `evt_beta_local_auth_${Date.now()}`,
    type: "payment_intent.amount_capturable_updated",
    data: {
      object: {
        id: payment.stripePaymentIntentId,
        status: "requires_capture"
      }
    }
  })
});

const sell = await request("/orders", {
  method: "POST",
  headers: auth(fanToken, { "Idempotency-Key": `beta-local-sell-${Date.now()}` }),
  body: JSON.stringify({
    eventId: "evt_weekend_demo",
    ticketTypeId: "tt_cat2_demo",
    side: "SELL",
    price: 1288,
    ticketId: "tkt_demo_001"
  })
});
if (!sell.order?.id) {
  throw new Error(`Expected sell order to be accepted for async settlement: ${JSON.stringify(sell)}`);
}

const operations = await waitFor("async ownership settlement and captured local payment", async () => {
  const snapshot = await request("/alpha/operations", {
    headers: auth(organizerToken)
  });
  const trade = snapshot.trades?.find((candidate) => {
    return candidate.buyOrderId === buy.order.id && candidate.sellOrderId === sell.order.id;
  });
  const capturedPayment = snapshot.payments?.find((candidate) => {
    return candidate.id === payment.id && candidate.captureStatus === "CAPTURED";
  });
  const ownershipTransfer = snapshot.sideEffects?.find((job) => {
    return job.type === "OWNERSHIP_TRANSFER" && job.status === "COMPLETED" && job.aggregateId === `${buy.order.id}:${sell.order.id}`;
  });
  const ownershipFinalize = snapshot.sideEffects?.find((job) => {
    return job.type === "OWNERSHIP_SETTLEMENT_FINALIZE" && job.status === "COMPLETED" && job.aggregateId === `${buy.order.id}:${sell.order.id}`;
  });
  const paymentCapture = snapshot.sideEffects?.find((job) => {
    return job.type === "PAYMENT_CAPTURE" && job.status === "COMPLETED";
  });
  return trade && capturedPayment && ownershipTransfer && ownershipFinalize && paymentCapture
    ? { snapshot, trade, ownershipTransfer, ownershipFinalize, paymentCapture }
    : null;
});

if (!operations.trade.id) {
  throw new Error("Expected async ownership finalization to create a trade");
}
if (!operations.ownershipFinalize.completedAt) {
  throw new Error("Expected completed OWNERSHIP_SETTLEMENT_FINALIZE side effect in operations snapshot");
}
if (!operations.paymentCapture.completedAt) {
  throw new Error("Expected completed PAYMENT_CAPTURE side effect in operations snapshot");
}

const sideEffectHealth = await request("/alpha/side-effects/health", {
  headers: auth(adminToken)
});
if (!sideEffectHealth.ok || !sideEffectHealth.checkedAt || !sideEffectHealth.thresholds) {
  throw new Error(`Expected healthy admin side-effect outbox response: ${JSON.stringify(sideEffectHealth)}`);
}
const serializedHealth = JSON.stringify(sideEffectHealth).toLowerCase();
for (const forbidden of ["payloadjson", "clientsecret", "invitetoken", "stripe_secret", "privy_verification_key"]) {
  if (serializedHealth.includes(forbidden)) {
    throw new Error(`Side-effect health response contains forbidden private marker: ${forbidden}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  dataSource: status.dataSource,
  buyOrderId: buy.order.id,
  sellOrderId: sell.order.id,
  paymentId: payment.id,
  tradeId: operations.trade.id,
  ownershipFinalizeSideEffectId: operations.ownershipFinalize.id,
  sideEffectHealthCheckedAt: sideEffectHealth.checkedAt,
  captured: true
}, null, 2));
NODE
