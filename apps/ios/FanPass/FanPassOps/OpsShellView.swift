import SwiftUI

struct OpsShellView: View {
    private let privyAuthProvider: PrivyAuthProviding = FanPassPrivyAuthProvider()
    @State private var apiClient = FanPassAPIClient(baseURL: FanPassEnvironment.apiBaseURL)
    @State private var gateSession: UserSession?

    @State private var events: [FanPassEvent] = []
    @State private var selectedEventId = "evt_weekend_demo"
    @State private var selectedGate = "A1"
    @State private var isScannerPresented = false
    @State private var loadState = "Ready"
    @State private var checkinSummary: CheckinSummary?
    @State private var inviteToken = ""
    @State private var staffEmail = ""
    @State private var staffEmailCode = ""
    @State private var privyAccessToken = ""
    @State private var staffWalletAddress = ""
    @State private var accessState = "Local demo staff"
    @State private var isLinkingInvite = false
    @State private var isSendingPrivyCode = false
    @State private var hasSentPrivyCode = false
    @State private var isVerifyingPrivyCode = false

    private let gates = ["A1", "A2", "B1", "B2"]

    var body: some View {
        NavigationStack {
            FanPassScreen {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        header
                        staffAccessPanel
                        eventPanel
                        gatePanel
                        checkinPanel
                        operationsPanel
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 18)
                    .padding(.bottom, 48)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            await loadEvents()
        }
        .task(id: "\(selectedEventId)-\(selectedGate)") {
            await loadCheckinSummary()
        }
        .fullScreenCover(isPresented: $isScannerPresented) {
            NavigationStack {
                ScannerView(
                    apiClient: apiClient,
                    eventId: selectedEventId,
                    gate: selectedGate
                )
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Close") {
                            isScannerPresented = false
                        }
                    }
                }
            }
        }
        .onChange(of: isScannerPresented) { _, presented in
            if !presented {
                Task { await loadCheckinSummary() }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("FanPass Ops")
                    .font(.system(size: 34, weight: .black, design: .rounded))
                    .foregroundStyle(FanPassTheme.ink)
                Spacer()
                StatusPill(text: loadState.uppercased(), color: loadState == "Online" ? FanPassTheme.mint : FanPassTheme.amber)
            }

            Text("Gate staff tools for entry verification and onsite status.")
                .font(.subheadline)
                .foregroundStyle(FanPassTheme.slate)
        }
    }

    private var staffAccessPanel: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    SectionHeading(title: "Staff access")
                    Spacer()
                    StatusPill(
                        text: gateSession?.role == "GATE_STAFF" ? "LINKED" : "PENDING",
                        color: gateSession?.role == "GATE_STAFF" ? FanPassTheme.mint : FanPassTheme.amber
                    )
                }

                Text(accessState)
                    .font(.subheadline)
                    .foregroundStyle(FanPassTheme.slate)

                VStack(alignment: .leading, spacing: 10) {
                    TextField("Invite token", text: $inviteToken)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)

                    TextField("Staff email", text: $staffEmail)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)

                    TextField("One-time code", text: $staffEmailCode)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                        .disabled(!hasSentPrivyCode)

                    #if DEBUG
                    SecureField("Privy access token", text: $privyAccessToken)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                    #endif

                    TextField("Wallet address (optional)", text: $staffWalletAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                }

                if !privyAuthProvider.isAvailable {
                    Text("Privy login is unavailable in this build.")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(FanPassTheme.amber)
                }

                HStack(spacing: 10) {
                    Button {
                        Task { await sendStaffPrivyCode() }
                    } label: {
                        Label(
                            hasSentPrivyCode ? "Resend" : "Send code",
                            systemImage: "envelope.badge"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isSendingPrivyCode || !canRequestStaffPrivyCode)

                    Button {
                        Task { await verifyStaffPrivyCode() }
                    } label: {
                        Label(
                            isVerifyingPrivyCode ? "Verifying" : "Verify",
                            systemImage: "checkmark.shield"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isVerifyingPrivyCode || !canVerifyStaffPrivyCode)
                }

                HStack(spacing: 10) {
                    Button {
                        Task { await linkStaffInvite() }
                    } label: {
                        Label(
                            isLinkingInvite ? "Linking" : "Link invite",
                            systemImage: "person.badge.key"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLinkingInvite || inviteToken.isEmpty || !hasPrivyStaffToken)

                    Button {
                        Task { await useLocalDemoStaff() }
                    } label: {
                        Image(systemName: "person.crop.circle.badge.checkmark")
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel("Use local demo staff")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var eventPanel: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeading(title: "Event")

                if events.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("FanPass Demo Concert")
                            .font(.headline)
                        Text("Using seeded event until API data loads.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Picker("Event", selection: $selectedEventId) {
                        ForEach(events) { event in
                            Text(event.title).tag(event.id)
                        }
                    }
                    .pickerStyle(.menu)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var gatePanel: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeading(title: "Gate")

                Picker("Gate", selection: $selectedGate) {
                    ForEach(gates, id: \.self) { gate in
                        Text(gate).tag(gate)
                    }
                }
                .pickerStyle(.segmented)

                HStack {
                    OpsMetric(title: "Mode", value: "QR")
                    #if DEBUG
                    OpsMetric(title: "Fallback", value: "Paste")
                    #endif
                    OpsMetric(title: "NFC", value: "Beta")
                }
            }
        }
    }

    private var operationsPanel: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.title2)
                        .foregroundStyle(FanPassTheme.accent)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Entry scanner")
                            .font(.headline)
                        Text("Redeems signed QR/NFC payloads and blocks duplicates.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                Button {
                    isScannerPresented = true
                } label: {
                    Label("Open scanner", systemImage: "checkmark.seal")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    private var checkinPanel: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Gate check-ins")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(FanPassTheme.ink)
                    Spacer()
                    Button {
                        Task { await loadCheckinSummary() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel("Refresh check-ins")
                }

                HStack(spacing: 12) {
                    OpsMetric(title: "Accepted", value: "\(checkinSummary?.accepted ?? 0)", color: FanPassTheme.mint)
                    OpsMetric(title: "Rejected", value: "\(checkinSummary?.rejected ?? 0)", color: FanPassTheme.coral)
                    OpsMetric(title: "Total", value: "\(checkinSummary?.total ?? 0)", color: FanPassTheme.ink)
                }

                Text(lastCheckinText)
                    .font(.footnote)
                    .foregroundStyle(FanPassTheme.muted)
            }
        }
    }

    private var lastCheckinText: String {
        guard let value = checkinSummary?.lastCheckedInAt else {
            return "No scans recorded for \(selectedGate)."
        }
        return "Last scan \(fanPassDate(value)) at gate \(selectedGate)."
    }

    private var canRequestStaffPrivyCode: Bool {
        privyAuthProvider.isAvailable &&
            staffEmail.contains("@") &&
            staffEmail.contains(".")
    }

    private var canVerifyStaffPrivyCode: Bool {
        canRequestStaffPrivyCode &&
            hasSentPrivyCode &&
            !staffEmailCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var hasPrivyStaffToken: Bool {
        !privyAccessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func loadEvents() async {
        do {
            try await ensureGateSession()
            events = try await apiClient.events()
            selectedEventId = events.first?.id ?? selectedEventId
            loadState = "Online"
            await loadCheckinSummary()
        } catch {
            loadState = "Offline"
        }
    }

    private func loadCheckinSummary() async {
        do {
            try await ensureGateSession()
            checkinSummary = try await apiClient.checkinSummary(eventId: selectedEventId, gate: selectedGate)
        } catch {
            checkinSummary = nil
        }
    }

    private func ensureGateSession() async throws {
        if gateSession != nil {
            return
        }
        let session = try await apiClient.demoSession(userId: UserSession.gateStaff.userId)
        gateSession = session
        apiClient = apiClient.withAccessToken(session.accessToken)
        accessState = "Using local demo staff session."
    }

    private func useLocalDemoStaff() async {
        gateSession = nil
        do {
            apiClient = FanPassAPIClient(baseURL: FanPassEnvironment.apiBaseURL)
            try await ensureGateSession()
            await loadCheckinSummary()
        } catch {
            accessState = "Local demo staff session failed."
        }
    }

    private func sendStaffPrivyCode() async {
        guard canRequestStaffPrivyCode else {
            return
        }
        isSendingPrivyCode = true
        defer { isSendingPrivyCode = false }

        do {
            try await privyAuthProvider.sendEmailCode(
                to: staffEmail.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            hasSentPrivyCode = true
            accessState = "Privy code sent."
        } catch {
            accessState = "Privy code could not be sent."
        }
    }

    private func verifyStaffPrivyCode() async {
        guard canVerifyStaffPrivyCode else {
            return
        }
        isVerifyingPrivyCode = true
        defer { isVerifyingPrivyCode = false }

        do {
            let result = try await privyAuthProvider.loginWithEmailCode(
                staffEmailCode.trimmingCharacters(in: .whitespacesAndNewlines),
                sentTo: staffEmail.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            privyAccessToken = result.accessToken
            staffWalletAddress = result.walletAddress ?? staffWalletAddress
            accessState = "Privy staff verified."
        } catch {
            accessState = "Privy code could not be verified."
        }
    }

    private func linkStaffInvite() async {
        guard !inviteToken.isEmpty, !privyAccessToken.isEmpty else {
            return
        }
        isLinkingInvite = true
        defer { isLinkingInvite = false }

        do {
            let token = privyAccessToken.trimmingCharacters(in: .whitespacesAndNewlines)
            let session = try await apiClient.acceptStaffInvite(
                privyAccessToken: token,
                inviteToken: inviteToken.trimmingCharacters(in: .whitespacesAndNewlines),
                walletAddress: staffWalletAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : staffWalletAddress
            )
            gateSession = session
            apiClient = apiClient.withAccessToken(token)
            accessState = "Staff invite linked for \(session.displayName)."
            inviteToken = ""
            privyAccessToken = ""
            staffWalletAddress = ""
            await loadCheckinSummary()
        } catch let error as APIClientError {
            accessState = error.localizedDescription
        } catch {
            accessState = "Staff invite could not be linked."
        }
    }
}

private struct OpsMetric: View {
    let title: String
    let value: String
    var color: Color = FanPassTheme.ink

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(FanPassTheme.muted)
            Text(value)
                .font(.headline)
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    OpsShellView()
}
