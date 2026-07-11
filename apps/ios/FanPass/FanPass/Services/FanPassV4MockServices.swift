import Foundation

enum FanPassV4MockError: Error, Hashable {
    case networkUnavailable
    case paymentFailed
    case checkoutExpired
    case ticketNotTransferable
    case resaleCapExceeded
    case invalidCredential

    var title: String {
        switch self {
        case .networkUnavailable: "Network unavailable"
        case .paymentFailed: "Payment failed"
        case .checkoutExpired: "Checkout expired"
        case .ticketNotTransferable: "Ticket not transferable"
        case .resaleCapExceeded: "Listing price above resale cap"
        case .invalidCredential: "Invalid credential"
        }
    }
}

protocol FanPassV4EventServicing {
    func featuredEvents(network: FanPassV4.DemoNetworkCondition) async throws -> [FanPassV4.Event]
    func event(id: String) async -> FanPassV4.Event?
}

protocol FanPassV4TicketServicing {
    func walletTickets(for user: FanPassV4.User, statusOverride: FanPassV4.TicketStatus?) async throws -> [FanPassV4.Ticket]
    func ticket(id: String) async throws -> FanPassV4.Ticket?
    func proofHistory(for ticket: FanPassV4.Ticket) async throws -> [FanPassV4.ProofHistoryItem]
    func chainProof(for ticket: FanPassV4.Ticket) async throws -> FanPassChainProofResponse
    func listForResale(ticket: FanPassV4.Ticket, price: Int) async throws -> FanPassV4.ResaleListing
    func cancelListing(_ listing: FanPassV4.ResaleListing) async throws -> FanPassV4.ResaleListing
}

protocol FanPassV4ScannerServicing {
    func scan(result: FanPassV4.ScanResult, event: FanPassV4.Event, gate: String) async -> FanPassV4.CheckInResult
    func refreshQRCredential(ticket: FanPassV4.Ticket) async throws -> String
    func nfcResult(state: FanPassV4.NFCScanState, event: FanPassV4.Event, gate: String) async -> FanPassV4.CheckInResult
}

protocol MockAuthServicing {
    func currentUser(scenario: FanPassV4.DemoUserScenario) async -> FanPassV4.User
    func signIn(scenario: FanPassV4.DemoUserScenario) async -> FanPassV4.User
    func signOut() async
}

struct MockAuthService: MockAuthServicing {
    func currentUser(scenario: FanPassV4.DemoUserScenario = .purchasedTicketFan) async -> FanPassV4.User {
        FanPassMockData.user(for: scenario)
    }

    func signIn(scenario: FanPassV4.DemoUserScenario) async -> FanPassV4.User {
        FanPassMockData.user(for: scenario)
    }

    func signOut() async {}
}

struct MockEventService: FanPassV4EventServicing {
    func featuredEvents(network: FanPassV4.DemoNetworkCondition = .online) async throws -> [FanPassV4.Event] {
        try validate(network)
        return FanPassMockData.events
    }

    func event(id: String) async -> FanPassV4.Event? {
        FanPassMockData.events.first { $0.id == id }
    }

    private func validate(_ network: FanPassV4.DemoNetworkCondition) throws {
        if network == .unavailable {
            throw FanPassV4MockError.networkUnavailable
        }
    }
}

struct MockTicketService: FanPassV4TicketServicing {
    func walletTickets(for user: FanPassV4.User, statusOverride: FanPassV4.TicketStatus? = nil) async -> [FanPassV4.Ticket] {
        let base = FanPassMockData.tickets(for: user)
        guard let statusOverride, var first = base.first else { return base }
        first.status = statusOverride
        first.entryMode = statusOverride == .active ? first.entryMode : .unavailable
        return [first] + base.dropFirst()
    }

    func ticket(id: String) async -> FanPassV4.Ticket? {
        FanPassMockData.tickets.first { $0.id == id }
    }

    func proofHistory(for ticket: FanPassV4.Ticket) async throws -> [FanPassV4.ProofHistoryItem] {
        ticket.proofHistory
    }

    func chainProof(for ticket: FanPassV4.Ticket) async throws -> FanPassChainProofResponse {
        throw FanPassV4MockError.networkUnavailable
    }

    func listForResale(ticket: FanPassV4.Ticket, price: Int) async throws -> FanPassV4.ResaleListing {
        guard ticket.ticketType.transferRule.transferable, ticket.status.allowsResale else {
            throw FanPassV4MockError.ticketNotTransferable
        }
        if let cap = ticket.ticketType.transferRule.resaleCap, price > cap {
            throw FanPassV4MockError.resaleCapExceeded
        }
        var listedTicket = ticket
        listedTicket.status = .listed
        return FanPassV4.ResaleListing(
            id: "listing_\(ticket.shortId)",
            ticket: listedTicket,
            sellerDisplay: "Verified fan",
            price: price,
            currency: ticket.ticketType.currency,
            feeEstimate: Int((Double(price) * 0.03).rounded()),
            status: .open,
            createdAt: Date()
        )
    }

