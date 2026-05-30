#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE_URL="${API_BASE_URL:-http://localhost:4100}"
DATABASE_URL="${DATABASE_URL:-postgresql://fanpass:fanpass@localhost:5432/fanpass}"
LOG_FILE="${TMPDIR:-/tmp}/fanpass-alpha-prisma-api.log"
PRIVY_PRIVATE_KEY_FILE="${TMPDIR:-/tmp}/fanpass-alpha-prisma-privy-private.pem"
PRIVY_PUBLIC_KEY_FILE="${TMPDIR:-/tmp}/fanpass-alpha-prisma-privy-public.pem"
export PRIVY_PRIVATE_KEY_FILE PRIVY_PUBLIC_KEY_FILE
API_PID=""

cleanup() {
  if [[ -n "$API_PID" ]]; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
  rm -f "$PRIVY_PRIVATE_KEY_FILE" "$PRIVY_PUBLIC_KEY_FILE"
}
trap cleanup EXIT

cd "$ROOT_DIR"

node <<'NODE'
const { generateKeyPairSync } = require("crypto");
const fs = require("fs");

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  },
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  }
});

fs.writeFileSync(process.env.PRIVY_PRIVATE_KEY_FILE, privateKey);
fs.writeFileSync(process.env.PRIVY_PUBLIC_KEY_FILE, publicKey);
NODE

npm run alpha:db:reset
npm run build -w @fanpass/api

API_ENTRY="apps/api/dist/src/main.js"
if [[ ! -f "$API_ENTRY" ]]; then
  API_ENTRY="apps/api/dist/main.js"
fi

PORT=4100 \
FANPASS_DATA_SOURCE=prisma \
FANPASS_ENABLE_PRISMA_CONNECT=true \
FANPASS_REQUIRE_PAYMENT_AUTHORIZATION=true \
DATABASE_URL="$DATABASE_URL" \
PRIVY_APP_ID="privy-app-demo" \
PRIVY_VERIFICATION_KEY="$(cat "$PRIVY_PUBLIC_KEY_FILE")" \
node "$API_ENTRY" >"$LOG_FILE" 2>&1 &
API_PID="$!"

printf 'Waiting for Alpha Prisma API'
for _ in {1..30}; do
  if curl --max-time 2 -fsS "$API_BASE_URL/health" >/dev/null 2>&1; then
    printf '\n'
    break
  fi
  printf '.'
  sleep 1
done

if ! curl --max-time 2 -fsS "$API_BASE_URL/health" >/dev/null 2>&1; then
  printf '\nAlpha Prisma API did not become healthy. Log:\n' >&2
  sed -n '1,180p' "$LOG_FILE" >&2
  exit 1
fi

node <<'NODE'
const baseUrl = process.env.API_BASE_URL || "http://localhost:4100";
const { createSign } = await import("node:crypto");
const fs = await import("node:fs");
const privyPrivateKey = fs.readFileSync(process.env.PRIVY_PRIVATE_KEY_FILE, "utf8");

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

