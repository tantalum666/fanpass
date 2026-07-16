import Foundation
import SwiftUI

struct FanPassV4FanAccessView: View {
    @Environment(FanPassBackendContext.self) private var backend
    @Environment(FanPassRootViewModel.self) private var appViewModel
    @State private var viewModel: FanAccessViewModel
    @State private var manualTask: FanTask?
    @State private var showsSelectionPolicy = false

    init(event: FanPassV4.Event) {
        _viewModel = State(initialValue: FanAccessViewModel(event: event))
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                if let campaign = viewModel.campaign {
                    FanAccessHero(event: viewModel.event, campaign: campaign)

                    VStack(alignment: .leading, spacing: FPSpacing.xl) {
                        FanAccessFactStrip(campaign: campaign)
                        qualificationSection(campaign: campaign)
                        progressSection(campaign: campaign)
                        primaryActions(campaign: campaign)
                        FanAccessFairnessPolicy()
                    }
                    .padding(.horizontal, FPSpacing.lg)
                    .padding(.top, FPSpacing.sm)
                    .padding(.bottom, FPSpacing.fourXL)
                } else if viewModel.isLoading {
                    ProgressView("Loading Fan Access")
                        .tint(FPColors.pulseCyan)
                        .foregroundStyle(FPColors.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: 360)
                } else {
                    unavailableState
                }
            }
        }
        .background(FPColors.backgroundNight.ignoresSafeArea())
        .navigationTitle("Fan Access")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FPColors.backgroundNight, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task(id: refreshKey) {
            await viewModel.load(
                apiClient: backend.apiClient,
                userID: backend.session?.userId
            )
        }
        .refreshable {
            await viewModel.load(
                apiClient: backend.apiClient,
                userID: backend.session?.userId
            )
        }
        .sheet(item: $manualTask) { task in
            FanAccessProofSheet(task: task) { proof in
                guard let userID = backend.session?.userId else {
                    return false
                }
                return await viewModel.submit(
                    task: task,
                    proof: proof,
                    apiClient: backend.apiClient,
                    userID: userID
                )
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showsSelectionPolicy) {
            FanAccessSelectionPolicySheet()
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
    }

    private var refreshKey: String {
        "\(viewModel.event.id):\(backend.session?.userId ?? "guest"):\(backend.remoteRefreshRevision)"
    }

    private func qualificationSection(campaign: FanCampaign) -> some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text("Ways to qualify")
                    .font(FPTypography.title2)
                    .foregroundStyle(FPColors.textPrimary)
                Text(campaign.description)
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(spacing: 0) {
                ForEach(Array(viewModel.tasks.enumerated()), id: \.element.id) { index, task in
                    FanAccessTaskRow(
                        task: task,
                        state: taskState(task),
                        action: { handle(task) }
                    )
                    if index < viewModel.tasks.count - 1 {
                        FPDivider()
                            .padding(.horizontal, FPSpacing.lg)
                    }
                }
            }
            .background(
                FPColors.surfaceGlass.opacity(0.58),
                in: RoundedRectangle(cornerRadius: FPRadius.xl, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: FPRadius.xl, style: .continuous)
                    .stroke(FPColors.borderDivider.opacity(0.78), lineWidth: 1)
            }
        }
    }

    private func progressSection(campaign: FanCampaign) -> some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text("Eligibility progress")
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                    Text(progressMessage)
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                }
                Spacer()
                Text("\(viewModel.approvedPoints)")
                    .font(.system(size: 25, weight: .semibold))
                    .foregroundStyle(FPColors.pulseCyan)
                    .monospacedDigit()
                Text("of \(campaign.qualificationPoints) points")
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textSecondary)
            }

            ProgressView(value: viewModel.progress)
                .tint(FPColors.pulseCyan)
                .scaleEffect(x: 1, y: 1.6, anchor: .center)

            HStack {
                Text("\(viewModel.approvedPoints)")
                    .foregroundStyle(FPColors.pulseCyan)
                Spacer()
                Text("\(campaign.qualificationPoints)")
                    .foregroundStyle(FPColors.textSecondary)
            }
            .font(FPTypography.caption)

            if let errorMessage = viewModel.errorMessage {
                FPStateBanner(
                    title: "Fan Access update failed",
                    message: errorMessage,
                    kind: .warning,
                    actionTitle: "Retry"
                ) {
                    Task {
                        await viewModel.load(
                            apiClient: backend.apiClient,
                            userID: backend.session?.userId
                        )
                    }
                }
            }
        }
    }

    private func primaryActions(campaign: FanCampaign) -> some View {
        VStack(spacing: FPSpacing.md) {
            Button {
                appViewModel.openTickets()
            } label: {
                HStack {
                    Spacer()
                    Text("View eligible tickets")
                        .font(FPTypography.bodyStrong)
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .foregroundStyle(FPColors.backgroundNight)
                .padding(.horizontal, FPSpacing.lg)
                .frame(minHeight: 54)
                .background(FPGradients.passAurora, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens your ticket wallet")

            Button {
                showsSelectionPolicy = true
            } label: {
                Label("How selection works", systemImage: "chevron.right")
                    .labelStyle(FanAccessTrailingIconLabelStyle())
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.pulseCyan)
            }
            .buttonStyle(.plain)

            Text(campaign.rewardDescription)
                .font(FPTypography.caption)
                .foregroundStyle(FPColors.textTertiary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
        }
    }

    private var unavailableState: some View {
        VStack(spacing: FPSpacing.lg) {
            Image(systemName: FPIcons.fanAccess)
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(FPColors.pulseCyan)
            Text("No Fan Access campaign")
                .font(FPTypography.title3)
                .foregroundStyle(FPColors.textPrimary)
            Text(viewModel.errorMessage ?? "The organizer has not opened a campaign for this event.")
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textSecondary)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task {
                    await viewModel.load(
                        apiClient: backend.apiClient,
                        userID: backend.session?.userId
                    )
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(FPColors.pulseCyan)
        }
        .padding(FPSpacing.threeXL)
        .frame(maxWidth: .infinity, minHeight: 420)
    }

    private var progressMessage: String {
        if viewModel.pointsToQualify == 0 {
            return "Qualified for this campaign"
        }
        return "\(viewModel.pointsToQualify) points to qualify"
    }

    private func taskState(_ task: FanTask) -> FanAccessTaskState {
        if viewModel.isCompleted(task) {
            return .completed
        }
        if viewModel.pendingTaskIDs.contains(task.id) {
            return .inReview
        }
        if task.optional == true {
            return .optional
        }
        return .available
    }

    private func handle(_ task: FanTask) {
        guard !viewModel.isCompleted(task) else { return }
        guard let userID = backend.session?.userId else {
            appViewModel.openPrivySignIn()
            return
        }

        if task.verificationMethod == "MANUAL" {
            manualTask = task
            return
        }
        if ["VIEW_TICKETS", "VIEW_ELIGIBLE_TICKETS"].contains(task.actionKind ?? "") {
            appViewModel.openTickets()
            return
        }
        Task {
            _ = await viewModel.submit(
                task: task,
                proof: nil,
                apiClient: backend.apiClient,
                userID: userID
            )
        }
    }
}

private struct FanAccessHero: View {
    let event: FanPassV4.Event
    let campaign: FanCampaign

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            FPEventPoster(
                title: event.title,
                gradient: event.heroGradient,
                coverAssetName: event.coverAssetName,
                height: 220,
                showsLabels: false
            )
            .overlay {
                LinearGradient(
                    colors: [Color.clear, FPColors.backgroundNight.opacity(0.94)],
                    startPoint: .center,
                    endPoint: .bottom
                )
            }

            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text(event.title)
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.pulseCyan)
                Text(campaign.rewardTitle)
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(FPColors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, FPSpacing.twoXL)
            .padding(.bottom, FPSpacing.lg)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct FanAccessFactStrip: View {
    let campaign: FanCampaign

    var body: some View {
        HStack(spacing: 0) {
            FanAccessFact(value: "\(campaign.rewardSupply)", label: "passes")
            divider
            FanAccessFact(value: "\(campaign.qualificationPoints)", label: "points")
            divider
            FanAccessFact(value: allocationLabel, label: "allocation")
            divider
            FanAccessFact(value: closeLabel, label: "closes")
        }
        .padding(.vertical, FPSpacing.md)
        .background(
            FPColors.surfaceGlass.opacity(0.62),
            in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous)
                .stroke(FPColors.borderDivider.opacity(0.82), lineWidth: 1)
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(FPColors.borderDivider)
            .frame(width: 1, height: 30)
    }

    private var allocationLabel: String {
        campaign.allocationMethod == "EQUAL_DRAW" ? "Equal draw" : "Guaranteed"
    }

    private var closeLabel: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: campaign.closesAt) else {
            return "Published"
        }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }
}

