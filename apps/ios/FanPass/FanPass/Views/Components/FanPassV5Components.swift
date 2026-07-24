import SwiftUI

struct FanPassV5BrandLockup: View {
    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                FPV5Colors.paper
                if let markImage {
                    Image(uiImage: markImage)
                        .resizable()
                        .scaledToFit()
                }
            }
                .frame(width: 30, height: 30)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                .accessibilityHidden(true)
            Text("FanPass")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(FPV5Colors.warmWhite)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("FanPass")
    }

    private var markImage: UIImage? {
        if let image = UIImage(named: "fanpass-mark-v5") {
            return image
        }
        guard let url = Bundle.main.url(forResource: "fanpass-mark-v5", withExtension: "png") else {
            return nil
        }
        return UIImage(contentsOfFile: url.path)
    }
}

struct FanPassV5SectionHeader: View {
    let title: String
    var count: Int?

    var body: some View {
        HStack(alignment: .lastTextBaseline) {
            Text(title)
                .font(FPV5Typography.sectionTitle)
                .foregroundStyle(FPV5Colors.warmWhite)
            Spacer()
            if let count {
                Text(count.formatted())
                    .font(FPV5Typography.metadata)
                    .foregroundStyle(FPV5Colors.darkSecondary)
                    .monospacedDigit()
            }
        }
    }
}

struct FanPassV5SearchButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 15, weight: .semibold))
                Text(title)
                    .lineLimit(1)
                Spacer()
                Image(systemName: "arrow.right")
                    .font(.system(size: 13, weight: .bold))
            }
            .font(FPV5Typography.callout)
            .foregroundStyle(FPV5Colors.darkSecondary)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, minHeight: FPV5Metrics.minimumControlHeight)
            .background(FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous)
                    .stroke(FPV5Colors.darkHairline, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

struct FanPassV5SourceBanner: View {
    let isSavedCatalog: Bool
    let message: String
    let refresh: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: isSavedCatalog ? "clock.arrow.circlepath" : "wifi.exclamationmark")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(FPV5Colors.amber)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 4) {
                Text(isSavedCatalog ? "Saved catalog" : "Catalog unavailable")
                    .font(FPV5Typography.headline)
                    .foregroundStyle(FPV5Colors.warmWhite)
                Text(message)
                    .font(FPV5Typography.metadata)
                    .foregroundStyle(FPV5Colors.darkSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Button(action: refresh) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(FPV5Colors.paper)
                    .frame(width: 36, height: 36)
                    .background(FPV5Colors.ink, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Refresh catalog")
        }
        .padding(12)
        .background(FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous)
                .stroke(FPV5Colors.amber.opacity(0.42), lineWidth: 1)
        }
    }
}

enum FanPassV5TagTone {
    case neutral
    case brand
    case verified
    case warning

    var foreground: Color {
        switch self {
        case .neutral: FPV5Colors.slate
        case .brand: FPV5Colors.signalRed
        case .verified: FPV5Colors.verifiedGreen
        case .warning: FPV5Colors.amber
        }
    }
}

struct FanPassV5Tag: View {
    let title: String
    var systemImage: String?
    var tone: FanPassV5TagTone = .neutral

    var body: some View {
        HStack(spacing: 5) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: 10, weight: .bold))
            }
            Text(title)
                .font(FPV5Typography.caption)
                .lineLimit(1)
        }
        .foregroundStyle(tone.foreground)
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(tone.foreground.opacity(0.08), in: RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous)
                .stroke(tone.foreground.opacity(0.28), lineWidth: 1)
        }
    }
}

struct FanPassV5EventArtwork: View {
    let event: FanPassV4.Event
    var height: CGFloat