async function requestRejected(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (response.ok) {
    throw new Error(`${path} unexpectedly succeeded: ${JSON.stringify(body)}`);
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

function auth(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}

function signPrivyToken(sub) {
  const header = base64url(JSON.stringify({ alg: "ES256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      iss: "privy.io",
      aud: "privy-app-demo",
      sub,
      exp: Math.floor(Date.now() / 1000) + 300
    })
  );
  const signature = createSign("sha256")
    .update(`${header}.${body}`)
    .sign({ key: privyPrivateKey, dsaEncoding: "ieee-p1363" })
    .toString("base64url");

  return `${header}.${body}.${signature}`;
}

function base64url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

const organizerToken = await demoToken("usr_organizer_demo");
const fanToken = await demoToken("usr_fan_demo");
const buyerToken = await demoToken("usr_buyer_demo");
const gateToken = await demoToken("usr_gate_demo");

const { PrismaClient } = await import("@prisma/client");
const { execFileSync } = await import("node:child_process");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://fanpass:fanpass@localhost:5432/fanpass"
    }
  }
});
await prisma.user.create({
  data: {
    id: "usr_other_organizer",
    name: "Other Organizer",
    email: "other-organizer@fanpass.test",
    role: "ORGANIZER",
    privyId: "did:privy:other-organizer-demo",
    walletAddress: null,
    riskScore: 0
  }
});
await prisma.user.create({
  data: {
    id: "usr_admin_demo",
    name: "Demo Admin",
    email: "admin@fanpass.test",
    role: "ADMIN",
    privyId: "did:privy:admin-demo",
    walletAddress: null,
    riskScore: 0
  }
});
await prisma.organizer.create({
  data: {
    id: "org_other_demo",
    userId: "usr_other_organizer",
    organizationName: "Other Events Ltd",
    verificationStatus: "APPROVED",
    payoutAccountId: null
  }
});
await prisma.venue.create({
  data: {
    id: "ven_other_demo",
    name: "Other Arena",
    country: "HK",
    city: "Hong Kong",
    address: "Other Arena",
    timezone: "Asia/Hong_Kong",
    capacity: 8000
  }
});
await prisma.event.create({
  data: {
    id: "evt_other_demo",
    organizerId: "org_other_demo",
    venueId: "ven_other_demo",
    title: "Other Organizer Private Event",
    startTime: new Date("2026-12-01T12:00:00.000Z"),
    endTime: new Date("2026-12-01T15:00:00.000Z"),
    status: "PUBLISHED",
    posterUrl: null
  }
});
await prisma.ticketType.create({
  data: {
    id: "tt_other_demo",
    eventId: "evt_other_demo",
    name: "PRIVATE",
    faceValue: 999,
    currency: "HKD",
    supply: 50,
    transferable: true,
    resaleCap: 1199,
    maxTransferCount: 1
  }
});
await prisma.$disconnect();

const otherOrganizerToken = await demoToken("usr_other_organizer");
const adminToken = await demoToken("usr_admin_demo");

const status = await request("/alpha/persistence/status", { headers: auth(organizerToken) });
if (!status.ok || status.counts.events !== 1 || status.counts.tickets !== 1 || status.counts.ticketTypes !== 1) {
  throw new Error(`Unexpected persistence status: ${JSON.stringify(status)}`);
}

const events = await request("/events");
if (!Array.isArray(events) || !events.some((event) => event.id === "evt_weekend_demo")) {
  throw new Error(`Unexpected events response: ${JSON.stringify(events)}`);
}

const owned = await request("/tickets/owner/usr_fan_demo", { headers: auth(fanToken) });
if (!Array.isArray(owned) || owned.length !== 1 || owned[0].id !== "tkt_demo_001") {
  throw new Error(`Unexpected owned ticket response: ${JSON.stringify(owned)}`);
}

const issued = await request("/tickets/issue", {
  method: "POST",
  headers: auth(organizerToken),
  body: JSON.stringify({
    eventId: "evt_weekend_demo",
    ticketTypeId: "tt_cat2_demo",
    ownerId: "usr_organizer_demo",
    seatHash: "alpha-issued-seat"
  })
});
if (!issued.id || !issued.tokenId) {
  throw new Error(`Expected Prisma ticket issue through ownership adapter: ${JSON.stringify(issued)}`);
}

const alphaEvent = await request("/alpha/events", {
  method: "POST",
  headers: auth(organizerToken),
  body: JSON.stringify({
    title: "Alpha Console Persisted Event",
    venueName: "AsiaWorld-Arena",
    city: "Hong Kong",
    startTime: "2026-11-21T12:00:00.000Z",
    endTime: "2026-11-21T15:00:00.000Z"
  })
});
if (!alphaEvent.id || alphaEvent.title !== "Alpha Console Persisted Event") {
  throw new Error(`Unexpected Alpha event response: ${JSON.stringify(alphaEvent)}`);
}

const alphaTicketType = await request(`/alpha/events/${alphaEvent.id}/ticket-types`, {
  method: "POST",
  headers: auth(organizerToken),
  body: JSON.stringify({
    name: "CAT 1",
    faceValue: 1888,
    currency: "HKD",
    supply: 200,
    transferable: true,
    resaleCap: 2265,
    maxTransferCount: 2
  })
});
if (!alphaTicketType.id || alphaTicketType.eventId !== alphaEvent.id) {
  throw new Error(`Unexpected Alpha ticket type response: ${JSON.stringify(alphaTicketType)}`);
}

