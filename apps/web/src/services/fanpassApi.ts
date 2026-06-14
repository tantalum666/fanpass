import { webEvents } from "../data/fanpassWebData";
import type {
  ApiStatus,
  EntryCredentialPreview,
  OrderbookSnapshot,
  TicketProofHistoryItem,
  TicketType,
  UserOrder,
  UserTicket,
  WebEvent,
} from "../types";

interface BackendVenue {
  name?: string;
  city?: string;
  address?: string;
}

interface BackendTicketType {
  id: string;
  name: string;
  faceValue: number;
  currency: string;
  supply: number;
  transferable: boolean;
  resaleCap?: number | null;
}

interface BackendEvent {
  id: string;
  title: string;
  startTime: string;
  posterUrl?: string | null;
  venue?: BackendVenue | null;
  ticketTypes?: BackendTicketType[];
}

interface DemoSession {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  accessToken: string;
  expiresAt: string;
}

interface BackendOrder {
  id: string;
  eventId: string;
  ticketTypeId: string;
  ticketId?: string | null;
  side: "BUY" | "SELL";
  price: number;
  status: string;
  createdAt: string;
}

interface BackendTrade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  ticketId: string;
  price: number;
  fee?: number;
  settlementStatus?: string;
  createdAt?: string;
}

interface BackendTicket {
  id: string;
  eventId: string;
  ticketTypeId: string;
  ownerId: string;
  status: string;
  tokenId?: string | null;
}

interface BackendQrPayload {
  credentialId?: string;
  ticketId: string;
  eventId: string;
  ticketTypeId?: string;
  issuedAt: string;
  expiresAt: string;
  ownerIdHash?: string;
  nonce?: string;
  signature?: string;
}

interface BackendProofHistoryResponse {
  items: TicketProofHistoryItem[];
}

