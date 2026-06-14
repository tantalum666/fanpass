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
    @State private var staffEmail = ""
    @State private var emailCode = ""
    @State private var inviteToken = ""
    @State private var privyAccessToken = ""
    @State private var staffLinkState: StaffLinkState = .idle
    @State private var isDemoSigningIn = false

    private var assignedEvents: [FanPassV4.Event] {
        Array(FanPassMockData.events.prefix(3))
    }

    private var assignedGates: [String] {
        Array(selectedEvent.venue.gates.prefix(2))
    }

    private var isGateAssigned: Bool {
        assignedGates.contains(selectedGate)
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
            case .modeSelector:
                OpsModeSelectorView(
                    event: selectedEvent,
                    gate: selectedGate,
                    loadState: loadState,
                    onClose: { scanSheet = nil },
                    onQR: { scanSheet = .qrCamera },
                    onNFC: { scanSheet = .nfcReader }
                )
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
                    Text("Staff sign-in is required before scanner, audit, or gate tools are available.")
                        .font(FPTypography.callout)
                        .foregroundStyle(FPOpsTheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                staffLinkingPanel

                FPPrimaryButton(
                    title: isDemoSigningIn ? "Signing in" : "Continue as test gate staff",
                    systemImage: "checkmark.shield.fill",
                    isLoading: isDemoSigningIn
                ) {
                    Task { await useLocalDemoStaff() }
                }

                Spacer()
            }
            .padding(FPSpacing.xl)
        }
    }

    private var homeTerminal: some View {
        ScrollView {
            VStack(spacing: FPSpacing.xl) {
                OpsHomeHeader(
                    event: selectedEvent,
                    gate: selectedGate,
                    loadState: loadState,
                    gates: assignedGates,
                    onSelectGate: { selectedGate = $0 },
                    onAccount: { selectedTab = .account }
                )

                VStack(spacing: FPSpacing.lg) {
                    Image(systemName: "checkmark.shield")
                        .font(.system(size: 58, weight: .semibold))
                        .foregroundStyle(FPOpsTheme.blue)
                        .frame(width: 96, height: 96)
                        .background(FPOpsTheme.blue.opacity(0.08), in: Circle())

                    VStack(spacing: FPSpacing.xs) {
                        Text(isGateAssigned ? "Ready to scan" : "Gate locked")
                            .font(FPTypography.title2)
                            .foregroundStyle(FPOpsTheme.textPrimary)
                        Text(isGateAssigned ? "Verify tickets at the gate" : "Switch to an assigned gate in Account")
                            .font(FPTypography.callout)
                            .foregroundStyle(FPOpsTheme.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.top, FPSpacing.lg)

                VStack(spacing: FPSpacing.md) {
                    FPPrimaryButton(title: "Start scanning", systemImage: "qrcode.viewfinder") {
                        scanSheet = .modeSelector
                    }
                    .disabled(!isGateAssigned)

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
                    .disabled(!isGateAssigned)
                }

                Button {
                    Task { await loadCheckinSummary() }
                } label: {
                    OpsServiceRow(loadState: loadState, summary: checkinSummary)
                }
                .buttonStyle(.plain)
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
                    name: "Alex Wong",
                    email: staffEmail.isEmpty ? "alex.wong@fanpass.com" : staffEmail,
                    gate: selectedGate
                )

                FPOpsPanel {
                    VStack(spacing: 0) {
                        OpsNavigationRow(
                            icon: "location.circle.fill",
                            title: "Gate assignment",
                            value: selectedGate,
                            route: .gateAssignment
                        )
                        OpsNavigationRow(
                            icon: "checkmark.shield.fill",
                            title: "Device checks",
                            value: "All good",
                            route: .deviceChecks
                        )
                        OpsNavigationRow(
                            icon: "clock.badge.checkmark",
                            title: "Scan history",
                            value: "Today: \(checkinSummary?.total ?? 128)",
                            route: .scanHistory
                        )
                        OpsNavigationRow(
                            icon: "chart.bar.doc.horizontal",
                            title: "Shift summary",
                            value: "10:00 - 18:00",
                            route: .shiftSummary
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
        case .gateAssignment:
            gateAssignmentPage
        case .deviceChecks:
            deviceChecksPage
        case .scanHistory:
            scanHistoryPage
        case .shiftSummary:
            shiftSummaryPage
        case .help:
            helpPage
        }
    }

    private var gateAssignmentPage: some View {
        OpsSubpage(title: "Gate assignment") {
            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                Text("Current gate")
                    .font(FPTypography.caption.weight(.semibold))
                    .foregroundStyle(FPOpsTheme.textSecondary)
                FPOpsPanel {
                    OpsGateRow(title: selectedGate, subtitle: "Main Floor Entrance", isActive: true) {}
                }

                Text("Change gate")
                    .font(FPTypography.caption.weight(.semibold))
                    .foregroundStyle(FPOpsTheme.textSecondary)
                FPOpsPanel {
                    VStack(spacing: 0) {
                        ForEach(selectedEvent.venue.gates, id: \.self) { gate in
                            OpsGateRow(
                                title: gate,
                                subtitle: gateSubtitle(gate),
                                isActive: gate == selectedGate
                            ) {
                                selectedGate = gate
                            }
                        }
                    }
                }
            }
        }
    }

    private var deviceChecksPage: some View {
        OpsSubpage(title: "Device checks") {
            VStack(spacing: FPSpacing.lg) {
                FPOpsPanel {
                    VStack(spacing: 0) {
                        OpsHealthRow(icon: "camera.fill", title: "Camera", value: "OK", kind: .success)
                        OpsHealthRow(icon: FPIcons.nfc, title: "NFC Reader", value: "OK", kind: .success)
                        OpsHealthRow(icon: loadState.icon, title: "Network", value: loadState.title, kind: loadState.kind)
                        OpsHealthRow(icon: "clock.badge.checkmark", title: "Time sync", value: "OK", kind: .success)
                        OpsHealthRow(icon: "battery.75percent", title: "Battery", value: "88%", kind: .success)
                    }
                }

                FPStateBanner(
                    title: "All systems operational",
                    message: "Last checked at \(Date().formatted(date: .omitted, time: .shortened)).",
                    kind: loadState.kind
                )
            }
        }
    }

    private var scanHistoryPage: some View {
        OpsSubpage(title: "Scan history") {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                HStack {
                    Text(Date().formatted(date: .abbreviated, time: .omitted))
                    Spacer()
                    Text("\(checkinSummary?.total ?? 128) scans")
                }
                .font(FPTypography.caption.weight(.semibold))
                .foregroundStyle(FPOpsTheme.textSecondary)

                FPOpsPanel {
                    VStack(spacing: 0) {
                        OpsHistoryRow(time: "10:45:32", accepted: true, ref: "J8X4-2M9Q", gate: selectedGate, reason: nil)
                        OpsHistoryRow(time: "10:45:10", accepted: false, ref: "K2T9-7H6L", gate: selectedGate, reason: "Already used")
                        OpsHistoryRow(time: "10:44:51", accepted: true, ref: "P6N3-8ZLQ", gate: selectedGate, reason: nil)
                        OpsHistoryRow(time: "10:44:33", accepted: true, ref: "B7C2-5LP9", gate: selectedGate, reason: nil)
                        OpsHistoryRow(time: "10:44:12", accepted: false, ref: "A1V8-3QJJ", gate: selectedGate, reason: "Expired")
                    }
                }
            }
        }
    }

    private var shiftSummaryPage: some View {
        OpsSubpage(title: "Shift summary") {
            VStack(spacing: FPSpacing.lg) {
                FPOpsPanel {
                    VStack(alignment: .leading, spacing: FPSpacing.md) {
                        Text("Today, \(Date().formatted(date: .abbreviated, time: .omitted))")
                            .font(FPTypography.caption.weight(.semibold))
                            .foregroundStyle(FPOpsTheme.textSecondary)
                        OpsSummaryMetric(title: "Total scans", value: "\(checkinSummary?.total ?? 128)", caption: nil)
                        OpsSummaryMetric(title: "Accepted", value: "\(checkinSummary?.accepted ?? 118)", caption: "92.2%")
                        OpsSummaryMetric(title: "Rejected", value: "\(checkinSummary?.rejected ?? 10)", caption: "7.8%")
                    }
                }

                FPOpsPanel {
                    VStack(alignment: .leading, spacing: FPSpacing.md) {
                        OpsSummaryMetric(title: "Shift time", value: "10:00 - 18:00", caption: "Ongoing")
                        OpsSummaryMetric(title: "Gate", value: selectedGate, caption: selectedEvent.title)
                    }
                }
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
        NavigationStack {
            ScannerView(
                apiClient: apiClient,
                eventId: selectedEvent.id,
                gate: selectedGate,
                startsWithCamera: startsWithCamera,
                startsWithNFC: startsWithNFC
            )
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") {
                        scanSheet = nil
                    }
                }
            }
        }
    }

    private var staffLinkingPanel: some View {
        FPOpsPanel {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                FPOpsSectionHeader(title: "Staff sign-in", subtitle: "Link Privy email verification with a one-time staff invite")

                TextField("Staff email", text: $staffEmail)
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
                    SecureField("One-time invite", text: $inviteToken)
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
                        Task { await acceptStaffInvite() }
                    } label: {
                        Label("Link staff", systemImage: "person.badge.key.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!canAcceptStaffInvite)
                }

                FPStateBanner(title: staffLinkState.title, message: staffLinkState.message, kind: staffLinkState.kind)
            }
        }
    }

    private var canAcceptStaffInvite: Bool {
        staffLinkState != .working &&
        !staffEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !emailCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !inviteToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func useLocalDemoStaff() async {
        isDemoSigningIn = true
        defer { isDemoSigningIn = false }
        do {
            let session = try await loadDemoSessionWithTimeout()
            gateSession = session
            apiClient = apiClient.withAccessToken(session.accessToken)
            loadState = .online
            await loadCheckinSummary()
        } catch {
            gateSession = UserSession.gateStaff
            apiClient = apiClient.withAccessToken("local-review-staff")
            staffLinkState = .linked
            loadState = .degraded
        }
    }

    private func loadDemoSessionWithTimeout() async throws -> UserSession {
        try await withThrowingTaskGroup(of: UserSession.self) { group in
            let client = apiClient
            group.addTask {
                try await client.demoSession(userId: UserSession.gateStaff.userId)
            }
            group.addTask {
                try await Task.sleep(nanoseconds: 3_000_000_000)
                throw OpsDemoSignInError.timeout
            }
            guard let session = try await group.next() else {
                throw OpsDemoSignInError.timeout
            }
            group.cancelAll()
            return session
        }
    }

    private func loadCheckinSummary() async {
        guard gateSession != nil else { return }
        do {
            checkinSummary = try await apiClient.checkinSummary(eventId: selectedEvent.id, gate: selectedGate)
            loadState = .online
        } catch {
            checkinSummary = nil
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
                walletAddress: result.walletAddress
            )
            gateSession = session
            let token = session.accessToken
            apiClient = apiClient.withAccessToken(token)
            privyAccessToken = ""
            inviteToken = ""
            emailCode = ""
            staffLinkState = .linked
            loadState = .online
            await loadCheckinSummary()
        } catch {
            privyAccessToken = ""
            staffLinkState = .failed("Staff invite linking failed. Check the code, invite, and assignment.")
        }
    }

    private func signOut() {
        gateSession = nil
        selectedTab = .home
        scanSheet = nil
        loadState = .offline
        checkinSummary = nil
    }

    private func gateSubtitle(_ gate: String) -> String {
        switch gate {
        case "A1": "Main Floor Entrance"
        case "A2": "VIP Entrance"
        case "B1": "Balcony Entrance"
        case "C1": "Back Entrance"
        default: "Event entrance"
        }
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
    case modeSelector
    case qrCamera
    case nfcReader

    var id: String { rawValue }
}

private enum OpsAccountRoute: Hashable {
    case gateAssignment
    case deviceChecks
    case scanHistory
    case shiftSummary
    case help
}

private enum OpsDemoSignInError: Error {
    case timeout
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
            "Staff link required"
        case .working:
            "Checking"
        case .codeSent:
            "Code sent"
        case .linked:
            "Staff linked"
        case .failed:
            "Link failed"
        }
    }

    var message: String {
        switch self {
        case .idle:
            "Use a verified email code and one-time invite before scanning assigned gates."
        case .working:
            "Verifying staff identity and assignment."
        case .codeSent:
            "Enter the email code and staff invite to finish linking."
        case .linked:
            "The staff session is active for assigned gate work."
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
    let event: FanPassV4.Event
    let gate: String
    let loadState: OpsLoadState
    let gates: [String]
    let onSelectGate: (String) -> Void
    let onAccount: () -> Void

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Menu {
                    ForEach(gates, id: \.self) { gate in
                        Button(gate) { onSelectGate(gate) }
                    }
                } label: {
                    HStack(spacing: FPSpacing.xs) {
                        Text("Gate \(gate)")
                            .font(FPTypography.title3)
                            .foregroundStyle(FPOpsTheme.textPrimary)
                        Image(systemName: "chevron.down")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(FPOpsTheme.textSecondary)
                    }
                }
                Text(event.title)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPOpsTheme.textSecondary)
                FPStatusPill(
                    title: loadState.title,
                    systemImage: loadState.icon,
                    foreground: loadState.kind.foreground,
                    background: loadState.kind.foreground.opacity(0.12),
                    border: loadState.kind.foreground.opacity(0.35)
                )
                .padding(.top, FPSpacing.xs)
            }
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

