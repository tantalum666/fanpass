"use client";

import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

interface MarketSnapshot {
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  currency: string;
  faceValue: number;
  resaleCap: number | null;
  bids: { price: number; quantity: number }[];
  asks: { price: number; quantity: number }[];
  lastTradePrice: number | null;
  floorPrice: number | null;
  highestBid: number | null;
  spread: number | null;
  volume: number;
  premiumPercent: number | null;
}

interface OrderbookSocketSnapshot {
  eventId: string;
  ticketTypeId: string;
  bids: { price: number; quantity: number }[];
  asks: { price: number; quantity: number }[];
  lastTradePrice: number | null;
  floorPrice: number | null;
  volume: number;
  premiumPercent: number | null;
}

interface OrderbookUpdatePayload {
  eventId: string;
  ticketTypeId: string;
  reason: "order_created" | "order_cancelled" | "trade_settled";
  orderId?: string;
  tradeId?: string;
  snapshot: OrderbookSocketSnapshot;
  emittedAt: string;
}

type ConnectionState = "idle" | "connecting" | "live" | "offline";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export function OrderbookLivePanel({
  market,
}: {
  market: MarketSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(market);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [lastUpdate, setLastUpdate] = useState<OrderbookUpdatePayload | null>(
    null,
  );

  useEffect(() => {
    setSnapshot(market);
  }, [market]);

  useEffect(() => {
    if (!market) {
      setConnectionState("idle");
      return;
    }

    setConnectionState("connecting");
    const socket: Socket = io(`${API_BASE_URL}/orderbook`, {
      transports: ["websocket"],
      reconnectionAttempts: 4,
      timeout: 5000,
    });

    socket.on("connect", () => {
      socket.emit("orderbook.subscribe", {
        eventId: market.eventId,
        ticketTypeId: market.ticketTypeId,
      });
    });

    socket.on(
      "orderbook.snapshot",
      (payload: { snapshot?: OrderbookSocketSnapshot }) => {
        if (!payload.snapshot) {
          return;
        }
        setSnapshot((current) =>
          mergeSocketSnapshot(current ?? market, payload.snapshot!),
        );
        setConnectionState("live");
      },
    );

    socket.on("orderbook.updated", (payload: OrderbookUpdatePayload) => {
      if (
        payload.eventId !== market.eventId ||
        payload.ticketTypeId !== market.ticketTypeId
      ) {
        return;
      }
      setSnapshot((current) =>
        mergeSocketSnapshot(current ?? market, payload.snapshot),
      );
      setLastUpdate(payload);
      setConnectionState("live");
    });

    socket.on("disconnect", () => {
      setConnectionState("offline");
    });
    socket.on("connect_error", () => {
      setConnectionState("offline");
    });

    return () => {
      socket.emit("orderbook.unsubscribe", {
        eventId: market.eventId,
        ticketTypeId: market.ticketTypeId,
      });
      socket.close();
    };
  }, [market]);

  const liveMarket = snapshot;
  const statusLabel = useMemo(() => {
    switch (connectionState) {
      case "live":
        return "Live";
      case "connecting":
        return "Connecting";
      case "offline":
        return "Offline";
      case "idle":
        return "No feed";
    }
  }, [connectionState]);

  return (
    <>
      <div className="realtime-row">
        <span
          className={`badge ${
            connectionState === "live"
              ? "green"
              : connectionState === "offline"
                ? "orange"
                : "blue"
          }`}
        >
          {statusLabel}
        </span>
        <span className="muted">
          {lastUpdate
            ? `${formatReason(lastUpdate.reason)} at ${new Date(lastUpdate.emittedAt).toLocaleTimeString("en-HK")}`
            : "Waiting for market updates"}
        </span>
      </div>
      <MarketSummary market={liveMarket} />
      <OrderbookSide
        title="Asks"
        levels={liveMarket?.asks ?? []}
        tone="orange"
      />
      <OrderbookSide title="Bids" levels={liveMarket?.bids ?? []} tone="blue" />
    </>
  );
}

function mergeSocketSnapshot(
  current: MarketSnapshot,
  update: OrderbookSocketSnapshot,
): MarketSnapshot {
  const highestBid = update.bids[0]?.price ?? null;
  const floorPrice = update.floorPrice;
  return {
    ...current,
    bids: update.bids,
    asks: update.asks,
    lastTradePrice: update.lastTradePrice,
    floorPrice,
    highestBid,
    spread:
      floorPrice === null || highestBid === null
        ? null
        : floorPrice - highestBid,
    volume: update.volume,
    premiumPercent: update.premiumPercent,
  };
}

function MarketSummary({ market }: { market: MarketSnapshot | null }) {
  if (!market) {
    return <div className="empty-state">No Alpha market is available yet.</div>;
  }

  return (
    <div className="market-summary">
      <MiniMetric
        label="Last trade"
        value={
          market.lastTradePrice === null
            ? "No trade"
            : money(market.lastTradePrice)
        }
      />
      <MiniMetric label="Face value" value={money(market.faceValue)} />
      <MiniMetric
        label="Resale cap"
        value={market.resaleCap === null ? "None" : money(market.resaleCap)}
      />
      <MiniMetric
        label="Premium"
        value={
          market.premiumPercent === null
            ? "n/a"
            : `${market.premiumPercent.toFixed(1)}%`
        }
      />
      <MiniMetric
        label="Best bid"
        value={market.highestBid === null ? "No bid" : money(market.highestBid)}
      />
      <MiniMetric
        label="Spread"
        value={market.spread === null ? "n/a" : money(market.spread)}
      />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OrderbookSide({
  title,
  levels,
  tone,
}: {
  title: string;
  levels: { price: number; quantity: number }[];
  tone: "blue" | "orange";
}) {
  return (
    <div className="orderbook-side">
      <div className="section-title">
        <h2>{title}</h2>
        <span className={`badge ${tone}`}>{levels.length} levels</span>
      </div>
      <table className="table">
        <tbody>
          {levels.length === 0 ? (
            <tr>
              <td className="muted">No open orders</td>
            </tr>
          ) : (
            levels.map((level) => (
              <tr key={`${title}-${level.price}`}>
                <td>{money(level.price)}</td>
                <td>{level.quantity}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatReason(reason: OrderbookUpdatePayload["reason"]) {
  switch (reason) {
    case "order_created":
      return "Order created";
    case "order_cancelled":
      return "Order cancelled";
    case "trade_settled":
      return "Trade settled";
  }
}

function money(value: number) {
  return `HK$${value}`;
}
