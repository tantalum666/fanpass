import { Bell, CalendarDays, Heart, MapPin, Mic2, Settings, Sparkles, Tags, type LucideIcon } from "lucide-react";
import {
  formatDate,
  formatMoney,
  headlineFor,
  lowestPrice,
  sublineFor,
  uniqueRows,
} from "./viewHelpers";
import { orderPresentationFor } from "./orderPresentation";
import { ticketLifecycleCopy } from "./ticketLifecycle";
import type { AppView, MarketListing, UserOrder, UserTicket, WebEvent } from "../types";
import type { FeatureKind, FeatureRow } from "./featureDepthModel";

export interface FeatureConfig {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  copy: string;
  listLabel: string;
  spotlightLabel: string;
  actionLabel: string;
  actionValue: string;
  signal: string;
  systemLabel: string;
  primaryAction: string;
  secondaryAction: string;
  primaryView: AppView;
  secondaryView: AppView;
  checks: string[];
  flow: string[];
}

export interface FeatureCommandCard {
  label: string;
  value: string;
  detail: string;
}

export interface FeatureEvidenceRow {
  label: string;
  value: string;
  detail: string;
}

export function buildFeatureCommandCards(
  kind: FeatureKind,
  events: WebEvent[],
  tickets: UserTicket[],
  orders: UserOrder[],
  listings: MarketListing[],
  rows: FeatureRow[],
): FeatureCommandCard[] {
  const liveEvents = events.length;
  const liveTickets = tickets.length;
  const openListings = listings.length;
  const latestOrder = orders[0];
  const base = [
    {
      label: "Surface mode",
      value: modeValueFor(kind),
      detail: modeDetailFor(kind),
    },
    {
      label: "Live rows",
      value: `${rows.length}`,
      detail: "Rendered from current app state, not static marketing copy.",
    },
    {
      label: "Ticket context",
      value: `${liveTickets}`,
      detail: `${liveEvents} events and ${openListings} visible resale offers stay connected.`,
    },
    {
      label: "Safety boundary",
      value: latestOrder ? orderPresentationFor(latestOrder).proofState : "Safe UI",
      detail: "Readable state only; provider, holder, payment, and credential internals stay server-side.",
    },
  ];

  if (kind === "analytics") {
    return [
      base[0],
      { label: "Market depth", value: `${openListings}`, detail: "Open resale offers feed the terminal context." },
      { label: "Demand range", value: demandRangeFor(events), detail: "Demand is shown as a fan-readable signal." },
      base[3],
    ];
  }
  if (kind === "alerts") {
    return [
      base[0],
      { label: "Watch rules", value: "3", detail: "Price, waitlist, and transfer-window alerts stay scoped." },
      { label: "Linked tickets", value: `${liveTickets}`, detail: "Fan-owned context can drive alert relevance." },
      base[3],
    ];
  }
  if (kind === "settings") {
    return [
      base[0],
      { label: "Fixtures", value: "9", detail: "Non-happy states render through shared typed helpers." },
      { label: "Preferences", value: "3", detail: "Currency, privacy, and notifications remain safe defaults." },
      base[3],
    ];
  }

  return base;
}

