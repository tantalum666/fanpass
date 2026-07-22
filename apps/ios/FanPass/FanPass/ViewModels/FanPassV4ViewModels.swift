import Foundation
import Observation

enum FanPassV4Tab: String, CaseIterable, Identifiable {
    case home
    case explore
    case market
    case tickets
    case profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Home"
        case .explore: "Explore"
        case .market: "Market"
        case .tickets: "Tickets"
        case .profile: "Account"
        }
    }

    var systemImage: String {
        switch self {
        case .home: FPIcons.home
        case .explore: FPIcons.explore
        case .market: FPIcons.market
        case .tickets: FPIcons.tickets
        case .profile: FPIcons.profile
        }
    }
}

enum FanPassV4Stage {
    case splash
    case onboarding
    case login
    case main
}

enum FanPassAccountSection: String, CaseIterable, Hashable {
    case overview
    case profile
    case orders
    case alerts
    case security
    case wallet

    var title: String {
        switch self {
        case .overview: "Overview"
        case .profile: "Profile"
        case .orders: "Orders"
        case .alerts: "Alerts"
        case .security: "Security"
        case .wallet: "Wallet"
        }
    }
}

@MainActor
@Observable
final class FanPassRootViewModel {
    var stage: FanPassV4Stage = .main
    var selectedTab: FanPassV4Tab = .home
    var accountSection: FanPassAccountSection = .overview
    var focusedMarketEvent: FanPassV4.Event?
    var selectedTabID: String = FanPassV4Tab.home.id {
        didSet {
            selectedTab = FanPassV4Tab(rawValue: selectedTabID) ?? .home
        }
    }

    var tabItems: [FPTabItem] {
        FanPassV4Tab.allCases.map {
            FPTabItem(id: $0.id, title: $0.title, systemImage: $0.systemImage)
        }
    }

    func finishSplash() {
        stage = .onboarding
    }

    func finishOnboarding() {
        stage = .main
    }

    func browseEvents() {
        stage = .main
        selectedTab = .home
        selectedTabID = FanPassV4Tab.home.id
    }

    func openPrivySignIn() {
        stage = .main
        accountSection = .security
        selectedTab = .profile
        selectedTabID = FanPassV4Tab.profile.id
    }

    func openTickets() {
        stage = .main
        selectedTab = .tickets
        selectedTabID = FanPassV4Tab.tickets.id
    }

    func openMarket(for event: FanPassV4.Event) {
        stage = .main
        focusedMarketEvent = event
        selectedTab = .market
        selectedTabID = FanPassV4Tab.market.id
    }
}

@MainActor
@Observable
final class HomeViewModel {
    var user: FanPassV4.User = .guest
    var featuredEvents: [FanPassV4.Event] = []
    var nextTicket: FanPassV4.Ticket?
    var accessBadge: FanPassV4.AccessBadge?
    var isLoading = false
    var sourceMessage: String?
    var isUsingSavedEvents = false
    var catalogUpdatedAt: Date?

    func load(
        user: FanPassV4.User,
        isAuthenticated: Bool,
        eventService: FanPassV4EventServicing,
        ticketService: FanPassV4TicketServicing
    ) async {
        isLoading = true
        defer { isLoading = false }
        self.user = user
        do {
            let catalog = try await eventService.featuredEventSnapshot(network: .online)
            featuredEvents = catalog.events
            catalogUpdatedAt = catalog.updatedAt
            isUsingSavedEvents = catalog.source == .saved
            sourceMessage = isUsingSavedEvents
                ? "Showing saved events. FanPass will update automatically when the connection returns."
                : nil
        } catch is CancellationError {
            return
        } catch {
            isUsingSavedEvents = !featuredEvents.isEmpty
            sourceMessage = featuredEvents.isEmpty
                ? "Events could not load. Check your connection and try again."
                : "Events could not refresh. Showing the last loaded catalog."
        }
        if isAuthenticated {
            do {
                let walletTickets = try await ticketService.walletTickets(for: user, statusOverride: nil)
                nextTicket = walletTickets.first { $0.status == .active }
            } catch {
                nextTicket = nil
                if sourceMessage == nil {
                    sourceMessage = "Your tickets could not refresh. Try again shortly."
                }
            }
        } else {
            nextTicket = nil
        }
        accessBadge = isAuthenticated ? user.accessBadges.first : nil
    }
}

@MainActor
@Observable
final class ExploreViewModel {
    var events: [FanPassV4.Event] = []
    var selectedEvent: FanPassV4.Event?
    var isLoading = false
    var errorMessage: String?
    var isUsingSavedEvents = false
    var catalogUpdatedAt: Date?
    func load(
        eventService: FanPassV4EventServicing,
        network: FanPassV4.DemoNetworkCondition = .online
    ) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let catalog = try await eventService.featuredEventSnapshot(network: network)
            events = catalog.events
            selectedEvent = events.first
            catalogUpdatedAt = catalog.updatedAt
            isUsingSavedEvents = catalog.source == .saved
            errorMessage = isUsingSavedEvents
                ? "Showing saved events while FanPass reconnects."
                : nil
        } catch is CancellationError {
            return
        } catch {
            errorMessage = events.isEmpty
                ? "Connection unavailable. Events could not refresh."
                : "Events could not refresh. Showing the last loaded catalog."
        }
    }
}

