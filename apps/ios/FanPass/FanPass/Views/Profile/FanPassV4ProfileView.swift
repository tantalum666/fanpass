import SwiftUI
import UIKit

struct FanPassV4ProfileView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @State private var viewModel: ProfileViewModel
    @Binding private var selectedSection: FanPassAccountSection
    @State private var authEmail = ""
    @State private var authCode = ""
    @State private var isSendingCode = false
    @State private var isVerifyingCode = false
    @State private var activeOAuthProvider: PrivyOAuthLoginProvider?
    @State private var accountRoute: AccountRoute?
    @State private var showSignInPage = false
    @State private var walletBalances: FanPassWalletBalancesResponse?
    @State private var walletBalanceError: String?
    @State private var isLoadingWalletBalances = false
    @State private var copiedWalletAddress = false
    @State private var displayNameDraft = ""
    @State private var profileSaved = false
    @State private var dataExportRequested = false
    @State private var pushAlertsEnabled = true
    @State private var emailReceiptsEnabled = true
    @State private var priceAlertsEnabled = true
    @State private var entryRemindersEnabled = true
    @State private var marketingUpdatesEnabled = false
    @State private var trustedDeviceEnabled = true
    @State private var friendDiscoveryEnabled = false
    @State private var usageAnalyticsEnabled = false
    @State private var selectedCurrency = "HKD"
    @State private var selectedRegion = "Hong Kong"
    @State private var selectedAppearance = "System"
    @State private var selectedSupportTopic = "Order"
    @State private var supportDraft = ""
    @State private var supportSubmitted = false
    let showStaffMode: Bool
    let onSignOut: () -> Void
    let onScenarioApplied: (FanPassV4.DemoUserScenario) -> Void

    init(
        user: FanPassV4.User = FanPassMockData.currentUser,
        selectedSection: Binding<FanPassAccountSection> = .constant(.overview),
        showStaffMode: Bool = false,
        onSignOut: @escaping () -> Void = {},
        onScenarioApplied: @escaping (FanPassV4.DemoUserScenario) -> Void = { _ in }
    ) {
        self.showStaffMode = showStaffMode
        self.onSignOut = onSignOut
        self.onScenarioApplied = onScenarioApplied
        _selectedSection = selectedSection
        _viewModel = State(initialValue: ProfileViewModel(user: user))
        _displayNameDraft = State(initialValue: user.displayName)
    }

    var body: some View {
        FanPassV4Scaffold(
            title: "Account",
            subtitle: "Identity, privacy, orders, alerts, and support.",
            verticalSpacing: backend.isAuthenticated ? FPSpacing.xl : FPSpacing.md,
            topPadding: backend.isAuthenticated ? FPSpacing.xl : FPSpacing.md,
            bottomPadding: backend.isAuthenticated ? FPSpacing.threeXL + 96 : FPSpacing.sixXL + FPSpacing.sm,
            scrollDisabled: !backend.isAuthenticated
        ) {
            accountHeader
            accountMenu
            if backend.session != nil {
                signOutButton
            }
            if backend.isAuthenticated {
                Color.clear
                    .frame(height: 88)
            }
        }
        .navigationDestination(isPresented: $showSignInPage) {
            FanPassV4Scaffold(
                title: "Sign in / Sign up",
                subtitle: "Use email code or a linked social account.",
                bottomPadding: FPSpacing.threeXL + 96
            ) {
                signInContent
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
        }
        .navigationDestination(item: $accountRoute) { route in
            FanPassV4Scaffold(
                title: route.title,
                subtitle: route.subtitle,
                bottomPadding: FPSpacing.threeXL + 96
            ) {
                routeContent(for: route)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
        }
        .task(id: backend.user.id) {
            viewModel.user = backend.user
            displayNameDraft = backend.user.displayName
            walletBalances = nil
            walletBalanceError = nil
            isLoadingWalletBalances = false
            if backend.isAuthenticated && authEmail.isEmpty {
                authEmail = backend.user.email
            }
            if !backend.isAuthenticated && selectedSection == .security {
                showSignInPage = true
            }
            if !backend.isAuthenticated {
                walletBalances = nil
                walletBalanceError = nil
                isLoadingWalletBalances = false
            }
        }
        .onChange(of: selectedSection) { _, newSection in
            if !backend.isAuthenticated && newSection == .security {
                showSignInPage = true
            }
        }
    }

    private var accountHeader: some View {
        Button {
            if !backend.isAuthenticated {
                showSignInPage = true
            }
        } label: {
            FPSurfaceCard(cornerRadius: FPRadius.xl) {
                VStack(alignment: .leading, spacing: FPSpacing.md) {
                    HStack(spacing: FPSpacing.md) {
                        Image(systemName: FPIcons.profile)
                            .font(.system(size: 42, weight: .semibold))
                            .foregroundStyle(FPGradients.passAurora)
                        VStack(alignment: .leading, spacing: FPSpacing.xs) {
                            Text(accountDisplayName)
                                .font(FPTypography.title2)
                                .foregroundStyle(FPColors.textPrimary)
                            if backend.isAuthenticated {
                                Text(accountDisplaySubtitle)
                                    .font(FPTypography.callout)
                                    .foregroundStyle(FPColors.textSecondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        if !backend.isAuthenticated {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(FPColors.textTertiary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
    }

    private var accountDisplayName: String {
        backend.isAuthenticated ? viewModel.user.displayName : "Sign in / Sign up"
    }

    private var accountDisplaySubtitle: String {
        backend.isAuthenticated ? viewModel.user.maskedEmail : "Sign in to manage tickets"
    }

    @ViewBuilder
    private func routeContent(for route: AccountRoute) -> some View {
        switch route {
        case .menu(let item):
            switch item {
            case .profile:
                profileDetails
            case .orders:
                orders
            case .alerts:
                alerts
            case .security:
                securityPrivacy
            case .paymentMethods:
                paymentMethods
            case .wallet:
                walletAndKeys
            case .sellerPayouts:
                sellerPayouts
            case .credits:
                creditsAndPromos
            case .settings:
                settings
            case .support:
                support
            }
        case .privateKeyExport:
            privateKeyExportContent
        }
    }

    private var accountMenu: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            ForEach(AccountMenuSection.allCases) { section in
                VStack(alignment: .leading, spacing: FPSpacing.sm) {
                    FPSectionHeader(title: section.title, subtitle: section.subtitle)
                    AccountSettingsGroup(items: section.items, compact: !backend.isAuthenticated) { item in
                        guard backend.isAuthenticated else {
                            showSignInPage = true
                            return
                        }
                        if let section = item.section {
                            selectedSection = section
                        }
                        accountRoute = .menu(item)
                    }
                }
            }
        }
    }

    private var profileDetails: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Profile details", subtitle: "Private details stay masked until needed")
            FPSurfaceCard {
                VStack(alignment: .leading, spacing: FPSpacing.md) {
                    Text("Display name")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                    TextField("Display name", text: $displayNameDraft)
                        .textInputAutocapitalization(.words)
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textPrimary)
                        .padding(FPSpacing.md)
                        .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                    FPPrimaryButton(title: profileSaved ? "Saved" : "Save profile", systemImage: profileSaved ? "checkmark" : "person.crop.circle.fill") {
                        saveProfileDraft()
                    }
                    .disabled(displayNameDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            FPConceptRowList(rows: [
                .init(id: "email", icon: "envelope.fill", title: "Email", subtitle: viewModel.user.maskedEmail, value: "Verified", kind: .success),
                .init(id: "phone", icon: "phone.fill", title: "Phone", subtitle: "Optional for event day support.", value: "Not set", kind: .warning),
                .init(id: "social", icon: "person.2.fill", title: "Connected sign-in", subtitle: "Email code and linked social sign-in stay available.", value: "Ready", kind: .success),
                .init(id: "data", icon: "tray.and.arrow.down.fill", title: "Data export", subtitle: "Request account, order, ticket lifecycle, and support records.", value: dataExportRequested ? "Requested" : "Request", kind: dataExportRequested ? .success : .info)
            ])
            FPSecondaryButton(title: dataExportRequested ? "Export requested" : "Request data export", systemImage: "tray.and.arrow.down.fill") {
                dataExportRequested = true
            }
            .disabled(dataExportRequested)
            FPPolicyNotice(
                title: "Profile boundary",
                message: "Account stores contact and preference details. Ticket entry, resale, and transfer actions remain inside Tickets.",
                kind: .info
            )
        }
    }

    private var orders: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Orders and receipts", subtitle: "Purchase history, refunds, and support references")
            FPConceptRowList(rows: [
                .init(id: "receipt", icon: "doc.text.fill", title: "Receipt delivery", subtitle: emailReceiptsEnabled ? "Send receipts to \(viewModel.user.maskedEmail)." : "Email receipts are paused.", value: emailReceiptsEnabled ? "On" : "Off", kind: emailReceiptsEnabled ? .success : .warning),
                .init(id: "fee", icon: "list.bullet.rectangle.fill", title: "Fee breakdown", subtitle: "Show ticket price, platform fee, tax, and refund outcome.", value: "Visible", kind: .success),
                .init(id: "supportRef", icon: "number.circle.fill", title: "Support reference", subtitle: "Use masked order references instead of raw provider IDs.", value: "Safe", kind: .success)
            ])
            FPConceptMiniTimeline(rows: [
                .init(id: "ord1", icon: "receipt.fill", title: "ORD-AUR-1024", subtitle: "Aurora Nights • payment captured • ticket issued", value: "HK$1,348", kind: .success),
                .init(id: "ord2", icon: "arrow.uturn.backward.circle.fill", title: "ORD-FIN-0441", subtitle: "City Finals • refund completed", value: "Refunded", kind: .neutral),
                .init(id: "ord3", icon: FPIcons.error, title: "ORD-LAB-0990", subtitle: "Reservation expired before authorization", value: "Expired", kind: .warning)
            ])
            FPStateBanner(title: "Receipts are account-scoped", message: "Order detail screens should show masked references, fees, refunds, and ticket outcome without exposing payment provider internals.", kind: .info)
        }
    }

    private var alerts: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Alerts", subtitle: "Rule builder for drops, prices, and ticket state")
            AccountToggleRow(title: "Push notifications", subtitle: "Fast updates for gate, resale, and order state.", systemImage: "bell.fill", isOn: $pushAlertsEnabled)
            AccountToggleRow(title: "Email receipts", subtitle: "Order receipts and refund updates.", systemImage: "envelope.fill", isOn: $emailReceiptsEnabled)
            AccountToggleRow(title: "Price alerts", subtitle: "Notify when resale falls under saved targets.", systemImage: FPIcons.market, isOn: $priceAlertsEnabled)
            AccountToggleRow(title: "Entry reminders", subtitle: "Remind before gate opens and when QR refresh is needed.", systemImage: FPIcons.qr, isOn: $entryRemindersEnabled)
            AccountToggleRow(title: "Fan Access updates", subtitle: "Task approval and access badge updates.", systemImage: FPIcons.fanAccess, isOn: $marketingUpdatesEnabled)
            FPConceptRowList(rows: [
                .init(id: "drop", icon: "bell.badge.fill", title: "Artist drop alert", subtitle: "Notify when saved artists announce verified events.", value: pushAlertsEnabled ? "On" : "Off", kind: pushAlertsEnabled ? .success : .warning),
                .init(id: "price", icon: FPIcons.market, title: "Price below target", subtitle: "Aurora Nights under HK$1,400.", value: priceAlertsEnabled ? "HK$1,400" : "Off", kind: priceAlertsEnabled ? .info : .warning),
                .init(id: "entry", icon: FPIcons.qr, title: "Entry readiness", subtitle: "Remind 2 hours before gate opens.", value: entryRemindersEnabled ? "2h" : "Off", kind: entryRemindersEnabled ? .warning : .neutral)
            ])
        }
    }

    private var securityPrivacy: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Security and privacy")
            AccountToggleRow(title: "Trusted device", subtitle: "Keep this phone signed in for ticket retrieval.", systemImage: "iphone.gen3", isOn: $trustedDeviceEnabled)
            AccountToggleRow(title: "Friend discovery", subtitle: "Let contacts find your FanPass profile.", systemImage: "person.2.fill", isOn: $friendDiscoveryEnabled)
            AccountToggleRow(title: "Usage analytics", subtitle: "Share app diagnostics without personal ticket payloads.", systemImage: "waveform.path.ecg", isOn: $usageAnalyticsEnabled)
            FPConceptRowList(rows: [
                .init(id: "login", icon: "lock.shield.fill", title: "Sign-in protection", subtitle: "Email code and account session controls.", value: "Enabled", kind: .success),
                .init(id: "sessions", icon: "iphone.gen3", title: "Sessions and devices", subtitle: "Manage active sessions and sign out.", value: backend.session == nil ? "0" : "1"),
                .init(id: "privacy", icon: "eye.slash.fill", title: "Privacy", subtitle: "Sensitive account and payment details stay private.", value: "Protected", kind: .success),
                .init(id: "delete", icon: "trash.fill", title: "Delete account", subtitle: "Requires confirmation.", value: "Locked", kind: .danger)
            ])
            FPPolicyNotice(
                title: "Private by default",
                message: "FanPass never displays raw payment provider tokens, QR payloads, private keys, or full chain proof internals in Account.",
                kind: .success
            )
        }
    }

    private var signInContent: some View {
        FPSurfaceCard {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                FPSectionHeader(
                    title: "Email code",
                    subtitle: backend.isPrivyAvailable ? "Sign in or create your fan account." : "Email login is temporarily unavailable."
                )
                TextField("Email", text: $authEmail)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textPrimary)
                    .padding(FPSpacing.md)
                    .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                TextField("6-digit code", text: $authCode)
                    .keyboardType(.numberPad)
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textPrimary)
                    .padding(FPSpacing.md)
                    .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                HStack(spacing: FPSpacing.md) {
                    Spacer(minLength: 0)
                    ForEach(PrivyOAuthLoginProvider.allCases) { provider in
                        SocialAuthButton(
                            provider: provider,
                            isLoading: activeOAuthProvider == provider
                        ) {
                            Task { await signInWithOAuth(provider) }
                        }
                        .disabled(!backend.isPrivyAvailable || activeOAuthProvider != nil || isVerifyingCode || isSendingCode)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.top, FPSpacing.xs)
                VStack(spacing: FPSpacing.sm) {
                    FPSecondaryButton(title: isSendingCode ? "Sending" : "Send code", systemImage: "envelope.fill") {
                        Task { await sendPrivyCode() }
                    }
                    .disabled(!backend.isPrivyAvailable || isSendingCode || activeOAuthProvider != nil)
                    FPPrimaryButton(title: isVerifyingCode ? "Signing in" : "Sign in / Sign up", systemImage: "checkmark.shield.fill", isLoading: isVerifyingCode) {
                        Task { await verifyPrivyCode() }
                    }
                    .disabled(!backend.isPrivyAvailable || isVerifyingCode || activeOAuthProvider != nil || authCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                if let message = backend.authMessage {
                    Text(message)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var signOutButton: some View {
        FPSecondaryButton(title: "Sign out", systemImage: "rectangle.portrait.and.arrow.right") {
            onSignOut()
        }
    }

    private var paymentMethods: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Payment methods", subtitle: "Checkout options and safe payment state")
            FPConceptRowList(rows: [
                .init(id: "card", icon: "creditcard.fill", title: "Card checkout", subtitle: "Cards are collected in secure checkout UI, not stored in Account.", value: "Stripe", kind: .success),
                .init(id: "wallet", icon: FPIcons.wallet, title: "USDC wallet", subtitle: walletAddressLabel, value: walletStatusValue, kind: walletKind),
                .init(id: "applePay", icon: "apple.logo", title: "Apple Pay", subtitle: "Available when card checkout provider enables it.", value: "Checkout", kind: .info),
                .init(id: "receipts", icon: "receipt.fill", title: "Default receipt", subtitle: emailReceiptsEnabled ? "Email receipt after authorization or refund." : "Receipt email is paused.", value: emailReceiptsEnabled ? "On" : "Off", kind: emailReceiptsEnabled ? .success : .warning)
            ])
            FPPolicyNotice(
                title: "Payment boundary",
                message: "Saved cards and card changes stay inside secure checkout. FanPass Account only shows safe readiness and receipt preferences.",
                kind: .info
            )
            FPSecondaryButton(title: isLoadingWalletBalances ? "Refreshing wallet" : "Refresh wallet", systemImage: "arrow.clockwise") {
                Task { await refreshWalletBalances(force: true) }
            }
            .disabled(isLoadingWalletBalances)
        }
        .task {
            await refreshWalletBalances()
        }
    }

    private var walletAndKeys: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Wallet", subtitle: "Address, balances, and key controls")
            if let walletBalanceError {
                FPStateBanner(
                    title: "Balance sync unavailable",
                    message: walletBalanceError,
                    kind: .warning,
                    actionTitle: "Retry"
                ) {
                    Task { await refreshWalletBalances(force: true) }
                }
            }
            FPConceptRowList(rows: [
                .init(id: "address", icon: FPIcons.wallet, title: "Wallet address", subtitle: walletAddressLabel, value: walletStatusValue, kind: walletKind),
                walletBalanceRow(asset: "USDC", icon: "dollarsign.circle.fill")
            ])
            FPSecondaryButton(title: copiedWalletAddress ? "Address copied" : "Copy wallet address", systemImage: copiedWalletAddress ? "checkmark" : "doc.on.doc.fill") {
                copyWalletAddress()
            }
            .disabled(walletFullAddress == nil)
            FPSecondaryButton(title: isLoadingWalletBalances ? "Refreshing balances" : "Refresh balances", systemImage: "arrow.clockwise") {
                Task { await refreshWalletBalances(force: true) }
            }
            .disabled(isLoadingWalletBalances)
            FPSecondaryButton(title: "Export private key", systemImage: "key.fill") {
                accountRoute = .privateKeyExport
            }
        }
        .task {
            await refreshWalletBalances()
        }
    }

    private var sellerPayouts: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Selling and payouts", subtitle: "Resale proceeds, payout setup, and listing status")
            let openListings = FanPassMockData.listings.filter { $0.ticket.ownerId == viewModel.user.id && $0.status == .open }
            FPConceptRowList(rows: [
                .init(id: "available", icon: "banknote.fill", title: "Available payout", subtitle: "Settled resale proceeds ready to withdraw.", value: "HK$0", kind: .neutral),
                .init(id: "pending", icon: "clock.badge.checkmark.fill", title: "Pending payout", subtitle: "Releases after organizer and event settlement windows.", value: "HK$0", kind: .info),
                .init(id: "listings", icon: FPIcons.resale, title: "Open listings", subtitle: "Tickets listed for resale cannot be used for entry.", value: "\(openListings.count)", kind: openListings.isEmpty ? .neutral : .warning),
                .init(id: "method", icon: "building.columns.fill", title: "Payout method", subtitle: "Bank details are not collected in this prototype.", value: "Not set", kind: .warning)
            ])
            FPStateBanner(
                title: "Seller controls live in Tickets",
                message: "Create, cancel, and review listing eligibility from the owned ticket. Account summarizes payout and settlement state only.",
                kind: .info
            )
        }
    }

    private var creditsAndPromos: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Credits and promos", subtitle: "Fan Access rewards, vouchers, and account credit")
            FPConceptRowList(rows: [
                .init(id: "credit", icon: "giftcard.fill", title: "FanPass credit", subtitle: "Refund or promo credit available at checkout.", value: "HK$0", kind: .neutral),
                .init(id: "badge", icon: FPIcons.fanAccess, title: "Fan Access badge", subtitle: firstAccessBadgeSubtitle, value: firstAccessBadgeValue, kind: firstAccessBadgeKind),
                .init(id: "promo", icon: "tag.fill", title: "Promo codes", subtitle: "Apply eligible organizer offers during checkout.", value: "None", kind: .info),
                .init(id: "expiry", icon: "calendar.badge.clock", title: "Expiring soon", subtitle: "Credits appear here before they expire.", value: "0", kind: .neutral)
            ])
            FPPolicyNotice(
                title: "Checkout applies credits",
                message: "Credits and promos are shown here for awareness. Final eligibility is checked again when the order is created.",
                kind: .info
            )
        }
    }

    private var firstAccessBadgeSubtitle: String {
        viewModel.user.accessBadges.first?.benefit ?? "Earn badges from organizer-approved Fan Access tasks."
    }

    private var firstAccessBadgeValue: String {
        viewModel.user.accessBadges.first?.status.title ?? "None"
    }

    private var firstAccessBadgeKind: FPStateKind {
        switch viewModel.user.accessBadges.first?.status {
        case .earned:
            return .success
        case .inReview:
            return .warning
        case .locked, .expired:
            return .neutral
        case nil:
            return .info
        }
    }

    private var privateKeyExportContent: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPPolicyNotice(
                title: "Private key export",
                message: "Exporting a private key gives full wallet control. Only continue on a trusted device and never share it.",
                kind: .warning
            )
            FPConceptRowList(rows: [
                .init(id: "wallet", icon: FPIcons.wallet, title: "Wallet", subtitle: walletAddressLabel, value: walletStatusValue, kind: walletKind),
                .init(id: "provider", icon: "shield.lefthalf.filled", title: "Wallet support", subtitle: "Private key export is not available in FanPass.", value: "Unavailable", kind: .warning),
                .init(id: "status", icon: "lock.fill", title: "Export status", subtitle: "Private keys are not displayed or fabricated inside FanPass.", value: "Blocked", kind: .neutral)
            ])
            FPSecondaryButton(title: copiedWalletAddress ? "Address copied" : "Copy wallet address", systemImage: copiedWalletAddress ? "checkmark" : "doc.on.doc.fill") {
                copyWalletAddress()
            }
            .disabled(walletFullAddress == nil)
        }
    }

    private var walletReference: FanPassV4.WalletReference? {
        viewModel.user.walletReference ?? backend.user.walletReference
    }

    private var walletAddressLabel: String {
        walletBalances?.address ?? walletReference?.addressFragment ?? "No wallet linked"
    }

    private var walletFullAddress: String? {
        guard let address = walletBalances?.address?.trimmingCharacters(in: .whitespacesAndNewlines),
              !address.isEmpty
        else {
            return nil
        }
        return address
    }

    private var walletStatusValue: String {
        walletHasAddress ? (isLoadingWalletBalances ? "Syncing" : "Ready") : "Not linked"
    }

    private var walletKind: FPStateKind {
        walletHasAddress ? .success : .warning
    }

    private var walletHasAddress: Bool {
        walletBalances?.address != nil || walletReference != nil
    }

    private func walletBalanceRow(asset: String, icon: String) -> FPConceptRow {
        let balance = walletBalance(asset)
        return FPConceptRow(
            id: asset.lowercased(),
            icon: icon,
            title: "\(asset) balance",
            subtitle: walletBalanceSubtitle(asset: asset, balance: balance),
            value: walletBalanceValue(balance),
            kind: walletBalanceKind(balance)
        )
    }

    private func walletBalance(_ asset: String) -> FanPassWalletBalance? {
        walletBalances?.balances.first {
            $0.asset.uppercased() == asset.uppercased()
        }
    }

    private func walletBalanceValue(_ balance: FanPassWalletBalance?) -> String {
        if isLoadingWalletBalances && balance == nil {
            return "Syncing"
        }
        if walletBalanceError != nil && balance == nil {
            return "Unavailable"
        }
        guard balance?.status == "ok", let amount = balance?.amount else {
            return "--"
        }
        return amount
    }

    private func walletBalanceKind(_ balance: FanPassWalletBalance?) -> FPStateKind {
        if isLoadingWalletBalances && balance == nil {
            return .info
        }
        if walletBalanceError != nil && balance == nil {
            return .warning
        }
        switch balance?.status {
        case "ok":
            return .success
        case "wallet_missing", "not_configured":
            return .warning
        case "rpc_unavailable":
            return .danger
        default:
            return walletHasAddress ? .info : .warning
        }
    }

    private func walletBalanceSubtitle(asset: String, balance: FanPassWalletBalance?) -> String {
        if isLoadingWalletBalances && balance == nil {
            return "Reading \(asset) from the configured chain."
        }
        if walletBalanceError != nil && balance == nil {
            return "Balances are temporarily unavailable."
        }
        switch balance?.status {
        case "ok":
            if let contract = balance?.contractAddress {
                return "Synced from \(shortAddress(contract))."
            }
            return "Synced from chain."
        case "wallet_missing":
            return "No linked wallet address on this account."
        case "not_configured":
            return "\(asset) balances are temporarily unavailable."
        case "rpc_unavailable":
            return "Chain RPC is unavailable. Try again later."
        default:
            return walletHasAddress ? "Open Wallet to refresh balances." : "Connect a wallet to sync balances."
        }
    }

    private func shortAddress(_ address: String) -> String {
        let trimmed = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > 12 else { return trimmed }
        return "\(trimmed.prefix(6))...\(trimmed.suffix(4))"
    }

    private func copyWalletAddress() {
        guard let walletFullAddress else {
            return
        }
        UIPasteboard.general.string = walletFullAddress
        copiedWalletAddress = true
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            await MainActor.run {
                copiedWalletAddress = false
            }
        }
    }

    private func saveProfileDraft() {
        let trimmed = displayNameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        viewModel.user.displayName = trimmed
        profileSaved = true
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            await MainActor.run {
                profileSaved = false
            }
        }
    }

    private var settings: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Settings", subtitle: "Region, currency, display, and communication defaults")
            AccountSegmentedChoice(
                title: "Currency",
                subtitle: "Used for browsing and checkout display.",
                systemImage: "dollarsign.circle.fill",
                options: ["HKD", "USD"],
                selection: $selectedCurrency
            )
            AccountSegmentedChoice(
                title: "Region",
                subtitle: "Controls event times and local discovery defaults.",
                systemImage: "globe.asia.australia.fill",
                options: ["Hong Kong", "Singapore"],
                selection: $selectedRegion
            )
            AccountSegmentedChoice(
                title: "Appearance",
                subtitle: "Match device settings or keep FanPass dark.",
                systemImage: "paintpalette.fill",
                options: ["System", "Dark"],
                selection: $selectedAppearance
            )
            FPConceptRowList(rows: [
                .init(id: "notifications", icon: "bell.fill", title: "Notifications", subtitle: "Choose which updates appear on this device.", value: pushAlertsEnabled ? "On" : "Off", kind: pushAlertsEnabled ? .success : .warning),
                .init(id: "region", icon: "globe.asia.australia.fill", title: "Region and currency", subtitle: "\(selectedRegion) events shown in \(selectedCurrency).", value: selectedCurrency),
                .init(id: "appearance", icon: "paintpalette.fill", title: "Appearance", subtitle: "Use the current app theme.", value: selectedAppearance, kind: .info)
            ])
        }
    }

    private var support: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Help and support", subtitle: "Ticket, order, entry, and account recovery")
            AccountSegmentedChoice(
                title: "Support topic",
                subtitle: "Routes your request to the right help queue.",
                systemImage: "questionmark.circle.fill",
                options: ["Order", "Ticket", "Entry"],
                selection: $selectedSupportTopic
            )
            TextField("Describe the issue", text: $supportDraft, axis: .vertical)
                .lineLimit(3...5)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textPrimary)
                .padding(FPSpacing.md)
                .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            FPConceptRowList(rows: [
                .init(id: "orders", icon: "receipt.fill", title: "Order help", subtitle: "Use order references when contacting support.", value: "Open", kind: .info),
                .init(id: "tickets", icon: FPIcons.tickets, title: "Ticket help", subtitle: "Resolve entry, transfer, and resale questions.", value: "Guide"),
                .init(id: "contact", icon: "message.fill", title: "Contact support", subtitle: supportSubmitted ? "Support request saved locally for this session." : "Send a support request.", value: supportSubmitted ? "Sent" : "Start", kind: supportSubmitted ? .success : .info)
            ])
            FPPrimaryButton(title: supportSubmitted ? "Request sent" : "Send support request", systemImage: supportSubmitted ? "checkmark" : "paperplane.fill") {
                supportSubmitted = true
            }
            .disabled(supportDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || supportSubmitted)
        }
    }

}