export function buildFeatureEvidenceRows(
  kind: FeatureKind,
  lead: WebEvent | undefined,
  orders: UserOrder[],
  tickets: UserTicket[],
  listings: MarketListing[],
  rows: FeatureRow[],
): FeatureEvidenceRow[] {
  const latestOrder = orders[0];
  const orderPresentation = latestOrder ? orderPresentationFor(latestOrder) : null;
  const leadFloor = lead ? formatMoney(lowestPrice(lead), lead.ticketTypes[0]?.currency ?? "HKD") : "No event";
  const firstTicket = tickets[0] ? ticketLifecycleCopy(tickets[0].status) : null;

  const sharedRows = [
    {
      label: "Primary proof",
      value: lead ? headlineFor(lead) : "Waiting",
      detail: lead ? `${lead.city} / ${lead.status} / floor ${leadFloor}` : "No event loaded yet.",
    },
    {
      label: "Lifecycle read",
      value: firstTicket ? firstTicket.statusLabel : "No tickets",
      detail: firstTicket ? firstTicket.drawerDetail : "Ticket state renders only after wallet data is available.",
    },
    {
      label: "Order signal",
      value: orderPresentation?.proofState ?? "No orders",
      detail: orderPresentation?.summary ?? "Order rows remain empty until demo or API orders load.",
    },
  ];

  if (kind === "venues") {
    return [
      { label: "Venue scope", value: `${rows.length} venues`, detail: "Rows group shows by venue without creating a separate data owner." },
      sharedRows[0],
      { label: "Entry boundary", value: "QR-only web", detail: "Venue context stays separate from release-grade entry readiness." },
    ];
  }
  if (kind === "artists") {
    return [
      { label: "Artist demand", value: demandRangeFor(lead ? [lead] : []), detail: "Demand stays a discovery signal, not a speculative trading claim." },
      sharedRows[0],
      sharedRows[1],
    ];
  }
  if (kind === "collections") {
    return [
      { label: "Shelf logic", value: `${rows.length} shelves`, detail: "Editorial, cap-safe, and wallet-ready groupings stay explicit." },
      { label: "Offer scope", value: `${listings.length} listings`, detail: "Open resale offers remain routed through Market." },
      sharedRows[1],
    ];
  }
  if (kind === "analytics") {
    return [
      { label: "Terminal signal", value: demandRangeFor(lead ? [lead] : []), detail: "Market intelligence is display-safe and fan-readable." },
      { label: "Resale scope", value: `${listings.length} offers`, detail: "Depth context stays separate from provider/payment evidence." },
      sharedRows[2],
    ];
  }
  if (kind === "alerts") {
    return [
      { label: "Alert proof", value: "Scoped", detail: "Rules listen to visible market and wallet states only." },
      sharedRows[1],
      sharedRows[2],
    ];
  }
  if (kind === "settings") {
    return [
      { label: "State coverage", value: "9 fixtures", detail: "Blocked, failed, expired, refunded, and redeemed states stay visible for QA." },
      { label: "Identifier policy", value: "Masked", detail: "Visible refs remain safe fragments and readable status labels." },
      sharedRows[2],
    ];
  }

  return sharedRows;
}

export function buildFeatureRows(
  kind: FeatureKind,
  events: WebEvent[],
  tickets: UserTicket[],
  listings: MarketListing[],
): FeatureRow[] {
  const venueRows = uniqueRows(
    events.map((event) => ({
      key: event.venue,
      title: event.venue,
      meta: `${event.city} / ${event.address}`,
      value: `${events.filter((item) => item.venue === event.venue).length} show`,
    })),
  );
  const artistRows = uniqueRows(
    events.map((event) => ({
      key: event.artist,
      title: event.artist,
      meta: `${event.category} / ${event.city}`,
      value: `${event.demand}% demand`,
    })),
  );
  const collectionRows = [
    { key: "editorial", title: "Editorial picks", meta: "High-signal launches and top venues", value: `${events.length} events` },
    { key: "under-cap", title: "Under price cap", meta: "Resale offers below organizer ceiling", value: `${listings.length} listings` },
    { key: "wallet-ready", title: "Wallet ready", meta: "Tickets ready for transfer or sell", value: `${tickets.length} passes` },
  ];

  if (kind === "venues") {
    return venueRows;
  }
  if (kind === "artists") {
    return artistRows;
  }
  if (kind === "collections") {
    return collectionRows;
  }
  if (kind === "settings") {
    return [
      { key: "currency", title: "Currency and region", meta: "USD display / New York discovery", value: "Active" },
      { key: "privacy", title: "Ticket privacy", meta: "Safe fragments only in web UI", value: "Locked" },
      { key: "notifications", title: "Notification rules", meta: "Price, order, and transfer updates", value: "On" },
    ];
  }
  if (kind === "alerts") {
    return [
      { key: "floor", title: "Floor price watch", meta: "Notify when verified resale drops below target", value: "On" },
      { key: "waitlist", title: "Waitlist return", meta: "Returned primary inventory should surface first", value: "On" },
      { key: "transfer", title: "Transfer window", meta: "Warn before organizer transfer close", value: "On" },
    ];
  }

  return events.map((event) => ({
    key: event.id,
    title: headlineFor(event),
    meta: `${sublineFor(event)} / ${formatDate(event.startsAt)}`,
    value: formatMoney(lowestPrice(event), event.ticketTypes[0]?.currency ?? "HKD"),
  }));
}

