import Foundation

enum FanPassMockData {
    static let guestFan = FanPassV4.User(
        id: "usr_guest",
        displayName: "Guest",
        email: "guest@example.com",
        role: .guest,
        scenario: .normalFan,
        walletReference: nil,
        accessBadges: []
    )

    static let accessBadge = FanPassV4.AccessBadge(
        id: "badge_early_access",
        title: "Early Access",
        criteria: "Complete two Fan Access tasks.",
        benefit: "Priority purchase window and verified fan rewards.",
        status: .earned
    )

    static let normalFan = FanPassV4.User(
        id: "usr_demo_normal_fan",
        displayName: "Kai Fan",
        email: "kai@example.com",
        role: .fan,
        scenario: .normalFan,
        walletReference: wallet("FP-7A2F...91C4"),
        accessBadges: []
    )

    static let verifiedFan = FanPassV4.User(
        id: "usr_demo_verified_fan",
        displayName: "Verified Fan",
        email: "verified@example.com",
        role: .fan,
        scenario: .verifiedFanWithBadge,
        walletReference: wallet("FP-8B21...4F90"),
        accessBadges: [accessBadge]
    )

    static let purchasedTicketFan = FanPassV4.User(
        id: "usr_demo_ticket_fan",
        displayName: "Ticket Holder",
        email: "tickets@example.com",
        role: .fan,
        scenario: .purchasedTicketFan,
        walletReference: wallet("FP-6C91...22AA"),
        accessBadges: [accessBadge]
    )

    static let listedResaleFan = FanPassV4.User(
        id: "usr_demo_resale_fan",
        displayName: "Resale Fan",
        email: "resale@example.com",
        role: .fan,
        scenario: .listedResaleFan,
        walletReference: wallet("FP-2D45...73EF"),
        accessBadges: []
    )

    static let staffUser = FanPassV4.User(
        id: "usr_demo_staff",
        displayName: "Gate Staff",
        email: "staff@example.com",
        role: .gateStaff,
        scenario: .gateStaff,
        walletReference: nil,
        accessBadges: []
    )

    static let organizerUser = FanPassV4.User(
        id: "usr_demo_organizer",
        displayName: "Organizer Admin",
        email: "organizer@example.com",
        role: .organizer,
        scenario: .organizerLite,
        walletReference: nil,
        accessBadges: []
    )

    static let currentUser = purchasedTicketFan
    static let users = [normalFan, verifiedFan, purchasedTicketFan, listedResaleFan, staffUser, organizerUser]

    static let venues: [FanPassV4.Venue] = [
        .init(id: "venue_harbor", name: "Harbor Dome", city: "Hong Kong", country: "HK", timezone: "Asia/Hong_Kong", gates: ["A1", "A2", "B1"]),
        .init(id: "venue_riverside", name: "Riverside Field", city: "Singapore", country: "SG", timezone: "Asia/Singapore", gates: ["North", "East"]),
        .init(id: "venue_city", name: "City Arena", city: "London", country: "UK", timezone: "Europe/London", gates: ["Gate 1", "Gate 4"]),
        .init(id: "venue_indie", name: "Warehouse 18", city: "Berlin", country: "DE", timezone: "Europe/Berlin", gates: ["Main"]),
        .init(id: "venue_lab", name: "Sound Lab Hall", city: "Tokyo", country: "JP", timezone: "Asia/Tokyo", gates: ["S1", "S2"]),
        .init(id: "venue_midnight", name: "Midnight Stadium", city: "Los Angeles", country: "US", timezone: "America/Los_Angeles", gates: ["West", "East", "Floor"]),
        .init(id: "venue_future", name: "Future Pier Hall", city: "Amsterdam", country: "NL", timezone: "Europe/Amsterdam", gates: ["Hall A", "Hall B"]),
        .init(id: "venue_jazz", name: "Skyline Rooftop", city: "Hong Kong", country: "HK", timezone: "Asia/Hong_Kong", gates: ["Lift 1", "Lift 2"]),
        .init(id: "venue_family", name: "Garden Theatre", city: "Singapore", country: "SG", timezone: "Asia/Singapore", gates: ["Orchestra", "Balcony"]),
        .init(id: "venue_comedy", name: "Cellar Club", city: "London", country: "UK", timezone: "Europe/London", gates: ["Main"])
    ]

