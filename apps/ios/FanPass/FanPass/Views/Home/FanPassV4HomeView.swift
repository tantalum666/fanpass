import SwiftUI

struct FanPassV4HomeView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @State private var viewModel = HomeViewModel()
    @State private var selectedWindow: HomeWindow?
    @State private var selectedHeroIndex = 0

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                brandHeader
                headlineSection
                searchBar
                sourceBanner
                heroSection
                popularSection
                justAnnouncedSection
                nextTicketSection
            }
            .padding(.horizontal, FPSpacing.lg)
            .padding(.top, FPSpacing.lg)
            .padding(.bottom, FPSpacing.threeXL + 96)
        }
        .background(FPColors.backgroundNight)
        .sheet(item: $selectedWindow) { window in
            HomeWindowSheet(window: window)
                .presentationDetents([.medium, .large])
        }
        .task(id: "\(backend.user.id)-\(backend.isAuthenticated)-\(backend.publicCatalogRefreshRevision)") {
            await viewModel.load(
                user: backend.user,
                isAuthenticated: backend.isAuthenticated,
                eventService: backend.eventService(),
                ticketService: backend.ticketService()
            )
        }
    }

    private var brandHeader: some View {
        HStack(spacing: FPSpacing.md) {
            FanPassHomeLogo()
            Text("FanPass")
                .font(FPTypography.title3)
                .foregroundStyle(FPColors.textPrimary)
            Spacer()
            homeIconButton("bell") { selectedWindow = .notifications }
            Button {
                selectedWindow = .guest
            } label: {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(FPColors.textPrimary, FPColors.surfaceGlass)
            }
            .buttonStyle(.plain)
        }
        .padding(.top, FPSpacing.sm)
    }

    private var headlineSection: some View {
        VStack(alignment: .leading, spacing: FPSpacing.xs) {
            Text(headlineGreeting)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textSecondary)
                .contentTransition(.opacity)
                .id(headlineGreeting)
            Text("Tonight in \(homeCity)")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(FPColors.textPrimary)
                .lineLimit(2)
                .minimumScaleFactor(0.82)
        }
    }

    private var homeCity: String {
        viewModel.featuredEvents.first?.venue.city ?? "Hong Kong"
    }

    private var headlineGreeting: String {
        guard backend.isAuthenticated else { return "Welcome" }
        let firstName = backend.user.displayName.split(separator: " ").first.map(String.init)
        return "Hey \(firstName ?? backend.user.displayName)"
    }

    private var searchBar: some View {
        Button {
            selectedWindow = .search
        } label: {
            HStack(spacing: FPSpacing.sm) {
                Image(systemName: "magnifyingglass")
                Text("Search events, artists, venues")
                Spacer()
                Image(systemName: "slider.horizontal.3")
            }
            .font(FPTypography.callout)
            .foregroundStyle(FPColors.textSecondary)
            .padding(.horizontal, FPSpacing.md)
            .padding(.vertical, FPSpacing.sm)
            .background(FPColors.surfaceGlass.opacity(0.58), in: Capsule())
            .overlay {
                Capsule()
                    .stroke(FPColors.borderDivider.opacity(0.52), lineWidth: 1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var sourceBanner: some View {
        if let sourceMessage = viewModel.sourceMessage {
            FPStateBanner(
                title: viewModel.isUsingSavedEvents ? "Saved events available" : "Could not refresh",
                message: sourceMessage,
                kind: .warning,
                actionTitle: "Refresh now"
            ) {
                Task {
                    await viewModel.load(
                        user: backend.user,
                        isAuthenticated: backend.isAuthenticated,
                        eventService: backend.eventService(),
                        ticketService: backend.ticketService()
                    )
                }
            }
        }
    }

    private var heroEvents: [FanPassV4.Event] {
        Array(viewModel.featuredEvents.prefix(5))
    }

    @ViewBuilder
    private var heroSection: some View {
        let events = heroEvents
        if !events.isEmpty {
            let selectedIndex = min(selectedHeroIndex, events.count - 1)
            let event = events[selectedIndex]
            VStack(spacing: FPSpacing.md) {
                NavigationLink {
                    FanPassV4EventDetailView(event: event)
                } label: {
                    FanPassHomeFeaturedCard(event: event)
                }
                .buttonStyle(.plain)
                .onChange(of: events.count) { _, newCount in
                    if selectedHeroIndex >= newCount {
                        selectedHeroIndex = max(0, newCount - 1)
                    }
                }

                HStack(spacing: FPSpacing.md) {
                    carouselStepButton(systemImage: "chevron.left") {
                        selectedHeroIndex = (selectedIndex + events.count - 1) % events.count
                    }
                    HeroCarouselDots(count: events.count, selectedIndex: selectedIndex) { index in
                        selectedHeroIndex = index
                    }
                    carouselStepButton(systemImage: "chevron.right") {
                        selectedHeroIndex = (selectedIndex + 1) % events.count
                    }
                }
                .frame(maxWidth: .infinity)
            }
        } else if viewModel.isLoading {
            ProgressView("Loading events")
                .tint(FPColors.pulseCyan)
                .frame(maxWidth: .infinity, minHeight: 240)
        } else {
            FPEmptyStateView(
                title: "No events available",
                message: "Published events will appear here when they are available.",
                systemImage: FPIcons.home
            )
            .frame(maxWidth: .infinity, minHeight: 220)
        }
    }

    @ViewBuilder
    private var nextTicketSection: some View {
        if let ticket = viewModel.nextTicket {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                FPSectionHeader(title: "Next ticket")
                NavigationLink {
                    FanPassV4TicketDetailView(ticket: ticket)
                } label: {
                    FPTicketCard(
                        eventTitle: ticket.event.title,
                        metadata: "\(ticket.event.dateLine) • \(ticket.event.venue.name)",
                        section: ticket.section,
                        row: ticket.row,
                        seat: ticket.seat,
                        ticketId: ticket.shortId,
                        statusTitle: ticket.status.title,
                        nfcReady: false,
                        entryModeTitle: "Entry ready"
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var popularSection: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Popular near you", actionTitle: "See all") { selectedWindow = .search }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: FPSpacing.md), GridItem(.flexible(), spacing: FPSpacing.md)], spacing: FPSpacing.md) {
                ForEach(Array(viewModel.featuredEvents.dropFirst().prefix(4))) { event in
                    NavigationLink {
                        FanPassV4EventDetailView(event: event)
                    } label: {
                        FanPassHomeEventTile(event: event)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var justAnnouncedSection: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Just announced", actionTitle: "See all") { selectedWindow = .search }
            ForEach(viewModel.featuredEvents.dropFirst(5).prefix(5)) { event in
                NavigationLink {
                    FanPassV4EventDetailView(event: event)
                } label: {
                    FanPassHomeAnnouncementRow(event: event)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func homeIconButton(_ systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(FPColors.textPrimary)
                .frame(width: 34, height: 34)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(systemImage)
    }

    private func carouselStepButton(systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(FPColors.textSecondary)
                .frame(width: 28, height: 28)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(systemImage == "chevron.left" ? "Previous event" : "Next event")
    }
}

private struct FanPassHomeLogo: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .fill(FPGradients.passAurora)
                .frame(width: 30, height: 30)
            Text("F")
                .font(.system(size: 20, weight: .black, design: .rounded))
                .foregroundStyle(FPColors.textPrimary)
        }
        .accessibilityLabel("FanPass")
    }
}

private struct FanPassHomeFeaturedCard: View {
    let event: FanPassV4.Event

    var body: some View {
        FanPassHomePoster(event: event, height: 360)
            .overlay(alignment: .topLeading) {
                FanPassHomeDateBadge(event: event)
                    .padding(FPSpacing.lg)
            }
            .overlay(alignment: .topTrailing) {
                Image(systemName: "heart")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(FPColors.textPrimary)
                    .frame(width: 42, height: 42)
                    .background(Color.black.opacity(0.38), in: Circle())
                    .padding(FPSpacing.lg)
            }
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: FPSpacing.md) {
                    HStack(spacing: FPSpacing.sm) {
                        FPStatusPill(
                            title: "Verified",
                            systemImage: FPIcons.verified,
                            foreground: FPColors.verifiedGreen,
                            background: Color.black.opacity(0.42),
                            border: Color.white.opacity(0.16)
                        )
                        FPStatusPill(
                            title: event.marketSummary.floorPriceLabel,
                            foreground: FPColors.textPrimary,
                            background: Color.black.opacity(0.42),
                            border: Color.white.opacity(0.16)
                        )
                    }
                    Text(event.title)
                        .font(.system(size: 31, weight: .bold, design: .rounded))
                        .foregroundStyle(FPColors.textPrimary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.74)
                    HStack(alignment: .center, spacing: FPSpacing.sm) {
                        Text("\(event.venue.name) · \(event.venue.city)")
                            .font(FPTypography.callout)
                            .foregroundStyle(Color.white.opacity(0.80))
                            .lineLimit(1)
                        Spacer(minLength: FPSpacing.sm)
                        Label("Tickets", systemImage: "arrow.right")
                            .font(FPTypography.caption.weight(.bold))
                            .foregroundStyle(FPColors.backgroundNight)
                            .padding(.horizontal, FPSpacing.md)
                            .padding(.vertical, FPSpacing.sm)
                            .background(FPColors.textPrimary, in: Capsule())
                    }
                }
                .padding(FPSpacing.lg)
            }
            .clipShape(RoundedRectangle(cornerRadius: FPRadius.xl, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPRadius.xl, style: .continuous)
                    .stroke(Color.white.opacity(0.10), lineWidth: 1)
            }
            .fpShadow(FPShadows.card)
    }
}

private struct HeroCarouselDots: View {
    let count: Int
    let selectedIndex: Int
    let onSelect: (Int) -> Void

    var body: some View {
        HStack(spacing: 7) {
            ForEach(0..<count, id: \.self) { index in
                Button {
                    onSelect(index)
                } label: {
                    Capsule()
                        .fill(index == selectedIndex ? FPColors.textPrimary : FPColors.borderDivider)
                        .frame(width: index == selectedIndex ? 18 : 7, height: 7)
                        .animation(.snappy(duration: 0.22), value: selectedIndex)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .accessibilityLabel("Featured event carousel")
    }
}

private struct FanPassHomeEventTile: View {
    let event: FanPassV4.Event

    var body: some View {
        VStack(alignment: .leading, spacing: FPSpacing.sm) {
            FanPassHomePoster(event: event, height: 148)
                .overlay(alignment: .topLeading) {
                    FanPassHomeDateBadge(event: event)
                        .scaleEffect(0.74, anchor: .topLeading)
                        .padding(FPSpacing.sm)
                }
                .clipShape(RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))

            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text(event.title)
                    .font(FPTypography.callout.weight(.semibold))
                    .foregroundStyle(FPColors.textPrimary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.78)
                Text("From \(event.marketSummary.floorPriceLabel)")
                    .font(FPTypography.caption.weight(.semibold))
                    .foregroundStyle(FPColors.pulseCyan)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
            }
        }
    }
}

private struct FanPassHomeAnnouncementRow: View {
    let event: FanPassV4.Event

    var body: some View {
        HStack(spacing: FPSpacing.md) {
            FanPassHomeDateBadge(event: event)
                .scaleEffect(0.78)
                .frame(width: 46, height: 58)
            FanPassHomePoster(event: event, height: 64)
                .frame(width: 70)
                .clipShape(RoundedRectangle(cornerRadius: FPRadius.sm, style: .continuous))
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text(event.title)
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                    .lineLimit(1)
                Text("\(event.venue.name)\n\(event.venue.city)")
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                    .lineLimit(2)
            }
            Spacer(minLength: FPSpacing.sm)
            VStack(alignment: .trailing, spacing: FPSpacing.xs) {
                Text("From")
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                Text(event.marketSummary.floorPriceLabel)
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.pulseCyan)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(FPColors.textSecondary)
        }
        .padding(.vertical, FPSpacing.sm)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(FPColors.borderDivider.opacity(0.42))
                .frame(height: 1)
                .padding(.leading, 132)
        }
    }
}

private struct FanPassHomePoster: View {
    let event: FanPassV4.Event
    let height: CGFloat

    var body: some View {
        ZStack {
            if let coverImage {
                Image(uiImage: coverImage)
                    .resizable()
                    .scaledToFill()
                    .overlay {
                        LinearGradient(
                            colors: [
                                Color.black.opacity(0.06),
                                Color.black.opacity(0.20),
                                Color.black.opacity(0.70)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    }
                    .overlay {
                        LinearGradient(
                            colors: [
                                Color(hex: UInt32(event.heroGradient.startHex)).opacity(0.18),
                                Color(hex: UInt32(event.heroGradient.endHex)).opacity(0.12)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    }
            } else {
                LinearGradient(
                    colors: [
                        Color(hex: UInt32(event.heroGradient.startHex)),
                        Color(hex: UInt32(event.heroGradient.endHex)),
                        FPColors.backgroundNight
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .overlay {
                    RadialGradient(
                        colors: [Color(hex: UInt32(event.heroGradient.accentHex)).opacity(0.58), .clear],
                        center: .center,
                        startRadius: 12,
                        endRadius: height * 0.72
                    )
                }
                .overlay(alignment: .bottomTrailing) {
                    Image(systemName: "music.mic")
                        .font(.system(size: height * 0.52, weight: .heavy))
                        .foregroundStyle(Color.white.opacity(0.18))
                        .rotationEffect(.degrees(-8))
                        .offset(x: height * 0.08, y: height * 0.08)
                }
                .overlay(alignment: .topTrailing) {
                    ForEach(0..<5) { index in
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(Color.white.opacity(0.16))
                            .frame(width: height * 0.62, height: 3)
                            .rotationEffect(.degrees(Double(index) * 12 + 18))
                            .offset(x: CGFloat(index) * -4, y: CGFloat(index) * 13)
                    }
                    .padding(FPSpacing.lg)
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: height, maxHeight: height)
        .clipped()
        .accessibilityLabel("Event artwork for \(event.title)")
    }

    private var coverImage: UIImage? {
        guard let coverAssetName = event.coverAssetName else { return nil }
        if let image = UIImage(named: coverAssetName) {
            return image
        }
        guard let url = Bundle.main.url(forResource: coverAssetName, withExtension: "png"),
              let data = try? Data(contentsOf: url)
        else {
            return nil
        }
        return UIImage(data: data)
    }
}

private struct FanPassHomeDateBadge: View {
    let event: FanPassV4.Event

    private var month: String {
        event.startTime.formatted(.dateTime.month(.abbreviated)).uppercased()
    }

    private var day: String {
        event.startTime.formatted(.dateTime.day(.twoDigits))
    }

    private var weekday: String {
        event.startTime.formatted(.dateTime.weekday(.abbreviated)).uppercased()
    }

    var body: some View {
        VStack(spacing: 0) {
            Text(month)
                .font(.system(size: 12, weight: .bold, design: .rounded))
            Text(day)
                .font(.system(size: 28, weight: .black, design: .rounded))
            Text(weekday)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
        }
        .foregroundStyle(FPColors.backgroundNight)
        .frame(width: 58, height: 74)
        .background(Color.white.opacity(0.94), in: RoundedRectangle(cornerRadius: FPRadius.sm, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.sm, style: .continuous)
                .stroke(Color.white.opacity(0.5), lineWidth: 1)
        }
    }
}

private enum HomeWindow: String, Identifiable {
    case search
    case notifications
    case location
    case guest
    case empty

    var id: String { rawValue }
}

private struct HomeWindowSheet: View {
    let window: HomeWindow
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            FanPassV4Scaffold(title: title, subtitle: subtitle) {
                content
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch window {
        case .search:
            HomeSearchSheetContent()
        case .notifications:
            FPConceptRowList(rows: [
                .init(id: "drop", icon: "bell.badge.fill", title: "New drop", subtitle: "A saved artist announced a verified event.", value: "Now", kind: .info),
                .init(id: "ticket", icon: FPIcons.tickets, title: "Entry code ready", subtitle: "Open Tickets before arriving at the gate.", value: "Today", kind: .success),
                .init(id: "cap", icon: FPIcons.resale, title: "Price cap alert", subtitle: "A resale ticket moved below your target.", value: "HK$1,360", kind: .warning)
            ])
        case .location:
            FPConceptMapCard(title: "Location and currency", subtitle: "City-level discovery only", pins: ["HK", "SG", "Tokyo"])
        case .guest:
            FPEmptyStateView(title: "Login", message: "Browse events first. Tickets, alerts, orders, and entry codes require sign-in.", systemImage: FPIcons.profile)
        case .empty:
            FPEmptyStateView(title: "Low-data Home", message: "When recommendations are sparse, Home shows search, upcoming ticket, and trust education only.", systemImage: FPIcons.empty)
        }
    }

    private var title: String {
        switch window {
        case .search: "Search"
        case .notifications: "Notifications"
        case .location: "Location"
        case .guest: "Login"
        case .empty: "Low-data Home"
        }
    }

    private var subtitle: String {
        switch window {
        case .search: "Search events, artists, venues, and safe resale."
        case .notifications: "Important updates without account clutter."
        case .location: "City-level context; no precise personal coordinates."
        case .guest: "Signed-out browsing state."
        case .empty: "Recovery state for sparse recommendations."
        }
    }
}

private struct HomeSearchSheetContent: View {
    @Environment(\.dismiss) private var dismiss
    @FocusState private var searchFocused: Bool
    @State private var query = ""
    @State private var selectedFilters: Set<HomeSearchFilter> = []

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var resultRows: [FPConceptRow] {
        let term = trimmedQuery.isEmpty ? "Recommended" : trimmedQuery
        let filterSummary = selectedFilters.isEmpty ? "All verified events" : selectedFilters.map(\.title).joined(separator: ", ")
        return [
            .init(id: "events", icon: "music.mic.circle.fill", title: "\(term) events", subtitle: filterSummary, value: "Events", kind: .info),
            .init(id: "venues", icon: "building.2.crop.circle.fill", title: "Venues and artists", subtitle: "Matches event titles, artists, venues, and cities.", value: "Browse"),
            .init(id: "resale", icon: FPIcons.resale, title: "Verified resale", subtitle: "Only safe resale listings within organizer rules.", value: "Safe", kind: .success)
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FPSpacing.xl) {
            searchInput
            filterSection
            FPSectionHeader(title: trimmedQuery.isEmpty ? "Suggested results" : "Search results", subtitle: resultSubtitle)
            FPConceptRowList(rows: resultRows)
            FPPrimaryButton(title: "Apply search", systemImage: "checkmark.circle.fill") {
                dismiss()
            }
        }
        .onAppear {
            searchFocused = true
        }
    }

    private var searchInput: some View {
        HStack(spacing: FPSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(FPColors.textSecondary)
            TextField("Search events, artists, venues", text: $query)
                .font(FPTypography.body)
                .foregroundStyle(FPColors.textPrimary)
                .textInputAutocapitalization(.words)
                .focused($searchFocused)
                .submitLabel(.search)
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(FPColors.textSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(FPSpacing.md)
        .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }

    private var filterSection: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Filters", subtitle: "Choose one or more filters before applying.")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 138), spacing: FPSpacing.sm)], spacing: FPSpacing.sm) {
                ForEach(HomeSearchFilter.allCases) { filter in
                    HomeSearchFilterButton(filter: filter, isSelected: selectedFilters.contains(filter)) {
                        if selectedFilters.contains(filter) {
                            selectedFilters.remove(filter)
                        } else {
                            selectedFilters.insert(filter)
                        }
                    }
                }
            }
        }
    }

    private var resultSubtitle: String {
        if trimmedQuery.isEmpty && selectedFilters.isEmpty {
            return "Type above or pick filters to narrow discovery."
        }
        return "Filtered by \(selectedFilters.isEmpty ? "search text" : selectedFilters.map(\.title).joined(separator: ", "))."
    }
}

private enum HomeSearchFilter: String, CaseIterable, Identifiable, Hashable {
    case tonight
    case weekend
    case under800
    case fanAccess
    case verifiedResale
    case hongKong

    var id: String { rawValue }

    var title: String {
        switch self {
        case .tonight: "Tonight"
        case .weekend: "Weekend"
        case .under800: "Under HK$800"
        case .fanAccess: "Fan Access"
        case .verifiedResale: "Verified resale"
        case .hongKong: "Hong Kong"
        }
    }

    var systemImage: String {
        switch self {
        case .tonight: "moon.fill"
        case .weekend: "calendar"
        case .under800: "tag.fill"
        case .fanAccess: FPIcons.fanAccess
        case .verifiedResale: FPIcons.resale
        case .hongKong: "location.fill"
        }
    }

    var tint: Color {
        switch self {
        case .tonight: FPColors.electricViolet
        case .weekend: FPColors.pulseCyan
        case .under800: FPColors.verifiedGreen
        case .fanAccess: FPColors.neonMagenta
        case .verifiedResale: FPColors.warningAmber
        case .hongKong: FPColors.textPrimary
        }
    }
}

private struct HomeSearchFilterButton: View {
    let filter: HomeSearchFilter
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FPSpacing.xs) {
                Image(systemName: filter.systemImage)
                    .font(.system(size: 14, weight: .semibold))
                Text(filter.title)
                    .font(FPTypography.caption)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                Spacer(minLength: 0)
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(isSelected ? FPColors.backgroundNight : filter.tint)
            .padding(.horizontal, FPSpacing.md)
            .padding(.vertical, FPSpacing.sm)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(isSelected ? filter.tint : filter.tint.opacity(0.12), in: RoundedRectangle(cornerRadius: FPRadius.sm, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPRadius.sm, style: .continuous)
                    .stroke(filter.tint.opacity(isSelected ? 0.7 : 0.35), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NavigationStack {
        FanPassV4HomeView()
    }
}