const inventorySnapshot = await request("/alpha/operations", { headers: auth(organizerToken) });
if (!inventorySnapshot.events.some((event) => event.id === alphaEvent.id && event.ticketTypes.length === 1)) {
  throw new Error(`Expected Alpha operations to include persisted event inventory: ${JSON.stringify(inventorySnapshot.events)}`);
}
if (inventorySnapshot.events.some((event) => event.id === "evt_other_demo")) {
  throw new Error(`Organizer operations leaked another organizer event: ${JSON.stringify(inventorySnapshot.events)}`);
}

const otherInventorySnapshot = await request("/alpha/operations", { headers: auth(otherOrganizerToken) });
if (otherInventorySnapshot.events.length !== 1 || otherInventorySnapshot.events[0].id !== "evt_other_demo") {
  throw new Error(`Other organizer should only see its own event: ${JSON.stringify(otherInventorySnapshot.events)}`);
}

await requestRejected(`/alpha/events/${alphaEvent.id}/ticket-types`, {
  method: "POST",
  headers: auth(otherOrganizerToken),
  body: JSON.stringify({
    name: "SHOULD_FAIL",
    faceValue: 100,
    currency: "HKD",
    supply: 1,
    transferable: true,
    resaleCap: 120,
    maxTransferCount: 1
  })
});

await requestRejected("/tickets/issue", {
  method: "POST",
  headers: auth(organizerToken),
  body: JSON.stringify({
    eventId: "evt_other_demo",
    ticketTypeId: "tt_other_demo",
    ownerId: "usr_fan_demo",
    seatHash: "should-not-issue-cross-organizer"
  })
});

const gateAssignment = await request("/alpha/gate-assignments", {
  method: "POST",
  headers: auth(organizerToken),
  body: JSON.stringify({
    eventId: "evt_weekend_demo",
    gate: "A2",
    staffName: "Gate A2 Staff",
    staffEmail: "gate-a2@fanpass.test"
  })
});
if (
  !gateAssignment.id ||
  gateAssignment.gate !== "A2" ||
  gateAssignment.active !== true ||
  gateAssignment.invite?.status !== "PENDING" ||
  !gateAssignment.inviteToken
) {
  throw new Error(`Unexpected gate assignment response: ${JSON.stringify(gateAssignment)}`);
}

await requestRejected("/alpha/gate-assignments", {
  method: "POST",
  headers: auth(otherOrganizerToken),
  body: JSON.stringify({
    eventId: "evt_weekend_demo",
    gate: "B1",
    staffName: "Cross Scope Staff",
    staffEmail: "cross-scope-gate@fanpass.test"
  })
});

const gateMgmtPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://fanpass:fanpass@localhost:5432/fanpass"
    }
  }
});
const gateA2Staff = await gateMgmtPrisma.user.findUnique({
  where: {
    email: "gate-a2@fanpass.test"
  }
});
if (!gateA2Staff || gateA2Staff.role !== "GATE_STAFF") {
  throw new Error(`Expected gate staff user to be created: ${JSON.stringify(gateA2Staff)}`);
}
await gateMgmtPrisma.$disconnect();

const staffPrivyToken = signPrivyToken("did:privy:gate-a2-staff");
const rotatedGateInvite = await request(`/alpha/gate-assignments/${gateAssignment.id}/invites`, {
  method: "POST",
  headers: auth(organizerToken),
  body: JSON.stringify({})
});
if (
  rotatedGateInvite.id !== gateAssignment.id ||
  rotatedGateInvite.invite?.status !== "PENDING" ||
  !rotatedGateInvite.inviteToken ||
  rotatedGateInvite.inviteToken === gateAssignment.inviteToken
) {
  throw new Error(`Expected rotated gate invite token: ${JSON.stringify(rotatedGateInvite)}`);
}

await requestRejected(`/alpha/gate-assignments/${gateAssignment.id}/invites`, {
  method: "POST",
  headers: auth(otherOrganizerToken),
  body: JSON.stringify({})
});