    static let events: [FanPassV4.Event] = [
        event(id: "evt_aurora", title: "Aurora Nights World Tour", subtitle: "A premium night show with verified entry.", category: .concerts, venue: venues[0], month: 10, day: 12, hour: 20, status: .published, basePrice: 1280, demand: .veryHot, fanAccess: true, coverAssetName: "event-cover-aurora", gradient: .init(startHex: 0x46E8FF, endHex: 0x7C3AED, accentHex: 0xF43FDA, label: "Aurora")),
        event(id: "evt_neon", title: "Neon Harbor Festival", subtitle: "Multi-stage festival with controlled resale.", category: .festivals, venue: venues[1], month: 11, day: 15, hour: 18, status: .published, basePrice: 860, demand: .hot, fanAccess: true, coverAssetName: "event-cover-neon", gradient: .init(startHex: 0x22C55E, endHex: 0x46E8FF, accentHex: 0x7C3AED, label: "Harbor")),
        event(id: "evt_finals", title: "City Finals 2026", subtitle: "Championship energy with secure ticket transfer.", category: .sports, venue: venues[2], month: 12, day: 18, hour: 19, status: .soldOut, basePrice: 720, demand: .veryHot, fanAccess: false, coverAssetName: "event-cover-finals", gradient: .init(startHex: 0xF59E0B, endHex: 0x7C3AED, accentHex: 0x46E8FF, label: "Finals")),
        event(id: "evt_indie", title: "Indie Pulse Live", subtitle: "Independent live showcase with non-transferable access.", category: .concerts, venue: venues[3], month: 12, day: 22, hour: 21, status: .published, basePrice: 420, demand: .medium, fanAccess: true, transferable: false, coverAssetName: "event-cover-indie", gradient: .init(startHex: 0xF43FDA, endHex: 0x111827, accentHex: 0x46E8FF, label: "Pulse")),
        event(id: "evt_lab", title: "Global Sound Lab", subtitle: "Experimental performance series with transparent prices.", category: .theatre, venue: venues[4], month: 1, day: 10, hour: 20, status: .completed, basePrice: 560, demand: .soft, fanAccess: false, coverAssetName: "event-cover-lab", gradient: .init(startHex: 0x7C3AED, endHex: 0x020617, accentHex: 0x22C55E, label: "Lab")),
        event(id: "evt_midnight", title: "Midnight Stadium Show", subtitle: "Large-format stadium pass with NFC-ready entry.", category: .concerts, venue: venues[5], month: 2, day: 14, hour: 21, status: .published, basePrice: 1480, demand: .veryHot, fanAccess: true, coverAssetName: "event-cover-midnight", gradient: .init(startHex: 0x020617, endHex: 0x7C3AED, accentHex: 0x46E8FF, label: "Midnight")),
        event(id: "evt_future", title: "Future Beats Conference", subtitle: "Music technology conference with fan rewards.", category: .conference, venue: venues[6], month: 3, day: 6, hour: 10, status: .published, basePrice: 640, demand: .medium, fanAccess: true, coverAssetName: "event-cover-future", gradient: .init(startHex: 0x46E8FF, endHex: 0x22C55E, accentHex: 0xF43FDA, label: "Future")),
        event(id: "evt_jazz", title: "Skyline Jazz Room", subtitle: "Rooftop jazz with a steady fan queue.", category: .concerts, venue: venues[7], month: 4, day: 18, hour: 20, status: .published, basePrice: 520, demand: .medium, fanAccess: false, coverAssetName: "event-cover-jazz", gradient: .init(startHex: 0xF59E0B, endHex: 0x0F766E, accentHex: 0x46E8FF, label: "Jazz")),
        event(id: "evt_family", title: "Family Matinee Spectacular", subtitle: "Daytime theatre with wide availability.", category: .theatre, venue: venues[8], month: 5, day: 2, hour: 14, status: .published, basePrice: 5, demand: .cold, fanAccess: false, coverAssetName: "event-cover-family", gradient: .init(startHex: 0xF43FDA, endHex: 0xF59E0B, accentHex: 0x22C55E, label: "Matinee")),
        event(id: "evt_comedy", title: "Underground Comedy Night", subtitle: "Small-room comedy with lower resale pressure.", category: .theatre, venue: venues[9], month: 5, day: 21, hour: 21, status: .published, basePrice: 320, demand: .soft, fanAccess: false, coverAssetName: "event-cover-comedy", gradient: .init(startHex: 0x111827, endHex: 0xF59E0B, accentHex: 0x46E8FF, label: "Comedy"))
    ]

