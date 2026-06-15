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

private enum ChainProofLoadState {
    case idle
    case loading
    case loaded
    case failed
}

struct FanPassV4TicketDetailView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel
    let ticket: FanPassV4.Ticket
    @State private var chainProofResponse: FanPassChainProofResponse?
    @State private var chainProofLoadState: ChainProofLoadState = .idle
    @State private var chainProofErrorMessage: String?
    @State private var sheet: TicketSheet?
    @State private var qrCredential: String?
    @State private var credentialError: String?
    @State private var isRefreshingCredential = false
    @State private var credentialRefreshRemainingSeconds = 30

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
            ticketRules
            onChainStatusCard
            supportHandoff
        }
        .task(id: ticket.id) {
            await refreshChainProof()
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
                FPSectionHeader(title: "Entry QR", subtitle: "Refreshes automatically every 30 seconds")
                if ticket.status.allowsEntryCode {
                    entryQRCodePanel
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
                HStack(spacing: FPSpacing.sm) {
                    FPStatusPill(
                        title: "Entry QR",
                        systemImage: FPIcons.qr,
                        foreground: FPColors.pulseCyan,
                        background: FPColors.pulseCyan.opacity(0.12),
                        border: FPColors.pulseCyan.opacity(0.6)
                    )
                    FPStatusPill(
                        title: "Refresh in \(credentialRefreshRemainingSeconds)s",
                        systemImage: "timer",
                        foreground: FPColors.textSecondary,
                        background: FPColors.surfaceGlass,
                        border: FPColors.borderDivider
                    )
                }
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

    private var ticketRules: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            FPSectionHeader(title: "Ticket rules", subtitle: "Entry and resale rules")
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
                FPSectionHeader(title: "Blockchain details", subtitle: "Sepolia")
                if let chainProofResponse {
                    HStack(alignment: .center, spacing: FPSpacing.md) {
                        FPStatusPill(
                            title: chainProofStatusTitle(chainProofResponse.status),
                            systemImage: chainProofStatusKind(chainProofResponse.status).icon,
                            foreground: chainProofStatusKind(chainProofResponse.status).foreground,
                            background: chainProofStatusKind(chainProofResponse.status).foreground.opacity(0.12),
                            border: chainProofStatusKind(chainProofResponse.status).foreground.opacity(0.5)
                        )
                        Spacer(minLength: 0)
                    }
                    Text(chainProofSummary(chainProofResponse))
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    blockchainDetails(response: chainProofResponse)
                    chainActivity(response: chainProofResponse)
                } else {
                    chainProofPlaceholder
                }
            }
        }
    }

    @ViewBuilder
    private var chainProofPlaceholder: some View {
        switch chainProofLoadState {
        case .idle, .loading:
            HStack(spacing: FPSpacing.md) {
                ProgressView()
                    .tint(FPColors.pulseCyan)
                Text("Loading Sepolia details for this ticket.")
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(FPSpacing.md)
            .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
        case .loaded:
            FPStateBanner(
                title: "No Sepolia result",
                message: "Blockchain details are not ready for this ticket.",
                kind: .warning
            )
        case .failed:
            FPStateBanner(
                title: "Sepolia lookup unavailable",
                message: chainProofErrorMessage ?? "Blockchain details are temporarily unavailable.",
                kind: .warning,
                actionTitle: "Retry"
            ) {
                Task {
                    await refreshChainProof()
                }
            }
        }
    }

    private func blockchainDetails(response: FanPassChainProofResponse) -> some View {
        VStack(spacing: 0) {
            blockchainDetailRow(
                title: "Contract Address",
                value: shortIdentifier(response.contractAddress, head: 6, tail: 4, fallback: "Unavailable"),
                destination: chainContractURL(response)
            )
            blockchainDetailRow(
                title: "Token ID",
                value: response.ticket.tokenId.map { "#\($0)" } ?? "Not minted",
                destination: chainTokenURL(response)
            )
            blockchainDetailRow(title: "Token Standard", value: "ERC721")
            blockchainDetailRow(title: "Chain", value: response.chainId == "11155111" ? "Sepolia" : "Chain \(response.chainId ?? "Unknown")")
            blockchainDetailRow(
                title: "Transaction",
                value: response.transaction.map { shortIdentifier($0.hash, head: 8, tail: 6, fallback: "Attached") } ?? "Not attached",
                destination: chainTransactionURL(response),
                showDivider: false
            )
        }
        .padding(FPSpacing.md)
        .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }

    private func blockchainDetailRow(title: String, value: String, destination: URL? = nil, showDivider: Bool = true) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: FPSpacing.md) {
                Text(title)
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textSecondary)
                Spacer(minLength: FPSpacing.md)
                if let destination {
                    Link(destination: destination) {
                        HStack(spacing: 4) {
                            Text(value)
                                .lineLimit(1)
                                .minimumScaleFactor(0.78)
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 12, weight: .bold))
                        }
                    }
                    .foregroundStyle(FPColors.pulseCyan)
                } else {
                    Text(value)
                        .foregroundStyle(FPColors.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                }
            }
            .font(FPTypography.callout)
            .padding(.vertical, FPSpacing.sm)

            if showDivider {
                Rectangle()
                    .fill(FPColors.borderDivider)
                    .frame(height: 1)
            }
        }
    }

    private func chainActivity(response: FanPassChainProofResponse) -> some View {
        VStack(alignment: .leading, spacing: FPSpacing.sm) {
            Text("Activity")
                .font(FPTypography.headline)
                .foregroundStyle(FPColors.textPrimary)

            if let transaction = response.transaction {
                Link(destination: chainTransactionURL(response) ?? URL(string: "https://sepolia.etherscan.io/")!) {
                    HStack(spacing: FPSpacing.md) {
                        Image(systemName: activityIcon(response))
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(FPColors.pulseCyan)
                            .frame(width: 24)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(activityTitle(response))
                                .font(FPTypography.headline)
                                .foregroundStyle(FPColors.textPrimary)
                            Text("To \(activityRecipient(response))")
                                .font(FPTypography.caption)
                                .foregroundStyle(FPColors.textSecondary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: FPSpacing.sm)
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(activityTime(transaction.blockTimestamp))
                                .font(FPTypography.caption)
                                .foregroundStyle(FPColors.textPrimary)
                                .lineLimit(1)
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(FPColors.pulseCyan)
                        }
                    }
                }
                .padding(FPSpacing.md)
                .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                        .stroke(FPColors.borderDivider, lineWidth: 1)
                }
            } else {
                HStack(spacing: FPSpacing.md) {
                    Image(systemName: "clock.badge.questionmark.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(FPColors.warningAmber)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("No ticket transaction")
                            .font(FPTypography.headline)
                            .foregroundStyle(FPColors.textPrimary)
                        Text("FanPass has not attached a Sepolia tx for this ticket.")
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(FPSpacing.md)
                .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                        .stroke(FPColors.borderDivider, lineWidth: 1)
                }
            }
        }
    }

    private func chainProofStatusTitle(_ status: String) -> String {
        switch status {
        case "linked": "Verified"
        case "mismatch": "Mismatch"
        case "no_chain_record": "No record"
        case "not_configured": "Pending"
        case "rpc_unavailable": "Unavailable"
        default: "Checked"
        }
    }

    private func chainProofStatusKind(_ status: String) -> FPStateKind {
        switch status {
        case "linked": .success
        case "mismatch": .danger
        case "no_chain_record", "not_configured", "rpc_unavailable": .warning
        default: .info
        }
    }

    private func chainProofSummary(_ response: FanPassChainProofResponse) -> String {
        switch response.status {
        case "linked":
            return "This ticket has a matching Sepolia record."
        case "mismatch":
            return response.transaction == nil
                ? "Ticket transaction is not attached yet."
                : "Ticket metadata does not match the Sepolia record."
        case "no_chain_record":
            return "No Sepolia token record is available for this ticket."
        case "not_configured":
            return "Blockchain details are not ready yet."
        case "rpc_unavailable":
            return "Blockchain details are temporarily unavailable."
        default:
            return response.message
        }
    }

    private func chainTransactionURL(_ response: FanPassChainProofResponse) -> URL? {
        guard let explorerUrl = response.transaction?.explorerUrl,
              let url = URL(string: explorerUrl),
              url.host?.contains("etherscan.io") == true,
              url.path.contains("/tx/")
        else {
            return nil
        }
        return url
    }

    private func chainContractURL(_ response: FanPassChainProofResponse) -> URL? {
        guard let explorerUrl = response.contractExplorerUrl,
              let url = URL(string: explorerUrl),
              url.host?.contains("etherscan.io") == true,
              url.path.contains("/address/")
        else {
            return nil
        }
        return url
    }

    private func chainTokenURL(_ response: FanPassChainProofResponse) -> URL? {
        guard let contractAddress = response.contractAddress,
              let tokenId = response.ticket.tokenId,
              let url = URL(string: "https://sepolia.etherscan.io/token/\(contractAddress)?a=\(tokenId)")
        else {
            return nil
        }
        return url
    }

    private func activityTitle(_ response: FanPassChainProofResponse) -> String {
        response.proof.transferCount == "0" ? "Mint" : "Transfer"
    }

    private func activityIcon(_ response: FanPassChainProofResponse) -> String {
        response.proof.transferCount == "0" ? "sparkles" : "arrow.right"
    }

    private func activityRecipient(_ response: FanPassChainProofResponse) -> String {
        if response.wallet.matches == true {
            return "You"
        }
        return shortIdentifier(response.wallet.onChainOwnerAddress, head: 6, tail: 4, fallback: "Unknown")
    }

    private func activityTime(_ isoTimestamp: String?) -> String {
        guard let isoTimestamp,
              let date = ISO8601DateFormatter().date(from: isoTimestamp)
        else {
            return "Pending"
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    private func shortIdentifier(_ value: String?, head: Int, tail: Int, fallback: String) -> String {
        guard let value, value.count > head + tail + 3 else {
            return value ?? fallback
        }
        return "\(value.prefix(head))...\(value.suffix(tail))"
    }

    private func refreshChainProof() async {
        guard backend.isAuthenticated else {
            chainProofResponse = nil
            chainProofErrorMessage = "Sign in to view blockchain details."
            chainProofLoadState = .failed
            return
        }

        chainProofLoadState = .loading
        chainProofErrorMessage = nil
        do {
            chainProofResponse = try await backend.ticketService().chainProof(for: ticket)
            chainProofLoadState = .loaded
        } catch is CancellationError {
            return
        } catch {
            chainProofResponse = nil
            chainProofErrorMessage = error.localizedDescription
            chainProofLoadState = .failed
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
                for remaining in stride(from: 29, through: 0, by: -1) {
                    try await Task.sleep(nanoseconds: 1_000_000_000)
                    credentialRefreshRemainingSeconds = remaining
                }
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
            credentialRefreshRemainingSeconds = 30
        } catch {
            credentialError = "Entry QR could not refresh. Try again."
        }
    }

    @ViewBuilder
    private var ticketPrimaryActions: some View {
        FPSurfaceCard {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                FPSectionHeader(title: "Ticket actions", subtitle: "Sell this ticket or open the market")
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
            FPSectionHeader(title: "Support")
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
                .init(id: "wallet", icon: FPIcons.wallet, title: "Apple Wallet", subtitle: "Add-to-wallet support is coming soon.", value: "Soon")
            ])
        case .support:
            FPConceptRowList(rows: [
                .init(id: "ref", icon: FPIcons.tickets, title: "Ticket reference", subtitle: ticket.shortId, value: "Ready"),
                .init(id: "issue", icon: "exclamationmark.bubble.fill", title: "Report an issue", subtitle: "Share this ticket reference with support.", value: "Open", kind: .info),
                .init(id: "privacy", icon: "lock.shield.fill", title: "Privacy", subtitle: "Only essential account details are used.", value: "Protected", kind: .success)
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
