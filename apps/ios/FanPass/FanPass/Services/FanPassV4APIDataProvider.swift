import Foundation

extension Notification.Name {
    static let fanPassPublicCatalogDidRefresh = Notification.Name("FanPassPublicCatalogDidRefresh")
}

enum FanPassV4EventCatalogSource: Equatable {
    case live
    case saved
}

struct FanPassV4EventCatalogSnapshot {
    let events: [FanPassV4.Event]
    let source: FanPassV4EventCatalogSource
    let updatedAt: Date
}

struct FanPassEventCatalogSnapshot {
    let events: [FanPassEvent]
    let source: FanPassV4EventCatalogSource
    let updatedAt: Date
}

actor FanPassEventCatalogRepository {
    static let shared = FanPassEventCatalogRepository()

    private struct CachedCatalog: Codable {
        let schemaVersion: Int
        let baseURL: String
        let savedAt: Date
        let events: [FanPassEvent]
    }

    private let fileURL: URL?
    private let maximumSavedAge: TimeInterval = 7 * 24 * 60 * 60
    private var cachedCatalog: CachedCatalog?
    private var inFlightRequest: Task<[FanPassEvent], Error>?
    private var lastSuccessfulRefreshAt: Date?

    init(fileManager: FileManager = .default) {
        fileURL = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appending(path: "FanPass", directoryHint: .isDirectory)
            .appending(path: "public-event-catalog-v1.json", directoryHint: .notDirectory)
    }

    func load(using apiClient: FanPassAPIClient) async throws -> FanPassEventCatalogSnapshot {
        let baseURL = apiClient.baseURL.absoluteString
        let now = Date()
        let saved = loadSavedCatalog(for: baseURL, now: now)
        if let saved,
           let lastSuccessfulRefreshAt,
           now.timeIntervalSince(lastSuccessfulRefreshAt) < 60
        {
            return FanPassEventCatalogSnapshot(
                events: saved.events,
                source: .live,
                updatedAt: saved.savedAt
            )
        }

        let request = startRefreshIfNeeded(
            using: apiClient,
            baseURL: baseURL,
            observeCompletion: saved != nil
        )
        if let saved {
            return FanPassEventCatalogSnapshot(
                events: saved.events,
                source: .saved,
                updatedAt: saved.savedAt
            )
        }

        do {
            let events = try await request.value
            finishRefresh(events: events, baseURL: baseURL)
            let refreshed = loadSavedCatalog(for: baseURL, now: Date()) ?? CachedCatalog(
                schemaVersion: 1,
                baseURL: baseURL,
                savedAt: Date(),
                events: events
            )
            return FanPassEventCatalogSnapshot(
                events: refreshed.events,
                source: .live,
                updatedAt: refreshed.savedAt
            )
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            finishFailedRefresh()
            throw error
        }
    }

    private func startRefreshIfNeeded(
        using apiClient: FanPassAPIClient,
        baseURL: String,
        observeCompletion: Bool
    ) -> Task<[FanPassEvent], Error> {
        if let inFlightRequest {
            return inFlightRequest
        }

        let request = Task { try await apiClient.events() }
        inFlightRequest = request
        if observeCompletion {
            Task { [weak self] in
                do {
                    let events = try await request.value
                    await self?.finishRefresh(events: events, baseURL: baseURL)
                } catch {
                    await self?.finishFailedRefresh()
                }
            }
        }
        return request
    }

    private func finishRefresh(events: [FanPassEvent], baseURL: String) {
        guard inFlightRequest != nil else { return }
        let now = Date()
        inFlightRequest = nil
        lastSuccessfulRefreshAt = now
        save(CachedCatalog(schemaVersion: 1, baseURL: baseURL, savedAt: now, events: events))
        NotificationCenter.default.post(name: .fanPassPublicCatalogDidRefresh, object: nil)
    }

    private func finishFailedRefresh() {
        inFlightRequest = nil
    }

    private func loadSavedCatalog(for baseURL: String, now: Date) -> CachedCatalog? {
        if cachedCatalog == nil,
           let fileURL,
           let data = try? Data(contentsOf: fileURL)
        {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            cachedCatalog = try? decoder.decode(CachedCatalog.self, from: data)
        }

        guard let cachedCatalog,
              cachedCatalog.schemaVersion == 1,
              cachedCatalog.baseURL == baseURL,
              now.timeIntervalSince(cachedCatalog.savedAt) <= maximumSavedAge
        else {
            return nil
        }
        return cachedCatalog
    }

    private func save(_ catalog: CachedCatalog) {
        cachedCatalog = catalog
        guard let fileURL else { return }
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            try encoder.encode(catalog).write(to: fileURL, options: .atomic)
        } catch {
            // The public catalog remains available in memory when disk caching is unavailable.
        }
    }
}

