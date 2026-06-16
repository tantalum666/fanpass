import SwiftUI

struct OpsShellView: View {
    @State private var apiClient = FanPassAPIClient(baseURL: FanPassEnvironment.apiBaseURL)
    @State private var privyAuthProvider = FanPassPrivyAuthProvider()
    @State private var gateSession: UserSession?
    @State private var selectedTab: OpsTab = .home
    @State private var selectedEvent = FanPassMockData.events[0]
    @State private var selectedGate = "A1"
    @State private var scanSheet: OpsScanSheet?
    @State private var loadState: OpsLoadState = .offline
    @State private var checkinSummary: CheckinSummary?
    @State private var checkinHistory: [CheckinHistoryItem] = []
    @State private var staffEmail = ""
    @State private var emailCode = ""
    @State private var inviteToken = ""
    @State private var privyAccessToken = ""
    @State private var staffLinkState: StaffLinkState = .idle

    private var isGateAssigned: Bool {
        true
    }

    var body: some View {
        Group {
            if gateSession == nil {
                opsLogin
            } else {
                NavigationStack {
                    ZStack {
                        FPOpsTheme.background.ignoresSafeArea()
                        switch selectedTab {
                        case .home:
                            homeTerminal
                        case .account:
                            accountRoot
                        }
                    }
                    .navigationDestination(for: OpsAccountRoute.self) { route in
                        accountDestination(route)
                    }
                    .safeAreaInset(edge: .bottom) {
                        OpsBottomTabBar(selection: $selectedTab)
                    }
                    .navigationBarTitleDisplayMode(.inline)
                }
            }
        }
        .task(id: "\(selectedEvent.id)-\(selectedGate)") {
            await loadCheckinSummary()
        }
        .fullScreenCover(item: $scanSheet) { sheet in
            switch sheet {
            case .qrCamera:
                scannerCover(startsWithCamera: true, startsWithNFC: false)
            case .nfcReader:
                scannerCover(startsWithCamera: false, startsWithNFC: true)
            }
        }
        .onChange(of: scanSheet) { _, sheet in
            if sheet == nil {
                Task { await loadCheckinSummary() }
            }
        }
    }

