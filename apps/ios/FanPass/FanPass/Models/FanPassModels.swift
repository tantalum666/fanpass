import Foundation

struct UserSession: Codable, Hashable {
    let userId: String
    let displayName: String
    let email: String
    let role: String
    let walletAddress: String?
    let privyWalletId: String?
    let accessToken: String?
    let authProvider: String?
    let expiresAt: String?

    var isFan: Bool { role == "FAN" }
    var isGateStaff: Bool { role == "GATE_STAFF" }
    var isAdmin: Bool { role == "ADMIN" }
    var isOpsRole: Bool { isGateStaff || isAdmin }

    static func parseExpiry(_ value: String) -> Date? {
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return fractionalFormatter.date(from: value) ?? formatter.date(from: value)
    }

    func withAccessToken(_ token: String?) -> UserSession {
        UserSession(
            userId: userId,
            displayName: displayName,
            email: email,
            role: role,
            walletAddress: walletAddress,
            privyWalletId: privyWalletId,
            accessToken: token,
            authProvider: authProvider,
            expiresAt: expiresAt
        )
    }

    static let demoFan = UserSession(
        userId: "usr_fan_demo",
        displayName: "Fan Account",
        email: "fan@example.com",
        role: "FAN",
        walletAddress: "0x0000000000000000000000000000000000002001",
        privyWalletId: nil,
        accessToken: nil,
        authProvider: "local",
        expiresAt: nil
    )

    static let gateStaff = UserSession(
        userId: "usr_gate_demo",
        displayName: "Gate Staff",
        email: "gate@example.com",
        role: "GATE_STAFF",
        walletAddress: nil,
        privyWalletId: nil,
        accessToken: nil,
        authProvider: "local",
        expiresAt: nil
    )
}

struct FanPassEvent: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let startTime: String
    let status: String
    let fanAccessAvailable: Bool?
    let venue: Venue?
    let ticketTypes: [TicketType]

    struct Venue: Codable, Hashable {
        let name: String
        let city: String
    }
}

struct TicketType: Codable, Identifiable, Hashable {
    let id: String
    let eventId: String
    let name: String
    let faceValue: Int
    let currency: String
    let supply: Int
    let transferable: Bool
    let resaleCap: Int?
    let maxTransferCount: Int?
}

struct FanPassOnsaleSnapshot: Codable, Hashable {
    let eventId: String
    let eventTitle: String
    let venueName: String
    let phase: String
    let allocation: Allocation
    let inventory: Inventory
    let queue: Queue
    let fairness: Fairness?
    let definitions: Definitions
    let updatedAt: String

    struct Allocation: Codable, Hashable {
        let venueCapacity: Int
        let publicSaleAllocation: Int
        let notInPublicSale: Int
        let categories: [Category]
        let fullyDisclosed: Bool
        let policyVersion: String
        let publishedAt: String?

        struct Category: Codable, Hashable, Identifiable {
            let key: String
            let label: String
            let quantity: Int
            let publicSale: Bool

            var id: String { key }
        }
    }

    struct Inventory: Codable, Hashable {
        let venueCapacity: Int
        let publicSaleAllocation: Int
        let sold: Int
        let held: Int
        let available: Int
        let returned: Int
        let releasedHolds: Int
        let ticketTypes: [TicketTypeInventory]

        struct TicketTypeInventory: Codable, Hashable, Identifiable {
            let ticketTypeId: String
            let name: String
            let allocation: Int
            let sold: Int
            let held: Int
            let available: Int
            let returned: Int
            let releasedHolds: Int

            var id: String { ticketTypeId }
        }
    }

    struct Queue: Codable, Hashable {
        let enabled: Bool
        let joined: Int
        let waiting: Int
        let inCheckout: Int
        let completed: Int
        let expired: Int
        let blocked: Int
        let currentBatch: Batch?
        let admittedThrough: Int
        let lastAssignedPosition: Int
        let checkoutWindowSeconds: Int?
        let purchaseLimitPerAccount: Int?
        let waitingRoomOpensAt: String?
        let opensAt: String?
        let closesAt: String?
        let positionFinalized: Bool?

        struct Batch: Codable, Hashable {
            let from: Int
            let to: Int
        }
    }

    struct Fairness: Codable, Hashable {
        let method: String
        let version: String
        let commitment: String
        let reveal: String?
        let explanation: String
    }

    struct Definitions: Codable, Hashable {
        let sold: String
        let held: String
        let available: String
        let queuePosition: String
    }
}

struct FanPassOnsaleQueueResponse: Codable, Hashable {
    let snapshot: FanPassOnsaleSnapshot
    let queueEntry: QueueEntry?

