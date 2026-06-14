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

    var user: FanPassV4.User = FanPassMockData.currentUser
    var controls = FanPassV4.PrototypeControlState()
    private let authService = MockAuthService()

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

    func signInForDemo() {
        user = FanPassMockData.user(for: controls.userScenario)
        stage = .main
    }

    func continueAsDemoStaff() {
        user = FanPassMockData.staffUser
        controls.userScenario = .gateStaff
        stage = .main
        selectedTab = .profile
        selectedTabID = FanPassV4Tab.profile.id
    }

    func switchScenario(_ scenario: FanPassV4.DemoUserScenario) {
        controls.userScenario = scenario
        user = FanPassMockData.user(for: scenario)
        selectedTab = scenario == .gateStaff || scenario == .organizerLite ? .profile : selectedTab
        selectedTabID = selectedTab.id
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
    var user: FanPassV4.User = FanPassMockData.currentUser
    var featuredEvents: [FanPassV4.Event] = FanPassMockData.events
    var nextTicket: FanPassV4.Ticket? = FanPassMockData.tickets.first
    var accessBadge: FanPassV4.AccessBadge? = FanPassMockData.currentUser.accessBadges.first
    var sourceMessage: String?

    func load(
        user: FanPassV4.User = FanPassMockData.currentUser,
        eventService: FanPassV4EventServicing = MockEventService(),
        ticketService: FanPassV4TicketServicing = MockTicketService()
    ) async {
        self.user = user
        let loadedEvents: [FanPassV4.Event]
        do {
            loadedEvents = try await eventService.featuredEvents(network: .online)
            sourceMessage = nil
        } catch {
            loadedEvents = FanPassMockData.events
            sourceMessage = "Some services are unavailable. Showing cached event data."
        }
        self.featuredEvents = loadedEvents.isEmpty ? FanPassMockData.events : loadedEvents
        let walletTickets = await ticketService.walletTickets(for: user, statusOverride: nil)
        self.nextTicket = walletTickets.first { $0.status == .active }
        self.accessBadge = user.accessBadges.first
    }
}

@MainActor
@Observable
final class ExploreViewModel {
    var events: [FanPassV4.Event] = FanPassMockData.events
    var selectedEvent: FanPassV4.Event? = FanPassMockData.events.first
    var isLoading = false
    var errorMessage: String?
    private let eventService: FanPassV4EventServicing

    init(eventService: FanPassV4EventServicing = MockEventService()) {
        self.eventService = eventService
    }