await requestRejected("/auth/privy/accept-staff-invite", {
  method: "POST",
  headers: auth(staffPrivyToken),
  body: JSON.stringify({
    inviteToken: gateAssignment.inviteToken
  })
});

const acceptedStaffInvite = await request("/auth/privy/accept-staff-invite", {
  method: "POST",
  headers: auth(staffPrivyToken),
  body: JSON.stringify({
    inviteToken: rotatedGateInvite.inviteToken,
    walletAddress: "0x0000000000000000000000000000000000004002"
  })
});
if (
  acceptedStaffInvite.userId !== gateA2Staff.id ||
  acceptedStaffInvite.role !== "GATE_STAFF" ||
  acceptedStaffInvite.privyId !== "did:privy:gate-a2-staff" ||
  acceptedStaffInvite.inviteAccepted !== true
) {
  throw new Error(`Expected staff invite acceptance to link Privy staff user: ${JSON.stringify(acceptedStaffInvite)}`);
}

await requestRejected("/auth/privy/accept-staff-invite", {
  method: "POST",
  headers: auth(signPrivyToken("did:privy:other-gate-a2-staff")),
  body: JSON.stringify({
    inviteToken: rotatedGateInvite.inviteToken
  })
});

await requestRejected(`/alpha/gate-assignments/${gateAssignment.id}/invites`, {
  method: "POST",
  headers: auth(organizerToken),
  body: JSON.stringify({})
});

const gateA2Token = await demoToken(gateA2Staff.id);
const gateA2Summary = await request("/verification/events/evt_weekend_demo/gates/A2/checkins/summary", {
  headers: auth(gateA2Token)
});
if (gateA2Summary.total !== 0 || gateA2Summary.gate !== "A2") {
  throw new Error(`Expected empty A2 summary for newly assigned staff: ${JSON.stringify(gateA2Summary)}`);
}

const deactivatedGateAssignment = await request(`/alpha/gate-assignments/${gateAssignment.id}/deactivate`, {
  method: "POST",
  headers: auth(organizerToken),
  body: JSON.stringify({})
});
if (deactivatedGateAssignment.active !== false) {
  throw new Error(`Expected gate assignment deactivation: ${JSON.stringify(deactivatedGateAssignment)}`);
}

const deactivatedSummary = await requestRejected("/verification/events/evt_weekend_demo/gates/A2/checkins/summary", {
  headers: auth(gateA2Token)
});
if (!String(deactivatedSummary.message || "").includes("assigned")) {
  throw new Error(`Expected deactivated assignment to block A2 access: ${JSON.stringify(deactivatedSummary)}`);
}

const cancellableSell = await request("/orders", {
  method: "POST",
  headers: auth(fanToken),
  body: JSON.stringify({
    eventId: "evt_weekend_demo",
    ticketTypeId: "tt_cat2_demo",
    side: "SELL",
    price: 1310,
    ticketId: "tkt_demo_001"
  })
});
if (cancellableSell.order.status !== "OPEN") {
  throw new Error(`Expected cancellable sell order to stay open: ${JSON.stringify(cancellableSell)}`);
}

const userOrders = await request("/orders/users/usr_fan_demo", { headers: auth(fanToken) });
if (!Array.isArray(userOrders) || !userOrders.some((order) => order.id === cancellableSell.order.id)) {
  throw new Error(`Expected user order list to include cancellable sell: ${JSON.stringify(userOrders)}`);
}

const cancelledOrder = await request(`/orders/${cancellableSell.order.id}/cancel`, {
  method: "POST",
  headers: auth(fanToken),
  body: JSON.stringify({})
});
if (cancelledOrder.status !== "CANCELLED" || cancelledOrder.remainingQuantity !== 0) {
  throw new Error(`Unexpected cancel order response: ${JSON.stringify(cancelledOrder)}`);
}

const releasedTicket = await request("/tickets/owner/usr_fan_demo", { headers: auth(fanToken) });
if (!Array.isArray(releasedTicket) || releasedTicket[0].status !== "ACTIVE") {
  throw new Error(`Expected cancelled sell order to release the ticket: ${JSON.stringify(releasedTicket)}`);
}

