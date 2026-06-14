import SwiftUI

enum FPAnimation {
    static let instant = Animation.easeOut(duration: 0.10)
    static let fast = Animation.easeOut(duration: 0.18)
    static let base = Animation.easeInOut(duration: 0.24)
    static let calm = Animation.easeInOut(duration: 0.36)
    static let scanPulse = Animation.easeInOut(duration: 1.20).repeatForever(autoreverses: true)
}