private enum AccountRoute: Identifiable, Hashable {
    case menu(AccountMenuItem)
    case privateKeyExport

    var id: String {
        switch self {
        case .menu(let item): "menu-\(item.id)"
        case .privateKeyExport: "private-key-export"
        }
    }

    var title: String {
        switch self {
        case .menu(let item): item.title
        case .privateKeyExport: "Export private key"
        }
    }

    var subtitle: String {
        switch self {
        case .menu(let item): item.subtitle
        case .privateKeyExport: "Wallet security"
        }
    }
}

private struct SocialAuthButton: View {
    let provider: PrivyOAuthLoginProvider
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(provider.logoBackground)
                    .overlay {
                        Circle()
                            .stroke(provider.logoBorder, lineWidth: 1)
                    }
                if isLoading {
                    ProgressView()
                        .tint(provider.progressTint)
                } else if let logoImage {
                    Image(uiImage: logoImage)
                        .resizable()
                        .renderingMode(.original)
                        .scaledToFit()
                        .frame(width: provider.logoSize.width, height: provider.logoSize.height)
                        .accessibilityHidden(true)
                } else {
                    Text(provider.title.prefix(1))
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(provider.progressTint)
                }
            }
            .frame(width: 40, height: 40)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Continue with \(provider.title)")
    }

    private var logoImage: UIImage? {
        if let image = UIImage(named: provider.logoAssetName) {
            return image
        }
        guard let url = Bundle.main.url(forResource: provider.logoAssetName, withExtension: "png"),
              let data = try? Data(contentsOf: url)
        else {
            return nil
        }
        return UIImage(data: data)
    }
}

