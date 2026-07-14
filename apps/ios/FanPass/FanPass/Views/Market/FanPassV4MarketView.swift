import SwiftUI

struct FanPassV4MarketView: View {
    @Environment(FanPassRootViewModel.self) private var appViewModel
    @Environment(FanPassBackendContext.self) private var backend
    @State private var viewModel = MarketViewModel()
    @State private var selectedTicketTypeID: String?
    @State private var showBuyFlow = false
    @State private var selectedSellTicket: FanPassV4.Ticket?
    @State private var showSellTicketPicker = false
    @State private var ownedTickets: [FanPassV4.Ticket] = []
    @State private var ownedTicketsError: String?
    @State private var remoteOrderbook: OrderbookSnapshot?
    @State private var orderbookError: String?
    @State private var realtimeStatus: FanPassOrderbookRealtimeStatus = .idle
    @State private var realtimeClient = FanPassOrderbookRealtimeClient()
    @State private var marketActionMessage: String?
    @State private var showMarketSelector = false

    var body: some View {
        GeometryReader { geometry in
            Group {
                if viewModel.isLoading && viewModel.availableEvents.isEmpty {
                    ProgressView("Loading market")
                        .tint(FPColors.pulseCyan)
                        .foregroundStyle(FPColors.textPrimary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.availableEvents.isEmpty {
                    FPEmptyStateView(
                        title: "Market unavailable",
                        message: viewModel.errorMessage ?? "No published events are available right now.",
                        systemImage: FPIcons.market
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(FPSpacing.lg)
                } else {
                    ScrollView(.vertical, showsIndicators: false) {
                        tradingPanel
                    }
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height, alignment: .top)
            .padding(.horizontal, 0)
            .padding(.top, 0)
            .padding(.bottom, FPSpacing.threeXL + 96)
        }
        .background(FPColors.surfaceCard.ignoresSafeArea(edges: .top))
        .ignoresSafeArea(edges: .top)
        .safeAreaInset(edge: .bottom) {
            if !viewModel.availableEvents.isEmpty {
                marketActionBar
            }
        }
        .sheet(isPresented: $showBuyFlow) {
            NavigationStack {
                FanPassV4BuyOrderSheet(
                    event: viewModel.selectedEvent,
                    ticketType: selectedMarketTicketType,
                    bestAskPrice: remoteOrderbook?.asks.first?.price,
                    bestAsk: selectedMarketContext.bestAskLabel,
                    onAuthRequired: openSignInFromMarketSheet
                )
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            showBuyFlow = false
                        } label: {
                            Label("Back", systemImage: "chevron.left")
                        }
                    }
                }
            }
            .presentationDetents([.large])
        }
        .sheet(item: $selectedSellTicket) { ticket in
            NavigationStack {
                FanPassV4ListTicketView(
                    ticket: ticket,
                    isAuthenticated: backend.isAuthenticated,
                    onAuthRequired: openSignInFromSellSheet
                )
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button {
                                selectedSellTicket = nil
                            } label: {
                                Label("Back", systemImage: "chevron.left")
                            }
                        }
                    }
            }
            .presentationDetents([.large])
        }
        .onAppear {
            applyFocusedMarketEvent()
        }
        .task(id: backend.connectionState) {
            await viewModel.load(eventService: backend.eventService())
            applyFocusedMarketEvent()
            if selectedTicketTypeID == nil {
                selectedTicketTypeID = viewModel.selectedEvent.safePrimaryTicketType.id
            }
        }
        .task(id: "\(viewModel.selectedEvent.id)-\(selectedMarketTicketType.id)") {
            await runOrderbookFeed()
        }
        .task(id: "owned-\(backend.ticketRefreshKey)") {
            await refreshOwnedTickets()
        }
        .onChange(of: appViewModel.focusedMarketEvent?.id) { _, _ in
            applyFocusedMarketEvent()
        }
        .confirmationDialog("Choose a ticket", isPresented: $showSellTicketPicker, titleVisibility: .visible) {
            ForEach(eligibleOwnedTickets) { ticket in
                Button(ticketSelectionLabel(ticket)) {
                    selectedSellTicket = ticket
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Select the exact seat to list for resale.")
        }
        .alert("Market", isPresented: marketActionAlertBinding) {
            Button("OK", role: .cancel) {
                marketActionMessage = nil
            }
        } message: {
            Text(marketActionMessage ?? "The market action could not continue.")
        }
        .fullScreenCover(isPresented: $showMarketSelector) {
            NavigationStack {
                FanPassV4MarketSelectionView(
                    events: viewModel.availableEvents,
                    selectedEventID: viewModel.selectedEvent.id,
                    selectedTicketTypeID: selectedTicketTypeID
                ) { event, ticketType in
                    viewModel.selectedEvent = event
                    selectedTicketTypeID = ticketType.id
                }
            }
            .preferredColorScheme(.dark)
        }
    }

    private var tradingPanel: some View {
        MarketTradingPanel(
            event: viewModel.selectedEvent,
            selectedTicketTypeID: selectedTicketTypeID,
            orderbook: remoteOrderbook,
            realtimeStatus: realtimeStatus,
            orderbookError: orderbookError
        ) {
            showMarketSelector = true
        }
    }

    private var marketActionBar: some View {
        HStack(spacing: FPSpacing.md) {
            Button {
                withAnimation(.spring(response: 0.26, dampingFraction: 0.82)) {
                    showBuyFlow = true
                }
            } label: {
                Label("Buy", systemImage: "arrow.down.circle.fill")
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.backgroundNight)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(FPColors.verifiedGreen, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            }
            .buttonStyle(.plain)

            Button {
                guard backend.isAuthenticated else {
                    openSignInFromMarket()
                    return
                }
                withAnimation(.spring(response: 0.26, dampingFraction: 0.82)) {
                    openSellFlow()
                }
            } label: {
                Label("Sell", systemImage: "arrow.up.circle.fill")
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(FPColors.neonMagenta.opacity(0.92), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, FPSpacing.lg)
        .padding(.top, FPSpacing.sm)
        .padding(.bottom, FPSpacing.sm)
        .background(FPColors.backgroundNight)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(FPColors.borderDivider)
                .frame(height: 1)
        }
    }

    private var eligibleOwnedTickets: [FanPassV4.Ticket] {
        ownedTickets.filter { ticket in
            ticket.event.id == viewModel.selectedEvent.id &&
                ticket.ticketType.id == selectedMarketTicketType.id &&
                (ticket.status.allowsResale || ticket.status == .listed)
        }
    }

    private var selectedMarketTicketType: FanPassV4.TicketType {
        viewModel.selectedEvent.ticketTypes.first { $0.id == selectedTicketTypeID } ?? viewModel.selectedEvent.safePrimaryTicketType
    }

    private var selectedMarketContext: MarketPricingSnapshot {
        MarketPricingSnapshot(
            event: viewModel.selectedEvent,
            ticketType: selectedMarketTicketType,
            remoteFloorPrice: remoteOrderbook?.floorPrice,
            remoteBestBid: remoteOrderbook?.bids.first?.price,
            remoteBestAsk: remoteOrderbook?.asks.first?.price,
            remoteLastSale: remoteOrderbook?.lastTradePrice
        )
    }

    private func applyFocusedMarketEvent() {
        if selectedTicketTypeID == nil {
            selectedTicketTypeID = viewModel.selectedEvent.safePrimaryTicketType.id
        }
        guard let event = appViewModel.focusedMarketEvent,
              event.id != viewModel.selectedEvent.id
        else {
            return
        }
        viewModel.selectedEvent = event
        selectedTicketTypeID = event.safePrimaryTicketType.id
    }

    private func openSignInFromMarketSheet() {
        showBuyFlow = false
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(180))
            appViewModel.openPrivySignIn()
        }
    }