    static var tickets: [FanPassV4.Ticket] {
        [
            ticket("FP-ANWT-108-12-15", event: events[0], ticketTypeIndex: 0, owner: purchasedTicketFan, status: .active, section: "108", row: "12", seat: "15", entryMode: .nfcReady),
            ticket("FP-MID-210-09-11", event: events[5], ticketTypeIndex: 1, owner: purchasedTicketFan, status: .active, section: "210", row: "9", seat: "11", entryMode: .qrOnly),
            ticket("FP-INDIE-044-02-09", event: events[3], ticketTypeIndex: 0, owner: purchasedTicketFan, status: .active, section: "44", row: "2", seat: "9", entryMode: .qrOnly),
            ticket("FP-NEON-204-08-22", event: events[1], ticketTypeIndex: 0, owner: listedResaleFan, status: .listed, section: "204", row: "8", seat: "22", entryMode: .nfcReady, transferCount: 1),
            ticket("FP-NEON-SOLD-118-14-06", event: events[1], ticketTypeIndex: 1, owner: listedResaleFan, status: .transferred, section: "118", row: "14", seat: "6", entryMode: .unavailable, transferCount: 1, extraProof: soldProof("FP-NEON-SOLD-118-14-06")),
            ticket("FP-FUTURE-XFER-022-03-18", event: events[6], ticketTypeIndex: 0, owner: purchasedTicketFan, status: .transferPending, section: "22", row: "3", seat: "18", entryMode: .unavailable, transferCount: 1, extraProof: transferProof("FP-FUTURE-XFER-022-03-18")),
            ticket("FP-FINALS-315-21-04", event: events[2], ticketTypeIndex: 1, owner: purchasedTicketFan, status: .refunded, section: "315", row: "21", seat: "04", entryMode: .unavailable, extraProof: refundProof("FP-FINALS-315-21-04")),
            ticket("FP-INDIE-CANCEL-044-02-10", event: events[3], ticketTypeIndex: 0, owner: purchasedTicketFan, status: .cancelled, section: "44", row: "2", seat: "10", entryMode: .unavailable, extraProof: cancelProof("FP-INDIE-CANCEL-044-02-10")),
            ticket("FP-LAB-088-07-18", event: events[4], ticketTypeIndex: 0, owner: purchasedTicketFan, status: .redeemed, section: "88", row: "7", seat: "18", entryMode: .unavailable, transferCount: 1, extraProof: redeemedProof("FP-LAB-088-07-18")),
            ticket("FP-LAB-EXP-090-02-02", event: events[4], ticketTypeIndex: 1, owner: purchasedTicketFan, status: .expired, section: "90", row: "2", seat: "2", entryMode: .unavailable)
        ]
    }

