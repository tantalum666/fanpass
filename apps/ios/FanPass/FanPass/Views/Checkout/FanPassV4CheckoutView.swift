import SwiftUI

struct FanPassV4CheckoutView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel
    @State private var viewModel = CheckoutViewModel()
    @State private var paymentSheetRequest: UUID?
    @State private var preparedPayment: FanPassPaymentIntent?
    @State private var isPreparingStripe = false
    @State private var stripeCheckoutAttemptId = UUID().uuidString
    @State private var showingAuthGate = false
    @State private var showingCryptoSheet = false
    @State private var checkoutOutcome: CheckoutOutcome?

    init(
        event: FanPassV4.Event = FanPassMockData.events[0],
        ticketType: FanPassV4.TicketType = FanPassMockData.events[0].safePrimaryTicketType,
        quotedPrice: Int? = nil,
        priceLineTitle: String = "Face value",
        onAuthRequired: (() -> Void)? = nil
    ) {
        self.onAuthRequired = onAuthRequired
        _viewModel = State(
            initialValue: CheckoutViewModel(
                event: event,
                ticketType: ticketType,
                quotedPrice: quotedPrice,
                priceLineTitle: priceLineTitle
            )
        )
    }

    private let onAuthRequired: (() -> Void)?

    var body: some View {
        FanPassV4Scaffold(title: "Checkout", subtitle: "Choose a payment method and keep ticket issue server-owned.") {
            FPSurfaceCard {
                VStack(alignment: .leading, spacing: FPSpacing.md) {
                    FPSectionHeader(title: viewModel.event.title, subtitle: viewModel.ticketType.name)
                    HStack(spacing: FPSpacing.md) {
                        FPStatusPill(title: "Verified Ticket", systemImage: FPIcons.verified, foreground: FPColors.pulseCyan, background: FPColors.pulseCyan.opacity(0.12), border: FPColors.pulseCyan.opacity(0.6))
                        FPStatusPill(title: "Secure Resale", systemImage: FPIcons.resale, foreground: FPColors.verifiedGreen, background: FPColors.verifiedGreen.opacity(0.12), border: FPColors.verifiedGreen.opacity(0.6))
                    }
                    Text("\(viewModel.event.dateLine) • \(viewModel.event.venue.name), \(viewModel.event.venue.city)")
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            FPSurfaceCard {
                VStack(alignment: .leading, spacing: FPSpacing.md) {
                    FPSectionHeader(title: "Price breakdown", subtitle: "Estimated order total")
                    checkoutRow(viewModel.priceLineTitle, viewModel.ticketPriceLabel)
                    checkoutRow("Platform fee", viewModel.platformFeeLabel)
                    checkoutRow("Estimated tax", viewModel.taxLabel)
                    FPDivider()
                    HStack {
                        Text("Total")
                            .font(FPTypography.headline)
                            .foregroundStyle(FPColors.textPrimary)
                        Spacer()
                        Text(viewModel.totalLabel)
                            .font(FPTypography.title2)
                            .foregroundStyle(FPColors.textPrimary)
                            .monospacedDigit()
                    }
                }
            }

            paymentControls

            FPSurfaceCard {
                VStack(alignment: .leading, spacing: FPSpacing.md) {
                    FPSectionHeader(title: "Organizer resale rule")
                    Text(viewModel.ticketType.transferRule.summary)
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if viewModel.ticketType.transferRule.listingReservesEntry {
                        FPStatusPill(title: "Listing reserves entry until sold", systemImage: FPIcons.warning, foreground: FPColors.warningAmber, background: FPColors.warningAmber.opacity(0.12), border: FPColors.warningAmber.opacity(0.6))
                    }
                }
            }

            if viewModel.paymentState == .failed {
                FPStateBanner(
                    title: "Payment failed",
                    message: viewModel.errorMessage ?? "No ticket was assigned. Check payment availability and try again.",
                    kind: .danger,
                    actionTitle: "Reset checkout",
                    action: resetCheckout
                )
            }

            if viewModel.paymentState == .cancelled {
                FPStateBanner(
                    title: "Payment cancelled",
                    message: viewModel.errorMessage ?? "Start a fresh authorization when you are ready.",
                    kind: .warning,
                    actionTitle: "Reset checkout",
                    action: resetCheckout
                )
            }

            if viewModel.paymentState == .authorized {
                FPStateBanner(
                    title: "Payment syncing",
                    message: viewModel.errorMessage ?? "Waiting for ticket assignment.",
                    kind: .success
                )
            }

            if viewModel.paymentState == .captured {
                NavigationLink {
                    FanPassV4PurchaseSuccessView(event: viewModel.event, ticketType: viewModel.ticketType, ticket: viewModel.purchasedTicket)
                } label: {
                    HStack {
                        Image(systemName: FPIcons.verified)
                        Text("Continue to ticket")
                    }
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(FPColors.verifiedGreen.opacity(0.2), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                            .stroke(FPColors.verifiedGreen.opacity(0.7), lineWidth: 1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .background(paymentSheetPresenter)
        .sheet(item: $checkoutOutcome) { outcome in
            CheckoutOutcomeSheet(outcome: outcome) {
                appViewModel.openTickets()
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showingCryptoSheet) {
            CryptoPaymentSheet(
                totalHKD: viewModel.totalAmount,
                displayTotal: viewModel.totalLabel
            )
            .presentationDetents([.large])
        }
        .sheet(isPresented: $showingAuthGate) {
            FanPassV4AuthRequiredSheet(
                title: "Sign in to continue",
                message: "A fan session is required before checkout, ticket ownership, or ticket assignment.",
                signIn: {
                    showingAuthGate = false
                    appViewModel.openPrivySignIn()
                }
            )
            .presentationDetents([.medium, .large])
        }
    }

    private var paymentControls: some View {
        VStack(spacing: FPSpacing.md) {
            FPPrimaryButton(title: "Pay with Crypto", systemImage: "bitcoinsign.circle.fill") {
                prepareCryptoCheckout()
            }
            FPSecondaryButton(title: "Pay with Stripe", systemImage: "creditcard.fill") {
                Task {
                    await prepareAndPresentStripe()
                }
            }
            .disabled(isPreparingStripe || viewModel.paymentState == .authorizing)
            Text(stripeReadinessMessage)
                .font(FPTypography.caption)
                .foregroundStyle(isStripeReady ? FPColors.textSecondary : FPColors.warningAmber)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Text("Crypto accepts USDC. Final quotes are locked before payment.")
                .font(FPTypography.caption)
                .foregroundStyle(FPColors.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func checkoutRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textSecondary)
            Spacer()
            Text(value)
                .font(FPTypography.monoNumber)
                .foregroundStyle(FPColors.textPrimary)
        }
    }

    @ViewBuilder
    private var paymentSheetPresenter: some View {
        if let preparedPayment,
           let clientSecret = preparedPayment.clientSecret,
           let publishableKey = FanPassEnvironment.stripePublishableKey {
            FanPassStripePaymentSheetPresenter(
                clientSecret: clientSecret,
                publishableKey: publishableKey,
                returnURL: FanPassEnvironment.stripeReturnURL,
                presentationRequest: $paymentSheetRequest
            ) { result in
                handleStripeResult(result)
            }
            .frame(width: 0, height: 0)
        }
    }

    private var stripeReadinessMessage: String {
        if FanPassEnvironment.stripePublishableKey == nil {
            return "Card checkout is temporarily unavailable."
        }
        if !backend.isAuthenticated {
            return "Sign in before card checkout."
        }
        if !canBuyTickets {
            return "This signed-in account is \(backend.user.role.title). Buy tickets with a fan account."
        }
        if !hasAPIBearerSession {
            return "Your sign-in session needs to be refreshed before card checkout."
        }
        if !hasLiveAPISessionForStripe {
            return "Sign in again before card checkout."
        }
        if !hasBackendCheckoutCatalogItem {
            return "Card checkout is not available for this ticket yet."
        }
        if viewModel.ticketType.supply == 0 {
            return "Online checkout for this ticket category is unavailable."
        }
        return "Card checkout opens secure payment authorization. Your ticket is assigned after payment settles."
    }

    private var isStripeReady: Bool {
        FanPassEnvironment.stripePublishableKey != nil &&
            backend.isAuthenticated &&
            canBuyTickets &&
            hasAPIBearerSession &&
            hasLiveAPISessionForStripe &&
            hasBackendCheckoutCatalogItem &&
            viewModel.ticketType.supply > 0
    }

    private func prepareCryptoCheckout() {
        guard backend.isAuthenticated else {
            requestSignIn()
            return
        }
        guard canBuyTickets else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "This account is \(backend.user.role.title). Crypto checkout requires a fan account."
            return
        }
        showingCryptoSheet = true
    }

    private func prepareAndPresentStripe() async {
        guard !isPreparingStripe, paymentSheetRequest == nil else {
            return
        }
        guard backend.isAuthenticated else {
            requestSignIn()
            return
        }
        guard canBuyTickets else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "This account is \(backend.user.role.title). Card checkout requires a fan account."
            return
        }
        guard hasAPIBearerSession else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Your sign-in session needs to be refreshed before card checkout."
            return
        }
        guard FanPassEnvironment.stripePublishableKey != nil else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Card checkout is temporarily unavailable."
            return
        }
        guard hasLiveAPISessionForStripe else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Sign in again before card checkout."
            return
        }
        guard hasBackendCheckoutCatalogItem else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Card checkout is not available for this event yet."
            return
        }
        guard viewModel.ticketType.supply > 0 else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Online checkout for this ticket category is unavailable."
            return
        }

        isPreparingStripe = true
        defer { isPreparingStripe = false }
        preparedPayment = nil
        guard let payment = await viewModel.prepareBackendPayment(
            apiClient: backend.apiClient,
            owner: backend.user,
            checkoutAttemptId: stripeCheckoutAttemptId
        ) else {
            return
        }
        preparedPayment = payment
        paymentSheetRequest = UUID()
    }

    private var hasLiveAPISessionForStripe: Bool {
        guard backend.connectionState == .online, hasAPIBearerSession else {
            return false
        }
        return backend.session?.accessToken?.trimmingCharacters(in: .whitespacesAndNewlines) != "local-review-token"
    }

    private var hasBackendCheckoutCatalogItem: Bool {
        viewModel.event.isBackendBacked &&
            viewModel.ticketType.eventId == viewModel.event.id &&
            !viewModel.ticketType.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var hasAPIBearerSession: Bool {
        guard let token = backend.session?.accessToken?.trimmingCharacters(in: .whitespacesAndNewlines) else {
            return false
        }
        return !token.isEmpty
    }

    private var canBuyTickets: Bool {
        backend.user.role == .fan || backend.user.role == .admin
    }

    private func requestSignIn() {
        if let onAuthRequired {
            onAuthRequired()
        } else {
            showingAuthGate = true
        }
    }

    private func handleStripeResult(_ result: FanPassStripeCheckoutResult) {
        viewModel.applyStripeResult(result)
        preparedPayment = nil
        paymentSheetRequest = nil
        switch result {
        case .completed:
            let ticket = viewModel.completeStripeCheckout(owner: backend.user)
            backend.recordCheckoutTicket(ticket)
            checkoutOutcome = .success(
                ticket: ticket,
                title: "Payment successful",
                message: "Your ticket has been added to Tickets. Entry QR becomes available after payment settles."
            )
        case .canceled:
            checkoutOutcome = .cancelled(
                message: "Card checkout was cancelled. No ticket was assigned."
            )
        case let .failed(message):
            checkoutOutcome = .failed(
                message: message
            )
        }
    }

    private func resetCheckout() {
        preparedPayment = nil
        paymentSheetRequest = nil
        stripeCheckoutAttemptId = UUID().uuidString
        checkoutOutcome = nil
        viewModel.resetPayment()
    }
}

private enum CheckoutOutcome: Identifiable {
    case success(ticket: FanPassV4.Ticket, title: String, message: String)
    case failed(message: String)
    case cancelled(message: String)

    var id: String {
        switch self {
        case let .success(ticket, _, _): "success-\(ticket.id)"
        case let .failed(message): "failed-\(message)"
        case let .cancelled(message): "cancelled-\(message)"
        }
    }
}

private struct CheckoutOutcomeSheet: View {
    let outcome: CheckoutOutcome
    let openTickets: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            FPColors.backgroundNight.ignoresSafeArea()
            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                switch outcome {
                case let .success(ticket, title, message):
                    FPConfirmationCard(
                        title: title,
                        message: "\(message)\n\n\(ticket.event.title) • \(ticket.ticketType.name)",
                        systemImage: FPIcons.verified
                    )
                    FPPrimaryButton(title: "View in Tickets", systemImage: FPIcons.tickets) {
                        dismiss()
                        openTickets()
                    }
                    FPSecondaryButton(title: "Done", systemImage: "checkmark") {
                        dismiss()
                    }
                case let .failed(message):
                    FPStateBanner(
                        title: "Payment failed",
                        message: message,
                        kind: .danger
                    )
                    FPPrimaryButton(title: "Back to checkout", systemImage: "arrow.left") {
                        dismiss()
                    }
                case let .cancelled(message):
                    FPStateBanner(
                        title: "Payment cancelled",
                        message: message,
                        kind: .warning
                    )
                    FPPrimaryButton(title: "Back to checkout", systemImage: "arrow.left") {
                        dismiss()
                    }
                }
            }
            .padding(FPSpacing.lg)
        }
    }
}

