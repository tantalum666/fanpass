import SwiftUI

struct FPPrimaryButton: View {
    let title: String
    var systemImage: String?
    var isLoading: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            buttonLabel
                .foregroundStyle(FPColors.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 52)
                .padding(.horizontal, FPSpacing.lg)
                .background(FPGradients.passAurora, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                        .stroke(Color.white.opacity(0.16), lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .fpShadow(FPShadows.card)
    }

    private var buttonLabel: some View {
        HStack(spacing: FPSpacing.sm) {
            if isLoading {
                ProgressView()
                    .tint(FPColors.textPrimary)
            } else if let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: 16, weight: .semibold))
            }
            Text(title)
                .font(FPTypography.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
        }
    }
}

struct FPSecondaryButton: View {
    let title: String
    var systemImage: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FPSpacing.sm) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 16, weight: .semibold))
                }
                Text(title)
                    .font(FPTypography.headline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
            .foregroundStyle(FPColors.textPrimary)
            .frame(maxWidth: .infinity, minHeight: 52)
            .padding(.horizontal, FPSpacing.lg)
            .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                    .stroke(FPColors.borderDivider, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

struct FPTertiaryButton: View {
    let title: String
    var systemImage: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FPSpacing.xs) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
            }
            .font(FPTypography.callout)
            .foregroundStyle(FPColors.pulseCyan)
            .padding(.vertical, FPSpacing.sm)
        }
        .buttonStyle(.plain)
    }
}

enum FPStateKind {
    case info
    case success
    case warning
    case danger
    case neutral

    var foreground: Color {
        switch self {
        case .info: FPColors.pulseCyan
        case .success: FPColors.verifiedGreen
        case .warning: FPColors.warningAmber
        case .danger: FPColors.dangerRed
        case .neutral: FPColors.textSecondary
        }
    }

    var icon: String {
        switch self {
        case .info: "info.circle.fill"
        case .success: FPIcons.verified
        case .warning: FPIcons.warning
        case .danger: FPIcons.error
        case .neutral: "circle.fill"
        }
    }
}

struct FPStateBanner: View {
    let title: String
    let message: String
    var kind: FPStateKind = .info
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.md) {
            HStack(alignment: .top, spacing: FPSpacing.md) {
                Image(systemName: kind.icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(kind.foreground)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text(title)
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(message)
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if let actionTitle, let action {
                        FPTertiaryButton(title: actionTitle, systemImage: "arrow.clockwise", action: action)
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }
}

struct FPConfirmationCard: View {
    let title: String
    let message: String
    var systemImage: String = FPIcons.verified

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.xl) {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                Image(systemName: systemImage)
                    .font(.system(size: 42, weight: .bold))
                    .foregroundStyle(FPColors.verifiedGreen)
                Text(title)
                    .font(FPTypography.title2)
                    .foregroundStyle(FPColors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(message)
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

struct FPPolicyNotice: View {
    let title: String
    let message: String
    var kind: FPStateKind = .info

    var body: some View {
        VStack(alignment: .leading, spacing: FPSpacing.sm) {
            FPStatusPill(
                title: title,
                systemImage: kind.icon,
                foreground: kind.foreground,
                background: kind.foreground.opacity(0.12),
                border: kind.foreground.opacity(0.6)
            )
            Text(message)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(FPSpacing.lg)
        .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }
}

struct FPGlassCard<Content: View>: View {
    var cornerRadius: CGFloat = FPRadius.lg
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(FPSpacing.lg)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .background(FPColors.surfaceOverlay, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(FPGradients.glassEdge, lineWidth: 1)
            }
            .fpShadow(FPShadows.card)
    }
}

struct FPSurfaceCard<Content: View>: View {
    var cornerRadius: CGFloat = FPRadius.lg
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(FPSpacing.lg)
            .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(FPColors.borderDivider, lineWidth: 1)
            }
    }
}

struct FPEventHeroCard: View {
    let title: String
    let subtitle: String
    let metadata: String
    var status: String
    var gradient: FanPassV4.HeroGradient?
    var coverAssetName: String?
    var compact: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            FPEventPoster(
                title: title,
                eyebrow: status,
                gradient: gradient,
                coverAssetName: coverAssetName,
                height: compact ? 132 : 188
            )

            VStack(alignment: .leading, spacing: FPSpacing.md) {
                HStack(alignment: .top, spacing: FPSpacing.md) {
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        Text(title)
                            .font(compact ? FPTypography.title3 : FPTypography.title1)
                            .foregroundStyle(FPColors.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(subtitle)
                            .font(FPTypography.callout)
                            .foregroundStyle(FPColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: FPSpacing.sm)
                    FPStatusPill(
                        title: status,
                        systemImage: FPIcons.verified,
                        foreground: FPColors.pulseCyan,
                        background: FPColors.pulseCyan.opacity(0.12),
                        border: FPColors.pulseCyan.opacity(0.75)
                    )
                }
                Text(metadata)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textTertiary)
                    .monospacedDigit()
            }
            .padding(FPSpacing.lg)
        }
        .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.xl, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.xl, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
        .fpShadow(FPShadows.card)
        .clipShape(RoundedRectangle(cornerRadius: FPRadius.xl, style: .continuous))
    }
}