private struct OpsServiceRow: View {
    let loadState: OpsLoadState
    let summary: CheckinSummary?

    var body: some View {
        HStack(spacing: FPSpacing.sm) {
            Circle()
                .fill(loadState.kind.foreground)
                .frame(width: 9, height: 9)
            Text(loadState == .online ? "Service online" : "Service \(loadState.title.lowercased())")
                .font(FPTypography.caption.weight(.semibold))
                .foregroundStyle(FPOpsTheme.textSecondary)
            Spacer()
            if let summary {
                Text("\(summary.accepted) accepted")
                    .font(FPTypography.caption.weight(.semibold))
                    .foregroundStyle(FPOpsTheme.textSecondary)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(FPOpsTheme.textSecondary)
        }
        .padding(FPSpacing.md)
        .background(FPOpsTheme.surface, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                .stroke(FPOpsTheme.border, lineWidth: 1)
        }
    }
}

private struct OpsModeSelectorView: View {
    let event: FanPassV4.Event
    let gate: String
    let loadState: OpsLoadState
    let onClose: () -> Void
    let onQR: () -> Void
    let onNFC: () -> Void

    var body: some View {
        ZStack {
            FPOpsTheme.background.ignoresSafeArea()
            VStack(alignment: .leading, spacing: FPSpacing.xl) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        Text("Gate \(gate)")
                            .font(FPTypography.title3)
                            .foregroundStyle(FPOpsTheme.textPrimary)
                        Text(event.title)
                            .font(FPTypography.caption)
                            .foregroundStyle(FPOpsTheme.textSecondary)
                        FPStatusPill(
                            title: loadState.title,
                            systemImage: loadState.icon,
                            foreground: loadState.kind.foreground,
                            background: loadState.kind.foreground.opacity(0.12),
                            border: loadState.kind.foreground.opacity(0.35)
                        )
                    }
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(FPOpsTheme.textPrimary)
                            .frame(width: 44, height: 44)
                            .background(FPOpsTheme.surface, in: Circle())
                            .overlay {
                                Circle().stroke(FPOpsTheme.border, lineWidth: 1)
                            }
                    }
                }