struct FanPassV4APIDataProvider {
    let apiClient: FanPassAPIClient
    let eventCatalog: FanPassEventCatalogRepository

    init(
        apiClient: FanPassAPIClient = FanPassAPIClient(baseURL: FanPassEnvironment.apiBaseURL),
        eventCatalog: FanPassEventCatalogRepository = .shared
    ) {
        self.apiClient = apiClient
        self.eventCatalog = eventCatalog
    }

    func withAccessToken(_ token: String?) -> FanPassV4APIDataProvider {
        FanPassV4APIDataProvider(
            apiClient: apiClient.withAccessToken(token),
            eventCatalog: eventCatalog
        )
    }

    func eventService() -> FanPassV4APIEventService {
        FanPassV4APIEventService(apiClient: apiClient, eventCatalog: eventCatalog)
    }

    func ticketService() -> FanPassV4APITicketService {
        FanPassV4APITicketService(apiClient: apiClient, eventCatalog: eventCatalog)
    }

    func scannerService() -> FanPassV4APIScannerService {
        FanPassV4APIScannerService(apiClient: apiClient)
    }
}

struct FanPassV4APIEventService: FanPassV4EventServicing {
    let apiClient: FanPassAPIClient
    let eventCatalog: FanPassEventCatalogRepository

    func featuredEvents(network: FanPassV4.DemoNetworkCondition = .online) async throws -> [FanPassV4.Event] {
        try await featuredEventSnapshot(network: network).events
    }

    func featuredEventSnapshot(
        network: FanPassV4.DemoNetworkCondition = .online
    ) async throws -> FanPassV4EventCatalogSnapshot {
        if network == .unavailable {
            throw FanPassV4ServiceError.networkUnavailable
        }
        let catalog = try await eventCatalog.load(using: apiClient)
        let apiEvents = try catalog.events
            .map(FanPassV4APIMapper.event)
            .filter(Self.isPublicDisplayEvent)
            .sorted(by: Self.preferPurchasableStagingEvents)
        return FanPassV4EventCatalogSnapshot(
            events: Array(apiEvents.prefix(10)),
            source: catalog.source,
            updatedAt: catalog.updatedAt
        )
    }

    func event(id: String) async -> FanPassV4.Event? {
        do {
            return try await featuredEventSnapshot(network: .online).events.first { $0.id == id }
        } catch {
            return nil
        }
    }

    private static func preferPurchasableStagingEvents(_ lhs: FanPassV4.Event, _ rhs: FanPassV4.Event) -> Bool {
        let lhsScore = stagingPurchaseScore(lhs)
        let rhsScore = stagingPurchaseScore(rhs)
        if lhsScore != rhsScore {
            return lhsScore > rhsScore
        }
        return lhs.startTime < rhs.startTime
    }

    private static func isPublicDisplayEvent(_ event: FanPassV4.Event) -> Bool {
        let text = [
            event.id,
            event.title,
            event.subtitle,
            event.venue.name,
            event.venue.city
        ]
        .joined(separator: " ")
        .lowercased()

        let blockedPhrases = [
            "staff tenant",
            "evidence",
            "fixture",
            "mock",
            "staging",
            "smoke",
            "local-review"
        ]
        return !blockedPhrases.contains(where: { text.contains($0) })
    }

    private static func stagingPurchaseScore(_ event: FanPassV4.Event) -> Int {
        var score = 0
        if event.ticketTypes.contains(where: { $0.supply > 0 }) {
            score += 100
        }
        if event.status == .published {
            score += 20
        }
        if event.title.localizedCaseInsensitiveContains("FanPass Concert") {
            score += 10
        }
        return score
    }
}

