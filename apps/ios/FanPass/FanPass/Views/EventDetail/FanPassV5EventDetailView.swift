import SwiftUI

/// The V5 conversion surface: event context first, ticket choice immediately
/// after it, then operational transparency and optional secondary journeys.
struct FanPassV5EventDetailView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel
    @State private var viewModel: EventDetailViewModel
    @State private var showingAuthGate = false
    @State private var onsaleCheckoutGate: FanPassOnsaleCheckoutGate = .checking
    @State private var availableByTicketType: [String: Int] = [:]
    @State private var marketSnapshot: OrderbookSnapshot?
    @State private var marketDataLoaded = false
    @State private var marketDataUnavailable = false

    init(event: FanPassV4.Event) {
        _viewModel = State(initialValue: EventDetailViewModel(event: event))
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 22) {
                FanPassV5EventHero(event: viewModel.event)
                ticketSelection
                purchaseTransparency
                fanAccessCard
                marketContextCard
            }
            .padding(.horizontal, FPV5Metrics.pageHorizontal)
            .padding(.top, 12)
            .padding(.bottom, 40)
        }
        .background(FPV5Colors.ink.ignoresSafeArea())
        .navigationTitle("Event")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .task(id: viewModel.event.id) {
            await refreshMarketSnapshot()
        }
        .sheet(isPresented: $showingAuthGate) {
            FanPassV4AuthRequiredSheet(
                title: authGateTitle,
                message: authGateMessage,
                signIn: {
                    appViewModel.openPrivySignIn()
                }
            )
            .presentationDetents([.medium, .large])
        }
    }

    private var ticketSelection: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                FanPassV5SectionHeader(
                    title: "Choose a ticket",
                    count: viewModel.purchasableTicketTypes.count
                )
                Text("Face value, remaining inventory, and organizer rules are shown before checkout.")
                    .font(FPV5Typography.metadata)
                    .foregroundStyle(FPV5Colors.darkSecondary)
            }

            ForEach(viewModel.purchasableTicketTypes) { ticketType in
                FanPassV5TicketOptionCard(
                    ticketType: ticketType,
                    availability: availability(for: ticketType)
                ) {
                    VStack(alignment: .leading, spacing: 10) {
                        if let notice = ticketNotice(for: ticketType) {
                            Label(notice.message, systemImage: notice.systemImage)
                                .font(FPV5Typography.metadata)
                                .foregroundStyle(notice.color)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        buyButton(for: ticketType)
                    }
                }
            }
        }
    }

    private var purchaseTransparency: some View {
        VStack(alignment: .leading, spacing: 12) {
            FanPassV5SectionHeader(title: "Sale transparency")
            FanPassV4OnsaleTransparencyView(
                event: viewModel.event,
                checkoutGate: $onsaleCheckoutGate,
                availableByTicketType: $availableByTicketType
            )
        }
    }

    @ViewBuilder
    private var fanAccessCard: some View {
        if viewModel.event.fanAccessAvailable {
            NavigationLink {
                FanPassV4FanAccessView(event: viewModel.event)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: FPIcons.fanAccess)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(FPV5Colors.verifiedGreen)
                        .frame(width: 42, height: 42)
                        .background(FPV5Colors.verifiedGreen.opacity(0.10), in: RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Fan Access")
                            .font(FPV5Typography.headline)
                            .foregroundStyle(FPV5Colors.warmWhite)
                        Text("Complete organizer tasks for priority access to this event.")
                            .font(FPV5Typography.metadata)
                            .foregroundStyle(FPV5Colors.darkSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(FPV5Colors.darkSecondary)
                }
                .padding(14)
                .background(FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous)
                        .stroke(FPV5Colors.darkHairline, lineWidth: 1)
                }
            }
            .buttonStyle(.plain)
        }
    }

    private var marketContextCard: some View {
        Button {
            appViewModel.openMarket(for: viewModel.event)
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .lastTextBaseline) {
                    Text("Resale context")
                        .font(FPV5Typography.sectionTitle)
                        .foregroundStyle(FPV5Colors.warmWhite)
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(FPV5Colors.darkSecondary)
                }
                Text("Organizer-controlled resale pricing for this event.")
                    .font(FPV5Typography.metadata)
                    .foregroundStyle(FPV5Colors.darkSecondary)
                HStack(spacing: 10) {
                    marketMetric(title: "Lowest listing", value: liveFloorLabel)
                    marketMetric(title: "Organizer cap", value: viewModel.event.marketSummary.capLabel)
                }
            }
            .padding(16)
            .background(FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous)
                    .stroke(FPV5Colors.darkHairline, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open resale details for \(viewModel.event.title)")
    }

    private func marketMetric(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title.uppercased())
                .font(FPV5Typography.caption)
                .foregroundStyle(FPV5Colors.darkTertiary)
            Text(value)
                .font(FPV5Typography.tabular)
                .foregroundStyle(FPV5Colors.warmWhite)
                .lineLimit(1)
                .minimumScaleFactor(0.74)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(FPV5Colors.ink, in: RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous))
    }

    @ViewBuilder
    private func buyButton(for ticketType: FanPassV4.TicketType) -> some View {
        let hasInventory = availability(for: ticketType) > 0
        if backend.isAuthenticated && canBuyTickets && saleAllowsCheckout && hasInventory {
            NavigationLink {
                FanPassV4CheckoutView(event: viewModel.event, ticketType: ticketType)
            } label: {
                FanPassV5PrimaryActionLabel(title: "Continue to checkout")
            }
            .buttonStyle(.plain)
        } else {
            let enabled = hasInventory && (!backend.isAuthenticated || !canBuyTickets)
            Button {
                guard enabled else { return }
                showingAuthGate = true
            } label: {
                FanPassV5PrimaryActionLabel(
                    title: purchaseButtonTitle(hasInventory: hasInventory),
                    enabled: enabled
                )
            }
            .buttonStyle(.plain)
            .disabled(!enabled)
        }
    }

    private func purchaseButtonTitle(hasInventory: Bool) -> String {
        guard hasInventory else { return "Sold out" }
        guard backend.isAuthenticated else { return "Sign in to buy" }
        guard canBuyTickets else { return "Use a fan account" }
        return onsaleCheckoutGate.buttonTitle
    }

    private func ticketNotice(for ticketType: FanPassV4.TicketType) -> (message: String, systemImage: String, color: Color)? {
        if ticketType.supply == 0 {
            return (
                "This category is not available for online checkout yet.",
                "info.circle.fill",
                FPV5Colors.amber
            )
        }
        if availability(for: ticketType) == 0 {
            return (
                "No public-sale inventory is available in this category right now.",
                "exclamationmark.circle.fill",
                FPV5Colors.danger
            )
        }
        return nil
    }

    private var saleAllowsCheckout: Bool {
        !viewModel.event.isBackendBacked || onsaleCheckoutGate.allowsCheckout
    }

    private func availability(for ticketType: FanPassV4.TicketType) -> Int {
        availableByTicketType[ticketType.id] ?? ticketType.availableQuantity
    }

    private var canBuyTickets: Bool {
        backend.user.role == .fan || backend.user.role == .admin
    }

    private var authGateTitle: String {
        backend.isAuthenticated ? "Use a fan account" : "Sign in to buy tickets"
    }

    private var authGateMessage: String {
        if backend.isAuthenticated {
            return "This signed-in account is \(backend.user.role.title). Purchases require a fan account."
        }
        return "Browse is open. Checkout, ticket ownership, and entry access require a signed-in fan account."
    }

    private var liveFloorLabel: String {
        if let floorPrice = marketSnapshot?.floorPrice {
            return MoneyFormatter.format(
                floorPrice,
                currency: viewModel.event.safePrimaryTicketType.currency
            )
        }
        if marketDataUnavailable {
            return "Unavailable"
        }
        return marketDataLoaded ? "No listings" : "Loading"
    }

    private func refreshMarketSnapshot() async {
        guard let ticketType = viewModel.event.ticketTypes.first else {
            marketSnapshot = nil
            marketDataUnavailable = false
            marketDataLoaded = true
            return
        }

        marketDataLoaded = false
        marketDataUnavailable = false
        do {
            marketSnapshot = try await backend.apiClient.orderbook(
                eventId: viewModel.event.id,
                ticketTypeId: ticketType.id
            )
            marketDataLoaded = true
        } catch is CancellationError {
            return
        } catch {
            marketSnapshot = nil
            marketDataUnavailable = true
            marketDataLoaded = true
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        FanPassV5EventDetailView(event: FanPassV4PreviewContent.event)
    }
}
#endif