private extension PrivyOAuthLoginProvider {
    var logoBackground: Color {
        switch self {
        case .google, .twitter:
            Color.white
        case .discord:
            Color(red: 0.345, green: 0.396, blue: 0.949)
        }
    }

    var logoBorder: Color {
        switch self {
        case .google, .twitter:
            FPColors.borderDivider
        case .discord:
            Color.clear
        }
    }

    var progressTint: Color {
        switch self {
        case .google, .twitter:
            Color.black
        case .discord:
            Color.white
        }
    }

    var logoSize: CGSize {
        switch self {
        case .google:
            CGSize(width: 22, height: 22)
        case .twitter:
            CGSize(width: 21, height: 22)
        case .discord:
            CGSize(width: 23, height: 17)
        }
    }
}

private enum AccountMenuItem: String, CaseIterable, Identifiable, Hashable {
    case profile
    case orders
    case alerts
    case security
    case paymentMethods
    case wallet
    case sellerPayouts
    case credits
    case settings
    case support

    var id: String { rawValue }

    var title: String {
        switch self {
        case .profile: "Profile"
        case .orders: "Orders"
        case .alerts: "Alerts"
        case .security: "Privacy and security"
        case .paymentMethods: "Payment methods"
        case .wallet: "Wallet"
        case .sellerPayouts: "Selling and payouts"
        case .credits: "Credits and promos"
        case .settings: "Settings"
        case .support: "Help and support"
        }
    }

