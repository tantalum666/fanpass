import Foundation
import SwiftUI

enum FanPassV4 {
    struct User: Identifiable, Hashable {
        let id: String
        var displayName: String
        var email: String
        var role: UserRole
        var scenario: DemoUserScenario = .normalFan
        var walletReference: WalletReference?
        var accessBadges: [AccessBadge]

        var maskedEmail: String {
            let parts = email.split(separator: "@", maxSplits: 1).map(String.init)
            guard parts.count == 2, let first = parts[0].first else { return "Hidden" }
            return "\(first)***@\(parts[1])"
        }
    }

    enum DemoUserScenario: String, CaseIterable, Identifiable, Hashable {
        case normalFan
        case verifiedFanWithBadge
        case purchasedTicketFan
        case listedResaleFan
        case gateStaff
        case organizerLite

        var id: String { rawValue }

        var title: String {
            switch self {
            case .normalFan: "Normal fan"
            case .verifiedFanWithBadge: "Verified fan with Access Badge"
            case .purchasedTicketFan: "Fan with purchased ticket"
            case .listedResaleFan: "Fan with listed resale ticket"
            case .gateStaff: "Gate staff"
            case .organizerLite: "Organizer admin-lite"
            }
        }
    }

    enum UserRole: String, CaseIterable, Hashable {
        case guest
        case fan
        case gateStaff
        case organizer
        case admin

        var title: String {
            switch self {
            case .guest: "Guest"
            case .fan: "Fan"
            case .gateStaff: "Gate staff"
            case .organizer: "Organizer"
            case .admin: "Admin"
            }
        }
    }

    struct Venue: Identifiable, Hashable {
        let id: String
        var name: String
        var city: String
        var country: String
        var timezone: String
        var gates: [String]
    }

    struct Event: Identifiable, Hashable {
        let id: String
        var title: String
        var subtitle: String
        var category: EventCategory
        var heroGradient: HeroGradient
        var coverAssetName: String?
        var fanAccessAvailable: Bool
        var startTime: Date
        var status: EventStatus
        var venue: Venue
        var ticketTypes: [TicketType]
        var fanTasks: [FanTask]
        var marketSummary: MarketSummary
        var isBackendBacked: Bool = false

        var dateLine: String {
            startTime.formatted(date: .abbreviated, time: .shortened)
        }
    }

    enum EventCategory: String, CaseIterable, Hashable {
        case concerts
        case festivals
        case sports
        case theatre
        case conference

        var title: String {
            switch self {
            case .concerts: "Concerts"
            case .festivals: "Festivals"
            case .sports: "Sports"
            case .theatre: "Theatre"
            case .conference: "Conference"
            }
        }
    }

    struct HeroGradient: Hashable {
        var startHex: Int
        var endHex: Int
        var accentHex: Int
        var label: String
    }

    enum EventStatus: String, CaseIterable, Hashable {
        case published
        case soldOut
        case cancelled
        case completed

        var title: String {
            switch self {
            case .published: "On sale"
            case .soldOut: "Sold out"
            case .cancelled: "Cancelled"
            case .completed: "Completed"
            }
        }
    }

    struct TicketType: Identifiable, Hashable {
        let id: String
        var eventId: String
        var name: String
        var faceValue: Int
        var currency: String
        var supply: Int
        var availableQuantity: Int
        var transferRule: TicketTransferRule
        var refundPolicy: String

        var priceLabel: String { MoneyFormatter.format(faceValue, currency: currency) }
    }

    struct TicketTransferRule: Hashable {
        var transferable: Bool
        var resaleCap: Int?
        var maxTransferCount: Int
        var listingReservesEntry: Bool

        var summary: String {
            guard transferable else { return "Non-transferable under organizer rules." }
            if let resaleCap {
                return "Secure resale allowed up to \(MoneyFormatter.format(resaleCap, currency: "HKD"))."
            }
            return "Secure resale allowed under organizer rules."
        }
    }

    struct Ticket: Identifiable, Hashable {
        let id: String
        var event: Event
        var ticketType: TicketType
        var ownerId: String
        var status: TicketStatus
        var section: String
        var row: String
        var seat: String
        var entryMode: TicketEntryMode
        var transferCount: Int
        var proofHistory: [ProofHistoryItem]

        var shortId: String {
            id.replacingOccurrences(of: "FP-", with: "")
        }
    }

    enum TicketEntryMode: String, CaseIterable, Hashable {
        case nfcReady
        case qrOnly
        case unavailable

