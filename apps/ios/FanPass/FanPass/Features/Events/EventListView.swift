import SwiftUI

struct EventListView: View {
    @Environment(AppState.self) private var appState
    @State private var events: [FanPassEvent] = []
    @State private var loadingState: LoadingState = .loading

    var body: some View {
        FanPassScreen {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header

                    if loadingState == .loading {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 220)
                    } else if loadingState == .failed {
                        AuthRequiredPanel(
                            title: "Events are unavailable",
                            message: "The local API is not responding.",
                            actionTitle: "Retry",
                            action: { Task { await load() } }
                        )
                    } else {
                        featuredEvents
                        marketSnapshot
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 110)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let session = appState.session {
                    Button {
                        appState.selectedTab = .profile
                    } label: {
                        Label(session.displayName, systemImage: "person.crop.circle.fill")
                    }
                } else {
                    Button("Sign in") {
                        _ = appState.requireAuth(.profile)
                    }
                }
            }
        }
        .task {
            await load()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("FanPass")
                .font(.system(size: 38, weight: .black, design: .rounded))
                .foregroundStyle(FanPassTheme.ink)

            HStack(spacing: 8) {
                StatusPill(text: "Hong Kong", color: FanPassTheme.mint)
                StatusPill(text: "Verified entry", color: FanPassTheme.accent)
                StatusPill(text: "Resale cap", color: FanPassTheme.amber)
            }
        }
    }

    private var featuredEvents: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading(title: "Upcoming")

            ForEach(events) { event in
                NavigationLink {
                    EventDetailView(event: event)
                } label: {
                    EventFeatureCard(event: event)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var marketSnapshot: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("CAT 2 market")
                            .font(.headline)
                        Text("Face value HKD 1,288")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    StatusPill(text: "+2.5%", color: FanPassTheme.coral)
                }

                HStack(spacing: 12) {
                    MiniMetric(title: "Best bid", value: "HK$1,180")
                    MiniMetric(title: "Best ask", value: "HK$1,320")
                    MiniMetric(title: "Cap", value: "HK$1,545")
                }
            }
        }
    }

    private func load() async {
        loadingState = .loading
        do {
            events = try await appState.apiClient.events()
            loadingState = .loaded
        } catch {
            loadingState = .failed
        }
    }
}

private struct EventFeatureCard: View {
    let event: FanPassEvent

    var body: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .top) {
                        StatusPill(text: event.status, color: FanPassTheme.mint)
                        Spacer()
                        Text(price)
                            .font(.headline)
                    }

                    Text(event.title)
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(FanPassTheme.ink)
                        .lineLimit(2)

                    Label(location, systemImage: "mappin.and.ellipse")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Label(formattedDate, systemImage: "calendar")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 10) {
                    Label("View tickets", systemImage: "ticket")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FanPassTheme.accent)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(FanPassTheme.muted)
                }
            }
        }
    }

    private var location: String {
        [event.venue?.name, event.venue?.city].compactMap { $0 }.joined(separator: ", ")
    }

    private var price: String {
        guard let ticketType = event.ticketTypes.first else {
            return "TBA"
        }

        return fanPassMoney(ticketType.faceValue, currency: ticketType.currency)
    }

    private var formattedDate: String {
        fanPassDate(event.startTime)
    }
}

private struct EventDetailView: View {
    @Environment(AppState.self) private var appState
    let event: FanPassEvent
    @State private var selectedTicketType: TicketType?
    @State private var orderbook: OrderbookSnapshot?
    @State private var actionStatus: String?
    @State private var checkoutDraft: FanPassCheckoutDraft?
    @State private var isPlacingOrder = false

