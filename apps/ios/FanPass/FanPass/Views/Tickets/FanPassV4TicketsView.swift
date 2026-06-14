import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

struct FanPassV4TicketsView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel
    @State private var viewModel = TicketsViewModel()
    @State private var selectedFilter: TicketFilter = .upcoming

    private var filteredTickets: [FanPassV4.Ticket] {
        switch selectedFilter {
        case .upcoming: viewModel.upcoming
        case .listed: viewModel.listed
        case .history: viewModel.past
        case .all: viewModel.tickets
        }
    }

    var body: some View {
        FanPassV4Scaffold(title: "Tickets", subtitle: "Owned ticket retrieval, entry readiness, and safe lifecycle state.") {
            if backend.isAuthenticated {
                walletSummary
                FPConceptSegmentedControl(options: TicketFilter.allCases, selection: $selectedFilter) { $0.title }
                ticketList
            } else {
                signedOutTicketsCard
            }
        }
        .task(id: backend.ticketRefreshKey) {
            guard backend.isAuthenticated else { return }
            await viewModel.load(user: backend.user, ticketService: backend.ticketService())
        }
    }

    private var walletSummary: some View {
        FPConceptStatStrip(stats: [
            ("Ready", "\(viewModel.upcoming.filter { $0.status == .active }.count)", "Entry-code eligible"),
            ("Listed", "\(viewModel.listed.count)", "Entry reserved"),
            ("History", "\(viewModel.past.count)", "Closed tickets")
        ])
    }

    private var signedOutTicketsCard: some View {
        FPSurfaceCard(cornerRadius: FPRadius.xl) {
            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                HStack(alignment: .top, spacing: FPSpacing.md) {
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 32, weight: .semibold))
                        .foregroundStyle(FPGradients.passAurora)
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        Text("Sign in to view tickets")
                            .font(FPTypography.title3)
                            .foregroundStyle(FPColors.textPrimary)
                        Text("Ticket wallet, entry credentials, resale, and ownership history require a fan session.")
                            .font(FPTypography.callout)
                            .foregroundStyle(FPColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                FPPrimaryButton(title: "Sign in / Sign up", systemImage: "envelope.fill") {
                    appViewModel.openPrivySignIn()
                }
                FPSecondaryButton(title: "Browse events", systemImage: FPIcons.home) {
                    appViewModel.selectedTab = .home
                    appViewModel.selectedTabID = FanPassV4Tab.home.id
                }
            }
        }
    }

    private var ticketList: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: selectedFilter.title, subtitle: "\(filteredTickets.count) ticket\(filteredTickets.count == 1 ? "" : "s")")
            if filteredTickets.isEmpty {
                FPEmptyStateView(title: "No tickets here", message: selectedFilter.emptyMessage, systemImage: FPIcons.tickets)
                    .frame(maxWidth: .infinity)
                    .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
            } else {
                ForEach(filteredTickets) { ticket in
                    NavigationLink {
                        FanPassV4TicketDetailView(ticket: ticket)
                    } label: {
                        FPTicketCard(
                            eventTitle: ticket.event.title,
                            metadata: "\(ticket.event.dateLine) • \(ticket.event.venue.name)",
                            section: ticket.section,
                            row: ticket.row,
                            seat: ticket.seat,
                            ticketId: ticket.shortId,
                            statusTitle: ticket.status.title,
                            nfcReady: false,
                            entryModeTitle: ticket.status.allowsEntryCode ? "Entry ready" : ticket.entryMode.title
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private enum TicketFilter: String, CaseIterable, Hashable {
    case upcoming
    case listed
    case history
    case all

    var title: String {
        switch self {
        case .upcoming: "Upcoming"
        case .listed: "Listed"
        case .history: "History"
        case .all: "All"
        }
    }

    var emptyMessage: String {
        switch self {
        case .upcoming: "Tickets ready for entry will appear here."
        case .listed: "Open resale listings reserve entry and appear here."
        case .history: "Redeemed, cancelled, refunded, transferred, and expired tickets appear here."
        case .all: "Your verified tickets will appear here after purchase."
        }
    }
}

private enum ProofLoadState {
    case local
    case api
    case fallback
}

struct FanPassV4TicketDetailView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel
    let ticket: FanPassV4.Ticket
    @State private var proofHistory: [FanPassV4.ProofHistoryItem]
    @State private var proofLoadState: ProofLoadState = .local
    @State private var sheet: TicketSheet?
    @State private var proofExpanded = true
    @State private var qrCredential: String?
    @State private var credentialError: String?
    @State private var isRefreshingCredential = false

    init(ticket: FanPassV4.Ticket) {
        self.ticket = ticket
        _proofHistory = State(initialValue: ticket.proofHistory)
    }

    var body: some View {
        FanPassV4Scaffold(title: "Ticket", subtitle: ticket.event.title) {
            FPTicketCard(
                eventTitle: ticket.event.title,
                metadata: "\(ticket.event.dateLine) • \(ticket.event.venue.name), \(ticket.event.venue.city)",
                section: ticket.section,
                row: ticket.row,
                seat: ticket.seat,
                ticketId: ticket.shortId,
                statusTitle: ticket.status.title,
                nfcReady: false,
                entryModeTitle: ticket.status.allowsEntryCode ? "Entry ready" : ticket.entryMode.title
            )

            entryReadinessCard
            ticketPrimaryActions
            controlGrid
            ticketRules
            onChainStatusCard
            proofAndHistory
            supportHandoff
        }
        .task(id: ticket.id) {
            await refreshProofHistory()
        }
        .task(id: "\(ticket.id)-entry-credential") {
            await runEntryCredentialLoop()
        }
        .sheet(item: $sheet) { sheet in
            TicketSheetView(sheet: sheet, ticket: ticket)
                .presentationDetents([.large])
        }
    }

    private var entryReadinessCard: some View {
        FPSurfaceCard {
            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                FPSectionHeader(title: "Entry readiness", subtitle: "Backend remains the source of truth")
                if ticket.status.allowsEntryCode {
                    entryQRCodePanel
                    FPConceptRowList(rows: [
                        .init(id: "state", icon: FPIcons.verified, title: "Entry credential ready", subtitle: "FanPass API remains the authority for gate acceptance.", value: "Ready", kind: .success),
                        .init(id: "privacy", icon: "eye.slash.fill", title: "Credential payload hidden", subtitle: "Raw QR payload, nonce, and signature are never displayed on the ticket face.", value: "Hidden", kind: .success)
                    ])
                    FPSecondaryButton(
                        title: isRefreshingCredential ? "Refreshing QR" : "Refresh QR",
                        systemImage: "arrow.clockwise"
                    ) {
                        Task {
                            await refreshEntryCredential()
                        }
                    }
                } else {
                    FPStateBanner(title: inactiveStateTitle, message: inactiveStateMessage, kind: ticket.status == .cancelled ? .danger : .warning)
                }
            }
        }
    }

    @ViewBuilder
    private var entryQRCodePanel: some View {
        VStack(alignment: .center, spacing: FPSpacing.md) {
            if let qrCredential {
                FanPassEntryQRCodeImage(value: qrCredential)
                    .frame(width: 220, height: 220)
                    .padding(FPSpacing.md)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                    .accessibilityLabel("Entry QR code")
                FPStatusPill(
                    title: "Entry QR",
                    systemImage: FPIcons.qr,
                    foreground: FPColors.pulseCyan,
                    background: FPColors.pulseCyan.opacity(0.12),
                    border: FPColors.pulseCyan.opacity(0.6)
                )
            } else if isRefreshingCredential {
                ProgressView()
                    .tint(FPColors.pulseCyan)
                    .frame(width: 220, height: 220)
                    .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                    .accessibilityLabel("Loading entry QR")
            } else {
                FPStateBanner(
                    title: "Entry QR unavailable",
                    message: credentialError ?? "Refresh the ticket detail when entry credentials are available.",
                    kind: .warning
                )
            }

            if let credentialError, qrCredential != nil {
                Text(credentialError)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.warningAmber)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var controlGrid: some View {
        FPConceptActionGrid(actions: [
            .init(id: "wallet", title: "Wallet pass", systemImage: FPIcons.wallet, subtitle: "Signed pass path stays separate", kind: ticket.status.allowsEntryCode ? .info : .neutral),
            .init(id: "transfer", title: "Transfer", systemImage: "paperplane.fill", subtitle: "Disabled by lifecycle state when needed", kind: ticket.status == .active ? .info : .warning),
            .init(id: "resale", title: "List resale", systemImage: FPIcons.resale, subtitle: "Handoff to Market under caps", kind: ticket.status.allowsResale ? .success : .warning),
            .init(id: "support", title: "Support", systemImage: "questionmark.circle.fill", subtitle: "Safe ticket ref only")
        ])
    }

    private var ticketRules: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Ticket rules", subtitle: "Typed lifecycle constraints")
            FPConceptRowList(rows: [
                .init(id: "type", icon: FPIcons.tickets, title: ticket.ticketType.name, subtitle: "Face value \(ticket.ticketType.priceLabel)", value: ticket.status.title),
                .init(id: "transfer", icon: "arrow.left.arrow.right", title: "Transfer rule", subtitle: ticket.ticketType.transferRule.summary, value: "\(ticket.transferCount)/\(ticket.ticketType.transferRule.maxTransferCount)"),
                .init(id: "refund", icon: "doc.text.fill", title: "Refund policy", subtitle: ticket.ticketType.refundPolicy, value: "Policy")
            ])
        }
    }

    private var onChainStatusCard: some View {
        FPSurfaceCard {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                FPSectionHeader(title: "On-chain status", subtitle: "Sepolia proof from FanPass API")
                if let chainProof {
                    HStack(alignment: .top, spacing: FPSpacing.md) {
                        FPStatusPill(
                            title: chainProof.proofReference,
                            systemImage: "link.circle.fill",
                            foreground: chainProof.externalURL == nil ? FPColors.warningAmber : FPColors.verifiedGreen,
                            background: (chainProof.externalURL == nil ? FPColors.warningAmber : FPColors.verifiedGreen).opacity(0.12),
                            border: (chainProof.externalURL == nil ? FPColors.warningAmber : FPColors.verifiedGreen).opacity(0.5)
                        )
                        Spacer(minLength: 0)
                    }
                    Text(chainProof.description)
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if let externalURL = chainProof.externalURL {
                        Link(destination: externalURL) {
                            HStack(spacing: FPSpacing.sm) {
                                Image(systemName: "arrow.up.right.square.fill")
                                    .font(.system(size: 16, weight: .semibold))
                                Text("Open Sepolia scan")
                                    .font(FPTypography.headline)
                                Spacer(minLength: FPSpacing.sm)
                                Text(externalURL.host ?? "sepolia.etherscan.io")
                                    .font(FPTypography.caption)
                                    .foregroundStyle(FPColors.textTertiary)
                                    .lineLimit(1)
                            }
                            .foregroundStyle(FPColors.textPrimary)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .padding(.horizontal, FPSpacing.lg)
                            .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                                    .stroke(FPColors.borderDivider, lineWidth: 1)
                            }
                        }
                        .accessibilityLabel("Open Sepolia scan")
                    } else {
                        FPStateBanner(
                            title: "Explorer link pending",
                            message: "Ownership metadata is available; the public explorer link has not been attached yet.",
                            kind: .warning
                        )
                    }
                } else {
                    FPStateBanner(
                        title: proofLoadState == .api ? "No chain proof yet" : "Checking chain proof",
                        message: proofLoadState == .fallback ? "Showing cached proof history until the backend responds." : "Chain status appears here after FanPass API returns ownership proof metadata.",
                        kind: proofLoadState == .fallback ? .warning : .info
                    )
                }
            }
        }
    }

    private var chainProof: FanPassV4.ProofHistoryItem? {
        proofHistory.first { item in
            item.id == "chain-proof" || item.externalURL != nil || item.title.lowercased().contains("chain")
        }
    }

    private var proofAndHistory: some View {
        DisclosureGroup(isExpanded: $proofExpanded) {
            VStack(spacing: FPSpacing.md) {
                proofStateBanner
                if proofHistory.isEmpty {
                    FPEmptyStateView(title: "No proof history yet", message: "Ownership history appears after issue.", systemImage: FPIcons.proof)
                } else {
                    ForEach(proofHistory) { item in
                        FPProofHistoryRow(title: item.title, subtitle: proofSubtitle(for: item), status: item.status)
                    }
                }
            }
            .padding(.top, FPSpacing.md)
        } label: {
            Text("Proof & History")
                .font(FPTypography.title3)
                .foregroundStyle(FPColors.textPrimary)
        }
        .padding(FPSpacing.lg)
        .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }

    @ViewBuilder
    private var proofStateBanner: some View {
        switch proofLoadState {
        case .api:
            FPStateBanner(
                title: "Backend proof loaded",
                message: "Safe contract and lifecycle summaries are synced from FanPass API.",
                kind: .success
            )
        case .fallback:
            FPStateBanner(
                title: "Proof fallback",
                message: "Showing local ticket history until backend proof history is available.",
                kind: .warning
            )
        case .local:
            EmptyView()
        }
    }

    private func refreshProofHistory() async {
        guard backend.isAuthenticated else {
            proofLoadState = .local
            return
        }
        do {
            let remoteProof = try await backend.ticketService().proofHistory(for: ticket)
            proofHistory = remoteProof
            proofLoadState = .api
        } catch {
            proofHistory = ticket.proofHistory
            proofLoadState = .fallback
        }
    }

    private func runEntryCredentialLoop() async {
        guard ticket.status.allowsEntryCode else {
            qrCredential = nil
            credentialError = nil
            return
        }

        while !Task.isCancelled {
            await refreshEntryCredential()
            do {
                try await Task.sleep(nanoseconds: 25_000_000_000)
            } catch {
                return
            }
        }
    }

    private func refreshEntryCredential() async {
        guard ticket.status.allowsEntryCode else {
            qrCredential = nil
            credentialError = nil
            return
        }

        isRefreshingCredential = true
        defer { isRefreshingCredential = false }

        do {
            qrCredential = try await backend.scannerService().refreshQRCredential(ticket: ticket)
            credentialError = nil
        } catch {
            credentialError = "Entry QR could not refresh from FanPass API. Try again."
        }
    }

    private func proofSubtitle(for item: FanPassV4.ProofHistoryItem) -> String {
        let detail = item.description.isEmpty ? item.actorLabel : item.description
        return "\(item.actorLabel) • \(item.proofReference)\n\(detail)"
    }

    @ViewBuilder
    private var ticketPrimaryActions: some View {
        FPSurfaceCard {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                FPSectionHeader(title: "Ticket actions", subtitle: "Sell or review this event's market")
                if ticket.status.allowsResale {
                    NavigationLink {
                        FanPassV4ListTicketView(ticket: ticket)
                    } label: {
                        HStack(spacing: FPSpacing.sm) {
                            Image(systemName: FPIcons.resale)
                            Text("Sell ticket")
                        }
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(FPGradients.passAurora, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                                .stroke(Color.white.opacity(0.16), lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                } else {
                    FPStateBanner(
                        title: "Resale unavailable",
                        message: "\(ticket.status.title) tickets cannot be listed for resale.",
                        kind: .warning
                    )
                }

                FPSecondaryButton(title: "Open market chart", systemImage: "chart.xyaxis.line") {
                    appViewModel.openMarket(for: ticket.event)
                }
            }
        }
    }

    private var supportHandoff: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Support and handoff")
            HStack(spacing: FPSpacing.md) {
                FPSecondaryButton(title: "Rules", systemImage: "doc.text.fill") { sheet = .rules }
                FPSecondaryButton(title: "Support", systemImage: "questionmark.circle.fill") { sheet = .support }
            }
        }
    }

    private var inactiveStateTitle: String {
        switch ticket.status {
        case .listed: "Listed ticket"
        case .redeemed: "Already redeemed"
        case .cancelled: "Cancelled ticket"
        case .refunded: "Refunded ticket"
        case .expired: "Expired ticket"
        case .transferred: "Transferred ticket"
        case .transferPending: "Transfer pending"
        case .active: "Verified Ticket"
        }
    }

    private var inactiveStateMessage: String {
        switch ticket.status {
        case .listed: "Listed tickets cannot be used for entry while resale is open."
        case .redeemed: "This ticket has already been accepted at entry and cannot be reused."
        case .cancelled: "Organizer policy cancelled this ticket. Entry and resale are disabled."
        case .refunded: "This ticket was refunded. Entry, resale, and transfer are disabled."
        case .expired: "The event window has passed. Entry is no longer available."
        case .transferred: "Ownership moved to another fan. This account keeps the history only."
        case .transferPending: "Transfer is processing. Wait for confirmation before taking action."
        case .active: "This ticket is ready for entry."
        }
    }
}

