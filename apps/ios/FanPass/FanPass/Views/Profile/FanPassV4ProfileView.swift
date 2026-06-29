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
            subtitle: backend.isAuthenticated ? viewModel.user.maskedEmail : nil,
            verticalSpacing: backend.isAuthenticated ? FPSpacing.xl : FPSpacing.md,
            topPadding: backend.isAuthenticated ? FPSpacing.xl : FPSpacing.md,
            bottomPadding: backend.isAuthenticated ? FPSpacing.sixXL + FPSpacing.twoXL : FPSpacing.sixXL + FPSpacing.sm,
            scrollDisabled: !backend.isAuthenticated
        ) {
            accountHeader
            accountMenu
            if backend.session != nil {
                signOutButton
            }
        }
        .navigationDestination(isPresented: $showSignInPage) {
            FanPassV4Scaffold(
                title: "Sign in / Sign up",
                subtitle: "Use email code or a linked social account.",
                bottomPadding: FPSpacing.threeXL
            ) {
                signInContent
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
        }
        .navigationDestination(item: $accountRoute) { route in
            FanPassV4Scaffold(
                title: route.title,
                subtitle: nil,
                verticalSpacing: FPSpacing.lg,
                topPadding: FPSpacing.fourXL,
                bottomPadding: FPSpacing.threeXL
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
            HStack(spacing: FPSpacing.md) {
                Image(systemName: FPIcons.profile)
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(FPGradients.passAurora)
                    .frame(width: 48, height: 48)
                    .background(FPColors.surfaceGlass.opacity(0.64), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(accountDisplayName)
                        .font(FPTypography.title3)
                        .foregroundStyle(FPColors.textPrimary)
                    Text(accountDisplaySubtitle)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !backend.isAuthenticated {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(FPColors.textTertiary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, FPSpacing.xs)
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
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text(section.title.uppercased())
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(FPColors.textTertiary)
                        .tracking(0.7)
                        .padding(.horizontal, FPSpacing.xs)
                    AccountSettingsGroup(items: section.items, compact: true) { item in
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
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            AccountListSection(title: "Details") {
                AccountEditableNameRow(
                    title: "Display name",
                    text: $displayNameDraft,
                    isSaved: profileSaved,
                    action: saveProfileDraft
                )
                AccountListRow(systemImage: "envelope.fill", title: "Email", subtitle: viewModel.user.maskedEmail, value: "Verified", kind: .success)
                AccountListRow(systemImage: "phone.fill", title: "Phone", value: "Not set", kind: .warning)
            }
            AccountListSection(title: "Account data") {
                AccountListRow(systemImage: "person.2.fill", title: "Connected sign-in", value: "Ready", kind: .success)
                AccountListRow(
                    systemImage: "tray.and.arrow.down.fill",
                    title: "Data export",
                    value: dataExportRequested ? "Requested" : "Request",
                    kind: dataExportRequested ? .success : .info,
                    action: { dataExportRequested = true }
                )
            }
        }
    }

    private var orders: some View {
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            AccountListSection(title: "Preferences") {
                AccountSwitchListRow(title: "Email receipts", subtitle: viewModel.user.maskedEmail, systemImage: "envelope.fill", isOn: $emailReceiptsEnabled)
                AccountListRow(systemImage: "list.bullet.rectangle.fill", title: "Fee breakdown", value: "On", kind: .success)
                AccountListRow(systemImage: "number.circle.fill", title: "Support references", value: "Masked", kind: .success)
            }
            AccountListSection(title: "Recent") {
                AccountListRow(systemImage: "receipt.fill", title: "ORD-AUR-1024", subtitle: "Aurora Nights", value: "HK$1,348", kind: .success)
                AccountListRow(systemImage: "arrow.uturn.backward.circle.fill", title: "ORD-FIN-0441", subtitle: "City Finals", value: "Refunded")
                AccountListRow(systemImage: FPIcons.error, title: "ORD-LAB-0990", subtitle: "Reservation expired", value: "Expired", kind: .warning)
            }
        }
    }

    private var alerts: some View {
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            AccountListSection(title: "Channels") {
                AccountSwitchListRow(title: "Push", subtitle: "Gate, resale, and order state", systemImage: "bell.fill", isOn: $pushAlertsEnabled)
                AccountSwitchListRow(title: "Email receipts", subtitle: "Orders and refunds", systemImage: "envelope.fill", isOn: $emailReceiptsEnabled)
            }
            AccountListSection(title: "Ticket alerts") {
                AccountSwitchListRow(title: "Price alerts", subtitle: "Saved resale targets", systemImage: FPIcons.market, isOn: $priceAlertsEnabled)
                AccountSwitchListRow(title: "Entry reminders", subtitle: "Before gate opens", systemImage: FPIcons.qr, isOn: $entryRemindersEnabled)
                AccountSwitchListRow(title: "Fan Access", subtitle: "Task and badge updates", systemImage: FPIcons.fanAccess, isOn: $marketingUpdatesEnabled)
            }
            AccountListSection(title: "Saved rules") {
                AccountListRow(systemImage: "bell.badge.fill", title: "Saved artists", value: pushAlertsEnabled ? "On" : "Off", kind: pushAlertsEnabled ? .success : .warning)
                AccountListRow(systemImage: FPIcons.market, title: "Aurora Nights", subtitle: "Below target", value: priceAlertsEnabled ? "HK$1,400" : "Off", kind: priceAlertsEnabled ? .info : .warning)
                AccountListRow(systemImage: FPIcons.qr, title: "Entry readiness", value: entryRemindersEnabled ? "2h" : "Off", kind: entryRemindersEnabled ? .warning : .neutral)
            }
        }
    }

    private var securityPrivacy: some View {
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            AccountListSection(title: "Sign-in") {
                AccountListRow(systemImage: "lock.shield.fill", title: "Protection", value: "Enabled", kind: .success)
                AccountSwitchListRow(title: "Trusted device", subtitle: "Keep this phone signed in", systemImage: "iphone.gen3", isOn: $trustedDeviceEnabled)
                AccountListRow(systemImage: "iphone.gen3", title: "Sessions", value: backend.session == nil ? "0" : "1")
            }
            AccountListSection(title: "Privacy") {
                AccountSwitchListRow(title: "Friend discovery", subtitle: "Let contacts find you", systemImage: "person.2.fill", isOn: $friendDiscoveryEnabled)
                AccountSwitchListRow(title: "Usage analytics", subtitle: "Diagnostics only", systemImage: "waveform.path.ecg", isOn: $usageAnalyticsEnabled)
                AccountListRow(systemImage: "trash.fill", title: "Delete account", value: "Locked", kind: .danger)
            }
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
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            AccountListSection(title: "Checkout") {
                AccountListRow(systemImage: "creditcard.fill", title: "Card", subtitle: "Secure checkout", value: "Ready", kind: .success)
                AccountListRow(systemImage: "apple.logo", title: "Apple Pay", value: "Checkout", kind: .info)
                AccountSwitchListRow(title: "Email receipts", subtitle: viewModel.user.maskedEmail, systemImage: "receipt.fill", isOn: $emailReceiptsEnabled)
            }
            AccountListSection(title: "Wallet") {
                AccountListRow(systemImage: FPIcons.wallet, title: "USDC wallet", subtitle: walletAddressLabel, value: walletStatusValue, kind: walletKind)
                AccountListRow(
                    systemImage: "arrow.clockwise",
                    title: isLoadingWalletBalances ? "Refreshing" : "Refresh wallet",
                    value: isLoadingWalletBalances ? "Syncing" : nil,
                    kind: .info,
                    action: { Task { await refreshWalletBalances(force: true) } }
                )
            }
        }
        .task {
            await refreshWalletBalances()
        }
    }

    private var walletAndKeys: some View {
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
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
            AccountListSection(title: "Balances") {
                AccountListRow(systemImage: FPIcons.wallet, title: "Address", subtitle: walletAddressLabel, value: walletStatusValue, kind: walletKind)
                walletBalanceListRow(asset: "USDC", icon: "dollarsign.circle.fill")
            }
            AccountListSection(title: "Actions") {
                AccountListRow(
                    systemImage: copiedWalletAddress ? "checkmark" : "doc.on.doc.fill",
                    title: copiedWalletAddress ? "Address copied" : "Copy address",
                    value: walletFullAddress == nil ? "Unavailable" : nil,
                    kind: walletFullAddress == nil ? .warning : .info,
                    action: copyWalletAddress
                )
                AccountListRow(
                    systemImage: "arrow.clockwise",
                    title: isLoadingWalletBalances ? "Refreshing" : "Refresh balances",
                    value: isLoadingWalletBalances ? "Syncing" : nil,
                    kind: .info,
                    action: { Task { await refreshWalletBalances(force: true) } }
                )
                AccountListRow(systemImage: "key.fill", title: "Private key", value: "Unavailable", kind: .warning, action: { accountRoute = .privateKeyExport })
            }
        }
        .task {
            await refreshWalletBalances()
        }
    }

    private var sellerPayouts: some View {
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            let openListings = FanPassMockData.listings.filter { $0.ticket.ownerId == viewModel.user.id && $0.status == .open }
            AccountListSection(title: "Payouts") {
                AccountListRow(systemImage: "banknote.fill", title: "Available", value: "HK$0")
                AccountListRow(systemImage: "clock.badge.checkmark.fill", title: "Pending", value: "HK$0", kind: .info)
                AccountListRow(systemImage: "building.columns.fill", title: "Payout method", value: "Not set", kind: .warning)
            }
            AccountListSection(title: "Selling") {
                AccountListRow(systemImage: FPIcons.resale, title: "Open listings", value: "\(openListings.count)", kind: openListings.isEmpty ? .neutral : .warning)
                AccountListRow(systemImage: FPIcons.tickets, title: "Listing controls", value: "Tickets", kind: .info)
            }
        }
    }

    private var creditsAndPromos: some View {
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            AccountListSection(title: "Balance") {
                AccountListRow(systemImage: "giftcard.fill", title: "FanPass credit", value: "HK$0")
                AccountListRow(systemImage: "calendar.badge.clock", title: "Expiring soon", value: "0")
            }
            AccountListSection(title: "Rewards") {
                AccountListRow(systemImage: FPIcons.fanAccess, title: "Fan Access badge", subtitle: firstAccessBadgeSubtitle, value: firstAccessBadgeValue, kind: firstAccessBadgeKind)
                AccountListRow(systemImage: "tag.fill", title: "Promo codes", value: "None", kind: .info)
            }
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
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            AccountListSection(title: "Wallet") {
                AccountListRow(systemImage: FPIcons.wallet, title: "Address", subtitle: walletAddressLabel, value: walletStatusValue, kind: walletKind)
                AccountListRow(systemImage: "shield.lefthalf.filled", title: "Wallet support", value: "Unavailable", kind: .warning)
                AccountListRow(systemImage: "lock.fill", title: "Export status", value: "Blocked")
                AccountListRow(
                    systemImage: copiedWalletAddress ? "checkmark" : "doc.on.doc.fill",
                    title: copiedWalletAddress ? "Address copied" : "Copy address",
                    value: walletFullAddress == nil ? "Unavailable" : nil,
                    kind: walletFullAddress == nil ? .warning : .info,
                    action: copyWalletAddress
                )
            }
            AccountFooterNote("Private keys are not displayed or fabricated inside FanPass.")
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

    @ViewBuilder
    private func walletBalanceListRow(asset: String, icon: String) -> some View {
        let balance = walletBalance(asset)
        AccountListRow(
            systemImage: icon,
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
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            AccountListSection(title: "Preferences") {
                AccountPickerRow(title: "Currency", systemImage: "dollarsign.circle.fill", options: ["HKD", "USD"], selection: $selectedCurrency)
                AccountPickerRow(title: "Region", systemImage: "globe.asia.australia.fill", options: ["Hong Kong", "Singapore"], selection: $selectedRegion)
                AccountPickerRow(title: "Appearance", systemImage: "paintpalette.fill", options: ["System", "Dark"], selection: $selectedAppearance)
            }
            AccountListSection(title: "Summary") {
                AccountListRow(systemImage: "bell.fill", title: "Notifications", value: pushAlertsEnabled ? "On" : "Off", kind: pushAlertsEnabled ? .success : .warning)
                AccountListRow(systemImage: "globe.asia.australia.fill", title: "Region", subtitle: selectedRegion, value: selectedCurrency)
                AccountListRow(systemImage: "paintpalette.fill", title: "Appearance", value: selectedAppearance, kind: .info)
            }
        }
    }

    private var support: some View {
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            AccountListSection(title: "Request") {
                AccountPickerRow(title: "Topic", systemImage: "questionmark.circle.fill", options: ["Order", "Ticket", "Entry"], selection: $selectedSupportTopic)
                AccountTextArea(text: $supportDraft)
                AccountListRow(
                    systemImage: supportSubmitted ? "checkmark" : "paperplane.fill",
                    title: supportSubmitted ? "Request sent" : "Send request",
                    value: supportDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Required" : nil,
                    kind: supportSubmitted ? .success : .info,
                    action: {
                        guard !supportDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                        supportSubmitted = true
                    }
                )
            }
            AccountListSection(title: "Shortcuts") {
                AccountListRow(systemImage: "receipt.fill", title: "Order help", value: "Open", kind: .info)
                AccountListRow(systemImage: FPIcons.tickets, title: "Ticket help", value: "Guide")
                AccountListRow(systemImage: "message.fill", title: "Contact support", value: supportSubmitted ? "Sent" : "Start", kind: supportSubmitted ? .success : .info)
            }
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

private struct AccountListSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: FPSpacing.xs) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(FPColors.textTertiary)
                .tracking(0.7)
                .padding(.horizontal, FPSpacing.xs)
            VStack(spacing: 0) {
                content
            }
            .background(FPColors.surfaceGlass.opacity(0.58), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                    .stroke(FPColors.borderDivider.opacity(0.72), lineWidth: 1)
            }
        }
    }
}

