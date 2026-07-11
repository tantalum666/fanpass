import SwiftUI

struct FanPassV4CheckoutView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel
    @State private var viewModel = CheckoutViewModel()
    @State private var paymentSheetRequest: UUID?
    @State private var preparedPayment: FanPassPaymentIntent?
    @State private var isPreparingStripe = false
    @State private var stripeCheckoutAttemptId = UUID().uuidString
    @State private var cryptoCheckoutAttemptId = UUID().uuidString
    @State private var showingAuthGate = false
    @State private var showingCryptoSheet = false
    @State private var checkoutOutcome: CheckoutOutcome?
    @State private var onsaleCheckoutGate: FanPassOnsaleCheckoutGate
    @State private var availableByTicketType: [String: Int] = [:]

    init(
        event: FanPassV4.Event = FanPassMockData.events[0],
        ticketType: FanPassV4.TicketType = FanPassMockData.events[0].safePrimaryTicketType,
        quotedPrice: Int? = nil,
        priceLineTitle: String = "Face value",
        fulfillmentMode: FanPassOrderFulfillmentMode = .primaryOnly,
        onAuthRequired: (() -> Void)? = nil
    ) {
        self.onAuthRequired = onAuthRequired
        _onsaleCheckoutGate = State(
            initialValue: fulfillmentMode == .primaryOnly ? .checking : .direct
        )
        _viewModel = State(
            initialValue: CheckoutViewModel(
                event: event,
                ticketType: ticketType,
                quotedPrice: quotedPrice,
                priceLineTitle: priceLineTitle,
                fulfillmentMode: fulfillmentMode
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
                    FPSectionHeader(title: "Order total", subtitle: "Amount authorized by FanPass")
                    checkoutRow(viewModel.priceLineTitle, viewModel.ticketPriceLabel)
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

            if viewModel.fulfillmentMode == .primaryOnly {
                FanPassV4OnsaleTransparencyView(
                    event: viewModel.event,
                    checkoutGate: $onsaleCheckoutGate,
                    availableByTicketType: $availableByTicketType
                )
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
                FPPrimaryButton(title: "View in Tickets", systemImage: FPIcons.tickets) {
                    appViewModel.openTickets()
                }
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
                displayTotal: viewModel.totalLabel,
                viewModel: viewModel,
                checkoutAttemptId: cryptoCheckoutAttemptId
            ) {
                checkoutOutcome = .success(
                    title: "Payment confirmed",
                    message: "FanPass is adding your ticket to your account. Open Tickets again in a few seconds if it does not appear immediately."
                )
            }
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
            FPPrimaryButton(
                title: isQueueManagedSale ? "USDC unavailable for queued sale" : "Pay with USDC",
                systemImage: "bitcoinsign.circle.fill"
            ) {
                prepareCryptoCheckout()
            }
            .disabled(isQueueManagedSale || !saleAllowsCheckout)
            FPSecondaryButton(title: "Pay by card", systemImage: "creditcard.fill") {
                Task {
                    await prepareAndPresentStripe()
                }
            }
            .disabled(isPreparingStripe || viewModel.paymentState == .authorizing || !saleAllowsCheckout)
            Text(stripeReadinessMessage)
                .font(FPTypography.caption)
                .foregroundStyle(isStripeReady ? FPColors.textSecondary : FPColors.warningAmber)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Text("USDC payments are confirmed before the ticket is issued.")
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
        if !saleAllowsCheckout {
            return onsaleCheckoutGate.buttonTitle
        }
        if !hasAvailableInventory {
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
            saleAllowsCheckout &&
            hasAvailableInventory
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
        guard hasAPIBearerSession else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Your sign-in session needs to be refreshed before crypto checkout."
            return
        }
        guard hasLiveAPISessionForStripe else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Sign in again before crypto checkout."
            return
        }
        guard hasBackendCheckoutCatalogItem else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Crypto checkout is not available for this event yet."
            return
        }
        guard saleAllowsCheckout else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Join the live sale queue and wait for a checkout window before paying."
            return
        }
        guard !isQueueManagedSale else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Queued on-sales currently require card authorization so inventory can be released safely if settlement fails."
            return
        }
        guard hasAvailableInventory else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Online checkout for this ticket category is unavailable."
            return
        }
        guard backend.isPrivyAvailable else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Wallet payment is temporarily unavailable in this build."
            return
        }
        guard hasFanPassPaymentWallet else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Sign in with FanPass wallet before paying with USDC."
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
        guard saleAllowsCheckout else {
            viewModel.paymentState = .failed
            viewModel.errorMessage = "Join the live sale queue and wait for a checkout window before paying."
            return
        }
        guard hasAvailableInventory else {
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

    private var hasFanPassPaymentWallet: Bool {
        guard let walletId = backend.session?.privyWalletId?.trimmingCharacters(in: .whitespacesAndNewlines) else {
            return false
        }
        return !walletId.isEmpty
    }

    private var canBuyTickets: Bool {
        backend.user.role == .fan || backend.user.role == .admin
    }

    private var hasAvailableInventory: Bool {
        if viewModel.fulfillmentMode == .resaleOnly {
            return true
        }
        return (availableByTicketType[viewModel.ticketType.id] ?? viewModel.ticketType.availableQuantity) > 0
    }

    private var saleAllowsCheckout: Bool {
        viewModel.fulfillmentMode == .resaleOnly ||
            !viewModel.event.isBackendBacked ||
            onsaleCheckoutGate.allowsCheckout
    }

    private var isQueueManagedSale: Bool {
        viewModel.fulfillmentMode == .primaryOnly &&
            viewModel.event.isBackendBacked &&
            onsaleCheckoutGate != .direct &&
            onsaleCheckoutGate != .checking
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
            checkoutOutcome = .success(
                title: "Payment authorized",
                message: viewModel.fulfillmentMode == .resaleOnly
                    ? "FanPass is completing the verified resale transfer. The ticket will appear after settlement."
                    : "Ticket assignment is syncing with FanPass. Open Tickets again in a few seconds to load the server-issued ticket and its proof status."
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
    case success(title: String, message: String)
    case failed(message: String)
    case cancelled(message: String)

    var id: String {
        switch self {
        case let .success(title, message): "success-\(title)-\(message)"
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
                case let .success(title, message):
                    FPConfirmationCard(
                        title: title,
                        message: message,
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

private struct CryptoPaymentSheet: View {
    let totalHKD: Int
    let displayTotal: String
    let viewModel: CheckoutViewModel
    let checkoutAttemptId: String
    let onConfirmed: () -> Void
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(\.dismiss) private var dismiss
    @State private var state: CryptoPaymentState = .idle
    @State private var quoteResponse: FanPassCryptoQuoteResponse?
    @State private var didStartInitialQuote = false

    var body: some View {
        NavigationStack {
            FanPassV4Scaffold(title: "Pay with USDC", subtitle: "Review the amount and pay from your FanPass wallet.") {
                FPSurfaceCard {
                    VStack(alignment: .leading, spacing: FPSpacing.md) {
                        FPSectionHeader(title: "Payment method", subtitle: "USDC")
                        HStack(spacing: FPSpacing.sm) {
                            Image(systemName: "dollarsign.circle.fill")
                                .font(.title2)
                            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                                Text("USDC")
                                    .font(FPTypography.headline)
                                Text("Paid from your FanPass wallet")
                                    .font(FPTypography.caption)
                                    .foregroundStyle(FPColors.textSecondary)
                            }
                            Spacer()
                            FPStatusPill(title: "Wallet", systemImage: "wallet.pass.fill", foreground: FPColors.pulseCyan, background: FPColors.pulseCyan.opacity(0.12), border: FPColors.pulseCyan.opacity(0.5))
                        }
                        .foregroundStyle(FPColors.textPrimary)
                        .frame(maxWidth: .infinity, minHeight: 58)
                    }
                }

                FPConceptRowList(rows: [
                    .init(id: "total", icon: "cart.fill", title: "Order total", subtitle: "Ticket, platform fee, and tax.", value: displayTotal, kind: .info),
                    .init(id: "rate", icon: "arrow.left.arrow.right", title: "Exchange rate", subtitle: "Current rate for this payment.", value: quote?.paymentRateLabel ?? "Loading", kind: .warning),
                    .init(id: "amount", icon: "bitcoinsign.circle.fill", title: "Pay today", subtitle: "Final amount for this order.", value: quote?.amountLabel ?? "-- USDC", kind: .success),
                    .init(id: "expiry", icon: "timer", title: "Payment window", subtitle: "The amount is held briefly while you pay.", value: quoteExpiryLabel)
                ])

                FPPolicyNotice(
                    title: "Secure payment",
                    message: "FanPass confirms your payment before issuing the ticket to your account.",
                    kind: .info
                )

                switch state {
                case .idle:
                    EmptyView()
                case .quoting:
                    FPStateBanner(title: "Preparing amount", message: "FanPass is checking the latest USDC amount for this order.", kind: .info)
                case .quoteReady:
                    FPConfirmationCard(
                        title: "Ready to pay",
                        message: "Tap Pay to complete the order. Your ticket will appear after payment is confirmed."
                    )
                case .sending:
                    FPStateBanner(
                        title: "Waiting for network confirmation",
                        message: "This can take a minute. Keep FanPass open and do not tap Pay again; your ticket appears after confirmation.",
                        kind: .info
                    )
                case .confirming:
                    FPStateBanner(title: "Finalizing ticket", message: "Payment was received. FanPass is adding the ticket to your account.", kind: .info)
                case .confirmed:
                    FPConfirmationCard(title: "Payment confirmed", message: "Your ticket is being added to your account.")
                case .failed(let message):
                    FPStateBanner(title: "Payment failed", message: message, kind: .danger)
                }

                FPPrimaryButton(title: primaryButtonTitle, systemImage: primaryButtonIcon) {
                    Task { await advance() }
                }
                .disabled(primaryButtonDisabled)
                FPSecondaryButton(title: "Close", systemImage: "xmark.circle.fill") {
                    dismiss()
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                guard !didStartInitialQuote else { return }
                didStartInitialQuote = true
                await prepareQuote()
            }
        }
    }

    private var quote: FanPassCryptoQuote? {
        quoteResponse?.quote
    }

    private var quoteExpiryLabel: String {
        "5 min"
    }

    private var primaryButtonTitle: String {
        switch state {
        case .idle, .failed:
            "Prepare payment"
        case .quoting:
            "Preparing"
        case .quoteReady:
            "Pay"
        case .sending:
            "Waiting"
        case .confirming:
            "Finalizing"
        case .confirmed:
            "Confirmed"
        }
    }

    private var primaryButtonIcon: String {
        switch state {
        case .idle, .failed:
            "lock.shield.fill"
        case .quoteReady:
            "creditcard.fill"
        case .quoting, .sending, .confirming:
            "arrow.triangle.2.circlepath"
        case .confirmed:
            "checkmark.seal.fill"
        }
    }

    private var primaryButtonDisabled: Bool {
        switch state {
        case .quoting, .sending, .confirming, .confirmed:
            true
        case .idle, .quoteReady, .failed:
            false
        }
    }

    private func advance() async {
        switch state {
        case .idle, .failed:
            await prepareQuote()
        case .quoteReady:
            await sendWalletPayment()
        case .quoting, .sending, .confirming, .confirmed:
            break
        }
    }

    private func prepareQuote() async {
        do {
            state = .quoting
            quoteResponse = try await viewModel.prepareCryptoQuote(
                apiClient: backend.apiClient,
                owner: backend.user,
                checkoutAttemptId: checkoutAttemptId
            )
            state = .quoteReady
        } catch {
            viewModel.paymentState = .failed
            let message = paymentErrorMessage(error)
            viewModel.errorMessage = message
            state = .failed(message)
        }
    }

    private func sendWalletPayment() async {
        guard let quoteResponse else {
            state = .failed("Prepare the payment amount before paying.")
            return
        }
        guard let walletId = backend.session?.privyWalletId?.trimmingCharacters(in: .whitespacesAndNewlines),
              !walletId.isEmpty
        else {
            state = .failed("Sign in with FanPass wallet before paying with USDC.")
            return
        }
        do {
            state = .sending
            let authorization = try await backend.sponsoredPaymentAuthorization(
                quote: quoteResponse.quote,
                walletId: walletId
            )
            let confirmation = try await backend.apiClient.sendSponsoredCryptoPayment(
                paymentId: quoteResponse.payment.id,
                idempotencyKey: "ios-v4-crypto-sponsored-\(checkoutAttemptId)",
                authorization: authorization
            )
            state = .confirming(confirmation.transactionHash ?? "")
            viewModel.applyCryptoConfirmation(confirmation)
            state = .confirmed(confirmation.transactionHash ?? "")
            onConfirmed()
            dismiss()
        } catch {
            viewModel.paymentState = .failed
            let message = paymentErrorMessage(error)
            viewModel.errorMessage = message
            state = .failed(message)
        }
    }

    private func shortHash(_ hash: String) -> String {
        guard hash.count > 14 else { return hash }
        return "\(hash.prefix(8))...\(hash.suffix(6))"
    }

    private func paymentErrorMessage(_ error: Error) -> String {
        if let apiError = error as? APIClientError,
           apiError.resultCode == "INSUFFICIENT_USDC_BALANCE" {
            return "Your FanPass wallet needs more USDC for this order."
        }
        let raw = error.localizedDescription
        let lowercased = raw.lowercased()
        if lowercased.contains("not have enough usdc") ||
            lowercased.contains("needs more usdc") ||
            lowercased.contains("insufficient_usdc_balance") {
            return "Your FanPass wallet needs more USDC for this order."
        }
        if lowercased.contains("transaction_broadcast_failure") ||
            lowercased.contains("insufficient funds for gas") ||
            lowercased.contains("gas * price") {
            return "Wallet payment is temporarily unavailable. Try card payment or try again later."
        }
        if lowercased.contains("privy") ||
            lowercased.contains("sponsored") ||
            lowercased.contains("wallet id") {
            return "Sign in with FanPass wallet before paying with USDC."
        }
        if lowercased.contains("rpc") ||
            lowercased.contains("contract") ||
            lowercased.contains("receiver address") ||
            lowercased.contains("internal server error") ||
            lowercased.contains("temporarily unavailable") {
            return "Wallet payment is temporarily unavailable. Try card payment or try again later."
        }
        return raw
    }
}

private enum CryptoPaymentState: Equatable {
    case idle
    case quoting
    case quoteReady
    case sending
    case confirming(String)
    case confirmed(String)
    case failed(String)
}

#Preview {
    FanPassV4CheckoutView()
}