    private func openSignInFromSellSheet() {
        selectedSellTicket = nil
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(180))
            appViewModel.openPrivySignIn()
        }
    }

    private func openSignInFromMarket() {
        appViewModel.openPrivySignIn()
    }

    private func refreshRemoteOrderbook() async {
        do {
            remoteOrderbook = try await backend.apiClient.orderbook(
                eventId: viewModel.selectedEvent.id,
                ticketTypeId: selectedMarketTicketType.id
            )
            orderbookError = nil
        } catch {
            if remoteOrderbook == nil {
                orderbookError = "Live resale prices could not load."
            }
        }
    }

    private func runOrderbookFeed() async {
        await refreshRemoteOrderbook()
        realtimeClient.onStatusChange = { status in
            realtimeStatus = status
        }
        realtimeClient.onUpdate = { update in
            remoteOrderbook = update.snapshot
            orderbookError = nil
        }
        realtimeClient.connect(
            apiBaseURL: backend.apiClient.baseURL,
            eventId: viewModel.selectedEvent.id,
            ticketTypeId: selectedMarketTicketType.id
        )

        do {
            while !Task.isCancelled {
                try await Task.sleep(for: .seconds(30))
                if realtimeStatus != .live {
                    await refreshRemoteOrderbook()
                }
            }
        } catch {
            // View-driven cancellation ends this subscription.
        }
        realtimeClient.disconnect()
    }

    private func refreshOwnedTickets() async {
        guard backend.isAuthenticated else {
            ownedTickets = []
            ownedTicketsError = nil
            return
        }
        do {
            ownedTickets = try await backend.ticketService().walletTickets(
                for: backend.user,
                statusOverride: nil
            )
            ownedTicketsError = nil
        } catch is CancellationError {
            return
        } catch {
            ownedTicketsError = "Your tickets could not refresh."
        }
    }

    private func openSellFlow() {
        if let ownedTicketsError {
            marketActionMessage = ownedTicketsError
            return
        }
        switch eligibleOwnedTickets.count {
        case 0:
            marketActionMessage = "You do not own an eligible \(selectedMarketTicketType.name) ticket for this event."
        case 1:
            selectedSellTicket = eligibleOwnedTickets[0]
        default:
            showSellTicketPicker = true
        }
    }

    private func ticketSelectionLabel(_ ticket: FanPassV4.Ticket) -> String {
        "Section \(ticket.section) • Row \(ticket.row) • Seat \(ticket.seat)"
    }

    private var marketActionAlertBinding: Binding<Bool> {
        Binding(
            get: { marketActionMessage != nil },
            set: { isPresented in
                if !isPresented {
                    marketActionMessage = nil
                }
            }
        )
    }

}

private struct MarketTradingPanel: View {
    let event: FanPassV4.Event
    let selectedTicketTypeID: String?
    let orderbook: OrderbookSnapshot?
    let realtimeStatus: FanPassOrderbookRealtimeStatus
    let orderbookError: String?
    let onOpenMarketSelector: () -> Void

    private var selectedTicketType: FanPassV4.TicketType {
        event.ticketTypes.first { $0.id == selectedTicketTypeID } ?? event.safePrimaryTicketType
    }

    private var marketContext: MarketPricingSnapshot {
        MarketPricingSnapshot(
            event: event,
            ticketType: selectedTicketType,
            remoteFloorPrice: orderbook?.floorPrice,
            remoteBestBid: orderbook?.bids.first?.price,
            remoteBestAsk: orderbook?.asks.first?.price,
            remoteLastSale: orderbook?.lastTradePrice
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                HStack(alignment: .center, spacing: FPSpacing.md) {
                    Text("Resale market")
                        .font(.system(size: 22, weight: .black, design: .rounded))
                        .foregroundStyle(FPColors.textPrimary)
                    Spacer(minLength: FPSpacing.sm)
                    Text(capLabel)
                        .font(FPTypography.caption.weight(.bold))
                        .foregroundStyle(FPColors.verifiedGreen)
                        .padding(.horizontal, FPSpacing.sm)
                        .padding(.vertical, 5)
                        .background(FPColors.verifiedGreen.opacity(0.14), in: Capsule())
                }

                marketSelector

                HStack(alignment: .top, spacing: FPSpacing.lg) {
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        Text(marketContext.floorLabel)
                            .font(.system(size: 36, weight: .black, design: .rounded))
                            .foregroundStyle(orderbook?.floorPrice == nil ? FPColors.textSecondary : FPColors.verifiedGreen)
                            .monospacedDigit()
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                        Text("\(selectedTicketType.name) • \(marketContext.premiumLabel) vs face")
                            .font(FPTypography.callout)
                            .foregroundStyle(FPColors.textSecondary)
                    }
                    Spacer(minLength: FPSpacing.md)
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        MarketTickerMetric(title: "Best bid", value: marketContext.bestBidLabel)
                        MarketTickerMetric(title: "Best ask", value: marketContext.bestAskLabel)
                        MarketTickerMetric(title: "Last sale", value: marketContext.lastSaleLabel)
                    }
                    .frame(width: 132, alignment: .leading)
                }