private struct AccountListRow: View {
    let systemImage: String
    let title: String
    var subtitle: String?
    var value: String?
    var kind: FPStateKind = .neutral
    var action: (() -> Void)?

    var body: some View {
        Group {
            if let action {
                Button(action: action) {
                    row
                }
                .buttonStyle(.plain)
            } else {
                row
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var row: some View {
        HStack(spacing: FPSpacing.sm) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(kind.foreground)
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(FPTypography.callout.weight(.semibold))
                    .foregroundStyle(FPColors.textPrimary)
                    .lineLimit(1)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(FPColors.textSecondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            Spacer(minLength: FPSpacing.sm)
            if let value, !value.isEmpty {
                Text(value)
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundStyle(kind.foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.76)
            }
            if action != nil {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(FPColors.textTertiary)
            }
        }
        .padding(.horizontal, FPSpacing.md)
        .padding(.vertical, FPSpacing.sm)
        .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
        .contentShape(Rectangle())
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(FPColors.borderDivider.opacity(0.46))
                .frame(height: 1)
                .padding(.leading, 56)
        }
    }
}

private struct AccountEditableNameRow: View {
    let title: String
    @Binding var text: String
    let isSaved: Bool
    let action: () -> Void

    var body: some View {
        HStack(spacing: FPSpacing.sm) {
            Image(systemName: FPIcons.profile)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(FPColors.pulseCyan)
                .frame(width: 28, height: 28)
            TextField(title, text: $text)
                .textInputAutocapitalization(.words)
                .font(FPTypography.callout.weight(.semibold))
                .foregroundStyle(FPColors.textPrimary)
            Button(isSaved ? "Saved" : "Save", action: action)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isSaved ? FPColors.verifiedGreen : FPColors.pulseCyan)
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, FPSpacing.md)
        .padding(.vertical, FPSpacing.sm)
        .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(FPColors.borderDivider.opacity(0.46))
                .frame(height: 1)
                .padding(.leading, 56)
        }
    }
}