struct FPEventPoster: View {
    let title: String
    var eyebrow: String?
    var gradient: FanPassV4.HeroGradient?
    var coverAssetName: String?
    var height: CGFloat = 152

    private var startColor: Color {
        Color(hex: UInt32(gradient?.startHex ?? 0x46E8FF))
    }

    private var endColor: Color {
        Color(hex: UInt32(gradient?.endHex ?? 0x7C3AED))
    }

    private var accentColor: Color {
        Color(hex: UInt32(gradient?.accentHex ?? 0xF43FDA))
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let coverImage {
                Image(uiImage: coverImage)
                    .resizable()
                    .scaledToFill()
                    .overlay {
                        LinearGradient(
                            colors: [
                                Color.black.opacity(0.08),
                                Color.black.opacity(0.32),
                                Color.black.opacity(0.78)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    }
                    .overlay {
                        LinearGradient(
                            colors: [
                                startColor.opacity(0.18),
                                endColor.opacity(0.10),
                                Color.clear
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    }
            } else {
                LinearGradient(
                    colors: [
                        startColor.opacity(0.88),
                        endColor.opacity(0.84),
                        FPColors.backgroundNight
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .overlay(alignment: .topTrailing) {
                    Circle()
                        .fill(accentColor.opacity(0.46))
                        .frame(width: height * 0.72, height: height * 0.72)
                        .blur(radius: 14)
                        .offset(x: height * 0.14, y: -height * 0.22)
                }
                .overlay(alignment: .bottomTrailing) {
                    VStack(spacing: -8) {
                        ForEach(0..<4) { index in
                            RoundedRectangle(cornerRadius: 4, style: .continuous)
                                .fill(Color.white.opacity(0.28 - Double(index) * 0.04))
                                .frame(width: height * 0.42, height: 7)
                                .rotationEffect(.degrees(Double(index) * -7))
                        }
                    }
                    .padding(FPSpacing.lg)
                }
            }

            VStack(alignment: .leading, spacing: FPSpacing.sm) {
                if let eyebrow {
                    FPStatusPill(
                        title: eyebrow,
                        foreground: FPColors.textPrimary,
                        background: Color.black.opacity(0.28),
                        border: Color.white.opacity(0.22)
                    )
                }
                Text(title)
                    .font(FPTypography.title2)
                    .foregroundStyle(FPColors.textPrimary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.76)
                Text(gradient?.label.uppercased() ?? "FANPASS")
                    .font(FPTypography.caption)
                    .foregroundStyle(Color.white.opacity(0.72))
                    .tracking(1.2)
            }
            .padding(FPSpacing.lg)
        }
        .frame(maxWidth: .infinity, minHeight: height, maxHeight: height)
        .clipped()
        .accessibilityLabel("Event poster for \(title)")
    }

    private var coverImage: UIImage? {
        guard let coverAssetName else { return nil }
        if let image = UIImage(named: coverAssetName) {
            return image
        }
        guard let url = Bundle.main.url(forResource: coverAssetName, withExtension: "png"),
              let data = try? Data(contentsOf: url)
        else {
            return nil
        }
        return UIImage(data: data)
    }
}

struct FPEditorialEventRow: View {
    let event: FanPassV4.Event
    var trailingValue: String
    var subtitle: String?

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.md) {
            HStack(alignment: .top, spacing: FPSpacing.md) {
                FPEventPoster(
                    title: event.heroGradient.label,
                    eyebrow: event.category.title,
                    gradient: event.heroGradient,
                    coverAssetName: event.coverAssetName,
                    height: 82
                )
                .frame(width: 82)
                .clipShape(RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))

                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text(event.title)
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                        .lineLimit(2)
                    Text(subtitle ?? "\(event.venue.name) • \(event.dateLine)")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .lineLimit(2)
                    HStack(spacing: FPSpacing.xs) {
                        FPStatusPill(
                            title: event.status.title,
                            foreground: FPColors.pulseCyan,
                            background: FPColors.pulseCyan.opacity(0.12),
                            border: FPColors.pulseCyan.opacity(0.5)
                        )
                        if event.fanAccessAvailable {
                            FPStatusPill(
                                title: "Fan Access",
                                foreground: FPColors.verifiedGreen,
                                background: FPColors.verifiedGreen.opacity(0.12),
                                border: FPColors.verifiedGreen.opacity(0.5)
                            )
                        }
                    }
                }
                Spacer(minLength: FPSpacing.sm)
                Text(trailingValue)
                    .font(FPTypography.monoNumber)
                    .foregroundStyle(FPColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
        }
    }
}

struct FPTicketCard: View {
    let eventTitle: String
    let metadata: String
    let section: String
    let row: String
    let seat: String
    let ticketId: String
    var statusTitle: String = "Verified Ticket"
    var nfcReady: Bool = true
    var entryModeTitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ticketPoster

            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                ticketHeader

                FPDivider(color: FPColors.borderDivider.opacity(0.8))

                HStack(spacing: FPSpacing.lg) {
                    ticketMetric("SECTION", section)
                    ticketMetric("ROW", row)
                    ticketMetric("SEAT", seat)
                }

                HStack(alignment: .center, spacing: FPSpacing.md) {
                    FPProofHistoryRow(title: "Proof & History", subtitle: "Verifiable ownership and resale rules.", status: .success)
                }

                Text("Ticket ID: \(ticketId)  •  Resale allowed under organizer rules")
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.82)
            }
            .padding(FPSpacing.xl)
        }
        .background(FPColors.surfaceGlass, in: FPTicketStubShape(cornerRadius: FPRadius.xl, notchRadius: 18))
        .overlay {
            FPTicketStubShape(cornerRadius: FPRadius.xl, notchRadius: 18)
                .stroke(FPGradients.passAurora, lineWidth: 2)
        }
        .fpShadow(FPShadows.ticket)
    }

    private var ticketPoster: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [FPColors.electricViolet.opacity(0.92), FPColors.pulseCyan.opacity(0.54), FPColors.backgroundNight],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .overlay(alignment: .topTrailing) {
                Image(systemName: FPIcons.tickets)
                    .font(.system(size: 74, weight: .heavy))
                    .foregroundStyle(Color.white.opacity(0.16))
                    .padding(FPSpacing.lg)
            }
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text("FANPASS")
                    .font(FPTypography.caption)
                    .foregroundStyle(Color.white.opacity(0.72))
                    .tracking(1.4)
                Text(eventTitle)
                    .font(FPTypography.title2)
                    .foregroundStyle(FPColors.textPrimary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.78)
            }
            .padding(FPSpacing.xl)
        }
        .frame(maxWidth: .infinity, minHeight: 118, maxHeight: 118)
        .clipShape(FPTicketStubShape(cornerRadius: FPRadius.xl, notchRadius: 18))
    }

    private var ticketHeader: some View {
        VStack(alignment: .leading, spacing: FPSpacing.md) {
            Text(metadata)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textSecondary)
                .lineLimit(2)
            HStack(spacing: FPSpacing.sm) {
                FPVerifiedBadge(title: statusTitle)
                if nfcReady {
                    FPStatusPill(
                        title: "NFC Ready",
                        systemImage: FPIcons.nfc,
                        foreground: Color(hex: 0xD8C8FF),
                        background: FPColors.electricViolet.opacity(0.22),
                        border: FPColors.electricViolet
                    )
                } else if let entryModeTitle {
                    FPStatusPill(
                        title: entryModeTitle,
                        systemImage: entryModeTitle == "QR Only" ? FPIcons.qr : FPIcons.warning,
                        foreground: entryModeTitle == "QR Only" ? FPColors.pulseCyan : FPColors.warningAmber,
                        background: (entryModeTitle == "QR Only" ? FPColors.pulseCyan : FPColors.warningAmber).opacity(0.12),
                        border: (entryModeTitle == "QR Only" ? FPColors.pulseCyan : FPColors.warningAmber).opacity(0.55)
                    )
                }
            }
        }
    }

    private func ticketMetric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: FPSpacing.xs) {
            Text(label)
                .font(FPTypography.caption)
                .foregroundStyle(FPColors.textSecondary)
            Text(value)
                .font(FPTypography.title2)
                .foregroundStyle(FPColors.textPrimary)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct FPStatusPill: View {
    let title: String
    var systemImage: String?
    var foreground: Color = FPColors.textPrimary
    var background: Color = FPColors.surfaceGlass
    var border: Color = FPColors.borderDivider

    var body: some View {
        HStack(spacing: FPSpacing.xs) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: 11, weight: .bold))
            }
            Text(title)
                .font(FPTypography.caption)
                .lineLimit(1)
        }
        .foregroundStyle(foreground)
        .padding(.horizontal, FPSpacing.sm)
        .padding(.vertical, FPSpacing.xs)
        .background(background, in: Capsule())
        .overlay { Capsule().stroke(border, lineWidth: 1) }
    }
}