                FPDivider()
                    .padding(.vertical, FPSpacing.xs)

                MarketCandlestickPanel(
                    event: event,
                    ticketType: selectedTicketType,
                    priceHistory: orderbook?.priceHistory ?? [],
                    lastSalePrice: orderbook?.lastTradePrice
                )

                FPDivider()
                    .padding(.vertical, FPSpacing.xs)

                marketDepth
            }
        }
        .padding(FPSpacing.md)
        .padding(.top, 72)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(FPColors.surfaceCard)
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }

    private var marketSelector: some View {
        Button(action: onOpenMarketSelector) {
            HStack(spacing: FPSpacing.md) {
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text("EVENT & SEATS")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(FPColors.pulseCyan)
                        .tracking(0.9)
                    Text(event.title)
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                        .lineLimit(1)
                    Text("\(selectedTicketType.name) • \(event.venue.city)")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .lineLimit(1)
                }

                Spacer(minLength: FPSpacing.sm)

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(FPColors.textSecondary)
            }
            .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
            .padding(.horizontal, FPSpacing.md)
            .padding(.vertical, FPSpacing.sm)
            .background(FPColors.backgroundNight, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                    .stroke(FPColors.borderDivider, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("market-selector-button")
        .accessibilityLabel("Choose event and seats. Current market is \(event.title), \(selectedTicketType.name)")
        .accessibilityHint("Opens searchable event and seat category pages")
    }

    private var capLabel: String {
        let cap = marketContext.cap
        guard selectedTicketType.faceValue > 0 else {
            return "Cap"
        }
        let percent = Int((Double(cap) / Double(selectedTicketType.faceValue) * 100).rounded())
        return "Cap \(percent)%"
    }

    @ViewBuilder
    private var marketDepth: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            HStack {
                Label(realtimeStatus.label, systemImage: realtimeStatus == .live ? "dot.radiowaves.left.and.right" : "wifi.exclamationmark")
                    .font(FPTypography.caption.weight(.semibold))
                    .foregroundStyle(realtimeStatus == .live ? FPColors.verifiedGreen : FPColors.textSecondary)
                Spacer()
                if let orderbook {
                    Text("\(orderbook.volume) verified sales")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                }
            }

            if let orderbookError, orderbook == nil {
                FPStateBanner(title: "Price feed unavailable", message: orderbookError, kind: .warning)
            } else if let orderbook {
                HStack(alignment: .top, spacing: FPSpacing.md) {
                    depthColumn(title: "Buy interest", levels: orderbook.bids, accent: FPColors.pulseCyan)
                    depthColumn(title: "Available resale", levels: orderbook.asks, accent: FPColors.verifiedGreen)
                }
            } else {
                ProgressView()
                    .tint(FPColors.pulseCyan)
                    .frame(maxWidth: .infinity, minHeight: 180)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 210, alignment: .topLeading)
    }

    private func depthColumn(title: String, levels: [OrderbookLevel], accent: Color) -> some View {
        VStack(alignment: .leading, spacing: FPSpacing.sm) {
            Text(title)
                .font(FPTypography.caption.weight(.bold))
                .foregroundStyle(FPColors.textSecondary)
            if levels.isEmpty {
                Text("None")
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading)
            } else {
                ForEach(levels.prefix(5), id: \.price) { level in
                    HStack {
                        Text(MoneyFormatter.format(level.price, currency: selectedTicketType.currency))
                            .font(FPTypography.caption.weight(.semibold))
                            .foregroundStyle(accent)
                            .monospacedDigit()
                        Spacer(minLength: FPSpacing.xs)
                        Text("×\(level.quantity)")
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                            .monospacedDigit()
                    }
                    .frame(minHeight: 28)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

}

private struct MarketPricingSnapshot {
    let event: FanPassV4.Event
    let ticketType: FanPassV4.TicketType
    var remoteFloorPrice: Int?
    var remoteBestBid: Int?
    var remoteBestAsk: Int?
    var remoteLastSale: Int?

    var cap: Int {
        ticketType.transferRule.resaleCap ?? event.marketSummary.organizerCap
    }

    var currency: String {
        ticketType.currency
    }

    var floorLabel: String {
        guard let remoteFloorPrice else {
            return "No asks"
        }
        return MoneyFormatter.format(remoteFloorPrice, currency: currency)
    }

    var bestBidLabel: String {
        if let remoteBestBid {
            return MoneyFormatter.format(remoteBestBid, currency: currency)
        }
        return "—"
    }

    var bestAskLabel: String {
        if let remoteBestAsk {
            return MoneyFormatter.format(remoteBestAsk, currency: currency)
        }
        return "—"
    }

    var lastSaleLabel: String {
        if let remoteLastSale {
            return MoneyFormatter.format(remoteLastSale, currency: currency)
        }
        return "—"
    }

    var premiumLabel: String {
        guard let remoteFloorPrice, ticketType.faceValue > 0 else { return "—" }
        let premium = Double(remoteFloorPrice - ticketType.faceValue) / Double(ticketType.faceValue)
        return premium.formatted(.percent.precision(.fractionLength(0)))
    }
}

private enum MarketHistoryRange: String, CaseIterable, Identifiable {
    case oneDay
    case sevenDays
    case thirtyDays
    case all

    var id: String { rawValue }

    var title: String {
        switch self {
        case .oneDay: "24H"
        case .sevenDays: "7D"
        case .thirtyDays: "30D"
        case .all: "ALL"
        }
    }

    var duration: TimeInterval? {
        switch self {
        case .oneDay: 24 * 60 * 60
        case .sevenDays: 7 * 24 * 60 * 60
        case .thirtyDays: 30 * 24 * 60 * 60
        case .all: nil
        }
    }

    var bucketDuration: TimeInterval {
        switch self {
        case .oneDay: 15 * 60
        case .sevenDays: 6 * 60 * 60
        case .thirtyDays, .all: 24 * 60 * 60
        }
    }
}
private struct MarketTickerMetric: View {
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: FPSpacing.xs) {
            Text(title)
                .font(FPTypography.caption)
                .foregroundStyle(FPColors.textSecondary)
            Spacer(minLength: FPSpacing.xs)
            Text(value)
                .font(FPTypography.caption.weight(.semibold))
                .foregroundStyle(FPColors.textPrimary)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.68)
        }
    }
}