private enum FanPassCryptoAsset: String, CaseIterable, Identifiable {
    case usdc

    var id: String { rawValue }

    var title: String {
        switch self {
        case .usdc: "USDC"
        }
    }

    var networkHint: String {
        switch self {
        case .usdc: "Stablecoin"
        }
    }

    var hkdRate: Double {
        switch self {
        case .usdc: 7.8355
        }
    }

    var amountPrecision: Int {
        switch self {
        case .usdc: 2
        }
    }

    func amountLabel(for totalHKD: Int) -> String {
        let amount = Double(totalHKD) / hkdRate
        return "\(Self.format(amount, fractionDigits: amountPrecision)) \(title)"
    }

    var rateLabel: String {
        "1 \(title) ~= HK$\(Self.format(hkdRate, fractionDigits: hkdRate < 10 ? 4 : 0))"
    }

    private static func format(_ value: Double, fractionDigits: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = fractionDigits
        formatter.maximumFractionDigits = fractionDigits
        return formatter.string(from: NSNumber(value: value)) ?? String(format: "%.\(fractionDigits)f", value)
    }
}

private struct CryptoPaymentSheet: View {
    let totalHKD: Int
    let displayTotal: String
    @Environment(\.dismiss) private var dismiss
    @State private var selectedAsset: FanPassCryptoAsset = .usdc
    @State private var quotePrepared = false