const submission = await request("/fan-access/tasks/task_quiz_demo/submissions", {
  method: "POST",
  headers: auth(fanToken),
  body: JSON.stringify({
    proof: "alpha-prisma-verify"
  })
});
if (submission.status !== "APPROVED") {
  throw new Error(`Unexpected submission response: ${JSON.stringify(submission)}`);
}

const score = await request("/fan-access/events/evt_weekend_demo/users/usr_fan_demo/score", { headers: auth(fanToken) });
if (score.score !== 20 || score.entitlementStatus !== "WAITLIST") {
  throw new Error(`Unexpected score response: ${JSON.stringify(score)}`);
}

const paymentBuy = await request("/orders", {
  method: "POST",
  headers: {
    ...auth(buyerToken),
    "Idempotency-Key": "alpha-buy-payment-1"
  },
  body: JSON.stringify({
    eventId: "evt_weekend_demo",
    ticketTypeId: "tt_cat2_demo",
    side: "BUY",
    price: 1320
  })
});
if (paymentBuy.order.status !== "OPEN" || paymentBuy.trade !== null) {
  throw new Error(`Expected payment preauth buy order to remain open: ${JSON.stringify(paymentBuy)}`);
}

const sell = await request("/orders", {
  method: "POST",
  headers: auth(fanToken),
  body: JSON.stringify({
    eventId: "evt_weekend_demo",
    ticketTypeId: "tt_cat2_demo",
    side: "SELL",
    price: 1320,
    ticketId: "tkt_demo_001"
  })
});
if (sell.order.status !== "OPEN" || sell.trade !== null) {
  throw new Error(`Expected sell order to wait for buyer payment authorization: ${JSON.stringify(sell)}`);
}

const payment = await request("/payments/intents", {
  method: "POST",
  headers: {
    ...auth(buyerToken),
    "Idempotency-Key": "alpha-payment-1"
  },
  body: JSON.stringify({
    orderId: paymentBuy.order.id
  })
});
if (
  !payment.id ||
  payment.orderId !== paymentBuy.order.id ||
  payment.amount !== 132000 ||
  payment.currency !== "hkd" ||
  payment.status !== "requires_payment_method" ||
  payment.captureStatus !== "NOT_CAPTURED" ||
  !payment.stripePaymentIntentId ||
  !payment.clientSecret
) {
  throw new Error(`Unexpected payment intent response: ${JSON.stringify(payment)}`);
}

const paymentRetry = await request("/payments/intents", {
  method: "POST",
  headers: {
    ...auth(buyerToken),
    "Idempotency-Key": "alpha-payment-1"
  },
  body: JSON.stringify({
    orderId: paymentBuy.order.id
  })
});
if (paymentRetry.id !== payment.id || paymentRetry.stripePaymentIntentId !== payment.stripePaymentIntentId) {
  throw new Error(`Expected idempotent payment retry: ${JSON.stringify(paymentRetry)}`);
}

const paymentWebhook = await request("/payments/webhook", {
  method: "POST",
  body: JSON.stringify({
    id: "evt_alpha_payment_authorized_1",
    type: "payment_intent.amount_capturable_updated",
    data: {
      object: {
        id: payment.stripePaymentIntentId,
        status: "requires_capture"
      }
    }
  })
});
if (!paymentWebhook.payment || paymentWebhook.payment.captureStatus !== "AUTHORIZED") {
  throw new Error(`Expected payment webhook to mark payment authorized: ${JSON.stringify(paymentWebhook)}`);
}

const paymentWebhookReplay = await request("/payments/webhook", {
  method: "POST",
  body: JSON.stringify({
    id: "evt_alpha_payment_authorized_1",
    type: "payment_intent.amount_capturable_updated",
    data: {
      object: {
        id: payment.stripePaymentIntentId,
        status: "requires_capture"
      }
    }
  })
});
if (!paymentWebhookReplay.duplicate) {
  throw new Error(`Expected duplicate payment webhook replay to be ignored: ${JSON.stringify(paymentWebhookReplay)}`);
}

