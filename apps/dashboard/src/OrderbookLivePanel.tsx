import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { formatMoney, titleCase } from "./console/format";
import type { MarketLevel, MarketSnapshot } from "./console/types";
import { Badge, EmptyState } from "./components/ConsoleUi";

interface OrderbookSocketSnapshot {
  eventId: string;
  ticketTypeId: string;
  bids: MarketLevel[];
  asks: MarketLevel[];
  lastTradePrice: number | null;
  floorPrice: number | null;
  volume: number;
  premiumPercent: number | null;
}

interface OrderbookUpdatePayload {
  eventId: string;
  ticketTypeId: string;
  reason:
    | "order_created"
    | "order_cancelled"
    | "order_rejected"
    | "trade_settled"
    | "primary_ticket_issued";
  snapshot: OrderbookSocketSnapshot;
  emittedAt: string;
}

type ConnectionState = "idle" | "connecting" | "live" | "offline";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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
    setLastUpdate(null);
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
        if (payload.snapshot) {
          setSnapshot((current) =>
            mergeSocketSnapshot(current ?? market, payload.snapshot!),
          );
          setConnectionState("live");
        }
      },
    );
    socket.on("orderbook.updated", (payload: OrderbookUpdatePayload) => {
      if (
        payload.eventId === market.eventId &&
        payload.ticketTypeId === market.ticketTypeId
      ) {
        setSnapshot((current) =>
          mergeSocketSnapshot(current ?? market, payload.snapshot),
        );
        setLastUpdate(payload);
        setConnectionState("live");
      }
    });
    socket.on("disconnect", () => setConnectionState("offline"));
    socket.on("connect_error", () => setConnectionState("offline"));

    return () => {
      socket.emit("orderbook.unsubscribe", {
        eventId: market.eventId,
        ticketTypeId: market.ticketTypeId,
      });
      socket.close();
    };
  }, [market]);

  const status = useMemo(() => {
    switch (connectionState) {
      case "live":
        return { label: "Live", tone: "success" as const };
      case "connecting":
        return { label: "Connecting", tone: "info" as const };
      case "offline":
        return { label: "Offline", tone: "warning" as const };
      case "idle":
        return { label: "No feed", tone: "neutral" as const };
    }
  }, [connectionState]);

  if (!snapshot) {
    return (
      <EmptyState
        title="No orderbook"
        description="This ticket type has no resale market."
      />
    );
  }

  return (
    <div className="orderbook-panel">
      <div className="live-status-row">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span>
          {lastUpdate
            ? `${titleCase(lastUpdate.reason)} · ${new Date(lastUpdate.emittedAt).toLocaleTimeString("en-HK")}`
            : "Waiting for market updates"}
        </span>
      </div>
      <div className="orderbook-topline">
        <div>
          <span>Last trade</span>
          <strong>
            {snapshot.lastTradePrice === null
              ? "—"
              : formatMoney(snapshot.lastTradePrice, snapshot.currency)}
          </strong>
        </div>
        <div>
          <span>Spread</span>
          <strong>
            {snapshot.spread === null
              ? "—"
              : formatMoney(snapshot.spread, snapshot.currency)}
          </strong>
        </div>
        <div>
          <span>Premium</span>
          <strong>
            {snapshot.premiumPercent === null
              ? "—"
              : `${snapshot.premiumPercent.toFixed(1)}%`}
          </strong>
        </div>
      </div>
      <div className="orderbook-columns">
        <OrderbookSide
          currency={snapshot.currency}
          levels={snapshot.bids}
          side="Bids"
        />
        <OrderbookSide
          currency={snapshot.currency}
          levels={snapshot.asks}
          side="Asks"
        />
      </div>
    </div>
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

function OrderbookSide({
  side,
  levels,
  currency,
}: {
  side: "Bids" | "Asks";
  levels: MarketLevel[];
  currency: string;
}) {
  return (
    <div className="orderbook-side">
      <header>
        <strong>{side}</strong>
        <span>{levels.length} levels</span>
      </header>
      <div className="orderbook-heading">
        <span>Price</span>
        <span>Qty</span>
      </div>
      {levels.length === 0 ? (
        <p className="orderbook-empty">No open {side.toLowerCase()}</p>
      ) : (
        levels.slice(0, 6).map((level) => (
          <div
            className={`orderbook-level orderbook-level--${side.toLowerCase()}`}
            key={`${side}-${level.price}`}
          >
            <strong>{formatMoney(level.price, currency)}</strong>
            <span>{level.quantity}</span>
          </div>
        ))
      )}
    </div>
  );
}
