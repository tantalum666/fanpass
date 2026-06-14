import Foundation

struct UserSession: Codable, Hashable {
    let userId: String
    let displayName: String
    let email: String
    let role: String
    let walletAddress: String?
    let accessToken: String?
    let expiresAt: String?

    var isFan: Bool { role == "FAN" }

    func withAccessToken(_ token: String?) -> UserSession {
        UserSession(
            userId: userId,
            displayName: displayName,
            email: email,
            role: role,
            walletAddress: walletAddress,
            accessToken: token,
            expiresAt: expiresAt
        )
    }

    static let demoFan = UserSession(
        userId: "usr_fan_demo",
        displayName: "Fan Account",
        email: "fan@example.com",
        role: "FAN",
        walletAddress: "0x0000000000000000000000000000000000002001",
        accessToken: nil,
        expiresAt: nil
    )

    static let gateStaff = UserSession(
        userId: "usr_gate_demo",
        displayName: "Gate Staff",
        email: "gate@example.com",
        role: "GATE_STAFF",
        walletAddress: nil,
        accessToken: nil,
        expiresAt: nil
    )
}

struct FanPassEvent: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let startTime: String
    let status: String
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

struct OrderbookLevel: Codable, Hashable {
    let price: Int
    let quantity: Int
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
}

struct FanPassOrder: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let eventId: String
    let ticketTypeId: String
    let ticketId: String?
    let side: String
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

struct FanTask: Codable, Identifiable, Hashable {
    let id: String
    let eventId: String
    let title: String
    let taskType: String
    let points: Int
    let verificationMethod: String
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
    let entitlementStatus: String
}