@MainActor
@Observable
final class EventDetailViewModel {
    var event: FanPassV4.Event
    var selectedTicketType: FanPassV4.TicketType

    var purchasableTicketTypes: [FanPassV4.TicketType] {
        event.ticketTypes.isEmpty ? [event.safePrimaryTicketType] : event.ticketTypes
    }

    init(event: FanPassV4.Event) {
        self.event = event
        self.selectedTicketType = event.safePrimaryTicketType
    }
}

@MainActor
@Observable
final class CheckoutViewModel {
    var event: FanPassV4.Event
    var ticketType: FanPassV4.TicketType
    var quotedPrice: Int
    var priceLineTitle: String
    let fulfillmentMode: FanPassOrderFulfillmentMode
    var paymentState: FanPassV4.PaymentState = .idle
    var errorMessage: String?

    init(
        event: FanPassV4.Event,
        ticketType: FanPassV4.TicketType,
        quotedPrice: Int? = nil,
        priceLineTitle: String = "Face value",
        fulfillmentMode: FanPassOrderFulfillmentMode = .primaryOnly
    ) {
        self.event = event
        self.ticketType = ticketType
        self.quotedPrice = quotedPrice ?? ticketType.faceValue
        self.priceLineTitle = priceLineTitle
        self.fulfillmentMode = fulfillmentMode
    }

    var ticketPriceLabel: String {
        MoneyFormatter.format(quotedPrice, currency: ticketType.currency)
    }

    var totalLabel: String {
        MoneyFormatter.format(totalAmount, currency: ticketType.currency)
    }

    var totalAmount: Int {
        quotedPrice
    }

    func resetPayment() {
        paymentState = .idle
        errorMessage = nil
    }