    static var listings: [FanPassV4.ResaleListing] {
        [
            listing("listing_aurora_cat2_1", event: events[0], ticketTypeIndex: 0, price: marketListingPrice(events[0], ticketTypeIndex: 0, multiplier: 1.08), section: "CAT 2", row: "10", seat: "19"),
            listing("listing_aurora_floor_1", event: events[0], ticketTypeIndex: 1, price: marketListingPrice(events[0], ticketTypeIndex: 1, multiplier: 1.03), section: "Floor", row: "B", seat: "12"),
            listing("listing_neon_cat2_1", event: events[1], ticketTypeIndex: 0, price: marketListingPrice(events[1], ticketTypeIndex: 0, multiplier: 1.04), section: "CAT 2", row: "8", seat: "22"),
            listing("listing_neon_vip_1", event: events[1], ticketTypeIndex: 2, price: marketListingPrice(events[1], ticketTypeIndex: 2, multiplier: 0.99), section: "VIP", row: "A", seat: "6"),
            listing("listing_finals_lower_1", event: events[2], ticketTypeIndex: 1, price: marketListingPrice(events[2], ticketTypeIndex: 1, multiplier: 1.10), section: "Lower Bowl", row: "14", seat: "6"),
            listing("listing_indie_balcony_1", event: events[3], ticketTypeIndex: 0, price: marketListingPrice(events[3], ticketTypeIndex: 0, multiplier: 0.98), section: "Balcony", row: "2", seat: "9"),
            listing("listing_indie_orchestra_1", event: events[3], ticketTypeIndex: 1, price: marketListingPrice(events[3], ticketTypeIndex: 1, multiplier: 1.01), section: "Orchestra", row: "3", seat: "4"),
            listing("listing_midnight_floor_1", event: events[5], ticketTypeIndex: 1, price: marketListingPrice(events[5], ticketTypeIndex: 1, multiplier: 1.09), section: "Floor", row: "B", seat: "18"),
            listing("listing_midnight_cat2_1", event: events[5], ticketTypeIndex: 0, price: marketListingPrice(events[5], ticketTypeIndex: 0, multiplier: 1.06), section: "CAT 2", row: "21", seat: "8"),
            listing("listing_future_pass_1", event: events[6], ticketTypeIndex: 0, price: marketListingPrice(events[6], ticketTypeIndex: 0, multiplier: 1.00), section: "Hall", row: "4", seat: "31"),
            listing("listing_jazz_roof_1", event: events[7], ticketTypeIndex: 1, price: marketListingPrice(events[7], ticketTypeIndex: 1, multiplier: 0.97), section: "Roof", row: "A", seat: "12"),
            listing("listing_family_balcony_1", event: events[8], ticketTypeIndex: 0, price: marketListingPrice(events[8], ticketTypeIndex: 0, multiplier: 0.88), section: "Balcony", row: "6", seat: "18"),
            listing("listing_comedy_club_1", event: events[9], ticketTypeIndex: 0, price: marketListingPrice(events[9], ticketTypeIndex: 0, multiplier: 0.94), section: "Club", row: "3", seat: "5")
        ]
    }

    static let orderbookByEvent: [String: [FanPassV4.OrderbookOrder]] = Dictionary(uniqueKeysWithValues: events.map { event in
        let face = event.ticketTypes[0].faceValue
        let floor = event.marketSummary.floorPrice
        let cap = event.marketSummary.organizerCap
        let bidStep = max(12, face / 24)
        let askStep = max(16, face / 18)
        let bestBid = min(max(1, floor - bidStep), cap)
        let secondBid = min(max(1, bestBid - bidStep), cap)
        let bestAsk = min(floor, cap)
        let secondAsk = min(bestAsk + askStep, cap)
        return (event.id, [
            .init(id: "\(event.id)_bid_1", side: .buy, price: bestBid, quantity: 1, remainingQuantity: 1, status: "Open", createdAt: date(2026, 6, 5, 9, 10)),
            .init(id: "\(event.id)_bid_2", side: .buy, price: secondBid, quantity: event.status == .soldOut ? 3 : 2, remainingQuantity: event.status == .soldOut ? 3 : 2, status: "Open", createdAt: date(2026, 6, 5, 9, 30)),
            .init(id: "\(event.id)_ask_1", side: .sell, price: bestAsk, quantity: 1, remainingQuantity: 1, status: "Open", createdAt: date(2026, 6, 5, 10, 5)),
            .init(id: "\(event.id)_ask_2", side: .sell, price: secondAsk, quantity: 1, remainingQuantity: 1, status: "Open", createdAt: date(2026, 6, 5, 10, 20))
        ])
    })

    static var orderbookOrders: [FanPassV4.OrderbookOrder] { orderbook(for: events[0]) }