export function featureConfig(kind: FeatureKind): FeatureConfig {
  const configs = {
    forYou: {
      icon: Sparkles,
      eyebrow: "Personal market",
      title: "For You",
      copy: "Preference-led recommendations, favorite signals, and fair-price paths in one dense surface.",
      listLabel: "Recommended signals",
      spotlightLabel: "Taste graph",
      actionLabel: "Best next action",
      actionValue: "Buy / track",
      signal: "Top match",
      systemLabel: "Personalization path",
      primaryAction: "Open recommendations",
      secondaryAction: "View market",
      primaryView: "events",
      secondaryView: "market",
      checks: ["Listening profile applied", "Price cap shown before checkout", "Resale path stays transparent"],
      flow: ["Read fan preference signals", "Prioritize safe primary inventory", "Show capped resale only when useful"],
    },
    events: {
      icon: CalendarDays,
      eyebrow: "Event index",
      title: "Events",
      copy: "A compact catalog for primary drops, waitlists, and controlled resale availability.",
      listLabel: "All events",
      spotlightLabel: "Editorial shelf",
      actionLabel: "Inventory",
      actionValue: "Live",
      signal: "Featured event",
      systemLabel: "Catalog model",
      primaryAction: "Browse catalog",
      secondaryAction: "Market depth",
      primaryView: "discover",
      secondaryView: "market",
      checks: ["Searchable event metadata", "Live ticket bands", "Market floor visible"],
      flow: ["Publish event and ticket bands", "Expose availability and policy", "Route resale into transparent market"],
    },
    venues: {
      icon: MapPin,
      eyebrow: "Venue graph",
      title: "Venues",
      copy: "Venue pages connect upcoming shows, entry requirements, city demand, and order readiness.",
      listLabel: "Venue rows",
      spotlightLabel: "City pulse",
      actionLabel: "Venue pulse",
      actionValue: "Mapped",
      signal: "Active venue",
      systemLabel: "Venue graph",
      primaryAction: "Explore venues",
      secondaryAction: "Open events",
      primaryView: "discover",
      secondaryView: "events",
      checks: ["City and address surfaced", "Shows grouped by venue", "Ticket state remains portable"],
      flow: ["Group shows by venue", "Retain city and gate context", "Keep fan-facing entry simple"],
    },
    artists: {
      icon: Mic2,
      eyebrow: "Artist layer",
      title: "Artists",
      copy: "Artist discovery uses demand, genre, and ticket liquidity instead of static promotional pages.",
      listLabel: "Artist rows",
      spotlightLabel: "Artist shelf",
      actionLabel: "Demand",
      actionValue: "Ranked",
      signal: "Trending artist",
      systemLabel: "Demand model",
      primaryAction: "Open artist shelf",
      secondaryAction: "View tickets",
      primaryView: "discover",
      secondaryView: "tickets",
      checks: ["Demand score exposed", "Event context retained", "Fan signal can drive recommendations"],
      flow: ["Map fans to artist demand", "Show active event context", "Avoid unsupported promotional claims"],
    },
    collections: {
      icon: Heart,
      eyebrow: "Curated shelves",
      title: "Collections",
      copy: "Editorial rails for trusted drops, cap-safe resale, and wallet-ready tickets.",
      listLabel: "Collections",
      spotlightLabel: "Curated cards",
      actionLabel: "Curation",
      actionValue: "Active",
      signal: "Lead shelf",
      systemLabel: "Shelf rules",
      primaryAction: "Open shelves",
      secondaryAction: "View wallet",
      primaryView: "discover",
      secondaryView: "wallet",
      checks: ["Editorial grouping", "Market grouping", "Wallet grouping"],
      flow: ["Group by buyer intent", "Keep pricing context visible", "Never hide organizer cap"],
    },
    wallet: {
      icon: Tags,
      eyebrow: "Pass custody",
      title: "Wallet",
      copy: "Ticket ownership, entry readiness, transfer status, and resale eligibility in one operational view.",
      listLabel: "Wallet-linked events",
      spotlightLabel: "Pass shelf",
      actionLabel: "Pass stack",
      actionValue: "Ready",
      signal: "Active pass",
      systemLabel: "Ticket lifecycle",
      primaryAction: "My tickets",
      secondaryAction: "Sell ticket",
      primaryView: "tickets",
      secondaryView: "market",
      checks: ["Active passes visible", "Listed passes separated", "Transfer and sell actions available"],
      flow: ["Load user-owned tickets", "Separate active and listed passes", "Disable unsafe lifecycle actions"],
    },
    orders: {
      icon: Tags,
      eyebrow: "Order operations",
      title: "Orders",
      copy: "Purchases, listings, and issue states stay readable after checkout.",
      listLabel: "Event context",
      spotlightLabel: "Recent context",
      actionLabel: "Recent orders",
      actionValue: "Synced",
      signal: "Recent order",
      systemLabel: "Order lifecycle",
      primaryAction: "Open tickets",
      secondaryAction: "Open market",
      primaryView: "tickets",
      secondaryView: "market",
      checks: ["Order status shown", "Buy and sell sides separated", "Totals remain auditable"],
      flow: ["Reserve order idempotently", "Authorize or list under policy", "Reconcile status into wallet"],
    },
    analytics: {
      icon: Tags,
      eyebrow: "Market intelligence",
      title: "Analytics",
      copy: "Demand, volume, caps, and sell-through signals for market operators and power fans.",
      listLabel: "Tracked events",
      spotlightLabel: "Market watchlist",
      actionLabel: "Signal",
      actionValue: "24h",
      signal: "Market leader",
      systemLabel: "Terminal model",
      primaryAction: "Open orderbook",
      secondaryAction: "Set alerts",
      primaryView: "market",
      secondaryView: "alerts",
      checks: ["Demand score visible", "24h market story", "Cap data present"],
      flow: ["Read API orderbook snapshot", "Compare bid and ask depth", "Surface cap-safe execution"],
    },
    alerts: {
      icon: Bell,
      eyebrow: "Alert center",
      title: "Alerts",
      copy: "Price drops, waitlist returns, transfer windows, and order-state changes without noisy marketing.",
      listLabel: "Alert candidates",
      spotlightLabel: "Signal feed",
      actionLabel: "Rules",
      actionValue: "On",
      signal: "Priority alert",
      systemLabel: "Notification routing",
      primaryAction: "Open alerts",
      secondaryAction: "View market",
      primaryView: "alerts",
      secondaryView: "market",
      checks: ["Price drop monitoring", "Waitlist return monitoring", "Transfer window monitoring"],
      flow: ["Watch safe public market data", "Filter to fan-owned interests", "Notify without exposing private IDs"],
    },
    settings: {
      icon: Settings,
      eyebrow: "Account controls",
      title: "Settings",
      copy: "Currency, location, notifications, and trust preferences for the web beta.",
      listLabel: "Preference scope",
      spotlightLabel: "Account snapshot",
      actionLabel: "Account",
      actionValue: "Configured",
      signal: "Current profile",
      systemLabel: "Security defaults",
      primaryAction: "Open tickets",
      secondaryAction: "Discover",
      primaryView: "tickets",
      secondaryView: "discover",
      checks: ["Currency preference", "Location preference", "Notification preference"],
      flow: ["Keep demo auth local only", "Mask ticket and wallet identifiers", "Prefer safe defaults over visual shortcuts"],
    },
  } satisfies Record<FeatureKind, FeatureConfig>;

  return configs[kind];
}