    func prepareBackendPayment(
        apiClient: FanPassAPIClient,
        owner: FanPassV4.User,
        checkoutAttemptId: String
    ) async -> FanPassPaymentIntent? {
        paymentState = .authorizing
        errorMessage = nil
        do {
            let order = try await apiClient.createOrder(
                userId: owner.id,
                eventId: event.id,
                ticketTypeId: ticketType.id,
                side: "BUY",
                fulfillmentMode: fulfillmentMode,
                price: quotedPrice,
                idempotencyKey: "ios-v4-order-\(checkoutAttemptId)"
            )
            let payment = try await apiClient.createPaymentIntent(
                orderId: order.order.id,
                idempotencyKey: "ios-v4-payment-\(checkoutAttemptId)"
            )
            guard let clientSecret = payment.clientSecret,
                  !clientSecret.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else {
                paymentState = .failed
                errorMessage = "Payment authorization could not be prepared."
                return nil
            }
            guard !clientSecret.hasPrefix("pi_mock"),
                  !clientSecret.lowercased().contains("_mock")
            else {
                paymentState = .failed
                errorMessage = "Payment provider is not available right now."
                return nil
            }
            return payment
        } catch {
            paymentState = .failed
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func prepareCryptoQuote(
        apiClient: FanPassAPIClient,
        owner: FanPassV4.User,
        checkoutAttemptId: String
    ) async throws -> FanPassCryptoQuoteResponse {
        paymentState = .authorizing
        errorMessage = nil
        let order = try await apiClient.createOrder(
            userId: owner.id,
            eventId: event.id,
            ticketTypeId: ticketType.id,
            side: "BUY",
            fulfillmentMode: fulfillmentMode,
            price: quotedPrice,
            idempotencyKey: "ios-v4-crypto-order-\(checkoutAttemptId)"
        )
        return try await apiClient.createCryptoQuote(
            orderId: order.order.id,
            idempotencyKey: "ios-v4-crypto-payment-\(checkoutAttemptId)"
        )
    }

    @discardableResult
    func applyCryptoConfirmation(_ response: FanPassCryptoConfirmationResponse) -> Bool {
        if response.compensationRequired == true || !response.ok {
            paymentState = .failed
            errorMessage = "Your USDC transfer needs review. No ticket was issued while FanPass reconciles the payment."
            return false
        }
        if response.isTicketSettlementConfirmed {
            paymentState = .authorized
            errorMessage = "USDC transfer confirmed. Ticket assignment is syncing."
            return true
        } else {
            paymentState = .authorizing
            errorMessage = "USDC transfer submitted. Waiting for chain confirmation."
            return false
        }
    }

    func applyStripeResult(_ result: FanPassStripeCheckoutResult) {
        switch result {
        case .completed:
            paymentState = .authorized
            errorMessage = "Payment authorization completed. Ticket assignment is syncing."
        case .canceled:
            paymentState = .cancelled
            errorMessage = "Payment authorization was cancelled."
        case let .failed(message):
            paymentState = .failed
            errorMessage = message
        }
    }

}

@MainActor
@Observable
final class FanAccessViewModel {
    var event: FanPassV4.Event
    var campaign: FanCampaign?
    var score: FanScore?
    var pendingTaskIDs: Set<String> = []
    var isLoading = false
    var errorMessage: String?

    init(event: FanPassV4.Event) {
        self.event = event
    }

    var tasks: [FanTask] {
        campaign?.tasks.sorted {
            ($0.sortOrder ?? 0, $0.id) < ($1.sortOrder ?? 0, $1.id)
        } ?? []
    }

    var approvedPoints: Int {
        score?.fanScore ?? score?.score ?? 0
    }

    var qualificationPoints: Int {
        campaign?.qualificationPoints ?? score?.qualificationPoints ?? 0
    }

    var pointsToQualify: Int {
        score?.pointsToQualify ?? max(0, qualificationPoints - approvedPoints)
    }

    var progress: Double {
        guard qualificationPoints > 0 else { return 0 }
        return min(1, Double(approvedPoints) / Double(qualificationPoints))
    }

    func isCompleted(_ task: FanTask) -> Bool {
        score?.completedTaskIds?.contains(task.id) == true
    }

    func load(apiClient: FanPassAPIClient, userID: String?) async {
        isLoading = true
        defer { isLoading = false }
        do {
            campaign = try await apiClient.fanCampaign(eventId: event.id)
            if let userID {
                score = try? await apiClient.fanScore(
                    eventId: event.id,
                    userId: userID
                )
            } else {
                score = nil
            }
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            errorMessage = "Fan Access is temporarily unavailable. Pull to refresh or try again later."
        }
    }

    func submit(
        task: FanTask,
        proof: String?,
        apiClient: FanPassAPIClient,
        userID: String
    ) async -> Bool {
        do {
            let submission = try await apiClient.submitFanTask(
                taskId: task.id,
                proof: proof
            )
            if submission.status == "PENDING" {
                pendingTaskIDs.insert(task.id)
            }
            score = try? await apiClient.fanScore(
                eventId: event.id,
                userId: userID
            )
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}

@MainActor
@Observable
final class TicketsViewModel {
    var tickets: [FanPassV4.Ticket] = []
    var selectedTicket: FanPassV4.Ticket?
    var isLoading = false
    var errorMessage: String?
    func load(
        user: FanPassV4.User,
        statusOverride: FanPassV4.TicketStatus? = nil,
        ticketService: FanPassV4TicketServicing
    ) async {
        isLoading = true
        defer { isLoading = false }
        do {
            tickets = try await ticketService.walletTickets(for: user, statusOverride: statusOverride)
            selectedTicket = tickets.first
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            errorMessage = "Tickets could not refresh. Check your connection and try again."
        }
    }

    var upcoming: [FanPassV4.Ticket] {
        tickets.filter { [.active, .transferPending].contains($0.status) }
    }

    var listed: [FanPassV4.Ticket] {
        tickets.filter { $0.status == .listed }
    }

    var past: [FanPassV4.Ticket] {
        tickets.filter { [.redeemed, .refunded, .cancelled, .expired, .transferred].contains($0.status) }
    }
}

@MainActor
@Observable
final class MarketViewModel {
    var availableEvents: [FanPassV4.Event] = []
    var listings: [FanPassV4.ResaleListing] = []
    var trades: [FanPassV4.Trade] = []
    var selectedEvent: FanPassV4.Event? {
        didSet {
            loadSelectedEventData()
        }
    }
    var isLoading = false
    var errorMessage: String?
    var isUsingSavedEvents = false
    var catalogUpdatedAt: Date?

    func load(eventService: FanPassV4EventServicing) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let catalog = try await eventService.featuredEventSnapshot(network: .online)
            let events = catalog.events
            availableEvents = events
            catalogUpdatedAt = catalog.updatedAt
            isUsingSavedEvents = catalog.source == .saved
            errorMessage = isUsingSavedEvents
                ? "Showing saved market events while FanPass reconnects."
                : nil
            guard !events.isEmpty else { return }
            if let selectedEvent,
               let matchingEvent = events.first(where: { $0.id == selectedEvent.id }) {
                self.selectedEvent = matchingEvent
            } else if let firstEvent = events.first {
                self.selectedEvent = firstEvent
            }
        } catch is CancellationError {
            return
        } catch {
            isUsingSavedEvents = !availableEvents.isEmpty
            errorMessage = availableEvents.isEmpty
                ? "Market events could not load. Check your connection and try again."
                : "Market events could not refresh. Showing the last loaded catalog."
        }
    }

    func loadSelectedEventData() {
        listings = []
        trades = []
    }
}

@MainActor
@Observable
final class ProfileViewModel {
    var user: FanPassV4.User

    init(user: FanPassV4.User) {
        self.user = user
    }
}