    private var opsLogin: some View {
        ZStack {
            FPOpsTheme.background.ignoresSafeArea()
            VStack(alignment: .leading, spacing: FPSpacing.xl) {
                Spacer()
                VStack(alignment: .leading, spacing: FPSpacing.sm) {
                    Image(systemName: "person.badge.key.fill")
                        .font(.system(size: 46, weight: .semibold))
                        .foregroundStyle(FPOpsTheme.blue)
                    Text("FanPass Ops")
                        .font(FPTypography.largeTitle)
                        .foregroundStyle(FPOpsTheme.textPrimary)
                    Text("Sign in with an Ops-enabled account. New staff can link an invite once.")
                        .font(FPTypography.callout)
                        .foregroundStyle(FPOpsTheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                staffLinkingPanel

                Spacer()
            }
            .padding(FPSpacing.xl)
        }
    }

    private var homeTerminal: some View {
        ScrollView {
            VStack(spacing: FPSpacing.xl) {
                OpsHomeHeader(onAccount: { selectedTab = .account })

                VStack(spacing: FPSpacing.lg) {
                    Image(systemName: "checkmark.shield")
                        .font(.system(size: 58, weight: .semibold))
                        .foregroundStyle(FPOpsTheme.blue)
                        .frame(width: 96, height: 96)
                        .background(FPOpsTheme.blue.opacity(0.08), in: Circle())

                    VStack(spacing: FPSpacing.xs) {
                        Text("Ready to scan")
                            .font(FPTypography.title2)
                            .foregroundStyle(FPOpsTheme.textPrimary)
                        Text("Verify any valid FanPass ticket.")
                            .font(FPTypography.callout)
                            .foregroundStyle(FPOpsTheme.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.top, FPSpacing.lg)

                VStack(spacing: FPSpacing.md) {
                    FPPrimaryButton(title: "Start scanning", systemImage: "qrcode.viewfinder") {
                        scanSheet = .qrCamera
                    }

                    Button {
                        scanSheet = .nfcReader
                    } label: {
                        Label("NFC quick scan", systemImage: FPIcons.nfc)
                            .font(FPTypography.headline)
                            .foregroundStyle(isGateAssigned ? FPOpsTheme.blue : FPOpsTheme.textSecondary)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(FPOpsTheme.surface, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                                    .stroke(isGateAssigned ? FPOpsTheme.blue.opacity(0.35) : FPOpsTheme.border, lineWidth: 1)
                            }
                    }
                    .buttonStyle(.plain)
                }

            }
            .padding(.horizontal, FPSpacing.lg)
            .padding(.top, FPSpacing.xl)
            .padding(.bottom, 110)
        }
    }

    private var accountRoot: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                HStack {
                    Text("Account")
                        .font(FPTypography.title2)
                        .foregroundStyle(FPOpsTheme.textPrimary)
                    Spacer()
                    Image(systemName: "gearshape")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(FPOpsTheme.textSecondary)
                }

                OpsStaffHeader(
                    name: gateSession?.displayName ?? "Ops Staff",
                    email: gateSession?.email ?? (staffEmail.isEmpty ? "ops@fanpass.com" : staffEmail)
                )

                FPOpsPanel {
                    VStack(spacing: 0) {
                        OpsNavigationRow(
                            icon: "clock.badge.checkmark",
                            title: "Scan history",
                            value: "\(checkinHistory.count) recent",
                            route: .scanHistory
                        )
                        OpsNavigationRow(
                            icon: "questionmark.circle",
                            title: "Help & support",
                            value: nil,
                            route: .help
                        )
                    }
                }

                Button(role: .destructive) {
                    signOut()
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        .font(FPTypography.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.borderless)
                .padding(.top, FPSpacing.sm)
            }
            .padding(.horizontal, FPSpacing.lg)
            .padding(.top, FPSpacing.xl)
            .padding(.bottom, 110)
        }
    }

    @ViewBuilder
    private func accountDestination(_ route: OpsAccountRoute) -> some View {
        switch route {
        case .scanHistory:
            scanHistoryPage
        case .help:
            helpPage
        }
    }

    private var scanHistoryPage: some View {
        OpsSubpage(title: "Scan history") {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                HStack {
                    Text(Date().formatted(date: .abbreviated, time: .omitted))
                    Spacer()
                    Text("\(checkinHistory.count) recent")
                }
                .font(FPTypography.caption.weight(.semibold))
                .foregroundStyle(FPOpsTheme.textSecondary)

                FPOpsPanel {
                    if checkinHistory.isEmpty {
                        VStack(alignment: .leading, spacing: FPSpacing.xs) {
                            Text("No scans yet")
                                .font(FPTypography.headline)
                                .foregroundStyle(FPOpsTheme.textPrimary)
                            Text("Accepted and rejected scans will appear here after the API records them.")
                                .font(FPTypography.caption)
                                .foregroundStyle(FPOpsTheme.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, FPSpacing.sm)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(checkinHistory) { item in
                                OpsHistoryRow(item: item)
                            }
                        }
                    }
                }
            }
            .task {
                await loadCheckinSummary()
            }
        }
    }

    private var helpPage: some View {
        OpsSubpage(title: "Help & support") {
            VStack(spacing: FPSpacing.lg) {
                FPOpsPanel {
                    VStack(spacing: 0) {
                        OpsPlainRow(title: "How scanning works")
                        OpsPlainRow(title: "Troubleshooting")
                        OpsPlainRow(title: "Contact support")
                        OpsPlainRow(title: "Privacy & security")
                        OpsPlainRow(title: "About FanPass Ops", trailing: "v1.0.0")
                    }
                }
                FPOpsPanel {
                    HStack(spacing: FPSpacing.md) {
                        Image(systemName: "headphones")
                            .font(.title3.weight(.semibold))
                        VStack(alignment: .leading, spacing: FPSpacing.xs) {
                            Text("Need immediate help?")
                                .font(FPTypography.headline)
                            Text("Contact your event manager")
                                .font(FPTypography.caption)
                                .foregroundStyle(FPOpsTheme.textSecondary)
                        }
                        Spacer()
                    }
                }
            }
        }
    }

    private func scannerCover(startsWithCamera: Bool, startsWithNFC: Bool) -> some View {
        ScannerView(
            apiClient: apiClient,
            eventId: selectedEvent.id,
            gate: selectedGate,
            startsWithCamera: startsWithCamera,
            startsWithNFC: startsWithNFC,
            onExit: {
                scanSheet = nil
                selectedTab = .home
            }
        )
    }

    private var staffLinkingPanel: some View {
        FPOpsPanel {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                FPOpsSectionHeader(title: "Ops sign-in", subtitle: "Admins and linked staff use email code. New staff add an invite once.")

                TextField("Ops email", text: $staffEmail)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)

                HStack(spacing: FPSpacing.sm) {
                    TextField("Email code", text: $emailCode)
                        .textContentType(.oneTimeCode)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                    SecureField("Invite token (new staff only)", text: $inviteToken)
                        .textFieldStyle(.roundedBorder)
                }

                HStack(spacing: FPSpacing.sm) {
                    Button {
                        Task { await sendStaffEmailCode() }
                    } label: {
                        Label("Send code", systemImage: "envelope.badge.shield.half.filled")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(staffEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || staffLinkState == .working)

                    Button {
                        Task { await signInOpsAccount() }
                    } label: {
                        Label("Sign in", systemImage: "checkmark.shield.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!canSignInOpsAccount)
                }

                Button {
                    Task { await acceptStaffInvite() }
                } label: {
                    Label("Link new staff with invite", systemImage: "person.badge.key.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(!canAcceptStaffInvite)

                FPStateBanner(title: staffLinkState.title, message: staffLinkState.message, kind: staffLinkState.kind)
            }
        }
    }

    private var canSignInOpsAccount: Bool {
        staffLinkState != .working &&
        !staffEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !emailCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canAcceptStaffInvite: Bool {
        staffLinkState != .working &&
        !staffEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !emailCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !inviteToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func loadCheckinSummary() async {
        guard gateSession != nil else { return }
        var loadedAnyData = false
        do {
            checkinSummary = try await apiClient.checkinSummary(eventId: selectedEvent.id, gate: selectedGate)
            loadedAnyData = true
        } catch {
            checkinSummary = nil
        }
        do {
            checkinHistory = try await apiClient.checkinHistory().items
            loadedAnyData = true
        } catch {
            checkinHistory = []
        }
        if loadedAnyData {
            loadState = .online
        } else {
            loadState = gateSession == nil ? .offline : .degraded
        }
    }

    private func sendStaffEmailCode() async {
        let email = staffEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !email.isEmpty else { return }
        staffLinkState = .working
        do {
            try await privyAuthProvider.sendEmailCode(to: email)
            staffLinkState = .codeSent
        } catch {
            staffLinkState = .failed("Could not send the verification code.")
        }
    }

    private func acceptStaffInvite() async {
        let email = staffEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        let code = emailCode.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedInviteToken = inviteToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !email.isEmpty, !code.isEmpty, !trimmedInviteToken.isEmpty else { return }

        staffLinkState = .working
        do {
            let result = try await privyAuthProvider.loginWithEmailCode(code, sentTo: email)
            privyAccessToken = result.accessToken
            let session = try await apiClient.acceptStaffInvite(
                privyAccessToken: privyAccessToken,
                inviteToken: trimmedInviteToken,
                walletAddress: result.walletAddress,
                walletId: result.walletId
            )
            guard session.isOpsRole else {
                privyAccessToken = ""
                staffLinkState = .failed("This account is not enabled for Ops. Ask an admin to assign staff access.")
                return
            }
            await activateOpsSession(session, fallbackAccessToken: result.accessToken)
        } catch {
            privyAccessToken = ""
            staffLinkState = .failed("Staff invite linking failed. Check the code, invite, and assignment.")
        }
    }

    private func signInOpsAccount() async {
        let email = staffEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        let code = emailCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !email.isEmpty, !code.isEmpty else { return }

        staffLinkState = .working
        do {
            let result = try await privyAuthProvider.loginWithEmailCode(code, sentTo: email)
            privyAccessToken = result.accessToken
            let session = try await apiClient.syncPrivySession(
                privyAccessToken: result.accessToken,
                email: email,
                walletAddress: result.walletAddress,
                walletId: result.walletId
            )
            guard session.isOpsRole else {
                privyAccessToken = ""
                staffLinkState = .failed("This account is not enabled for Ops. Ask an admin to assign admin or staff access.")
                return
            }
            await activateOpsSession(session, fallbackAccessToken: result.accessToken)
        } catch {
            privyAccessToken = ""
            staffLinkState = .failed("Ops sign-in failed. Check the code and Privy app identifier settings.")
        }
    }

    private func activateOpsSession(_ session: UserSession, fallbackAccessToken: String?) async {
        gateSession = session
        apiClient = apiClient.withAccessToken(session.accessToken ?? fallbackAccessToken)
        privyAccessToken = ""
        inviteToken = ""
        emailCode = ""
        staffLinkState = .linked
        loadState = .online
        await loadCheckinSummary()
    }

    private func signOut() {
        gateSession = nil
        selectedTab = .home
        scanSheet = nil
        loadState = .offline
        checkinSummary = nil
        checkinHistory = []
    }

}

private enum OpsTab: Hashable {
    case home
    case account

    var title: String {
        switch self {
        case .home: "Home"
        case .account: "Account"
        }
    }

    var icon: String {
        switch self {
        case .home: "house"
        case .account: "person.crop.circle"
        }
    }
}

private enum OpsScanSheet: String, Identifiable {
    case qrCamera
    case nfcReader

    var id: String { rawValue }
}

private enum OpsAccountRoute: Hashable {
    case scanHistory
    case help
}

private enum OpsLoadState: Equatable {
    case online
    case degraded
    case offline

    var title: String {
        switch self {
        case .online: "Online"
        case .degraded: "Degraded"
        case .offline: "Offline"
        }
    }

    var icon: String {
        switch self {
        case .online: "wifi"
        case .degraded: FPIcons.warning
        case .offline: "wifi.slash"
        }
    }

    var kind: FPStateKind {
        switch self {
        case .online: .success
        case .degraded: .warning
        case .offline: .danger
        }
    }
}

private enum StaffLinkState: Equatable {
    case idle
    case working
    case codeSent
    case linked
    case failed(String)

    var title: String {
        switch self {
        case .idle:
            "Ops access required"
        case .working:
            "Checking"
        case .codeSent:
            "Code sent"
        case .linked:
            "Ops session active"
        case .failed:
            "Sign-in failed"
        }
    }

    var message: String {
        switch self {
        case .idle:
            "Admins and linked staff can sign in with an email code. New staff use an invite once."
        case .working:
            "Verifying identity and Ops access."
        case .codeSent:
            "Enter the email code to sign in. Add an invite only when linking new staff."
        case .linked:
            "Scanner access is active for this Ops account."
        case let .failed(message):
            message
        }
    }

    var kind: FPStateKind {
        switch self {
        case .idle, .codeSent:
            .warning
        case .working:
            .info
        case .linked:
            .success
        case .failed:
            .danger
        }
    }
}

private enum FPOpsTheme {
    static let background = Color(hex: 0xF7F9FC)
    static let surface = Color.white
    static let textPrimary = Color(hex: 0x0F172A)
    static let textSecondary = Color(hex: 0x667085)
    static let border = Color(hex: 0xD8DEE8)
    static let blue = Color(hex: 0x0B63F6)
    static let green = Color(hex: 0x12B76A)
    static let red = Color(hex: 0xF04438)
}

private struct OpsHomeHeader: View {
    let onAccount: () -> Void

    var body: some View {
        HStack(alignment: .top) {
            Spacer()
            Button(action: onAccount) {
                Image(systemName: "person.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(FPOpsTheme.textPrimary)
                    .frame(width: 44, height: 44)
                    .background(FPOpsTheme.surface, in: Circle())
                    .overlay {
                        Circle().stroke(FPOpsTheme.border, lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)
        }
    }
}

private struct OpsBottomTabBar: View {
    @Binding var selection: OpsTab

    var body: some View {
        HStack(spacing: FPSpacing.lg) {
            OpsTabButton(tab: .home, selection: $selection)
            OpsTabButton(tab: .account, selection: $selection)
        }
        .padding(.horizontal, FPSpacing.xl)
        .padding(.top, FPSpacing.sm)
        .padding(.bottom, FPSpacing.sm)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(FPOpsTheme.border)
                .frame(height: 1)
        }
    }
}

private struct OpsTabButton: View {
    let tab: OpsTab
    @Binding var selection: OpsTab

    var body: some View {
        Button {
            selection = tab
        } label: {
            VStack(spacing: 4) {
                Image(systemName: selection == tab ? "\(tab.icon).fill" : tab.icon)
                    .font(.system(size: 22, weight: .semibold))
                Text(tab.title)
                    .font(.caption2.weight(.semibold))
            }
            .foregroundStyle(selection == tab ? FPOpsTheme.blue : FPOpsTheme.textSecondary)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
        }
        .buttonStyle(.plain)
    }
}

private struct OpsStaffHeader: View {
    let name: String
    let email: String

    var body: some View {
        HStack(spacing: FPSpacing.md) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 46))
                .foregroundStyle(FPOpsTheme.blue)
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                HStack(spacing: FPSpacing.xs) {
                    Text(name)
                        .font(FPTypography.headline)
                        .foregroundStyle(FPOpsTheme.textPrimary)
                    Text("STAFF")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(FPOpsTheme.blue, in: Capsule())
                }
                Text(email)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPOpsTheme.textSecondary)
            }
            Spacer()
        }
    }
}

private struct OpsNavigationRow: View {
    let icon: String
    let title: String
    let value: String?
    let route: OpsAccountRoute

    var body: some View {
        NavigationLink(value: route) {
            HStack(spacing: FPSpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(FPOpsTheme.blue)
                    .frame(width: 30, height: 30)
                Text(title)
                    .font(FPTypography.headline)
                    .foregroundStyle(FPOpsTheme.textPrimary)
                Spacer()
                if let value {
                    Text(value)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPOpsTheme.textSecondary)
                }
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(FPOpsTheme.textSecondary)
            }
            .padding(.vertical, FPSpacing.sm)
        }
        .buttonStyle(.plain)
    }
}

private struct OpsSubpage<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        ZStack {
            FPOpsTheme.background.ignoresSafeArea()
            ScrollView {
                content
                    .padding(.horizontal, FPSpacing.lg)
                    .padding(.top, FPSpacing.lg)
                    .padding(.bottom, FPSpacing.threeXL)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct OpsHistoryRow: View {
    let item: CheckinHistoryItem

    var body: some View {
        HStack(spacing: FPSpacing.md) {
            Image(systemName: item.accepted ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(item.accepted ? FPOpsTheme.green : FPOpsTheme.red)
            Text(formattedTime(item.checkedInAt))
                .font(FPTypography.caption)
                .foregroundStyle(FPOpsTheme.textPrimary)
                .monospacedDigit()
            VStack(alignment: .leading, spacing: 2) {
                Text(item.accepted ? "ACCEPTED" : "REJECTED")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(item.accepted ? FPOpsTheme.green : FPOpsTheme.red)
                Text(item.reason ?? item.ticketRef)
                    .font(.caption2)
                    .foregroundStyle(FPOpsTheme.textSecondary)
            }
            Spacer()
            Text(item.ticketRef)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(FPOpsTheme.textSecondary)
        }
        .padding(.vertical, FPSpacing.sm)
    }

    private func formattedTime(_ isoTimestamp: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: isoTimestamp) else {
            return "--:--"
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }
}

private struct OpsPlainRow: View {
    let title: String
    var trailing: String?

    var body: some View {
        HStack {
            Text(title)
                .font(FPTypography.headline)
                .foregroundStyle(FPOpsTheme.textPrimary)
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPOpsTheme.textSecondary)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(FPOpsTheme.textSecondary)
        }
        .padding(.vertical, FPSpacing.sm)
    }
}

private struct FPOpsPanel<Content: View>: View {
    var cornerRadius: CGFloat = FPRadius.lg
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(FPSpacing.lg)
            .background(FPOpsTheme.surface, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(FPOpsTheme.border, lineWidth: 1)
            }
    }
}

private struct FPOpsSectionHeader: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: FPSpacing.xs) {
            Text(title)
                .font(FPTypography.title3)
                .foregroundStyle(FPOpsTheme.textPrimary)
            if let subtitle {
                Text(subtitle)
                    .font(FPTypography.callout)
                    .foregroundStyle(FPOpsTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

#Preview {
    OpsShellView()
}
