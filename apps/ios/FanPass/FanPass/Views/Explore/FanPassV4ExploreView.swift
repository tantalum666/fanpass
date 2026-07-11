import SwiftUI

struct FanPassV4ExploreView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @State private var viewModel = ExploreViewModel()
    @State private var query = ""

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
            recommendedEvents
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

    private var recommendedEvents: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Recommended")
            if let errorMessage = viewModel.errorMessage {
                FPStateBanner(
                    title: "Events unavailable",
                    message: errorMessage,
                    kind: .warning,
                    actionTitle: "Retry"
                ) {
                    Task {
                        await viewModel.load(eventService: backend.eventService())
                    }
                }
            } else if viewModel.isLoading && viewModel.events.isEmpty {
                ProgressView("Loading events")
                    .tint(FPColors.pulseCyan)
                    .frame(maxWidth: .infinity, minHeight: 180)
            } else if filteredEvents.isEmpty {
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
                    FPEditorialEventRow(event: event, trailingValue: event.safePrimaryTicketType.priceLabel)
                }
                .buttonStyle(.plain)
            }
        }
    }

}

#Preview {
    NavigationStack {
        FanPassV4ExploreView()
    }
}