    var body: some View {
        ZStack {
            if let coverImage {
                Image(uiImage: coverImage)
                    .resizable()
                    .scaledToFill()
                    .overlay {
                        LinearGradient(
                            colors: [.clear, Color.black.opacity(0.14), Color.black.opacity(0.58)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    }
            } else {
                FPV5Colors.softBlack
                    .overlay {
                        VStack(spacing: 10) {
                            Image(systemName: "music.note")
                                .font(.system(size: 38, weight: .semibold))
                            Text(event.category.title.uppercased())
                                .font(FPV5Typography.caption)
                        }
                        .foregroundStyle(FPV5Colors.paper.opacity(0.58))
                    }
            }
        }
        .frame(maxWidth: .infinity, minHeight: height, maxHeight: height)
        .clipped()
        .accessibilityLabel("Event artwork for \(event.title)")
    }

    private var coverImage: UIImage? {
        guard let name = event.coverAssetName else { return nil }
        if let image = UIImage(named: name) {
            return image
        }
        guard let url = Bundle.main.url(forResource: name, withExtension: "png"),
              let data = try? Data(contentsOf: url)
        else {
            return nil
        }
        return UIImage(data: data)
    }
}

struct FanPassV5DateBadge: View {
    let date: Date

    var body: some View {
        VStack(spacing: 0) {
            Text(date.formatted(.dateTime.month(.abbreviated)).uppercased())
                .font(.system(size: 10, weight: .bold))
            Text(date.formatted(.dateTime.day(.twoDigits)))
                .font(.system(size: 24, weight: .black, design: .serif))
            Text(date.formatted(.dateTime.weekday(.abbreviated)).uppercased())
                .font(.system(size: 9, weight: .bold))
        }
        .foregroundStyle(FPV5Colors.ink)
        .frame(width: 52, height: 66)
        .background(FPV5Colors.paper, in: RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous)
                .stroke(FPV5Colors.hairline, lineWidth: 1)
        }
    }
}

struct FanPassV5FeaturedEventCard: View {
    let event: FanPassV4.Event

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            FanPassV5EventArtwork(event: event, height: 222)
                .overlay(alignment: .topLeading) {
                    FanPassV5DateBadge(date: event.startTime)
                        .padding(14)
                }
                .overlay(alignment: .topTrailing) {
                    FanPassV5Tag(
                        title: event.status.title,
                        systemImage: event.status == .published ? "checkmark.seal.fill" : nil,
                        tone: event.status == .published ? .verified : .warning
                    )
                    .padding(14)
                }

            VStack(alignment: .leading, spacing: 12) {
                Text(event.category.title.uppercased())
                    .font(FPV5Typography.caption)
                    .foregroundStyle(FPV5Colors.signalRed)
                Text(event.title)
                    .font(FPV5Typography.editorialTitle)
                    .foregroundStyle(FPV5Colors.ink)
                    .lineLimit(2)
                    .minimumScaleFactor(0.82)
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("\(event.venue.name) · \(event.venue.city)")
                        .font(FPV5Typography.metadata)
                        .foregroundStyle(FPV5Colors.slate)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Text("From \(event.safePrimaryTicketType.priceLabel)")
                        .font(FPV5Typography.tabular)
                        .foregroundStyle(FPV5Colors.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                }
            }
            .padding(16)
        }
        .background(FPV5Colors.paper, in: RoundedRectangle(cornerRadius: FPV5Metrics.sheetCorner, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: FPV5Metrics.sheetCorner, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPV5Metrics.sheetCorner, style: .continuous)
                .stroke(FPV5Colors.hairline, lineWidth: 1)
        }
        .shadow(color: Color.black.opacity(0.22), radius: 22, y: 10)
    }
}

struct FanPassV5EventRow: View {
    let event: FanPassV4.Event

    var body: some View {
        HStack(spacing: 14) {
            FanPassV5EventArtwork(event: event, height: 112)
                .frame(width: 88)
                .clipShape(RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous))

            VStack(alignment: .leading, spacing: 6) {
                Text(event.category.title.uppercased())
                    .font(FPV5Typography.caption)
                    .foregroundStyle(FPV5Colors.signalRed)
                Text(event.title)
                    .font(FPV5Typography.headline)
                    .foregroundStyle(FPV5Colors.ink)
                    .lineLimit(2)
                Text("\(event.venue.city) · \(event.dateLine)")
                    .font(FPV5Typography.metadata)
                    .foregroundStyle(FPV5Colors.slate)
                    .lineLimit(2)
                HStack(spacing: 8) {
                    Text(event.safePrimaryTicketType.priceLabel)
                        .font(FPV5Typography.tabular)
                        .foregroundStyle(FPV5Colors.ink)
                    if event.fanAccessAvailable {
                        FanPassV5Tag(title: "Access", systemImage: FPIcons.fanAccess, tone: .verified)
                    }
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(FPV5Colors.slate)
        }
        .padding(12)
        .background(FPV5Colors.paper, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous)
                .stroke(FPV5Colors.hairline, lineWidth: 1)
        }
    }
}

