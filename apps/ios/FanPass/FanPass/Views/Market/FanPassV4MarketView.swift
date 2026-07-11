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
                    VStack(alignment: .leading, spacing: FPSpacing.xl) {
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
    }

    private var tradingPanel: some View {
        MarketTradingPanel(
            event: viewModel.selectedEvent,
            events: viewModel.availableEvents,
            selectedTicketTypeID: selectedTicketTypeID,
            orderbook: remoteOrderbook,
            realtimeStatus: realtimeStatus,
            orderbookError: orderbookError
        ) { event in
            viewModel.selectedEvent = event
            selectedTicketTypeID = event.safePrimaryTicketType.id
        } onSelectTicketType: { ticketType in
            selectedTicketTypeID = ticketType.id
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
    let events: [FanPassV4.Event]
    let selectedTicketTypeID: String?
    let orderbook: OrderbookSnapshot?
    let realtimeStatus: FanPassOrderbookRealtimeStatus
    let orderbookError: String?
    let onSelectEvent: (FanPassV4.Event) -> Void
    let onSelectTicketType: (FanPassV4.TicketType) -> Void
    @State private var eventSearchQuery = ""

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

    private var filteredEvents: [FanPassV4.Event] {
        let query = eventSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return events }
        return events.filter { candidate in
            candidate.title.localizedCaseInsensitiveContains(query) ||
                candidate.venue.name.localizedCaseInsensitiveContains(query) ||
                candidate.venue.city.localizedCaseInsensitiveContains(query) ||
                candidate.category.title.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                HStack(alignment: .top, spacing: FPSpacing.md) {
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        Text(event.title)
                            .font(.system(size: 22, weight: .black, design: .rounded))
                            .foregroundStyle(FPColors.textPrimary)
                            .lineLimit(2)
                            .minimumScaleFactor(0.72)
                        Text("\(event.venue.city) • \(event.category.title)")
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                    }
                    Spacer(minLength: FPSpacing.sm)
                    VStack(alignment: .trailing, spacing: FPSpacing.xs) {
                        Text(capLabel)
                            .font(FPTypography.caption.weight(.bold))
                            .foregroundStyle(FPColors.verifiedGreen)
                            .padding(.horizontal, FPSpacing.sm)
                            .padding(.vertical, 5)
                            .background(FPColors.verifiedGreen.opacity(0.14), in: Capsule())
                        Text(event.category.title)
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                    }
                }

                eventSearchField
                eventPickerRail
                ticketTypePicker

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

                marketDepth
            }
        }
        .padding(FPSpacing.md)
        .padding(.top, 72)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(FPColors.surfaceCard)
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }

    private var eventSearchField: some View {
        HStack(spacing: FPSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(FPColors.textSecondary)
            TextField("Search events, venues, categories", text: $eventSearchQuery)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(FPTypography.caption)
                .foregroundStyle(FPColors.textPrimary)
        }
        .padding(.horizontal, FPSpacing.sm)
        .frame(height: 38)
        .background(FPColors.backgroundNight, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }

    private var eventPickerRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: FPSpacing.sm) {
                if filteredEvents.isEmpty {
                    Text("No matching events")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .padding(.vertical, 8)
                } else {
                    ForEach(filteredEvents) { candidate in
                        eventChip(candidate)
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func eventChip(_ candidate: FanPassV4.Event) -> some View {
        let isSelected = candidate.id == event.id
        return Button {
            onSelectEvent(candidate)
            eventSearchQuery = ""
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(candidate.title)
                    .font(FPTypography.caption.weight(.bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                Text(candidate.venue.city)
                    .font(.system(size: 10, weight: .medium))
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? FPColors.backgroundNight : FPColors.textSecondary)
            .frame(width: 116, height: 42, alignment: .leading)
            .padding(.horizontal, FPSpacing.sm)
            .background(isSelected ? FPColors.pulseCyan : FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                    .stroke(isSelected ? FPColors.pulseCyan.opacity(0.8) : FPColors.borderDivider, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }

    private var ticketTypePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: FPSpacing.sm) {
                ForEach(event.ticketTypes) { ticketType in
                    ticketTypeChip(ticketType)
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func ticketTypeChip(_ ticketType: FanPassV4.TicketType) -> some View {
        let isSelected = ticketType.id == selectedTicketType.id
        return Button {
            onSelectTicketType(ticketType)
        } label: {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 4) {
                    Text(ticketType.name)
                        .font(FPTypography.caption.weight(.bold))
                        .lineLimit(1)
                }
                Text(isSelected ? marketContext.bestAskLabel : "Face \(ticketType.priceLabel)")
                    .font(.system(size: 10, weight: .semibold))
                    .monospacedDigit()
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? FPColors.backgroundNight : FPColors.textSecondary)
            .frame(width: 122, height: 48, alignment: .leading)
            .padding(.horizontal, FPSpacing.sm)
            .background(isSelected ? FPColors.pulseCyan : FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                    .stroke(isSelected ? FPColors.pulseCyan.opacity(0.9) : FPColors.borderDivider, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
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

private enum MarketTrendDirection {
    case rising
    case flat
    case falling

    var title: String {
        switch self {
        case .rising:
            return "Up"
        case .flat:
            return "Flat"
        case .falling:
            return "Down"
        }
    }

    var color: Color {
        switch self {
        case .rising:
            return FPColors.verifiedGreen
        case .flat:
            return FPColors.pulseCyan
        case .falling:
            return FPColors.neonMagenta
        }
    }

    func multiplier(progress: Double, wave: Double, tierNudge: Double) -> Double {
        switch self {
        case .rising:
            return 0.94 + (0.145 * progress) + wave + tierNudge
        case .flat:
            return 0.995 + (0.012 * progress) + wave + (tierNudge * 0.35)
        case .falling:
            return 1.065 - (0.145 * progress) + wave - (tierNudge * 0.2)
        }
    }

    func openBias(seed: Int) -> Int {
        switch self {
        case .rising:
            return 12 + (seed % 18)
        case .flat:
            return (seed % 11) - 5
        case .falling:
            return -12 - (seed % 18)
        }
    }
}

private enum MarketTimeRange: String, CaseIterable, Identifiable {
    case fifteenMinutes
    case oneHour
    case fourHours
    case oneDay
    case sevenDays

    var id: String { rawValue }

    var title: String {
        switch self {
        case .fifteenMinutes: "15m"
        case .oneHour: "1h"
        case .fourHours: "4h"
        case .oneDay: "1D"
        case .sevenDays: "7D"
        }
    }

    var pointCount: Int {
        switch self {
        case .fifteenMinutes:
            return 32
        case .oneHour:
            return 40
        case .fourHours:
            return 48
        case .oneDay:
            return 36
        case .sevenDays:
            return 56
        }
    }

    var waveAmplitude: Double {
        switch self {
        case .fifteenMinutes:
            return 0.012
        case .oneHour:
            return 0.016
        case .fourHours:
            return 0.02
        case .oneDay:
            return 0.018
        case .sevenDays:
            return 0.026
        }
    }

    var waveStep: Double {
        switch self {
        case .fifteenMinutes:
            return 0.72
        case .oneHour:
            return 0.58
        case .fourHours:
            return 0.46
        case .oneDay:
            return 0.52
        case .sevenDays:
            return 0.34
        }
    }

    var offsets: [Int] {
        switch self {
        case .fifteenMinutes:
            [-18, -8, 5, -2, 12, 22, 10, 30, 42, 34, 52, 48, 64, 58, 78, 72, 86, 82, 95, 88, 106, 98, 112, 104]
        case .oneHour:
            [-44, -32, -16, -28, -4, 18, 10, 34, 52, 44, 70, 62, 92, 76, 58, 82, 104, 96, 116, 108, 88, 98, 112, 122]
        case .fourHours:
            [-82, -70, -38, -52, -16, 8, 34, 24, 66, 92, 74, 116, 128, 102, 64, 48, 78, 108, 96, 124, 112, 86, 104, 118]
        case .oneDay:
            [-26, -12, 18, -8, 34, 62, 45, 78, 96, 74, 52, 88, 116, 104, 72, 58, 83, 94]
        case .sevenDays:
            [-92, -74, -110, -84, -42, -18, 24, 12, 56, 88, 124, 96, 138, 114, 74, 40, 68, 102, 132, 108, 84, 118, 126, 104, 136, 112, 96, 124]
        }
    }

    var lowerBand: Int {
        switch self {
        case .fifteenMinutes: 70
        case .oneHour: 95
        case .fourHours: 130
        case .oneDay: 120
        case .sevenDays: 170
        }
    }

    var wickBase: Int {
        switch self {
        case .fifteenMinutes: 8
        case .oneHour: 12
        case .fourHours: 16
        case .oneDay: 18
        case .sevenDays: 22
        }
    }

    var wickStep: Int {
        switch self {
        case .fifteenMinutes: 4
        case .oneHour: 5
        case .fourHours: 6
        case .oneDay: 7
        case .sevenDays: 8
        }
    }

    var volumeBase: Int {
        switch self {
        case .fifteenMinutes: 8
        case .oneHour: 10
        case .fourHours: 12
        case .oneDay: 10
        case .sevenDays: 14
        }
    }

    var volumeStep: Int {
        switch self {
        case .fifteenMinutes: 5
        case .oneHour: 6
        case .fourHours: 7
        case .oneDay: 7
        case .sevenDays: 9
        }
    }

    func label(for index: Int) -> String {
        switch self {
        case .fifteenMinutes:
            index.isMultiple(of: 8) ? "-\(15 - min(index, 15))m" : ""
        case .oneHour:
            index.isMultiple(of: 8) ? "-\(60 - min(index * 3, 60))m" : ""
        case .fourHours:
            index.isMultiple(of: 8) ? "-\(4 - min(index / 6, 4))h" : ""
        case .oneDay:
            index.isMultiple(of: 6) ? "D-\(max(pointCount - index - 1, 0))" : ""
        case .sevenDays:
            index.isMultiple(of: 7) ? "D-\(7 - min(index / 4, 7))" : ""
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

    private var candles: [MarketCandle] {
        var previous = event.safePrimaryTicketType.faceValue
        return event.marketSummary.priceHistory.enumerated().map { index, point in
            let open = previous
            let close = point.price
            let wickPad = 18 + (index % 4) * 7
            let high = min(max(open, close) + wickPad, event.marketSummary.organizerCap)
            let low = max(min(open, close) - wickPad, max(1, event.safePrimaryTicketType.faceValue - 120))
            previous = close
            return MarketCandle(id: point.id, label: point.label, open: open, close: close, high: high, low: low, volume: 10 + ((index * 7) % 22))
        }
    }

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.lg) {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        Text("Price chart")
                            .font(FPTypography.title3)
                            .foregroundStyle(FPColors.textPrimary)
                        Text("Fan resale activity, capped at 110% of face value.")
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                    }
                    Spacer()
                    Text(event.marketSummary.floorPriceLabel)
                        .font(FPTypography.monoNumber)
                        .foregroundStyle(FPColors.verifiedGreen)
                }

                HStack(spacing: FPSpacing.sm) {
                    ForEach(["15m", "1h", "4h", "1D", "7D"], id: \.self) { range in
                        Text(range)
                            .font(FPTypography.caption.weight(range == "1D" ? .bold : .medium))
                            .foregroundStyle(range == "1D" ? FPColors.backgroundNight : FPColors.textSecondary)
                            .padding(.horizontal, FPSpacing.sm)
                            .padding(.vertical, 6)
                            .background(range == "1D" ? FPColors.textPrimary : FPColors.surfaceGlass, in: Capsule())
                    }
                    Spacer()
                    Image(systemName: "chart.xyaxis.line")
                        .foregroundStyle(FPColors.pulseCyan)
                }

                MarketCandlestickCanvas(candles: candles, cap: event.marketSummary.organizerCap)
                    .frame(height: 226)
            }
        }
    }
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
            let plotWidth = geometry.size.width - 46
            let visibleCount = min(candles.count, max(7, Int((CGFloat(max(candles.count, 1)) / effectiveZoom).rounded(.up))))
            let maxStartIndex = max(candles.count - visibleCount, 0)
            let baseStartIndex = min(startIndex ?? maxStartIndex, maxStartIndex)
            let previewStep = plotWidth / CGFloat(max(visibleCount - 1, 1))
            let dragShift = Int((-dragTranslation.width / max(previewStep, 1)).rounded())
            let currentStartIndex = min(max(baseStartIndex + dragShift, 0), maxStartIndex)
            let currentEndIndex = min(currentStartIndex + visibleCount, candles.count)
            let plottedCandles = currentStartIndex < currentEndIndex ? Array(candles[currentStartIndex..<currentEndIndex]) : []
            let maxPrice = max(cap, plottedCandles.map(\.high).max() ?? cap)
            let minPrice = plottedCandles.map(\.low).min() ?? 0
            let step = plotWidth / CGFloat(max(plottedCandles.count - 1, 1))
            let bodyWidth = max(5, min(12, step * 0.48))

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
                    let x = CGFloat(index) * step
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
                        .frame(width: bodyWidth, height: CGFloat(candle.volume))
                        .position(x: x, y: chartHeight + 30 - CGFloat(candle.volume) / 2)
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
                .frame(width: 44, height: chartHeight, alignment: .leading)
                .offset(x: plotWidth + 4)

                HStack {
                    Text(plottedCandles.first?.label ?? "")
                    Spacer()
                    Text(plottedCandles.dropFirst(plottedCandles.count / 2).first?.label ?? "")
                    Spacer()
                    Text(plottedCandles.last?.label ?? "")
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
        NumberFormatter.localizedString(from: NSNumber(value: value), number: .decimal)
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
            MarketCandlestickPanel(event: viewModel.selectedEvent)
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