    var body: some View {
        NavigationStack {
            FanPassV4Scaffold(title: "Pay with Crypto", subtitle: "Choose an accepted asset and confirm the quote before wallet approval.") {
                FPSurfaceCard {
                    VStack(alignment: .leading, spacing: FPSpacing.md) {
                        FPSectionHeader(title: "Accepted assets", subtitle: "USDC only")
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: FPSpacing.sm)], spacing: FPSpacing.sm) {
                            ForEach(FanPassCryptoAsset.allCases) { asset in
                                Button {
                                    selectedAsset = asset
                                    quotePrepared = false
                                } label: {
                                    VStack(spacing: FPSpacing.xs) {
                                        Text(asset.title)
                                            .font(FPTypography.headline)
                                        Text(asset.networkHint)
                                            .font(FPTypography.caption)
                                            .foregroundStyle(asset == selectedAsset ? FPColors.backgroundNight.opacity(0.72) : FPColors.textSecondary)
                                    }
                                    .foregroundStyle(asset == selectedAsset ? FPColors.backgroundNight : FPColors.textPrimary)
                                    .frame(maxWidth: .infinity, minHeight: 58)
                                    .background(asset == selectedAsset ? FPColors.pulseCyan : FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                                    .overlay {
                                        RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                                            .stroke(asset == selectedAsset ? FPColors.pulseCyan : FPColors.borderDivider, lineWidth: 1)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                FPConceptRowList(rows: [
                    .init(id: "total", icon: "cart.fill", title: "Order total", subtitle: "Ticket, platform fee, and tax.", value: displayTotal, kind: .info),
                    .init(id: "rate", icon: "arrow.left.arrow.right", title: "Reference rate", subtitle: "Final rate locks before payment.", value: selectedAsset.rateLabel, kind: .warning),
                    .init(id: "amount", icon: "bitcoinsign.circle.fill", title: "Amount due", subtitle: "Rounded for wallet display.", value: selectedAsset.amountLabel(for: totalHKD), kind: .success),
                    .init(id: "expiry", icon: "timer", title: "Quote window", subtitle: "Refresh the quote if the payment window expires.", value: "5 min")
                ])

                FPPolicyNotice(
                    title: "Payment quote",
                    message: "A locked quote includes the asset, rate, receiving address, amount, and expiry before wallet approval.",
                    kind: .info
                )

                if quotePrepared {
                    FPConfirmationCard(
                        title: "Quote ready",
                        message: "Wallet approval starts after the payment address and \(selectedAsset.title) amount are locked."
                    )
                }

                FPPrimaryButton(title: quotePrepared ? "Quote ready" : "Get \(selectedAsset.title) quote", systemImage: "lock.shield.fill") {
                    quotePrepared = true
                }
                FPSecondaryButton(title: "Close", systemImage: "xmark.circle.fill") {
                    dismiss()
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct FanPassV4PurchaseSuccessView: View {
    let event: FanPassV4.Event
    let ticketType: FanPassV4.TicketType
    var ticket: FanPassV4.Ticket?

    private var fallbackTicket: FanPassV4.Ticket {
        ticket ?? FanPassMockData.tickets.first ?? FanPassV4.Ticket(
            id: "FP-PENDING-SUCCESS",
            event: event,
            ticketType: ticketType,
            ownerId: FanPassMockData.currentUser.id,
            status: .active,
            section: "108",
            row: "12",
            seat: "15",
            entryMode: .nfcReady,
            transferCount: 0,
            proofHistory: FanPassMockData.proofHistory(ticketId: "FP-PENDING-SUCCESS")
        )
    }

    var body: some View {
        FanPassV4Scaffold(title: "Purchase complete", subtitle: "Your verified ticket has been assigned.") {
            FPConfirmationCard(
                title: "Verified ticket ready",
                message: "\(event.title) • \(ticketType.name)\nYour ticket is ready in your account."
            )

            NavigationLink {
                FanPassV4TicketDetailView(ticket: fallbackTicket)
            } label: {
                HStack {
                    Image(systemName: FPIcons.tickets)
                    Text("View Ticket")
                }
                .font(FPTypography.headline)
                .foregroundStyle(FPColors.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(FPGradients.passAurora, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            }
            .buttonStyle(.plain)

            FPSecondaryButton(title: "Add to Wallet", systemImage: FPIcons.wallet) {
                // Mock Apple Wallet handoff. Real Wallet pass signing is intentionally not connected here.
            }
        }
    }
}

#Preview {
    FanPassV4CheckoutView()
}