struct FanPassV4APITicketService: FanPassV4TicketServicing {
    let apiClient: FanPassAPIClient
    let eventCatalog: FanPassEventCatalogRepository

    func walletTickets(for user: FanPassV4.User, statusOverride: FanPassV4.TicketStatus? = nil) async throws -> [FanPassV4.Ticket] {
        async let apiEvents = eventCatalog.load(using: apiClient)
        async let apiTickets = apiClient.tickets(ownerId: user.id)

        let eventRecords = try await apiEvents.events
        let context = try FanPassV4APIMapper.Context(apiEvents: eventRecords)
        let ticketRecords = try await apiTickets
        var tickets = try ticketRecords.map {
            try FanPassV4APIMapper.ticket($0, context: context)
        }
        if let statusOverride, !tickets.isEmpty {
            tickets[0].status = statusOverride
            tickets[0].entryMode = statusOverride == .active ? tickets[0].entryMode : .unavailable
        }
        return tickets
    }

    func ticket(id: String) async throws -> FanPassV4.Ticket? {
        async let apiEvents = eventCatalog.load(using: apiClient)
        async let apiTicket = apiClient.ticket(ticketId: id)

        let eventRecords = try await apiEvents.events
        let context = try FanPassV4APIMapper.Context(apiEvents: eventRecords)
        let ticketRecord = try await apiTicket
        return try FanPassV4APIMapper.ticket(ticketRecord, context: context)
    }

    func proofHistory(for ticket: FanPassV4.Ticket) async throws -> [FanPassV4.ProofHistoryItem] {
        let response = try await apiClient.proofHistory(ticketId: ticket.id)
        return try response.items.map(FanPassV4APIMapper.proofHistoryItem)
    }

    func chainProof(for ticket: FanPassV4.Ticket) async throws -> FanPassChainProofResponse {
        try await apiClient.chainProof(ticketId: ticket.id)
    }

    func listForResale(ticket: FanPassV4.Ticket, price: Int) async throws -> FanPassV4.ResaleListing {
        guard ticket.ticketType.transferRule.transferable, ticket.status.allowsResale else {
            throw FanPassV4ServiceError.ticketNotTransferable
        }
        if let cap = ticket.ticketType.transferRule.resaleCap, price > cap {
            throw FanPassV4ServiceError.resaleCapExceeded
        }

        let response = try await apiClient.createOrder(
            userId: ticket.ownerId,
            eventId: ticket.event.id,
            ticketTypeId: ticket.ticketType.id,
            side: "SELL",
            price: price,
            ticketId: ticket.id,
            idempotencyKey: "ios-v4-resale-\(ticket.id)-\(UUID().uuidString)"
        )

        var listedTicket = ticket
        listedTicket.status = .listed
        listedTicket.entryMode = .unavailable
        return FanPassV4APIMapper.resaleListing(order: response.order, ticket: listedTicket)
    }

    func cancelListing(_ listing: FanPassV4.ResaleListing) async throws -> FanPassV4.ResaleListing {
        let orderId = try await openSellOrderId(for: listing)
        let cancelledOrder = try await apiClient.cancelOrder(orderId: orderId, userId: listing.ticket.ownerId)
        var restoredTicket = listing.ticket
        restoredTicket.status = restoredTicket.transferCount > 0 ? .transferred : .active
        restoredTicket.entryMode = restoredTicket.status.allowsEntryCode ? .nfcReady : .unavailable
        return FanPassV4APIMapper.resaleListing(
            order: cancelledOrder,
            ticket: restoredTicket,
            statusOverride: .cancelled
        )
    }

    private func openSellOrderId(for listing: FanPassV4.ResaleListing) async throws -> String {
        if listing.id.hasPrefix("ord_") {
            return listing.id
        }

        let orders = try await apiClient.userOrders(userId: listing.ticket.ownerId)
        guard let order = orders.first(where: { order in
            order.ticketId == listing.ticket.id &&
                order.side.uppercased() == "SELL" &&
                order.status.uppercased() == "OPEN"
        }) else {
            throw FanPassV4APIListingError.openSellOrderNotFound
        }
        return order.id
    }
}