                Spacer(minLength: FPSpacing.lg)

                Text("Choose scanning method")
                    .font(FPTypography.title3)
                    .foregroundStyle(FPOpsTheme.textPrimary)
                    .frame(maxWidth: .infinity)

                VStack(spacing: FPSpacing.md) {
                    OpsScanChoice(icon: "qrcode.viewfinder", title: "QR Camera", subtitle: "Scan entry code", action: onQR)
                    OpsScanChoice(icon: FPIcons.nfc, title: "NFC Reader", subtitle: "Tap fan device", action: onNFC)
                }

                Spacer()

                FPOpsPanel {
                    HStack(spacing: FPSpacing.md) {
                        Image(systemName: "lock.fill")
                            .foregroundStyle(FPOpsTheme.textSecondary)
                        VStack(alignment: .leading, spacing: FPSpacing.xs) {
                            Text("Event & gate are locked")
                                .font(FPTypography.headline)
                                .foregroundStyle(FPOpsTheme.textPrimary)
                            Text("Switch in Account > Gate assignment")
                                .font(FPTypography.caption)
                                .foregroundStyle(FPOpsTheme.textSecondary)
                        }
                        Spacer()
                    }
                }
            }
            .padding(FPSpacing.lg)
        }
    }
}

private struct OpsScanChoice: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FPSpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Color.white)
                    .frame(width: 56, height: 56)
                    .background(FPOpsTheme.blue, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text(title)
                        .font(FPTypography.headline)
                        .foregroundStyle(FPOpsTheme.textPrimary)
                    Text(subtitle)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPOpsTheme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(FPOpsTheme.textSecondary)
            }
            .padding(FPSpacing.md)
            .background(FPOpsTheme.surface, in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous)
                    .stroke(FPOpsTheme.border, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
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
    let gate: String

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
            Text(gate)
                .font(FPTypography.caption.weight(.semibold))
                .foregroundStyle(FPOpsTheme.textSecondary)
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

private struct OpsGateRow: View {
    let title: String
    let subtitle: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FPSpacing.md) {
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text("Gate \(title)")
                        .font(FPTypography.headline)
                        .foregroundStyle(FPOpsTheme.textPrimary)
                    Text(subtitle)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPOpsTheme.textSecondary)
                }
                Spacer()
                if isActive {
                    FPStatusPill(title: "Active", systemImage: "checkmark", foreground: FPOpsTheme.green, background: FPOpsTheme.green.opacity(0.12), border: FPOpsTheme.green.opacity(0.35))
                } else {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(FPOpsTheme.textSecondary)
                }
            }
            .padding(.vertical, FPSpacing.sm)
        }
        .buttonStyle(.plain)
    }
}