private struct MarketCandlestickPanel: View {
    let event: FanPassV4.Event
    let ticketType: FanPassV4.TicketType
    let priceHistory: [OrderbookPricePoint]
    let lastSalePrice: Int?

    @State private var selectedRange: MarketHistoryRange = .all

    private var cap: Int {
        ticketType.transferRule.resaleCap ?? event.marketSummary.organizerCap
    }

    private var points: [MarketDatedPricePoint] {
        let formatter = ISO8601DateFormatter()
        return priceHistory
            .compactMap { point in
                guard let date = formatter.date(from: point.tradedAt) else { return nil }
                return MarketDatedPricePoint(date: date, price: point.price)
            }
            .sorted { $0.date < $1.date }
    }

    private var candles: [MarketCandle] {
        guard let latestDate = points.last?.date else { return [] }
        let filteredPoints: [MarketDatedPricePoint]
        if let duration = selectedRange.duration {
            let cutoff = latestDate.addingTimeInterval(-duration)
            filteredPoints = points.filter { $0.date >= cutoff }
        } else {
            filteredPoints = points
        }

        let bucketDuration = selectedRange.bucketDuration
        let buckets = Dictionary(grouping: filteredPoints) { point in
            Int(floor(point.date.timeIntervalSince1970 / bucketDuration))
        }

        return buckets.keys.sorted().compactMap { bucket in
            guard let bucketPoints = buckets[bucket]?.sorted(by: { $0.date < $1.date }),
                  let first = bucketPoints.first,
                  let last = bucketPoints.last
            else {
                return nil
            }
            return MarketCandle(
                id: "\(ticketType.id)-\(bucket)",
                label: axisLabel(for: first.date),
                open: first.price,
                close: last.price,
                high: bucketPoints.map(\.price).max() ?? last.price,
                low: bucketPoints.map(\.price).min() ?? last.price,
                volume: bucketPoints.count
            )
        }
    }

    private var lastSaleLabel: String {
        guard let lastSalePrice else { return "No sales" }
        return MoneyFormatter.format(lastSalePrice, currency: ticketType.currency)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text("Verified resale chart")
                        .font(FPTypography.title3)
                        .foregroundStyle(FPColors.textPrimary)
                    Text("Completed sales only • \(ticketType.name)")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                }
                Spacer()
                Text(lastSaleLabel)
                    .font(FPTypography.monoNumber)
                    .foregroundStyle(lastSalePrice == nil ? FPColors.textSecondary : FPColors.verifiedGreen)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }

            HStack(spacing: FPSpacing.xs) {
                ForEach(MarketHistoryRange.allCases) { range in
                    Button {
                        selectedRange = range
                    } label: {
                        Text(range.title)
                            .font(FPTypography.caption.weight(range == selectedRange ? .bold : .medium))
                            .foregroundStyle(range == selectedRange ? FPColors.backgroundNight : FPColors.textSecondary)
                            .frame(minWidth: 44, minHeight: 44)
                            .background(range == selectedRange ? FPColors.textPrimary : Color.clear, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Show \(range.title) resale history")
                    .accessibilityAddTraits(range == selectedRange ? .isSelected : [])
                }
                Spacer(minLength: FPSpacing.xs)
                Image(systemName: "chart.bar.xaxis")
                    .foregroundStyle(FPColors.pulseCyan)
                    .accessibilityHidden(true)
            }

            if candles.isEmpty {
                VStack(spacing: FPSpacing.sm) {
                    Image(systemName: "chart.xyaxis.line")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(FPColors.textTertiary)
                    Text("No verified sales in this range")
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                    Text("The chart updates after a resale settles.")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textTertiary)
                }
                .frame(maxWidth: .infinity, minHeight: 176)
                .background(FPColors.backgroundNight, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            } else {
                MarketCandlestickCanvas(
                    candles: candles,
                    cap: cap,
                    currency: ticketType.currency
                )
                    .frame(height: 226)
                    .padding(.top, FPSpacing.xs)
                    .background(FPColors.backgroundNight, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            }
        }
    }

    private func axisLabel(for date: Date) -> String {
        switch selectedRange {
        case .oneDay:
            return date.formatted(.dateTime.hour().minute())
        case .sevenDays, .thirtyDays, .all:
            return date.formatted(.dateTime.month(.abbreviated).day())
        }
    }
}

private struct MarketDatedPricePoint {
    let date: Date
    let price: Int
}
private struct MarketCandle: Identifiable {
    let id: String
    let label: String
    let open: Int
    let close: Int
    let high: Int
    let low: Int
    let volume: Int
}

private struct MarketCandlestickCanvas: View {
    let candles: [MarketCandle]
    let cap: Int
    let currency: String
    @State private var zoom: CGFloat = 1
    @State private var startIndex: Int?
    @State private var dragStep: CGFloat = 18
    @GestureState private var pinchScale: CGFloat = 1
    @GestureState private var dragTranslation: CGSize = .zero

    private var effectiveZoom: CGFloat {
        min(max(zoom * pinchScale, 1), 4.2)
    }

