import {
  EventRecord,
  FanTaskRecord,
  GateAssignmentRecord,
  OrganizerRecord,
  TicketRecord,
  TicketTypeRecord,
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
  cat2TicketTypeId: "tt_cat2_demo",
  ticketId: "tkt_demo_001",
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
  fanTasks: FanTaskRecord[];
  gateAssignments: GateAssignmentRecord[];
}

export function createDemoSeed(): DemoSeedData {
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
    ],
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