struct FPVerifiedBadge: View {
    var title: String = "Verified"

    var body: some View {
        FPStatusPill(
            title: title,
            systemImage: FPIcons.verified,
            foreground: FPColors.pulseCyan,
            background: Color(hex: 0x063746),
            border: FPColors.pulseCyan
        )
    }
}

struct FPAccessBadge: View {
    let title: String
    let status: String

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.md) {
            HStack(spacing: FPSpacing.md) {
                Image(systemName: FPIcons.fanAccess)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(FPGradients.passAurora)
                VStack(alignment: .leading, spacing: FPSpacing.xs) {
                    Text(title)
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                    Text(status)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                }
                Spacer()
            }
        }
    }
}

struct FPMetricCard: View {
    let title: String
    let value: String
    var caption: String?
    var trend: String?
    var accent: Color = FPColors.pulseCyan

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.md) {
            VStack(alignment: .leading, spacing: FPSpacing.md) {
                HStack {
                    Text(title)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                    Spacer()
                    if let trend {
                        FPPriceChangePill(value: trend, isPositive: !trend.hasPrefix("-"))
                    }
                }
                Text(value)
                    .font(FPTypography.title2)
                    .foregroundStyle(FPColors.textPrimary)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                if let caption {
                    Text(caption)
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textTertiary)
                        .lineLimit(2)
                }
            }
        }
    }
}

