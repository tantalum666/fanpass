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
    private(set) var remoteRefreshRevision = 0
    private(set) var publicCatalogRefreshRevision = 0
    private(set) var listingStatusOverrides: [String: FanPassV4.TicketStatus] = [:]
    private(set) var activeResaleListingsByTicketId: [String: FanPassV4.ResaleListing] = [:]

    @ObservationIgnored
    private let privyAuthProvider: PrivyAuthProviding
    @ObservationIgnored
    private let sessionStore: FanPassSessionStoring
    @ObservationIgnored
    private var lastPrivySessionRefreshAt: Date?

    init(
        apiClient: FanPassAPIClient = FanPassAPIClient(baseURL: FanPassEnvironment.apiBaseURL),
        privyAuthProvider: PrivyAuthProviding? = nil,
        sessionStore: FanPassSessionStoring? = nil
    ) {
        self.apiClient = apiClient
        self.privyAuthProvider = privyAuthProvider ?? FanPassPrivyAuthProvider()
        self.sessionStore = sessionStore ?? FanPassKeychainSessionStore()
        self.user = .guest
        if let storedSession = self.sessionStore.loadValidSession(now: Date()) {
            apply(session: storedSession, persist: false)
            connectionState = .online
            authMessage = "Signed in."
        }
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
            listingStatusOverrides: listingStatusOverrides,
            activeResaleListingsByTicketId: activeResaleListingsByTicketId
        )
    }

    func scannerService() -> FanPassV4ScannerServicing {
        apiProvider.scannerService()
    }

    func sendUSDCTransfer(quote: FanPassCryptoQuote) async throws -> String {
        try await privyAuthProvider.sendUSDCTransfer(quote: quote)
    }

    func sponsoredPaymentAuthorization(quote: FanPassCryptoQuote, walletId: String) async throws -> FanPassPrivySponsoredAuthorization {
        try await privyAuthProvider.sponsoredPaymentAuthorization(
            quote: quote,
            walletId: walletId
        )
    }

    func runRealtimeSyncLoop() async {
        await restorePrivySessionIfAvailable()
        while !Task.isCancelled {
            if session == nil {
                await restorePrivySessionIfAvailable()
            } else {
                await refreshPrivySessionIfNeeded()
                markRemoteDataRefreshNeeded()
            }

            do {
                try await Task.sleep(nanoseconds: 15_000_000_000)
            } catch {
                return
            }
        }
    }

    func handleAppBecameActive() async {
        if session == nil {
            await restorePrivySessionIfAvailable()
        } else {
            await refreshPrivySessionIfNeeded(force: true)
        }
        requestPublicCatalogRefresh()
    }

    func requestPublicCatalogRefresh() {
        publicCatalogRefreshRevision += 1
    }

    func restorePrivySessionIfAvailable() async {
        guard session == nil, privyAuthProvider.isAvailable else { return }
        do {
            guard let privySession = try await privyAuthProvider.currentLoginResult() else {
                return
            }
            try await syncPrivySession(privySession, message: "Signed in.")
        } catch {
            connectionState = .degraded
        }
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
                authMessage = "Signed in, but account setup could not finish: \(error.localizedDescription)"
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
                authMessage = "Signed in, but account setup could not finish: \(error.localizedDescription)"
            }
        } catch {
            authMessage = "\(provider.title) sign-in failed: \(error.localizedDescription)"
        }
    }

    var ticketRefreshKey: String {
        let listingKey = activeResaleListingsByTicketId
            .values
            .sorted { $0.ticket.id < $1.ticket.id }
            .map { "\($0.ticket.id):\($0.id):\($0.status.rawValue):\($0.price)" }
            .joined(separator: "|")
        let overrideKey = listingStatusOverrides
            .sorted { $0.key < $1.key }
            .map { "\($0.key):\($0.value.rawValue)" }
            .joined(separator: "|")
        return "\(user.id):\(remoteRefreshRevision):\(listingKey):\(overrideKey)"
    }

    var openResaleListings: [FanPassV4.ResaleListing] {
        activeResaleListingsByTicketId
            .values
            .filter { $0.status == .open }
            .sorted {
                if $0.price != $1.price {
                    return $0.price < $1.price
                }
                return $0.createdAt < $1.createdAt
            }
    }

    func openResaleListing(for ticketId: String) -> FanPassV4.ResaleListing? {
        guard let listing = activeResaleListingsByTicketId[ticketId],
              listing.status == .open
        else {
            return nil
        }
        return listing
    }

    func openResaleListings(
        for eventId: String,
        ticketTypeId: String? = nil
    ) -> [FanPassV4.ResaleListing] {
        openResaleListings.filter { listing in
            listing.ticket.event.id == eventId &&
                (ticketTypeId == nil || listing.ticket.ticketType.id == ticketTypeId)
        }
    }

    func effectiveTicket(_ ticket: FanPassV4.Ticket) -> FanPassV4.Ticket {
        guard !ticket.status.isTerminalForLocalOverride else {
            return ticket
        }
        if let listing = openResaleListing(for: ticket.id) {
            var listedTicket = ticket
            listedTicket.status = .listed
            listedTicket.entryMode = .unavailable
            listedTicket.transferCount = listing.ticket.transferCount
            return listedTicket
        }
        guard let override = listingStatusOverrides[ticket.id] else {
            return ticket
        }
        var overriddenTicket = ticket
        overriddenTicket.status = override
        overriddenTicket.entryMode = override.allowsEntryCode ? .nfcReady : .unavailable
        return overriddenTicket
    }

    func recordResaleListing(_ listing: FanPassV4.ResaleListing) {
        var normalizedListing = listing
        normalizedListing.status = .open
        normalizedListing.ticket.status = .listed
        normalizedListing.ticket.entryMode = .unavailable
        activeResaleListingsByTicketId[normalizedListing.ticket.id] = normalizedListing
        listingStatusOverrides[normalizedListing.ticket.id] = .listed
        markRemoteDataRefreshNeeded()
        authMessage = "Listing created. Entry QR is paused."
    }

    func recordCancelledListing(_ listing: FanPassV4.ResaleListing) {
        activeResaleListingsByTicketId.removeValue(forKey: listing.ticket.id)
        listingStatusOverrides[listing.ticket.id] = listing.ticket.status
        markRemoteDataRefreshNeeded()
        authMessage = "Listing cancelled. Entry QR is available again."
    }

    func signOut() async {
        await privyAuthProvider.signOut()
        sessionStore.clear()
        session = nil
        apiClient = apiClient.withAccessToken(nil)
        user = .guest
        listingStatusOverrides = [:]
        activeResaleListingsByTicketId = [:]
        markRemoteDataRefreshNeeded()
        authMessage = "Signed out."
    }

    func markRemoteDataRefreshNeeded() {
        remoteRefreshRevision += 1
    }

    private func apply(session: UserSession, persist: Bool = true) {
        self.session = session
        self.apiClient = apiClient.withAccessToken(session.accessToken)
        self.user = session.fanPassV4User
        if persist {
            sessionStore.save(session)
        }
        markRemoteDataRefreshNeeded()
    }

    private func syncPrivySession(_ privySession: PrivyLoginResult, message: String) async throws {
        let fanPassSession = try await apiClient.syncPrivySession(
            privyAccessToken: privySession.accessToken,
            email: privySession.email,
            walletAddress: privySession.walletAddress,
            walletId: privySession.walletId
        )
        apply(
            session: fanPassSession.withAccessToken(
                fanPassSession.accessToken ?? privySession.accessToken
            )
        )
        connectionState = .online
        authMessage = message
    }

    private func refreshPrivySessionIfNeeded(force: Bool = false) async {
        guard session?.authProvider == "privy",
              privyAuthProvider.isAvailable
        else {
            return
        }

        let now = Date()
        if !force,
           let lastPrivySessionRefreshAt,
           now.timeIntervalSince(lastPrivySessionRefreshAt) < 60,
           !sessionExpiresSoon(now: now)
        {
            return
        }

        do {
            guard let privySession = try await privyAuthProvider.currentLoginResult() else {
                connectionState = .degraded
                authMessage = "Session refresh needed. Sign in again on this device if data stops updating."
                return
            }
            try await syncPrivySession(privySession, message: "Signed in.")
            lastPrivySessionRefreshAt = now
        } catch {
            connectionState = .degraded
        }
    }

    private func sessionExpiresSoon(now: Date) -> Bool {
        guard let expiresAt = session?.expiresAt,
              let expiry = UserSession.parseExpiry(expiresAt)
        else {
            return false
        }
        return expiry.timeIntervalSince(now) < 120
    }
}

