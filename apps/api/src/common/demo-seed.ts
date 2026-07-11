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
  arenaEventId: "evt_aurora",
  finalsEventId: "evt_finals",
  theatreEventId: "evt_family",
  cat2TicketTypeId: "tt_cat2_demo",
  arenaGeneralTicketTypeId: "evt_aurora_ga",
  finalsLowerTicketTypeId: "evt_finals_premium",
  theatreBalconyTicketTypeId: "evt_family_ga",
  comedyPreviewTicketTypeId: "evt_comedy_preview",
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
  const publicCatalog = createPublicCatalogSeed();

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
      ...publicCatalog.venues,
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
      ...publicCatalog.events,
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
        resaleCap: resaleCap(1288),
        maxTransferCount: 2,
      },
      ...publicCatalog.ticketTypes,
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
      ...publicCatalog.fanTasks,
    ],
  };
}

function createPublicCatalogSeed(): Pick<DemoSeedData, "venues" | "events" | "ticketTypes" | "fanTasks"> {
  const venues: VenueRecord[] = [
    {
      id: "venue_harbor",
      name: "Harbor Dome",
      country: "HK",
      city: "Hong Kong",
      address: "Harbor Dome",
      timezone: "Asia/Hong_Kong",
      capacity: 50000,
    },
    {
      id: "venue_riverside",
      name: "Riverside Field",
      country: "SG",
      city: "Singapore",
      address: "Riverside Field",
      timezone: "Asia/Singapore",
      capacity: 38000,
    },
    {
      id: "venue_city",
      name: "City Arena",
      country: "UK",
      city: "London",
      address: "City Arena",
      timezone: "Europe/London",
      capacity: 22000,
    },
    {
      id: "venue_indie",
      name: "Warehouse 18",
      country: "DE",
      city: "Berlin",
      address: "Warehouse 18",
      timezone: "Europe/Berlin",
      capacity: 1800,
    },
    {
      id: "venue_lab",
      name: "Sound Lab Hall",
      country: "JP",
      city: "Tokyo",
      address: "Sound Lab Hall",
      timezone: "Asia/Tokyo",
      capacity: 2400,
    },
    {
      id: "venue_midnight",
      name: "Midnight Stadium",
      country: "US",
      city: "Los Angeles",
      address: "Midnight Stadium",
      timezone: "America/Los_Angeles",
      capacity: 64000,
    },
    {
      id: "venue_future",
      name: "Future Pier Hall",
      country: "NL",
      city: "Amsterdam",
      address: "Future Pier Hall",
      timezone: "Europe/Amsterdam",
      capacity: 6200,
    },
    {
      id: "venue_jazz",
      name: "Skyline Rooftop",
      country: "HK",
      city: "Hong Kong",
      address: "Skyline Rooftop",
      timezone: "Asia/Hong_Kong",
      capacity: 900,
    },
    {
      id: "venue_family",
      name: "Garden Theatre",
      country: "SG",
      city: "Singapore",
      address: "Garden Theatre",
      timezone: "Asia/Singapore",
      capacity: 1600,
    },
    {
      id: "venue_comedy",
      name: "Cellar Club",
      country: "UK",
      city: "London",
      address: "Cellar Club",
      timezone: "Europe/London",
      capacity: 420,
    },
  ];

  const eventSpecs = [
    publicEvent("evt_aurora", "Aurora Nights World Tour", "venue_harbor", "2026-10-12T20:00:00+08:00", 1280, "concerts", true, true, 35_000, 8_000),
    publicEvent("evt_neon", "Neon Harbor Festival", "venue_riverside", "2026-11-15T18:00:00+08:00", 860, "festivals", true, true, 128, 36),
    publicEvent("evt_finals", "City Finals 2026", "venue_city", "2026-12-18T19:00:00+08:00", 720, "sports", false, true, 0, 0),
    publicEvent("evt_indie", "Indie Pulse Live", "venue_indie", "2026-12-22T21:00:00+08:00", 420, "concerts", true, false, 360, 92),
    publicEvent("evt_lab", "Global Sound Lab", "venue_lab", "2027-01-10T20:00:00+08:00", 560, "theatre", false, true, 0, 0),
    publicEvent("evt_midnight", "Midnight Stadium Show", "venue_midnight", "2027-02-14T21:00:00+08:00", 1480, "concerts", true, true, 38, 8),
    publicEvent("evt_future", "Future Beats Conference", "venue_future", "2027-03-06T10:00:00+08:00", 640, "conference", true, true, 360, 92),
    publicEvent("evt_jazz", "Skyline Jazz Room", "venue_jazz", "2027-04-18T20:00:00+08:00", 520, "concerts", false, true, 360, 92),
    publicEvent("evt_family", "Family Matinee Spectacular", "venue_family", "2027-05-02T14:00:00+08:00", 5, "theatre", false, true, 1080, 260),
    publicEvent("evt_comedy", "Underground Comedy Night", "venue_comedy", "2027-05-21T21:00:00+08:00", 320, "theatre", false, true, 690, 170),
  ];

  return {
    venues,
    events: eventSpecs.map((event) => ({
      id: event.id,
      organizerId: demoSeedIds.organizerId,
      title: event.title,
      venueId: event.venueId,
      startTime: event.startTime,
      endTime: addHours(event.startTime, 3),
      status: "PUBLISHED",
      posterUrl: null,
    })),
    ticketTypes: eventSpecs.flatMap((event) => ticketTypesForEvent(event)),
    fanTasks: eventSpecs.flatMap((event) =>
      event.fanAccess
        ? [
            {
              id: `${event.id}_task_share`,
              eventId: event.id,
              title: "Follow event updates",
              taskType: "SHARE",
              points: 20,
              verificationMethod: "AUTO",
            },
            {
              id: `${event.id}_task_quiz`,
              eventId: event.id,
              title: "Complete event quiz",
              taskType: "QUIZ",
              points: 35,
              verificationMethod: "AUTO",
            },
          ]
        : [],
    ),
  };
}