struct FPPriceChangePill: View {
    let value: String
    var isPositive: Bool

    var body: some View {
        FPStatusPill(
            title: value,
            systemImage: isPositive ? "arrow.up.right" : "arrow.down.right",
            foreground: isPositive ? FPColors.verifiedGreen : FPColors.warningAmber,
            background: (isPositive ? FPColors.verifiedGreen : FPColors.warningAmber).opacity(0.14),
            border: (isPositive ? FPColors.verifiedGreen : FPColors.warningAmber).opacity(0.5)
        )
    }
}

struct FPSectionHeader: View {
    let title: String
    var subtitle: String?
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: FPSpacing.md) {
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text(title)
                    .font(FPTypography.title3)
                    .foregroundStyle(FPColors.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(FPTypography.callout)
                        .foregroundStyle(FPColors.textSecondary)
                }
            }
            Spacer(minLength: FPSpacing.md)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.pulseCyan)
            }
        }
    }
}

struct FPDivider: View {
    var color: Color = FPColors.borderDivider

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(height: 1)
            .opacity(0.8)
    }
}

struct FPNFCIndicator: View {
    var title: String = "NFC Ready"
    var compact: Bool = false

    var body: some View {
        HStack(spacing: FPSpacing.sm) {
            FPNFCWaveView(color: FPColors.pulseCyan, lineWidth: 2)
                .frame(width: compact ? 22 : 30, height: compact ? 22 : 30)
                .opacity(0.95)
            Text(title)
                .font(compact ? FPTypography.caption : FPTypography.callout)
                .foregroundStyle(FPColors.textPrimary)
        }
        .padding(.horizontal, compact ? FPSpacing.sm : FPSpacing.md)
        .padding(.vertical, compact ? FPSpacing.xs : FPSpacing.sm)
        .background(FPColors.electricViolet.opacity(0.18), in: Capsule())
        .overlay { Capsule().stroke(FPColors.electricViolet.opacity(0.8), lineWidth: 1) }
    }
}