        var title: String {
            switch self {
            case .nfcReady: "NFC Ready"
            case .qrOnly: "QR Only"
            case .unavailable: "Entry unavailable"
            }
        }
    }

    enum TicketStatus: String, CaseIterable, Hashable {
        case active
        case listed
        case transferPending
        case transferred
        case redeemed
        case cancelled
        case refunded
        case expired

        var title: String {
            switch self {
            case .active: "Verified Ticket"
            case .listed: "Listed"
            case .transferPending: "Transfer pending"
            case .transferred: "Transferred"
            case .redeemed: "Redeemed"
            case .cancelled: "Cancelled"
            case .refunded: "Refunded"
            case .expired: "Expired"
            }
        }

        var allowsEntryCode: Bool { self == .active }
        var allowsResale: Bool { self == .active }
    }

    struct FanTask: Identifiable, Hashable {
        let id: String
        var eventId: String
        var title: String
        var description: String
        var points: Int
        var verificationMethod: String
        var status: FanTaskStatus
    }

    enum FanTaskStatus: String, Hashable {
        case available
        case inReview
        case approved
        case rejected

        var title: String {
            switch self {
            case .available: "Available"
            case .inReview: "Pending approval"
            case .approved: "Approved"
            case .rejected: "Rejected"
            }
        }
    }

    struct AccessBadge: Identifiable, Hashable {
        let id: String
        var title: String
        var criteria: String
        var benefit: String
        var status: AccessBadgeStatus
    }

    enum AccessBadgeStatus: String, Hashable {
        case locked
        case inReview
        case earned
        case expired

        var title: String {
            switch self {
            case .locked: "Locked"
            case .inReview: "Pending approval"
            case .earned: "Earned"
            case .expired: "Expired"
            }
        }
    }

    enum PaymentState: String, Hashable {
        case idle
        case authorizing
        case authorized
        case captured
        case cancelled
        case refunded
        case failed

        var title: String {
            switch self {
            case .idle: "Ready"
            case .authorizing: "Authorizing payment"
            case .authorized: "Payment authorized"
            case .captured: "Payment complete"
            case .cancelled: "Payment cancelled"
            case .refunded: "Refunded"
            case .failed: "Payment failed"
            }
        }
    }

    struct ResaleListing: Identifiable, Hashable {
        let id: String
        var ticket: Ticket
        var sellerDisplay: String
        var price: Int
        var currency: String
        var feeEstimate: Int
        var status: ListingStatus
        var createdAt: Date

        var priceLabel: String { MoneyFormatter.format(price, currency: currency) }
    }

    enum ListingStatus: String, Hashable {
        case open
        case matched
        case cancelled
        case settled

        var title: String {
            switch self {
            case .open: "Available"
            case .matched: "Processing"
            case .cancelled: "Cancelled"
            case .settled: "Sold"
            }
        }
    }

    struct OrderbookOrder: Identifiable, Hashable {
        let id: String
        var side: OrderSide
        var price: Int
        var quantity: Int
        var remainingQuantity: Int
        var status: String
        var createdAt: Date
    }

    enum OrderSide: String, Hashable {
        case buy
        case sell

        var fanLabel: String {
            switch self {
            case .buy: "Fans willing to buy"
            case .sell: "Tickets listed for resale"
            }
        }
    }

    struct Trade: Identifiable, Hashable {
        let id: String
        var ticketId: String
        var price: Int
        var fee: Int
        var settlementStatus: String
        var createdAt: Date
    }

    struct CheckInResult: Identifiable, Hashable {
        let id: String
        var ticketFragment: String
        var eventTitle: String
        var gate: String
        var result: ScanResult
        var checkedAt: Date
        var reason: String
    }

    enum ScanResult: String, CaseIterable, Hashable {
        case accepted
        case duplicate
        case expired
        case invalid
        case ownerMismatch
        case notActive
        case cancelled
        case error

        var title: String {
            switch self {
            case .accepted: "Accepted"
            case .duplicate: "Already used"
            case .expired: "Code expired"
            case .invalid: "Invalid ticket"
            case .ownerMismatch: "Owner mismatch"
            case .notActive: "Not active"
            case .cancelled: "Cancelled"
            case .error: "Error"
            }
        }
    }

    enum NFCScanState: String, CaseIterable, Identifiable, Hashable {
        case ready
        case scanning
        case valid
        case invalid
        case alreadyRedeemed
        case unreadable
        case expired

        var id: String { rawValue }