execFileSync("npm", ["run", "side-effects:work-once", "-w", "@fanpass/api"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    FANPASS_DATA_SOURCE: "prisma",
    FANPASS_ENABLE_PRISMA_CONNECT: "true",
    FANPASS_REQUIRE_PAYMENT_AUTHORIZATION: "true",
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://fanpass:fanpass@localhost:5432/fanpass"
  }
});

const buyRetry = await request("/orders", {
  method: "POST",
  headers: {
    ...auth(buyerToken),
    "Idempotency-Key": "alpha-buy-payment-1"
  },
  body: JSON.stringify({
    eventId: "evt_weekend_demo",
    ticketTypeId: "tt_cat2_demo",
    side: "BUY",
    price: 1320
  })
});
if (
  buyRetry.order.id !== paymentBuy.order.id ||
  !buyRetry.trade ||
  buyRetry.trade.buyOrderId !== paymentBuy.order.id ||
  buyRetry.trade.sellOrderId !== sell.order.id
) {
  throw new Error(`Expected authorized payment retry to settle existing buy/sell orders: ${JSON.stringify(buyRetry)}`);
}

execFileSync("npm", ["run", "side-effects:work-once", "-w", "@fanpass/api"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    FANPASS_DATA_SOURCE: "prisma",
    FANPASS_ENABLE_PRISMA_CONNECT: "true",
    FANPASS_REQUIRE_PAYMENT_AUTHORIZATION: "true",
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://fanpass:fanpass@localhost:5432/fanpass"
  }
});

await requestRejected(`/payments/${payment.id}/refund`, {
  method: "POST",
  headers: {
    ...auth(organizerToken),
    "Idempotency-Key": "alpha-payment-refund-forbidden-1"
  },
  body: JSON.stringify({
    reason: "organizer_should_not_trigger_payment_refund"
  })
});

const reconcileRequest = await request(`/payments/${payment.id}/reconcile`, {
  method: "POST",
  headers: {
    ...auth(adminToken),
    "Idempotency-Key": "alpha-payment-reconcile-1"
  },
  body: JSON.stringify({
    reason: "alpha-prisma-verify"
  })
});
if (
  !reconcileRequest.ok ||
  reconcileRequest.payment.id !== payment.id ||
  reconcileRequest.sideEffect.type !== "PAYMENT_RECONCILE"
) {
  throw new Error(`Unexpected payment reconcile request response: ${JSON.stringify(reconcileRequest)}`);
}

const reconcileRetry = await request(`/payments/${payment.id}/reconcile`, {
  method: "POST",
  headers: {
    ...auth(adminToken),
    "Idempotency-Key": "alpha-payment-reconcile-1"
  },
  body: JSON.stringify({
    reason: "alpha-prisma-verify"
  })
});
if (reconcileRetry.sideEffect.id !== reconcileRequest.sideEffect.id) {
  throw new Error(`Expected idempotent payment reconcile retry: ${JSON.stringify(reconcileRetry)}`);
}

const constraintPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://fanpass:fanpass@localhost:5432/fanpass"
    }
  }
});
try {
  await constraintPrisma.trade.create({
    data: {
      id: "trd_duplicate_should_fail",
      buyOrderId: buyRetry.trade.buyOrderId,
      sellOrderId: buyRetry.trade.sellOrderId,
      ticketId: buyRetry.trade.ticketId,
      price: buyRetry.trade.price,
      fee: 0,
      settlementStatus: "SETTLED"
    }
  });
  throw new Error("Duplicate trade insert unexpectedly succeeded");
} catch (error) {
  if (error instanceof Error && error.message === "Duplicate trade insert unexpectedly succeeded") {
    throw error;
  }
  if (error.code !== "P2002") {
    throw new Error(`Expected duplicate trade unique constraint, got: ${error.message || error}`);
  }
}

const sideEffects = await constraintPrisma.sideEffectOutbox.findMany({
  where: {
    type: "OWNERSHIP_TRANSFER",
    status: "COMPLETED",
    aggregateId: `${buyRetry.trade.buyOrderId}:${buyRetry.trade.sellOrderId}`
  }
});
if (sideEffects.length !== 1 || sideEffects[0].payloadJson.transactionHash === undefined) {
  throw new Error(`Expected completed ownership side-effect outbox entry: ${JSON.stringify(sideEffects)}`);
}
await constraintPrisma.$disconnect();