    var subtitle: String {
        switch self {
        case .profile: "Personal information"
        case .orders: "Purchases and receipts"
        case .alerts: "Notifications and price rules"
        case .security: "Sign-in and data controls"
        case .paymentMethods: "Cards, wallet checkout, and receipts"
        case .wallet: "Address, balances, and private key"
        case .sellerPayouts: "Resale proceeds and payout setup"
        case .credits: "Fan Access rewards and account credit"
        case .settings: "App preferences"
        case .support: "Get help with tickets"
        }
    }

    var systemImage: String {
        switch self {
        case .profile: FPIcons.profile
        case .orders: "receipt.fill"
        case .alerts: "bell.badge.fill"
        case .security: "lock.shield.fill"
        case .paymentMethods: "creditcard.fill"
        case .wallet: FPIcons.wallet
        case .sellerPayouts: "banknote.fill"
        case .credits: "giftcard.fill"
        case .settings: "gearshape.fill"
        case .support: "questionmark.circle.fill"
        }
    }

    var kind: FPStateKind {
        switch self {
        case .security: .success
        case .alerts, .paymentMethods, .wallet, .credits, .settings: .info
        case .sellerPayouts: .warning
        default: .neutral
        }
    }

    var section: FanPassAccountSection? {
        switch self {
        case .profile: .profile
        case .orders: .orders
        case .alerts: .alerts
        case .security: .security
        case .wallet: .wallet
        case .paymentMethods, .sellerPayouts, .credits, .settings, .support: nil
        }
    }
}

