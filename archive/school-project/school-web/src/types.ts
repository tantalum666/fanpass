export type AppView =
  | "discover"
  | "forYou"
  | "events"
  | "venues"
  | "artists"
  | "collections"
  | "event"
  | "checkout"
  | "tickets"
  | "ticketDetail"
  | "listTicket"
  | "wallet"
  | "orders"
  | "market"
  | "analytics"
  | "alerts"
  | "settings";

export type EventCategory =
  | "Concert"
  | "Festival"
  | "Sports"
  | "Theatre"
  | "Club";

export interface TicketType {
  id: string;
  name: string;
  section: string;
  price: number;
  currency: string;
  remaining: number;
  resaleCap: number;
  perks: string[];
}

export interface WebEvent {
  id: string;
  title: string;
  artist: string;
  category: EventCategory;
  city: string;
  venue: string;
  address: string;
  startsAt: string;
  image: string;
  accent: string;
  status: "On sale" | "Selling fast" | "Waitlist" | "Resale open";
  summary: string;
  demand: number;
  ticketTypes: TicketType[];
  highlights: string[];
  policy: string[];
}

export interface MarketListing {
  id: string;
  eventId: string;
  ticketTypeId: string;
  ticketId?: string;
  seller: string;
  price: number;
  quantity: number;
  listedAt: string;
}

export interface UserTicket {
  id: string;
  eventId: string;
  ticketTypeId: string;
  code: string;
  holder: string;
  status:
    | "Active"
    | "Listed"
    | "Transfer Pending"
    | "Transferred"
    | "Redeemed"
    | "Cancelled"
    | "Refunded"
    | "Expired";
  purchasedAt: string;
  paid: number;
}

export interface EntryCredentialPreview {
  source: "Live API" | "Demo preview" | "Unavailable";
  credentialRef: string;
  issuedAt: string | null;
  expiresAt: string | null;
  seed: string;
  message: string;
}

export interface TicketProofHistoryItem {
  id: string;
  label: string;
  state: string;
  timestamp: string;
  description: string;
  safeTicketRef: string;
}

export interface UserOrder {
  id: string;
  eventId: string;
  ticketTypeId: string;
  ticketId?: string;
  side: "Buy" | "Sell";
  status:
    | "Reserved"
    | "Authorized"
    | "Confirmed"
    | "Listed"
    | "Cancelled"
    | "Failed"
    | "Expired"
    | "Refunded";
  total: number;
  createdAt: string;
}

export interface OrderbookLevel {
  price: number;
  quantity: number;
}

export interface OrderbookSnapshot {
  eventId: string;
  ticketTypeId: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  lastTradePrice: number | null;
  floorPrice: number | null;
  volume: number;
  premiumPercent: number | null;
}

export interface ApiStatus {
  label: "Live API" | "Demo data";
  detail: string;
}