private struct FanPassV4SessionTicketService: FanPassV4TicketServicing {
    let base: FanPassV4TicketServicing
    let listingStatusOverrides: [String: FanPassV4.TicketStatus]
    let activeResaleListingsByTicketId: [String: FanPassV4.ResaleListing]

    func walletTickets(for user: FanPassV4.User, statusOverride: FanPassV4.TicketStatus?) async throws -> [FanPassV4.Ticket] {
        let remoteTickets = try await base.walletTickets(for: user, statusOverride: statusOverride)
        return remoteTickets.map(applyingLocalListingState)
    }

    func ticket(id: String) async throws -> FanPassV4.Ticket? {
        if let remote = try await base.ticket(id: id) {
            return applyingLocalListingState(remote)
        }
        return activeResaleListingsByTicketId[id]?.ticket
    }

    func proofHistory(for ticket: FanPassV4.Ticket) async throws -> [FanPassV4.ProofHistoryItem] {
        return try await base.proofHistory(for: ticket)
    }

    func chainProof(for ticket: FanPassV4.Ticket) async throws -> FanPassChainProofResponse {
        return try await base.chainProof(for: ticket)
    }

    func listForResale(ticket: FanPassV4.Ticket, price: Int) async throws -> FanPassV4.ResaleListing {
        try await base.listForResale(ticket: ticket, price: price)
    }

    func cancelListing(_ listing: FanPassV4.ResaleListing) async throws -> FanPassV4.ResaleListing {
        try await base.cancelListing(listing)
    }

    private func applyingLocalListingState(_ ticket: FanPassV4.Ticket) -> FanPassV4.Ticket {
        guard !ticket.status.isTerminalForLocalOverride else {
            return ticket
        }
        if let listing = activeResaleListingsByTicketId[ticket.id], listing.status == .open {
            var listedTicket = ticket
            listedTicket.status = .listed
            listedTicket.entryMode = .unavailable
            listedTicket.transferCount = listing.ticket.transferCount
            return listedTicket
        }
        guard let override = listingStatusOverrides[ticket.id] else {
            return ticket
        }
        var overriddenTicket = ticket
        overriddenTicket.status = override
        overriddenTicket.entryMode = override.allowsEntryCode ? .nfcReady : .unavailable
        return overriddenTicket
    }
}

private extension FanPassV4.TicketStatus {
    var isTerminalForLocalOverride: Bool {
        switch self {
        case .redeemed, .cancelled, .refunded, .expired:
            true
        case .active, .listed, .transferPending, .transferred:
            false
        }
    }
}

enum BackendConnectionState: String {
    case online
    case degraded
    case offline

    var title: String {
        switch self {
        case .online: "Connected"
        case .degraded: "Limited connection"
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
            accessBadges: []
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
