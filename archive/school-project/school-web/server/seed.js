import { createHash, randomUUID } from "node:crypto";

export function hashPassword(password, salt = randomUUID()) {
  const hash = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored ?? "").split(":");
  if (!salt || !hash) {
    return false;
  }
  return hashPassword(password, salt) === stored;
}

export function nowIso() {
  return new Date().toISOString();
}

export function seedData() {
  const createdAt = nowIso();
  const seats = {
    lisa: seatPlan("lisa", [
      ["Floor A", "A", 1250, "VIP", "standard", 6],
      ["Floor B", "B", 1180, "Floor", "resale", 6],
      ["Lower 108", "12", 980, "Lower", "standard", 8],
      ["Balcony 204", "8", 620, "Balcony", "standard", 8],
    ]),
    weeknd: seatPlan("weeknd", [
      ["Floor", "B", 870, "Floor", "resale", 8],
      ["Lower 200", "14", 570, "Lower", "standard", 8],
      ["Upper 312", "18", 390, "Upper", "standard", 10],
    ]),
    coldplay: seatPlan("coldplay", [
      ["Lower 118", "9", 520, "Lower", "standard", 8],
      ["Upper 100", "21", 280, "Upper", "standard", 12],
      ["Accessible", "A", 300, "Accessible", "standard", 4],
    ]),
    neon: seatPlan("neon", [
      ["VIP Garden", "A", 920, "VIP", "resale", 6],
      ["General", "GA", 720, "General", "standard", 20],
      ["Weekend", "WK", 860, "Weekend", "standard", 12],
    ]),
    art: seatPlan("art", [
      ["Preview", "P", 420, "Preview", "vip", 8],
      ["Gallery A", "A", 260, "Timed Entry", "standard", 18],
      ["Gallery B", "B", 220, "Timed Entry", "standard", 18],
    ]),
    theatre: seatPlan("theatre", [
      ["Orchestra", "O", 680, "Premium", "standard", 10],
      ["Dress Circle", "D", 520, "Circle", "standard", 12],
      ["Balcony", "B", 320, "Balcony", "resale", 14],
    ]),
    finals: seatPlan("finals", [
      ["Courtside", "C", 1380, "VIP", "resale", 8],
      ["Lower Bowl", "14", 760, "Lower", "standard", 12],
      ["Upper Bowl", "315", 430, "Upper", "standard", 18],
    ]),
    jazz: seatPlan("jazz", [
      ["Table", "T", 560, "Table", "standard", 8],
      ["Roof", "R", 420, "Roof", "resale", 10],
      ["Standing", "S", 260, "Standing", "standard", 18],
    ]),
    future: seatPlan("future", [
      ["Hall A", "A", 640, "Conference", "standard", 18],
      ["Workshop", "W", 860, "Workshop", "vip", 10],
      ["Hall B", "B", 520, "Expo", "standard", 20],
    ]),
  };
  return {
    users: [
      {
        id: "usr_admin",
        name: "tuser",
        email: "tuser@fanpass.test",
        passwordHash: hashPassword("tpass", "fanpass-admin"),
        role: "admin",
        status: "active",
        createdAt,
      },
      {
        id: "usr_demo",
        name: "Alex Chen",
        email: "alex@fanpass.test",
        passwordHash: hashPassword("member123", "fanpass-member"),
        role: "member",
        status: "active",
        createdAt,
      },
    ],
    products: [
      {
        id: "prd_lisa_floor",
        name: "LISA Alter Ego World Tour",
        category: "Concert",
        city: "New York",
        venue: "Madison Square Garden",
        eventDate: "2026-05-24",
        price: 1250,
        stock: 18,
        image: "/assets-school/poster-lisa.png",
        status: "active",
        resaleCap: 1490,
        description: "Verified primary and resale tickets with capped resale and wallet-ready entry.",
        organizer: "Live House Global",
        statusLabel: "On sale now",
        gates: ["A1", "A2", "B1"],
        seats: seats.lisa,
      },
      {
        id: "prd_weeknd_lower",
        name: "The Weeknd Stadium Night",
        category: "Concert",
        city: "New Jersey",
        venue: "MetLife Stadium",
        eventDate: "2026-06-07",
        price: 570,
        stock: 42,
        image: "/assets-school/poster-weeknd.png",
        status: "active",
        resaleCap: 680,
        description: "Stadium tickets with map selection, resale offers and transparent seller rules.",
        organizer: "North Star Presents",
        statusLabel: "Popular",
        gates: ["West", "East", "Floor"],
        seats: seats.weeknd,
      },
      {
        id: "prd_coldplay_upper",
        name: "Coldplay Summer Lights",
        category: "Concert",
        city: "Boston",
        venue: "Gillette Stadium",
        eventDate: "2026-06-13",
        price: 280,
        stock: 64,
        image: "/assets-school/poster-coldplay.png",
        status: "active",
        resaleCap: 460,
        description: "Budget-friendly verified tickets with clear sections and protected delivery.",
        organizer: "Atlantic Events",
        statusLabel: "Low price",
        gates: ["Gate 1", "Gate 4"],
        seats: seats.coldplay,
      },
      {
        id: "prd_neon_festival",
        name: "Neon Valley Festival Pass",
        category: "Festival",
        city: "Hong Kong",
        venue: "Kai Tak Cruise Park",
        eventDate: "2026-07-19",
        price: 720,
        stock: 96,
        image: "/assets-school/festival-art.png",
        status: "active",
        resaleCap: 860,
        description: "Festival pass inventory sold as ticket products with FanPass order protection.",
        organizer: "Kai Tak Live",
        statusLabel: "Weekend pass",
        gates: ["North", "East"],
        seats: seats.neon,
      },
      {
        id: "prd_art_week_hk",
        name: "Art Week Hong Kong Preview",
        category: "Art Exhibition",
        city: "Hong Kong",
        venue: "Hong Kong Convention Centre",
        eventDate: "2026-08-02",
        price: 220,
        stock: 44,
        image: "/assets-school/event-cover-lab.png",
        status: "active",
        resaleCap: 420,
        description: "Timed-entry art exhibition tickets with preview access and transferable guest passes.",
        organizer: "HK Art Week",
        statusLabel: "Timed entry",
        gates: ["Hall 1", "Hall 3"],
        seats: seats.art,
      },
      {
        id: "prd_theatre_indie",
        name: "Indie Pulse Theatre Night",
        category: "Theatre",
        city: "Berlin",
        venue: "Warehouse 18",
        eventDate: "2026-09-12",
        price: 320,
        stock: 36,
        image: "/assets-school/event-cover-indie.png",
        status: "active",
        resaleCap: 680,
        description: "Small-room theatre performance with reserved orchestra, circle and balcony seating.",
        organizer: "Warehouse 18",
        statusLabel: "Reserved seating",
        gates: ["Main"],
        seats: seats.theatre,
      },
      {
        id: "prd_city_finals",
        name: "City Finals 2026",
        category: "Sports",
        city: "London",
        venue: "City Arena",
        eventDate: "2026-12-18",
        price: 430,
        stock: 38,
        image: "/assets-school/event-cover-finals.png",
        status: "active",
        resaleCap: 1380,
        description: "Championship tickets with courtside resale offers and upper-bowl standard seats.",
        organizer: "City League",
        statusLabel: "High demand",
        gates: ["Gate 1", "Gate 4"],
        seats: seats.finals,
      },
      {
        id: "prd_skyline_jazz",
        name: "Skyline Jazz Room",
        category: "Jazz",
        city: "Hong Kong",
        venue: "Skyline Rooftop",
        eventDate: "2026-10-04",
        price: 260,
        stock: 36,
        image: "/assets-school/event-cover-jazz.png",
        status: "active",
        resaleCap: 560,
        description: "Rooftop jazz session with table reservations, roof seats and standing entry.",
        organizer: "Skyline Sessions",
        statusLabel: "Intimate venue",
        gates: ["Lift 1", "Lift 2"],
        seats: seats.jazz,
      },
      {
        id: "prd_future_beats",
        name: "Future Beats Conference",
        category: "Conference",
        city: "Amsterdam",
        venue: "Future Pier Hall",
        eventDate: "2026-11-08",
        price: 520,
        stock: 48,
        image: "/assets-school/event-cover-future.png",
        status: "active",
        resaleCap: 860,
        description: "Music technology conference with workshop passes and verified hall access.",
        organizer: "Future Pier",
        statusLabel: "Workshops",
        gates: ["Hall A", "Hall B"],
        seats: seats.future,
      },
    ],
    carts: [],
    transactions: [],
    comments: [
      {
        id: "cmt_seed_1",
        productId: "prd_lisa_floor",
        userId: "usr_demo",
        userName: "Alex Chen",
        rating: 5,
        text: "Clear checkout flow and the verified ticket rules are easy to understand.",
        status: "active",
        createdAt,
      },
    ],
    sessions: [],
  };
}

function seatPlan(prefix, sections) {
  return sections.flatMap(([section, row, price, tier, type, count], sectionIndex) =>
    Array.from({ length: count }, (_, index) => {
      const seat = String(index + 1).padStart(2, "0");
      const unavailable = (index + sectionIndex) % 7 === 0;
      return {
        id: `${prefix}_${section.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${row}_${seat}`,
        section,
        row,
        seat,
        price,
        tier,
        type,
        status: unavailable ? "sold" : "available",
      };
    }),
  );
}
