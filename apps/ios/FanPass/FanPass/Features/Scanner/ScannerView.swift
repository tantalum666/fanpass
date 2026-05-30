import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct ScannerView: View {
    let apiClient: FanPassAPIClient
    let eventId: String
    let gate: String

    @State private var qrText = ""
    @State private var scanState = ScanState.ready
    @State private var checkinSummary: CheckinSummary?
    @State private var isCameraScannerPresented = false
    @State private var isRedeeming = false
    @StateObject private var nfcScanner = NFCPayloadScanner()

    init(
        apiClient: FanPassAPIClient,
        eventId: String = "evt_weekend_demo",
        gate: String = "A1"
    ) {
        self.apiClient = apiClient
        self.eventId = eventId
        self.gate = gate
    }

    var body: some View {
        FanPassScreen {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    statusPanel
                    inputPanel
                    resultPanel
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 48)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadSummary()
        }
        .fullScreenCover(isPresented: $isCameraScannerPresented) {
            NavigationStack {
                QRCodeScannerView { code in
                    qrText = code
                    scanState = .captured
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

            Text("Scan QR or NFC, redeem, then reset for the next attendee.")
                .font(.subheadline)
                .foregroundStyle(FanPassTheme.slate)
        }
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
                        Text("Entry payload")
                            .font(.headline)
                        Text(payloadHint)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(FanPassTheme.muted)
                    }
                    Spacer()
                    StatusPill(text: "QR", color: FanPassTheme.accent)
                    StatusPill(text: nfcScanner.isAvailable ? "NFC ready" : "NFC fallback", color: nfcScanner.isAvailable ? FanPassTheme.mint : FanPassTheme.amber)
                }

                #if DEBUG
                TextField("Paste QR payload JSON", text: $qrText, axis: .vertical)
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

                    Button {
                        beginNFCScan()
                    } label: {
                        Label(nfcScanner.isReading ? "Reading" : "NFC", systemImage: "wave.3.right.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(nfcScanner.isReading)

                    #if DEBUG
                    Button {
                        pasteFromClipboard()
                    } label: {
                        Label("Paste", systemImage: "doc.on.clipboard")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    #endif
                }

                HStack(spacing: 10) {
                    Button {
                        Task { await redeem() }
                    } label: {
                        Label(isRedeeming ? "Checking" : "Redeem", systemImage: "checkmark.seal")
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
        if nfcScanner.isReading {
            return "Hold the device near a supported FanPass NFC tag"
        }
        if let error = nfcScanner.lastError {
            return error
        }
        if qrText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            #if DEBUG
            return "Waiting for QR, NFC, or paste fallback"
            #else
            return "Waiting for QR or NFC"
            #endif
        }
        return "Payload ready for redemption"
    }

    private func beginNFCScan() {
        guard nfcScanner.isAvailable else {
            scanState = .nfcUnavailable
            nfcScanner.begin { _ in }
            return
        }

        nfcScanner.begin { payload in
            qrText = payload
            scanState = .captured
        }
    }

    #if DEBUG
    private func pasteFromClipboard() {
        #if canImport(UIKit)
        qrText = UIPasteboard.general.string ?? qrText
        #endif
        scanState = qrText.isEmpty ? .ready : .captured
    }
    #endif

    private func redeem() async {
        guard let data = qrText.data(using: .utf8),
              let payload = try? JSONDecoder().decode(QRPayload.self, from: data)
        else {
            scanState = .failure(code: "INVALID_PAYLOAD", message: "The pasted payload is not valid FanPass QR JSON.")
            qrText = ""
            return
        }

        isRedeeming = true
        scanState = .checking
        do {
            let result = try await apiClient.redeem(payload: payload, gate: gate)
            scanState = .accepted(ticketId: result.ticketId)
            qrText = ""
            await loadSummary()
        } catch let error as APIClientError {
            scanState = .failure(code: error.resultCode ?? "ERROR", message: error.localizedDescription)
            qrText = ""
            await loadSummary()
        } catch {
            scanState = .failure(code: "ERROR", message: "The scanner could not reach the verification service.")
            qrText = ""
            await loadSummary()
        }
        isRedeeming = false
    }

    private func resetForNextScan() {
        qrText = ""
        scanState = .ready
    }

    private func loadSummary() async {
        checkinSummary = try? await apiClient.checkinSummary(eventId: eventId, gate: gate)
    }
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
            "Payload captured"
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
            "NFC reading requires a compatible physical iPhone. Use QR or paste fallback in the simulator."
        case .ready:
            "Open QR, NFC, or paste the simulator fallback payload."
        case .captured:
            "Redeem when the attendee is at the gate."
        case .checking:
            "Verifying signature, ticket ownership, and one-time nonce."
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
            "The entry code signature could not be verified."
        case "INVALID_PAYLOAD":
            "The scanner could not read this payload."
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