    var body: some View {
        GeometryReader { geometry in
            let chartHeight = geometry.size.height - 48
            let priceAxisWidth: CGFloat = 64
            let plotWidth = geometry.size.width - priceAxisWidth - 4
            let plotInset: CGFloat = 8
            let plotContentWidth = max(plotWidth - (plotInset * 2), 1)
            let visibleCount = min(candles.count, max(7, Int((CGFloat(max(candles.count, 1)) / effectiveZoom).rounded(.up))))
            let maxStartIndex = max(candles.count - visibleCount, 0)
            let baseStartIndex = min(startIndex ?? maxStartIndex, maxStartIndex)
            let previewStep = plotContentWidth / CGFloat(max(visibleCount - 1, 1))
            let dragShift = Int((-dragTranslation.width / max(previewStep, 1)).rounded())
            let currentStartIndex = min(max(baseStartIndex + dragShift, 0), maxStartIndex)
            let currentEndIndex = min(currentStartIndex + visibleCount, candles.count)
            let plottedCandles = currentStartIndex < currentEndIndex ? Array(candles[currentStartIndex..<currentEndIndex]) : []
            let rawMaxPrice = max(cap, plottedCandles.map(\.high).max() ?? cap)
            let rawMinPrice = plottedCandles.map(\.low).min() ?? 0
            let pricePadding = max((rawMaxPrice - rawMinPrice) / 10, max(rawMaxPrice / 100, 1))
            let maxPrice = rawMaxPrice + pricePadding
            let minPrice = max(0, rawMinPrice - pricePadding)
            let step = plotContentWidth / CGFloat(max(plottedCandles.count - 1, 1))
            let bodyWidth = max(5, min(12, step * 0.48))
            let maxVolume = max(plottedCandles.map(\.volume).max() ?? 1, 1)

            ZStack(alignment: .topLeading) {
                Color.clear
                    .onAppear {
                        dragStep = max(step, 1)
                    }
                    .onChange(of: step) { _, newStep in
                        dragStep = max(newStep, 1)
                    }

                grid(width: plotWidth, height: chartHeight)
                    .offset(x: 0, y: 0)

                ForEach(Array(plottedCandles.enumerated()), id: \.element.id) { index, candle in
                    let x = plottedCandles.count == 1
                        ? plotWidth / 2
                        : plotInset + (CGFloat(index) * step)
                    let openY = y(candle.open, height: chartHeight, minPrice: minPrice, maxPrice: maxPrice)
                    let closeY = y(candle.close, height: chartHeight, minPrice: minPrice, maxPrice: maxPrice)
                    let highY = y(candle.high, height: chartHeight, minPrice: minPrice, maxPrice: maxPrice)
                    let lowY = y(candle.low, height: chartHeight, minPrice: minPrice, maxPrice: maxPrice)
                    let isUp = candle.close >= candle.open
                    let candleColor = isUp ? FPColors.verifiedGreen : FPColors.neonMagenta

                    Path { path in
                        path.move(to: CGPoint(x: x, y: highY))
                        path.addLine(to: CGPoint(x: x, y: lowY))
                    }
                    .stroke(candleColor, lineWidth: 1.4)

                    RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                        .fill(candleColor)
                        .frame(width: bodyWidth, height: max(3, abs(openY - closeY)))
                        .position(x: x, y: (openY + closeY) / 2)

                    RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                        .fill(candleColor.opacity(0.28))
                        .frame(width: bodyWidth, height: 6 + (CGFloat(candle.volume) / CGFloat(maxVolume) * 18))
                        .position(x: x, y: chartHeight + 27)
                }

                VStack(alignment: .leading) {
                    Text(axisLabel(maxPrice))
                    Spacer()
                    Text(axisLabel((maxPrice + minPrice) / 2))
                    Spacer()
                    Text(axisLabel(minPrice))
                }
                .font(FPTypography.caption)
                .foregroundStyle(FPColors.textTertiary)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
                .frame(width: priceAxisWidth, height: chartHeight, alignment: .leading)
                .offset(x: plotWidth + 4)

                HStack {
                    if plottedCandles.count == 1 {
                        Spacer()
                        Text(plottedCandles[0].label)
                        Spacer()
                    } else {
                        Text(plottedCandles.first?.label ?? "")
                        Spacer()
                        Text(plottedCandles.dropFirst(plottedCandles.count / 2).first?.label ?? "")
                        Spacer()
                        Text(plottedCandles.last?.label ?? "")
                    }
                }
                .font(FPTypography.caption)
                .foregroundStyle(FPColors.textTertiary)
                .frame(width: plotWidth)
                .offset(y: chartHeight + 34)
            }
            .contentShape(Rectangle())
            .simultaneousGesture(
                MagnificationGesture()
                    .updating($pinchScale) { value, state, _ in
                        state = value
                    }
                    .onEnded { value in
                        zoom = min(max(zoom * value, 1), 4.2)
                        let newVisibleCount = min(candles.count, max(7, Int((CGFloat(max(candles.count, 1)) / zoom).rounded(.up))))
                        let newMaxStartIndex = max(candles.count - newVisibleCount, 0)
                        startIndex = min(startIndex ?? newMaxStartIndex, newMaxStartIndex)
                    }
            )
            .simultaneousGesture(
                DragGesture(minimumDistance: 8)
                    .updating($dragTranslation) { value, state, _ in
                        state = value.translation
                    }
                    .onEnded { value in
                        let visibleCount = min(candles.count, max(7, Int((CGFloat(max(candles.count, 1)) / zoom).rounded(.up))))
                        let maxStartIndex = max(candles.count - visibleCount, 0)
                        let baseStartIndex = min(startIndex ?? maxStartIndex, maxStartIndex)
                        let shift = Int((-value.translation.width / max(dragStep, 1)).rounded())
                        startIndex = min(max(baseStartIndex + shift, 0), maxStartIndex)
                    }
            )
            .onTapGesture(count: 2) {
                zoom = zoom >= 2 ? 1 : 2.4
                startIndex = nil
            }
            .onChange(of: candles.map(\.id).joined(separator: "|")) { _, _ in
                zoom = 1
                startIndex = nil
            }
            .onChange(of: zoom) { _, newZoom in
                let visibleCount = min(candles.count, max(7, Int((CGFloat(max(candles.count, 1)) / newZoom).rounded(.up))))
                let maxStartIndex = max(candles.count - visibleCount, 0)
                if let startIndex {
                    self.startIndex = min(startIndex, maxStartIndex)
                }
            }
        }
        .accessibilityLabel("Zoomable resale price candlestick chart")
    }

