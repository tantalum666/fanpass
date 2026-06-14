import SwiftUI

enum FPGradients {
    static let passAurora = LinearGradient(
        colors: [FPColors.pulseCyan, FPColors.electricViolet, FPColors.neonMagenta],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let scanPulse = LinearGradient(
        colors: [FPColors.pulseCyan, FPColors.verifiedGreen],
        startPoint: .leading,
        endPoint: .trailing
    )

    static let resaleSignal = LinearGradient(
        colors: [FPColors.electricViolet, FPColors.neonMagenta, FPColors.warningAmber],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let iconNight = RadialGradient(
        colors: [Color(hex: 0x2E1065), FPColors.backgroundSubtle, FPColors.backgroundNight],
        center: .topLeading,
        startRadius: 80,
        endRadius: 620
    )

    static let glassEdge = LinearGradient(
        colors: [Color.white.opacity(0.2), FPColors.pulseCyan.opacity(0.18), FPColors.electricViolet.opacity(0.18)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