        var title: String {
            switch self {
            case .ready: "Ready to scan"
            case .scanning: "Scanning"
            case .valid: "Valid NFC credential"
            case .invalid: "Invalid NFC credential"
            case .alreadyRedeemed: "Already redeemed"
            case .unreadable: "NFC tag unreadable"
            case .expired: "NFC credential expired"
            }
        }
    }

    struct ProofHistoryItem: Identifiable, Hashable {
        let id: String
        var type: ProofType
        var title: String
        var description: String
        var timestamp: Date
        var actorLabel: String
        var proofReference: String
        var externalURL: URL? = nil
        var status: ProofStatus
    }

    enum ProofType: String, Hashable {
        case issued
        case purchased
        case listed
        case transferred
        case entryCode
        case redeemed
        case cancelled
        case refunded
    }

    enum ProofStatus: String, Hashable {
        case success
        case pending
        case failed
    }

    struct WalletReference: Hashable {
        var addressFragment: String
        var provider: String
        var status: String
        var lastSyncedAt: Date
    }

    struct MarketSummary: Hashable {
        var floorPrice: Int
        var organizerCap: Int
        var recentSale: Int
        var volume: Int
        var currency: String
        var suggestedResalePrice: Int
        var priceHistory: [PricePoint]

        var floorPriceLabel: String { MoneyFormatter.format(floorPrice, currency: currency) }
        var capLabel: String { MoneyFormatter.format(organizerCap, currency: currency) }
        var suggestedResalePriceLabel: String { MoneyFormatter.format(suggestedResalePrice, currency: currency) }
    }

    struct PricePoint: Identifiable, Hashable {
        let id: String
        var label: String
        var price: Int
    }

    enum DemoPaymentResult: String, CaseIterable, Identifiable, Hashable {
        case success
        case failure
        case expired

        var id: String { rawValue }
        var title: String {
            switch self {
            case .success: "Payment success"
            case .failure: "Payment failed"
            case .expired: "Checkout expired"
            }
        }
    }

    enum DemoNetworkCondition: String, CaseIterable, Identifiable, Hashable {
        case online
        case slow
        case unavailable

        var id: String { rawValue }
        var title: String {
            switch self {
            case .online: "Online"
            case .slow: "Slow network"
            case .unavailable: "Network unavailable"
            }
        }
    }

    enum DemoTransferabilityCondition: String, CaseIterable, Identifiable, Hashable {
        case transferable
        case nonTransferable
        case alreadyRedeemed

        var id: String { rawValue }
        var title: String {
            switch self {
            case .transferable: "Transferable"
            case .nonTransferable: "Non-transferable"
            case .alreadyRedeemed: "Already redeemed"
            }
        }
    }

    enum DemoResaleCapCondition: String, CaseIterable, Identifiable, Hashable {
        case withinCap
        case aboveCap
        case noCap

        var id: String { rawValue }
        var title: String {
            switch self {
            case .withinCap: "Within resale cap"
            case .aboveCap: "Above resale cap"
            case .noCap: "No cap"
            }
        }
    }

    struct PrototypeControlState: Hashable {
        var userScenario: DemoUserScenario = .purchasedTicketFan
        var ticketStatus: TicketStatus = .active
        var paymentResult: DemoPaymentResult = .success
        var scannerResult: ScanResult = .accepted
        var networkCondition: DemoNetworkCondition = .online
        var transferability: DemoTransferabilityCondition = .transferable
        var resaleCap: DemoResaleCapCondition = .withinCap
    }
}

extension FanPassV4.Event {
    var safePrimaryTicketType: FanPassV4.TicketType {
        ticketTypes.first ?? FanPassV4.TicketType.unavailable(for: self)
    }
}

extension FanPassV4.TicketType {
    static func unavailable(for event: FanPassV4.Event) -> FanPassV4.TicketType {
        FanPassV4.TicketType(
            id: "\(event.id)_ticket_unavailable",
            eventId: event.id,
            name: "Tickets unavailable",
            faceValue: event.marketSummary.floorPrice,
            currency: event.marketSummary.currency,
            supply: 0,
            availableQuantity: 0,
            transferRule: FanPassV4.TicketTransferRule(
                transferable: false,
                resaleCap: event.marketSummary.organizerCap,
                maxTransferCount: 0,
                listingReservesEntry: false
            ),
            refundPolicy: "Ticket categories are not available for this event yet."
        )
    }
}

enum MoneyFormatter {
    static func format(_ amount: Int, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}