private struct OpsHealthRow: View {
    let icon: String
    let title: String
    let value: String
    let kind: FPStateKind

    var body: some View {
        HStack(spacing: FPSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(FPOpsTheme.textSecondary)
                .frame(width: 28)
            Text(title)
                .font(FPTypography.headline)
                .foregroundStyle(FPOpsTheme.textPrimary)
            Spacer()
            Text(value)
                .font(FPTypography.caption.weight(.bold))
                .foregroundStyle(kind.foreground)
        }
        .padding(.vertical, FPSpacing.sm)
    }
}

private struct OpsHistoryRow: View {
    let time: String
    let accepted: Bool
    let ref: String
    let gate: String
    let reason: String?

    var body: some View {
        HStack(spacing: FPSpacing.md) {
            Image(systemName: accepted ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(accepted ? FPOpsTheme.green : FPOpsTheme.red)
            Text(time)
                .font(FPTypography.caption)
                .foregroundStyle(FPOpsTheme.textPrimary)
                .monospacedDigit()
            VStack(alignment: .leading, spacing: 2) {
                Text(accepted ? "ACCEPTED" : "REJECTED")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(accepted ? FPOpsTheme.green : FPOpsTheme.red)
                Text(reason ?? ref)
                    .font(.caption2)
                    .foregroundStyle(FPOpsTheme.textSecondary)
            }
            Spacer()
            Text(gate)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(FPOpsTheme.textSecondary)
        }
        .padding(.vertical, FPSpacing.sm)
    }
}

private struct OpsSummaryMetric: View {
    let title: String
    let value: String
    let caption: String?

    var body: some View {
        HStack(alignment: .lastTextBaseline) {
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text(title)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPOpsTheme.textSecondary)
                Text(value)
                    .font(FPTypography.title3)
                    .foregroundStyle(FPOpsTheme.textPrimary)
                    .monospacedDigit()
            }
            Spacer()
            if let caption {
                Text(caption)
                    .font(FPTypography.caption.weight(.semibold))
                    .foregroundStyle(FPOpsTheme.blue)
            }
        }
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