    static let tradesByEvent: [String: [FanPassV4.Trade]] = Dictionary(uniqueKeysWithValues: events.map { event in
        let recent = event.marketSummary.recentSale
        return (event.id, [
            .init(id: "\(event.id)_trade_1", ticketId: "FP-\(event.id)-A", price: max(1, recent - max(18, event.ticketTypes[0].faceValue / 28)), fee: max(18, Int(Double(recent) * 0.032)), settlementStatus: "Settled", createdAt: date(2026, 6, 5, 8, 30)),
            .init(id: "\(event.id)_trade_2", ticketId: "FP-\(event.id)-B", price: recent, fee: max(18, Int(Double(recent) * 0.035)), settlementStatus: "Settled", createdAt: date(2026, 6, 5, 9, 45)),
            .init(id: "\(event.id)_trade_3", ticketId: "FP-\(event.id)-C", price: min(recent + max(16, event.ticketTypes[0].faceValue / 32), event.marketSummary.organizerCap), fee: max(18, Int(Double(recent) * 0.037)), settlementStatus: "Settled", createdAt: date(2026, 6, 5, 10, 15))
        ])
    })

    static var trades: [FanPassV4.Trade] { trades(for: events[0]) }

    static let scanResults: [FanPassV4.CheckInResult] = [
        .init(id: "scan_ok", ticketFragment: "ANWT-108-12-15", eventTitle: "Aurora Nights World Tour", gate: "A1", result: .accepted, checkedAt: date(2026, 10, 12, 19, 42), reason: "Entry accepted."),
        .init(id: "scan_dup", ticketFragment: "ANWT-108-12-15", eventTitle: "Aurora Nights World Tour", gate: "A1", result: .duplicate, checkedAt: date(2026, 10, 12, 19, 44), reason: "This ticket was already checked in."),
        .init(id: "scan_invalid", ticketFragment: "UNKNOWN", eventTitle: "Aurora Nights World Tour", gate: "A1", result: .invalid, checkedAt: date(2026, 10, 12, 19, 45), reason: "This QR code does not match a valid FanPass ticket."),
        .init(id: "scan_wrong_event", ticketFragment: "NEON-204-08-22", eventTitle: "Aurora Nights World Tour", gate: "A1", result: .ownerMismatch, checkedAt: date(2026, 10, 12, 19, 46), reason: "This ticket belongs to a different event."),
        .init(id: "scan_expired", ticketFragment: "ANWT-108-12-15", eventTitle: "Aurora Nights World Tour", gate: "A1", result: .expired, checkedAt: date(2026, 10, 12, 19, 47), reason: "Code expired. Ask the fan to refresh the ticket.")
    ]

    static func user(for scenario: FanPassV4.DemoUserScenario) -> FanPassV4.User {
        users.first { $0.scenario == scenario } ?? currentUser
    }

    static func tickets(for user: FanPassV4.User) -> [FanPassV4.Ticket] {
        switch user.scenario {
        case .normalFan:
            return []
        case .verifiedFanWithBadge:
            return tickets.filter { ["FP-MID-210-09-11", "FP-INDIE-044-02-09"].contains($0.id) }
        case .purchasedTicketFan:
            return tickets.filter { $0.ownerId == purchasedTicketFan.id }
        case .listedResaleFan:
            return tickets.filter { $0.ownerId == listedResaleFan.id }
        case .gateStaff, .organizerLite:
            return []
        }
    }

    static func orderbook(for event: FanPassV4.Event) -> [FanPassV4.OrderbookOrder] {
        orderbookByEvent[event.id] ?? []
    }

    static func trades(for event: FanPassV4.Event) -> [FanPassV4.Trade] {
        tradesByEvent[event.id] ?? []
    }

    static func fanTasks(eventId: String) -> [FanPassV4.FanTask] {
        [
            .init(id: "\(eventId)_task_share", eventId: eventId, title: "Follow event updates", description: "Join the official event update list in FanPass.", points: 20, verificationMethod: "Automatic check", status: .approved),
            .init(id: "\(eventId)_task_quiz", eventId: eventId, title: "Complete event quiz", description: "Answer three event questions to earn early access points.", points: 35, verificationMethod: "Organizer review", status: .available),
            .init(id: "\(eventId)_task_checkin", eventId: eventId, title: "Venue arrival pledge", description: "Confirm your planned arrival window to help reduce gate queues.", points: 15, verificationMethod: "Self confirmation", status: .available)
        ]
    }

