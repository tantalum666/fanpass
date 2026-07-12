import { useCallback, useEffect, useState } from "react";
import { loadOrderbook } from "../services/fanpassApi";
import type { OrderbookSnapshot } from "../types";

export type OrderbookSource = "Live API" | "Demo depth";

export function useOrderbookSnapshot(eventId?: string, ticketTypeId?: string) {
  const [orderbook, setOrderbook] = useState<OrderbookSnapshot | null>(null);
  const [orderbookSource, setOrderbookSource] = useState<OrderbookSource>("Demo depth");

  useEffect(() => {
    let cancelled = false;

    if (!eventId || !ticketTypeId) {
      setOrderbook(null);
      setOrderbookSource("Demo depth");
      return () => {
        cancelled = true;
      };
    }

    void loadOrderbook(eventId, ticketTypeId).then((snapshot) => {
      if (cancelled) {
        return;
      }
      setOrderbook(snapshot);
      setOrderbookSource(snapshot ? "Live API" : "Demo depth");
    });

    return () => {
      cancelled = true;
    };
  }, [eventId, ticketTypeId]);

  const refreshOrderbook = useCallback(
    async (nextEventId = eventId, nextTicketTypeId = ticketTypeId) => {
      if (!nextEventId || !nextTicketTypeId) {
        setOrderbook(null);
        setOrderbookSource("Demo depth");
        return null;
      }

      const snapshot = await loadOrderbook(nextEventId, nextTicketTypeId);
      setOrderbook(snapshot);
      setOrderbookSource(snapshot ? "Live API" : "Demo depth");
      return snapshot;
    },
    [eventId, ticketTypeId],
  );

  return {
    orderbook,
    orderbookSource,
    refreshOrderbook,
  };
}