interface CreateOrderResponse {
  order: BackendOrder;
  trade: BackendTrade | null;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const demoBuyerId = "usr_buyer_demo";
let cachedDemoSession: DemoSession | null = null;

export async function loadEvents(): Promise<{
  events: WebEvent[];
  status: ApiStatus;
}> {
  if (!apiBaseUrl) {
    return {
      events: webEvents,
      status: {
        label: "Demo data",
        detail: "Set VITE_API_BASE_URL to connect FanPass Web to a local API.",
      },
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/events`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const backendEvents = (await response.json()) as BackendEvent[];
    if (!Array.isArray(backendEvents) || backendEvents.length === 0) {
      throw new Error("API returned no events");
    }

    return {
      events: mergeBackendEvents(backendEvents),
      status: {
        label: "Live API",
        detail: `Synced ${backendEvents.length} event${backendEvents.length === 1 ? "" : "s"} from ${apiBaseUrl}`,
      },
    };
  } catch {
    return {
      events: webEvents,
      status: {
        label: "Demo data",
        detail: "Using complete Web MVP data while the API is offline or sparsely seeded.",
      },
    };
  }
}

export async function loadOrderbook(
  eventId: string,
  ticketTypeId: string,
): Promise<OrderbookSnapshot | null> {
  if (!apiBaseUrl || !eventId || !ticketTypeId) {
    return null;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/orders/events/${encodeURIComponent(eventId)}/ticket-types/${encodeURIComponent(ticketTypeId)}/book`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const snapshot = (await response.json()) as OrderbookSnapshot;
    if (!Array.isArray(snapshot.bids) || !Array.isArray(snapshot.asks)) {
      throw new Error("API returned an invalid orderbook");
    }

    return snapshot;
  } catch {
    return null;
  }
}

export async function createDemoBuyOrder(input: {
  eventId: string;
  ticketTypeId: string;
  price: number;
}): Promise<CreateOrderResponse | null> {
  if (!apiBaseUrl) {
    return null;
  }

  try {
    const session = await getDemoSession();
    const response = await fetch(`${apiBaseUrl}/orders`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
        "Idempotency-Key": `web-buy-${input.eventId}-${input.ticketTypeId}-${input.price}-${Date.now()}`,
      },
      body: JSON.stringify({
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
        side: "BUY",
        price: Math.round(input.price),
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return (await response.json()) as CreateOrderResponse;
  } catch {
    return null;
  }
}

export async function createDemoSellOrder(input: {
  ticket: UserTicket;
  price: number;
}): Promise<CreateOrderResponse | null> {
  if (!apiBaseUrl || !isBackendTicketId(input.ticket.id)) {
    return null;
  }

  try {
    const session = await getDemoSession();
    const roundedPrice = Math.round(input.price);
    const response = await fetch(`${apiBaseUrl}/orders`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
        "Idempotency-Key": `web-sell-${input.ticket.id}-${roundedPrice}`,
      },
      body: JSON.stringify({
        eventId: input.ticket.eventId,
        ticketTypeId: input.ticket.ticketTypeId,
        ticketId: input.ticket.id,
        side: "SELL",
        price: roundedPrice,
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return (await response.json()) as CreateOrderResponse;
  } catch {
    return null;
  }
}

export async function cancelDemoOrder(orderId: string): Promise<BackendOrder | null> {
  if (!apiBaseUrl || !isBackendOrderId(orderId)) {
    return null;
  }

  try {
    const session = await getDemoSession();
    const response = await fetch(`${apiBaseUrl}/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return (await response.json()) as BackendOrder;
  } catch {
    return null;
  }
}

export async function loadDemoTickets(events: WebEvent[]): Promise<UserTicket[] | null> {
  if (!apiBaseUrl) {
    return null;
  }

  try {
    const session = await getDemoSession();
    const response = await fetch(`${apiBaseUrl}/tickets/owner/${encodeURIComponent(demoBuyerId)}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const tickets = (await response.json()) as BackendTicket[];
    if (!Array.isArray(tickets)) {
      throw new Error("API returned invalid tickets");
    }

    return tickets.map((ticket) => mapBackendTicket(ticket, events));
  } catch {
    return null;
  }
}

export async function loadDemoOrders(): Promise<UserOrder[] | null> {
  if (!apiBaseUrl) {
    return null;
  }

  try {
    const session = await getDemoSession();
    const response = await fetch(`${apiBaseUrl}/orders/users/${encodeURIComponent(demoBuyerId)}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const orders = (await response.json()) as BackendOrder[];
    if (!Array.isArray(orders)) {
      throw new Error("API returned invalid orders");
    }

    return orders.map(mapBackendOrder);
  } catch {
    return null;
  }
}

export async function refreshTicketEntryCredential(
  ticket: UserTicket,
): Promise<EntryCredentialPreview | null> {
  if (!apiBaseUrl || !isBackendTicketId(ticket.id)) {
    return null;
  }

  try {
    const session = await getDemoSession();
    const response = await fetch(
      `${apiBaseUrl}/verification/tickets/${encodeURIComponent(ticket.id)}/qr`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const payload = (await response.json()) as BackendQrPayload;
    if (!payload.credentialId || !payload.issuedAt || !payload.expiresAt) {
      throw new Error("API returned invalid entry credential");
    }

    return {
      source: "Live API",
      credentialRef: safeFragment(payload.credentialId),
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      seed: safeSeed([
        payload.credentialId,
        payload.ticketId,
        payload.eventId,
        payload.ticketTypeId ?? "",
        payload.expiresAt,
      ]),
      message:
        "Backend issued this short-lived credential. Raw credential internals are not exposed in the web UI.",
    };
  } catch {
    return null;
  }
}

export async function loadTicketProofHistory(
  ticketId: string,
): Promise<TicketProofHistoryItem[] | null> {
  if (!apiBaseUrl || !isBackendTicketId(ticketId)) {
    return null;
  }

  try {
    const session = await getDemoSession();
    const response = await fetch(
      `${apiBaseUrl}/tickets/${encodeURIComponent(ticketId)}/proof-history`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const result = (await response.json()) as BackendProofHistoryResponse;
    if (!Array.isArray(result.items)) {
      throw new Error("API returned invalid proof history");
    }

    return result.items.map((item) => ({
      id: item.id,
      label: item.label,
      state: item.state,
      timestamp: item.timestamp,
      description: item.description,
      safeTicketRef: item.safeTicketRef,
    }));
  } catch {
    return null;
  }
}

async function getDemoSession() {
  if (cachedDemoSession && new Date(cachedDemoSession.expiresAt).getTime() > Date.now() + 30_000) {
    return cachedDemoSession;
  }

  const response = await fetch(`${apiBaseUrl}/auth/demo-session`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: demoBuyerId }),
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  cachedDemoSession = (await response.json()) as DemoSession;
  return cachedDemoSession;
}

function isBackendTicketId(ticketId: string) {
  return /^tkt_[A-Za-z0-9_-]+$/.test(ticketId);
}

function isBackendOrderId(orderId: string) {
  return /^ord_[A-Za-z0-9_-]+$/.test(orderId);
}

function safeFragment(value: string) {
  const compact = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `FP-${compact.slice(-6).padStart(6, "0")}`;
}

function safeSeed(parts: string[]) {
  let seed = 2166136261;
  for (const part of parts) {
    for (const char of part) {
      seed ^= char.charCodeAt(0);
      seed = Math.imul(seed, 16777619);
    }
  }
  return `safe-${(seed >>> 0).toString(36).padStart(7, "0")}`;
}

function mergeBackendEvents(backendEvents: BackendEvent[]) {
  const demosById = new Map(webEvents.map((event) => [event.id, event]));
  const mappedBackend = backendEvents.map((event, index) =>
    mapBackendEvent(event, webEvents[index % webEvents.length]),
  );
  const backendIds = new Set(mappedBackend.map((event) => event.id));
  const richerDemos = webEvents.filter((event) => !backendIds.has(event.id));
  const demoSeed = mappedBackend.find((event) => demosById.has(event.id));

  if (mappedBackend.length < 3 && demoSeed) {
    return [...mappedBackend, ...richerDemos].slice(0, 4);
  }

  return [...mappedBackend, ...richerDemos].slice(0, 6);
}

function mapBackendEvent(event: BackendEvent, fallback: WebEvent): WebEvent {
  const venue = event.venue ?? {};
  const ticketTypes =
    event.ticketTypes?.length ? event.ticketTypes.map(mapBackendTicketType) : fallback.ticketTypes;

  return {
    ...fallback,
    id: event.id,
    title: event.title || fallback.title,
    artist: event.title.includes("Demo") ? "FanPass Presents" : fallback.artist,
    city: venue.city ?? fallback.city,
    venue: venue.name ?? fallback.venue,
    address: venue.address ?? fallback.address,
    startsAt: event.startTime,
    image: event.posterUrl ?? fallback.image,
    status: ticketTypes.some((ticket) => ticket.remaining === 0)
      ? "Waitlist"
      : fallback.status,
    ticketTypes,
  };
}

function mapBackendTicketType(ticketType: BackendTicketType): TicketType {
  return {
    id: ticketType.id,
    name: ticketType.name,
    section: ticketType.name,
    price: ticketType.faceValue,
    currency: ticketType.currency,
    remaining: ticketType.supply,
    resaleCap: ticketType.resaleCap ?? Math.round(ticketType.faceValue * 1.2),
    perks: [
      ticketType.transferable ? "Transfer enabled" : "Transfer restricted",
      "Backed by FanPass order history",
    ],
  };
}

function mapBackendTicket(ticket: BackendTicket, events: WebEvent[]): UserTicket {
  const event = events.find((candidate) => candidate.id === ticket.eventId);
  const ticketType = event?.ticketTypes.find((candidate) => candidate.id === ticket.ticketTypeId);
  const token = ticket.tokenId ?? ticket.id.slice(-4);

  return {
    id: ticket.id,
    eventId: ticket.eventId,
    ticketTypeId: ticket.ticketTypeId,
    code: `FP-${String(token).toUpperCase()}`,
    holder: "Demo Fan",
    status: mapBackendTicketStatus(ticket.status),
    purchasedAt: event?.startsAt ?? new Date().toISOString(),
    paid: ticketType?.price ?? 0,
  };
}

function mapBackendTicketStatus(status: string): UserTicket["status"] {
  switch (status) {
    case "CREATED":
    case "ACTIVE":
      return "Active";
    case "LISTED_FOR_RESALE":
      return "Listed";
    case "TRANSFER_PENDING":
      return "Transfer Pending";
    case "TRANSFERRED":
      return "Transferred";
    case "REDEEMED":
      return "Redeemed";
    case "CANCELLED":
      return "Cancelled";
    case "REFUNDED":
      return "Refunded";
    case "EXPIRED":
      return "Expired";
    default:
      return "Active";
  }
}

function mapBackendOrder(order: BackendOrder): UserOrder {
  return {
    id: order.id,
    eventId: order.eventId,
    ticketTypeId: order.ticketTypeId,
    ticketId: order.ticketId ?? undefined,
    side: order.side === "SELL" ? "Sell" : "Buy",
    status: mapBackendOrderStatus(order.status, order.side),
    total: order.price,
    createdAt: order.createdAt,
  };
}

function mapBackendOrderStatus(status: string, side: BackendOrder["side"]): UserOrder["status"] {
  if (status === "SETTLED" || status === "MATCHED") {
    return "Confirmed";
  }

  if (side === "SELL" && status === "OPEN") {
    return "Listed";
  }

  if (status === "CANCELLED" || status === "REJECTED") {
    return "Cancelled";
  }

  if (status === "FAILED" || status === "PAYMENT_FAILED") {
    return "Failed";
  }

  if (status === "EXPIRED") {
    return "Expired";
  }

  if (status === "REFUNDED") {
    return "Refunded";
  }

  if (status === "AUTHORIZED" || status === "PAYMENT_AUTHORIZED") {
    return "Authorized";
  }

  return "Reserved";
}
