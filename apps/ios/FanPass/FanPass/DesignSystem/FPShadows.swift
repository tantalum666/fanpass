import SwiftUI

struct FPShadowStyle {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

enum FPShadows {
    static let none = FPShadowStyle(color: .clear, radius: 0, x: 0, y: 0)
    static let card = FPShadowStyle(color: .black.opacity(0.20), radius: 30, x: 0, y: 10)
    static let ticket = FPShadowStyle(color: .black.opacity(0.40), radius: 70, x: 0, y: 24)
    static let signal = FPShadowStyle(color: FPColors.pulseCyan.opacity(0.15), radius: 24, x: 0, y: 0)
    static let raised = FPShadowStyle(color: .black.opacity(0.25), radius: 30, x: 0, y: 10)
    static let floating = FPShadowStyle(color: .black.opacity(0.35), radius: 50, x: 0, y: 18)
    static let signalGlow = FPShadowStyle(color: FPColors.pulseCyan.opacity(0.18), radius: 28, x: 0, y: 0)
}

extension View {
    func fpShadow(_ style: FPShadowStyle) -> some View {
        shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
}
