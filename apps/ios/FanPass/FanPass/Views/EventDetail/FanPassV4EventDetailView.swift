import SwiftUI

struct FanPassV4EventDetailView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel
    @State private var viewModel: EventDetailViewModel
    @State private var showingAuthGate = false

    init(event: FanPassV4.Event = FanPassMockData.events[0]) {
        _viewModel = State(initialValue: EventDetailViewModel(event: event))
    }

    var body: some View {
        FanPassV4Scaffold(title: viewModel.event.title, subtitle: "\(viewModel.event.venue.name) • \(viewModel.event.venue.city)") {
            FPEventHeroCard(
                title: viewModel.event.title,
                subtitle: viewModel.event.subtitle,
                metadata: "\(viewModel.event.dateLine) • \(viewModel.event.venue.city)",
                status: viewModel.event.status.title,
                gradient: viewModel.event.heroGradient,
                coverAssetName: viewModel.event.coverAssetName
            )

            HStack(spacing: FPSpacing.md) {
                FPMetricCard(title: "Floor", value: viewModel.event.marketSummary.floorPriceLabel, caption: "Lowest resale")
                FPMetricCard(title: "Cap", value: viewModel.event.marketSummary.capLabel, caption: "Organizer cap")
            }

            FPSectionHeader(title: "Ticket categories", subtitle: "Face value, resale cap, and transfer rules")
            ForEach(viewModel.purchasableTicketTypes) { ticketType in
                FPSurfaceCard {
                    VStack(alignment: .leading, spacing: FPSpacing.md) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                                Text(ticketType.name)
                                    .font(FPTypography.headline)
                                    .foregroundStyle(FPColors.textPrimary)
                                Text(ticketType.transferRule.summary)
                                    .font(FPTypography.caption)
                                    .foregroundStyle(FPColors.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: FPSpacing.xs) {
                                Text(ticketType.priceLabel)
                                    .font(FPTypography.title3)
                                    .foregroundStyle(FPColors.textPrimary)
                                    .monospacedDigit()
                                Text("\(ticketType.availableQuantity) left")
                                    .font(FPTypography.caption)
                                    .foregroundStyle(FPColors.textSecondary)
                            }
                        }
                        HStack(spacing: FPSpacing.sm) {
                            FPStatusPill(title: "Verified Ticket", systemImage: FPIcons.verified, foreground: FPColors.pulseCyan, background: FPColors.pulseCyan.opacity(0.12), border: FPColors.pulseCyan.opacity(0.6))
                            if ticketType.transferRule.transferable {
                                FPStatusPill(title: "Secure Resale", systemImage: FPIcons.resale, foreground: FPColors.verifiedGreen, background: FPColors.verifiedGreen.opacity(0.12), border: FPColors.verifiedGreen.opacity(0.55))
                            } else {
                                FPStatusPill(title: "Non-transferable", systemImage: "lock.fill", foreground: FPColors.warningAmber, background: FPColors.warningAmber.opacity(0.12), border: FPColors.warningAmber.opacity(0.55))
                            }
                            FPStatusPill(title: "Fan Access", systemImage: FPIcons.fanAccess, foreground: FPColors.pulseCyan, background: FPColors.pulseCyan.opacity(0.12), border: FPColors.pulseCyan.opacity(0.55))
                        }
                        FPPolicyNotice(
                            title: ticketType.transferRule.transferable ? "Organizer resale rule" : "Organizer transfer rule",
                            message: "\(ticketType.transferRule.summary) \(ticketType.refundPolicy)",
                            kind: ticketType.transferRule.transferable ? .info : .warning
                        )
                        if ticketType.supply == 0 {
                            FPStateBanner(
                                title: "Online checkout unavailable",
                                message: "This ticket category is not available for online checkout yet. You can still view prices and organizer rules.",
                                kind: .warning
                            )
                        }
                        buyButton(for: ticketType)
                    }
                }
            }

            NavigationLink {
                FanPassV4FanAccessView(event: viewModel.event)
            } label: {
                FPSurfaceCard {
                    HStack(spacing: FPSpacing.md) {
                        Image(systemName: FPIcons.fanAccess)
                            .font(.system(size: 30, weight: .semibold))
                            .foregroundStyle(FPGradients.passAurora)
                        VStack(alignment: .leading, spacing: FPSpacing.xs) {
                            Text("Join Fan Access")
                                .font(FPTypography.headline)
                                .foregroundStyle(FPColors.textPrimary)
                            Text("Complete tasks and earn Access Badges for this event.")
                                .font(FPTypography.caption)
                                .foregroundStyle(FPColors.textSecondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(FPColors.textSecondary)
                    }
                }
            }
            .buttonStyle(.plain)

            marketChartJumpCard
        }
        .navigationTitle("Event")
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

    @ViewBuilder
    private func buyButton(for ticketType: FanPassV4.TicketType) -> some View {
        if backend.isAuthenticated && canBuyTickets {
            NavigationLink {
                FanPassV4CheckoutView(event: viewModel.event, ticketType: ticketType)
            } label: {
                buyButtonLabel
            }
            .buttonStyle(.plain)
        } else {
            Button {
                showingAuthGate = true
            } label: {
                buyButtonLabel
            }
            .buttonStyle(.plain)
        }
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

    private var buyButtonLabel: some View {
        Text("Buy Ticket")
            .font(FPTypography.headline)
            .foregroundStyle(FPColors.textPrimary)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(FPGradients.passAurora, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
    }

    private var marketChartJumpCard: some View {
        Button {
            appViewModel.openMarket(for: viewModel.event)
        } label: {
            FPSurfaceCard(cornerRadius: FPRadius.lg) {
                HStack(alignment: .center, spacing: FPSpacing.md) {
                    VStack(alignment: .leading, spacing: FPSpacing.sm) {
                        FPStatusPill(
                            title: "Open K-line",
                            systemImage: "chart.xyaxis.line",
                            foreground: FPColors.pulseCyan,
                            background: FPColors.pulseCyan.opacity(0.12),
                            border: FPColors.pulseCyan.opacity(0.6)
                        )
                        Text("Market chart")
                            .font(FPTypography.title3)
                            .foregroundStyle(FPColors.textPrimary)
                        Text("Jump to this event's live resale chart, bid/ask context, and 110% cap.")
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: FPSpacing.md)
                    VStack(alignment: .trailing, spacing: FPSpacing.xs) {
                        Text(viewModel.event.marketSummary.floorPriceLabel)
                            .font(FPTypography.title2)
                            .foregroundStyle(FPColors.textPrimary)
                            .monospacedDigit()
                            .lineLimit(1)
                            .minimumScaleFactor(0.78)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(FPColors.pulseCyan)
                    }
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open Market chart for \(viewModel.event.title)")
    }
}

#Preview {
    NavigationStack {
        FanPassV4EventDetailView()
    }
}
