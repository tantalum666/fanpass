import CoreImage.CIFilterBuiltins
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct TicketWalletView: View {
    @Environment(AppState.self) private var appState
    @State private var tickets: [FanPassTicket] = []
    @State private var events: [FanPassEvent] = []
    @State private var selectedPayload: QRPayload?

    var body: some View {
        FanPassScreen {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Tickets")
                        .font(.system(size: 34, weight: .black, design: .rounded))

                    if appState.session == nil {
                        AuthRequiredPanel(
                            title: "Your wallet is private",
                            message: "Sign in to view tickets and generate entry codes.",
                            actionTitle: "Sign in",
                            action: { _ = appState.requireAuth(.wallet) }
                        )
                    } else if tickets.isEmpty {
                        SoftCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("No active tickets")
                                    .font(.headline)
                                Text("Tickets you buy or receive will appear here.")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    } else {
                        ForEach(tickets) { ticket in
                            TicketCard(ticket: ticket, context: context(for: ticket)) {
                                Task {
                                    selectedPayload = try? await appState.apiClient.qrPayload(ticketId: ticket.id)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 110)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedPayload) { payload in
            TicketQRSheet(initialPayload: payload)
        }
        .task(id: appState.session?.userId) {
            await load()
        }
    }

    private func load() async {
        guard let session = appState.session else {
            tickets = []
            return
        }

        tickets = (try? await appState.apiClient.tickets(ownerId: session.userId)) ?? []
        events = (try? await appState.apiClient.events()) ?? []
    }

    private func context(for ticket: FanPassTicket) -> TicketContext {
        let event = events.first { $0.id == ticket.eventId }
        let ticketType = event?.ticketTypes.first { $0.id == ticket.ticketTypeId }
        return TicketContext(event: event, ticketType: ticketType)
    }
}

private struct TicketContext {
    let event: FanPassEvent?
    let ticketType: TicketType?
}

private struct TicketCard: View {
    let ticket: FanPassTicket
    let context: TicketContext
    let qrAction: () -> Void

    var body: some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(ticket.tokenId.map { "Ticket #\($0)" } ?? ticket.id)
                            .font(.title3.weight(.bold))
                        Text(context.event?.title ?? ticket.eventId)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    StatusPill(text: ticket.status, color: fanPassStatusColor(ticket.status))
                }

                VStack(alignment: .leading, spacing: 10) {
                    WalletInfoRow(title: "Ticket type", value: context.ticketType?.name ?? ticket.ticketTypeId)
                    WalletInfoRow(title: "Transfer limit", value: transferPolicy)
                    WalletInfoRow(title: "Entry", value: entryState)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Ownership history")
                        .font(.headline)
                    TimelineRow(icon: "checkmark.seal.fill", title: "Issued", detail: "Verified by FanPass")
                    if ticket.transferCount > 0 {
                        TimelineRow(icon: "arrow.left.arrow.right", title: "Transferred", detail: "\(ticket.transferCount) recorded transfer")
                    }
                    TimelineRow(icon: "ticket.fill", title: "Current state", detail: ticket.status)
                }

                Button("Show entry code", action: qrAction)
                    .buttonStyle(.borderedProminent)
                    .disabled(!canGenerateEntryCode)
            }
        }
    }

    private var transferPolicy: String {
        guard let ticketType = context.ticketType else {
            return "\(ticket.transferCount) transfers used"
        }

        if !ticketType.transferable {
            return "Locked to buyer"
        }

        return "\(ticket.transferCount)/\(ticketType.maxTransferCount ?? 1) transfers used"
    }

    private var entryState: String {
        switch ticket.status {
        case "ACTIVE", "TRANSFERRED": "Ready for entry"
        case "REDEEMED": "Already used"
        case "LISTED_FOR_RESALE": "Reserved by sell order"
        default: "Not ready"
        }
    }

    private var canGenerateEntryCode: Bool {
        ticket.status == "ACTIVE" || ticket.status == "TRANSFERRED"
    }
}