    func load(
        eventService overrideService: FanPassV4EventServicing? = nil,
        network: FanPassV4.DemoNetworkCondition = .online
    ) async {
        isLoading = true
        defer { isLoading = false }
        do {
            events = try await (overrideService ?? eventService).featuredEvents(network: network)
            selectedEvent = events.first ?? selectedEvent
            errorMessage = nil
        } catch {
            errorMessage = "Connection unavailable. Events could not refresh."
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

    init(event: FanPassV4.Event = FanPassMockData.events[0]) {
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
    var paymentState: FanPassV4.PaymentState = .idle
    var paymentResult: FanPassV4.DemoPaymentResult = .success
    var purchasedTicket: FanPassV4.Ticket?
    var errorMessage: String?
    private let paymentService = MockPaymentService()
    private let ticketService: FanPassV4TicketServicing

    init(
        event: FanPassV4.Event = FanPassMockData.events[0],
        ticketType: FanPassV4.TicketType = FanPassMockData.events[0].safePrimaryTicketType,
        quotedPrice: Int? = nil,
        priceLineTitle: String = "Face value",
        ticketService: FanPassV4TicketServicing = MockTicketService()
    ) {
        self.event = event
        self.ticketType = ticketType
        self.quotedPrice = quotedPrice ?? ticketType.faceValue
        self.priceLineTitle = priceLineTitle
        self.ticketService = ticketService
    }

    var ticketPriceLabel: String {
        MoneyFormatter.format(quotedPrice, currency: ticketType.currency)
    }

    var platformFee: Int { max(28, Int(Double(quotedPrice) * 0.035)) }
    var tax: Int { Int(Double(quotedPrice) * 0.02) }

    var platformFeeLabel: String {
        MoneyFormatter.format(platformFee, currency: ticketType.currency)
    }

    var taxLabel: String {
        MoneyFormatter.format(tax, currency: ticketType.currency)
    }

    var totalLabel: String {
        MoneyFormatter.format(totalAmount, currency: ticketType.currency)
    }

    var totalAmount: Int {
        quotedPrice + platformFee + tax
    }

    func simulatePaymentSuccess() {
        paymentResult = .success
        Task { await completePayment(owner: FanPassMockData.currentUser) }
    }

    func simulatePaymentFailure() {
        paymentResult = .failure
        Task { await completePayment() }
    }

    func simulateCheckoutExpired() {
        paymentResult = .expired
        Task { await completePayment() }
    }

    func resetPayment() {
        paymentState = .idle
        errorMessage = nil
        purchasedTicket = nil
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

    func completeStripeCheckout(owner: FanPassV4.User) -> FanPassV4.Ticket {
        let ticket = checkoutTicket(
            owner: owner,
            status: .transferPending,
            entryMode: .unavailable,
            source: "stripe"
        )
        purchasedTicket = ticket
        paymentState = .captured
        errorMessage = nil
        return ticket
    }

    func completePayment(owner: FanPassV4.User = FanPassMockData.currentUser) async {
        paymentState = .authorizing
        do {
            _ = try await paymentService.authorizeDemoPayment(result: paymentResult)
            paymentState = try await paymentService.captureDemoPayment(result: paymentResult)
            purchasedTicket = await ticketService.purchaseTicket(event: event, ticketType: ticketType, owner: owner)
            errorMessage = nil
        } catch FanPassV4MockError.paymentFailed {
            paymentState = .failed
            errorMessage = "Payment failed. No ticket was assigned."
        } catch FanPassV4MockError.checkoutExpired {
            paymentState = .cancelled
            errorMessage = "The ticket reservation timed out."
        } catch {
            paymentState = .failed
            errorMessage = "Payment could not complete."
        }
    }

    private func checkoutTicket(
        owner: FanPassV4.User,
        status: FanPassV4.TicketStatus,
        entryMode: FanPassV4.TicketEntryMode,
        source: String
    ) -> FanPassV4.Ticket {
        let compactEvent = event.id
            .replacingOccurrences(of: "evt_", with: "")
            .replacingOccurrences(of: "-", with: "")
            .uppercased()
            .prefix(8)
        let compactType = ticketType.id
            .replacingOccurrences(of: "tt_", with: "")
            .replacingOccurrences(of: "-", with: "")
            .uppercased()
            .prefix(6)
        let unique = UUID().uuidString
            .replacingOccurrences(of: "-", with: "")
            .uppercased()
            .prefix(6)
        let ticketId = "FP-\(source.uppercased())-\(compactEvent)-\(compactType)-\(unique)"
        return FanPassV4.Ticket(
            id: ticketId,
            event: event,
            ticketType: ticketType,
            ownerId: owner.id,
            status: status,
            section: "Digital",
            row: "Issue",
            seat: "Pending",
            entryMode: entryMode,
            transferCount: 0,
            proofHistory: FanPassMockData.proofHistory(ticketId: ticketId)
        )
    }
}

@MainActor
@Observable
final class FanAccessViewModel {
    var event: FanPassV4.Event
    var tasks: [FanPassV4.FanTask]
    var badge: FanPassV4.AccessBadge = FanPassMockData.currentUser.accessBadges[0]
    var lastCompletedTask: FanPassV4.FanTask?
    var badgeEarned = false
    private let service = MockFanAccessService()

    init(event: FanPassV4.Event = FanPassMockData.events[0]) {
        self.event = event
        self.tasks = event.fanTasks
    }

    var approvedPoints: Int {
        tasks.filter { $0.status == .approved }.reduce(0) { $0 + $1.points }
    }

    var totalPoints: Int {
        tasks.reduce(0) { $0 + $1.points }
    }

    var progress: Double {
        guard totalPoints > 0 else { return 0 }
        return min(1, Double(approvedPoints) / Double(totalPoints))
    }

    func completeTask(_ task: FanPassV4.FanTask) async {
        let completed = await service.completeTask(task)
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index] = completed
        }
        lastCompletedTask = completed
        if progress >= 0.7 {
            badge = await service.earnBadge(for: event)
            badgeEarned = true
        }
    }
}

@MainActor
@Observable
final class TicketsViewModel {
    var tickets: [FanPassV4.Ticket] = FanPassMockData.tickets
    var selectedTicket: FanPassV4.Ticket? = FanPassMockData.tickets.first
    private let ticketService: FanPassV4TicketServicing

    init(ticketService: FanPassV4TicketServicing = MockTicketService()) {
        self.ticketService = ticketService
    }

    func load(
        user: FanPassV4.User = FanPassMockData.currentUser,
        statusOverride: FanPassV4.TicketStatus? = nil,
        ticketService overrideService: FanPassV4TicketServicing? = nil
    ) async {
        tickets = await (overrideService ?? ticketService).walletTickets(for: user, statusOverride: statusOverride)
        selectedTicket = tickets.first
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
    var availableEvents: [FanPassV4.Event] = FanPassMockData.events
    var listings: [FanPassV4.ResaleListing] = FanPassMockData.listings
    var trades: [FanPassV4.Trade] = FanPassMockData.trades
    var selectedEvent: FanPassV4.Event = FanPassMockData.events[0] {
        didSet {
            loadSelectedEventData()
        }
    }
    private let marketService = MockMarketService()

    var orderbook: [FanPassV4.OrderbookOrder] {
        FanPassMockData.orderbook(for: selectedEvent)
    }

    func load(eventService: FanPassV4EventServicing = MockEventService()) async {
        do {
            let events = try await eventService.featuredEvents(network: .online)
            guard !events.isEmpty else { return }
            availableEvents = events
            if let matchingEvent = events.first(where: { $0.id == selectedEvent.id }) {
                selectedEvent = matchingEvent
            } else if let firstEvent = events.first {
                selectedEvent = firstEvent
            }
        } catch {
            availableEvents = FanPassMockData.events
        }
    }

    var premiumLabel: String {
        let faceValue = selectedEvent.safePrimaryTicketType.faceValue
        guard faceValue > 0 else { return "0%" }
        let premium = Double(selectedEvent.marketSummary.floorPrice - faceValue) / Double(faceValue)
        return premium.formatted(.percent.precision(.fractionLength(0)))
    }

    var recentSaleLabel: String {
        MoneyFormatter.format(selectedEvent.marketSummary.recentSale, currency: selectedEvent.marketSummary.currency)
    }

    var bestBidLabel: String {
        let bestBid = orderbook.filter { $0.side == .buy }.map(\.price).max() ?? 0
        return MoneyFormatter.format(bestBid, currency: selectedEvent.marketSummary.currency)
    }

    var bestAskLabel: String {
        let bestAsk = orderbook.filter { $0.side == .sell }.map(\.price).min() ?? 0
        return MoneyFormatter.format(bestAsk, currency: selectedEvent.marketSummary.currency)
    }

    var spreadLabel: String {
        let bid = orderbook.filter { $0.side == .buy }.map(\.price).max() ?? 0
        let ask = orderbook.filter { $0.side == .sell }.map(\.price).min() ?? 0
        return MoneyFormatter.format(max(0, ask - bid), currency: selectedEvent.marketSummary.currency)
    }

    func loadSelectedEventData() {
        listings = FanPassMockData.listings.filter { $0.ticket.event.id == selectedEvent.id }
        trades = FanPassMockData.trades(for: selectedEvent)
    }

    func completeResalePurchase(for listing: FanPassV4.ResaleListing, buyer: FanPassV4.User = FanPassMockData.currentUser) async -> FanPassV4.Ticket {
        await marketService.buyResaleTicket(listing: listing, buyer: buyer)
    }
}

@MainActor
@Observable
final class ScannerViewModel {
    typealias NFCScanState = FanPassV4.NFCScanState

    var selectedEvent: FanPassV4.Event = FanPassMockData.events[0]
    var selectedGate: String = "A1"
    var lastResult: FanPassV4.CheckInResult? = FanPassMockData.scanResults.first
    var nfcModeAvailable: Bool = false
    var nfcState: NFCScanState = .ready
    var qrCredential: String = "qr-ready"
    private let scannerService: FanPassV4ScannerServicing

    init(scannerService: FanPassV4ScannerServicing = MockScannerService()) {
        self.scannerService = scannerService
    }

    func simulateQRScan(_ result: FanPassV4.ScanResult) async {
        lastResult = await scannerService.scan(result: result, event: selectedEvent, gate: selectedGate)
    }

    func simulateNFCScan(_ state: NFCScanState) async {
        nfcState = .scanning
        nfcState = state
        lastResult = await scannerService.nfcResult(state: state, event: selectedEvent, gate: selectedGate)
    }

    func refreshQRCode(ticket: FanPassV4.Ticket) async {
        do {
            qrCredential = try await scannerService.refreshQRCredential(ticket: ticket)
        } catch {
            qrCredential = "qr-unavailable"
        }
    }

}

@MainActor
@Observable
final class ProfileViewModel {
    var user: FanPassV4.User
    var staffUser: FanPassV4.User = FanPassMockData.staffUser
    var staffScannerAvailable: Bool = true
    var controls = FanPassV4.PrototypeControlState()
    var controlMessage = "Account controls updated."

    init(user: FanPassV4.User = FanPassMockData.currentUser) {
        self.user = user
        self.controls.userScenario = user.scenario
    }

    func applyControls() {
        user = FanPassMockData.user(for: controls.userScenario)
        controlMessage = "\(controls.userScenario.title) • \(controls.ticketStatus.title) • \(controls.paymentResult.title)"
    }
}
