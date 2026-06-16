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
            case .wallet:
                walletAndKeys
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
        AccountSettingsGroup(items: AccountMenuItem.allCases, compact: !backend.isAuthenticated) { item in
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

    private var profileDetails: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Profile details", subtitle: "Private details stay masked")
            FPConceptRowList(rows: [
                .init(id: "name", icon: FPIcons.profile, title: "Display name", subtitle: viewModel.user.displayName, value: "Editable"),
                .init(id: "email", icon: "envelope.fill", title: "Email", subtitle: viewModel.user.maskedEmail, value: "Masked", kind: .info),
                .init(id: "data", icon: "tray.and.arrow.down.fill", title: "Data export", subtitle: "Request account and ticket lifecycle records.", value: "Request")
            ])
        }
    }

    private var orders: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Orders and receipts", subtitle: "Order references and receipts")
            FPConceptMiniTimeline(rows: [
                .init(id: "ord1", icon: "receipt.fill", title: "ORD-AUR-1024", subtitle: "Aurora Nights • payment captured • ticket issued", value: "HK$1,348", kind: .success),
                .init(id: "ord2", icon: "arrow.uturn.backward.circle.fill", title: "ORD-FIN-0441", subtitle: "City Finals • refund completed", value: "Refunded", kind: .neutral),
                .init(id: "ord3", icon: FPIcons.error, title: "ORD-LAB-0990", subtitle: "Reservation expired before authorization", value: "Expired", kind: .warning)
            ])
            FPStateBanner(title: "Receipt detail", message: "Order detail screens show references, fees, refunds, and ticket outcome.", kind: .info)
        }
    }

    private var alerts: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Alerts", subtitle: "Rule builder for drops, prices, and ticket state")
            FPConceptRowList(rows: [
                .init(id: "drop", icon: "bell.badge.fill", title: "Artist drop alert", subtitle: "Notify when saved artists announce verified events.", value: "On", kind: .success),
                .init(id: "price", icon: FPIcons.market, title: "Price below target", subtitle: "Aurora Nights under HK$1,400.", value: "HK$1,400", kind: .info),
                .init(id: "entry", icon: FPIcons.qr, title: "Entry readiness", subtitle: "Remind 2 hours before gate opens.", value: "2h", kind: .warning)
            ])
        }
    }

    private var securityPrivacy: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Security and privacy")
            FPConceptRowList(rows: [
                .init(id: "login", icon: "lock.shield.fill", title: "Sign-in protection", subtitle: "Email code and account session controls.", value: "Enabled", kind: .success),
                .init(id: "sessions", icon: "iphone.gen3", title: "Sessions and devices", subtitle: "Manage active sessions and sign out.", value: backend.session == nil ? "0" : "1"),
                .init(id: "privacy", icon: "eye.slash.fill", title: "Privacy", subtitle: "Sensitive account and payment details stay private.", value: "Protected", kind: .success),
                .init(id: "delete", icon: "trash.fill", title: "Delete account", subtitle: "Requires confirmation.", value: "Locked", kind: .danger)
            ])
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

    private var settings: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Settings")
            FPConceptRowList(rows: [
                .init(id: "notifications", icon: "bell.fill", title: "Notifications", subtitle: "Choose which updates appear on this device.", value: "On", kind: .success),
                .init(id: "region", icon: "globe.asia.australia.fill", title: "Region and currency", subtitle: "Hong Kong dollar pricing and local event times.", value: "HK"),
                .init(id: "appearance", icon: "paintpalette.fill", title: "Appearance", subtitle: "Use the current app theme.", value: "Auto", kind: .info)
            ])
        }
    }

    private var support: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Help and support")
            FPConceptRowList(rows: [
                .init(id: "orders", icon: "receipt.fill", title: "Order help", subtitle: "Use order references when contacting support.", value: "Open", kind: .info),
                .init(id: "tickets", icon: FPIcons.tickets, title: "Ticket help", subtitle: "Resolve entry, transfer, and resale questions.", value: "Guide"),
                .init(id: "contact", icon: "message.fill", title: "Contact support", subtitle: "Send a support request.", value: "Start", kind: .success)
            ])
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
    case wallet
    case settings
    case support

    var id: String { rawValue }

    var title: String {
        switch self {
        case .profile: "Profile"
        case .orders: "Orders"
        case .alerts: "Alerts"
        case .security: "Privacy and security"
        case .wallet: "Wallet"
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
        case .wallet: "Address, balances, and private key"
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
        case .wallet: FPIcons.wallet
        case .settings: "gearshape.fill"
        case .support: "questionmark.circle.fill"
        }
    }

    var kind: FPStateKind {
        switch self {
        case .security: .success
        case .alerts, .wallet, .settings: .info
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
        case .settings, .support: nil
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
