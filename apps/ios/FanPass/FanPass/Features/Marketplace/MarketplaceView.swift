import SwiftUI

struct MarketplaceView: View {
    @Environment(AppState.self) private var appState
    @State private var events: [FanPassEvent] = []
    @State private var tickets: [FanPassTicket] = []
    @State private var userOrders: [FanPassOrder] = []
    @State private var orderbook: OrderbookSnapshot?
    @State private var statusMessage: String?
    @State private var loadingState: LoadingState = .loading
    @State private var isMutating = false
    @State private var realtimeStatus: FanPassOrderbookRealtimeStatus = .idle
    @State private var realtimeUpdate: FanPassOrderbookRealtimeUpdate?
    @State private var realtimeClient = FanPassOrderbookRealtimeClient()

    var body: some View {
        FanPassScreen {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Market")
                        .font(.system(size: 34, weight: .black, design: .rounded))

                    if loadingState == .loading {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 220)
                    } else if let event = selectedEvent, let ticketType = selectedTicketType {
                        marketHeader(event: event, ticketType: ticketType)
                        actionPanel(event: event, ticketType: ticketType)
                        orderbookPanel
                        priceChart
                        userOrdersPanel
                    } else {
                        AuthRequiredPanel(
                            title: "Market is unavailable",
                            message: "No ticket type is available for trading yet.",
                            actionTitle: "Retry",
                            action: { Task { await load() } }
                        )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 110)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: appState.session?.userId) {
            await load()
        }
        .onDisappear {
            realtimeClient.disconnect()
        }
    }

    private var selectedEvent: FanPassEvent? {
        events.first
    }

    private var selectedTicketType: TicketType? {
        selectedEvent?.ticketTypes.first
    }

    private func marketHeader(event: FanPassEvent, ticketType: TicketType) -> some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(event.title)
                            .font(.title3.weight(.bold))
                        Text(ticketType.name)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    StatusPill(text: ticketType.currency, color: FanPassTheme.accent)
                }

                HStack(spacing: 10) {
                    StatusPill(
                        text: realtimeStatus.label,
                        color: realtimeStatus == .live ? FanPassTheme.mint : FanPassTheme.muted
                    )
                    if let reason = realtimeUpdate?.reason {
                        Text(reasonLabel(reason))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(FanPassTheme.slate)
                    }
                    Spacer()
                }

                HStack(spacing: 12) {
                    MarketMetric(title: "Last", value: orderbook?.lastTradePrice.map { "\($0)" } ?? "-", color: FanPassTheme.ink)
                    MarketMetric(title: "Floor", value: orderbook?.floorPrice.map { "\($0)" } ?? "-", color: FanPassTheme.coral)
                    MarketMetric(title: "Cap", value: ticketType.resaleCap.map { "\($0)" } ?? "None", color: FanPassTheme.amber)
                }

                Text("Market data is shown to help fans understand fair price and resale limits.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var priceChart: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeading(title: "Price context")
                HStack(alignment: .bottom, spacing: 10) {
                    PriceBar(title: "Face", value: selectedTicketType?.faceValue ?? 0, maxValue: chartMax, color: FanPassTheme.slate)
                    PriceBar(title: "Last", value: orderbook?.lastTradePrice ?? 0, maxValue: chartMax, color: FanPassTheme.accent)
                    PriceBar(title: "Floor", value: orderbook?.floorPrice ?? 0, maxValue: chartMax, color: FanPassTheme.coral)
                    PriceBar(title: "Cap", value: selectedTicketType?.resaleCap ?? 0, maxValue: chartMax, color: FanPassTheme.amber)
                }
                .frame(height: 150)
            }
        }
    }

    private var orderbookPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading(title: "Orderbook")

            SoftCard {
                VStack(spacing: 10) {
                    let bids = orderbook?.bids ?? []
                    let asks = orderbook?.asks ?? []

                    if bids.isEmpty && asks.isEmpty {
                        Text("No open orders. Your order can become the first price signal.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        ForEach(bids, id: \.price) { level in
                            MarketRow(side: "Bid", price: level.price, quantity: level.quantity, color: FanPassTheme.mint)
                        }
                        if !bids.isEmpty && !asks.isEmpty {
                            Divider()
                        }
                        ForEach(asks, id: \.price) { level in
                            MarketRow(side: "Ask", price: level.price, quantity: level.quantity, color: FanPassTheme.coral)
                        }
                    }
                }
            }
        }
    }

    private func actionPanel(event: FanPassEvent, ticketType: TicketType) -> some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeading(title: "Trade one ticket")

                HStack(spacing: 12) {
                    Button("Buy at face value") {
                        placeBuy(event: event, ticketType: ticketType)
                    }
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                    .disabled(isMutating)

                    Button("List owned ticket") {
                        placeSell(event: event, ticketType: ticketType)
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                    .disabled(isMutating)
                }

                if let statusMessage {
                    Text(statusMessage)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(FanPassTheme.slate)
                }
            }
        }
    }

    private var userOrdersPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading(title: "Your orders")

            if appState.session == nil {
                AuthRequiredPanel(
                    title: "Orders are private",
                    message: "Sign in to manage or cancel your open orders.",
                    actionTitle: "Sign in",
                    action: { _ = appState.requireAuth(.market) }
                )
            } else {
                SoftCard {
                    VStack(spacing: 10) {
                        let relevantOrders = userOrders.filter { $0.status == "OPEN" || $0.status == "CANCELLED" || $0.status == "SETTLED" }

                        if relevantOrders.isEmpty {
                            Text("No orders yet.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        } else {
                            ForEach(relevantOrders) { order in
                                UserOrderRow(order: order, isCancelling: isMutating) {
                                    cancel(order)
                                }
                                if order.id != relevantOrders.last?.id {
                                    Divider()
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private var chartMax: Int {
        max(
            selectedTicketType?.resaleCap ?? 0,
            selectedTicketType?.faceValue ?? 0,
            orderbook?.lastTradePrice ?? 0,
            orderbook?.floorPrice ?? 0,
            1
        )
    }

    private func placeBuy(event: FanPassEvent, ticketType: TicketType) {
        guard appState.requireAuth(.market), let session = appState.session else {
            return
        }

        Task {
            await placeOrder(
                userId: session.userId,
                eventId: event.id,
                ticketTypeId: ticketType.id,
                side: "BUY",
                price: ticketType.faceValue
            )
        }
    }

    private func placeSell(event: FanPassEvent, ticketType: TicketType) {
        guard appState.requireAuth(.market), let session = appState.session else {
            return
        }

        guard let ticket = tickets.first(where: { $0.ticketTypeId == ticketType.id && ($0.status == "ACTIVE" || $0.status == "TRANSFERRED") }) else {
            statusMessage = "No active owned ticket can be listed."
            return
        }

        let price = min(ticketType.resaleCap ?? ticketType.faceValue, ticketType.faceValue)
        Task {
            await placeOrder(
                userId: session.userId,
                eventId: event.id,
                ticketTypeId: ticketType.id,
                side: "SELL",
                price: price,
                ticketId: ticket.id
            )
        }
    }

    private func placeOrder(userId: String, eventId: String, ticketTypeId: String, side: String, price: Int, ticketId: String? = nil) async {
        isMutating = true
        do {
            let response = try await appState.apiClient.createOrder(
                userId: userId,
                eventId: eventId,
                ticketTypeId: ticketTypeId,
                side: side,
                price: price,
                ticketId: ticketId
            )
            statusMessage = response.trade == nil ? "\(side.capitalized) order opened at \(fanPassMoney(response.order.price))." : "Matched at \(fanPassMoney(response.trade?.price ?? response.order.price))."
            isMutating = false
            await load()
        } catch {
            isMutating = false
            statusMessage = "Order rejected by resale or ownership policy."
        }
    }

    private func cancel(_ order: FanPassOrder) {
        guard let session = appState.session else {
            _ = appState.requireAuth(.market)
            return
        }

        isMutating = true
        Task {
            do {
                let cancelled = try await appState.apiClient.cancelOrder(orderId: order.id, userId: session.userId)
                statusMessage = "\(cancelled.side.capitalized) order cancelled."
                isMutating = false
                await load()
            } catch {
                isMutating = false
                statusMessage = "Order could not be cancelled."
            }
        }
    }

    private func load() async {
        loadingState = .loading
        do {
            events = try await appState.apiClient.events()
            if let session = appState.session {
                tickets = (try? await appState.apiClient.tickets(ownerId: session.userId)) ?? []
                userOrders = (try? await appState.apiClient.userOrders(userId: session.userId)) ?? []
            } else {
                tickets = []
                userOrders = []
            }
            if let event = selectedEvent, let ticketType = selectedTicketType {
                orderbook = try await appState.apiClient.orderbook(eventId: event.id, ticketTypeId: ticketType.id)
                connectRealtime(eventId: event.id, ticketTypeId: ticketType.id)
            } else {
                realtimeClient.disconnect()
            }
            loadingState = .loaded
        } catch {
            loadingState = .failed
            realtimeClient.disconnect()
        }
    }

    private func connectRealtime(eventId: String, ticketTypeId: String) {
        realtimeClient.onStatusChange = { status in
            realtimeStatus = status
        }
        realtimeClient.onUpdate = { update in
            orderbook = update.snapshot
            realtimeUpdate = update
        }
        realtimeClient.connect(
            apiBaseURL: appState.apiClient.baseURL,
            eventId: eventId,
            ticketTypeId: ticketTypeId
        )
    }

    private func reasonLabel(_ reason: String) -> String {
        switch reason {
        case "order_created":
            "Order opened"
        case "order_cancelled":
            "Order cancelled"
        case "trade_settled":
            "Trade settled"
        default:
            "Market updated"
        }
    }
}

private struct MarketMetric: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(FanPassTheme.background, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct PriceBar: View {
    let title: String
    let value: Int
    let maxValue: Int
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Spacer()
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(value == 0 ? FanPassTheme.line : color)
                .frame(height: max(10, CGFloat(value) / CGFloat(maxValue) * 92))
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value == 0 ? "-" : "\(value)")
                .font(.caption2.weight(.semibold))
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct MarketRow: View {
    let side: String
    let price: Int
    let quantity: Int
    let color: Color

    var body: some View {
        HStack {
            Text(side)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(color)
                .frame(width: 44, alignment: .leading)
            Text(fanPassMoney(price))
                .font(.headline)
            Spacer()
            Text("\(quantity)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 5)
    }
}

private struct UserOrderRow: View {
    let order: FanPassOrder
    let isCancelling: Bool
    let cancelAction: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            StatusPill(text: order.side, color: order.side == "BUY" ? FanPassTheme.accent : FanPassTheme.amber)

            VStack(alignment: .leading, spacing: 4) {
                Text(fanPassMoney(order.price))
                    .font(.headline)
                Text(order.status)
                    .font(.caption)
                    .foregroundStyle(fanPassStatusColor(order.status))
            }

            Spacer()

            if order.status == "OPEN" {
                Button("Cancel", action: cancelAction)
                    .buttonStyle(.bordered)
                    .disabled(isCancelling)
            }
        }
        .padding(.vertical, 4)
    }
}
