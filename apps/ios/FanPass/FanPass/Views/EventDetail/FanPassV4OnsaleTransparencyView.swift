import SwiftUI

enum FanPassOnsaleCheckoutGate: Equatable {
    case checking
    case direct
    case joinRequired
    case waiting(position: Int?)
    case admitted
    case completed
    case blocked
    case unavailable

    var allowsCheckout: Bool {
        self == .direct || self == .admitted
    }

    var buttonTitle: String {
        switch self {
        case .checking:
            "Checking sale access"
        case .direct, .admitted:
            "Buy Ticket"
        case .joinRequired:
            "Join queue above"
        case let .waiting(position):
            position.map { "Queue #\($0)" } ?? "Waiting room"
        case .completed:
            "Purchase limit reached"
        case .blocked:
            "Sale access unavailable"
        case .unavailable:
            "Sale status unavailable"
        }
    }
}

struct FanPassV4OnsaleTransparencyView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel

    let event: FanPassV4.Event
    @Binding var checkoutGate: FanPassOnsaleCheckoutGate
    @Binding var availableByTicketType: [String: Int]

    @State private var snapshot: FanPassOnsaleSnapshot?
    @State private var queueEntry: FanPassOnsaleQueueResponse.QueueEntry?
    @State private var errorMessage: String?
    @State private var joiningQueue = false

    var body: some View {
        Group {
            if event.isBackendBacked {
                FPSectionHeader(
                    title: "On-sale transparency",
                    subtitle: "Published allocation, live inventory, and queue flow"
                )
                FPSurfaceCard {
                    if let snapshot {
                        snapshotContent(snapshot)
                    } else if let errorMessage {
                        unavailableContent(errorMessage)
                    } else {
                        loadingContent
                    }
                }
            }
        }
        .task(id: refreshTaskKey) {
            await refreshLoop()
        }
    }

    private func snapshotContent(_ snapshot: FanPassOnsaleSnapshot) -> some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            HStack(spacing: FPSpacing.sm) {
                FPStatusPill(
                    title: phaseTitle(snapshot.phase),
                    systemImage: snapshot.queue.enabled ? "person.line.dotted.person.fill" : "ticket.fill",
                    foreground: snapshot.phase == "OPEN" ? FPColors.verifiedGreen : FPColors.warningAmber,
                    background: (snapshot.phase == "OPEN" ? FPColors.verifiedGreen : FPColors.warningAmber).opacity(0.12),
                    border: (snapshot.phase == "OPEN" ? FPColors.verifiedGreen : FPColors.warningAmber).opacity(0.55)
                )
                Spacer()
                Text("Updated \(updatedTime(snapshot.updatedAt))")
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
            }

            if let errorMessage {
                HStack(alignment: .top, spacing: FPSpacing.sm) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(FPColors.warningAmber)
                    Text(errorMessage)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
            }

            HStack(alignment: .top, spacing: FPSpacing.lg) {
                inventoryMetric("Available", value: snapshot.inventory.available, color: FPColors.verifiedGreen)
                inventoryMetric("Held", value: snapshot.inventory.held, color: FPColors.warningAmber)
                inventoryMetric("Sold", value: snapshot.inventory.sold, color: FPColors.textPrimary)
            }

            Divider().overlay(FPColors.borderDivider)

            VStack(alignment: .leading, spacing: FPSpacing.sm) {
                HStack {
                    Text("Allocation ledger")
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                    Spacer()
                    Text("\(snapshot.allocation.venueCapacity.formatted()) seats")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .monospacedDigit()
                }
                ForEach(snapshot.allocation.categories) { category in
                    HStack(spacing: FPSpacing.sm) {
                        Circle()
                            .fill(category.publicSale ? FPColors.pulseCyan : FPColors.textSecondary.opacity(0.55))
                            .frame(width: 7, height: 7)
                        Text(category.label)
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                        Spacer()
                        Text(category.quantity.formatted())
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textPrimary)
                            .monospacedDigit()
                    }
                }
            }

            if snapshot.queue.enabled {
                Divider().overlay(FPColors.borderDivider)
                queueContent(snapshot)
            }

            HStack(spacing: FPSpacing.sm) {
                Image(systemName: "checkmark.shield.fill")
                    .foregroundStyle(FPColors.pulseCyan)
                Text(snapshot.fairness.map { "Fairness commitment \($0.commitment.prefix(12))..." } ?? snapshot.allocation.policyVersion)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                    .lineLimit(1)
                Spacer()
                if snapshot.inventory.releasedHolds > 0 {
                    Text("\(snapshot.inventory.releasedHolds.formatted()) released")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .monospacedDigit()
                }
            }
        }
    }

    private func queueContent(_ snapshot: FanPassOnsaleSnapshot) -> some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            HStack {
                Text("Queue flow")
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                Spacer()
                if let limit = snapshot.queue.purchaseLimitPerAccount {
                    Text("Limit \(limit) per account")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                }
            }

            HStack(alignment: .top, spacing: FPSpacing.lg) {
                inventoryMetric("Waiting", value: snapshot.queue.waiting, color: FPColors.textPrimary)
                inventoryMetric("Locking", value: snapshot.queue.inCheckout, color: FPColors.warningAmber)
                inventoryMetric("Complete", value: snapshot.queue.completed, color: FPColors.verifiedGreen)
            }

            if let batch = snapshot.queue.currentBatch {
                HStack(spacing: FPSpacing.sm) {
                    Image(systemName: "arrow.right.circle.fill")
                        .foregroundStyle(FPColors.pulseCyan)
                    Text("Now admitting queue #\(batch.from)-#\(batch.to) into ticket lock")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            queueAccountStatus(snapshot)
        }
    }

    @ViewBuilder
    private func queueAccountStatus(_ snapshot: FanPassOnsaleSnapshot) -> some View {
        if let queueEntry {
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                HStack {
                    Text(queueEntry.position.map { "Your queue number #\($0)" } ?? "Waiting room joined")
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                    Spacer()
                    if let usersAhead = queueEntry.usersAhead {
                        Text("\(usersAhead.formatted()) ahead")
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                            .monospacedDigit()
                    }
                }
                Text(queueEntry.message)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if queueEntry.canCheckout, let checkoutExpiresAt = queueEntry.checkoutExpiresAt {
                    Text("Ticket lock window closes at \(updatedTime(checkoutExpiresAt))")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.warningAmber)
                }
                if queueEntry.status == "EXPIRED" {
                    joinButton
                }
            }
            .padding(FPSpacing.md)
            .background(FPColors.pulseCyan.opacity(0.08), in: RoundedRectangle(cornerRadius: FPRadius.sm, style: .continuous))
        } else if backend.isAuthenticated {
            joinButton
        } else {
            Button {
                appViewModel.openPrivySignIn()
            } label: {
                Label("Sign in to join the sale queue", systemImage: "person.crop.circle.badge.checkmark")
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(FPColors.pulseCyan.opacity(0.16), in: RoundedRectangle(cornerRadius: FPRadius.sm, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private var joinButton: some View {
        Button {
            Task { await joinQueue() }
        } label: {
            HStack(spacing: FPSpacing.sm) {
                if joiningQueue {
                    ProgressView()
                        .tint(FPColors.textPrimary)
                } else {
                    Image(systemName: "person.line.dotted.person.fill")
                }
                Text(joiningQueue ? "Joining queue" : "Join sale queue")
            }
            .font(FPTypography.headline)
            .foregroundStyle(FPColors.textPrimary)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(FPColors.pulseCyan.opacity(0.16), in: RoundedRectangle(cornerRadius: FPRadius.sm, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(joiningQueue)
    }

    private var loadingContent: some View {
        HStack(spacing: FPSpacing.md) {
            ProgressView()
                .tint(FPColors.pulseCyan)
            Text("Loading live allocation")
                .font(FPTypography.body)
                .foregroundStyle(FPColors.textSecondary)
        }
        .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
    }

    private func unavailableContent(_ message: String) -> some View {
        HStack(alignment: .top, spacing: FPSpacing.md) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(FPColors.warningAmber)
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text("Live sale status unavailable")
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                Text(message)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
    }

    private func inventoryMetric(_ title: String, value: Int, color: Color) -> some View {
        VStack(alignment: .leading, spacing: FPSpacing.xs) {
            Text(value.formatted())
                .font(FPTypography.title3)
                .foregroundStyle(color)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.72)
            Text(title)
                .font(FPTypography.caption)
                .foregroundStyle(FPColors.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var refreshTaskKey: String {
        "\(event.id):\(backend.isAuthenticated):\(backend.user.id)"
    }

    @MainActor
    private func refreshLoop() async {
        guard event.isBackendBacked else {
            checkoutGate = .direct
            return
        }
        while !Task.isCancelled {
            await refresh()
            let seconds = snapshot?.queue.enabled == true ? 5 : 15
            do {
                try await Task.sleep(nanoseconds: UInt64(seconds) * 1_000_000_000)
            } catch {
                return
            }
        }
    }

    @MainActor
    private func refresh() async {
        do {
            let publicSnapshot = try await backend.apiClient.onsaleSnapshot(eventId: event.id)
            if publicSnapshot.queue.enabled && backend.isAuthenticated {
                apply(try await backend.apiClient.onsaleQueueStatus(eventId: event.id))
            } else {
                apply(publicSnapshot, queueEntry: nil)
            }
            errorMessage = nil
        } catch {
            if snapshot == nil {
                checkoutGate = .unavailable
                errorMessage = error.localizedDescription
            }
        }
    }

    @MainActor
    private func joinQueue() async {
        guard backend.isAuthenticated else {
            appViewModel.openPrivySignIn()
            return
        }
        joiningQueue = true
        defer { joiningQueue = false }
        do {
            apply(try await backend.apiClient.joinOnsaleQueue(eventId: event.id))
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func apply(_ response: FanPassOnsaleQueueResponse) {
        apply(response.snapshot, queueEntry: response.queueEntry)
    }

    @MainActor
    private func apply(
        _ snapshot: FanPassOnsaleSnapshot,
        queueEntry: FanPassOnsaleQueueResponse.QueueEntry?
    ) {
        self.snapshot = snapshot
        self.queueEntry = queueEntry
        availableByTicketType = Dictionary(
            uniqueKeysWithValues: snapshot.inventory.ticketTypes.map {
                ($0.ticketTypeId, $0.available)
            }
        )

        if !snapshot.queue.enabled {
            checkoutGate = .direct
        } else if snapshot.phase == "PAUSED" || snapshot.phase == "CLOSED" {
            checkoutGate = .unavailable
        } else if !backend.isAuthenticated || queueEntry == nil {
            checkoutGate = .joinRequired
        } else if queueEntry?.canCheckout == true {
            checkoutGate = .admitted
        } else {
            switch queueEntry?.status {
            case "WAITING":
                checkoutGate = .waiting(position: queueEntry?.position)
            case "COMPLETED":
                checkoutGate = .completed
            case "BLOCKED":
                checkoutGate = .blocked
            case "EXPIRED":
                checkoutGate = .joinRequired
            default:
                checkoutGate = .checking
            }
        }
    }

    private func phaseTitle(_ phase: String) -> String {
        switch phase {
        case "OPEN": "Sale open"
        case "WAITING_ROOM": "Waiting room"
        case "PAUSED": "Sale paused"
        case "CLOSED": "Sale closed"
        case "DIRECT": "Direct sale"
        default: "Scheduled"
        }
    }

    private func updatedTime(_ value: String) -> String {
        guard let date = UserSession.parseExpiry(value) else {
            return "now"
        }
        return date.formatted(date: .omitted, time: .shortened)
    }
}