interface PublicEventSpec {
  id: string;
  title: string;
  venueId: string;
  startTime: string;
  basePrice: number;
  category: "concerts" | "festivals" | "sports" | "theatre" | "conference";
  fanAccess: boolean;
  transferable: boolean;
  generalSupply: number;
  premiumSupply: number;
}

function publicEvent(
  id: string,
  title: string,
  venueId: string,
  startTime: string,
  basePrice: number,
  category: PublicEventSpec["category"],
  fanAccess: boolean,
  transferable: boolean,
  generalSupply: number,
  premiumSupply: number,
): PublicEventSpec {
  return {
    id,
    title,
    venueId,
    startTime,
    basePrice,
    category,
    fanAccess,
    transferable,
    generalSupply,
    premiumSupply,
  };
}

function ticketTypesForEvent(event: PublicEventSpec): TicketTypeRecord[] {
  const names = ticketTierNames(event.category);
  const prices = [
    event.basePrice,
    event.basePrice + 420,
    event.basePrice + 780,
  ];
  const supplies = [
    event.generalSupply,
    event.premiumSupply,
    event.generalSupply === 0 ? 0 : Math.max(2, Math.floor(event.premiumSupply / 4)),
  ];
  const ticketTypes = names.map((name, index) => ({
    id: [`${event.id}_ga`, `${event.id}_premium`, `${event.id}_vip`][index],
    eventId: event.id,
    name,
    faceValue: prices[index],
    currency: "HKD",
    supply: supplies[index],
    transferable: event.transferable,
    resaleCap:
      event.id === "evt_family" && index === 0
        ? null
        : resaleCap(prices[index]),
    maxTransferCount: event.transferable ? (index === 0 ? 2 : 1) : 0,
  }));
  if (event.id === "evt_comedy") {
    ticketTypes.unshift({
      id: demoSeedIds.comedyPreviewTicketTypeId,
      eventId: event.id,
      name: "Preview Pass",
      faceValue: 6,
      currency: "HKD",
      supply: 120,
      transferable: true,
      resaleCap: null,
      maxTransferCount: 2,
    });
  }
  return ticketTypes;
}

function ticketTierNames(category: PublicEventSpec["category"]) {
  switch (category) {
    case "concerts":
    case "festivals":
      return ["CAT 2", "Floor", "VIP"];
    case "sports":
      return ["Upper Bowl", "Lower Bowl", "Courtside"];
    case "theatre":
      return ["Balcony", "Orchestra", "Box"];
    case "conference":
      return ["Conference Pass", "Priority Pass", "Founder Pass"];
  }
}

function resaleCap(faceValue: number) {
  return Math.round(faceValue * 1.1);
}

function addHours(iso: string, hours: number) {
  const date = new Date(iso);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
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
        id: "ord_demo_ask_1417",
        userId: demoSeedIds.fanId,
        ticketId: demoSeedIds.listedTicketId,
        side: "SELL",
        price: resaleCap(1288),
      },
      {
        ...orderBase,
        id: "ord_demo_ask_1360",
        userId: demoSeedIds.fanId,
        ticketId: demoSeedIds.listedTicketId,
        side: "SELL",
        price: 1360,
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
