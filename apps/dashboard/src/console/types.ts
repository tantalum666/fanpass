export type ViewerRole = "FAN" | "ORGANIZER" | "GATE_STAFF" | "ADMIN";

export type ConsolePageKey =
  | "overview"
  | "events"
  | "sales"
  | "entry"
  | "team"
  | "risk";

export interface TicketType {
  id: string;
  name: string;
  faceValue: number;
  currency: string;
  supply: number;
  transferable: boolean;
  resaleCap: number | null;
  maxTransferCount: number;
}

export interface AlphaEvent {
  id: string;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  venue?: {
    id?: string;
    name: string;
    city: string;
    capacity?: number;
  };
  ticketTypes: TicketType[];
}

export interface MarketSnapshot {
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  currency: string;
  faceValue: number;
  resaleCap: number | null;
  bids: MarketLevel[];
  asks: MarketLevel[];
  lastTradePrice: number | null;
  floorPrice: number | null;
  highestBid: number | null;
  spread: number | null;
  volume: number;
  premiumPercent: number | null;
  priceHistory: PriceHistoryPoint[];
}

export interface MarketLevel {
  price: number;
  quantity: number;
}

export interface PriceHistoryPoint {
  tradeId: string;
  price: number;
  fee: number;
  premiumPercent: number;
  createdAt: string;
}

export interface TicketRecord {
  id: string;
  tokenId: string | null;
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  transferable: boolean;
  ownerId: string;
  ownerEmail: string | null;
  status: string;
  transferCount: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  eventId: string;
  ticketTypeId: string;
  ticketId: string | null;
  side: "BUY" | "SELL";
  price: number;
  remainingQuantity: number;
  status: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  orderId: string | null;
  eventId: string | null;
  amount: number;
  currency: string;
  status: string;
  captureStatus: string;
  stripePaymentIntentId: string | null;
  clientSecret: null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeRecord {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  ticketId: string;
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  price: number;
  fee: number;
  settlementStatus: string;
  createdAt: string;
}

export interface SideEffectRecord {
  id: string;
  type: string;
  status: string;
  aggregateType: string;
  aggregateId: string;
  attempts: number;
  lastError: string | null;
  payload: unknown | null;
  createdAt: string;
  completedAt: string | null;
}

export interface GateAssignment {
  id: string;
  eventId: string;
  eventTitle: string;
  gate: string;
  active: boolean;
  linked: boolean;
  staffUserId: string;
  staffName: string;
  staffEmail: string | null;
  invite: {
    id: string;
    status: string;
    expiresAt: string;
    acceptedAt: string | null;
  } | null;
  createdAt: string;
}

export interface CheckinRecord {
  id: string;
  eventId: string;
  eventTitle: string;
  ticketId: string;
  scannerEmail: string | null;
  scannerUserId: string;
  gate: string;
  nonce: string | null;
  result: string;
  checkedInAt: string;
}

export interface FanTaskSubmission {
  id: string;
  eventId: string;
  eventTitle: string;
  userId: string;
  taskId: string;
  taskTitle: string;
  proof: string;
  status: string;
}

export interface FanCampaignTask {
  id: string;
  title: string;
  description: string;
  taskType:
    | "FOLLOW"
    | "TICKET_HOLD"
    | "CHECK_IN"
    | "PURCHASE_HISTORY"
    | "QUIZ"
    | "SHARE"
    | "MANUAL";
  points: number;
  verificationMethod: "AUTO" | "MANUAL";
  verificationLabel: string;
  actionKind: string;
  optional: boolean;
  sortOrder: number;
}

export interface FanCampaign {
  id: string;
  eventId: string;
  eventTitle: string;
  title: string;
  description: string;
  rewardTitle: string;
  rewardDescription: string;
  rewardSupply: number;
  qualificationPoints: number;
  allocationMethod: "EQUAL_DRAW" | "GUARANTEED";
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ALLOCATED" | "ARCHIVED";
  startsAt: string;
  closesAt: string;
  entitlementCount: number;
  tasks: FanCampaignTask[];
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown | null;
  createdAt: string;
}

export interface AlphaOperations {
  ok: boolean;
  dataSource: string;
  privacy: {
    viewerRole: ViewerRole;
    piiVisible: boolean;
    piiRedacted: boolean;
  };
  events: AlphaEvent[];
  market: MarketSnapshot | null;
  tickets: TicketRecord[];
  orders: OrderRecord[];
  payments: PaymentRecord[];
  trades: TradeRecord[];
  sideEffects: SideEffectRecord[];
  gateAssignments: GateAssignment[];
  checkins: CheckinRecord[];
  fanCampaigns: FanCampaign[];
  fanTaskSubmissions: FanTaskSubmission[];
  auditLogs: AuditLogRecord[];
}

export interface EventOperationsView {
  event: AlphaEvent;
  tickets: TicketRecord[];
  orders: OrderRecord[];
  payments: PaymentRecord[];
  trades: TradeRecord[];
  gateAssignments: GateAssignment[];
  checkins: CheckinRecord[];
  fanCampaigns: FanCampaign[];
  fanTaskSubmissions: FanTaskSubmission[];
}

export interface GateAssignmentResponse {
  id: string;
  eventTitle: string;
  gate: string;
  staffName: string;
  inviteToken?: string;
  invite?: {
    status: string;
    expiresAt: string;
  } | null;
}