private enum TicketSheet: String, Identifiable {
    case rules
    case support

    var id: String { rawValue }
}

private struct TicketSheetView: View {
    let sheet: TicketSheet
    let ticket: FanPassV4.Ticket
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            FanPassV4Scaffold(title: title, subtitle: ticket.event.title) {
                content
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch sheet {
        case .rules:
            FPConceptRowList(rows: [
                .init(id: "transfer", icon: "arrow.left.arrow.right", title: "Transfer", subtitle: ticket.ticketType.transferRule.summary, value: "Rule"),
                .init(id: "entry", icon: FPIcons.qr, title: "Entry", subtitle: "One accepted admission per ticket.", value: "Single", kind: .success),
                .init(id: "wallet", icon: FPIcons.wallet, title: "Apple Wallet", subtitle: "Standard pass route is separate from NFC tap-to-reader.", value: "Future")
            ])
        case .support:
            FPConceptRowList(rows: [
                .init(id: "ref", icon: FPIcons.tickets, title: "Safe ticket reference", subtitle: ticket.shortId, value: "Masked"),
                .init(id: "issue", icon: "exclamationmark.bubble.fill", title: "Report an issue", subtitle: "Support receives safe metadata only.", value: "Open", kind: .info),
                .init(id: "privacy", icon: "lock.shield.fill", title: "Privacy", subtitle: "No raw provider, wallet, or credential internals.", value: "Protected", kind: .success)
            ])
        }
    }

    private var title: String {
        switch sheet {
        case .rules: "Ticket Rules"
        case .support: "Ticket Support"
        }
    }
}

private struct FanPassEntryQRCodeImage: View {
    let value: String
    private let context = CIContext()
    private let filter = CIFilter.qrCodeGenerator()

    var body: some View {
        if let image = makeImage() {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
        } else {
            Image(systemName: FPIcons.qr)
                .font(.system(size: 120, weight: .semibold))
                .foregroundStyle(FPColors.textSecondary)
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

#Preview {
    NavigationStack {
        FanPassV4TicketsView()
    }
}