const buyerTickets = await request("/tickets/owner/usr_buyer_demo", { headers: auth(buyerToken) });
if (!Array.isArray(buyerTickets) || buyerTickets.length !== 1 || buyerTickets[0].id !== "tkt_demo_001") {
  throw new Error(`Expected buyer to own ticket after trade: ${JSON.stringify(buyerTickets)}`);
}

const qr = await request("/verification/qr", {
  method: "POST",
  headers: auth(buyerToken),
  body: JSON.stringify({
    ticketId: "tkt_demo_001"
  })
});
if (!qr.signature || !qr.nonce) {
  throw new Error(`Unexpected QR response: ${JSON.stringify(qr)}`);
}

const redeemBody = {
  ...qr,
  gate: "A1"
};
const unassignedGateRedeem = await requestRejected("/verification/redeem", {
  method: "POST",
  headers: auth(gateToken),
  body: JSON.stringify({
    ...qr,
    gate: "A2"
  })
});
if (!String(unassignedGateRedeem.message || "").includes("assigned")) {
  throw new Error(`Expected unassigned gate rejection: ${JSON.stringify(unassignedGateRedeem)}`);
}

const redeem = await request("/verification/redeem", {
  method: "POST",
  headers: auth(gateToken),
  body: JSON.stringify(redeemBody)
});
if (redeem.result !== "ACCEPTED") {
  throw new Error(`Unexpected redemption response: ${JSON.stringify(redeem)}`);
}

const duplicate = await requestRejected("/verification/redeem", {
  method: "POST",
  headers: auth(gateToken),
  body: JSON.stringify(redeemBody)
});
if (!String(duplicate.message || "").includes("nonce")) {
  throw new Error(`Unexpected duplicate redemption response: ${JSON.stringify(duplicate)}`);
}
if (duplicate.result !== "DUPLICATE") {
  throw new Error(`Expected duplicate redemption result enum: ${JSON.stringify(duplicate)}`);
}

const checkinSummary = await request("/verification/events/evt_weekend_demo/gates/A1/checkins/summary", { headers: auth(gateToken) });
if (checkinSummary.accepted !== 1 || checkinSummary.rejected !== 1 || checkinSummary.results.DUPLICATE !== 1) {
  throw new Error(`Unexpected check-in summary: ${JSON.stringify(checkinSummary)}`);
}
const unassignedSummary = await requestRejected("/verification/events/evt_weekend_demo/gates/A2/checkins/summary", {
  headers: auth(gateToken)
});
if (!String(unassignedSummary.message || "").includes("assigned")) {
  throw new Error(`Expected unassigned summary rejection: ${JSON.stringify(unassignedSummary)}`);
}

const updatedStatus = await request("/alpha/persistence/status", { headers: auth(organizerToken) });
if (
  updatedStatus.counts.auditLogs < 12 ||
  updatedStatus.counts.orders !== 3 ||
  updatedStatus.counts.trades !== 1 ||
  updatedStatus.counts.payments !== 1 ||
  updatedStatus.counts.sideEffects !== 5 ||
  updatedStatus.counts.paymentWebhookEvents !== 1 ||
  updatedStatus.counts.gateAssignments !== 2 ||
  updatedStatus.counts.staffInvites !== 2 ||
  updatedStatus.counts.checkins !== 2
) {
  throw new Error(`Expected persisted order/trade/checkin/audit state: ${JSON.stringify(updatedStatus)}`);
}

