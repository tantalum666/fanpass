import SwiftUI

struct FanPassV4ExploreView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @State private var viewModel = ExploreViewModel()
    @State private var query = ""
    @State private var showingFilters = false

    private var filteredEvents: [FanPassV4.Event] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return viewModel.events
        }
        return viewModel.events.filter {
            $0.title.localizedCaseInsensitiveContains(trimmed) ||
                $0.venue.city.localizedCaseInsensitiveContains(trimmed) ||
                $0.venue.name.localizedCaseInsensitiveContains(trimmed) ||
                $0.category.title.localizedCaseInsensitiveContains(trimmed)
        }
    }

    var body: some View {
        FanPassV4Scaffold(title: "Explore", subtitle: "Fan Access, artist signals, and culture updates.") {
            searchField
            fanAccessSpotlight
            trendBriefing
            artistBriefing
            recommendedEvents
        }
        .sheet(isPresented: $showingFilters) {
            ExploreFilterSheet()
                .presentationDetents([.medium])
        }
        .task(id: backend.connectionState.rawValue) {
            await viewModel.load(eventService: backend.eventService())
        }
    }

    private var fanAccessEvents: [FanPassV4.Event] {
        Array(filteredEvents.filter(\.fanAccessAvailable).prefix(3))
    }

    private var searchField: some View {
        HStack(spacing: FPSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(FPColors.textSecondary)
            TextField("Search events, cities, venues", text: $query)
                .font(FPTypography.body)
                .foregroundStyle(FPColors.textPrimary)
                .textInputAutocapitalization(.words)
            Button {
                showingFilters = true
            } label: {
                Image(systemName: "slider.horizontal.3")
                    .foregroundStyle(FPColors.pulseCyan)
            }
            .buttonStyle(.plain)
        }
        .padding(FPSpacing.md)
        .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }

    private var fanAccessSpotlight: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Fan Access", subtitle: "Priority windows and task-based access")
            FPSurfaceCard(cornerRadius: FPRadius.lg) {
                VStack(alignment: .leading, spacing: FPSpacing.lg) {
                    HStack(alignment: .top, spacing: FPSpacing.md) {
                        Image(systemName: FPIcons.fanAccess)
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(FPColors.backgroundNight)
                            .frame(width: 52, height: 52)
                            .background(FPColors.pulseCyan, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                        VStack(alignment: .leading, spacing: FPSpacing.xs) {
                            Text("Unlock priority access")
                                .font(FPTypography.title3)
                                .foregroundStyle(FPColors.textPrimary)
                            Text("Complete simple event tasks before ticket windows open. Rewards stay event-scoped and safe.")
                                .font(FPTypography.callout)
                                .foregroundStyle(FPColors.textSecondary)
                        }
                    }

                    if fanAccessEvents.isEmpty {
                        FPStateBanner(title: "No Fan Access open", message: "New access tasks will appear here when organizers open them.", kind: .neutral)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(fanAccessEvents) { event in
                                NavigationLink {
                                    FanPassV4FanAccessView(event: event)
                                } label: {
                                    FPConceptRowView(row: .init(
                                        id: event.id,
                                        icon: FPIcons.fanAccess,
                                        title: event.title,
                                        subtitle: "\(event.venue.city) • \(event.dateLine)",
                                        value: "Open",
                                        kind: .success
                                    ))
                                }
                                .buttonStyle(.plain)
                                if event.id != fanAccessEvents.last?.id {
                                    FPDivider()
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private var trendBriefing: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Trend briefing", subtitle: "Culture signals around live events")
            VStack(spacing: FPSpacing.md) {
                ExploreBriefCard(
                    icon: "sparkles",
                    title: "Late-night synth pop is moving fast",
                    subtitle: "Aurora and Midnight events are seeing more saves and under-cap resale interest.",
                    value: "Rising",
                    kind: .warning
                )
                ExploreBriefCard(
                    icon: "person.2.wave.2.fill",
                    title: "Festival groups are planning earlier",
                    subtitle: "Weekend passes with clear transfer rules are being saved before price changes.",
                    value: "Watch",
                    kind: .info
                )
            }
        }
    }

    private var artistBriefing: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Artist updates", subtitle: "Tour momentum without speculation")
            FPConceptRowList(rows: artistRows)
        }
    }

    private var recommendedEvents: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Recommended events", subtitle: "Verified tickets and controlled resale")
            if filteredEvents.isEmpty {
                noResults
            } else {
                eventCards(filteredEvents)
            }
        }
    }

    private var noResults: some View {
        VStack(spacing: FPSpacing.md) {
            FPEmptyStateView(title: "No matching events", message: "Try a broader date, category, or city-level filter.", systemImage: FPIcons.explore)
                .frame(maxWidth: .infinity)
                .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
            FPSecondaryButton(title: "Reset search", systemImage: "xmark.circle.fill") {
                query = ""
            }
        }
    }

    private func eventCards(_ events: [FanPassV4.Event]) -> some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            ForEach(events) { event in
                NavigationLink {
                    FanPassV4EventDetailView(event: event)
                } label: {
                    FPEditorialEventRow(event: event, trailingValue: event.marketSummary.floorPriceLabel)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var artistRows: [FPConceptRow] {
        [
            .init(id: "aurora", icon: "music.mic.circle.fill", title: "Aurora Nights", subtitle: "High saved demand across Hong Kong and Singapore.", value: "Hot", kind: .warning),
            .init(id: "neon", icon: "music.note.list", title: "Neon Harbor", subtitle: "Festival route with multiple venues.", value: "+18%", kind: .success),
            .init(id: "future", icon: "sparkles", title: "Future Beats", subtitle: "Conference crossover with Fan Access tasks.", value: "New", kind: .info)
        ]
    }
}

private struct ExploreBriefCard: View {
    let icon: String
    let title: String
    let subtitle: String
    let value: String
    var kind: FPStateKind = .info

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.md) {
            HStack(alignment: .top, spacing: FPSpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(kind.foreground)
                    .frame(width: 44, height: 44)
                    .background(kind.foreground.opacity(0.14), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))

                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text(title)
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(subtitle)
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: FPSpacing.sm)

                Text(value)
                    .font(FPTypography.caption.weight(.bold))
                    .foregroundStyle(kind.foreground)
                    .padding(.horizontal, FPSpacing.sm)
                    .padding(.vertical, FPSpacing.xs)
                    .background(kind.foreground.opacity(0.12), in: Capsule())
            }
        }
    }
}

private struct ExploreFilterSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            FanPassV4Scaffold(title: "Filters", subtitle: "Refine results without exposing precise location.") {
                FPConceptRowList(rows: [
                    .init(id: "city", icon: "location.fill", title: "City", subtitle: "Hong Kong, Singapore, Tokyo; no precise personal location.", value: "HK", kind: .info),
                    .init(id: "date", icon: "calendar", title: "Date", subtitle: "This month, weekend, or custom range.", value: "This year"),
                    .init(id: "price", icon: "tag.fill", title: "Budget", subtitle: "Filter under face value, floor, or organizer cap.", value: "Cap"),
                    .init(id: "rules", icon: "lock.shield.fill", title: "Rules", subtitle: "Transferable, Fan Access, verified resale only.", value: "Safe", kind: .success)
                ])
                FPPrimaryButton(title: "Apply filters", systemImage: "checkmark.circle.fill") { dismiss() }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        FanPassV4ExploreView()
    }
}