    struct QueueEntry: Codable, Hashable {
        let reference: String
        let status: String
        let phase: String
        let position: Int?
        let positionFinalized: Bool
        let usersAhead: Int?
        let canCheckout: Bool
        let joinedAt: String
        let admittedAt: String?
        let checkoutExpiresAt: String?
        let attempt: Int
        let message: String
    }
}

struct FanPassTicket: Codable, Identifiable, Hashable {
    let id: String
    let tokenId: String?
    let eventId: String
    let ticketTypeId: String
    let ownerId: String
    let seatHash: String?
    let status: String
    let transferCount: Int
}

struct FanPassProofHistoryResponse: Codable, Hashable {
    let items: [FanPassProofHistoryItem]
}

struct FanPassProofHistoryItem: Codable, Identifiable, Hashable {
    let id: String
    let label: String
    let state: String
    let timestamp: String
    let description: String
    let safeTicketRef: String
    let proofReference: String?
    let externalUrl: String?
}

struct FanPassChainProofResponse: Codable, Hashable {
    let status: String
    let chainId: String?
    let contractAddress: String?
    let contractExplorerUrl: String?
    let ticket: Ticket
    let wallet: Wallet
    let event: Event
    let proof: Proof
    let transaction: Transaction?
    let checkedAt: String
    let message: String

    struct Ticket: Codable, Hashable {
        let id: String
        let safeTicketRef: String
        let tokenId: String?
        let eventId: String
        let ticketTypeId: String
    }

    struct Wallet: Codable, Hashable {
        let expectedOwnerAddress: String?
        let onChainOwnerAddress: String?
        let matches: Bool?
    }

    struct Event: Codable, Hashable {
        let expectedChainEventId: String
        let onChainEventId: String?
        let matches: Bool?
    }

    struct Proof: Codable, Hashable {
        let ticketIdHashMatches: Bool?
        let ticketTypeHashMatches: Bool?
        let policyHashMatches: Bool?
        let metadataHashMatches: Bool?
        let state: String?
        let transferCount: String?
    }

    struct Transaction: Codable, Hashable {
        let hash: String
        let status: String
        let blockNumber: Int?
        let blockTimestamp: String?
        let explorerUrl: String
    }
}

struct QRPayload: Codable, Hashable {
    let v: Int?
    let credentialId: String?
    let ticketId: String
    let eventId: String
    let ticketTypeId: String?
    let ownerIdHash: String
    let nonce: String
    let issuedAt: String
    let expiresAt: String
    let entryMode: String?
    let kid: String?
    let signature: String
}

struct RedemptionResult: Codable, Hashable {
    let ticketId: String
    let eventId: String
    let result: String
    let redeemedAt: String
}

struct CheckinSummary: Codable, Hashable {
    let eventId: String
    let gate: String
    let total: Int
    let accepted: Int
    let rejected: Int
    let results: [String: Int]
    let lastCheckedInAt: String?
}

struct CheckinHistoryResponse: Codable, Hashable {
    let items: [CheckinHistoryItem]
}

struct CheckinHistoryItem: Codable, Identifiable, Hashable {
    let id: String
    let checkedInAt: String
    let gate: String
    let result: String
    let accepted: Bool
    let ticketRef: String
    let eventId: String
    let ticketTypeId: String
    let tokenId: String?
    let reason: String?
}

struct OrderbookLevel: Codable, Hashable {
    let price: Int
    let quantity: Int
}

struct OrderbookPricePoint: Codable, Hashable {
    let price: Int
    let tradedAt: String
}

struct OrderbookSnapshot: Codable, Hashable {
    let eventId: String
    let ticketTypeId: String
    let bids: [OrderbookLevel]
    let asks: [OrderbookLevel]
    let lastTradePrice: Int?
    let floorPrice: Int?
    let volume: Int
    let premiumPercent: Double?
    let priceHistory: [OrderbookPricePoint]?
}

enum FanPassOrderFulfillmentMode: String, Codable, Hashable {
    case any = "ANY"
    case primaryOnly = "PRIMARY_ONLY"
    case resaleOnly = "RESALE_ONLY"
}

struct FanPassOrder: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let eventId: String
    let ticketTypeId: String
    let ticketId: String?
    let side: String
    let fulfillmentMode: String?
    let price: Int
    let quantity: Int
    let remainingQuantity: Int
    let status: String
    let createdAt: String
}

struct FanPassTrade: Codable, Identifiable, Hashable {
    let id: String
    let buyOrderId: String
    let sellOrderId: String
    let ticketId: String
    let price: Int
    let fee: Int
    let settlementStatus: String
    let createdAt: String
}