private struct AccountSwitchListRow: View {
    let title: String
    var subtitle: String?
    let systemImage: String
    @Binding var isOn: Bool

    var body: some View {
        HStack(spacing: FPSpacing.sm) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(isOn ? FPColors.verifiedGreen : FPColors.textSecondary)
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(FPTypography.callout.weight(.semibold))
                    .foregroundStyle(FPColors.textPrimary)
                    .lineLimit(1)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(FPColors.textSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: FPSpacing.sm)
            Toggle(title, isOn: $isOn)
                .labelsHidden()
                .tint(FPColors.verifiedGreen)
        }
        .padding(.horizontal, FPSpacing.md)
        .padding(.vertical, FPSpacing.sm)
        .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(FPColors.borderDivider.opacity(0.46))
                .frame(height: 1)
                .padding(.leading, 56)
        }
    }
}

private struct AccountPickerRow: View {
    let title: String
    let systemImage: String
    let options: [String]
    @Binding var selection: String

    var body: some View {
        VStack(alignment: .leading, spacing: FPSpacing.sm) {
            HStack(spacing: FPSpacing.sm) {
                Image(systemName: systemImage)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(FPColors.pulseCyan)
                    .frame(width: 28, height: 28)
                Text(title)
                    .font(FPTypography.callout.weight(.semibold))
                    .foregroundStyle(FPColors.textPrimary)
                Spacer()
            }
            Picker(title, selection: $selection) {
                ForEach(options, id: \.self) { option in
                    Text(option).tag(option)
                }
            }
            .pickerStyle(.segmented)
        }
        .padding(.horizontal, FPSpacing.md)
        .padding(.vertical, FPSpacing.sm)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(FPColors.borderDivider.opacity(0.46))
                .frame(height: 1)
                .padding(.leading, 56)
        }
    }
}

