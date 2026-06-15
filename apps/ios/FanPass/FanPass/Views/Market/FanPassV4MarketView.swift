import SwiftUI

struct FanPassV4MarketView: View {
    @Environment(FanPassRootViewModel.self) private var appViewModel
    @Environment(FanPassBackendContext.self) private var backend
    @State private var viewModel = MarketViewModel()
    @State private var selectedMode: MarketMode = .overview
    @State private var selectedListing: FanPassV4.ResaleListing?
    @State private var selectedTicketTypeID: String?
    @State private var showBuyFlow = false
    @State private var showSellFlow = false

    var body: some View {
        GeometryReader { geometry in
            VStack(alignment: .leading, spacing: FPSpacing.xl) {
                tradingPanel
            }
            .frame(width: geometry.size.width, height: geometry.size.height, alignment: .top)
            .padding(.horizontal, 0)
            .padding(.top, 0)
            .padding(.bottom, FPSpacing.threeXL + 96)
        }
        .background(FPColors.surfaceCard.ignoresSafeArea(edges: .top))
        .ignoresSafeArea(edges: .top)
        .safeAreaInset(edge: .bottom) {
            marketActionBar
        }
        .sheet(item: $selectedListing) { listing in
            NavigationStack {
                FanPassV4ResaleReviewView(listing: listing)
            }
            .presentationDetents([.large])
        }
        .sheet(isPresented: $showBuyFlow) {
            NavigationStack {
                FanPassV4BuyOrderSheet(
                    event: viewModel.selectedEvent,
                    ticketType: selectedMarketTicketType,
                    listings: viewModel.listings,
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
        .sheet(isPresented: $showSellFlow) {
            NavigationStack {
                FanPassV4ListTicketView(ticket: selectedEventTicket)
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button {
                                showSellFlow = false
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
        .onChange(of: appViewModel.focusedMarketEvent?.id) { _, _ in
            applyFocusedMarketEvent()
        }
    }

    private var tradingPanel: some View {
        MarketTradingPanel(
            event: viewModel.selectedEvent,
            events: viewModel.availableEvents,
            selectedTicketTypeID: selectedTicketTypeID
        ) { event in
            viewModel.selectedEvent = event
            selectedTicketTypeID = event.safePrimaryTicketType.id
        } onSelectTicketType: { ticketType in
            selectedTicketTypeID = ticketType.id
        }
    }

    @ViewBuilder
    private var supplementalContent: some View {
        switch selectedMode {
        case .listings:
            listings
        case .sell:
            FanPassV4ListTicketView(ticket: FanPassMockData.tickets.first)
        case .overview, .eventMarket, .states:
            EmptyView()
        }
    }

    private var eventMarket: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Ticket types", subtitle: "Face value, floor, cap, and availability")
            ForEach(viewModel.selectedEvent.ticketTypes) { ticketType in
                FPSurfaceCard(cornerRadius: FPRadius.md) {
                    VStack(alignment: .leading, spacing: FPSpacing.md) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                                Text(ticketType.name)
                                    .font(FPTypography.headline)
                                    .foregroundStyle(FPColors.textPrimary)
                                Text(ticketType.transferRule.summary)
                                    .font(FPTypography.caption)
                                    .foregroundStyle(FPColors.textSecondary)
                            }
                            Spacer()
                            Text(ticketType.priceLabel)
                                .font(FPTypography.title3)
                                .foregroundStyle(FPColors.textPrimary)
                                .monospacedDigit()
                        }
                        FPConceptProgressBar(
                            title: "Availability",
                            value: Double(ticketType.availableQuantity) / Double(max(ticketType.supply, 1)),
                            caption: "\(ticketType.availableQuantity) of \(ticketType.supply) remaining",
                            accent: FPColors.verifiedGreen
                        )
                    }
                }
            }

            NavigationLink {
                FanPassV4OrderbookDetailView(viewModel: viewModel)
            } label: {
                FPConceptRowView(row: .init(id: "orderbook", icon: FPIcons.market, title: "View plain-language orderbook", subtitle: "Fan bids, resale asks, last sale, and cap context.", value: "Open", kind: .info))
            }
            .buttonStyle(.plain)
        }
    }

    private var listings: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Available resale tickets", subtitle: "Seller identity remains safe and generalized")
            if viewModel.listings.isEmpty {
                FPEmptyStateView(title: "No listings available", message: "This event has no open resale tickets under organizer rules.", systemImage: FPIcons.market)
                    .frame(maxWidth: .infinity)
                    .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
            } else {
                ForEach(viewModel.listings) { listing in
                    Button {
                        selectedListing = listing
                    } label: {
                        FPEditorialEventRow(
                            event: listing.ticket.event,
                            trailingValue: listing.priceLabel,
                            subtitle: "Section \(listing.ticket.section), Row \(listing.ticket.row), Seat \(listing.ticket.seat)"
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var marketStates: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Market windows and guardrails")
            FPConceptRowList(rows: [
                .init(id: "reserved", icon: "timer", title: "Reserved listing", subtitle: "A buyer temporarily reserves one resale ticket.", value: "05:00", kind: .warning),
                .init(id: "unavailable", icon: FPIcons.error, title: "Listing unavailable", subtitle: "Another buyer matched it or seller cancelled.", value: "Closed", kind: .danger),
                .init(id: "cap", icon: "lock.shield.fill", title: "Cap validation", subtitle: "Seller cannot submit a price above organizer rules.", value: "Enforced", kind: .success),
                .init(id: "proof", icon: FPIcons.verified, title: "Ticket checks", subtitle: "Seller and ticket status are checked before purchase.", value: "Checked", kind: .neutral)
            ])
        }
    }

    private var marketActionBar: some View {
        HStack(spacing: FPSpacing.md) {
            Button {
                withAnimation(.spring(response: 0.26, dampingFraction: 0.82)) {
                    selectedMode = .listings
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
                withAnimation(.spring(response: 0.26, dampingFraction: 0.82)) {
                    selectedMode = .sell
                    showSellFlow = true
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

    private var selectedEventTicket: FanPassV4.Ticket? {
        FanPassMockData.tickets.first { $0.event.id == viewModel.selectedEvent.id } ?? FanPassMockData.tickets.first
    }

    private var selectedMarketTicketType: FanPassV4.TicketType {
        viewModel.selectedEvent.ticketTypes.first { $0.id == selectedTicketTypeID } ?? viewModel.selectedEvent.safePrimaryTicketType
    }

    private var selectedMarketContext: MarketPricingSnapshot {
        MarketPricingSnapshot(event: viewModel.selectedEvent, ticketType: selectedMarketTicketType)
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

}

private struct MarketTradingPanel: View {
    let event: FanPassV4.Event
    let events: [FanPassV4.Event]
    let selectedTicketTypeID: String?
    let onSelectEvent: (FanPassV4.Event) -> Void
    let onSelectTicketType: (FanPassV4.TicketType) -> Void
    @State private var selectedRange: MarketTimeRange = .oneDay
    @State private var eventSearchQuery = ""

    private var selectedTicketType: FanPassV4.TicketType {
        event.ticketTypes.first { $0.id == selectedTicketTypeID } ?? event.safePrimaryTicketType
    }

    private var marketContext: MarketPricingSnapshot {
        MarketPricingSnapshot(event: event, ticketType: selectedTicketType)
    }

    private var candles: [MarketCandle] {
        marketContext.candles(for: selectedRange)
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
                        Text("Cap 110%")
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
                            .foregroundStyle(marketContext.trend.color)
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

                HStack(spacing: FPSpacing.sm) {
                    ForEach(MarketTimeRange.allCases) { range in
                        Button {
                            selectedRange = range
                        } label: {
                            Text(range.title)
                                .font(FPTypography.caption.weight(range == selectedRange ? .bold : .medium))
                                .foregroundStyle(range == selectedRange ? FPColors.backgroundNight : FPColors.textSecondary)
                                .padding(.horizontal, FPSpacing.sm)
                                .padding(.vertical, 6)
                                .background(range == selectedRange ? FPColors.textPrimary : FPColors.surfaceGlass, in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    Spacer()
                    Image(systemName: "chart.xyaxis.line")
                        .foregroundStyle(FPColors.pulseCyan)
                }

                MarketCandlestickCanvas(candles: candles, cap: marketContext.cap)
                    .id("\(event.id)-\(selectedTicketType.id)-\(selectedRange.id)")
                    .frame(maxHeight: .infinity)
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
        let context = MarketPricingSnapshot(event: event, ticketType: ticketType)
        let isSelected = ticketType.id == selectedTicketType.id
        return Button {
            onSelectTicketType(ticketType)
        } label: {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 4) {
                    Text(ticketType.name)
                        .font(FPTypography.caption.weight(.bold))
                        .lineLimit(1)
                    Text(context.trend.title)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(isSelected ? FPColors.backgroundNight.opacity(0.82) : context.trend.color)
                }
                Text("\(context.floorLabel) • \(context.premiumLabel)")
                    .font(.system(size: 10, weight: .semibold))
                    .monospacedDigit()
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? FPColors.backgroundNight : FPColors.textSecondary)
            .frame(width: 122, height: 48, alignment: .leading)
            .padding(.horizontal, FPSpacing.sm)
            .background(isSelected ? context.trend.color : FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                    .stroke(isSelected ? context.trend.color.opacity(0.9) : FPColors.borderDivider, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }

}

private struct MarketPricingSnapshot {
    let event: FanPassV4.Event
    let ticketType: FanPassV4.TicketType

    var cap: Int {
        ticketType.transferRule.resaleCap ?? event.marketSummary.organizerCap
    }

    var currency: String {
        ticketType.currency
    }

    var trend: MarketTrendDirection {
        switch (eventIndex + ticketTypeIndex) % 3 {
        case 0:
            return .rising
        case 1:
            return .flat
        default:
            return .falling
        }
    }

    var floorPrice: Int {
        price(at: MarketTimeRange.oneDay.pointCount - 1, range: .oneDay)
    }

    var floorLabel: String {
        MoneyFormatter.format(floorPrice, currency: currency)
    }

    var bestBidLabel: String {
        MoneyFormatter.format(max(1, floorPrice - max(12, ticketType.faceValue / 34)), currency: currency)
    }

    var bestAskLabel: String {
        MoneyFormatter.format(min(cap, floorPrice + max(16, ticketType.faceValue / 28)), currency: currency)
    }

    var lastSaleLabel: String {
        MoneyFormatter.format(price(at: max(MarketTimeRange.oneDay.pointCount - 2, 0), range: .oneDay), currency: currency)
    }

    var premiumLabel: String {
        guard ticketType.faceValue > 0 else { return "0%" }
        let premium = Double(floorPrice - ticketType.faceValue) / Double(ticketType.faceValue)
        return premium.formatted(.percent.precision(.fractionLength(0)))
    }

    func candles(for range: MarketTimeRange) -> [MarketCandle] {
        let count = range.pointCount
        var previous = price(at: 0, range: range)
        return (0..<count).map { index in
            let close = price(at: index, range: range)
            let open = index == 0 ? max(1, close - trend.openBias(seed: seed)) : previous
            let wickPad = range.wickBase + ((index + seed) % 4) * range.wickStep
            let high = min(max(open, close) + wickPad, cap)
            let low = max(min(open, close) - wickPad, max(1, Int(Double(ticketType.faceValue) * 0.72)))
            previous = close
            return MarketCandle(
                id: "\(event.id)_\(ticketType.id)_\(range.rawValue)_\(index)",
                label: range.label(for: index),
                open: open,
                close: close,
                high: high,
                low: low,
                volume: range.volumeBase + (((index + seed) * range.volumeStep) % 28)
            )
        }
    }

    private func price(at index: Int, range: MarketTimeRange) -> Int {
        let count = max(range.pointCount, 1)
        let progress = Double(index) / Double(max(count - 1, 1))
        let seededPhase = Double(seed % 9) * 0.31
        let wave = sin((Double(index) * range.waveStep) + seededPhase) * range.waveAmplitude
        let tierNudge = ticketTypeIndex == 0 ? 0.0 : Double(ticketTypeIndex) * 0.006
        let multiplier = trend.multiplier(progress: progress, wave: wave, tierNudge: tierNudge)
        return min(max(1, Int((Double(ticketType.faceValue) * multiplier).rounded())), cap)
    }

    private var eventIndex: Int {
        FanPassMockData.events.firstIndex { $0.id == event.id } ?? 0
    }

    private var ticketTypeIndex: Int {
        event.ticketTypes.firstIndex { $0.id == ticketType.id } ?? 0
    }

    private var seed: Int {
        (event.id + ticketType.id).unicodeScalars.reduce(0) { partial, scalar in
            ((partial * 31) + Int(scalar.value)) % 100_000
        }
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

private enum FanPassV4BuyOrderMode: String, CaseIterable, Identifiable {
    case market
    case limit

    var id: String { rawValue }

    var title: String {
        switch self {
        case .market: "Market"
        case .limit: "Limit"
        }
    }

    var explanation: String {
        switch self {
        case .market:
            "Market buys use the current lowest available resale price and are intended to complete immediately if inventory is still available."
        case .limit:
            "Limit orders only match when a seller lists at or below your price; otherwise the order waits in the market."
        }
    }
}

private struct FanPassV4BuyOrderSheet: View {
    let event: FanPassV4.Event
    let ticketType: FanPassV4.TicketType
    let listings: [FanPassV4.ResaleListing]
    let bestAsk: String
    let onAuthRequired: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var mode: FanPassV4BuyOrderMode = .market
    @State private var limitPrice: String
    @State private var submittedMessage: String?
    @State private var showCheckout = false

    private var eventListings: [FanPassV4.ResaleListing] {
        listings.filter { $0.ticket.event.id == event.id && $0.ticket.ticketType.id == ticketType.id }
    }

    private var lowestListing: FanPassV4.ResaleListing? {
        eventListings.min { $0.price < $1.price }
    }

    private var capLabel: String {
        MoneyFormatter.format(ticketType.transferRule.resaleCap ?? event.marketSummary.organizerCap, currency: ticketType.currency)
    }

    private var marketCheckoutPrice: Int {
        lowestListing?.price ?? MarketPricingSnapshot(event: event, ticketType: ticketType).floorPrice
    }

    init(event: FanPassV4.Event, ticketType: FanPassV4.TicketType, listings: [FanPassV4.ResaleListing], bestAsk: String, onAuthRequired: @escaping () -> Void) {
        self.event = event
        self.ticketType = ticketType
        self.listings = listings
        self.bestAsk = bestAsk
        self.onAuthRequired = onAuthRequired
        _limitPrice = State(initialValue: "\(MarketPricingSnapshot(event: event, ticketType: ticketType).floorPrice)")
    }

    var body: some View {
        FanPassV4Scaffold(title: "Buy", subtitle: "\(event.title) • \(ticketType.name)") {
            FPSurfaceCard {
                VStack(alignment: .leading, spacing: FPSpacing.lg) {
                    HStack(spacing: FPSpacing.sm) {
                        ForEach(FanPassV4BuyOrderMode.allCases) { candidate in
                            Button {
                                mode = candidate
                                submittedMessage = nil
                                showCheckout = false
                            } label: {
                                Text(candidate.title)
                                    .font(FPTypography.callout.weight(.bold))
                                    .foregroundStyle(mode == candidate ? FPColors.backgroundNight : FPColors.textSecondary)
                                    .frame(maxWidth: .infinity, minHeight: 42)
                                    .background(mode == candidate ? FPColors.pulseCyan : FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    Text(mode.explanation)
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)

                    if mode == .market {
                        marketOrderContent
                    } else {
                        limitOrderContent
                    }

                    if let submittedMessage {
                        FPConfirmationCard(title: "Limit order placed", message: submittedMessage)
                    }
                }
            }

            FPSecondaryButton(title: "Close", systemImage: "xmark.circle.fill") {
                dismiss()
            }
        }
        .navigationDestination(isPresented: $showCheckout) {
            FanPassV4CheckoutView(
                event: event,
                ticketType: ticketType,
                quotedPrice: marketCheckoutPrice,
                priceLineTitle: "Market price",
                onAuthRequired: onAuthRequired
            )
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var marketOrderContent: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPConceptRowList(rows: [
                .init(id: "tier", icon: "rectangle.3.group.fill", title: "Seat tier", subtitle: "Selected market category.", value: ticketType.name, kind: .info),
                .init(id: "bestAsk", icon: "arrow.down.circle.fill", title: "Estimated fill", subtitle: "Lowest available resale now.", value: lowestListing?.priceLabel ?? bestAsk, kind: .success),
                .init(id: "cap", icon: "lock.shield.fill", title: "Cap guard", subtitle: "Organizer resale limit stays enforced.", value: capLabel, kind: .info)
            ])

            Button {
                showCheckout = true
            } label: {
                Label("Buy at market", systemImage: "bolt.fill")
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.backgroundNight)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(FPColors.verifiedGreen, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(lowestListing == nil)
            .opacity(lowestListing == nil ? 0.55 : 1)
        }
    }

    private var limitOrderContent: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            VStack(alignment: .leading, spacing: FPSpacing.sm) {
                Text("Limit price")
                    .font(FPTypography.caption.weight(.semibold))
                    .foregroundStyle(FPColors.textSecondary)
                HStack(spacing: FPSpacing.sm) {
                    Text("HK$")
                        .font(FPTypography.title3)
                        .foregroundStyle(FPColors.textSecondary)
                    TextField("Enter price", text: $limitPrice)
                        .keyboardType(.numberPad)
                        .font(.system(size: 28, weight: .black, design: .rounded))
                        .foregroundStyle(FPColors.textPrimary)
                        .monospacedDigit()
                }
                .padding(FPSpacing.md)
                .background(FPColors.backgroundNight, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                        .stroke(FPColors.borderDivider, lineWidth: 1)
                }
            }

            FPConceptRowList(rows: [
                .init(id: "bestAsk", icon: "tag.fill", title: "Current lowest ask", subtitle: "Useful reference before placing a limit order.", value: lowestListing?.priceLabel ?? bestAsk, kind: .info),
                .init(id: "cap", icon: "lock.shield.fill", title: "Maximum allowed", subtitle: "Limit orders above cap should be rejected.", value: capLabel, kind: .warning)
            ])

            Button {
                submittedMessage = "Limit order placed at HK$\(limitPrice). It waits until a seller accepts this price or lower."
            } label: {
                Label("Place limit order", systemImage: "text.badge.plus")
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(FPColors.neonMagenta.opacity(0.92), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(limitPrice.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(limitPrice.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.55 : 1)
        }
    }
}

struct FanPassV4ResaleReviewView: View {
    let listing: FanPassV4.ResaleListing
    @Environment(\.dismiss) private var dismiss
    @State private var reserved = true
    @State private var confirmed = false

    var body: some View {
        FanPassV4Scaffold(title: "Confirm resale order", subtitle: listing.ticket.event.title) {
            FPTicketCard(
                eventTitle: listing.ticket.event.title,
                metadata: "\(listing.ticket.event.dateLine) • \(listing.ticket.event.venue.name)",
                section: listing.ticket.section,
                row: listing.ticket.row,
                seat: listing.ticket.seat,
                ticketId: listing.ticket.shortId,
                statusTitle: "Reserved",
                nfcReady: false,
                entryModeTitle: "QR after transfer"
            )
            FPConceptRowList(rows: [
                .init(id: "price", icon: "tag.fill", title: "Resale price", subtitle: "Shown before secure checkout.", value: listing.priceLabel, kind: .info),
                .init(id: "fee", icon: "creditcard.fill", title: "Estimated fee", subtitle: "Transparent before confirmation.", value: MoneyFormatter.format(listing.feeEstimate, currency: listing.currency)),
                .init(id: "proof", icon: FPIcons.verified, title: "Ticket checks", subtitle: "Seller and ticket status are checked before purchase.", value: "Checked", kind: .success)
            ])
            if reserved {
                FPStateBanner(title: "Listing reserved", message: "This resale ticket is held while you confirm the order.", kind: .warning)
            }
            if confirmed {
                FPConfirmationCard(title: "Resale order confirmed", message: "The ticket transfer is reflected in Tickets after settlement.")
            }
            FPPrimaryButton(title: confirmed ? "Confirmed" : "Confirm resale order", systemImage: FPIcons.verified) {
                confirmed = true
                reserved = false
            }
            .disabled(confirmed)
            FPSecondaryButton(title: "Close", systemImage: "xmark.circle.fill") {
                dismiss()
            }
        }
    }
}

struct FanPassV4ListTicketView: View {
    let ticket: FanPassV4.Ticket?
    @State private var listed = false
    @State private var cancelled = false
    @State private var selectedPrice: Double
    @State private var autoRelist = false
    @State private var smartPricing = true

    private var selectedTicket: FanPassV4.Ticket {
        ticket ?? FanPassMockData.tickets.first!
    }

    init(ticket: FanPassV4.Ticket?) {
        self.ticket = ticket
        let fallback = ticket ?? FanPassMockData.tickets.first!
        _selectedPrice = State(initialValue: Double(min(fallback.event.marketSummary.floorPrice, fallback.ticketType.transferRule.resaleCap ?? fallback.event.marketSummary.floorPrice)))
    }

    private var suggestedPrice: Int {
        Int(selectedPrice)
    }

    private var platformFee: Int { max(28, Int(Double(suggestedPrice) * 0.035)) }
    private var resaleCap: Int { selectedTicket.ticketType.transferRule.resaleCap ?? suggestedPrice }
    private var canList: Bool {
        selectedTicket.status.allowsResale &&
            selectedTicket.ticketType.transferRule.transferable &&
            suggestedPrice <= resaleCap
    }

    var body: some View {
        FanPassV4Scaffold(title: "List ticket", subtitle: "Set a price inside organizer rules.") {
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
                        .init(id: "cap", icon: "lock.shield.fill", title: "Organizer cap", subtitle: selectedTicket.ticketType.transferRule.summary, value: MoneyFormatter.format(resaleCap, currency: selectedTicket.ticketType.currency), kind: .warning)
                    ])
                    Stepper(
                        "Listing price: \(MoneyFormatter.format(suggestedPrice, currency: selectedTicket.ticketType.currency))",
                        value: $selectedPrice,
                        in: 0...Double(resaleCap + 300),
                        step: 20
                    )
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textPrimary)
                    .tint(FPColors.pulseCyan)
                }
            }

            FPConceptRowList(rows: [
                .init(id: "fee", icon: "creditcard.fill", title: "Platform fee", subtitle: "Visible before submitting.", value: MoneyFormatter.format(platformFee, currency: selectedTicket.ticketType.currency)),
                .init(id: "payout", icon: "banknote.fill", title: "Estimated payout", subtitle: "After fee and settlement.", value: MoneyFormatter.format(suggestedPrice - platformFee, currency: selectedTicket.ticketType.currency), kind: .success)
            ])

            Toggle("Smart pricing guard", isOn: $smartPricing)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textPrimary)
                .tint(FPColors.pulseCyan)
            Toggle("Auto relist if buyer times out", isOn: $autoRelist)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textPrimary)
                .tint(FPColors.pulseCyan)

            if suggestedPrice > resaleCap {
                FPStateBanner(title: "Price above cap", message: "Lower the price before listing. Organizer cap is \(MoneyFormatter.format(resaleCap, currency: selectedTicket.ticketType.currency)).", kind: .danger)
            }

            if !selectedTicket.status.allowsResale {
                FPStateBanner(title: "\(selectedTicket.status.title) ticket", message: "Only active tickets can be listed for resale.", kind: .warning)
            }

            if listed {
                FPConfirmationCard(title: "Listing created", message: "Entry code is unavailable while the listing is open.")
                FPSecondaryButton(title: "Cancel listing", systemImage: "xmark.circle.fill") {
                    listed = false
                    cancelled = true
                }
            } else if cancelled {
                FPStateBanner(title: "Listing cancelled", message: "The ticket returns to its wallet state.", kind: .success)
            }

            FPPrimaryButton(title: listed ? "Listing submitted" : "Submit listing", systemImage: listed ? FPIcons.verified : FPIcons.resale) {
                guard canList else { return }
                listed = true
                cancelled = false
            }
            .disabled(!canList || listed)
        }
    }
}

#Preview {
    NavigationStack {
        FanPassV4MarketView()
    }
}
