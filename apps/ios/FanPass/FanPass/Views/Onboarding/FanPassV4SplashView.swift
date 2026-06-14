import SwiftUI

struct FanPassV4SplashView: View {
    let onFinished: () -> Void

    var body: some View {
        ZStack {
            FPGradients.iconNight
                .ignoresSafeArea()

            VStack(spacing: FPSpacing.xl) {
                Image("fanpass-mark-v4")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 118, height: 118)
                    .accessibilityLabel("FanPass")

                Text("Verified Access for Real Fans")
                    .font(FPTypography.title1)
                    .foregroundStyle(FPColors.textPrimary)
                    .multilineTextAlignment(.center)

                Text("Premium tickets. Fair resale. Fast entry.")
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textSecondary)
            }
            .padding(FPSpacing.twoXL)
        }
        .task {
            // Simulated splash timing for prototype only.
            try? await Task.sleep(nanoseconds: 900_000_000)
            onFinished()
        }
    }
}

#Preview {
    FanPassV4SplashView {}
}