struct CreateOrderResponse: Codable, Hashable {
    let order: FanPassOrder
    let trade: FanPassTrade?
}

struct FanPassPaymentIntent: Codable, Identifiable, Hashable {
    let id: String
    let orderId: String
    let stripePaymentIntentId: String?
    let clientSecret: String?
    let amount: Int
    let currency: String
    let status: String
    let captureStatus: String
    let idempotencyKey: String?
    let createdAt: String
    let updatedAt: String

    var amountMajor: Int {
        amount / 100
    }
}

struct FanPassCryptoQuoteResponse: Codable, Hashable {
    let payment: FanPassPaymentIntent
    let quote: FanPassCryptoQuote
}

struct FanPassCryptoQuote: Codable, Hashable {
    let asset: String
    let chainId: String
    let tokenContractAddress: String
    let receiverAddress: String
    let amountAtomic: String
    let amountDecimal: String
    let decimals: Int
    let hkdRate: String
    let hkdRateSource: String?
    let hkdRateAsOf: String?
    let hkdRateFetchedAt: String?
    let usdcUsdRate: String?
    let usdcPegStatus: String?
    let expiresAt: String
    let erc20TransferData: String

    var amountLabel: String {
        "\(amountDecimal) \(asset)"
    }

    var rateLabel: String {
        "1 \(asset) ~= HK$\(hkdRate)"
    }

    var paymentRateLabel: String {
        guard let value = Double(hkdRate) else {
            return "HK$\(hkdRate)"
        }
        return "HK$\(String(format: "%.2f", value))"
    }

    var rateSourceLabel: String {
        guard let hkdRateSource, !hkdRateSource.isEmpty else {
            return "Live rate source"
        }
        if hkdRateSource.hasPrefix("hkma:") {
            if let hkdRateAsOf, !hkdRateAsOf.isEmpty {
                return "HKMA daily reference · \(hkdRateAsOf)"
            }
            return "HKMA daily reference"
        }
        if hkdRateSource.hasPrefix("coingecko:") {
            return "CoinGecko market price"
        }
        if hkdRateSource.hasPrefix("configured:") {
            return "Configured staging rate"
        }
        if hkdRateSource.hasPrefix("fallback:") {
            return "Fallback staging rate"
        }
        return hkdRateSource
    }

    var pegLabel: String {
        guard let usdcUsdRate, !usdcUsdRate.isEmpty else {
            return "Not checked"
        }
        return "$\(usdcUsdRate)"
    }

    var pegStatusLabel: String {
        switch usdcPegStatus {
        case "stable":
            return "Stable"
        case "watch":
            return "Watch"
        case "blocked":
            return "Blocked"
        default:
            return "Not checked"
        }
    }

    var pegStatusKind: FPStateKind {
        switch usdcPegStatus {
        case "stable":
            return .success
        case "watch":
            return .warning
        case "blocked":
            return .danger
        default:
            return .neutral
        }
    }
}

struct FanPassPrivySponsoredAuthorization: Codable, Hashable {
    let authorizationSignature: String
    let requestExpiry: Int64
}

struct FanPassCryptoConfirmationResponse: Codable, Hashable {
    let ok: Bool
    let payment: FanPassPaymentIntent
    let transactionHash: String?
    let alreadyConfirmed: Bool?
    let compensationRequired: Bool?
    let compensationReason: String?

    var isTicketSettlementConfirmed: Bool {
        ok &&
            compensationRequired != true &&
            payment.status == "crypto_confirmed" &&
            payment.captureStatus == "CAPTURED"
    }
}

struct FanTask: Codable, Identifiable, Hashable {
    let id: String
    let eventId: String
    let campaignId: String?
    let title: String
    let description: String?
    let taskType: String
    let points: Int
    let verificationMethod: String
    let verificationLabel: String?
    let actionKind: String?
    let actionTarget: String?
    let optional: Bool?
    let sortOrder: Int?
}

struct FanCampaign: Codable, Identifiable, Hashable {
    let id: String
    let eventId: String
    let title: String
    let description: String
    let rewardTitle: String
    let rewardDescription: String
    let rewardSupply: Int
    let qualificationPoints: Int
    let allocationMethod: String
    let status: String
    let startsAt: String
    let closesAt: String
    let tasks: [FanTask]
}

struct FanTaskSubmission: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let taskId: String
    let proof: String
    let status: String
}

struct FanScore: Codable, Hashable {
    let userId: String
    let eventId: String
    let score: Int
    let fanScore: Int?
    let campaignId: String?
    let qualificationPoints: Int?
    let pointsToQualify: Int?
    let completedTaskIds: [String]?
    let entitlementStatus: String
}
