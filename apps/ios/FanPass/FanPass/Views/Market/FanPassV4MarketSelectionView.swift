import SwiftUI

struct FanPassV4MarketSelectionView: View {
    let events: [FanPassV4.Event]
    let selectedEventID: String
    let selectedTicketTypeID: String?
    let onSelect: (FanPassV4.Event, FanPassV4.TicketType) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var selectedEvent: FanPassV4.Event? {
        events.first { $0.id == selectedEventID }
    }

    private var filteredEvents: [FanPassV4.Event] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return events.filter { $0.id != selectedEventID }
        }
        return events.filter { event in
            event.title.localizedCaseInsensitiveContains(trimmed) ||
                event.venue.name.localizedCaseInsensitiveContains(trimmed) ||
                event.venue.city.localizedCaseInsensitiveContains(trimmed) ||
                event.category.title.localizedCaseInsensitiveContains(trimmed)
        }
    }

    private var isSearching: Bool {
        !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        List {
            if !isSearching, let selectedEvent {
                Section("Current market") {
                    eventLink(selectedEvent, isSelected: true)
                }
            }

            Section(isSearching ? "Search results" : "All events") {
                if filteredEvents.isEmpty {
                    ContentUnavailableView(
                        "No matching events",
                        systemImage: "magnifyingglass",
                        description: Text("Try an event, venue, city, or category.")
                    )
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(filteredEvents) { event in
                        eventLink(event, isSelected: event.id == selectedEventID)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(FPColors.backgroundNight)
        .navigationTitle("Choose event")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(
            text: $query,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Search events or venues"
        )
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                }
                .accessibilityLabel("Close market selector")
            }
        }
    }

    private func eventLink(_ event: FanPassV4.Event, isSelected: Bool) -> some View {
        NavigationLink {
            FanPassV4MarketTicketTypeSelectionView(
                event: event,
                selectedTicketTypeID: event.id == selectedEventID ? selectedTicketTypeID : nil,
                onSelect: { selectedEvent, ticketType in
                    onSelect(selectedEvent, ticketType)
                    dismiss()
                }
            )
        } label: {
            MarketEventSelectionRow(event: event, isSelected: isSelected)
        }
        .listRowBackground(FPColors.surfaceCard)
        .accessibilityIdentifier("market-event-\(event.id)")
        .accessibilityLabel("Choose \(event.title)")
    }
}

private struct FanPassV4MarketTicketTypeSelectionView: View {
    let event: FanPassV4.Event
    let selectedTicketTypeID: String?
    let onSelect: (FanPassV4.Event, FanPassV4.TicketType) -> Void

    @State private var query = ""

    private var ticketTypes: [FanPassV4.TicketType] {
        event.ticketTypes.isEmpty ? [event.safePrimaryTicketType] : event.ticketTypes
    }

    private var filteredTicketTypes: [FanPassV4.TicketType] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return ticketTypes }
        return ticketTypes.filter { ticketType in
            ticketType.name.localizedCaseInsensitiveContains(trimmed) ||
                ticketType.priceLabel.localizedCaseInsensitiveContains(trimmed)
        }
    }

    var body: some View {
        List {
            Section {
                MarketSelectionEventSummary(event: event)
            }
            .listRowBackground(FPColors.surfaceCard)

            Section("Seat categories") {
                if filteredTicketTypes.isEmpty {
                    ContentUnavailableView(
                        "No matching categories",
                        systemImage: "chair.lounge",
                        description: Text("Try a broader seat category or price.")
                    )
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(filteredTicketTypes) { ticketType in
                        Button {
                            onSelect(event, ticketType)
                        } label: {
                            MarketTicketTypeSelectionRow(
                                ticketType: ticketType,
                                isSelected: ticketType.id == selectedTicketTypeID
                            )
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(FPColors.surfaceCard)
                        .accessibilityIdentifier("market-ticket-type-\(ticketType.id)")
                        .accessibilityLabel("Choose \(ticketType.name), face value \(ticketType.priceLabel)")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(FPColors.backgroundNight)
        .navigationTitle("Choose seats")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(
            text: $query,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Search seat categories"
        )
    }
}

private struct MarketEventSelectionRow: View {
    let event: FanPassV4.Event
    let isSelected: Bool

    var body: some View {
        HStack(spacing: FPSpacing.md) {
            MarketEventThumbnail(event: event)

            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text(event.title)
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                    .lineLimit(2)
                Text("\(event.venue.name) • \(event.venue.city)")
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                    .lineLimit(1)
                Text(event.dateLine)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textTertiary)
            }

            Spacer(minLength: FPSpacing.sm)

            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(FPColors.verifiedGreen)
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, FPSpacing.xs)
        .contentShape(Rectangle())
    }
}

private struct MarketSelectionEventSummary: View {
    let event: FanPassV4.Event

    var body: some View {
        HStack(spacing: FPSpacing.md) {
            MarketEventThumbnail(event: event)
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text(event.title)
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                    .lineLimit(2)
                Text("\(event.venue.city) • \(event.dateLine)")
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
            }
        }
        .padding(.vertical, FPSpacing.xs)
    }
}

private struct MarketTicketTypeSelectionRow: View {
    let ticketType: FanPassV4.TicketType
    let isSelected: Bool

    private var capLabel: String {
        guard let cap = ticketType.transferRule.resaleCap else { return "Organizer rules" }
        return "Cap \(MoneyFormatter.format(cap, currency: ticketType.currency))"
    }

    var body: some View {
        HStack(spacing: FPSpacing.md) {
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text(ticketType.name)
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                    .lineLimit(2)
                Text("Face \(ticketType.priceLabel) • \(capLabel)")
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                    .lineLimit(1)
            }

            Spacer(minLength: FPSpacing.sm)

            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(FPColors.verifiedGreen)
            } else {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(FPColors.textTertiary)
            }
        }
        .frame(minHeight: 52)
        .contentShape(Rectangle())
    }
}

private struct MarketEventThumbnail: View {
    let event: FanPassV4.Event

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

    var body: some View {
        Group {
            if let coverImage {
                Image(uiImage: coverImage)
                    .resizable()
                    .scaledToFill()
            } else {
                LinearGradient(
                    colors: [
                        Color(hex: UInt32(event.heroGradient.startHex)),
                        Color(hex: UInt32(event.heroGradient.endHex))
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .overlay {
                    Image(systemName: FPIcons.market)
                        .foregroundStyle(FPColors.textPrimary.opacity(0.82))
                }
            }
        }
        .frame(width: 52, height: 62)
        .clipShape(RoundedRectangle(cornerRadius: FPRadius.sm, style: .continuous))
        .accessibilityHidden(true)
    }
}
