#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"

curl --max-time 5 -fsS "$API_BASE_URL/health" >/dev/null

node <<'NODE'
const { io } = await import("socket.io-client");
const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";

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
  return { response, body };
}

async function demoToken(userId) {
  const result = await request("/auth/demo-session", {
    method: "POST",
    body: JSON.stringify({ userId })
  });
  if (!result.response.ok || !result.body.accessToken) {
    throw new Error(`Demo session failed for ${userId}: ${JSON.stringify(result.body)}`);
  }
  return result.body.accessToken;
}

function auth(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}

function socketUrl() {
  return baseUrl.replace(/^http/, "ws");
}

function waitForSocketConnect(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Orderbook socket connect timed out")), 5000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForSocketEvent(socket, eventName, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`${eventName} timed out`));
    }, 5000);
    function handler(payload) {
      if (!predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    }
    socket.on(eventName, handler);
  });
}

function emitWithAck(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${eventName} ack timed out`)), 5000);
    socket.emit(eventName, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

const organizerToken = await demoToken("usr_organizer_demo");
const fanToken = await demoToken("usr_fan_demo");
const buyerToken = await demoToken("usr_buyer_demo");
const gateToken = await demoToken("usr_gate_demo");

const reset = await request("/prototype/reset", {
  method: "POST",
  headers: auth(organizerToken)
});
if (!reset.response.ok) {
  throw new Error(`Prototype reset failed: ${JSON.stringify(reset.body)}`);
}

const eventsResult = await request("/events");
if (!eventsResult.response.ok || eventsResult.body.length === 0) {
  throw new Error("No demo events returned");
}

const event = eventsResult.body[0];
const ticketType = event.ticketTypes[0];
if (!ticketType) {
  throw new Error("No demo ticket type returned");
}

const orderbookSocket = io(`${socketUrl()}/orderbook`, {
  transports: ["websocket"],
  reconnection: false,
  timeout: 5000
});
await waitForSocketConnect(orderbookSocket);
const snapshotPromise = waitForSocketEvent(orderbookSocket, "orderbook.snapshot");
const subscribeAck = await emitWithAck(orderbookSocket, "orderbook.subscribe", {
  eventId: event.id,
  ticketTypeId: ticketType.id
});
if (!subscribeAck?.ok) {
  throw new Error(`Orderbook subscribe ack failed: ${JSON.stringify(subscribeAck)}`);
}
const initialSnapshot = await snapshotPromise;
if (
  initialSnapshot.eventId !== event.id ||
  initialSnapshot.ticketTypeId !== ticketType.id ||
  !initialSnapshot.snapshot ||
  !Array.isArray(initialSnapshot.snapshot.bids) ||
  !Array.isArray(initialSnapshot.snapshot.asks)
) {
  throw new Error(`Unexpected orderbook snapshot: ${JSON.stringify(initialSnapshot)}`);
}

const issued = await request("/tickets/issue", {
  method: "POST",
  headers: auth(organizerToken),
  body: JSON.stringify({
    eventId: event.id,
    ticketTypeId: ticketType.id,
    ownerId: "usr_buyer_demo",
    seatHash: "prototype-issued-seat"
  })
});
if (!issued.response.ok || !issued.body.tokenId) {
  throw new Error(`Ticket issue through ownership adapter failed: ${JSON.stringify(issued.body)}`);
}

const sellUpdatePromise = waitForSocketEvent(
  orderbookSocket,
  "orderbook.updated",
  (payload) => payload.reason === "order_created" && payload.eventId === event.id && payload.ticketTypeId === ticketType.id
);
const sell = await request("/orders", {
  method: "POST",
  headers: auth(fanToken),
  body: JSON.stringify({
    eventId: event.id,
    ticketTypeId: ticketType.id,
    side: "SELL",
    price: ticketType.faceValue + 32,
    ticketId: "tkt_demo_001"
  })
});
if (!sell.response.ok) {
  throw new Error(`Sell order failed: ${JSON.stringify(sell.body)}`);
}
const sellUpdate = await sellUpdatePromise;
if (!sellUpdate.snapshot.asks.some((level) => level.price === ticketType.faceValue + 32 && level.quantity === 1)) {
  throw new Error(`Orderbook WebSocket did not broadcast sell level: ${JSON.stringify(sellUpdate)}`);
}

const tradeUpdatePromise = waitForSocketEvent(
  orderbookSocket,
  "orderbook.updated",
  (payload) => payload.reason === "trade_settled" && payload.eventId === event.id && payload.ticketTypeId === ticketType.id
);
const buy = await request("/orders", {
  method: "POST",
  headers: {
    ...auth(buyerToken),
    "Idempotency-Key": "prototype-buy-match-1"
  },
  body: JSON.stringify({
    eventId: event.id,
    ticketTypeId: ticketType.id,
    side: "BUY",
    price: ticketType.faceValue + 32
  })
});
if (!buy.response.ok || !buy.body.trade) {
  throw new Error(`Buy order did not settle: ${JSON.stringify(buy.body)}`);
}
const tradeUpdate = await tradeUpdatePromise;
if (tradeUpdate.tradeId !== buy.body.trade.id || tradeUpdate.snapshot.lastTradePrice !== ticketType.faceValue + 32) {
  throw new Error(`Orderbook WebSocket did not broadcast settled trade: ${JSON.stringify(tradeUpdate)}`);
}
orderbookSocket.close();

const buyRetry = await request("/orders", {
  method: "POST",
  headers: {
    ...auth(buyerToken),
    "Idempotency-Key": "prototype-buy-match-1"
  },
  body: JSON.stringify({
    eventId: event.id,
    ticketTypeId: ticketType.id,
    side: "BUY",
    price: ticketType.faceValue + 32
  })
});
if (!buyRetry.response.ok || buyRetry.body.order.id !== buy.body.order.id || buyRetry.body.trade?.id !== buy.body.trade.id) {
  throw new Error(`Idempotent buy retry did not return existing order/trade: ${JSON.stringify(buyRetry.body)}`);
}

const qr = await request("/verification/qr", {
  method: "POST",
  headers: auth(buyerToken),
  body: JSON.stringify({
    ticketId: "tkt_demo_001"
  })
});
if (!qr.response.ok) {
  throw new Error(`QR generation failed: ${JSON.stringify(qr.body)}`);
}

const redeemBody = {
  ...qr.body,
  gate: "A1"
};
const unassignedGateRedeem = await request("/verification/redeem", {
  method: "POST",
  headers: auth(gateToken),
  body: JSON.stringify({
    ...qr.body,
    gate: "A2"
  })
});
if (unassignedGateRedeem.response.ok || !String(unassignedGateRedeem.body.message || "").includes("assigned")) {
  throw new Error(`Expected unassigned gate redemption rejection: ${JSON.stringify(unassignedGateRedeem.body)}`);
}

const firstRedeem = await request("/verification/redeem", {
  method: "POST",
  headers: auth(gateToken),
  body: JSON.stringify(redeemBody)
});
if (!firstRedeem.response.ok || firstRedeem.body.result !== "ACCEPTED") {
  throw new Error(`First redemption failed: ${JSON.stringify(firstRedeem.body)}`);
}

const duplicateRedeem = await request("/verification/redeem", {
  method: "POST",
  headers: auth(gateToken),
  body: JSON.stringify(redeemBody)
});
if (duplicateRedeem.response.ok) {
  throw new Error("Duplicate redemption was accepted");
}
if (duplicateRedeem.body.result !== "DUPLICATE") {
  throw new Error(`Duplicate redemption did not expose a result enum: ${JSON.stringify(duplicateRedeem.body)}`);
}

const checkinSummary = await request(`/verification/events/${event.id}/gates/A1/checkins/summary`, {
  headers: auth(gateToken)
});
if (!checkinSummary.response.ok || checkinSummary.body.accepted !== 1 || checkinSummary.body.rejected !== 1) {
  throw new Error(`Unexpected gate check-in summary: ${JSON.stringify(checkinSummary.body)}`);
}

const unassignedSummary = await request(`/verification/events/${event.id}/gates/A2/checkins/summary`, {
  headers: auth(gateToken)
});
if (unassignedSummary.response.ok || !String(unassignedSummary.body.message || "").includes("assigned")) {
  throw new Error(`Expected unassigned gate summary rejection: ${JSON.stringify(unassignedSummary.body)}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: event.id,
      issuedTicketId: issued.body.id,
      ticketTypeId: ticketType.id,
      tradeId: buy.body.trade.id,
      orderbookRealtime: tradeUpdate.reason,
      firstRedeem: firstRedeem.body.result,
      duplicateRedeem: duplicateRedeem.body.message,
      gateAccepted: checkinSummary.body.accepted,
      gateRejected: checkinSummary.body.rejected
    },
    null,
    2
  )
);
NODE