const operations = await request("/alpha/operations", { headers: auth(organizerToken) });
if (!operations.market || operations.market.priceHistory.length !== 1 || operations.market.lastTradePrice !== 1320) {
  throw new Error(`Expected Alpha operations market history: ${JSON.stringify(operations.market)}`);
}
if (
  !Array.isArray(operations.payments) ||
  operations.payments.length !== 1 ||
  operations.payments[0].captureStatus !== "CAPTURED" ||
  operations.payments[0].stripePaymentIntentId !== null
) {
  throw new Error(`Expected redacted Alpha operations payment trail: ${JSON.stringify(operations.payments)}`);
}
if (
  !Array.isArray(operations.sideEffects) ||
  !operations.sideEffects.some((sideEffect) => sideEffect.type === "OWNERSHIP_TRANSFER" && sideEffect.status === "COMPLETED") ||
  !operations.sideEffects.some((sideEffect) => sideEffect.type === "PAYMENT_INTENT_CREATE" && sideEffect.status === "COMPLETED") ||
  !operations.sideEffects.some((sideEffect) => sideEffect.type === "ORDER_MATCH_AFTER_PAYMENT_AUTH" && sideEffect.status === "COMPLETED") ||
  !operations.sideEffects.some((sideEffect) => sideEffect.type === "PAYMENT_CAPTURE" && sideEffect.status === "COMPLETED") ||
  !operations.sideEffects.some((sideEffect) => sideEffect.type === "PAYMENT_RECONCILE" && sideEffect.status === "PENDING")
) {
  throw new Error(`Expected Alpha operations side-effect trail: ${JSON.stringify(operations.sideEffects)}`);
}
if (!operations.privacy?.piiRedacted || operations.privacy.viewerRole !== "ORGANIZER") {
  throw new Error(`Expected organizer operations snapshot to be PII-redacted: ${JSON.stringify(operations.privacy)}`);
}
if (operations.tickets.some((ticket) => ticket.ownerEmail !== null || !String(ticket.ownerId).startsWith("user_ref_"))) {
  throw new Error(`Expected ticket owner PII redaction: ${JSON.stringify(operations.tickets)}`);
}
if (operations.checkins.some((checkin) => checkin.scannerEmail !== null || checkin.nonce !== null)) {
  throw new Error(`Expected check-in PII redaction: ${JSON.stringify(operations.checkins)}`);
}
if (
  !Array.isArray(operations.gateAssignments) ||
  !operations.gateAssignments.some((assignment) => assignment.gate === "A1" && assignment.active === true) ||
  !operations.gateAssignments.some((assignment) =>
    assignment.gate === "A2" &&
    assignment.active === false &&
    assignment.linked === true &&
    assignment.invite?.status === "ACCEPTED"
  ) ||
  operations.gateAssignments.some((assignment) => assignment.staffEmail !== null || !String(assignment.staffUserId).startsWith("user_ref_"))
) {
  throw new Error(`Expected scoped and redacted gate assignments: ${JSON.stringify(operations.gateAssignments)}`);
}
if (JSON.stringify(operations.gateAssignments).includes("inviteToken")) {
  throw new Error(`Operations snapshot must not expose staff invite tokens: ${JSON.stringify(operations.gateAssignments)}`);
}
if (operations.fanTaskSubmissions.some((submission) => submission.proof !== "Hidden by default")) {
  throw new Error(`Expected fan task proof redaction: ${JSON.stringify(operations.fanTaskSubmissions)}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "prisma",
      eventId: events[0].id,
      ownedTicketId: owned[0].id,
      issuedTicketId: issued.id,
      submissionStatus: submission.status,
      score: score.score,
      tradeId: buyRetry.trade.id,
      sideEffects: sideEffects.length,
      paymentId: payment.id,
      paymentAuthorizationStatus: paymentWebhook.payment.captureStatus,
      paymentCaptureStatus: operations.payments[0].captureStatus,
      reconcileSideEffect: reconcileRequest.sideEffect.id,
      redeem: redeem.result,
      duplicate: duplicate.message,
      gateAccepted: checkinSummary.accepted,
      gateRejected: checkinSummary.rejected,
      gateAssignments: updatedStatus.counts.gateAssignments,
      staffInvites: updatedStatus.counts.staffInvites,
      cancelledOrder: cancelledOrder.status,
      userOrders: userOrders.length,
      checkins: updatedStatus.counts.checkins,
      payments: updatedStatus.counts.payments,
      paymentWebhookEvents: updatedStatus.counts.paymentWebhookEvents,
      auditLogs: updatedStatus.counts.auditLogs,
      statusSideEffects: updatedStatus.counts.sideEffects,
      alphaEvents: operations.events.length,
      priceHistory: operations.market.priceHistory.length
    },
    null,
    2
  )
);
NODE
