export { fanPassBrand, type FanPassBrand } from "./brand.js";

export const ticketStatuses = [
  "CREATED",
  "MINTED",
  "ACTIVE",
  "LISTED_FOR_RESALE",
  "TRANSFERRED",
  "REDEEMED",
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
  "BURNED"
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export const userRoles = ["FAN", "ORGANIZER", "GATE_STAFF", "ADMIN"] as const;

export type UserRole = (typeof userRoles)[number];

export const orderSides = ["BUY", "SELL"] as const;

export type OrderSide = (typeof orderSides)[number];

export const orderStatuses = ["OPEN", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED"] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export interface EventSummary {
  id: string;
  title: string;
  venueName: string;
  city: string;
  startTime: string;
  posterUrl?: string | null;
}

export interface TicketTypeSummary {
  id: string;
  eventId: string;
  name: string;
  faceValue: number;
  currency: string;
  supply: number;
  transferable: boolean;
  resaleCap: number | null;
}

export interface TicketSummary {
  id: string;
  tokenId: string | null;
  eventId: string;
  ticketTypeId: string;
  ownerId: string;
  status: TicketStatus;
  transferCount: number;
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
  priceHistory: {
    price: number;
    tradedAt: string;
  }[];
}

export interface VerificationPayload {
  ticketId: string;
  eventId: string;
  ownerIdHash: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}
