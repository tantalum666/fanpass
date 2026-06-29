import type { MarketListing, UserTicket, WebEvent } from "../types";

export const featuredCities = ["Hong Kong", "Singapore", "Taipei", "Tokyo"];

export const webEvents: WebEvent[] = [
  {
    id: "evt_hk_neon_weekender",
    title: "Neon Weekender",
    artist: "Lumen District",
    category: "Festival",
    city: "Hong Kong",
    venue: "Kai Tak Arena",
    address: "Kai Tak Sports Park",
    startsAt: "2026-08-22T20:00:00+08:00",
    image:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1600&q=80",
    accent: "#45e6ff",
    status: "Selling fast",
    summary:
      "Two stages, verified primary inventory, and a capped fan-to-fan market that keeps the hottest passes visible without turning access into a bidding war.",
    demand: 92,
    ticketTypes: [
      {
        id: "tt_neon_floor",
        name: "Floor",
        section: "Standing floor",
        price: 1188,
        currency: "HKD",
        remaining: 64,
        resaleCap: 1425,
        perks: ["Fast entry lane", "Transfer allowed once"],
      },
      {
        id: "tt_neon_balcony",
        name: "Balcony",
        section: "Level 2 reserved",
        price: 888,
        currency: "HKD",
        remaining: 132,
        resaleCap: 1065,
        perks: ["Reserved view", "Verified resale eligible"],
      },
    ],
    highlights: [
      "Primary and resale prices share one event view",
      "Every listing carries holder and transfer history",
      "Fans see demand before committing to checkout",
    ],
    policy: [
      "Resale cannot exceed the organizer-defined cap",
      "Each transfer updates the ticket ownership timeline",
      "Refund and event-change states stay attached to the order",
    ],
  },
  {
    id: "evt_sg_afterhours",
    title: "Afterhours Circuit",
    artist: "Noir Atlas",
    category: "Club",
    city: "Singapore",
    venue: "Pasir Panjang Power Station",
    address: "27 Pasir Panjang Road",
    startsAt: "2026-09-04T22:30:00+08:00",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80",
    accent: "#b86cff",
    status: "On sale",
    summary:
      "A compact late-night drop built around quick discovery, transparent allocation, and a waitlist that routes returned tickets back to real fans.",
    demand: 76,
    ticketTypes: [
      {
        id: "tt_afterhours_ga",
        name: "General admission",
        section: "Main room",
        price: 96,
        currency: "SGD",
        remaining: 240,
        resaleCap: 115,
        perks: ["Mobile entry", "Waitlist eligible"],
      },
      {
        id: "tt_afterhours_priority",
        name: "Priority",
        section: "Priority entry",
        price: 146,
        currency: "SGD",
        remaining: 58,
        resaleCap: 175,
        perks: ["Priority queue", "Balcony access"],
      },
    ],
    highlights: [
      "Short checkout for high-velocity drops",
      "Waitlist demand is visible before sell-out",
      "Returned tickets are reallocated through the same market",
    ],
    policy: [
      "Organizer controls whether resale opens",
      "Listings are matched before public price changes",
      "Entry rights remain tied to the latest verified holder",
    ],
  },
  {
    id: "evt_tpe_orbit",
    title: "Orbit Finals",
    artist: "Asia Arena League",
    category: "Sports",
    city: "Taipei",
    venue: "Taipei Dome",
    address: "Songshan District",
    startsAt: "2026-10-10T19:30:00+08:00",
    image:
      "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1600&q=80",
    accent: "#6ee7b7",
    status: "Resale open",
    summary:
      "Finals inventory with clear seat bands, a visible floor price, and transfer limits that make resale liquid without hiding the real cost.",
    demand: 88,
    ticketTypes: [
      {
        id: "tt_orbit_lower",
        name: "Lower bowl",
        section: "Aisles 101-116",
        price: 3280,
        currency: "TWD",
        remaining: 42,
        resaleCap: 3935,
        perks: ["Seat band shown", "Verified resale open"],
      },
      {
        id: "tt_orbit_upper",
        name: "Upper bowl",
        section: "Aisles 501-528",
        price: 1880,
        currency: "TWD",
        remaining: 310,
        resaleCap: 2255,
        perks: ["Best availability", "Group-friendly"],
      },
    ],
    highlights: [
      "Fans compare face value and resale floor in one place",
      "Seat bands stay readable on mobile",
      "Order status remains visible after checkout",
    ],
    policy: [
      "Listed tickets are removed from the holder's active set",
      "Matched resale issues a new ownership record",
      "Cancelled orders release inventory immediately",
    ],
  },
  {
    id: "evt_tokyo_glass",
    title: "Glasshouse Sessions",
    artist: "Mika Shore",
    category: "Concert",
    city: "Tokyo",
    venue: "Toyosu Pit",
    address: "Toyosu, Koto City",
    startsAt: "2026-11-16T19:00:00+09:00",
    image:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80",
    accent: "#ff7aa2",
    status: "Waitlist",
    summary:
      "A small-room artist presale where access scores, returned inventory, and capped resale all sit behind a clean fan-facing queue.",
    demand: 97,
    ticketTypes: [
      {
        id: "tt_glasshouse_ga",
        name: "Standing",
        section: "All standing",
        price: 9200,
        currency: "JPY",
        remaining: 0,
        resaleCap: 11040,
        perks: ["Join waitlist", "Returned tickets matched first"],
      },
    ],
    highlights: [
      "Sold-out events still show a fair next action",
      "Fan access inputs are explained as eligibility signals",
      "No hidden inventory state between primary and resale",
    ],
    policy: [
      "Waitlist position responds to approved fan access signals",
      "Resale cap remains visible after sell-out",
      "Transfers close before event operations begin",
    ],
  },
];

export const initialMarketListings: MarketListing[] = [
  {
    id: "lst_1001",
    eventId: "evt_hk_neon_weekender",
    ticketTypeId: "tt_neon_balcony",
    seller: "Verified fan 8K2",
    price: 1010,
    quantity: 1,
    listedAt: "2026-06-01T11:10:00+08:00",
  },
  {
    id: "lst_1002",
    eventId: "evt_tpe_orbit",
    ticketTypeId: "tt_orbit_lower",
    seller: "Verified fan P19",
    price: 3720,
    quantity: 1,
    listedAt: "2026-06-02T15:42:00+08:00",
  },
  {
    id: "lst_1003",
    eventId: "evt_sg_afterhours",
    ticketTypeId: "tt_afterhours_ga",
    seller: "Verified fan A04",
    price: 108,
    quantity: 2,
    listedAt: "2026-06-03T09:22:00+08:00",
  },
];

export const initialTickets: UserTicket[] = [
  {
    id: "pass_7819",
    eventId: "evt_hk_neon_weekender",
    ticketTypeId: "tt_neon_floor",
    code: "FP-7819-HK",
    holder: "Demo Fan",
    status: "Active",
    purchasedAt: "2026-06-01T12:00:00+08:00",
    paid: 1188,
  },
];