    static func proofHistory(ticketId: String) -> [FanPassV4.ProofHistoryItem] {
        [
            .init(id: "\(ticketId)_issued", type: .issued, title: "Ticket issued", description: "Organizer created a verified ticket record.", timestamp: date(2026, 6, 1, 10, 0), actorLabel: "Organizer", proofReference: "proof...A91C", status: .success),
            .init(id: "\(ticketId)_purchase", type: .purchased, title: "Purchase confirmed", description: "FanPass secured this ticket for your account.", timestamp: date(2026, 6, 2, 12, 24), actorLabel: "FanPass", proofReference: "proof...B24F", status: .success),
            .init(id: "\(ticketId)_entry", type: .entryCode, title: "Entry code ready", description: "A short-lived entry code can be generated from this ticket.", timestamp: date(2026, 6, 5, 10, 18), actorLabel: "FanPass", proofReference: "proof...C77E", status: .success)
        ]
    }

    static func date(_ year: Int, _ month: Int, _ day: Int, _ hour: Int, _ minute: Int) -> Date {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = TimeZone(identifier: "Asia/Hong_Kong")
        components.year = year
        components.month = month
        components.day = day
        components.hour = hour
        components.minute = minute
        return components.date ?? Date(timeIntervalSince1970: 0)
    }

    private static func wallet(_ fragment: String) -> FanPassV4.WalletReference {
        .init(addressFragment: fragment, provider: "Embedded wallet", status: "Ticket identity ready", lastSyncedAt: date(2026, 6, 5, 10, 15))
    }

    private enum DemandProfile {
        case veryHot
        case hot
        case medium
        case soft
        case cold

        var generalAvailability: Int {
            switch self {
            case .veryHot: 38
            case .hot: 128
            case .medium: 360
            case .soft: 690
            case .cold: 1_080
            }
        }

        var premiumAvailability: Int {
            switch self {
            case .veryHot: 8
            case .hot: 36
            case .medium: 92
            case .soft: 170
            case .cold: 260
            }
        }

        var floorMultiplier: Double {
            switch self {
            case .veryHot: 1.09
            case .hot: 1.06
            case .medium: 1.02
            case .soft: 0.96
            case .cold: 0.88
            }
        }

        var recentMultiplier: Double {
            switch self {
            case .veryHot: 1.10
            case .hot: 1.07
            case .medium: 1.03
            case .soft: 0.95
            case .cold: 0.86
            }
        }

        var suggestedMultiplier: Double {
            switch self {
            case .veryHot: 1.09
            case .hot: 1.06
            case .medium: 1.03
            case .soft: 0.96
            case .cold: 0.90
            }
        }

        var volumeFactor: Double {
            switch self {
            case .veryHot: 2.7
            case .hot: 1.8
            case .medium: 1.0
            case .soft: 0.55
            case .cold: 0.32
            }
        }

        var historyMultipliers: [Double] {
            switch self {
            case .veryHot:
                [0.98, 1.00, 1.03, 1.05, 1.08, 1.10, 1.09, 1.10, 1.08, 1.10]
            case .hot:
                [0.94, 0.97, 0.99, 1.01, 1.03, 1.06, 1.07, 1.08, 1.06, 1.07]
            case .medium:
                [0.92, 0.96, 0.99, 1.01, 1.00, 1.03, 1.02, 1.04, 1.01, 1.03]
            case .soft:
                [0.86, 0.90, 0.94, 0.92, 0.95, 0.97, 0.94, 0.96, 0.93, 0.95]
            case .cold:
                [0.78, 0.82, 0.85, 0.88, 0.86, 0.90, 0.87, 0.89, 0.84, 0.88]
            }
        }
    }