private enum AccountMenuSection: String, CaseIterable, Identifiable {
    case identity
    case activity
    case money
    case preferences

    var id: String { rawValue }

    var title: String {
        switch self {
        case .identity: "Account"
        case .activity: "Activity"
        case .money: "Money"
        case .preferences: "Preferences and help"
        }
    }

    var subtitle: String {
        switch self {
        case .identity: "Profile, sign-in, privacy"
        case .activity: "Orders, alerts, rewards"
        case .money: "Payment, wallet, payouts"
        case .preferences: "App settings and support"
        }
    }

    var items: [AccountMenuItem] {
        switch self {
        case .identity:
            return [.profile, .security]
        case .activity:
            return [.orders, .alerts, .credits]
        case .money:
            return [.paymentMethods, .wallet, .sellerPayouts]
        case .preferences:
            return [.settings, .support]
        }
    }
}

private struct AccountSettingsGroup: View {
    let items: [AccountMenuItem]
    var compact = false
    let onSelect: (AccountMenuItem) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                AccountSettingsRow(item: item, compact: compact) {
                    onSelect(item)
                }
                if index < items.count - 1 {
                    Divider()
                        .overlay(FPColors.borderDivider)
                        .padding(.leading, 62)
                }
            }
        }
        .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }
}

private struct AccountSettingsRow: View {
    let item: AccountMenuItem
    var compact = false
    let action: () -> Void

