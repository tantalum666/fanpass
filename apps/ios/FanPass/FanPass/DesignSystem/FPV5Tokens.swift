import SwiftUI

/// Semantic tokens for the V5 "Backstage Pass" visual direction.
///
/// V4 remains available to the screens that have not migrated yet. Keeping the
/// V5 tokens separate prevents a partial rollout from silently recoloring
/// transactional or staff-facing surfaces that have not received visual QA.
enum FPV5Colors {
    static let ink = Color(hex: 0x121214)
    static let softBlack = Color(hex: 0x1B1B1F)
    static let paper = Color(hex: 0xF7F3EA)
    static let warmWhite = Color(hex: 0xFFFDF8)
    static let signalRed = Color(hex: 0xD64032)
    static let cobalt = Color(hex: 0x2457C5)
    static let brass = Color(hex: 0xB8893A)
    static let verifiedGreen = Color(hex: 0x178C55)
    static let amber = Color(hex: 0xD9911E)
    static let slate = Color(hex: 0x6F737C)
    static let hairline = Color(hex: 0xDDD6C8)
    static let danger = Color(hex: 0xC7352D)

    static let darkHairline = warmWhite.opacity(0.16)
    static let darkSecondary = warmWhite.opacity(0.68)
    static let darkTertiary = warmWhite.opacity(0.48)
}

enum FPV5Typography {
    static let editorialDisplay = Font.system(size: 36, weight: .bold, design: .serif)
    static let editorialTitle = Font.system(size: 30, weight: .bold, design: .serif)
    static let pageTitle = Font.system(size: 28, weight: .bold, design: .default)
    static let sectionTitle = Font.system(size: 20, weight: .bold, design: .default)
    static let headline = Font.system(size: 17, weight: .semibold, design: .default)
    static let body = Font.system(size: 16, weight: .regular, design: .default)
    static let callout = Font.system(size: 15, weight: .regular, design: .default)
    static let caption = Font.system(size: 12, weight: .semibold, design: .default)
    static let metadata = Font.system(size: 13, weight: .medium, design: .default)
    static let tabular = Font.system(size: 16, weight: .semibold, design: .monospaced)
}

enum FPV5Metrics {
    static let pageHorizontal: CGFloat = 16
    static let compactCorner: CGFloat = 8
    static let cardCorner: CGFloat = 12
    static let sheetCorner: CGFloat = 16
    static let passCorner: CGFloat = 24
    static let minimumControlHeight: CGFloat = 44
}