    private static func event(
        id: String,
        title: String,
        subtitle: String,
        category: FanPassV4.EventCategory,
        venue: FanPassV4.Venue,
        month: Int,
        day: Int,
        hour: Int,
        status: FanPassV4.EventStatus,
        basePrice: Int,
        demand: DemandProfile,
        fanAccess: Bool,
        transferable: Bool = true,
        coverAssetName: String? = nil,
        gradient: FanPassV4.HeroGradient
    ) -> FanPassV4.Event {
        let generalCap = resaleCap(for: basePrice)
        let premiumPrice = basePrice + 420
        let premiumCap = resaleCap(for: premiumPrice)
        let vipPrice = basePrice + 780
        let vipCap = resaleCap(for: vipPrice)
        let isUnavailable = status == .soldOut || status == .completed
        let tierNames = ticketTierNames(for: category)
        let general = FanPassV4.TicketType(
            id: "\(id)_ga",
            eventId: id,
            name: tierNames.general,
            faceValue: basePrice,
            currency: "HKD",
            supply: 1800,
            availableQuantity: isUnavailable ? 0 : demand.generalAvailability,
            transferRule: .init(transferable: transferable, resaleCap: generalCap, maxTransferCount: transferable ? 2 : 0, listingReservesEntry: transferable),
            refundPolicy: "Refunds follow organizer cancellation rules."
        )
        let premium = FanPassV4.TicketType(
            id: "\(id)_premium",
            eventId: id,
            name: tierNames.premium,
            faceValue: premiumPrice,
            currency: "HKD",
            supply: 420,
            availableQuantity: isUnavailable ? 0 : demand.premiumAvailability,
            transferRule: .init(transferable: transferable, resaleCap: premiumCap, maxTransferCount: transferable ? 1 : 0, listingReservesEntry: transferable),
            refundPolicy: "Refunds available only if the event is cancelled."
        )
        let vip = FanPassV4.TicketType(
            id: "\(id)_vip",
            eventId: id,
            name: tierNames.vip,
            faceValue: vipPrice,
            currency: "HKD",
            supply: 160,
            availableQuantity: isUnavailable ? 0 : max(2, demand.premiumAvailability / 4),
            transferRule: .init(transferable: transferable, resaleCap: vipCap, maxTransferCount: transferable ? 1 : 0, listingReservesEntry: transferable),
            refundPolicy: "VIP refunds are available only if the event is cancelled."
        )
        let floor = marketPrice(faceValue: basePrice, multiplier: demand.floorMultiplier, cap: generalCap)
        return FanPassV4.Event(
            id: id,
            title: title,
            subtitle: subtitle,
            category: category,
            heroGradient: gradient,
            coverAssetName: coverAssetName,
            fanAccessAvailable: fanAccess,
            startTime: date(month <= 6 ? 2027 : 2026, month, day, hour, 0),
            status: status,
            venue: venue,
            ticketTypes: [general, premium, vip],
            fanTasks: fanAccess ? fanTasks(eventId: id) : [],
            marketSummary: .init(
                floorPrice: floor,
                organizerCap: generalCap,
                recentSale: marketPrice(faceValue: basePrice, multiplier: demand.recentMultiplier, cap: generalCap),
                volume: max(6, Int((Double(basePrice) / 28.0 * demand.volumeFactor).rounded())),
                currency: "HKD",
                suggestedResalePrice: marketPrice(faceValue: basePrice, multiplier: demand.suggestedMultiplier, cap: generalCap),
                priceHistory: priceHistory(prefix: id, base: basePrice, cap: generalCap, demand: demand)
            )
        )
    }

    private static func resaleCap(for faceValue: Int) -> Int {
        Int((Double(faceValue) * 1.10).rounded())
    }

    private static func marketPrice(faceValue: Int, multiplier: Double, cap: Int) -> Int {
        min(max(1, Int((Double(faceValue) * multiplier).rounded())), cap)
    }

    private static func ticket(
        _ id: String,
        event: FanPassV4.Event,
        ticketTypeIndex: Int,
        owner: FanPassV4.User,
        status: FanPassV4.TicketStatus,
        section: String,
        row: String,
        seat: String,
        entryMode: FanPassV4.TicketEntryMode,
        transferCount: Int = 0,
        extraProof: [FanPassV4.ProofHistoryItem] = []
    ) -> FanPassV4.Ticket {
        FanPassV4.Ticket(
            id: id,
            event: event,
            ticketType: event.ticketTypes[ticketTypeIndex],
            ownerId: owner.id,
            status: status,
            section: section,
            row: row,
            seat: seat,
            entryMode: entryMode,
            transferCount: transferCount,
            proofHistory: proofHistory(ticketId: id) + extraProof
        )
    }