struct FanPassV5FilterChip: View {
    let title: String
    var systemImage: String?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .lineLimit(1)
            }
            .font(FPV5Typography.caption)
            .foregroundStyle(isSelected ? FPV5Colors.paper : FPV5Colors.darkSecondary)
            .padding(.horizontal, 12)
            .frame(minHeight: 36)
            .background(isSelected ? FPV5Colors.signalRed : FPV5Colors.softBlack, in: RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FPV5Metrics.compactCorner, style: .continuous)
                    .stroke(isSelected ? FPV5Colors.signalRed : FPV5Colors.darkHairline, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

struct FanPassV5EventHero: View {
    let event: FanPassV4.Event

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            FanPassV5EventArtwork(event: event, height: event.coverAssetName == nil ? 210 : 260)
                .overlay(alignment: .topLeading) {
                    FanPassV5DateBadge(date: event.startTime)
                        .padding(16)
                }

            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    FanPassV5Tag(title: event.status.title, systemImage: "checkmark.seal.fill", tone: .verified)
                    Text(event.category.title.uppercased())
                        .font(FPV5Typography.caption)
                        .foregroundStyle(FPV5Colors.signalRed)
                }
                Text(event.title)
                    .font(FPV5Typography.editorialTitle)
                    .foregroundStyle(FPV5Colors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Label(event.dateLine, systemImage: "calendar")
                    .font(FPV5Typography.callout)
                    .foregroundStyle(FPV5Colors.slate)
                Label("\(event.venue.name) · \(event.venue.city)", systemImage: "mappin.and.ellipse")
                    .font(FPV5Typography.callout)
                    .foregroundStyle(FPV5Colors.slate)
                    .lineLimit(2)
            }
            .padding(18)
        }
        .background(FPV5Colors.paper, in: RoundedRectangle(cornerRadius: FPV5Metrics.sheetCorner, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: FPV5Metrics.sheetCorner, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPV5Metrics.sheetCorner, style: .continuous)
                .stroke(FPV5Colors.hairline, lineWidth: 1)
        }
    }
}

struct FanPassV5TicketOptionCard<Action: View>: View {
    let ticketType: FanPassV4.TicketType
    let availability: Int
    @ViewBuilder let action: Action

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(ticketType.name)
                        .font(FPV5Typography.sectionTitle)
                        .foregroundStyle(FPV5Colors.ink)
                    Text(transferSummary)
                        .font(FPV5Typography.metadata)
                        .foregroundStyle(FPV5Colors.slate)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 5) {
                    Text(ticketType.priceLabel)
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundStyle(FPV5Colors.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    Text(availability > 0 ? "\(availability.formatted()) left" : "Sold out")
                        .font(FPV5Typography.caption)
                        .foregroundStyle(availability > 0 ? FPV5Colors.verifiedGreen : FPV5Colors.danger)
                }
            }

            Rectangle()
                .fill(FPV5Colors.hairline)
                .frame(height: 1)

            Text(ticketType.refundPolicy)
                .font(FPV5Typography.metadata)
                .foregroundStyle(FPV5Colors.slate)
                .fixedSize(horizontal: false, vertical: true)

            action
        }
        .padding(16)
        .background(FPV5Colors.paper, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous)
                .stroke(FPV5Colors.hairline, lineWidth: 1)
        }
    }

    private var transferSummary: String {
        guard ticketType.transferRule.transferable else {
            return "Non-transferable under organizer rules"
        }
        if let cap = ticketType.transferRule.resaleCap {
            return "Resale capped at \(MoneyFormatter.format(cap, currency: ticketType.currency)) · \(ticketType.transferRule.maxTransferCount) transfers max"
        }
        return "Organizer-controlled resale · \(ticketType.transferRule.maxTransferCount) transfers max"
    }
}

struct FanPassV5PrimaryActionLabel: View {
    let title: String
    var enabled = true

    var body: some View {
        HStack {
            Text(title)
                .font(FPV5Typography.headline)
            Spacer()
            Image(systemName: "arrow.right")
                .font(.system(size: 14, weight: .bold))
        }
        .foregroundStyle(enabled ? FPV5Colors.paper : FPV5Colors.slate)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, minHeight: 50)
        .background(enabled ? FPV5Colors.signalRed : FPV5Colors.hairline, in: RoundedRectangle(cornerRadius: FPV5Metrics.cardCorner, style: .continuous))
    }
}