private struct FanAccessFact: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(FPColors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(FPColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}

private enum FanAccessTaskState: Equatable {
    case available
    case completed
    case inReview
    case optional

    var title: String {
        switch self {
        case .available: "Available now"
        case .completed: "Completed"
        case .inReview: "In review"
        case .optional: "Optional bonus"
        }
    }

    var color: Color {
        switch self {
        case .completed: FPColors.verifiedGreen
        case .available: FPColors.electricViolet
        case .inReview: FPColors.warningAmber
        case .optional: FPColors.neonMagenta
        }
    }
}

private struct FanAccessTaskRow: View {
    let task: FanTask
    let state: FanAccessTaskState
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FPSpacing.sm) {
                completionMark
                taskIcon
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text(task.title)
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(task.description ?? task.verificationLabel ?? "Verified by FanPass")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(state.title)
                        .font(FPTypography.caption)
                        .foregroundStyle(state.color)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(state.color.opacity(0.14), in: Capsule())
                }
                Spacer(minLength: FPSpacing.xs)
                VStack(alignment: .trailing, spacing: FPSpacing.xs) {
                    Text("+\(task.points)")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(state.color)
                        .monospacedDigit()
                    Text("points")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                    if state != .completed {
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(FPColors.textTertiary)
                    }
                }
            }
            .padding(.horizontal, FPSpacing.lg)
            .padding(.vertical, FPSpacing.md)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(state == .completed || state == .inReview)
    }

    private var completionMark: some View {
        Image(systemName: state == .completed ? "checkmark" : "circle")
            .font(.system(size: state == .completed ? 14 : 10, weight: .bold))
            .foregroundStyle(state == .completed ? FPColors.verifiedGreen : FPColors.textTertiary)
            .frame(width: 24, height: 24)
            .background(
                (state == .completed ? FPColors.verifiedGreen : FPColors.borderDivider)
                    .opacity(0.12),
                in: Circle()
            )
            .overlay {
                Circle()
                    .stroke(
                        state == .completed ? FPColors.verifiedGreen : FPColors.borderDivider,
                        lineWidth: 1.5
                    )
            }
    }

    private var taskIcon: some View {
        Image(systemName: iconName)
            .font(.system(size: 22, weight: .medium))
            .foregroundStyle(state.color)
            .frame(width: 42, height: 42)
            .background(state.color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            .overlay {
                RoundedRectangle(cornerRadius: 12)
                    .stroke(state.color.opacity(0.35), lineWidth: 1)
            }
    }

    private var iconName: String {
        switch task.taskType {
        case "FOLLOW": "person.crop.circle"
        case "TICKET_HOLD": "ticket"
        case "CHECK_IN": "calendar.badge.checkmark"
        case "PURCHASE_HISTORY": "bag.badge.checkmark"
        case "QUIZ": "questionmark.bubble"
        case "SHARE": "square.and.arrow.up"
        default: FPIcons.fanAccess
        }
    }
}