enum FanPassV4APIListingError: LocalizedError {
    case openSellOrderNotFound

    var errorDescription: String? {
        switch self {
        case .openSellOrderNotFound:
            "Open resale order was not found for this ticket."
        }
    }
}

struct FanPassV4APIScannerService: FanPassV4ScannerServicing {
    let apiClient: FanPassAPIClient
    private let encoder = JSONEncoder()

    func scan(result: FanPassV4.ScanResult, event: FanPassV4.Event, gate: String) async -> FanPassV4.CheckInResult {
        unavailableCheckIn(event: event, gate: gate)
    }

    func refreshQRCredential(ticket: FanPassV4.Ticket) async throws -> String {
        guard ticket.status.allowsEntryCode else {
            throw FanPassV4ServiceError.invalidCredential
        }
        let payload = try await apiClient.qrPayload(ticketId: ticket.id)
        let data = try encoder.encode(payload)
        return String(decoding: data, as: UTF8.self)
    }

    func nfcResult(state: FanPassV4.NFCScanState, event: FanPassV4.Event, gate: String) async -> FanPassV4.CheckInResult {
        unavailableCheckIn(event: event, gate: gate)
    }

    private func unavailableCheckIn(event: FanPassV4.Event, gate: String) -> FanPassV4.CheckInResult {
        FanPassV4.CheckInResult(
            id: "unavailable-\(UUID().uuidString)",
            ticketFragment: "Unavailable",
            eventTitle: event.title,
            gate: gate,
            result: .error,
            checkedAt: Date(),
            reason: "Live entry verification is available in FanPass Ops."
        )
    }
}

enum FanPassV4APIDataError: LocalizedError {
    case missingEvent(String)
    case missingTicketType(String)
    case invalidEventDate(eventId: String, value: String)
    case invalidProofTimestamp(itemId: String, value: String)

    var errorDescription: String? {
        switch self {
        case let .missingEvent(eventId):
            "Ticket event \(eventId) is missing from the live catalog."
        case let .missingTicketType(ticketTypeId):
            "Ticket category \(ticketTypeId) is missing from the live catalog."
        case let .invalidEventDate(eventId, value):
            "Event \(eventId) has an invalid start time: \(value)."
        case let .invalidProofTimestamp(itemId, value):
            "Ticket history item \(itemId) has an invalid timestamp: \(value)."
        }
    }
}

enum FanPassV4APIMapper {
    private static let bundledCoverAssetByEventId: [String: String] = [
        "evt_aurora": "event-cover-aurora",
        "evt_neon": "event-cover-neon",
        "evt_finals": "event-cover-finals",
        "evt_indie": "event-cover-indie",
        "evt_lab": "event-cover-lab",
        "evt_midnight": "event-cover-midnight",
        "evt_future": "event-cover-future",
        "evt_jazz": "event-cover-jazz",
        "evt_family": "event-cover-family",
        "evt_comedy": "event-cover-comedy"
    ]

    struct Context {
        let events: [FanPassV4.Event]
        let ticketTypesById: [String: FanPassV4.TicketType]

        init(apiEvents: [FanPassEvent]) throws {
            let mappedEvents = try apiEvents.map(Self.mapEvent)
            self.events = mappedEvents
            self.ticketTypesById = Dictionary(
                uniqueKeysWithValues: mappedEvents.flatMap { event in
                    event.ticketTypes.map { ($0.id, $0) }
                }
            )
        }

        private static func mapEvent(_ event: FanPassEvent) throws -> FanPassV4.Event {
            try FanPassV4APIMapper.event(event)
        }
    }