private struct AccountTextArea: View {
    @Binding var text: String

    var body: some View {
        TextField("Describe the issue", text: $text, axis: .vertical)
            .lineLimit(3...5)
            .font(FPTypography.callout)
            .foregroundStyle(FPColors.textPrimary)
            .padding(FPSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(FPColors.borderDivider.opacity(0.46))
                    .frame(height: 1)
            }
    }
}

private struct AccountFooterNote: View {
    let message: String

    init(_ message: String) {
        self.message = message
    }

    var body: some View {
        Text(message)
            .font(FPTypography.caption)
            .foregroundStyle(FPColors.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, FPSpacing.xs)
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
        .background(FPColors.surfaceGlass.opacity(0.58), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                .stroke(FPColors.borderDivider.opacity(0.72), lineWidth: 1)
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
                .font(.system(size: compact ? 15 : 16, weight: .semibold))
                .foregroundStyle(item.kind.foreground)
                .frame(width: compact ? 26 : 28, height: compact ? 26 : 28)
            VStack(alignment: .leading, spacing: compact ? 0 : 2) {
                Text(item.title)
                    .font(compact ? FPTypography.callout.weight(.semibold) : FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                if !compact {
                    Text(item.subtitle)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }
            }
            Spacer(minLength: FPSpacing.sm)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(FPColors.textTertiary)
        }
        .padding(.horizontal, compact ? FPSpacing.sm : FPSpacing.md)
        .padding(.vertical, compact ? FPSpacing.xs : FPSpacing.xs + 2)
        .frame(maxWidth: .infinity, minHeight: compact ? 44 : 52, alignment: .leading)
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
