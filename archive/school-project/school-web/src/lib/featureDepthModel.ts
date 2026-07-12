import { formatMoney, formatShortDate, headlineFor, lowestPrice, uniqueRows } from "./viewHelpers";
import { orderPresentationFor } from "./orderPresentation";
import type { AppView, MarketListing, UserOrder, UserTicket, WebEvent } from "../types";

export type FeatureKind = Exclude<
  AppView,
  "discover" | "event" | "checkout" | "tickets" | "ticketDetail" | "listTicket" | "market"
>;
export type DepthFeatureKind = Extract<FeatureKind, "venues" | "artists" | "collections" | "alerts">;

export interface FeatureRow {
  key: string;
  title: string;
  meta: string;
  value: string;
}

export interface FeatureDepthCard {
  label: string;
  value: string;
  detail: string;
}

export interface FeatureDepthRow {
  key: string;
  label: string;
  title: string;
  meta: string;
  value: string;
  progress: number;
  event?: WebEvent;
}

export interface FeatureDepthModel {
  kind: DepthFeatureKind;
  label: string;
  title: string;
  summary: string;
  value: string;
  cards: FeatureDepthCard[];
  rows: FeatureDepthRow[];
}

export function buildFeatureDepthModel(
  kind: FeatureKind,
  events: WebEvent[],
  tickets: UserTicket[],
  orders: UserOrder[],
  listings: MarketListing[],
  rows: FeatureRow[],
): FeatureDepthModel | null {
  if (!isDepthFeature(kind)) {
    return null;
  }

  if (kind === "venues") {
    const cityCount = new Set(events.map((event) => event.city)).size;
    const venueRows = uniqueRows(
      events.map((event) => {
        const venueEvents = events.filter((item) => item.venue === event.venue);
        const nextEvent = venueEvents
          .slice()
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
        const averageDemand = Math.round(
          venueEvents.reduce((total, item) => total + item.demand, 0) / Math.max(venueEvents.length, 1),
        );

        return {
          key: event.venue,
          label: event.city,
          title: event.venue,
          meta: `${venueEvents.length} upcoming / next ${formatShortDate(nextEvent.startsAt)} / ${event.address}`,
          value: formatMoney(lowestPrice(nextEvent), nextEvent.ticketTypes[0]?.currency ?? "HKD"),
          progress: clampPercent(averageDemand),
          event: nextEvent,
        };
      }),
    ).slice(0, 4);

    return {
      kind,
      label: "Venue operating layer",
      title: "City demand, show readiness, and gate-safe entry stay in one venue context.",
      summary: "The web surface groups public event context by venue while keeping entry proof simple and native-only evidence separate.",
      value: `${cityCount} cities`,
      rows: venueRows,
      cards: [
        { label: "Venue rows", value: `${rows.length}`, detail: "Grouped from current event state." },
        { label: "Show readiness", value: `${events.length}`, detail: "Every venue row keeps a linked event path." },
        { label: "Web boundary", value: "QR review", detail: "Browser demo stays separate from native release gates." },
      ],
    };
  }

  if (kind === "artists") {
    const artistRows = uniqueRows(
      events
        .slice()
        .sort((a, b) => b.demand - a.demand)
        .map((event) => ({
          key: event.artist,
          label: event.category,
          title: event.artist,
          meta: `${headlineFor(event)} / ${event.city} / ${formatShortDate(event.startsAt)}`,
          value: `${event.demand}%`,
          progress: clampPercent(event.demand),
          event,
        })),
    ).slice(0, 4);
    const leader = artistRows[0];

    return {
      kind,
      label: "Artist demand ladder",
      title: "Demand is ranked by live event context, not promotional filler.",
      summary: "Artist pages should feel like ticketing intelligence: active shows, category, demand, and available price path remain visible.",
      value: leader ? leader.value : "No signal",
      rows: artistRows,
      cards: [
        { label: "Demand leader", value: leader?.title ?? "No artist", detail: leader ? leader.meta : "Waiting for events." },
        { label: "Demand band", value: demandRangeFor(events), detail: "Fan-readable demand range only." },
        { label: "Linked tickets", value: `${tickets.length}`, detail: "Wallet context can personalize the artist shelf." },
      ],
    };
  }

  if (kind === "collections") {
    const underCapCount = listings.filter((listing) => {
      const event = events.find((item) => item.id === listing.eventId);
      const ticketType = event?.ticketTypes.find((item) => item.id === listing.ticketTypeId);
      return ticketType ? listing.price <= ticketType.resaleCap : false;
    }).length;
    const walletReadyCount = tickets.filter((ticket) => ticket.status === "Active" || ticket.status === "Transferred").length;
    const collectionRows: FeatureDepthRow[] = [
      {
        key: "editorial-picks-depth",
        label: "Editorial",
        title: "Premium launch shelf",
        meta: "Lead events with clean availability and strong demand signal.",
        value: `${events.length} events`,
        progress: clampPercent(events.length * 18),
        event: events[0],
      },
      {
        key: "cap-safe-depth",
        label: "Market",
        title: "Under-cap resale shelf",
        meta: "Open resale offers that remain below organizer ceilings.",
        value: `${underCapCount} offers`,
        progress: clampPercent(underCapCount * 22),
        event: events.find((event) => listings.some((listing) => listing.eventId === event.id)),
      },
      {
        key: "wallet-ready-depth",
        label: "Wallet",
        title: "Ready-to-use tickets",
        meta: "Owned passes that can still show entry or start a safe listing flow.",
        value: `${walletReadyCount} passes`,
        progress: clampPercent(walletReadyCount * 28),
        event: events.find((event) => tickets.some((ticket) => ticket.eventId === event.id)),
      },
    ];

    return {
      kind,
      label: "Collection composition",
      title: "Shelves are structured by buyer intent and resale rules.",
      summary: "Collections should make the marketplace feel edited while preserving price caps, wallet status, and event context.",
      value: `${collectionRows.length} shelves`,
      rows: collectionRows,
      cards: [
        { label: "Editorial picks", value: `${events.length}`, detail: "Event-led shelves stay connected to ticket bands." },
        { label: "Under cap", value: `${underCapCount}`, detail: "Offer grouping keeps organizer limits visible." },
        { label: "Wallet ready", value: `${walletReadyCount}`, detail: "Owned tickets remain separated from public discovery." },
      ],
    };
  }

  const latestOrder = orders[0];
  const latestOrderCopy = latestOrder ? orderPresentationFor(latestOrder) : null;
  const activeTickets = tickets.filter((ticket) => ticket.status === "Active" || ticket.status === "Transferred").length;
  const waitlistCount = events.filter((event) => event.status === "Waitlist").length;
  const alertRows: FeatureDepthRow[] = [
    {
      key: "floor-alert-depth",
      label: "Price",
      title: "Floor price watch",
      meta: listings.length ? "Track verified resale movement before checkout." : "No open resale offers yet.",
      value: listings.length ? `${listings.length} offers` : "Quiet",
      progress: clampPercent(listings.length * 18 + 28),
      event: events[0],
    },
    {
      key: "waitlist-alert-depth",
      label: "Supply",
      title: "Waitlist return",
      meta: "Returned primary inventory should surface before noisy resale.",
      value: `${waitlistCount} waitlist`,
      progress: clampPercent(waitlistCount * 34 + 24),
      event: events.find((event) => event.status === "Waitlist") ?? events[0],
    },
    {
      key: "transfer-alert-depth",
      label: "Wallet",
      title: "Transfer window",
      meta: "Owned tickets can warn before organizer-defined resale or transfer windows close.",
      value: `${activeTickets} watched`,
      progress: clampPercent(activeTickets * 25 + 30),
      event: events.find((event) => tickets.some((ticket) => ticket.eventId === event.id)),
    },
    {
      key: "order-alert-depth",
      label: "Order",
      title: latestOrderCopy?.title ?? "Order state change",
      meta: latestOrderCopy?.summary ?? "Order alerts stay empty until a safe order reference exists.",
      value: latestOrderCopy?.proofState ?? "No order",
      progress: latestOrder ? 82 : 36,
      event: latestOrder ? events.find((event) => event.id === latestOrder.eventId) : undefined,
    },
  ];

  return {
    kind,
    label: "Alert rule stack",
    title: "Rules listen to visible market, wallet, and order states.",
    summary: "Alert pages should feel operational and calm: rule type, state source, and safe next context are all visible.",
    value: `${alertRows.length} rules`,
    rows: alertRows,
    cards: [
      { label: "Rules enabled", value: `${alertRows.length}`, detail: "Price, supply, wallet, and order state." },
      { label: "Tickets watched", value: `${activeTickets}`, detail: "Only safe lifecycle labels are shown." },
      { label: "Latest order", value: latestOrderCopy?.proofState ?? "None", detail: "Provider/payment internals remain hidden." },
    ],
  };
}

function isDepthFeature(kind: FeatureKind): kind is DepthFeatureKind {
  return kind === "venues" || kind === "artists" || kind === "collections" || kind === "alerts";
}

function demandRangeFor(events: WebEvent[]) {
  if (!events.length) {
    return "No signal";
  }
  const demandValues = events.map((event) => event.demand);
  const low = Math.min(...demandValues);
  const high = Math.max(...demandValues);
  return low === high ? `${high}%` : `${low}-${high}%`;
}

function clampPercent(value: number) {
  return Math.max(12, Math.min(100, Math.round(value)));
}