struct FPMarketChartPlaceholder: View {
    let title: String
    let price: String

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.lg) {
            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        Text(title)
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                        Text(price)
                            .font(FPTypography.title1)
                            .foregroundStyle(FPColors.textPrimary)
                            .monospacedDigit()
                    }
                    Spacer()
                    FPStatusPill(title: "Transparent Prices", foreground: FPColors.pulseCyan, background: FPColors.pulseCyan.opacity(0.12), border: FPColors.pulseCyan.opacity(0.6))
                }
                ChartLine()
                    .stroke(FPColors.neonMagenta, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                    .frame(height: 76)
                    .padding(.horizontal, FPSpacing.xs)
                    .accessibilityHidden(true)
            }
        }
    }

    private struct ChartLine: Shape {
        func path(in rect: CGRect) -> Path {
            var path = Path()
            path.move(to: CGPoint(x: rect.minX, y: rect.maxY * 0.72))
            path.addCurve(
                to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.24),
                control1: CGPoint(x: rect.minX + rect.width * 0.28, y: rect.maxY * 0.42),
                control2: CGPoint(x: rect.minX + rect.width * 0.62, y: rect.maxY * 0.85)
            )
            return path
        }
    }
}

struct FPOrderbookRow: View {
    let label: String
    let price: String
    let quantity: String
    var accent: Color = FPColors.pulseCyan

    var body: some View {
        HStack {
            Text(label)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textPrimary)
            Spacer()
            Text(quantity)
                .font(FPTypography.monoNumber)
                .foregroundStyle(FPColors.textSecondary)
            Text(price)
                .font(FPTypography.monoNumber)
                .foregroundStyle(accent)
        }
        .padding(.vertical, FPSpacing.sm)
    }
}

struct FPEmptyStateView: View {
    let title: String
    let message: String
    var systemImage: String = FPIcons.empty

    var body: some View {
        VStack(spacing: FPSpacing.md) {
            Image(systemName: systemImage)
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(FPColors.textSecondary)
            Text(title)
                .font(FPTypography.title3)
                .foregroundStyle(FPColors.textPrimary)
            Text(message)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(FPSpacing.twoXL)
    }
}

struct FPErrorStateView: View {
    let title: String
    let message: String
    var retryTitle: String = "Try again"
    var retry: (() -> Void)?

    var body: some View {
        VStack(spacing: FPSpacing.md) {
            Image(systemName: FPIcons.error)
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(FPColors.dangerRed)
            Text(title)
                .font(FPTypography.title3)
                .foregroundStyle(FPColors.textPrimary)
            Text(message)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textSecondary)
                .multilineTextAlignment(.center)
            if let retry {
                FPSecondaryButton(title: retryTitle, systemImage: "arrow.clockwise", action: retry)
            }
        }
        .padding(FPSpacing.twoXL)
    }
}

struct FPLoadingView: View {
    var title: String = "Loading"

    var body: some View {
        VStack(spacing: FPSpacing.md) {
            ProgressView()
                .tint(FPColors.pulseCyan)
            Text(title)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textSecondary)
        }
        .padding(FPSpacing.twoXL)
    }
}

struct FPTabItem: Identifiable, Hashable {
    let id: String
    let title: String
    let systemImage: String
}