    private func y(_ price: Int, height: CGFloat, minPrice: Int, maxPrice: Int) -> CGFloat {
        let span = max(Double(maxPrice - minPrice), 1)
        let ratio = (Double(price - minPrice) / span)
        return height - CGFloat(ratio) * height
    }

    private func axisLabel(_ value: Int) -> String {
        MoneyFormatter.format(value, currency: currency)
    }

    private func grid(width: CGFloat, height: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            ForEach(0..<4) { index in
                Rectangle()
                    .fill(FPColors.borderDivider.opacity(0.55))
                    .frame(width: width, height: 1)
                    .offset(y: height * CGFloat(index) / 3)
            }
            ForEach(0..<4) { index in
                Rectangle()
                    .fill(FPColors.borderDivider.opacity(0.38))
                    .frame(width: 1, height: height)
                    .offset(x: width * CGFloat(index) / 3)
            }
        }
    }
}

private enum MarketMode: String, CaseIterable, Hashable {
    case overview
    case eventMarket
    case listings
    case sell
    case states

    var title: String {
        switch self {
        case .overview: "Overview"
        case .eventMarket: "Event"
        case .listings: "Buy"
        case .sell: "Sell"
        case .states: "States"
        }
    }
}

struct FanPassV4OrderbookDetailView: View {
    let viewModel: MarketViewModel

    var buyOrders: [FanPassV4.OrderbookOrder] {
        viewModel.orderbook.filter { $0.side == .buy }.sorted { $0.price > $1.price }
    }

    var sellOrders: [FanPassV4.OrderbookOrder] {
        viewModel.orderbook.filter { $0.side == .sell }.sorted { $0.price < $1.price }
    }

    var body: some View {
        FanPassV4Scaffold(title: "Market depth", subtitle: "Fan-friendly bid/ask context for \(viewModel.selectedEvent.title).") {
            FPConceptStatStrip(stats: [
                ("Best fan bid", viewModel.bestBidLabel, "Highest willing buyer"),
                ("Lowest resale", viewModel.bestAskLabel, "Lowest open listing"),
                ("Last sale", viewModel.recentSaleLabel, "Recent settled price"),
                ("Cap 110%", viewModel.selectedEvent.marketSummary.capLabel, "Organizer maximum")
            ])
            orderSection("Fans willing to buy", orders: buyOrders, color: FPColors.pulseCyan)
            orderSection("Tickets listed for resale", orders: sellOrders, color: FPColors.neonMagenta)
            MarketCandlestickPanel(
                event: viewModel.selectedEvent,
                ticketType: viewModel.selectedEvent.safePrimaryTicketType,
                priceHistory: [],
                lastSalePrice: nil
            )
            FPPolicyNotice(
                title: "Plain-language market data",
                message: "This screen explains price context before checkout. Matching, payment, and transfer remain server-owned.",
                kind: .info
            )
        }
    }

    private func orderSection(_ title: String, orders: [FanPassV4.OrderbookOrder], color: Color) -> some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: title)
            FPSurfaceCard {
                VStack(spacing: 0) {
                    ForEach(orders) { order in
                        FPOrderbookRow(
                            label: order.side.fanLabel,
                            price: MoneyFormatter.format(order.price, currency: viewModel.selectedEvent.marketSummary.currency),
                            quantity: "\(order.remainingQuantity)",
                            accent: color
                        )
                        if order.id != orders.last?.id {
                            FPDivider()
                        }
                    }
                }
            }
        }
    }
}

private struct FanPassV4BuyOrderSheet: View {
    let event: FanPassV4.Event
    let ticketType: FanPassV4.TicketType
    let bestAskPrice: Int?
    let bestAsk: String
    let onAuthRequired: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var showCheckout = false

    private var capLabel: String {
        MoneyFormatter.format(ticketType.transferRule.resaleCap ?? event.marketSummary.organizerCap, currency: ticketType.currency)
    }

