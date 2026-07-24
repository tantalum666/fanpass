import SwiftUI

/// V5 discovery front door.
///
/// This screen deliberately exposes only behavior backed by the public event
/// catalog: event browsing, catalog-city filtering, real search routing, and
/// the next owned ticket when one exists.
struct FanPassV5HomeView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel
    @State private var viewModel = HomeViewModel()
    @State private var selectedHeroIndex = 0

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                brandHeader
                discoveryHeader
                FanPassV5SearchButton(title: "Search events, venues, and cities") {
                    appViewModel.openExplore(focusSearch: true)
                }
                sourceBanner
                featuredSection
                upcomingSection
                nextTicketSection
            }
            .padding(.horizontal, FPV5Metrics.pageHorizontal)
            .padding(.top, 16)
            .padding(.bottom, 116)
        }
        .background(FPV5Colors.ink.ignoresSafeArea())
        .task(id: "\(backend.user.id)-\(backend.isAuthenticated)-\(backend.publicCatalogRefreshRevision)") {
            await loadCatalog()
        }
        .onChange(of: appViewModel.discoveryCity) {
            selectedHeroIndex = 0
        }
    }

    private var catalogEvents: [FanPassV4.Event] {
        guard let city = appViewModel.discoveryCity else {
            return viewModel.featuredEvents
        }
        return viewModel.featuredEvents.filter { $0.venue.city == city }
    }

    private var cities: [String] {
        Array(Set(viewModel.featuredEvents.map(\.venue.city))).sorted()
    }

    private var brandHeader: some View {
        HStack(spacing: 12) {
            FanPassV5BrandLockup()
            Spacer()
            Button {
                appViewModel.openAccount()
            } label: {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(FPV5Colors.warmWhite)
                    .frame(width: 44, height: 44)
                    .background(FPV5Colors.softBlack, in: Circle())
                    .overlay { Circle().stroke(FPV5Colors.darkHairline, lineWidth: 1) }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open Account")
        }
    }

    private var discoveryHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(backend.isAuthenticated ? greeting.uppercased() : "LIVE CULTURE, CLEARLY")
                .font(FPV5Typography.caption)
                .foregroundStyle(FPV5Colors.signalRed)
            Text("Find your next\nlive moment")
                .font(FPV5Typography.editorialDisplay)
                .foregroundStyle(FPV5Colors.warmWhite)
                .fixedSize(horizontal: false, vertical: true)

            Menu {
                Button("All cities") {
                    appViewModel.discoveryCity = nil
                }
                ForEach(cities, id: \.self) { city in
                    Button(city) {
                        appViewModel.discoveryCity = city
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "mappin.and.ellipse")
                    Text(appViewModel.discoveryCity ?? "All catalog cities")
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .bold))
                }
                .font(FPV5Typography.callout)
                .foregroundStyle(FPV5Colors.darkSecondary)
                .padding(.horizontal, 12)
                .frame(minHeight: 38)
                .background(FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous)
                        .stroke(FPV5Colors.darkHairline, lineWidth: 1)
                }
            }
            .accessibilityLabel("Catalog city filter")
        }
    }

    private var greeting: String {
        let firstName = backend.user.displayName.split(separator: " ").first.map(String.init)
        return "For \(firstName ?? backend.user.displayName)"
    }

    @ViewBuilder
    private var sourceBanner: some View {
        if let message = viewModel.sourceMessage {
            FanPassV5SourceBanner(isSavedCatalog: viewModel.isUsingSavedEvents, message: message) {
                Task { await loadCatalog() }
            }
        }
    }

    @ViewBuilder
    private var featuredSection: some View {
        if catalogEvents.isEmpty {
            if viewModel.isLoading {
                ProgressView("Loading events")
                    .tint(FPV5Colors.paper)
                    .foregroundStyle(FPV5Colors.darkSecondary)
                    .frame(maxWidth: .infinity, minHeight: 240)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .font(.system(size: 30, weight: .semibold))
                    Text("No events in this city")
                        .font(FPV5Typography.sectionTitle)
                    Text("Choose another catalog city or view every published event.")
                        .font(FPV5Typography.callout)
                        .multilineTextAlignment(.center)
                    Button("Show all cities") {
                        appViewModel.discoveryCity = nil
                    }
                    .font(FPV5Typography.headline)
                    .foregroundStyle(FPV5Colors.signalRed)
                }
                .foregroundStyle(FPV5Colors.darkSecondary)
                .frame(maxWidth: .infinity, minHeight: 240)
                .padding(20)
                .background(FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
            }
        } else {
            let index = min(selectedHeroIndex, catalogEvents.count - 1)
            let event = catalogEvents[index]
            VStack(spacing: 14) {
                NavigationLink {
                    FanPassV5EventDetailView(event: event)
                } label: {
                    FanPassV5FeaturedEventCard(event: event)
                }
                .buttonStyle(.plain)

                if catalogEvents.count > 1 {
                    HStack(spacing: 16) {
                        heroStepButton(systemImage: "chevron.left") {
                            selectedHeroIndex = (index + catalogEvents.count - 1) % catalogEvents.count
                        }
                        HStack(spacing: 7) {
                            ForEach(0..<min(catalogEvents.count, 5), id: \.self) { dot in
                                Capsule()
                                    .fill(dot == index ? FPV5Colors.signalRed : FPV5Colors.darkHairline)
                                    .frame(width: dot == index ? 20 : 7, height: 7)
                            }
                        }
                        .accessibilityLabel("Featured event \(index + 1) of \(catalogEvents.count)")
                        heroStepButton(systemImage: "chevron.right") {
                            selectedHeroIndex = (index + 1) % catalogEvents.count
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var upcomingSection: some View {
        let upcoming = Array(catalogEvents.dropFirst().prefix(6))
        if !upcoming.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                FanPassV5SectionHeader(title: "Upcoming events", count: upcoming.count)
                ForEach(upcoming) { event in
                    NavigationLink {
                        FanPassV5EventDetailView(event: event)
                    } label: {
                        FanPassV5EventRow(event: event)
                    }
                    .buttonStyle(.plain)
                }
                Button {
                    appViewModel.openExplore()
                } label: {
                    HStack {
                        Text("Browse the full catalog")
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .font(FPV5Typography.headline)
                    .foregroundStyle(FPV5Colors.paper)
                    .padding(.horizontal, 14)
                    .frame(minHeight: 48)
                    .overlay {
                        RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous)
                            .stroke(FPV5Colors.darkHairline, lineWidth: 1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var nextTicketSection: some View {
        if let ticket = viewModel.nextTicket {
            VStack(alignment: .leading, spacing: 12) {
                FanPassV5SectionHeader(title: "Your next pass")
                NavigationLink {
                    FanPassV4TicketDetailView(ticket: ticket)
                } label: {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            FanPassV5Tag(title: ticket.status.title, systemImage: "checkmark.seal.fill", tone: .verified)
                            Spacer()
                            Text(ticket.shortId)
                                .font(FPV5Typography.caption)
                                .foregroundStyle(FPV5Colors.slate)
                        }
                        Text(ticket.event.title)
                            .font(FPV5Typography.editorialTitle)
                            .foregroundStyle(FPV5Colors.ink)
                            .lineLimit(2)
                        Text("\(ticket.event.dateLine) · \(ticket.event.venue.name)")
                            .font(FPV5Typography.metadata)
                            .foregroundStyle(FPV5Colors.slate)
                        Text("Section \(ticket.section) · Row \(ticket.row) · Seat \(ticket.seat)")
                            .font(FPV5Typography.tabular)
                            .foregroundStyle(FPV5Colors.ink)
                    }
                    .padding(16)
                    .background(FPV5Colors.paper, in: RoundedRectangle(cornerRadius: FPV5Metrics.passCorner, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: FPV5Metrics.passCorner, style: .continuous)
                            .stroke(FPV5Colors.brass.opacity(0.7), lineWidth: 1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func heroStepButton(systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(FPV5Colors.darkSecondary)
                .frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(systemImage == "chevron.left" ? "Previous event" : "Next event")
    }

    private func loadCatalog() async {
        await viewModel.load(
            user: backend.user,
            isAuthenticated: backend.isAuthenticated,
            eventService: backend.eventService(),
            ticketService: backend.ticketService()
        )
    }
}

#Preview {
    NavigationStack {
        FanPassV5HomeView()
    }
}
