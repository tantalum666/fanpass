import SwiftUI

struct FanPassV4FanAccessView: View {
    @State private var viewModel: FanAccessViewModel

    init(event: FanPassV4.Event = FanPassMockData.events[0]) {
        _viewModel = State(initialValue: FanAccessViewModel(event: event))
    }

    var body: some View {
        FanPassV4Scaffold(title: "Fan Access", subtitle: "Earn access through organizer-defined tasks.") {
            FPSurfaceCard(cornerRadius: FPRadius.xl) {
                VStack(alignment: .leading, spacing: FPSpacing.lg) {
                    FPSectionHeader(title: viewModel.event.title, subtitle: "Access progress")
                    ProgressView(value: viewModel.progress)
                        .tint(FPColors.pulseCyan)
                    HStack {
                        Text("\(viewModel.approvedPoints) pts earned")
                            .font(FPTypography.headline)
                            .foregroundStyle(FPColors.textPrimary)
                        Spacer()
                        Text("\(viewModel.totalPoints) pts available")
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                    }
                }
            }

            FPSectionHeader(title: "Tasks", subtitle: "Complete fan-friendly actions")
            if viewModel.tasks.isEmpty {
                FPEmptyStateView(title: "No active tasks", message: "Fan Access tasks will appear when the organizer opens them.", systemImage: FPIcons.fanAccess)
                    .frame(maxWidth: .infinity)
                    .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
            } else {
                ForEach(viewModel.tasks) { task in
                    FPSurfaceCard {
                        HStack(alignment: .top, spacing: FPSpacing.md) {
                            Image(systemName: task.status == .approved ? FPIcons.verified : FPIcons.fanAccess)
                                .font(.system(size: 24, weight: .semibold))
                                .foregroundStyle(task.status == .approved ? FPColors.verifiedGreen : FPColors.pulseCyan)
                                .frame(width: 34)
                            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                                Text(task.title)
                                    .font(FPTypography.headline)
                                    .foregroundStyle(FPColors.textPrimary)
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(task.description)
                                    .font(FPTypography.callout)
                                    .foregroundStyle(FPColors.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(task.verificationMethod)
                                    .font(FPTypography.caption)
                                    .foregroundStyle(FPColors.textTertiary)
                                if task.status == .available {
                                    FPTertiaryButton(title: "Complete task", systemImage: "checkmark.circle") {
                                        // Mock Fan Access task completion. Real proof submission is deferred.
                                        Task { await viewModel.completeTask(task) }
                                    }
                                }
                            }
                            Spacer(minLength: FPSpacing.sm)
                            VStack(alignment: .trailing, spacing: FPSpacing.xs) {
                                FPStatusPill(title: task.status.title, foreground: task.status == .approved ? FPColors.verifiedGreen : FPColors.pulseCyan, background: (task.status == .approved ? FPColors.verifiedGreen : FPColors.pulseCyan).opacity(0.12), border: (task.status == .approved ? FPColors.verifiedGreen : FPColors.pulseCyan).opacity(0.55))
                                Text("+\(task.points)")
                                    .font(FPTypography.monoNumber)
                                    .foregroundStyle(FPColors.textPrimary)
                            }
                        }
                    }
                }
            }

            if viewModel.lastCompletedTask != nil {
                FPStateBanner(title: "Fan Access task completed", message: "Your task moved into the completed state and is ready for organizer review.", kind: .success)
            }

            FPSectionHeader(title: "Rewards")
            FPAccessBadge(title: viewModel.badge.title, status: "Non-transferable Access Badge")
            if viewModel.badgeEarned {
                FPConfirmationCard(title: "Access Badge earned", message: "This non-transferable Access Badge can unlock organizer-defined benefits for the event.")
            }
            FPSurfaceCard {
                VStack(alignment: .leading, spacing: FPSpacing.sm) {
                    Text("Reward benefit")
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                    Text(viewModel.badge.benefit)
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                    FPProofHistoryRow(title: "Proof & History", subtitle: "Technical note: SBT-style non-transferable credential.", status: .success)
                }
            }
        }
    }
}

#Preview {
    FanPassV4FanAccessView()
}