    var body: some View {
        FanPassV4Scaffold(title: "Buy", subtitle: "\(event.title) • \(ticketType.name)") {
            FPSurfaceCard {
                VStack(alignment: .leading, spacing: FPSpacing.lg) {
                    FPConceptRowList(rows: [
                        .init(id: "tier", icon: "rectangle.3.group.fill", title: "Seat tier", subtitle: "Selected resale category.", value: ticketType.name, kind: .info),
                        .init(id: "bestAsk", icon: "arrow.down.circle.fill", title: "Current lowest resale", subtitle: "Verified open orderbook price.", value: bestAsk, kind: bestAskPrice == nil ? .warning : .success),
                        .init(id: "cap", icon: "lock.shield.fill", title: "Organizer cap", subtitle: "The backend rejects prices above this limit.", value: capLabel, kind: .info)
                    ])

                    if bestAskPrice == nil {
                        FPStateBanner(
                            title: "No resale ticket available",
                            message: "This category has no open resale ask right now.",
                            kind: .warning
                        )
                    }

                    Button {
                        showCheckout = true
                    } label: {
                        Label("Buy lowest resale", systemImage: "bolt.fill")
                            .font(FPTypography.headline)
                            .foregroundStyle(FPColors.backgroundNight)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(FPColors.verifiedGreen, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(bestAskPrice == nil)
                    .opacity(bestAskPrice == nil ? 0.55 : 1)
                }
            }

            FPSecondaryButton(title: "Close", systemImage: "xmark.circle.fill") {
                dismiss()
            }
        }
        .navigationDestination(isPresented: $showCheckout) {
            if let bestAskPrice {
                FanPassV4CheckoutView(
                    event: event,
                    ticketType: ticketType,
                    quotedPrice: bestAskPrice,
                    priceLineTitle: "Resale price",
                    fulfillmentMode: .resaleOnly,
                    onAuthRequired: onAuthRequired
                )
                .navigationBarTitleDisplayMode(.inline)
            }
        }
    }
}

struct FanPassV4ListTicketView: View {
    @Environment(FanPassBackendContext.self) private var backend
    let ticket: FanPassV4.Ticket
    let isAuthenticated: Bool
    let onAuthRequired: () -> Void
    @State private var listed = false
    @State private var cancelled = false
    @State private var selectedPrice: Double
    @State private var priceText: String
    @State private var listing: FanPassV4.ResaleListing?
    @State private var listingError: String?
    @State private var isSubmitting = false
    @State private var isCancelling = false
    @State private var remoteFloorPrice: Int?

    private var selectedTicket: FanPassV4.Ticket {
        backend.effectiveTicket(ticket)
    }

    init(
        ticket: FanPassV4.Ticket,
        isAuthenticated: Bool = true,
        onAuthRequired: @escaping () -> Void = {}
    ) {
        self.ticket = ticket
        self.isAuthenticated = isAuthenticated
        self.onAuthRequired = onAuthRequired
        let initialPrice = min(
            ticket.ticketType.faceValue,
            ticket.ticketType.transferRule.resaleCap ?? ticket.ticketType.faceValue
        )
        _selectedPrice = State(initialValue: Double(initialPrice))
        _priceText = State(initialValue: "\(initialPrice)")
    }

    private var suggestedPrice: Int {
        parsedPrice ?? Int(selectedPrice)
    }

    private var platformFee: Int { Int((Double(suggestedPrice) * 0.03).rounded()) }
    private var resaleCap: Int { selectedTicket.ticketType.transferRule.resaleCap ?? suggestedPrice }
    private var parsedPrice: Int? {
        Int(priceText.trimmingCharacters(in: .whitespacesAndNewlines))
    }
    private var currentLowestPrice: Int? {
        remoteFloorPrice ?? backend.openResaleListings(
            for: selectedTicket.event.id,
            ticketTypeId: selectedTicket.ticketType.id
        )
        .map(\.price)
        .min()
    }
    private var currentLowestPriceLabel: String {
        guard let currentLowestPrice else {
            return "No open ask"
        }
        return MoneyFormatter.format(currentLowestPrice, currency: selectedTicket.ticketType.currency)
    }
    private var priceStepperBinding: Binding<Double> {
        Binding {
            Double(suggestedPrice)
        } set: { newValue in
            let normalized = max(0, Int(newValue))
            selectedPrice = Double(normalized)
            priceText = "\(normalized)"
            listingError = nil
        }
    }
    private var activeListing: FanPassV4.ResaleListing? {
        listing ??
            backend.openResaleListing(for: selectedTicket.id) ??
            (selectedTicket.status == .listed ? placeholderListing : nil)
    }
    private var placeholderListing: FanPassV4.ResaleListing {
        FanPassV4.ResaleListing(
            id: "listing_\(selectedTicket.id)",
            ticket: selectedTicket,
            sellerDisplay: "Verified fan",
            price: suggestedPrice,
            currency: selectedTicket.ticketType.currency,
            feeEstimate: platformFee,
            status: .open,
            createdAt: Date()
        )
    }
    private var hasOpenListing: Bool {
        activeListing?.status == .open
    }
    private var canList: Bool {
        selectedTicket.status.allowsResale &&
            selectedTicket.ticketType.transferRule.transferable &&
            parsedPrice != nil &&
            suggestedPrice > 0 &&
            suggestedPrice <= resaleCap &&
            !hasOpenListing &&
            !isSubmitting
    }

    var body: some View {
        FanPassV4Scaffold(title: "List ticket", subtitle: "Set a price inside organizer rules.") {
            if !isAuthenticated {
                FPStateBanner(
                    title: "Sign in required",
                    message: "Only the signed-in ticket owner can list a ticket for resale.",
                    kind: .warning
                )
                FPPrimaryButton(title: "Sign in to sell", systemImage: "person.crop.circle.badge.checkmark") {
                    onAuthRequired()
                }
            } else {
                FPTicketCard(
                    eventTitle: selectedTicket.event.title,
                    metadata: "\(selectedTicket.event.dateLine) • \(selectedTicket.ticketType.name)",
                    section: selectedTicket.section,
                    row: selectedTicket.row,
                    seat: selectedTicket.seat,
                    ticketId: selectedTicket.shortId,
                    statusTitle: selectedTicket.status.title,
                    nfcReady: false,
                    entryModeTitle: "Entry reserved"
                )

                FPSurfaceCard {
                    VStack(alignment: .leading, spacing: FPSpacing.md) {
                        FPSectionHeader(title: "Listing price", subtitle: "Choose a price inside organizer rules")
                        FPConceptRowList(rows: [
                            .init(id: "face", icon: "tag", title: "Face value", subtitle: "Original organizer price.", value: selectedTicket.ticketType.priceLabel),
                            .init(id: "suggested", icon: "sparkles", title: "Suggested resale", subtitle: "Based on current market context.", value: selectedTicket.event.marketSummary.suggestedResalePriceLabel, kind: .info),
                            .init(id: "lowest", icon: "arrow.down.circle.fill", title: "Current lowest resale", subtitle: "Updates after your listing opens.", value: currentLowestPriceLabel, kind: .success),
                            .init(id: "cap", icon: "lock.shield.fill", title: "Organizer cap", subtitle: selectedTicket.ticketType.transferRule.summary, value: MoneyFormatter.format(resaleCap, currency: selectedTicket.ticketType.currency), kind: .warning)
                        ])
                        HStack(spacing: FPSpacing.sm) {
                            Text("HK$")
                                .font(FPTypography.title3)
                                .foregroundStyle(FPColors.textSecondary)
                            TextField("Enter price", text: $priceText)
                                .keyboardType(.numberPad)
                                .font(.system(size: 28, weight: .black, design: .rounded))
                                .foregroundStyle(FPColors.textPrimary)
                                .monospacedDigit()
                                .disabled(hasOpenListing || isSubmitting)
                        }
                        .padding(FPSpacing.md)
                        .background(FPColors.backgroundNight, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                                .stroke(FPColors.borderDivider, lineWidth: 1)
                        }
                        Stepper(
                            "Listing price: \(MoneyFormatter.format(suggestedPrice, currency: selectedTicket.ticketType.currency))",
                            value: priceStepperBinding,
                            in: 0...Double(resaleCap + 300),
                            step: 20
                        )
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textPrimary)
                        .tint(FPColors.pulseCyan)
                        .disabled(hasOpenListing || isSubmitting)
                    }
                }

                FPConceptRowList(rows: [
                    .init(id: "fee", icon: "creditcard.fill", title: "Platform fee", subtitle: "Visible before submitting.", value: MoneyFormatter.format(platformFee, currency: selectedTicket.ticketType.currency)),
                    .init(id: "payout", icon: "banknote.fill", title: "Estimated payout", subtitle: "After fee and settlement.", value: MoneyFormatter.format(max(0, suggestedPrice - platformFee), currency: selectedTicket.ticketType.currency), kind: .success)
                ])

                if parsedPrice == nil {
                    FPStateBanner(title: "Enter a price", message: "Type a whole-number resale price before submitting.", kind: .warning)
                }

                if suggestedPrice > resaleCap {
                    FPStateBanner(title: "Price above cap", message: "Lower the price before listing. Organizer cap is \(MoneyFormatter.format(resaleCap, currency: selectedTicket.ticketType.currency)).", kind: .danger)
                }

                if selectedTicket.status == .listed {
                    FPStateBanner(title: "Entry QR paused", message: "Cancel this listing before using the ticket for entry.", kind: .warning)
                } else if !selectedTicket.status.allowsResale {
                    FPStateBanner(title: "\(selectedTicket.status.title) ticket", message: "Only active tickets can be listed for resale.", kind: .warning)
                }

                if hasOpenListing {
                    FPConfirmationCard(title: "Listing open", message: "This ticket is now under Listed. Entry QR is unavailable until the listing is cancelled.")
                    FPSecondaryButton(title: "Cancel listing", systemImage: "xmark.circle.fill") {
                        Task {
                            await cancelOpenListing()
                        }
                    }
                    .disabled(isCancelling)
                } else if cancelled {
                    FPStateBanner(title: "Listing cancelled", message: "The ticket returns to its wallet state.", kind: .success)
                }

                if let listingError {
                    FPStateBanner(title: "Listing action failed", message: listingError, kind: .danger)
                }

                FPPrimaryButton(title: hasOpenListing ? "Listing submitted" : (isSubmitting ? "Submitting listing" : "Submit listing"), systemImage: hasOpenListing ? FPIcons.verified : FPIcons.resale) {
                    guard canList else { return }
                    Task {
                        await submitListing()
                    }
                }
                .disabled(!canList || hasOpenListing)
            }
        }
        .task(id: "\(selectedTicket.id)-\(backend.ticketRefreshKey)") {
            syncListingState()
            await refreshOpenListingIfNeeded()
            await refreshMarketFloor()
        }
        .onChange(of: priceText) { _, newValue in
            normalizePriceText(newValue)
        }
    }

    private func syncListingState() {
        if let existingListing = backend.openResaleListing(for: selectedTicket.id) {
            listing = existingListing
            listed = true
            cancelled = false
            selectedPrice = Double(existingListing.price)
            priceText = "\(existingListing.price)"
            return
        }
        if selectedTicket.status != .listed {
            listing = nil
            listed = false
        }
    }

    private func normalizePriceText(_ value: String) {
        let digits = value.filter(\.isNumber)
        if digits != value {
            priceText = digits
            return
        }
        if let parsed = Int(digits) {
            selectedPrice = Double(parsed)
        }
        listingError = nil
    }

    private func refreshMarketFloor() async {
        do {
            let snapshot = try await backend.apiClient.orderbook(
                eventId: selectedTicket.event.id,
                ticketTypeId: selectedTicket.ticketType.id
            )
            remoteFloorPrice = snapshot.floorPrice
        } catch {
            // Listing submission remains available; the cap is still backend-enforced.
        }
    }

    private func refreshOpenListingIfNeeded() async {
        guard listing == nil,
              selectedTicket.status == .listed,
              backend.isAuthenticated
        else {
            return
        }

        do {
            let orders = try await backend.apiClient.userOrders(userId: selectedTicket.ownerId)
            guard let order = orders.first(where: { order in
                order.ticketId == selectedTicket.id &&
                    order.side.uppercased() == "SELL" &&
                    order.status.uppercased() == "OPEN"
            }) else {
                listingError = "The open listing details could not be found. Refresh Tickets and try again."
                return
            }
            let remoteListing = FanPassV4APIMapper.resaleListing(order: order, ticket: selectedTicket)
            listing = remoteListing
            listed = true
            cancelled = false
            selectedPrice = Double(remoteListing.price)
            priceText = "\(remoteListing.price)"
            listingError = nil
        } catch is CancellationError {
            return
        } catch {
            listingError = "The open listing details could not load. Check your connection and try again."
        }
    }

    private func submitListing() async {
        guard canList else { return }
        isSubmitting = true
        listingError = nil
        defer { isSubmitting = false }

        do {
            let createdListing = try await backend.ticketService().listForResale(
                ticket: selectedTicket,
                price: suggestedPrice
            )
            backend.recordResaleListing(createdListing)
            listing = createdListing
            listed = true
            cancelled = false
        } catch {
            listingError = listingErrorMessage(for: error)
        }
    }

    private func cancelOpenListing() async {
        guard let activeListing else { return }
        isCancelling = true
        listingError = nil
        defer { isCancelling = false }

        do {
            let cancelledListing = try await backend.ticketService().cancelListing(activeListing)
            backend.recordCancelledListing(cancelledListing)
            listing = nil
            listed = false
            cancelled = true
        } catch {
            listingError = listingErrorMessage(for: error)
        }
    }

    private func listingErrorMessage(for error: Error) -> String {
        if let mockError = error as? FanPassV4MockError {
            return mockError.title
        }
        return error.localizedDescription
    }
}

#Preview {
    NavigationStack {
        FanPassV4MarketView()
    }
}