    func cancelListing(_ listing: FanPassV4.ResaleListing) async throws -> FanPassV4.ResaleListing {
        var cancelled = listing
        cancelled.status = .cancelled
        cancelled.ticket.status = .active
        cancelled.ticket.entryMode = .nfcReady
        return cancelled
    }

}

struct MockMarketService {
    func listings(for event: FanPassV4.Event? = nil) async -> [FanPassV4.ResaleListing] {
        guard let event else { return FanPassMockData.listings }
        return FanPassMockData.listings.filter { $0.ticket.event.id == event.id }
    }

    func orderbook(for event: FanPassV4.Event) async -> [FanPassV4.OrderbookOrder] {
        FanPassMockData.orderbook(for: event)
    }

    func recentTrades(for event: FanPassV4.Event) async -> [FanPassV4.Trade] {
        FanPassMockData.trades(for: event)
    }

    func buyResaleTicket(listing: FanPassV4.ResaleListing, buyer: FanPassV4.User) async -> FanPassV4.Ticket {
        var ticket = listing.ticket
        ticket.ownerId = buyer.id
        ticket.status = .active
        ticket.transferCount += 1
        return ticket
    }
}

struct MockScannerService: FanPassV4ScannerServicing {
    func scan(result: FanPassV4.ScanResult, event: FanPassV4.Event, gate: String) async -> FanPassV4.CheckInResult {
        if let canned = FanPassMockData.scanResults.first(where: { $0.result == result }) {
            return canned
        }
        return FanPassV4.CheckInResult(
            id: "scan_\(result.rawValue)",
            ticketFragment: "DEMO-VERIFY",
            eventTitle: event.title,
            gate: gate,
            result: result,
            checkedAt: Date(),
            reason: result.title
        )
    }

    func refreshQRCredential(ticket: FanPassV4.Ticket) async throws -> String {
        guard ticket.status.allowsEntryCode else {
            throw FanPassV4MockError.invalidCredential
        }
        let formatter = ISO8601DateFormatter()
        let issuedAt = Date()
        let payload = QRPayload(
            v: 1,
            credentialId: "local-\(UUID().uuidString)",
            ticketId: ticket.id,
            eventId: ticket.event.id,
            ticketTypeId: ticket.ticketType.id,
            ownerIdHash: "local-review-\(abs(ticket.ownerId.hashValue))",
            nonce: UUID().uuidString,
            issuedAt: formatter.string(from: issuedAt),
            expiresAt: formatter.string(from: issuedAt.addingTimeInterval(30)),
            entryMode: "QR",
            kid: "local-review",
            signature: "local-review-signature"
        )
        let data = try JSONEncoder().encode(payload)
        return String(decoding: data, as: UTF8.self)
    }

    func nfcResult(state: FanPassV4.NFCScanState, event: FanPassV4.Event, gate: String) async -> FanPassV4.CheckInResult {
        switch state {
        case .valid:
            return await scan(result: .accepted, event: event, gate: gate)
        case .alreadyRedeemed:
            return await scan(result: .duplicate, event: event, gate: gate)
        case .invalid, .unreadable:
            return await scan(result: .invalid, event: event, gate: gate)
        case .expired:
            return await scan(result: .expired, event: event, gate: gate)
        case .ready, .scanning:
            return await scan(result: .error, event: event, gate: gate)
        }
    }
}

struct MockFanAccessService {
    func completeTask(_ task: FanPassV4.FanTask) async -> FanPassV4.FanTask {
        var completed = task
        completed.status = .approved
        return completed
    }

    func earnBadge(for event: FanPassV4.Event) async -> FanPassV4.AccessBadge {
        FanPassV4.AccessBadge(
            id: "badge_\(event.id)",
            title: "Access Badge",
            criteria: "Completed Fan Access tasks for \(event.title).",
            benefit: "Organizer-defined access benefit.",
            status: .earned
        )
    }
}

struct MockWalletService {
    func walletReference(for user: FanPassV4.User) async -> FanPassV4.WalletReference? {
        user.walletReference
    }

    func proofHistory(for ticket: FanPassV4.Ticket) async -> [FanPassV4.ProofHistoryItem] {
        ticket.proofHistory
    }

    func addTicketToWallet(_ ticket: FanPassV4.Ticket) async -> FanPassV4.Ticket {
        ticket
    }
}