    private static func ticketTierNames(for category: FanPassV4.EventCategory) -> (general: String, premium: String, vip: String) {
        switch category {
        case .concerts, .festivals:
            return ("CAT 2", "Floor", "VIP")
        case .sports:
            return ("Upper Bowl", "Lower Bowl", "Courtside")
        case .theatre:
            return ("Balcony", "Orchestra", "Box")
        case .conference:
            return ("Conference Pass", "Priority Pass", "Founder Pass")
        }
    }

    private static func listing(_ id: String, event: FanPassV4.Event, ticketTypeIndex: Int = 0, price: Int, section: String, row: String, seat: String) -> FanPassV4.ResaleListing {
        let ticket = ticket("FP-LIST-\(id)", event: event, ticketTypeIndex: ticketTypeIndex, owner: listedResaleFan, status: .listed, section: section, row: row, seat: seat, entryMode: .nfcReady)
        return .init(id: id, ticket: ticket, sellerDisplay: "Verified fan", price: price, currency: "HKD", feeEstimate: max(28, Int(Double(price) * 0.035)), status: .open, createdAt: date(2026, 6, 5, 11, 0))
    }

    private static func marketListingPrice(_ event: FanPassV4.Event, ticketTypeIndex: Int = 0, multiplier: Double) -> Int {
        let ticketType = event.ticketTypes.indices.contains(ticketTypeIndex) ? event.ticketTypes[ticketTypeIndex] : event.safePrimaryTicketType
        let cap = ticketType.transferRule.resaleCap ?? event.marketSummary.organizerCap
        return marketPrice(faceValue: ticketType.faceValue, multiplier: multiplier, cap: cap)
    }

    private static func priceHistory(prefix: String, base: Int, cap: Int, demand: DemandProfile) -> [FanPassV4.PricePoint] {
        let values = demand.historyMultipliers.map { marketPrice(faceValue: base, multiplier: $0, cap: cap) }
        return values.enumerated().map { index, price in
            FanPassV4.PricePoint(id: "\(prefix)_price_\(index)", label: "D-\(values.count - index - 1)", price: price)
        }
    }

    private static func soldProof(_ ticketId: String) -> [FanPassV4.ProofHistoryItem] {
        [
            .init(id: "\(ticketId)_sold", type: .transferred, title: "Resale completed", description: "Ownership transferred after secure resale.", timestamp: date(2026, 6, 5, 12, 30), actorLabel: "FanPass", proofReference: "proof...S44D", status: .success)
        ]
    }

    private static func transferProof(_ ticketId: String) -> [FanPassV4.ProofHistoryItem] {
        [
            .init(id: "\(ticketId)_transfer", type: .transferred, title: "Transfer pending", description: "Ownership transfer is being confirmed.", timestamp: date(2026, 6, 5, 12, 0), actorLabel: "FanPass", proofReference: "proof...T31A", status: .pending)
        ]
    }

    private static func refundProof(_ ticketId: String) -> [FanPassV4.ProofHistoryItem] {
        [
            .init(id: "\(ticketId)_refunded", type: .refunded, title: "Refunded", description: "Payment was returned after organizer action.", timestamp: date(2026, 6, 4, 13, 10), actorLabel: "FanPass", proofReference: "proof...R44D", status: .success)
        ]
    }

    private static func cancelProof(_ ticketId: String) -> [FanPassV4.ProofHistoryItem] {
        [
            .init(id: "\(ticketId)_cancelled", type: .cancelled, title: "Ticket cancelled", description: "This ticket was cancelled by organizer policy.", timestamp: date(2026, 6, 3, 16, 30), actorLabel: "Organizer", proofReference: "proof...X12A", status: .success)
        ]
    }

    private static func redeemedProof(_ ticketId: String) -> [FanPassV4.ProofHistoryItem] {
        [
            .init(id: "\(ticketId)_redeemed", type: .redeemed, title: "Entry accepted", description: "Gate staff accepted this ticket at entry.", timestamp: date(2026, 6, 2, 19, 18), actorLabel: "Gate", proofReference: "proof...G82F", status: .success)
        ]
    }
}
