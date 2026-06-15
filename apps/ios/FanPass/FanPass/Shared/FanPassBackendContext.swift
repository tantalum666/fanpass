import Foundation
import Observation

@MainActor
@Observable
final class FanPassBackendContext {
    var apiClient: FanPassAPIClient
    var session: UserSession?
    var user: FanPassV4.User
    var connectionState: BackendConnectionState = .offline
    var authMessage: String?
    var pendingCheckoutTickets: [FanPassV4.Ticket] = []

    @ObservationIgnored
    private let privyAuthProvider: PrivyAuthProviding

    init(
        apiClient: FanPassAPIClient = FanPassAPIClient(baseURL: FanPassEnvironment.apiBaseURL),
        privyAuthProvider: PrivyAuthProviding? = nil
    ) {
        self.apiClient = apiClient
        self.privyAuthProvider = privyAuthProvider ?? FanPassPrivyAuthProvider()
        self.user = FanPassMockData.guestFan
    }

    var isAuthenticated: Bool {
        session != nil
    }

    var isPrivyAvailable: Bool {
        privyAuthProvider.isAvailable
    }

    var apiProvider: FanPassV4APIDataProvider {
        FanPassV4APIDataProvider(apiClient: apiClient)
    }

    func eventService() -> FanPassV4EventServicing {
        apiProvider.eventService()
    }

    func ticketService() -> FanPassV4TicketServicing {
        FanPassV4SessionTicketService(
            base: apiProvider.ticketService(),
            pendingTickets: pendingCheckoutTickets
        )
    }

    func scannerService() -> FanPassV4ScannerServicing {
        apiProvider.scannerService()
    }

    func bootstrapDemoSessionIfAvailable() async {
        #if DEBUG
        guard session == nil else { return }
        do {
            let demoSession = try await apiClient.demoSession(userId: UserSession.demoFan.userId)
            apply(session: demoSession)
            connectionState = .online
            authMessage = "Connected to FanPass."
        } catch {
            connectionState = .degraded
            authMessage = "Some account services are unavailable. Showing cached event data."
        }
        #endif
    }

    func sendPrivyEmailCode(to email: String) async {
        do {
            try await privyAuthProvider.sendEmailCode(to: email)
            authMessage = "Code sent to \(email)."
        } catch {
            authMessage = error.localizedDescription
        }
    }

    func loginWithPrivyEmailCode(email: String, code: String) async {
        do {
            let privySession = try await privyAuthProvider.loginWithEmailCode(code, sentTo: email)
            do {
                try await syncPrivySession(privySession, message: "Signed in with email code.")
            } catch {
                authMessage = "Sign-in verified, but account sync failed: \(error.localizedDescription)"
            }
        } catch {
            authMessage = "Sign-in failed: \(error.localizedDescription)"
        }
    }

    func loginWithPrivyOAuth(_ provider: PrivyOAuthLoginProvider) async {
        do {
            let privySession = try await privyAuthProvider.loginWithOAuth(provider)
            do {
                try await syncPrivySession(privySession, message: "Signed in with \(provider.title).")
            } catch {
                authMessage = "Sign-in verified, but account sync failed: \(error.localizedDescription)"
            }
        } catch {
            authMessage = "\(provider.title) sign-in failed: \(error.localizedDescription)"
        }
    }

    func signInForLocalReview(as scenario: FanPassV4.DemoUserScenario = .purchasedTicketFan) {
        let reviewUser = FanPassMockData.user(for: scenario)
        let reviewSession = UserSession(
            userId: reviewUser.id,
            displayName: reviewUser.displayName,
            email: reviewUser.email,
            role: reviewUser.role.apiRole,
            walletAddress: reviewUser.walletReference?.addressFragment,
            accessToken: "local-review-token",
            expiresAt: nil
        )
        apply(session: reviewSession)
        user = reviewUser
        connectionState = .degraded
        authMessage = "Signed in."
    }

    var ticketRefreshKey: String {
        let pendingKey = pendingCheckoutTickets
            .map { "\($0.id):\($0.status.rawValue)" }
            .joined(separator: "|")
        return "\(user.id):\(pendingKey)"
    }

    func recordCheckoutTicket(_ ticket: FanPassV4.Ticket) {
        pendingCheckoutTickets.removeAll {
            $0.id == ticket.id ||
                ($0.ownerId == ticket.ownerId &&
                 $0.event.id == ticket.event.id &&
                 $0.ticketType.id == ticket.ticketType.id)
        }
        pendingCheckoutTickets.insert(ticket, at: 0)
        authMessage = "Ticket added to Tickets."
    }

    func signOut() async {
        await privyAuthProvider.signOut()
        session = nil
        apiClient = apiClient.withAccessToken(nil)
        user = FanPassMockData.guestFan
        pendingCheckoutTickets = []
        authMessage = "Signed out."
    }

