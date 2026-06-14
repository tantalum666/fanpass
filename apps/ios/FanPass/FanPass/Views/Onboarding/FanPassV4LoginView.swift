import SwiftUI

struct FanPassV4LoginView: View {
    let signIn: () -> Void
    var accountSignIn: () -> Void = {}

    var body: some View {
        ZStack {
            FPGradients.iconNight
                .ignoresSafeArea()

            VStack(spacing: FPSpacing.xl) {
                Spacer()

                Image("fanpass-mark-v4")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 92, height: 92)

                VStack(spacing: FPSpacing.sm) {
                    Text("Sign in to FanPass")
                        .font(FPTypography.largeTitle)
                        .foregroundStyle(FPColors.textPrimary)
                    Text("Browse stays separate from tickets, payments, and entry codes.")
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                }
                .multilineTextAlignment(.center)

                VStack(spacing: FPSpacing.md) {
                    FPPrimaryButton(title: "Browse events", systemImage: FPIcons.tickets, action: signIn)
                    FPSecondaryButton(title: "Sign in / Sign up", systemImage: "envelope.fill", action: accountSignIn)
                }

                FPSurfaceCard {
                    HStack(alignment: .top, spacing: FPSpacing.md) {
                        Image(systemName: FPIcons.verified)
                            .foregroundStyle(FPColors.verifiedGreen)
                        Text("Tickets, checkout, entry credentials, and saved account data require a signed-in session.")
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Spacer()
            }
            .padding(FPSpacing.xl)
        }
    }
}

#Preview {
    FanPassV4LoginView(signIn: {})
}

struct FanPassV4AuthRequiredSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let message: String
    var primaryTitle: String = "Sign in / Sign up"
    let signIn: () -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                FPColors.backgroundNight.ignoresSafeArea()
                VStack(spacing: FPSpacing.xl) {
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 48, weight: .semibold))
                        .foregroundStyle(FPGradients.passAurora)

                    VStack(spacing: FPSpacing.sm) {
                        Text(title)
                            .font(FPTypography.title2)
                            .foregroundStyle(FPColors.textPrimary)
                        Text(message)
                            .font(FPTypography.callout)
                            .foregroundStyle(FPColors.textSecondary)
                    }
                    .multilineTextAlignment(.center)

                    VStack(spacing: FPSpacing.md) {
                        FPPrimaryButton(title: primaryTitle, systemImage: "envelope.fill") {
                            signIn()
                            dismiss()
                        }
                        FPSecondaryButton(title: "Continue browsing", systemImage: FPIcons.home) {
                            dismiss()
                        }
                    }

                    FPSurfaceCard {
                        Text("Checkout, ticket ownership, and entry codes require a signed-in fan account.")
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(FPSpacing.xl)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