    static func event(_ event: FanPassEvent) throws -> FanPassV4.Event {
        let apiTicketTypes = event.ticketTypes.map(ticketType)
        let mappedVenue = venue(event.venue)
        guard let startTime = isoDate(event.startTime) else {
            throw FanPassV4APIDataError.invalidEventDate(
                eventId: event.id,
                value: event.startTime
            )
        }
        return FanPassV4.Event(
            id: event.id,
            title: event.title,
            subtitle: [mappedVenue.name, mappedVenue.city]
                .filter { !$0.isEmpty }
                .joined(separator: " · "),
            category: .concerts,
            heroGradient: FanPassV4.HeroGradient(
                startHex: 0x15162E,
                endHex: 0x5728E5,
                accentHex: 0x27E4FF,
                label: "Verified event"
            ),
            coverAssetName: bundledCoverAssetByEventId[event.id],
            fanAccessAvailable: event.fanAccessAvailable ?? false,
            startTime: startTime,
            status: eventStatus(event.status),
            venue: mappedVenue,
            ticketTypes: apiTicketTypes,
            fanTasks: [],
            marketSummary: defaultMarketSummary(ticketTypes: apiTicketTypes),
            isBackendBacked: true
        )
    }

    static func ticket(_ ticket: FanPassTicket, context: Context) throws -> FanPassV4.Ticket {
        guard let event = context.events.first(where: { $0.id == ticket.eventId }) else {
            throw FanPassV4APIDataError.missingEvent(ticket.eventId)
        }
        guard let ticketType = context.ticketTypesById[ticket.ticketTypeId],
              ticketType.eventId == event.id
        else {
            throw FanPassV4APIDataError.missingTicketType(ticket.ticketTypeId)
        }
        let seat = seatAssignment(for: ticket, ticketType: ticketType)
        return FanPassV4.Ticket(
            id: ticket.id,
            event: event,
            ticketType: ticketType,
            ownerId: ticket.ownerId,
            status: ticketStatus(ticket.status),
            section: seat.section,
            row: seat.row,
            seat: seat.seat,
            entryMode: ticketStatus(ticket.status).allowsEntryCode ? .nfcReady : .unavailable,
            transferCount: ticket.transferCount,
            proofHistory: []
        )
    }

    private static func seatAssignment(
        for ticket: FanPassTicket,
        ticketType: FanPassV4.TicketType
    ) -> (section: String, row: String, seat: String) {
        if let parsed = parseSeatHash(ticket.seatHash) {
            return parsed
        }

        let tier = ticketType.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let tokenSeed = ticket.tokenId?.compactMap(\.wholeNumberValue).reduce(0, +) ?? abs(ticket.id.hashValue)
        let row = ["A", "B", "C", "D", "E", "F", "G", "H"][abs(tokenSeed) % 8]
        return (
            section: tier.isEmpty ? "Digital" : tier,
            row: row,
            seat: ticket.tokenId ?? "Pending"
        )
    }

    private static func parseSeatHash(_ seatHash: String?) -> (section: String, row: String, seat: String)? {
        guard let seatHash,
              !seatHash.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            return nil
        }

        let parts = seatHash
            .split(separator: "-")
            .map(String.init)
        guard parts.count >= 6 else {
            return nil
        }

        var section: String?
        var row: String?
        var seat: String?
        var index = 0
        while index < parts.count - 1 {
            switch parts[index].lowercased() {
            case "section":
                section = parts[index + 1].uppercased()
            case "row":
                row = parts[index + 1].uppercased()
            case "seat":
                seat = parts[index + 1].uppercased()
            default:
                break
            }
            index += 2
        }