    private func apply(session: UserSession) {
        self.session = session
        self.apiClient = apiClient.withAccessToken(session.accessToken)
        self.user = session.fanPassV4User
    }

    private func syncPrivySession(_ privySession: PrivyLoginResult, message: String) async throws {
        let fanPassSession = try await apiClient.syncPrivySession(
            privyAccessToken: privySession.accessToken,
            email: privySession.email,
            walletAddress: privySession.walletAddress
        )
        apply(
            session: fanPassSession.withAccessToken(
                fanPassSession.accessToken ?? privySession.accessToken
            )
        )
        connectionState = .online
        authMessage = message
    }
}

private struct FanPassV4SessionTicketService: FanPassV4TicketServicing {
    let base: FanPassV4TicketServicing
    let pendingTickets: [FanPassV4.Ticket]

    func walletTickets(for user: FanPassV4.User, statusOverride: FanPassV4.TicketStatus?) async -> [FanPassV4.Ticket] {
        let remoteTickets = await base.walletTickets(for: user, statusOverride: statusOverride)
        let visiblePending = pendingTickets.filter { pending in
            pending.ownerId == user.id &&
                !remoteTickets.contains { remote in
                    remote.id == pending.id ||
                        (remote.event.id == pending.event.id &&
                         remote.ticketType.id == pending.ticketType.id &&
                         remote.ownerId == pending.ownerId)
                }
        }
        return visiblePending + remoteTickets
    }

    func ticket(id: String) async -> FanPassV4.Ticket? {
        if let pending = pendingTickets.first(where: { $0.id == id }) {
            return pending
        }
        return await base.ticket(id: id)
    }

    func proofHistory(for ticket: FanPassV4.Ticket) async throws -> [FanPassV4.ProofHistoryItem] {
        if pendingTickets.contains(where: { $0.id == ticket.id }) {
            return ticket.proofHistory
        }
        return try await base.proofHistory(for: ticket)
    }

    func chainProof(for ticket: FanPassV4.Ticket) async throws -> FanPassChainProofResponse {
        if pendingTickets.contains(where: { $0.id == ticket.id }) {
            throw FanPassV4MockError.networkUnavailable
        }
        return try await base.chainProof(for: ticket)
    }

    func purchaseTicket(event: FanPassV4.Event, ticketType: FanPassV4.TicketType, owner: FanPassV4.User) async -> FanPassV4.Ticket {
        await base.purchaseTicket(event: event, ticketType: ticketType, owner: owner)
    }

    func addToWallet(ticket: FanPassV4.Ticket) async -> FanPassV4.Ticket {
        await base.addToWallet(ticket: ticket)
    }

    func listForResale(ticket: FanPassV4.Ticket, price: Int) async throws -> FanPassV4.ResaleListing {
        try await base.listForResale(ticket: ticket, price: price)
    }

    func cancelListing(_ listing: FanPassV4.ResaleListing) async -> FanPassV4.ResaleListing {
        await base.cancelListing(listing)
    }

    func transfer(ticket: FanPassV4.Ticket) async throws -> FanPassV4.Ticket {
        try await base.transfer(ticket: ticket)
    }
}

private extension FanPassV4.UserRole {
    var apiRole: String {
        switch self {
        case .guest: "GUEST"
        case .fan: "FAN"
        case .gateStaff: "GATE_STAFF"
        case .organizer: "ORGANIZER"
        case .admin: "ADMIN"
        }
    }
}

enum BackendConnectionState: String {
    case online
    case degraded
    case offline

    var title: String {
        switch self {
        case .online: "API online"
        case .degraded: "Local fallback"
        case .offline: "Offline"
        }
    }
}

private extension UserSession {
    var fanPassV4User: FanPassV4.User {
        FanPassV4.User(
            id: userId,
            displayName: displayName,
            email: email,
            role: fanPassRole,
            scenario: .purchasedTicketFan,
            walletReference: walletAddress.map {
                FanPassV4.WalletReference(
                    addressFragment: Self.maskedWalletReference($0),
                    provider: "Embedded wallet",
                    status: "Ticket identity ready",
                    lastSyncedAt: Date()
                )
            },
            accessBadges: FanPassMockData.currentUser.accessBadges
        )
    }

    var fanPassRole: FanPassV4.UserRole {
        switch role.uppercased() {
        case "GATE_STAFF": .gateStaff
        case "ORGANIZER": .organizer
        case "ADMIN": .admin
        case "GUEST": .guest
        default: .fan
        }
    }

    static func maskedWalletReference(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > 10 else { return "FP identity linked" }
        return "FP-\(trimmed.prefix(4))...\(trimmed.suffix(4))"
    }
}
