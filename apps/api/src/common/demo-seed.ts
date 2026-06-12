import {
  EventRecord,
  FanTaskRecord,
  GateAssignmentRecord,
  OrderRecord,
  OrganizerRecord,
  TicketRecord,
  TicketTypeRecord,
  TradeRecord,
  UserRecord,
  VenueRecord,
} from "./domain";

export const demoSeedIds = {
  organizerUserId: "usr_organizer_demo",
  organizerId: "org_demo",
  fanId: "usr_fan_demo",
  buyerId: "usr_buyer_demo",
  gateId: "usr_gate_demo",
  venueId: "ven_kaitak_demo",
  eventId: "evt_weekend_demo",
  arenaEventId: "evt_arena_demo",
  finalsEventId: "evt_finals_demo",
  theatreEventId: "evt_theatre_demo",
  cat2TicketTypeId: "tt_cat2_demo",
  arenaGeneralTicketTypeId: "tt_arena_general_demo",
  finalsLowerTicketTypeId: "tt_finals_lower_demo",
  theatreBalconyTicketTypeId: "tt_theatre_balcony_demo",
  ticketId: "tkt_demo_001",
  listedTicketId: "tkt_demo_002",
  settledTicketId: "tkt_demo_003",
  quizTaskId: "task_quiz_demo",
  shareTaskId: "task_share_demo",
} as const;

export interface DemoSeedData {
  users: UserRecord[];
  venues: VenueRecord[];
  organizers: OrganizerRecord[];
  events: EventRecord[];
  ticketTypes: TicketTypeRecord[];
  tickets: TicketRecord[];
  orders: OrderRecord[];
  trades: TradeRecord[];
  fanTasks: FanTaskRecord[];
  gateAssignments: GateAssignmentRecord[];
}