    var body: some View {
        HStack(spacing: compact ? FPSpacing.sm : FPSpacing.md) {
            Image(systemName: item.systemImage)
                .font(.system(size: compact ? 16 : 18, weight: .semibold))
                .foregroundStyle(item.kind.foreground)
                .frame(width: compact ? 30 : 34, height: compact ? 30 : 34)
                .background(item.kind.foreground.opacity(0.12), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            VStack(alignment: .leading, spacing: compact ? 0 : 2) {
                Text(item.title)
                    .font(compact ? FPTypography.callout.weight(.semibold) : FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                Text(item.subtitle)
                    .font(compact ? .system(size: 11, weight: .medium) : FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
            Spacer(minLength: FPSpacing.sm)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(FPColors.textTertiary)
        }
        .padding(.horizontal, compact ? FPSpacing.sm : FPSpacing.md)
        .padding(.vertical, compact ? FPSpacing.xs : FPSpacing.sm)
        .frame(maxWidth: .infinity, minHeight: compact ? 46 : 58, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture(perform: action)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

private struct AccountToggleRow: View {
    let title: String
    let subtitle: String
    let systemImage: String
    @Binding var isOn: Bool

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.md) {
            HStack(alignment: .center, spacing: FPSpacing.md) {
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(isOn ? FPColors.verifiedGreen : FPColors.textSecondary)
                    .frame(width: 34, height: 34)
                    .background((isOn ? FPColors.verifiedGreen : FPColors.textSecondary).opacity(0.12), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text(title)
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                    Text(subtitle)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: FPSpacing.sm)
                Toggle(title, isOn: $isOn)
                    .labelsHidden()
                    .tint(FPColors.verifiedGreen)
            }
        }
    }
}

private struct AccountSegmentedChoice: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let options: [String]
    @Binding var selection: String

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.md) {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                HStack(alignment: .top, spacing: FPSpacing.md) {
                    Image(systemName: systemImage)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(FPColors.pulseCyan)
                        .frame(width: 34, height: 34)
                        .background(FPColors.pulseCyan.opacity(0.12), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        Text(title)
                            .font(FPTypography.headline)
                            .foregroundStyle(FPColors.textPrimary)
                        Text(subtitle)
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Picker(title, selection: $selection) {
                    ForEach(options, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
    }
}

private extension FanPassV4ProfileView {
    @MainActor
    func refreshWalletBalances(force: Bool = false) async {
        guard backend.isAuthenticated else {
            walletBalances = nil
            walletBalanceError = nil
            isLoadingWalletBalances = false
            return
        }
        guard !isLoadingWalletBalances else { return }
        guard force || walletBalances == nil else { return }

        isLoadingWalletBalances = true
        walletBalanceError = nil
        defer { isLoadingWalletBalances = false }

        do {
            walletBalances = try await backend.apiClient.walletBalances()
            walletBalanceError = nil
        } catch let error as APIClientError {
            walletBalances = nil
            walletBalanceError = walletBalanceSyncMessage(for: error)
        } catch {
            walletBalances = nil
            walletBalanceError = walletBalanceSyncMessage(for: error)
        }
    }

    func walletBalanceSyncMessage(for error: Error) -> String {
        if case let APIClientError.api(_, message) = error {
            if message.localizedCaseInsensitiveContains("Cannot GET /wallet/balances") {
                return "Wallet balances are temporarily unavailable. Try again later."
            }
            return message.isEmpty ? "Balances could not be refreshed." : message
        }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain {
            switch nsError.code {
            case NSURLErrorNetworkConnectionLost, NSURLErrorTimedOut, NSURLErrorCannotConnectToHost:
                return "Network connection was interrupted. Try again."
            default:
                return "FanPass is unreachable right now."
            }
        }
        return "Balances could not be refreshed right now."
    }

    func signInWithOAuth(_ provider: PrivyOAuthLoginProvider) async {
        activeOAuthProvider = provider
        defer { activeOAuthProvider = nil }
        await backend.loginWithPrivyOAuth(provider)
        viewModel.user = backend.user
        if backend.isAuthenticated {
            showSignInPage = false
        }
    }

    func sendPrivyCode() async {
        isSendingCode = true
        defer { isSendingCode = false }
        await backend.sendPrivyEmailCode(to: authEmail.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    func verifyPrivyCode() async {
        isVerifyingCode = true
        defer { isVerifyingCode = false }
        await backend.loginWithPrivyEmailCode(
            email: authEmail.trimmingCharacters(in: .whitespacesAndNewlines),
            code: authCode.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        viewModel.user = backend.user
        if backend.isAuthenticated {
            showSignInPage = false
        }
    }
}

#Preview {
    NavigationStack {
        FanPassV4ProfileView(showStaffMode: true)
    }
}
