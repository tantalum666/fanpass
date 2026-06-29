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
        FanPassV4Scaffold(title: "Explore", subtitle: nil) {
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
        .padding(.horizontal, FPSpacing.md)
        .padding(.vertical, FPSpacing.sm)
        .background(FPColors.surfaceGlass.opacity(0.58), in: Capsule())
        .overlay {
            Capsule()
                .stroke(FPColors.borderDivider.opacity(0.52), lineWidth: 1)
        }
    }

    private var fanAccessSpotlight: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Fan Access")
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
                            Text("Priority windows for event tasks.")
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
            FPSectionHeader(title: "Signals")
            FPConceptRowList(rows: [
                .init(id: "late-night", icon: "sparkles", title: "Late-night synth pop", subtitle: "More saves and under-cap interest.", value: "Rising", kind: .warning),
                .init(id: "festival-groups", icon: "person.2.wave.2.fill", title: "Festival groups", subtitle: "Weekend passes are saved sooner.", value: "Watch", kind: .info)
            ])
        }
    }

    private var artistBriefing: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Artists")
            FPConceptRowList(rows: artistRows)
        }
    }

    private var recommendedEvents: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Recommended")
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
            .init(id: "aurora", icon: "music.mic.circle.fill", title: "Aurora Nights", subtitle: "Saved demand is high.", value: "Hot", kind: .warning),
            .init(id: "neon", icon: "music.note.list", title: "Neon Harbor", subtitle: "Festival route.", value: "+18%", kind: .success),
            .init(id: "future", icon: "sparkles", title: "Future Beats", subtitle: "Fan Access tasks open.", value: "New", kind: .info)
        ]
    }
}

private struct ExploreFilterSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            FanPassV4Scaffold(title: "Filters", subtitle: nil) {
                FPConceptRowList(rows: [
                    .init(id: "city", icon: "location.fill", title: "City", subtitle: "City-level only.", value: "HK", kind: .info),
                    .init(id: "date", icon: "calendar", title: "Date", subtitle: "Month, weekend, or custom.", value: "This year"),
                    .init(id: "price", icon: "tag.fill", title: "Budget", subtitle: "Face, floor, or cap.", value: "Cap"),
                    .init(id: "rules", icon: "lock.shield.fill", title: "Rules", subtitle: "Transferable and verified.", value: "Safe", kind: .success)
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
