import SwiftUI

struct FanAccessView: View {
    @Environment(AppState.self) private var appState
    @State private var events: [FanPassEvent] = []
    @State private var tasks: [FanTask] = []
    @State private var score: FanScore?
    @State private var statusMessage: String?
    @State private var loadingState: LoadingState = .loading

    var body: some View {
        FanPassScreen {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Access")
                        .font(.system(size: 34, weight: .black, design: .rounded))

                    scoreCard
                    tasksSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 110)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: appState.session?.userId) {
            await load()
        }
    }

    private var selectedEvent: FanPassEvent? {
        events.first
    }

    private var scoreCard: some View {
        SoftCard {
            HStack(alignment: .center, spacing: 16) {
                ZStack {
                    Circle()
                        .stroke(FanPassTheme.accent.opacity(0.16), lineWidth: 12)
                    Circle()
                        .trim(from: 0, to: CGFloat(scoreValue) / 100)
                        .stroke(FanPassTheme.accent, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text("\(scoreValue)")
                        .font(.title.bold())
                }
                .frame(width: 96, height: 96)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Fan score")
                        .font(.headline)
                    Text(scoreSubtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if let statusMessage {
                        Text(statusMessage)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(FanPassTheme.slate)
                    }
                }
                Spacer()
            }
        }
    }

    private var tasksSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading(title: "Tasks")

            if loadingState == .loading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 160)
            } else if tasks.isEmpty {
                AuthRequiredPanel(
                    title: "Tasks are unavailable",
                    message: "The local API is not returning fan access tasks.",
                    actionTitle: "Retry",
                    action: { Task { await load() } }
                )
            } else {
                ForEach(tasks) { task in
                    FanTaskRow(task: task) {
                        submit(task)
                    }
                }
            }
        }
    }

    private var scoreValue: Int {
        if let score {
            return score.score
        }
        return appState.session == nil ? 0 : 10
    }

    private var scoreSubtitle: String {
        if appState.session == nil {
            return "Sign in to earn priority access."
        }
        return score?.entitlementStatus == "ELIGIBLE" ? "Eligible for priority draw" : "Build score for priority access"
    }

    private func submit(_ task: FanTask) {
        guard appState.requireAuth(.fanAccess), let session = appState.session else {
            return
        }

        Task {
            do {
                let submission = try await appState.apiClient.submitFanTask(
                    taskId: task.id,
                    userId: session.userId,
                    proof: "ios-alpha-\(task.taskType.lowercased())"
                )
                statusMessage = "\(task.title): \(submission.status)"
                await load()
            } catch {
                statusMessage = "Task submission failed."
            }
        }
    }

    private func load() async {
        loadingState = .loading
        do {
            events = try await appState.apiClient.events()
            if let event = selectedEvent {
                tasks = try await appState.apiClient.fanTasks(eventId: event.id)
                if let session = appState.session {
                    score = try? await appState.apiClient.fanScore(eventId: event.id, userId: session.userId)
                } else {
                    score = nil
                }
            }
            loadingState = .loaded
        } catch {
            loadingState = .failed
        }
    }
}

private struct FanTaskRow: View {
    let task: FanTask
    let action: () -> Void

    var body: some View {
        SoftCard {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(FanPassTheme.accent)
                    .frame(width: 34, height: 34)
                    .background(FanPassTheme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 4) {
                    Text(task.title)
                        .font(.headline)
                    Text("+\(task.points) points · \(task.verificationMethod.lowercased())")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button("Start", action: action)
                    .buttonStyle(.bordered)
            }
        }
    }

    private var icon: String {
        switch task.taskType {
        case "QUIZ": "checkmark.seal"
        case "SHARE": "square.and.arrow.up"
        case "CHECK_IN": "mappin.and.ellipse"
        default: "star"
        }
    }
}
