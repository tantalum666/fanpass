import SwiftUI

enum FanPassTheme {
    static let background = Color(red: 0.957, green: 0.961, blue: 0.965)
    static let ink = Color(red: 0.043, green: 0.051, blue: 0.063)
    static let slate = Color(red: 0.235, green: 0.255, blue: 0.294)
    static let muted = Color(red: 0.506, green: 0.537, blue: 0.592)
    static let line = Color(red: 0.847, green: 0.867, blue: 0.894)
    static let accent = Color(red: 0.0, green: 0.329, blue: 1.0)
    static let mint = Color(red: 0.0, green: 0.69, blue: 0.55)
    static let coral = Color(red: 0.925, green: 0.286, blue: 0.235)
    static let amber = Color(red: 0.91, green: 0.565, blue: 0.067)
}

struct FanPassScreen<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            FanPassTheme.background
                .ignoresSafeArea()
            content
        }
    }
}

struct SectionHeading: View {
    let title: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(FanPassTheme.ink)
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(.subheadline.weight(.semibold))
            }
        }
    }
}

struct SoftCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(18)
            .background(.white, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .shadow(color: .black.opacity(0.06), radius: 16, x: 0, y: 8)
    }
}

struct StatusPill: View {
    let text: String
    var color: Color = FanPassTheme.accent

    var body: some View {
        Text(text)
            .font(.caption.weight(.bold))
            .foregroundStyle(color)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(color.opacity(0.12), in: Capsule())
    }
}

struct AuthRequiredPanel: View {
    let title: String
    let message: String
    let actionTitle: String
    let action: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle.badge.plus")
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(FanPassTheme.accent)
            Text(title)
                .font(.title3.weight(.semibold))
                .multilineTextAlignment(.center)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button(actionTitle, action: action)
                .buttonStyle(.borderedProminent)
        }
        .padding(22)
        .frame(maxWidth: .infinity)
        .background(.white, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

func fanPassMoney(_ value: Int, currency: String = "HKD") -> String {
    "\(currency) \(value.formatted(.number.grouping(.automatic)))"
}

func fanPassDate(_ isoString: String) -> String {
    let formatter = ISO8601DateFormatter()
    let date = formatter.date(from: isoString) ?? {
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: isoString)
    }()
    guard let date else {
        return isoString
    }

    return date.formatted(date: .abbreviated, time: .shortened)
}

func fanPassStatusColor(_ status: String) -> Color {
    switch status {
    case "ACTIVE", "TRANSFERRED", "APPROVED", "ACCEPTED", "PUBLISHED":
        FanPassTheme.mint
    case "REDEEMED", "LISTED_FOR_RESALE", "PENDING", "WAITLIST":
        FanPassTheme.amber
    case "CANCELLED", "REJECTED", "ERROR":
        FanPassTheme.coral
    default:
        FanPassTheme.accent
    }
}