private struct WalletInfoRow: View {
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

private struct TimelineRow: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.caption.weight(.bold))
                .foregroundStyle(FanPassTheme.mint)
                .frame(width: 24, height: 24)
                .background(FanPassTheme.mint.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

extension QRPayload: Identifiable {
    var id: String { nonce }
}

struct TicketQRSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var payload: QRPayload
    @State private var copied = false
    @State private var isRefreshing = false
    @State private var refreshError: String?

    init(initialPayload: QRPayload) {
        _payload = State(initialValue: initialPayload)
    }

    private let refreshLeadTime: TimeInterval = 5
    private let maxRefreshDelay: TimeInterval = 25

    var body: some View {
        NavigationStack {
            FanPassScreen {
                VStack(spacing: 20) {
                    VStack(spacing: 12) {
                        QRCodeImageView(value: payload.qrCodeString)
                            .frame(width: 244, height: 244)
                            .padding(18)
                            .background(.white, in: RoundedRectangle(cornerRadius: 8, style: .continuous))

                        StatusPill(text: "Verified entry code", color: FanPassTheme.mint)
                    }

                    SoftCard {
                        VStack(alignment: .leading, spacing: 12) {
                            LabeledContent("Ticket", value: payload.ticketId)
                            LabeledContent("Expires", value: payload.expiresAt)
                            LabeledContent("Refresh", value: isRefreshing ? "Refreshing" : "Auto before expiry")
                            if let refreshError {
                                Text(refreshError)
                                    .font(.caption)
                                    .foregroundStyle(FanPassTheme.amber)
                            }
                        }
                    }

                    SoftCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "wallet.pass")
                                    .font(.title3.weight(.semibold))
                                    .foregroundStyle(FanPassTheme.accent)
                                Text("Apple Wallet barcode")
                                    .font(.headline)
                                Spacer()
                                StatusPill(text: "Ready", color: FanPassTheme.mint)
                            }

                            LabeledContent("Format", value: payload.walletBarcode.format)
                            LabeledContent("Alt text", value: payload.walletBarcode.altText)

                            #if DEBUG
                            Button {
                                copyWalletBarcode()
                            } label: {
                                Label("Copy barcode JSON", systemImage: "doc.on.doc")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            #endif
                        }
                    }

                    #if DEBUG
                    Button {
                        copyPayload()
                    } label: {
                        Label(copied ? "Copied" : "Copy entry code", systemImage: copied ? "checkmark" : "doc.on.doc")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    #endif

                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Entry Code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .task(id: payload.ticketId) {
            await autoRefreshLoop()
        }
    }

    @MainActor
    private func autoRefreshLoop() async {
        while !Task.isCancelled {
            let delay = refreshDelay()
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            if Task.isCancelled {
                return
            }
            await refreshPayload()
        }
    }

    private func refreshDelay() -> TimeInterval {
        guard let expiryDate = parseISODate(payload.expiresAt) else {
            return maxRefreshDelay
        }

        return min(maxRefreshDelay, max(1, expiryDate.timeIntervalSinceNow - refreshLeadTime))
    }

    @MainActor
    private func refreshPayload() async {
        isRefreshing = true
        defer { isRefreshing = false }

        do {
            payload = try await appState.apiClient.qrPayload(ticketId: payload.ticketId)
            refreshError = nil
            copied = false
        } catch {
            refreshError = "Could not refresh automatically. Try again before entry."
        }
    }

    private func parseISODate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) {
            return date
        }

        let fallback = ISO8601DateFormatter()
        fallback.formatOptions = [.withInternetDateTime]
        return fallback.date(from: value)
    }

    #if DEBUG
    private func copyPayload() {
        #if canImport(UIKit)
        UIPasteboard.general.string = payload.qrCodeString
        copied = true
        #endif
    }

    private func copyWalletBarcode() {
        #if canImport(UIKit)
        UIPasteboard.general.string = payload.walletBarcode.jsonString
        copied = true
        #endif
    }
    #endif
}

private struct QRCodeImageView: View {
    let value: String
    private let context = CIContext()
    private let filter = CIFilter.qrCodeGenerator()

    var body: some View {
        if let image = makeImage() {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
                .accessibilityLabel("Entry QR code")
        } else {
            Image(systemName: "qrcode")
                .font(.system(size: 120, weight: .semibold))
                .foregroundStyle(FanPassTheme.muted)
        }
    }

    private func makeImage() -> UIImage? {
        let data = Data(value.utf8)
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")

        guard let outputImage = filter.outputImage else {
            return nil
        }

        let scaledImage = outputImage.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }
}

extension QRPayload {
    var qrCodeString: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]

        guard let data = try? encoder.encode(self),
              let string = String(data: data, encoding: .utf8)
        else {
            return ticketId
        }

        return string
    }

    var walletBarcode: AppleWalletBarcodePrototype {
        AppleWalletBarcodePrototype(
            message: qrCodeString,
            altText: "FanPass ticket \(ticketId)",
            eventId: eventId,
            ticketId: ticketId,
            expiresAt: expiresAt
        )
    }
}

struct AppleWalletBarcodePrototype: Encodable, Hashable {
    let format = "PKBarcodeFormatQR"
    let message: String
    let messageEncoding = "iso-8859-1"
    let altText: String
    let eventId: String
    let ticketId: String
    let expiresAt: String

    var jsonString: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]

        guard let data = try? encoder.encode(self),
              let string = String(data: data, encoding: .utf8)
        else {
            return message
        }

        return string
    }
}
