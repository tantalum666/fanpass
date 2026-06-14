import SwiftUI

enum FPColors {
    static let backgroundNight = Color(hex: 0x020617)
    static let backgroundSubtle = Color(hex: 0x07152A)
    static let surfaceCard = Color(hex: 0x0B1224)
    static let surfaceGlass = Color(hex: 0x111827)
    static let surfaceOverlay = Color(hex: 0x111827, alpha: 0.85)

    static let electricViolet = Color(hex: 0x7C3AED)
    static let pulseCyan = Color(hex: 0x46E8FF)
    static let neonMagenta = Color(hex: 0xF43FDA)
    static let verifiedGreen = Color(hex: 0x22C55E)
    static let warningAmber = Color(hex: 0xF59E0B)
    static let dangerRed = Color(hex: 0xEF4444)

    static let textPrimary = Color(hex: 0xF8FAFC)
    static let textSecondary = Color(hex: 0xAAB4C5)
    static let textTertiary = Color(hex: 0x64748B)
    static let borderDivider = Color(hex: 0x23314A)

    static let lightBackground = Color(hex: 0xF7F8FB)
    static let lightSurface = Color.white
    static let lightTextPrimary = Color(hex: 0x101216)
    static let lightTextSecondary = Color(hex: 0x667085)
    static let lightBorder = Color(hex: 0xD7DCE5)
}

extension Color {
    init(hex: UInt32, alpha: Double = 1.0) {
        let red = Double((hex & 0xFF0000) >> 16) / 255.0
        let green = Double((hex & 0x00FF00) >> 8) / 255.0
        let blue = Double(hex & 0x0000FF) / 255.0
        self.init(.sRGB, red: red, green: green, blue: blue, opacity: alpha)
    }
}