    var body: some View {
        FanPassScreen {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    eventHero
                    ticketTypesSection
                    marketSection
                    policySection
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 110)
            }
        }
        .navigationTitle("Event")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: selectedTicketType?.id) {
            await loadOrderbook()
        }
        .sheet(item: $checkoutDraft) { draft in
            PaymentCheckoutSheet(draft: draft)
        }
        .onAppear {
            selectedTicketType = selectedTicketType ?? event.ticketTypes.first
        }
    }

    private var eventHero: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    StatusPill(text: event.status, color: fanPassStatusColor(event.status))
                    Spacer()
                    StatusPill(text: "Verified entry", color: FanPassTheme.mint)
                }

                Text(event.title)
                    .font(.system(size: 32, weight: .black, design: .rounded))
                    .foregroundStyle(FanPassTheme.ink)
                    .lineLimit(3)

                VStack(alignment: .leading, spacing: 8) {
                    Label(location, systemImage: "mappin.and.ellipse")
                    Label(fanPassDate(event.startTime), systemImage: "calendar")
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
        }
    }

    private var ticketTypesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading(title: "Tickets")

            ForEach(event.ticketTypes) { ticketType in
                TicketTypeCard(
                    ticketType: ticketType,
                    isSelected: selectedTicketType?.id == ticketType.id,
                    buyAction: { buy(ticketType) },
                    selectAction: { selectedTicketType = ticketType }
                )
            }
        }
    }

    private var marketSection: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Market context")
                            .font(.headline)
                        Text(selectedTicketType?.name ?? "Select ticket type")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let premium = orderbook?.premiumPercent {
                        StatusPill(text: String(format: "%+.1f%%", premium), color: premium > 0 ? FanPassTheme.coral : FanPassTheme.mint)
                    }
                }

                HStack(spacing: 10) {
                    MiniMetric(title: "Last", value: orderbook?.lastTradePrice.map { fanPassMoney($0) } ?? "No trade")
                    MiniMetric(title: "Floor", value: orderbook?.floorPrice.map { fanPassMoney($0) } ?? "No ask")
                    MiniMetric(title: "Volume", value: "\(orderbook?.volume ?? 0)")
                }

                if let actionStatus {
                    Text(actionStatus)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(FanPassTheme.slate)
                }
            }
        }
    }

    private var policySection: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Limits")
                    .font(.headline)
                if let ticketType = selectedTicketType {
                    PolicyRow(title: "Face value", value: fanPassMoney(ticketType.faceValue, currency: ticketType.currency))
                    PolicyRow(title: "Resale cap", value: ticketType.resaleCap.map { fanPassMoney($0, currency: ticketType.currency) } ?? "No cap")
                    PolicyRow(title: "Transfer", value: ticketType.transferable ? "Allowed up to \(ticketType.maxTransferCount ?? 1)" : "Locked to buyer")
                } else {
                    Text("Select a ticket type to inspect limits.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var location: String {
        [event.venue?.name, event.venue?.city].compactMap { $0 }.joined(separator: ", ")
    }

    private func buy(_ ticketType: TicketType) {
        guard appState.requireAuth(.checkout), let session = appState.session else {
            return
        }

        isPlacingOrder = true
        actionStatus = "Creating buy order..."
        Task {
            do {
                let checkoutId = UUID().uuidString
                let response = try await appState.apiClient.createOrder(
                    userId: session.userId,
                    eventId: event.id,
                    ticketTypeId: ticketType.id,
                    side: "BUY",
                    price: ticketType.faceValue,
                    idempotencyKey: "ios-buy-order:\(checkoutId)"
                )
                let draft = try await FanPassPaymentCoordinator(apiClient: appState.apiClient)
                    .prepareCheckout(
                        order: response.order,
                        eventTitle: event.title,
                        ticketTypeName: ticketType.name
                    )
                await MainActor.run {
                    checkoutDraft = draft
                    actionStatus = response.trade == nil ? "Payment authorization ready for \(fanPassMoney(response.order.price))." : "Matched; payment authorization is ready."
                    isPlacingOrder = false
                }
            } catch let error as APIClientError {
                await MainActor.run {
                    actionStatus = error.localizedDescription
                    isPlacingOrder = false
                }
            } catch {
                await MainActor.run {
                    actionStatus = "Checkout could not be prepared. Check payment configuration and current ticket state."
                    isPlacingOrder = false
                }
            }
        }
    }

    private func loadOrderbook() async {
        guard let ticketType = selectedTicketType else {
            orderbook = nil
            return
        }

        orderbook = try? await appState.apiClient.orderbook(eventId: event.id, ticketTypeId: ticketType.id)
    }
}

private struct PaymentCheckoutSheet: View {
    let draft: FanPassCheckoutDraft
    @Environment(\.dismiss) private var dismiss
    @State private var paymentSheetRequest: UUID?
    @State private var stripeResult: FanPassStripeCheckoutResult?

