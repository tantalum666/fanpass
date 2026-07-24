import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct ScannerView: View {
    let apiClient: FanPassAPIClient
    let eventId: String
    let gate: String
    let startsWithCamera: Bool
    let startsWithNFC: Bool
    let onExit: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var qrText = ""
    @State private var scanState = ScanState.ready
    @State private var capturedTransport: PayloadTransport?
    @State private var checkinSummary: CheckinSummary?
    @State private var isCameraScannerPresented = false
    @State private var isRedeeming = false
    @State private var didStartInitialCapture = false
    @State private var autoRedeemPayload: String?
    @State private var redeemedLocalCredentialIds: Set<String> = []
    @StateObject private var nfcScanner = NFCPayloadScanner()
    private let isoFormatter = ISO8601DateFormatter()
    private let qrWaitingHint = "Waiting for QR"

    init(
        apiClient: FanPassAPIClient,
        eventId: String = "evt_weekend",
        gate: String = "A1",
        startsWithCamera: Bool = false,
        startsWithNFC: Bool = false,
        onExit: (() -> Void)? = nil
    ) {
        self.apiClient = apiClient
        self.eventId = eventId
        self.gate = gate
        self.startsWithCamera = startsWithCamera
        self.startsWithNFC = startsWithNFC
        self.onExit = onExit
    }

    var body: some View {
        ZStack {
            if startsWithCamera {
                QRCodeScannerView { code in
                    captureQRCode(code)
                }
                .ignoresSafeArea()
            } else {
                LinearGradient(
                    colors: [Color(hex: 0x06101F), Color(hex: 0x0D1B2F)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            }

            VStack(spacing: FPSpacing.xl) {
                HStack {
                    Button {
                        exitScanner()
                    } label: {
                        Label("Exit", systemImage: "xmark")
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(Color.white)
                            .padding(.horizontal, 14)
                            .frame(height: 44)
                            .background(Color.white.opacity(0.14), in: Capsule())
                    }
                    .buttonStyle(.plain)

                    Spacer()
                }

                Spacer()

                VStack(spacing: FPSpacing.lg) {
                    Image(systemName: scanState.icon)
                        .font(.system(size: 56, weight: .bold))
                        .foregroundStyle(scanState.color)
                        .frame(width: 108, height: 108)
                        .background(scanState.color.opacity(0.16), in: RoundedRectangle(cornerRadius: 28, style: .continuous))

                    VStack(spacing: FPSpacing.sm) {
                        Text(scanState.title)
                            .font(.system(size: 34, weight: .black, design: .rounded))
                            .foregroundStyle(Color.white)
                            .multilineTextAlignment(.center)
                        Text(scanState.message)
                            .font(FPTypography.callout)
                            .foregroundStyle(Color.white.opacity(0.72))
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    if isRedeeming || scanState == .checking {
                        ProgressView()
                            .tint(Color.white)
                    }
                }
                .padding(.horizontal, FPSpacing.lg)
                .opacity(startsWithCamera ? 0 : 1)

                Spacer()

                if !startsWithCamera && !startsWithNFC {
                    VStack(spacing: FPSpacing.md) {
                        Button {
                            isCameraScannerPresented = true
                        } label: {
                            Label(isRedeeming ? "Checking" : "Scan QR", systemImage: "qrcode.viewfinder")
                                .font(FPTypography.headline)
                                .foregroundStyle(Color.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .background(FanPassTheme.accent, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(isRedeeming)

                        #if DEBUG
                        Button {
                            beginNFCScan()
                        } label: {
                            Label(nfcScanner.isReading ? "Reading NFC" : "Scan NFC", systemImage: "wave.3.right.circle")
                                .font(FPTypography.headline)
                                .foregroundStyle(Color.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 54)
                                .background(Color.white.opacity(0.14), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(isRedeeming || nfcScanner.isReading)
                        #endif
                    }
                    .padding(.horizontal, FPSpacing.lg)
                }
            }
            .padding(.horizontal, FPSpacing.lg)
            .padding(.top, FPSpacing.lg)
            .padding(.bottom, FPSpacing.xl)

            if let result = scanState.fullScreenResult(gate: gate) {
                ScannerResultOverlay(result: result) {
                    exitScanner()
                }
                .transition(.opacity)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadSummary()
            startInitialCaptureIfNeeded()
        }
        .onChange(of: scanState) { _, state in
            handleScanStateChange(state)
        }
        .fullScreenCover(isPresented: $isCameraScannerPresented) {
            NavigationStack {
                QRCodeScannerView { code in
                    captureQRCode(code)
                    isCameraScannerPresented = false
                }
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Close") {
                            isCameraScannerPresented = false
                        }
                    }
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Gate Scanner")
                    .font(.system(size: 34, weight: .black, design: .rounded))
                    .foregroundStyle(FanPassTheme.ink)
                Spacer()
                StatusPill(text: "Gate \(gate)", color: FanPassTheme.accent)
            }

            Text(scannerInstruction)
                .font(.subheadline)
                .foregroundStyle(FanPassTheme.slate)
        }
    }

    private var scannerInstruction: String {
        #if DEBUG
        "Scan QR or NFC, redeem, then reset for the next attendee."
        #else
        "Scan QR, redeem, then reset for the next attendee."
        #endif
    }

    private var statusPanel: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Today at gate \(gate)")
                        .font(.headline)
                    Spacer()
                    Button {
                        Task { await loadSummary() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel("Refresh gate totals")
                }

                HStack(spacing: 12) {
                    ScannerMetric(title: "Accepted", value: "\(checkinSummary?.accepted ?? 0)", color: FanPassTheme.mint)
                    ScannerMetric(title: "Rejected", value: "\(checkinSummary?.rejected ?? 0)", color: FanPassTheme.coral)
                    ScannerMetric(title: "Total", value: "\(checkinSummary?.total ?? 0)", color: FanPassTheme.ink)
                }
            }
        }
    }

    private var inputPanel: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Entry code")
                            .font(.headline)
                        Text(payloadHint)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(FanPassTheme.muted)
                    }
                    Spacer()
                    StatusPill(text: "QR", color: FanPassTheme.accent)
                    #if DEBUG
                    StatusPill(text: nfcScanner.isAvailable ? "NFC ready" : "QR available", color: nfcScanner.isAvailable ? FanPassTheme.mint : FanPassTheme.amber)
                    #endif
                }

                #if DEBUG
                TextField("Manual QR code", text: $qrText, axis: .vertical)
                    .lineLimit(5, reservesSpace: true)
                    .textFieldStyle(.roundedBorder)
                #endif

                HStack(spacing: 10) {
                    Button {
                        isCameraScannerPresented = true
                    } label: {
                        Label("QR", systemImage: "qrcode.viewfinder")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    #if DEBUG
                    Button {
                        beginNFCScan()
                    } label: {
                        Label(nfcScanner.isReading ? "Reading" : "NFC", systemImage: "wave.3.right.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(nfcScanner.isReading)
                    #endif

                    #if DEBUG
                    Button {
                        pasteFromClipboard()
                    } label: {
                        Label("Clipboard", systemImage: "doc.on.clipboard")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    #endif
                }

                #if DEBUG
                HStack(spacing: 10) {
                    Button {
                        Task { await redeem() }
                    } label: {
                        Label(isRedeeming ? "Checking" : "Check now", systemImage: "checkmark.seal")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isRedeeming || qrText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    Button {
                        resetForNextScan()
                    } label: {
                        Label("Next", systemImage: "arrow.counterclockwise")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
                #endif
            }
        }
    }

    private var resultPanel: some View {
        SoftCard {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: scanState.icon)
                    .font(.title.weight(.semibold))
                    .foregroundStyle(scanState.color)
                    .frame(width: 44, height: 44)
                    .background(scanState.color.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 6) {
                    Text(scanState.title)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(FanPassTheme.ink)
                    Text(scanState.message)
                        .font(.subheadline)
                        .foregroundStyle(FanPassTheme.slate)
                }
                Spacer()
            }
        }
    }

    private var payloadHint: String {
        #if DEBUG
        if nfcScanner.isReading {
            return "Hold the device near a supported FanPass NFC tag"
        }
        if let error = nfcScanner.lastError {
            return error
        }
        #endif
        if qrText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            #if DEBUG
            return "Waiting for QR or NFC"
            #else
            return qrWaitingHint
            #endif
        }
        return "Entry code ready"
    }

    private func startInitialCaptureIfNeeded() {
        guard !didStartInitialCapture else { return }
        didStartInitialCapture = true
        #if DEBUG
        if startsWithNFC {
            beginNFCScan()
        }
        #endif
    }

    private func handleScanStateChange(_ state: ScanState) {
        switch state {
        case .captured:
            redeemCapturedPayloadIfNeeded()
        default:
            break
        }
    }

    private func redeemCapturedPayloadIfNeeded() {
        let payload = qrText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !payload.isEmpty, !isRedeeming, autoRedeemPayload != payload else { return }
        autoRedeemPayload = payload
        Task { await redeem() }
    }

    private func captureQRCode(_ code: String) {
        qrText = code
        capturedTransport = .qr
        scanState = .captured
    }

    #if DEBUG
    private func beginNFCScan() {
        guard nfcScanner.isAvailable else {
            scanState = .nfcUnavailable
            nfcScanner.begin { _ in }
            return
        }

        nfcScanner.begin { payload in
            qrText = payload
            capturedTransport = .nfc
            scanState = .captured
        }
    }
    #endif

    #if DEBUG
    private func pasteFromClipboard() {
        #if canImport(UIKit)
        qrText = UIPasteboard.general.string ?? qrText
        #endif
        capturedTransport = qrText.isEmpty ? nil : .qr
        scanState = qrText.isEmpty ? .ready : .captured
    }
    #endif

    private func redeem() async {
        let trimmedPayload = qrText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPayload.isEmpty else { return }
        isRedeeming = true
        scanState = .checking
        do {
            let result: RedemptionResult
            if capturedTransport == .nfc {
                result = try await apiClient.validateNFC(
                    ndefPayload: qrText,
                    eventId: eventId,
                    gate: gate
                )
            } else {
                guard let data = qrText.data(using: .utf8),
                      let payload = try? JSONDecoder().decode(QRPayload.self, from: data)
                else {
                    scanState = .failure(code: "INVALID_PAYLOAD", message: invalidPayloadMessage)
                    qrText = ""
                    capturedTransport = nil
                    autoRedeemPayload = nil
                    isRedeeming = false
                    return
                }
                if payload.kid == "local-review" {
                    scanState = localReviewScanState(for: payload)
                    qrText = ""
                    capturedTransport = nil
                    autoRedeemPayload = nil
                    isRedeeming = false
                    return
                } else {
                    result = try await apiClient.redeem(payload: payload, gate: gate)
                }
            }
            scanState = .accepted(ticketId: result.ticketId)
            qrText = ""
            capturedTransport = nil
            autoRedeemPayload = nil
            await loadSummary()
        } catch let error as APIClientError {
            scanState = .failure(code: error.resultCode ?? "ERROR", message: error.localizedDescription)
            qrText = ""
            capturedTransport = nil
            autoRedeemPayload = nil
            await loadSummary()
        } catch {
            scanState = .failure(code: "ERROR", message: "Could not verify this entry. Try again.")
            qrText = ""
            capturedTransport = nil
            autoRedeemPayload = nil
            await loadSummary()
        }
        isRedeeming = false
    }

    private func localReviewScanState(for payload: QRPayload) -> ScanState {
        guard let expiresAt = isoFormatter.date(from: payload.expiresAt) else {
            return .failure(code: "INVALID_PAYLOAD", message: "This QR code is missing a valid expiry.")
        }
        guard expiresAt > Date() else {
            return .failure(code: "EXPIRED", message: "Ask the fan app to refresh the QR code.")
        }
        let credentialId = payload.credentialId ?? payload.nonce
        guard !redeemedLocalCredentialIds.contains(credentialId) else {
            return .failure(code: "DUPLICATE", message: "Ask the attendee to refresh their QR code.")
        }
        redeemedLocalCredentialIds.insert(credentialId)
        return .accepted(ticketId: payload.ticketId)
    }

    private func resetForNextScan() {
        qrText = ""
        capturedTransport = nil
        autoRedeemPayload = nil
        scanState = .ready
    }

    private func exitScanner() {
        if let onExit {
            onExit()
        } else {
            dismiss()
        }
    }

    private func loadSummary() async {
        checkinSummary = try? await apiClient.checkinSummary(eventId: eventId, gate: gate)
    }

    private var invalidPayloadMessage: String {
        return "This entry code is not valid."
    }
}

private enum PayloadTransport {
    case qr
    case nfc
}

private enum ScanState: Equatable {
    case nfcUnavailable
    case ready
    case captured
    case checking
    case accepted(ticketId: String)
    case failure(code: String, message: String)

    var title: String {
        switch self {
        case .nfcUnavailable:
            "NFC unavailable"
        case .ready:
            "Ready"
        case .captured:
            "Entry code captured"
        case .checking:
            "Checking ticket"
        case .accepted:
            "Accepted"
        case let .failure(code, _):
            failureTitle(code)
        }
    }

    var message: String {
        switch self {
        case .nfcUnavailable:
            nfcUnavailableMessage
        case .ready:
            readyMessage
        case .captured:
            "Redeem when the attendee is at the gate."
        case .checking:
            "Checking ticket ownership and entry status."
        case let .accepted(ticketId):
            "Ticket \(ticketId) can enter. The scanner is ready for the next attendee."
        case let .failure(code, message):
            "\(failureMessage(code)) \(message)"
        }
    }

    var icon: String {
        switch self {
        case .nfcUnavailable:
            "wave.3.right.circle"
        case .ready:
            "qrcode.viewfinder"
        case .captured:
            "doc.text.magnifyingglass"
        case .checking:
            "clock"
        case .accepted:
            "checkmark.seal.fill"
        case .failure:
            "xmark.octagon.fill"
        }
    }

    var color: Color {
        switch self {
        case .nfcUnavailable:
            FanPassTheme.amber
        case .accepted:
            FanPassTheme.mint
        case .failure:
            FanPassTheme.coral
        case .checking, .captured:
            FanPassTheme.amber
        case .ready:
            FanPassTheme.accent
        }
    }

    private func failureTitle(_ code: String) -> String {
        switch code {
        case "DUPLICATE":
            "Duplicate"
        case "EXPIRED":
            "Expired"
        case "INVALID_SIGNATURE", "INVALID_PAYLOAD":
            "Invalid"
        case "OWNER_MISMATCH":
            "Owner mismatch"
        case "NOT_ACTIVE":
            "Not active"
        case "CANCELLED":
            "Cancelled"
        default:
            "Rejected"
        }
    }

    private func failureMessage(_ code: String) -> String {
        switch code {
        case "DUPLICATE":
            "This entry code has already been accepted."
        case "EXPIRED":
            "The entry code is outside its valid time window."
        case "INVALID_SIGNATURE":
            "The entry code could not be verified."
        case "INVALID_PAYLOAD":
            "The scanner could not read this entry code."
        case "OWNER_MISMATCH":
            "The code no longer matches the current ticket owner."
        case "NOT_ACTIVE":
            "The ticket is not in an entry-ready state."
        case "CANCELLED":
            "This ticket has been cancelled."
        default:
            "This ticket cannot enter right now."
        }
    }

    private var nfcUnavailableMessage: String {
        #if DEBUG
        return "NFC reading requires a compatible physical iPhone. Use QR when NFC is unavailable."
        #else
        return "NFC reading requires a compatible physical iPhone. Use QR when NFC is unavailable."
        #endif
    }

    private var readyMessage: String {
        #if DEBUG
        return "Open QR or NFC to verify the attendee."
        #else
        return "Open QR to verify the attendee."
        #endif
    }

    func fullScreenResult(gate: String) -> ScannerFullScreenResult? {
        switch self {
        case let .accepted(ticketId):
            return ScannerFullScreenResult(
                isAccepted: true,
                title: "ACCEPTED",
                reason: nil,
                safeRef: safeRef(from: ticketId),
                gate: gate,
                timestamp: Date()
            )
        case let .failure(code, message):
            return ScannerFullScreenResult(
                isAccepted: false,
                title: "REJECTED",
                reason: failureOverlayReason(code: code, message: message),
                safeRef: safeRef(from: code),
                gate: gate,
                timestamp: Date()
            )
        default:
            return nil
        }
    }

    private func safeRef(from rawValue: String) -> String {
        let compact = rawValue.filter { $0.isLetter || $0.isNumber }.uppercased()
        guard !compact.isEmpty else { return "UNKNOWN" }
        let suffix = String(compact.suffix(8))
        guard suffix.count > 4 else { return suffix }
        let splitIndex = suffix.index(suffix.startIndex, offsetBy: 4)
        return "\(suffix[..<splitIndex])-\(suffix[splitIndex...])"
    }

    private func failureOverlayReason(code: String, message: String) -> String {
        let title = failureTitle(code)
        let trimmedMessage = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedMessage.isEmpty else { return title }
        if trimmedMessage.localizedCaseInsensitiveContains(title) {
            return trimmedMessage
        }
        return "\(title): \(trimmedMessage)"
    }
}

private struct ScannerFullScreenResult {
    let isAccepted: Bool
    let title: String
    let reason: String?
    let safeRef: String
    let gate: String
    let timestamp: Date

    var tint: Color {
        isAccepted ? Color(hex: 0x12B76A) : Color(hex: 0xF04438)
    }

    var symbol: String {
        isAccepted ? "checkmark" : "xmark"
    }
}

private struct ScannerResultOverlay: View {
    let result: ScannerFullScreenResult
    let onExit: () -> Void

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [result.tint, result.tint.opacity(0.82)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack {
                HStack {
                    Button(action: onExit) {
                        Label("Exit", systemImage: "xmark")
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(result.tint)
                            .padding(.horizontal, 14)
                            .frame(height: 44)
                            .background(Color.white, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    Spacer()
                }
                Spacer()
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)

            VStack(spacing: 28) {
                Spacer()
                Image(systemName: result.symbol)
                    .font(.system(size: 76, weight: .heavy))
                    .foregroundStyle(result.tint)
                    .frame(width: 138, height: 138)
                    .background(Color.white, in: Circle())
                    .overlay {
                        Circle()
                            .stroke(Color.white.opacity(0.92), lineWidth: result.isAccepted ? 0 : 6)
                    }

                Text(result.title)
                    .font(.system(size: 34, weight: .black, design: .rounded))
                    .foregroundStyle(Color.white)

                VStack(spacing: 10) {
                    if let reason = result.reason {
                        Text("Reason")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.white.opacity(0.76))
                        Text(reason)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(Color.white)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, 28)
                    }

                    Text("Safe Ref")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.white.opacity(0.76))
                    Text(result.safeRef)
                        .font(.title3.weight(.bold).monospaced())
                        .foregroundStyle(Color.white)
                }

                Rectangle()
                    .fill(Color.white.opacity(0.28))
                    .frame(height: 1)
                    .padding(.horizontal, 44)

                Text(result.timestamp.formatted(date: .abbreviated, time: .standard))
                    .font(.callout.weight(.semibold))
                .foregroundStyle(Color.white)

                Spacer()
            }
        }
    }
}

private struct ScannerMetric: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(FanPassTheme.muted)
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(FanPassTheme.background, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}