function modeValueFor(kind: FeatureKind) {
  const values: Record<FeatureKind, string> = {
    forYou: "Personal",
    events: "Catalog",
    venues: "Venue graph",
    artists: "Demand",
    collections: "Shelves",
    wallet: "Custody",
    orders: "Ledger",
    analytics: "Terminal",
    alerts: "Watchlist",
    settings: "Controls",
  };

  return values[kind];
}

function modeDetailFor(kind: FeatureKind) {
  const details: Record<FeatureKind, string> = {
    forYou: "Recommendation logic stays tied to verified inventory and cap-safe offers.",
    events: "Catalog rows connect primary drops, waitlists, and controlled resale.",
    venues: "Venue context keeps city, address, and event readiness together.",
    artists: "Artist pages rank demand while retaining active event context.",
    collections: "Curated shelves group buyer intent without hiding pricing rules.",
    wallet: "Ownership, entry readiness, and resale eligibility share one state model.",
    orders: "Buy, list, cancel, and settlement states render as a readable ledger.",
    analytics: "Market signals are dense, code-native, and bounded by organizer rules.",
    alerts: "Watch rules stay focused on price, waitlist, transfer, and order state.",
    settings: "Preferences and non-happy fixtures stay reviewable without provider internals.",
  };

  return details[kind];
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
