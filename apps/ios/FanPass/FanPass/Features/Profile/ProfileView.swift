import SwiftUI

struct ProfileView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        FanPassScreen {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Profile")
                        .font(.system(size: 34, weight: .black, design: .rounded))

                    if let session = appState.session {
                        accountCard(session)
                        walletCard(session)

                        Button(role: .destructive) {
                            appState.signOut()
                        } label: {
                            Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    } else {
                        AuthRequiredPanel(
                            title: "No account signed in",
                            message: "Sign in to manage tickets, orders, and rewards.",
                            actionTitle: "Sign in",
                            action: { _ = appState.requireAuth(.profile) }
                        )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 110)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private func accountCard(_ session: UserSession) -> some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(FanPassTheme.ink)
                        VStack(spacing: 3) {
                            RoundedRectangle(cornerRadius: 2, style: .continuous)
                                .fill(FanPassTheme.accent)
                                .frame(width: 20, height: 4)
                            RoundedRectangle(cornerRadius: 2, style: .continuous)
                                .fill(FanPassTheme.mint)
                                .frame(width: 20, height: 4)
                        }
                    }
                    .frame(width: 50, height: 38)

                    VStack(alignment: .leading, spacing: 5) {
                        Text(session.displayName)
                            .font(.title3.weight(.bold))
                        Text(session.email)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    StatusPill(text: "Fan", color: FanPassTheme.accent)
                }

                Divider()

                HStack(spacing: 10) {
                    StatusPill(text: "Verified entry", color: FanPassTheme.mint)
                    StatusPill(text: "Private wallet", color: FanPassTheme.accent)
                }
            }
        }
    }

    private func walletCard(_ session: UserSession) -> some View {
        SoftCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Wallet")
                    .font(.headline)
                Text(session.walletAddress ?? "Pending setup")
                    .font(.footnote.monospaced())
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

#Preview {
    let appState = AppState()
    appState.session = .demoFan

    return NavigationStack {
        ProfileView()
    }
    .environment(appState)
}