        guard let section, let row, let seat else {
            return nil
        }
        return (section, row, seat)
    }

    static func proofHistoryItem(_ item: FanPassProofHistoryItem) throws -> FanPassV4.ProofHistoryItem {
        FanPassV4.ProofHistoryItem(
            id: item.id,
            type: proofType(id: item.id, label: item.label),
            title: item.label,
            description: item.description,
            timestamp: try proofTimestamp(item.timestamp, itemId: item.id),
            actorLabel: proofActorLabel(item.state),
            proofReference: item.proofReference ?? item.safeTicketRef,
            externalURL: item.externalUrl.flatMap(URL.init(string:)),
            status: proofStatus(item.state)
        )
    }

    static func resaleListing(
        order: FanPassOrder,
        ticket: FanPassV4.Ticket,
        statusOverride: FanPassV4.ListingStatus? = nil
    ) -> FanPassV4.ResaleListing {
        FanPassV4.ResaleListing(
            id: order.id,
            ticket: ticket,
            sellerDisplay: "Verified fan",
            price: order.price,
            currency: ticket.ticketType.currency,
            feeEstimate: Int((Double(order.price) * 0.03).rounded()),
            status: statusOverride ?? listingStatus(order.status),
            createdAt: isoDate(order.createdAt) ?? Date()
        )
    }

    private static func ticketType(_ ticketType: TicketType) -> FanPassV4.TicketType {
        FanPassV4.TicketType(
            id: ticketType.id,
            eventId: ticketType.eventId,
            name: ticketType.name,
            faceValue: ticketType.faceValue,
            currency: ticketType.currency,
            supply: ticketType.supply,
            availableQuantity: ticketType.supply,
            transferRule: FanPassV4.TicketTransferRule(
                transferable: ticketType.transferable,
                resaleCap: ticketType.resaleCap,
                maxTransferCount: ticketType.maxTransferCount ?? 1,
                listingReservesEntry: true
            ),
            refundPolicy: "Organizer policy applies."
        )
    }

    private static func venue(_ venue: FanPassEvent.Venue?) -> FanPassV4.Venue {
        FanPassV4.Venue(
            id: "venue_api",
            name: venue?.name ?? "Venue to be announced",
            city: venue?.city ?? "",
            country: "",
            timezone: "UTC",
            gates: []
        )
    }

    private static func eventStatus(_ value: String) -> FanPassV4.EventStatus {
        switch value.uppercased() {
        case "CANCELLED": .cancelled
        case "COMPLETED": .completed
        default: .published
        }
    }

    private static func ticketStatus(_ value: String) -> FanPassV4.TicketStatus {
        switch value.uppercased() {
        case "LISTED_FOR_RESALE": .listed
        case "TRANSFER_PENDING": .transferPending
        case "TRANSFERRED": .transferred
        case "REDEEMED": .redeemed
        case "CANCELLED": .cancelled
        case "REFUNDED": .refunded
        case "EXPIRED": .expired
        default: .active
        }
    }

    private static func listingStatus(_ value: String) -> FanPassV4.ListingStatus {
        switch value.uppercased() {
        case "OPEN": .open
        case "CANCELLED": .cancelled
        case "FILLED", "SETTLED": .settled
        default: .matched
        }
    }

    private static func proofType(id: String, label: String) -> FanPassV4.ProofType {
        let value = "\(id) \(label)".lowercased()
        if value.contains("redeem") || value.contains("entry accepted") {
            return .redeemed
        }
        if value.contains("code") || value.contains("credential") {
            return .entryCode
        }
        if value.contains("list") {
            return .listed
        }
        if value.contains("transfer") || value.contains("holder") {
            return .transferred
        }
        if value.contains("refund") {
            return .refunded
        }
        if value.contains("cancel") {
            return .cancelled
        }
        if value.contains("purchase") {
            return .purchased
        }
        return .issued
    }

    private static func proofStatus(_ value: String) -> FanPassV4.ProofStatus {
        switch value.lowercased() {
        case "ok", "ready", "current", "redacted", "active", "verified":
            return .success
        case "paused", "pending", "short-lived":
            return .pending
        default:
            return value.lowercased().contains("fail") ? .failed : .success
        }
    }

    private static func proofActorLabel(_ state: String) -> String {
        state.lowercased() == "redacted" ? "FanPass" : "FanPass"
    }

    private static func proofTimestamp(_ value: String, itemId: String) throws -> Date {
        guard let date = isoDate(value) else {
            throw FanPassV4APIDataError.invalidProofTimestamp(
                itemId: itemId,
                value: value
            )
        }
        return date
    }

    private static func defaultMarketSummary(ticketTypes: [FanPassV4.TicketType]) -> FanPassV4.MarketSummary {
        let faceValue = ticketTypes.first?.faceValue ?? 0
        let currency = ticketTypes.first?.currency ?? "HKD"
        return FanPassV4.MarketSummary(
            floorPrice: nil,
            organizerCap: ticketTypes.first?.transferRule.resaleCap ?? faceValue,
            recentSale: nil,
            volume: 0,
            currency: currency,
            suggestedResalePrice: nil,
            priceHistory: []
        )
    }

    private static func isoDate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) {
            return date
        }
        return ISO8601DateFormatter().date(from: value)
    }
}
