import SwiftUI

/// Search and filters for the published event catalog.
///
/// Query and city live on the root model so discovery intent survives the
/// Home → Explore tab handoff instead of resetting at the navigation boundary.
struct FanPassV5ExploreView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel
    @State private var viewModel = ExploreViewModel()
    @State private var query = ""
    @State private var selectedCategory: FanPassV4.EventCategory?
    @State private var selectedCity: String?
    @FocusState private var isSearchFocused: Bool

    private var filteredEvents: [FanPassV4.Event] {
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return viewModel.events.filter { event in
            let matchesQuery = trimmedQuery.isEmpty ||
                event.title.localizedCaseInsensitiveContains(trimmedQuery) ||
                event.venue.city.localizedCaseInsensitiveContains(trimmedQuery) ||
                event.venue.name.localizedCaseInsensitiveContains(trimmedQuery) ||
                event.category.title.localizedCaseInsensitiveContains(trimmedQuery)
            let matchesCategory = selectedCategory == nil || event.category == selectedCategory
            let matchesCity = selectedCity == nil || event.venue.city == selectedCity
            return matchesQuery && matchesCategory && matchesCity
        }
    }

    private var categories: [FanPassV4.EventCategory] {
        FanPassV4.EventCategory.allCases.filter { category in
            viewModel.events.contains { $0.category == category }
        }
    }

    private var cities: [String] {
        Array(Set(viewModel.events.map(\.venue.city))).sorted()
    }

    private var fanAccessEvents: [FanPassV4.Event] {
        filteredEvents.filter(\.fanAccessAvailable)
    }

    private var hasActiveFilters: Bool {
        !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            selectedCategory != nil || selectedCity != nil
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                pageHeader
                searchField
                filterBar
                sourceBanner
                fanAccessShortcut
                eventResults
            }
            .padding(.horizontal, FPV5Metrics.pageHorizontal)
            .padding(.top, 16)
            .padding(.bottom, 116)
        }
        .background(FPV5Colors.ink.ignoresSafeArea())
        .task(id: backend.publicCatalogRefreshRevision) {
            await viewModel.load(eventService: backend.eventService())
        }
        .onAppear {
            query = appViewModel.discoveryQuery
            selectedCity = appViewModel.discoveryCity
            focusSearchIfRequested()
        }
        .onChange(of: appViewModel.discoveryQuery) {
            query = appViewModel.discoveryQuery
        }
        .onChange(of: appViewModel.discoveryCity) {
            selectedCity = appViewModel.discoveryCity
        }
        .onChange(of: appViewModel.shouldFocusDiscoverySearch) {
            focusSearchIfRequested()
        }
        .onChange(of: query) {
            appViewModel.discoveryQuery = query
        }
        .onChange(of: selectedCity) {
            appViewModel.discoveryCity = selectedCity
        }
    }

    private var pageHeader: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("DISCOVER LIVE EVENTS")
                .font(FPV5Typography.caption)
                .foregroundStyle(FPV5Colors.signalRed)
            Text("Explore")
                .font(FPV5Typography.editorialDisplay)
                .foregroundStyle(FPV5Colors.warmWhite)
            Text("Search the published catalog by event, venue, city, or category.")
                .font(FPV5Typography.callout)
                .foregroundStyle(FPV5Colors.darkSecondary)
        }
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(FPV5Colors.darkSecondary)
            TextField("Events, venues, cities", text: $query)
                .focused($isSearchFocused)
                .font(FPV5Typography.body)
                .foregroundStyle(FPV5Colors.warmWhite)
                .textInputAutocapitalization(.words)
                .submitLabel(.search)
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(FPV5Colors.darkSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 50)
        .background(FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous)
                .stroke(isSearchFocused ? FPV5Colors.signalRed : FPV5Colors.darkHairline, lineWidth: 1)
        }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Menu {
                    Button("All cities") { selectedCity = nil }
                    ForEach(cities, id: \.self) { city in
                        Button(city) { selectedCity = city }
                    }
                } label: {
                    filterMenuLabel(
                        title: selectedCity ?? "All cities",
                        systemImage: "mappin.and.ellipse",
                        isSelected: selectedCity != nil
                    )
                }

                FanPassV5FilterChip(title: "All", isSelected: selectedCategory == nil) {
                    selectedCategory = nil
                }
                ForEach(categories, id: \.self) { category in
                    FanPassV5FilterChip(
                        title: category.title,
                        isSelected: selectedCategory == category
                    ) {
                        selectedCategory = selectedCategory == category ? nil : category
                    }
                }
            }
        }
    }

    private func filterMenuLabel(title: String, systemImage: String, isSelected: Bool) -> some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
            Text(title).lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.system(size: 9, weight: .bold))
        }
        .font(FPV5Typography.caption)
        .foregroundStyle(isSelected ? FPV5Colors.paper : FPV5Colors.darkSecondary)
        .padding(.horizontal, 12)
        .frame(minHeight: 36)
        .background(isSelected ? FPV5Colors.signalRed : FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous)
                .stroke(isSelected ? FPV5Colors.signalRed : FPV5Colors.darkHairline, lineWidth: 1)
        }
    }

    @ViewBuilder
    private var sourceBanner: some View {
        if let errorMessage = viewModel.errorMessage {
            FanPassV5SourceBanner(
                isSavedCatalog: viewModel.isUsingSavedEvents,
                message: errorMessage
            ) {
                Task { await viewModel.load(eventService: backend.eventService()) }
            }
        }
    }

    @ViewBuilder
    private var fanAccessShortcut: some View {
        if let event = fanAccessEvents.first {
            NavigationLink {
                FanPassV4FanAccessView(event: event)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: FPIcons.fanAccess)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(FPV5Colors.verifiedGreen)
                        .frame(width: 38, height: 38)
                        .background(FPV5Colors.verifiedGreen.opacity(0.10), in: RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Fan Access is open")
                            .font(FPV5Typography.headline)
                            .foregroundStyle(FPV5Colors.warmWhite)
                        Text(event.title)
                            .font(FPV5Typography.metadata)
                            .foregroundStyle(FPV5Colors.darkSecondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(FPV5Colors.darkSecondary)
                }
                .padding(12)
                .background(FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous)
                        .stroke(FPV5Colors.darkHairline, lineWidth: 1)
                }
            }
            .buttonStyle(.plain)
        }
    }

    private var eventResults: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .lastTextBaseline) {
                Text("Events")
                    .font(FPV5Typography.sectionTitle)
                    .foregroundStyle(FPV5Colors.warmWhite)
                Spacer()
                if hasActiveFilters {
                    Button("Clear filters") {
                        clearFilters()
                    }
                    .font(FPV5Typography.caption)
                    .foregroundStyle(FPV5Colors.signalRed)
                } else {
                    Text(filteredEvents.count.formatted())
                        .font(FPV5Typography.metadata)
                        .foregroundStyle(FPV5Colors.darkSecondary)
                        .monospacedDigit()
                }
            }

            if viewModel.isLoading && viewModel.events.isEmpty {
                ProgressView("Loading events")
                    .tint(FPV5Colors.paper)
                    .foregroundStyle(FPV5Colors.darkSecondary)
                    .frame(maxWidth: .infinity, minHeight: 180)
            } else if filteredEvents.isEmpty {
                noResults
            } else {
                ForEach(filteredEvents) { event in
                    NavigationLink {
                        FanPassV5EventDetailView(event: event)
                    } label: {
                        FanPassV5EventRow(event: event)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var noResults: some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(.system(size: 30, weight: .semibold))
            Text("No matching events")
                .font(FPV5Typography.sectionTitle)
            Text("Try a broader search or remove a city or category filter.")
                .font(FPV5Typography.callout)
                .multilineTextAlignment(.center)
            Button("Clear filters") {
                clearFilters()
            }
            .font(FPV5Typography.headline)
            .foregroundStyle(FPV5Colors.signalRed)
        }
        .foregroundStyle(FPV5Colors.darkSecondary)
        .frame(maxWidth: .infinity, minHeight: 190)
        .padding(20)
        .background(FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
    }

    private func clearFilters() {
        query = ""
        selectedCategory = nil
        selectedCity = nil
    }

    private func focusSearchIfRequested() {
        guard appViewModel.shouldFocusDiscoverySearch else { return }
        Task { @MainActor in
            await Task.yield()
            isSearchFocused = true
            appViewModel.shouldFocusDiscoverySearch = false
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        FanPassV5ExploreView()
    }
}
#endif