struct FPBottomTabBar: View {
    let items: [FPTabItem]
    @Binding var selectedID: String

    var body: some View {
        HStack(spacing: FPSpacing.xs) {
            ForEach(items) { item in
                Button {
                    selectedID = item.id
                } label: {
                    VStack(spacing: FPSpacing.xs) {
                        Image(systemName: item.systemImage)
                            .font(.system(size: 18, weight: .semibold))
                        Text(item.title)
                            .font(FPTypography.caption)
                    }
                    .foregroundStyle(selectedID == item.id ? FPColors.pulseCyan : FPColors.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, FPSpacing.sm)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, FPSpacing.sm)
        .padding(.top, FPSpacing.sm)
        .background(FPColors.surfaceCard.opacity(0.96))
        .overlay(alignment: .top) { FPDivider(color: FPColors.borderDivider) }
    }
}

struct FPProofHistoryRow: View {
    let title: String
    let subtitle: String
    var status: FanPassV4.ProofStatus = .success

    var body: some View {
        HStack(spacing: FPSpacing.md) {
            Image(systemName: FPIcons.proof)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(statusColor)
                .frame(width: 34, height: 34)
                .background(statusColor.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text(title)
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                Text(subtitle)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
        }
        .padding(FPSpacing.md)
        .background(FPColors.backgroundNight, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }

    private var statusColor: Color {
        switch status {
        case .success: FPColors.verifiedGreen
        case .pending: FPColors.warningAmber
        case .failed: FPColors.dangerRed
        }
    }
}

struct FPNFCWaveView: View {
    var color: Color = FPColors.pulseCyan
    var lineWidth: CGFloat = 2

    var body: some View {
        ZStack {
            ForEach(0..<3) { index in
                FPNFCArcShape(inset: CGFloat(index) * 9)
                    .stroke(
                        index == 0 ? FPColors.textPrimary : color.opacity(1 - Double(index) * 0.22),
                        style: StrokeStyle(lineWidth: lineWidth + CGFloat(2 - index), lineCap: .round, lineJoin: .round)
                    )
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }
}

private struct FPNFCArcShape: Shape {
    let inset: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let side = min(rect.width, rect.height)
        let radius = max(6, side / 2 - inset - 8)
        let center = CGPoint(x: rect.minX + side * 0.22, y: rect.midY)
        path.addArc(center: center, radius: radius, startAngle: .degrees(-52), endAngle: .degrees(52), clockwise: false)
        return path
    }
}

struct FPTicketStubShape: Shape {
    var cornerRadius: CGFloat = FPRadius.lg
    var notchRadius: CGFloat = 14

    func path(in rect: CGRect) -> Path {
        let radius = min(cornerRadius, min(rect.width, rect.height) / 4)
        let notch = min(notchRadius, rect.height / 5)
        let midY = rect.midY

        var path = Path()
        path.move(to: CGPoint(x: rect.minX + radius, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - radius, y: rect.minY))
        path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + radius), control: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: midY - notch))
        path.addArc(center: CGPoint(x: rect.maxX, y: midY), radius: notch, startAngle: .degrees(-90), endAngle: .degrees(90), clockwise: true)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - radius))
        path.addQuadCurve(to: CGPoint(x: rect.maxX - radius, y: rect.maxY), control: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX + radius, y: rect.maxY))
        path.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY - radius), control: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: midY + notch))
        path.addArc(center: CGPoint(x: rect.minX, y: midY), radius: notch, startAngle: .degrees(90), endAngle: .degrees(-90), clockwise: true)
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + radius))
        path.addQuadCurve(to: CGPoint(x: rect.minX + radius, y: rect.minY), control: CGPoint(x: rect.minX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

struct FPConceptRow: Identifiable, Hashable {
    let id: String
    var icon: String
    var title: String
    var subtitle: String
    var value: String?
    var kind: FPStateKind

    init(
        id: String,
        icon: String,
        title: String,
        subtitle: String,
        value: String? = nil,
        kind: FPStateKind = .neutral
    ) {
        self.id = id
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.kind = kind
    }
}

struct FPConceptAction: Identifiable, Hashable {
    let id: String
    var title: String
    var systemImage: String
    var subtitle: String
    var kind: FPStateKind

    init(id: String, title: String, systemImage: String, subtitle: String, kind: FPStateKind = .info) {
        self.id = id
        self.title = title
        self.systemImage = systemImage
        self.subtitle = subtitle
        self.kind = kind
    }
}

struct FPConceptSegmentedControl<Option: Hashable>: View {
    let options: [Option]
    @Binding var selection: Option
    let title: (Option) -> String

    var body: some View {
        LazyVGrid(columns: gridColumns, spacing: FPSpacing.sm) {
            ForEach(options, id: \.self) { option in
                Button {
                    selection = option
                } label: {
                    Text(title(option))
                        .font(FPTypography.caption.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                        .frame(maxWidth: .infinity, minHeight: 28)
                        .foregroundStyle(selection == option ? FPColors.backgroundNight : FPColors.textSecondary)
                        .padding(.horizontal, FPSpacing.xs)
                        .background(
                            selection == option ? FPColors.pulseCyan : FPColors.surfaceGlass,
                            in: Capsule()
                        )
                        .overlay {
                            Capsule()
                                .stroke(selection == option ? FPColors.pulseCyan : FPColors.borderDivider, lineWidth: 1)
                        }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var gridColumns: [GridItem] {
        let count = min(max(options.count, 2), 4)
        return Array(repeating: GridItem(.flexible(minimum: 64), spacing: FPSpacing.sm), count: count)
    }
}

struct FPConceptRowView: View {
    let row: FPConceptRow

    var body: some View {
        HStack(alignment: .top, spacing: FPSpacing.md) {
            Image(systemName: row.icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(row.kind.foreground)
                .frame(width: 34, height: 34)
                .background(row.kind.foreground.opacity(0.12), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
            VStack(alignment: .leading, spacing: FPSpacing.xs) {
                Text(row.title)
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(row.subtitle)
                    .font(FPTypography.caption)
                    .foregroundStyle(FPColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: FPSpacing.sm)
            if let value = row.value {
                Text(value)
                    .font(FPTypography.monoNumber)
                    .foregroundStyle(row.kind.foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
        }
        .padding(FPSpacing.md)
        .background(FPColors.backgroundSubtle, in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }
}

struct FPConceptRowList: View {
    let rows: [FPConceptRow]

    var body: some View {
        VStack(spacing: FPSpacing.sm) {
            ForEach(rows) { row in
                FPConceptRowView(row: row)
            }
        }
    }
}

struct FPConceptActionGrid: View {
    let actions: [FPConceptAction]
    var columns: [GridItem] = [GridItem(.adaptive(minimum: 146), spacing: FPSpacing.md)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: FPSpacing.md) {
            ForEach(actions) { action in
                FPSurfaceCard(cornerRadius: FPRadius.md) {
                    VStack(alignment: .leading, spacing: FPSpacing.md) {
                        Image(systemName: action.systemImage)
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(action.kind.foreground)
                            .frame(width: 34, height: 34)
                            .background(action.kind.foreground.opacity(0.12), in: RoundedRectangle(cornerRadius: FPRadius.md, style: .continuous))
                        VStack(alignment: .leading, spacing: FPSpacing.xs) {
                            Text(action.title)
                                .font(FPTypography.headline)
                                .foregroundStyle(FPColors.textPrimary)
                            Text(action.subtitle)
                                .font(FPTypography.caption)
                                .foregroundStyle(FPColors.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

struct FPConceptStatStrip: View {
    let stats: [(String, String, String?)]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 142), spacing: FPSpacing.md)], spacing: FPSpacing.md) {
            ForEach(Array(stats.enumerated()), id: \.offset) { _, stat in
                FPMetricCard(title: stat.0, value: stat.1, caption: stat.2)
            }
        }
    }
}

struct FPConceptMapCard: View {
    var title: String
    var subtitle: String
    var pins: [String]

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.lg) {
            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                FPSectionHeader(title: title, subtitle: subtitle)
                ZStack {
                    RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous)
                        .fill(LinearGradient(colors: [FPColors.backgroundSubtle, FPColors.surfaceGlass], startPoint: .topLeading, endPoint: .bottomTrailing))
                    ForEach(Array(pins.enumerated()), id: \.offset) { index, pin in
                        VStack(spacing: FPSpacing.xs) {
                            Image(systemName: "mappin.circle.fill")
                                .font(.system(size: 22, weight: .bold))
                                .foregroundStyle(index == 0 ? FPColors.pulseCyan : FPColors.warningAmber)
                            Text(pin)
                                .font(FPTypography.caption)
                                .foregroundStyle(FPColors.textPrimary)
                                .padding(.horizontal, FPSpacing.xs)
                                .background(FPColors.backgroundNight.opacity(0.72), in: Capsule())
                        }
                        .position(position(for: index))
                    }
                    VStack {
                        HStack {
                            FPStatusPill(title: "List + map", systemImage: "map.fill", foreground: FPColors.pulseCyan, background: FPColors.pulseCyan.opacity(0.12), border: FPColors.pulseCyan.opacity(0.5))
                            Spacer()
                        }
                        Spacer()
                    }
                    .padding(FPSpacing.md)
                }
                .frame(height: 210)
                .accessibilityLabel("Map with pins: \(pins.joined(separator: ", "))")
            }
        }
    }

    private func position(for index: Int) -> CGPoint {
        let positions = [
            CGPoint(x: 88, y: 72),
            CGPoint(x: 226, y: 112),
            CGPoint(x: 150, y: 162),
            CGPoint(x: 286, y: 58)
        ]
        return positions[index % positions.count]
    }
}

struct FPConceptProgressBar: View {
    var title: String
    var value: Double
    var caption: String
    var accent: Color = FPColors.pulseCyan

    var body: some View {
        VStack(alignment: .leading, spacing: FPSpacing.sm) {
            HStack {
                Text(title)
                    .font(FPTypography.headline)
                    .foregroundStyle(FPColors.textPrimary)
                Spacer()
                Text(value.formatted(.percent.precision(.fractionLength(0))))
                    .font(FPTypography.monoNumber)
                    .foregroundStyle(accent)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(FPColors.surfaceGlass)
                    Capsule().fill(accent).frame(width: proxy.size.width * min(max(value, 0), 1))
                }
            }
            .frame(height: 8)
            Text(caption)
                .font(FPTypography.caption)
                .foregroundStyle(FPColors.textSecondary)
        }
    }
}

struct FPConceptResultCard: View {
    var title: String
    var subtitle: String
    var kind: FPStateKind
    var detailRows: [FPConceptRow]

    var body: some View {
        FPSurfaceCard(cornerRadius: FPRadius.xl) {
            VStack(alignment: .leading, spacing: FPSpacing.lg) {
                HStack(spacing: FPSpacing.md) {
                    Image(systemName: kind.icon)
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(kind.foreground)
                        .frame(width: 58, height: 58)
                        .background(kind.foreground.opacity(0.14), in: Circle())
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        Text(title)
                            .font(FPTypography.title2)
                            .foregroundStyle(FPColors.textPrimary)
                        Text(subtitle)
                            .font(FPTypography.callout)
                            .foregroundStyle(FPColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                FPConceptRowList(rows: detailRows)
            }
        }
    }
}

struct FPConceptMiniTimeline: View {
    let rows: [FPConceptRow]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(rows) { row in
                HStack(alignment: .top, spacing: FPSpacing.md) {
                    VStack(spacing: 0) {
                        Circle()
                            .fill(row.kind.foreground)
                            .frame(width: 12, height: 12)
                        Rectangle()
                            .fill(FPColors.borderDivider)
                            .frame(width: 1)
                            .frame(maxHeight: .infinity)
                    }
                    VStack(alignment: .leading, spacing: FPSpacing.xs) {
                        Text(row.title)
                            .font(FPTypography.headline)
                            .foregroundStyle(FPColors.textPrimary)
                        Text(row.subtitle)
                            .font(FPTypography.caption)
                            .foregroundStyle(FPColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    if let value = row.value {
                        Text(value)
                            .font(FPTypography.caption)
                            .foregroundStyle(row.kind.foreground)
                    }
                }
                .frame(minHeight: 64, alignment: .top)
            }
        }
    }
}
