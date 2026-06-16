export type UserRole = "FAN" | "ORGANIZER" | "GATE_STAFF" | "ADMIN";
export type TicketStatus =
  | "CREATED"
  | "ACTIVE"
  | "LISTED_FOR_RESALE"
  | "TRANSFER_PENDING"
  | "TRANSFERRED"
  | "REDEEMED"
  | "CANCELLED"
  | "REFUNDED"
  | "EXPIRED";
export type OrderSide = "BUY" | "SELL";
export type OrderStatus =
  | "OPEN"
  | "MATCHED"
  | "SETTLED"
  | "CANCELLED"
  | "REJECTED";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  privyId?: string | null;
  privyWalletId?: string | null;
  walletAddress: string | null;
  riskScore: number;
}

export interface VenueRecord {
  id: string;
  name: string;
  country: string;
  city: string;
  address: string;
  timezone: string;
  capacity: number;
}

export interface OrganizerRecord {
  id: string;
  userId: string;
  organizationName: string;
  verificationStatus: string;
  payoutAccountId: string | null;
}

export interface EventRecord {
  id: string;
  organizerId: string;
  title: string;
  venueId: string;
  startTime: string;
  endTime: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  posterUrl: string | null;
}

export interface TicketTypeRecord {
  id: string;
  eventId: string;
  name: string;
  faceValue: number;
  currency: string;
  supply: number;
  transferable: boolean;
  resaleCap: number | null;
  maxTransferCount: number;
}

export interface TicketRecord {
  id: string;
  tokenId: string | null;
  eventId: string;
  ticketTypeId: string;
  ownerId: string;
  seatHash: string | null;
  status: TicketStatus;
  transferCount: number;
  metadataUri: string | null;
}

export interface OrderRecord {
  id: string;
  userId: string;
  eventId: string;
  ticketTypeId: string;
  ticketId: string | null;
  side: OrderSide;
  price: number;
  quantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  idempotencyKey?: string | null;
  createdAt: string;
}

export interface TradeRecord {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  ticketId: string;
  price: number;
  fee: number;
  settlementStatus: "SETTLED" | "FAILED";
  createdAt: string;
}

export interface FanTaskRecord {
  id: string;
  eventId: string;
  title: string;
  taskType: "QUIZ" | "SHARE" | "CHECK_IN" | "PURCHASE_HISTORY" | "MANUAL";
  points: number;
  verificationMethod: "AUTO" | "MANUAL";
}

export interface FanTaskSubmissionRecord {
  id: string;
  userId: string;
  taskId: string;
  proof: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface GateAssignmentRecord {
  id: string;
  eventId: string;
  gate: string;
  staffUserId: string;
  active: boolean;
}

export interface CheckinRecord {
  id: string;
  ticketId: string;
  scannerUserId: string;
  gate: string;
  nonce: string;
  result:
    | "ACCEPTED"
    | "DUPLICATE"
    | "EXPIRED"
    | "INVALID_SIGNATURE"
    | "INVALID_TICKET"
    | "OWNER_MISMATCH"
    | "NOT_ACTIVE"
    | "CANCELLED"
    | "ERROR";
  checkedInAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