private struct FanAccessFairnessPolicy: View {
    var body: some View {
        VStack(spacing: FPSpacing.sm) {
            FPDivider()
            Text("One fan profile • one fair entry per campaign")
            .font(FPTypography.caption)
            .foregroundStyle(FPColors.textSecondary)
            .multilineTextAlignment(.center)
            Text("Review and appeal available")
                .font(FPTypography.caption)
                .foregroundStyle(FPColors.pulseCyan)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct FanAccessProofSheet: View {
    @Environment(\.dismiss) private var dismiss
    let task: FanTask
    let submit: (String) async -> Bool
    @State private var proof = ""
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(task.description ?? "Submit evidence for organizer review.")
                    TextField("Profile link or short evidence note", text: $proof, axis: .vertical)
                        .lineLimit(2 ... 4)
                } footer: {
                    Text("This task is worth \(task.points) points. The organizer can approve or reject it with an audited reason.")
                }
            }
            .navigationTitle(task.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Submitting…" : "Submit") {
                        Task {
                            saving = true
                            if await submit(proof.trimmingCharacters(in: .whitespacesAndNewlines)) {
                                dismiss()
                            }
                            saving = false
                        }
                    }
                    .disabled(saving || proof.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}

private struct FanAccessSelectionPolicySheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Label("Reach the published points threshold before the campaign closes.", systemImage: "checkmark.circle")
                Label("Every qualified fan receives the same draw probability.", systemImage: "dice")
                Label("Extra wallets do not add points, chances, or claims.", systemImage: "wallet.pass")
                Label("Flagged cases are reviewed privately and can be appealed.", systemImage: "person.badge.shield.checkmark")
            }
            .navigationTitle("How selection works")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct FanAccessTrailingIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: FPSpacing.sm) {
            configuration.title
            configuration.icon
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        FanPassV4FanAccessView(event: FanPassV4PreviewContent.event)
    }
}
#endif
