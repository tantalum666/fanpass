import SwiftUI

struct FanPassV4Scaffold<Content: View>: View {
    let title: String
    var subtitle: String?
    var verticalSpacing: CGFloat = FPSpacing.xl
    var topPadding: CGFloat = FPSpacing.xl
    var bottomPadding: CGFloat = FPSpacing.threeXL + 96
    var scrollDisabled = false
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: verticalSpacing) {
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text(title)
                        .font(FPTypography.largeTitle)
                        .foregroundStyle(FPColors.textPrimary)
                    if let subtitle {
                        Text(subtitle)
                            .font(FPTypography.callout)
                            .foregroundStyle(FPColors.textSecondary)
                    }
                }
                .padding(.top, topPadding)

                content
            }
            .padding(.horizontal, FPSpacing.lg)
            .padding(.bottom, bottomPadding)
        }
        .scrollDisabled(scrollDisabled)
        .background(FPColors.backgroundNight)
    }
}