export function createDemoSeed(options: { includeMarketDepth?: boolean } = {}): DemoSeedData {
  const marketDepth = options.includeMarketDepth ? createDemoMarketDepth() : { orders: [], trades: [] };

  return {
    users: [
      {
        id: demoSeedIds.organizerUserId,
        name: "Demo Organizer",
        email: "organizer@fanpass.test",
        role: "ORGANIZER",
        privyId: "did:privy:organizer-demo",
        walletAddress: "0x0000000000000000000000000000000000001001",
        riskScore: 0,
      },
      {
        id: demoSeedIds.fanId,
        name: "Demo Fan",
        email: "fan@fanpass.test",
        role: "FAN",
        privyId: "did:privy:fan-demo",
        walletAddress: "0x0000000000000000000000000000000000002001",
        riskScore: 0,
      },
      {
        id: demoSeedIds.buyerId,
        name: "Demo Buyer",
        email: "buyer@fanpass.test",
        role: "FAN",
        privyId: "did:privy:buyer-demo",
        walletAddress: "0x0000000000000000000000000000000000002002",
        riskScore: 0,
      },
      {
        id: demoSeedIds.gateId,
        name: "Gate Staff",
        email: "gate@fanpass.test",
        role: "GATE_STAFF",
        privyId: "did:privy:gate-demo",
        walletAddress: null,
        riskScore: 0,
      },
    ],
    venues: [
      {
        id: demoSeedIds.venueId,
        name: "Kai Tak Stadium",
        country: "HK",
        city: "Hong Kong",
        address: "Kai Tak Sports Park",
        timezone: "Asia/Hong_Kong",
        capacity: 50000,
      },
    ],
    organizers: [
      {
        id: demoSeedIds.organizerId,
        userId: demoSeedIds.organizerUserId,
        organizationName: "FanPass Demo Presents",
        verificationStatus: "APPROVED",
        payoutAccountId: null,
      },
    ],
    events: [
      {
        id: demoSeedIds.eventId,
        organizerId: demoSeedIds.organizerId,
        title: "FanPass Demo Concert",
        venueId: demoSeedIds.venueId,
        startTime: "2026-10-30T20:00:00+08:00",
        endTime: "2026-10-30T23:00:00+08:00",
        status: "PUBLISHED",
        posterUrl: null,
      },
      {
        id: demoSeedIds.arenaEventId,
        organizerId: demoSeedIds.organizerId,
        title: "Aurora Nights World Tour",
        venueId: demoSeedIds.venueId,
        startTime: "2026-11-06T20:00:00+08:00",
        endTime: "2026-11-06T23:00:00+08:00",
        status: "PUBLISHED",
        posterUrl: null,
      },
      {
        id: demoSeedIds.finalsEventId,
        organizerId: demoSeedIds.organizerId,
        title: "Hong Kong City Finals",
        venueId: demoSeedIds.venueId,
        startTime: "2026-11-14T19:30:00+08:00",
        endTime: "2026-11-14T22:30:00+08:00",
        status: "PUBLISHED",
        posterUrl: null,
      },
      {
        id: demoSeedIds.theatreEventId,
        organizerId: demoSeedIds.organizerId,
        title: "Neon Theatre Weekend",
        venueId: demoSeedIds.venueId,
        startTime: "2026-11-21T19:00:00+08:00",
        endTime: "2026-11-21T21:45:00+08:00",
        status: "PUBLISHED",
        posterUrl: null,
      },
    ],
    ticketTypes: [
      {
        id: demoSeedIds.cat2TicketTypeId,
        eventId: demoSeedIds.eventId,
        name: "CAT 2",
        faceValue: 1288,
        currency: "HKD",
        supply: 100,
        transferable: true,
        resaleCap: 1545,
        maxTransferCount: 2,
      },
      {
        id: demoSeedIds.arenaGeneralTicketTypeId,
        eventId: demoSeedIds.arenaEventId,
        name: "General Admission",
        faceValue: 880,
        currency: "HKD",
        supply: 120,
        transferable: true,
        resaleCap: 1056,
        maxTransferCount: 2,
      },
      {
        id: demoSeedIds.finalsLowerTicketTypeId,
        eventId: demoSeedIds.finalsEventId,
        name: "Lower Bowl",
        faceValue: 680,
        currency: "HKD",
        supply: 80,
        transferable: true,
        resaleCap: 816,
        maxTransferCount: 1,
      },
      {
        id: demoSeedIds.theatreBalconyTicketTypeId,
        eventId: demoSeedIds.theatreEventId,
        name: "Balcony",
        faceValue: 420,
        currency: "HKD",
        supply: 60,
        transferable: false,
        resaleCap: 420,
        maxTransferCount: 0,
      },
    ],
    tickets: [
      {
        id: demoSeedIds.ticketId,
        tokenId: "1",
        eventId: demoSeedIds.eventId,
        ticketTypeId: demoSeedIds.cat2TicketTypeId,
        ownerId: demoSeedIds.fanId,
        seatHash: "section-118-row-h-seat-12",
        status: "ACTIVE",
        transferCount: 0,
        metadataUri: "ipfs://demo-ticket-metadata",
      },
      ...(options.includeMarketDepth
        ? [
            {
              id: demoSeedIds.listedTicketId,
              tokenId: "2",
              eventId: demoSeedIds.eventId,
              ticketTypeId: demoSeedIds.cat2TicketTypeId,
              ownerId: demoSeedIds.fanId,
              seatHash: "section-118-row-h-seat-13",
              status: "LISTED_FOR_RESALE" as const,
              transferCount: 0,
              metadataUri: "ipfs://demo-ticket-metadata-2",
            },
            {
              id: demoSeedIds.settledTicketId,
              tokenId: "3",
              eventId: demoSeedIds.eventId,
              ticketTypeId: demoSeedIds.cat2TicketTypeId,
              ownerId: demoSeedIds.buyerId,
              seatHash: "section-118-row-h-seat-14",
              status: "TRANSFERRED" as const,
              transferCount: 1,
              metadataUri: "ipfs://demo-ticket-metadata-3",
            },
          ]
        : []),
    ],
    orders: marketDepth.orders,
    trades: marketDepth.trades,
    gateAssignments: [
      {
        id: "ga_demo_a1",
        eventId: demoSeedIds.eventId,
        gate: "A1",
        staffUserId: demoSeedIds.gateId,
        active: true,
      },
    ],
    fanTasks: [
      {
        id: demoSeedIds.quizTaskId,
        eventId: demoSeedIds.eventId,
        title: "Complete artist quiz",
        taskType: "QUIZ",
        points: 20,
        verificationMethod: "AUTO",
      },
      {
        id: demoSeedIds.shareTaskId,
        eventId: demoSeedIds.eventId,
        title: "Share the event page",
        taskType: "SHARE",
        points: 10,
        verificationMethod: "AUTO",
      },
    ],
  };
}

function createDemoMarketDepth(): Pick<DemoSeedData, "orders" | "trades"> {
  const createdAt = "2026-06-07T11:00:00.000Z";
  const orderBase = {
    eventId: demoSeedIds.eventId,
    ticketTypeId: demoSeedIds.cat2TicketTypeId,
    quantity: 1,
    remainingQuantity: 1,
    status: "OPEN" as const,
    idempotencyKey: null,
    createdAt,
  };

  return {
    orders: [
      {
        ...orderBase,
        id: "ord_demo_ask_1545",
        userId: demoSeedIds.fanId,
        ticketId: demoSeedIds.listedTicketId,
        side: "SELL",
        price: 1545,
      },
      {
        ...orderBase,
        id: "ord_demo_ask_1490",
        userId: demoSeedIds.fanId,
        ticketId: demoSeedIds.listedTicketId,
        side: "SELL",
        price: 1490,
      },
      {
        ...orderBase,
        id: "ord_demo_bid_1320",
        userId: demoSeedIds.buyerId,
        ticketId: null,
        side: "BUY",
        price: 1320,
      },
      {
        ...orderBase,
        id: "ord_demo_bid_1288",
        userId: demoSeedIds.buyerId,
        ticketId: null,
        side: "BUY",
        price: 1288,
      },
    ],
    trades: [
      {
        id: "trd_demo_001",
        buyOrderId: "ord_demo_settled_buy",
        sellOrderId: "ord_demo_settled_sell",
        ticketId: demoSeedIds.settledTicketId,
        price: 1360,
        fee: 48,
        settlementStatus: "SETTLED",
        createdAt: "2026-06-07T10:30:00.000Z",
      },
    ],
  };
}
