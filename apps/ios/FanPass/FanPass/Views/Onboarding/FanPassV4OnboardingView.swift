import SwiftUI

struct FanPassV4OnboardingView: View {
    var onGetStarted: () -> Void = {}
    @State private var selectedIndex = 0

    private let slides: [Slide] = [
        .init(title: "Verified Tickets", subtitle: "Every pass is checked in the background so fans can buy and enter with confidence.", icon: FPIcons.verified),
        .init(title: "Secure Resale", subtitle: "Organizer rules keep resale fair with clear caps, transfer limits, and transparent prices.", icon: FPIcons.resale),
        .init(title: "Rewards for Real Fans", subtitle: "Complete Fan Access tasks, earn Access Badges, and unlock better event experiences.", icon: FPIcons.fanAccess)
    ]

    var body: some View {
        ZStack {
            FPColors.backgroundNight
                .ignoresSafeArea()

            VStack(spacing: FPSpacing.xl) {
                Spacer(minLength: FPSpacing.xl)

                Image("fanpass-horizontal-lockup-v4")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 270)
                    .accessibilityLabel("FanPass")

                TabView(selection: $selectedIndex) {
                    ForEach(slides.indices, id: \.self) { index in
                        OnboardingSlideView(slide: slides[index])
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .frame(height: 390)

                FPPrimaryButton(title: "Get Started", systemImage: "arrow.right") {
                    onGetStarted()
                }

                Text("Secure ticket access with clear rules.")
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)

                Spacer(minLength: FPSpacing.lg)
            }
            .padding(FPSpacing.xl)
        }
    }

    private struct Slide {
        let title: String
        let subtitle: String
        let icon: String
    }

    private struct OnboardingSlideView: View {
        let slide: Slide

        var body: some View {
            FPGlassCard(cornerRadius: FPRadius.twoXL) {
                VStack(spacing: FPSpacing.xl) {
                    Image(systemName: slide.icon)
                        .font(.system(size: 56, weight: .semibold))
                        .foregroundStyle(FPGradients.passAurora)
                    Text(slide.title)
                        .font(FPTypography.largeTitle)
                        .foregroundStyle(FPColors.textPrimary)
                        .multilineTextAlignment(.center)
                    Text(slide.subtitle)
                        .font(FPTypography.body)
                        .foregroundStyle(FPColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, FPSpacing.xl)
            }
            .padding(.horizontal, FPSpacing.xs)
        }
    }
}

#Preview {
    FanPassV4OnboardingView()
}
