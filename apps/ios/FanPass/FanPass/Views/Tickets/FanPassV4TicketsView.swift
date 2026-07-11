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
        FanPassV4Scaffold(title: "Tickets", subtitle: nil) {
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
                        Text("Sign in to manage entry and resale.")
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
            FPSectionHeader(title: "\(selectedFilter.title) · \(filteredTickets.count)")
            if let errorMessage = viewModel.errorMessage {
                FPStateBanner(
                    title: "Tickets unavailable",
                    message: errorMessage,
                    kind: .warning,
                    actionTitle: "Retry"
                ) {
                    Task {
                        await viewModel.load(user: backend.user, ticketService: backend.ticketService())
                    }
                }
            } else if viewModel.isLoading && viewModel.tickets.isEmpty {
                ProgressView("Loading tickets")
                    .tint(FPColors.pulseCyan)
                    .frame(maxWidth: .infinity, minHeight: 160)
            } else if filteredTickets.isEmpty {
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
    @Environment(\.scenePhase) private var scenePhase
    let ticket: FanPassV4.Ticket
    @State private var chainProofResponse: FanPassChainProofResponse?
    @State private var chainProofLoadState: ChainProofLoadState = .idle
    @State private var chainProofErrorMessage: String?
    @State private var sheet: TicketSheet?
    @State private var qrCredential: String?
    @State private var credentialError: String?
    @State private var isRefreshingCredential = false
    @State private var credentialRefreshRemainingSeconds = 30
    @State private var liveTicket: FanPassV4.Ticket?
    @State private var ticketStatusError: String?

    private var currentTicket: FanPassV4.Ticket {
        liveTicket ?? ticket
    }

    var body: some View {
        FanPassV4Scaffold(title: "Ticket", subtitle: currentTicket.event.title) {
            FPTicketCard(
                eventTitle: currentTicket.event.title,
                metadata: "\(currentTicket.event.dateLine) • \(currentTicket.event.venue.name), \(currentTicket.event.venue.city)",
                section: currentTicket.section,
                row: currentTicket.row,
                seat: currentTicket.seat,
                ticketId: currentTicket.shortId,
                statusTitle: currentTicket.status.title,
                nfcReady: false,
                entryModeTitle: currentTicket.status.allowsEntryCode ? "Entry ready" : currentTicket.entryMode.title
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
        .task(id: "\(ticket.id)-status-refresh-\(scenePhase)") {
            guard scenePhase == .active else { return }
            await runTicketStatusRefreshLoop()
        }
        .task(id: "\(ticket.id)-entry-credential-\(scenePhase)") {
            guard scenePhase == .active else { return }
            await runEntryCredentialLoop()
        }
        .sheet(item: $sheet) { sheet in
            TicketSheetView(sheet: sheet, ticket: currentTicket)
                .presentationDetents([.large])
        }
    }

    private var entryReadinessCard: some View {
        FPSurfaceCard {
            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                FPSectionHeader(
                    title: "Entry QR",
                    subtitle: currentTicket.status.allowsEntryCode ? "Refreshes every 30s" : "Paused while unavailable"
                )
                if let ticketStatusError {
                    FPStateBanner(
                        title: "Ticket status could not refresh",
                        message: ticketStatusError,
                        kind: .warning
                    )
                }
                if currentTicket.status.allowsEntryCode {
                    entryQRCodePanel
                    FPSecondaryButton(
                        title: isRefreshingCredential ? "Refreshing QR" : "Refresh QR",
                        systemImage: "arrow.clockwise"
                    ) {
                        Task {
                            await refreshEntryCredential()
                        }
                    }
                } else if currentTicket.status == .redeemed, qrCredential != nil {
                    entryQRCodePanel
                } else {
                    FPStateBanner(title: inactiveStateTitle, message: inactiveStateMessage, kind: currentTicket.status == .cancelled ? .danger : .warning)
                }
            }
        }
    }

    @ViewBuilder
    private var entryQRCodePanel: some View {
        VStack(alignment: .center, spacing: FPSpacing.md) {
            if let qrCredential {
                ZStack {
                    FanPassEntryQRCodeImage(value: qrCredential)
                        .opacity(currentTicket.status == .redeemed ? 0.38 : 1)
                    if currentTicket.status == .redeemed {
                        VStack(spacing: FPSpacing.sm) {
                            Image(systemName: "checkmark.seal.fill")
                                .font(.system(size: 38, weight: .bold))
                            Text("USED")
                                .font(.system(size: 32, weight: .heavy))
                        }
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, FPSpacing.lg)
                        .padding(.vertical, FPSpacing.md)
                        .background(FPColors.verifiedGreen.opacity(0.94), in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
                        .shadow(color: FPColors.verifiedGreen.opacity(0.35), radius: 18, y: 8)
                        .accessibilityLabel("Ticket already used")
                    }
                }
                .frame(width: 220, height: 220)
                .padding(FPSpacing.md)
                .background(Color.white, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                .accessibilityLabel(currentTicket.status == .redeemed ? "Ticket already used" : "Entry QR code")
                HStack(spacing: FPSpacing.sm) {
                    FPStatusPill(
                        title: currentTicket.status == .redeemed ? "Entered" : "Entry QR",
                        systemImage: currentTicket.status == .redeemed ? "checkmark.seal.fill" : FPIcons.qr,
                        foreground: currentTicket.status == .redeemed ? FPColors.verifiedGreen : FPColors.pulseCyan,
                        background: (currentTicket.status == .redeemed ? FPColors.verifiedGreen : FPColors.pulseCyan).opacity(0.12),
                        border: (currentTicket.status == .redeemed ? FPColors.verifiedGreen : FPColors.pulseCyan).opacity(0.6)
                    )
                    if currentTicket.status.allowsEntryCode {
                        FPStatusPill(
                            title: "Refresh in \(credentialRefreshRemainingSeconds)s",
                            systemImage: "timer",
                            foreground: FPColors.textSecondary,
                            background: FPColors.surfaceGlass,
                            border: FPColors.borderDivider
                        )
                    }
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
            FPSectionHeader(title: "Ticket rules")
            FPConceptRowList(rows: [
                .init(id: "type", icon: FPIcons.tickets, title: currentTicket.ticketType.name, subtitle: "Face value \(currentTicket.ticketType.priceLabel)", value: currentTicket.status.title),
                .init(id: "transfer", icon: "arrow.left.arrow.right", title: "Transfer rule", subtitle: currentTicket.ticketType.transferRule.summary, value: "\(currentTicket.transferCount)/\(currentTicket.ticketType.transferRule.maxTransferCount)"),
                .init(id: "refund", icon: "doc.text.fill", title: "Refund policy", subtitle: currentTicket.ticketType.refundPolicy, value: "Policy")
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
                            Text(activityTime(transaction))
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
            if response.transaction == nil {
                return "Ticket transaction is not attached yet."
            }
            if response.wallet.matches == false {
                return "Ticket holder does not match the Sepolia record."
            }
            if response.event.matches == false {
                return "Ticket event does not match the Sepolia record."
            }
            if response.proof.ticketIdHashMatches == false || response.proof.ticketTypeHashMatches == false {
                return "Ticket identity does not match the Sepolia record."
            }
            if response.proof.policyHashMatches == false {
                return "Ticket rules do not match the Sepolia record."
            }
            if response.proof.metadataHashMatches == false {
                return "Ticket metadata does not match the Sepolia record."
            }
            return "Ticket chain checks did not fully match."
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

    private func activityTime(_ transaction: FanPassChainProofResponse.Transaction) -> String {
        guard let isoTimestamp = transaction.blockTimestamp,
              let date = ISO8601DateFormatter().date(from: isoTimestamp)
        else {
            switch transaction.status {
            case "success":
                return "Confirmed"
            case "failed":
                return "Failed"
            default:
                return "Pending"
            }
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
            chainProofResponse = try await backend.ticketService().chainProof(for: currentTicket)
            chainProofLoadState = .loaded
        } catch is CancellationError {
            return
        } catch {
            chainProofResponse = nil
            chainProofErrorMessage = error.localizedDescription
            chainProofLoadState = .failed
        }
    }

    private func runTicketStatusRefreshLoop() async {
        while !Task.isCancelled {
            await refreshTicketStatus()
            if [.redeemed, .cancelled, .refunded, .expired].contains(currentTicket.status) {
                return
            }
            do {
                let delay: Duration = currentTicket.status.allowsEntryCode ? .seconds(2) : .seconds(5)
                try await Task.sleep(for: delay)
            } catch {
                return
            }
        }
    }

    private func refreshTicketStatus() async {
        guard backend.isAuthenticated else {
            return
        }

        do {
            if let updatedTicket = try await backend.ticketService().ticket(id: ticket.id) {
                applyTicketStatusRefresh(updatedTicket)
                ticketStatusError = nil
                return
            }

            let walletTickets = try await backend.ticketService().walletTickets(for: backend.user, statusOverride: nil)
            guard let updatedTicket = walletTickets.first(where: { $0.id == ticket.id }) else {
                ticketStatusError = "This ticket is not currently available in your account."
                return
            }
            applyTicketStatusRefresh(updatedTicket)
            ticketStatusError = nil
        } catch is CancellationError {
            return
        } catch {
            ticketStatusError = "Showing the last known status. Check your connection and try again."
        }
    }

    private func applyTicketStatusRefresh(_ updatedTicket: FanPassV4.Ticket) {
        liveTicket = updatedTicket
        if updatedTicket.status == .redeemed {
            credentialError = nil
        } else if !updatedTicket.status.allowsEntryCode {
            qrCredential = nil
            credentialError = nil
        }
    }

    private func runEntryCredentialLoop() async {
        guard currentTicket.status.allowsEntryCode else {
            qrCredential = nil
            credentialError = nil
            return
        }

        while !Task.isCancelled {
            if !currentTicket.status.allowsEntryCode {
                qrCredential = nil
                credentialError = nil
                return
            }
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
        await refreshTicketStatus()
        let ticketForCredential = currentTicket
        guard ticketForCredential.status.allowsEntryCode else {
            qrCredential = nil
            credentialError = nil
            return
        }

        isRefreshingCredential = true
        defer { isRefreshingCredential = false }

        do {
            qrCredential = try await backend.scannerService().refreshQRCredential(ticket: ticketForCredential)
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
                FPSectionHeader(title: "Ticket actions")
                if currentTicket.status == .listed {
                    FPStateBanner(
                        title: "Listed for resale",
                        message: "Cancel this listing before using the ticket for entry.",
                        kind: .warning
                    )
                    NavigationLink {
                        FanPassV4ListTicketView(
                            ticket: currentTicket,
                            isAuthenticated: backend.isAuthenticated
                        ) {
                            appViewModel.openPrivySignIn()
                        }
                    } label: {
                        HStack(spacing: FPSpacing.sm) {
                            Image(systemName: "slider.horizontal.3")
                            Text("Manage listing")
                        }
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.backgroundNight)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(FPColors.warningAmber, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                } else if currentTicket.status.allowsResale {
                    NavigationLink {
                        FanPassV4ListTicketView(
                            ticket: currentTicket,
                            isAuthenticated: backend.isAuthenticated
                        ) {
                            appViewModel.openPrivySignIn()
                        }
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
                        message: "\(currentTicket.status.title) tickets cannot be listed for resale.",
                        kind: .warning
                    )
                }

                FPSecondaryButton(title: "Open market chart", systemImage: "chart.xyaxis.line") {
                    appViewModel.openMarket(for: currentTicket.event)
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
        switch currentTicket.status {
        case .listed: "Listed ticket"
        case .redeemed: "Already entered"
        case .cancelled: "Cancelled ticket"
        case .refunded: "Refunded ticket"
        case .expired: "Expired ticket"
        case .transferred: "Transferred ticket"
        case .transferPending: "Transfer pending"
        case .active: "Verified Ticket"
        }
    }

    private var inactiveStateMessage: String {
        switch currentTicket.status {
        case .listed: "Cancel this listing to move the ticket back to Upcoming and restore the entry QR."
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
    @State private var renderedImage: UIImage?
    private static let context = CIContext()

    var body: some View {
        Group {
            if let renderedImage {
                Image(uiImage: renderedImage)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: FPIcons.qr)
                    .font(.system(size: 120, weight: .semibold))
                    .foregroundStyle(FPColors.textSecondary)
            }
        }
        .task(id: value) {
            renderedImage = Self.makeImage(value: value)
        }
    }

    private static func makeImage(value: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
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
