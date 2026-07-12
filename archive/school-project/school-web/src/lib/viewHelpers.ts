import type { MarketListing, OrderbookSnapshot, UserOrder, UserTicket, WebEvent } from "../types";
import { ticketLifecycleRank } from "./ticketLifecycle";

export function buildShowcaseEvents(lead: WebEvent | undefined, events: WebEvent[]) {
  const source = lead ? [lead, ...events.filter((event) => event.id !== lead.id)] : events;
  const seen = new Set<string>();
  const uniqueEvents: WebEvent[] = [];

  for (const event of source) {
    const visualKey = usesPremiumConcertTreatment(event)
      ? `${headlineFor(event)}::${sublineFor(event)}`
      : event.id;
    if (seen.has(visualKey)) {
      continue;
    }
    seen.add(visualKey);
    uniqueEvents.push(event);
  }

  return uniqueEvents.slice(0, 4);
}

export function headlineFor(event: WebEvent) {
  if (usesPremiumConcertTreatment(event)) {
    return "LISA";
  }
  return event.title;
}

export function sublineFor(event: WebEvent) {
  if (usesPremiumConcertTreatment(event)) {
    return "Alter Ego World Tour / Madison Square Garden";
  }
  return `${event.artist} / ${event.venue}`;
}

export function heroImageFor(event: WebEvent) {
  if (usesPremiumConcertTreatment(event)) {
    return "/assets/fanpass-pop-hero.png";
  }
  return event.image;
}

export function usesPremiumConcertTreatment(event: WebEvent) {
  return event.id === "evt_hk_neon_weekender" || event.title.toLowerCase().includes("demo concert");
}

export function seatOptionsFor(event: WebEvent) {
  const base = lowestPrice(event);
  return [
    { name: "Floor A", detail: "Row 3 / 2 tickets", price: Math.round(base * 1.45), featured: false },
    { name: "Lower 100", detail: "Row 12 / 2 tickets", price: Math.round(base * 0.78), featured: false },
    { name: "Lower 200", detail: "Row 5 / 2 tickets", price: Math.round(base * 0.48), featured: true },
    { name: "Upper 100", detail: "Row 18 / 2 tickets", price: Math.round(base * 0.32), featured: false },
    { name: "Upper 300", detail: "Row 22 / 2 tickets", price: Math.round(base * 0.18), featured: false },
  ];
}

export function orderbookRows(snapshot?: OrderbookSnapshot | null) {
  const liveAsks = (snapshot?.asks ?? []).map((level) => ({
      price: level.price,
      qty: level.quantity,
      total: level.price * level.quantity,
      side: "ask" as const,
    }));
  const liveBids = (snapshot?.bids ?? []).map((level) => ({
      price: level.price,
      qty: level.quantity,
      total: level.price * level.quantity,
      side: "bid" as const,
    }));

  if (liveAsks.length > 0 || liveBids.length > 0) {
    const anchor =
      snapshot?.lastTradePrice ??
      snapshot?.floorPrice ??
      liveBids[0]?.price ??
      liveAsks[liveAsks.length - 1]?.price ??
      500;
    return [
      ...padDepthRows(liveAsks, "ask", anchor),
      ...padDepthRows(liveBids, "bid", anchor),
    ];
  }

  return [
    { price: 520, qty: 4, total: 2080, side: "ask" },
    { price: 510, qty: 6, total: 3060, side: "ask" },
    { price: 500, qty: 8, total: 4000, side: "ask" },
    { price: 495, qty: 7, total: 3465, side: "ask" },
    { price: 490, qty: 10, total: 4900, side: "ask" },
    { price: 470, qty: 12, total: 5640, side: "bid" },
    { price: 465, qty: 9, total: 4185, side: "bid" },
    { price: 460, qty: 15, total: 6900, side: "bid" },
    { price: 455, qty: 11, total: 5005, side: "bid" },
    { price: 450, qty: 14, total: 6300, side: "bid" },
  ];
}

function padDepthRows(
  rows: Array<{ price: number; qty: number; total: number; side: "ask" | "bid" }>,
  side: "ask" | "bid",
  anchor: number,
) {
  const sorted =
    side === "ask"
      ? [...rows].sort((a, b) => b.price - a.price)
      : [...rows].sort((a, b) => b.price - a.price);
  const padded = [...sorted];
  const step = Math.max(12, Math.round(anchor * 0.018));
  const existing = new Set(padded.map((row) => row.price));

  for (let index = 0; padded.length < 5; index += 1) {
    const price =
      side === "ask"
        ? Math.round(anchor + step * (5 - padded.length + index))
        : Math.max(1, Math.round(anchor - step * (padded.length + 1 + index)));
    if (existing.has(price)) {
      continue;
    }
    const qty = side === "ask" ? 3 + padded.length : 4 + padded.length;
    existing.add(price);
    padded.push({ price, qty, total: price * qty, side });
  }

  return [...padded].sort((a, b) => b.price - a.price).slice(0, 5);
}

export function ticketsForDrawer(event: WebEvent, tickets: UserTicket[]) {
  const visibleTickets = tickets
    .filter((ticket) => ticket.eventId === event.id)
    .sort((a, b) => ticketLifecycleRank(a.status) - ticketLifecycleRank(b.status))
    .slice(0, 2);
  const fallbackTickets = [
    {
      id: "drawer_1",
      eventId: event.id,
      ticketTypeId: event.ticketTypes[0]?.id ?? "ticket",
      code: "FP-208",
      holder: "Alex Chen",
      status: "Active",
      purchasedAt: event.startsAt,
      paid: lowestPrice(event),
    },
    {
      id: "drawer_2",
      eventId: event.id,
      ticketTypeId: event.ticketTypes[0]?.id ?? "ticket",
      code: "FP-137",
      holder: "Alex Chen",
      status: "Listed",
      purchasedAt: event.startsAt,
      paid: Math.round(lowestPrice(event) * 0.7),
    },
  ] satisfies UserTicket[];

  if (visibleTickets.length) {
    const fillTickets = fallbackTickets.filter(
      (fallback) => !visibleTickets.some((ticket) => ticket.status === fallback.status),
    );
    return visibleTickets.concat(fillTickets).slice(0, 2);
  }

  return fallbackTickets
    .sort((a, b) => ticketLifecycleRank(a.status) - ticketLifecycleRank(b.status))
    .slice(0, 2);
}

export function lowestPrice(event: WebEvent) {
  return Math.min(...event.ticketTypes.map((ticketType) => ticketType.price));
}

export function lowestListing(listings: MarketListing[]) {
  return listings.length ? Math.min(...listings.map((listing) => listing.price)) : null;
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatOptionalMoney(amount: number | null, currency: string) {
  return amount === null ? "None" : formatMoney(amount, currency);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
  }).format(new Date(value));
}

export function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(new Date(value));
}

export function demoOrders(events: WebEvent[]): UserOrder[] {
  const event = events[0];
  const ticketType = event?.ticketTypes[0];
  if (!event || !ticketType) {
    return [];
  }
  return [
    {
      id: "ord_demo_ready",
      eventId: event.id,
      ticketTypeId: ticketType.id,
      side: "Buy",
      status: "Confirmed",
      total: ticketType.price,
      createdAt: "2026-06-01T12:00:00+08:00",
    },
  ];
}

export function uniqueRows<T extends { key: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.key)) {
      return false;
    }
    seen.add(row.key);
    return true;
  });
}