    var body: some View {
        NavigationStack {
            FanPassScreen {
                VStack(alignment: .leading, spacing: 18) {
                    SoftCard {
                        VStack(alignment: .leading, spacing: 14) {
                            HStack {
                                Image(systemName: "creditcard.and.123")
                                    .font(.title2.weight(.semibold))
                                    .foregroundStyle(FanPassTheme.accent)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("Payment authorization")
                                        .font(.headline)
                                    Text("Stripe PaymentIntent prepared")
                                        .font(.subheadline)
                                        .foregroundStyle(FanPassTheme.muted)
                                }
                                Spacer()
                                StatusPill(text: draft.payment.captureStatus, color: FanPassTheme.amber)
                            }

                            Divider()

                            LabeledContent("Event", value: draft.eventTitle)
                            LabeledContent("Ticket", value: draft.ticketTypeName)
                            LabeledContent("Amount", value: fanPassMoney(draft.payment.amountMajor, currency: draft.payment.currency.uppercased()))
                            LabeledContent("Payment", value: draft.payment.id)
                            LabeledContent("Status", value: draft.payment.status)
                        }
                    }

                    SoftCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "lock.shield")
                                    .foregroundStyle(FanPassTheme.mint)
                                Text("Stripe checkout")
                                    .font(.headline)
                            }

                            Text(stripeReadiness.message)
                                .font(.subheadline)
                                .foregroundStyle(FanPassTheme.slate)

                            if let stripeResult {
                                Text(stripeResult.message)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(resultColor(stripeResult))
                            }

                            Button {
                                paymentSheetRequest = UUID()
                            } label: {
                                Label("Authorize with Stripe", systemImage: "creditcard")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(!stripeReadiness.isReady)
                        }
                    }

                    Button {
                        dismiss()
                    } label: {
                        Label("Done", systemImage: "checkmark")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)

                    Spacer()
                }
                .padding(20)
                .background(paymentSheetPresenter)
            }
            .navigationTitle("Checkout")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    @ViewBuilder
    private var paymentSheetPresenter: some View {
        if case let .ready(clientSecret, publishableKey) = stripeReadiness {
            FanPassStripePaymentSheetPresenter(
                clientSecret: clientSecret,
                publishableKey: publishableKey,
                returnURL: FanPassEnvironment.stripeReturnURL,
                presentationRequest: $paymentSheetRequest
            ) { result in
                stripeResult = result
            }
            .frame(width: 0, height: 0)
        }
    }

    private var stripeReadiness: StripeReadiness {
        guard let publishableKey = FanPassEnvironment.stripePublishableKey else {
            return .blocked("Add a Stripe test publishable key through FANPASS_STRIPE_PUBLISHABLE_KEY before presenting PaymentSheet.")
        }

        guard let clientSecret = draft.payment.clientSecret,
              !clientSecret.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            return .blocked("The backend did not return a PaymentIntent client secret.")
        }

        guard !clientSecret.hasPrefix("pi_mock"),
              !clientSecret.lowercased().contains("_mock")
        else {
            return .blocked("The API is using local mock payments. Start it with Stripe test secrets before presenting PaymentSheet.")
        }

        return .ready(clientSecret: clientSecret, publishableKey: publishableKey)
    }

    private func resultColor(_ result: FanPassStripeCheckoutResult) -> Color {
        switch result {
        case .completed:
            FanPassTheme.mint
        case .canceled:
            FanPassTheme.amber
        case .failed:
            FanPassTheme.coral
        }
    }
}

private enum StripeReadiness: Equatable {
    case ready(clientSecret: String, publishableKey: String)
    case blocked(String)

    var isReady: Bool {
        if case .ready = self {
            return true
        }
        return false
    }

    var message: String {
        switch self {
        case .ready:
            "PaymentSheet is configured for Stripe test mode. The payment method collection remains inside Stripe's native SDK UI."
        case let .blocked(message):
            message
        }
    }
}

private struct TicketTypeCard: View {
    let ticketType: TicketType
    let isSelected: Bool
    let buyAction: () -> Void
    let selectAction: () -> Void

    var body: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(ticketType.name)
                            .font(.title3.weight(.bold))
                        Text("\(ticketType.supply) total supply")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(fanPassMoney(ticketType.faceValue, currency: ticketType.currency))
                        .font(.headline)
                }

                HStack(spacing: 8) {
                    StatusPill(text: ticketType.transferable ? "Transferable" : "Locked", color: ticketType.transferable ? FanPassTheme.accent : FanPassTheme.amber)
                    StatusPill(text: ticketType.resaleCap.map { "Cap \(fanPassMoney($0, currency: ticketType.currency))" } ?? "No cap", color: FanPassTheme.amber)
                }

                HStack(spacing: 10) {
                    Button(isSelected ? "Selected" : "Inspect", action: selectAction)
                        .buttonStyle(.bordered)
                    Button("Buy", action: buyAction)
                        .buttonStyle(.borderedProminent)
                }
            }
        }
    }
}

private struct PolicyRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }
}

private struct MiniMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(FanPassTheme.background, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

enum LoadingState {
    case loading
    case loaded
    case failed
}

#Preview {
    NavigationStack {
        EventListView()
    }
    .environment(AppState())
}
