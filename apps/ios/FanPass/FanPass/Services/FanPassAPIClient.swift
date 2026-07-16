import Foundation

enum APIClientError: Error {
    case invalidResponse
    case api(result: String?, message: String)
}

extension APIClientError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            "Something went wrong. Please try again."
        case let .api(_, message):
            message
        }
    }

    var resultCode: String? {
        switch self {
        case .invalidResponse:
            nil
        case let .api(result, _):
            result
        }
    }
}

struct FanPassAPIClient {
    let baseURL: URL
    var accessToken: String? = nil
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(
        baseURL: URL,
        accessToken: String? = nil,
        session: URLSession = FanPassNetworkSession.shared
    ) {
        self.baseURL = baseURL
        self.accessToken = accessToken
        self.session = session
    }

    func withAccessToken(_ token: String?) -> FanPassAPIClient {
        FanPassAPIClient(baseURL: baseURL, accessToken: token, session: session)
    }

    func events() async throws -> [FanPassEvent] {
        try await get("/events", retryOnTransientNetworkLoss: true)
    }

    func onsaleSnapshot(eventId: String) async throws -> FanPassOnsaleSnapshot {
        try await get("/onsales/events/\(eventId)/snapshot", retryOnTransientNetworkLoss: true)
    }

    func onsaleQueueStatus(eventId: String) async throws -> FanPassOnsaleQueueResponse {
        try await get("/onsales/events/\(eventId)/queue/me", retryOnTransientNetworkLoss: true)
    }

    func joinOnsaleQueue(eventId: String) async throws -> FanPassOnsaleQueueResponse {
        struct JoinOnsaleQueueRequest: Encodable {
            let clientInstanceId: String
        }

        return try await post(
            "/onsales/events/\(eventId)/queue/join",
            body: JoinOnsaleQueueRequest(
                clientInstanceId: FanPassClientInstanceStore.shared.identifier()
            ),
            retryOnTransientNetworkLoss: true
        )
    }

    func register(name: String, email: String) async throws -> UserSession {
        struct RegisterRequest: Encodable {
            let name: String
            let email: String
        }

        return try await post("/auth/register", body: RegisterRequest(name: name, email: email))
    }

    func login(email: String) async throws -> UserSession {
        struct LoginRequest: Encodable {
            let email: String
        }

        return try await post("/auth/login", body: LoginRequest(email: email))
    }

    func demoSession(userId: String) async throws -> UserSession {
        struct DemoSessionRequest: Encodable {
            let userId: String
        }

        return try await post("/auth/demo-session", body: DemoSessionRequest(userId: userId))
    }

    func syncPrivySession(
        privyAccessToken: String,
        name: String? = nil,
        email: String? = nil,
        walletAddress: String? = nil,
        walletId: String? = nil
    ) async throws -> UserSession {
        struct PrivySyncRequest: Encodable {
            let name: String?
            let email: String?
            let walletAddress: String?
            let walletId: String?
        }

        return try await withAccessToken(privyAccessToken).post(
            "/auth/privy/sync",
            body: PrivySyncRequest(name: name, email: email, walletAddress: walletAddress, walletId: walletId),
            retryOnTransientNetworkLoss: true
        )
    }

    func acceptStaffInvite(
        privyAccessToken: String,
        inviteToken: String,
        walletAddress: String? = nil,
        walletId: String? = nil
    ) async throws -> UserSession {
        struct StaffInviteRequest: Encodable {
            let inviteToken: String
            let walletAddress: String?
            let walletId: String?
        }

        return try await withAccessToken(privyAccessToken).post(
            "/auth/privy/accept-staff-invite",
            body: StaffInviteRequest(
                inviteToken: inviteToken,
                walletAddress: walletAddress,
                walletId: walletId
            ),
            retryOnTransientNetworkLoss: true
        )
    }

    func tickets(ownerId: String) async throws -> [FanPassTicket] {
        try await get("/tickets/owner/\(ownerId)")
    }

    func ticket(ticketId: String) async throws -> FanPassTicket {
        try await get("/tickets/\(ticketId)")
    }

    func proofHistory(ticketId: String) async throws -> FanPassProofHistoryResponse {
        try await get("/tickets/\(ticketId)/proof-history")
    }

    func chainProof(ticketId: String) async throws -> FanPassChainProofResponse {
        try await get("/tickets/\(ticketId)/chain-proof")
    }

    func orderbook(eventId: String, ticketTypeId: String) async throws -> OrderbookSnapshot {
        try await get("/orders/events/\(eventId)/ticket-types/\(ticketTypeId)/book")
    }

    func createOrder(
        userId: String,
        eventId: String,
        ticketTypeId: String,
        side: String,
        fulfillmentMode: FanPassOrderFulfillmentMode = .any,
        price: Int,
        ticketId: String? = nil,
        idempotencyKey: String? = nil
    ) async throws -> CreateOrderResponse {
        struct CreateOrderRequest: Encodable {
            let userId: String
            let eventId: String
            let ticketTypeId: String
            let side: String
            let fulfillmentMode: String
            let price: Int
            let ticketId: String?
        }

        return try await post(
            "/orders",
            body: CreateOrderRequest(
                userId: userId,
                eventId: eventId,
                ticketTypeId: ticketTypeId,
                side: side,
                fulfillmentMode: fulfillmentMode.rawValue,
                price: price,
                ticketId: ticketId
            ),
            headers: idempotencyKey.map { ["Idempotency-Key": $0] } ?? [:],
            retryOnTransientNetworkLoss: idempotencyKey != nil
        )
    }

    func createPaymentIntent(orderId: String, idempotencyKey: String) async throws -> FanPassPaymentIntent {
        struct CreatePaymentIntentRequest: Encodable {
            let orderId: String
        }

        return try await post(
            "/payments/intents",
            body: CreatePaymentIntentRequest(orderId: orderId),
            headers: ["Idempotency-Key": idempotencyKey],
            retryOnTransientNetworkLoss: true
        )
    }

    func createCryptoQuote(orderId: String, asset: String = "USDC", idempotencyKey: String) async throws -> FanPassCryptoQuoteResponse {
        struct CreateCryptoQuoteRequest: Encodable {
            let orderId: String
            let asset: String
        }

        return try await post(
            "/payments/crypto-quotes",
            body: CreateCryptoQuoteRequest(orderId: orderId, asset: asset),
            headers: ["Idempotency-Key": idempotencyKey],
            retryOnTransientNetworkLoss: true
        )
    }

    func confirmCryptoPayment(paymentId: String, transactionHash: String, idempotencyKey: String) async throws -> FanPassCryptoConfirmationResponse {
        struct ConfirmCryptoPaymentRequest: Encodable {
            let transactionHash: String
        }

        return try await post(
            "/payments/crypto-quotes/\(paymentId)/confirm",
            body: ConfirmCryptoPaymentRequest(transactionHash: transactionHash),
            headers: ["Idempotency-Key": idempotencyKey],
            retryOnTransientNetworkLoss: true
        )
    }

    func sendSponsoredCryptoPayment(
        paymentId: String,
        idempotencyKey: String,
        authorization: FanPassPrivySponsoredAuthorization? = nil
    ) async throws -> FanPassCryptoConfirmationResponse {
        struct SponsoredCryptoPaymentRequest: Encodable {
            let authorizationSignature: String?
            let requestExpiry: Int64?
        }

        return try await post(
            "/payments/crypto-quotes/\(paymentId)/send-sponsored",
            body: SponsoredCryptoPaymentRequest(
                authorizationSignature: authorization?.authorizationSignature,
                requestExpiry: authorization?.requestExpiry
            ),
            headers: ["Idempotency-Key": idempotencyKey],
            retryOnTransientNetworkLoss: true
        )
    }

    func walletBalances() async throws -> FanPassWalletBalancesResponse {
        try await get("/wallet/balances", retryOnTransientNetworkLoss: true)
    }

    func userOrders(userId: String) async throws -> [FanPassOrder] {
        try await get("/orders/users/\(userId)")
    }

    func cancelOrder(orderId: String, userId: String) async throws -> FanPassOrder {
        struct CancelOrderRequest: Encodable {
            let userId: String
        }

        return try await post(
            "/orders/\(orderId)/cancel",
            body: CancelOrderRequest(userId: userId)
        )
    }

    func fanTasks(eventId: String) async throws -> [FanTask] {
        try await get("/fan-access/events/\(eventId)/tasks")
    }

    func fanCampaign(eventId: String) async throws -> FanCampaign? {
        try await get("/fan-access/events/\(eventId)/campaign")
    }

    func submitFanTask(taskId: String, proof: String? = nil) async throws -> FanTaskSubmission {
        struct SubmitTaskRequest: Encodable {
            let proof: String?
        }

        return try await post(
            "/fan-access/tasks/\(taskId)/submissions",
            body: SubmitTaskRequest(proof: proof)
        )
    }

    func fanScore(eventId: String, userId: String) async throws -> FanScore {
        try await get("/fan-access/events/\(eventId)/users/\(userId)/score")
    }

    func qrPayload(ticketId: String) async throws -> QRPayload {
        try await post("/verification/qr", body: ["ticketId": ticketId])
    }

    func redeem(payload: QRPayload, gate: String) async throws -> RedemptionResult {
        struct RedeemRequest: Encodable {
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
            let gate: String
        }

        let request = RedeemRequest(
            v: payload.v,
            credentialId: payload.credentialId,
            ticketId: payload.ticketId,
            eventId: payload.eventId,
            ticketTypeId: payload.ticketTypeId,
            ownerIdHash: payload.ownerIdHash,
            nonce: payload.nonce,
            issuedAt: payload.issuedAt,
            expiresAt: payload.expiresAt,
            entryMode: payload.entryMode,
            kid: payload.kid,
            signature: payload.signature,
            gate: gate
        )
        return try await post("/verification/redeem", body: request)
    }

    func validateNFC(ndefPayload: String, eventId: String, gate: String) async throws -> RedemptionResult {
        struct ValidateNFCRequest: Encodable {
            let eventId: String
            let gate: String
            let ndefPayload: String
        }

        return try await post(
            "/verification/nfc/validate",
            body: ValidateNFCRequest(eventId: eventId, gate: gate, ndefPayload: ndefPayload)
        )
    }

    func checkinSummary(eventId: String, gate: String) async throws -> CheckinSummary {
        try await get("/verification/events/\(eventId)/gates/\(gate)/checkins/summary")
    }

    func checkinHistory() async throws -> CheckinHistoryResponse {
        try await get("/verification/checkins/recent")
    }

    private func get<T: Decodable>(
        _ path: String,
        retryOnTransientNetworkLoss: Bool = true
    ) async throws -> T {
        try await retryingTransientFailures(enabled: retryOnTransientNetworkLoss) {
            try await performGet(path)
        }
    }

    private func performGet<T: Decodable>(_ path: String) async throws -> T {
        let url = baseURL.appending(path: path)
        var request = URLRequest(url: url)
        applyAuthorization(to: &request)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let apiError = decodeAPIError(data)
            if let http = response as? HTTPURLResponse,
               Self.isRetryableHTTPStatus(http.statusCode)
            {
                throw FanPassTransientHTTPError(apiError: apiError)
            }
            throw apiError
        }
        return try decoder.decode(T.self, from: data)
    }

    private func post<T: Decodable, Body: Encodable>(
        _ path: String,
        body: Body,
        headers: [String: String] = [:],
        retryOnTransientNetworkLoss: Bool = false
    ) async throws -> T {
        try await retryingTransientFailures(enabled: retryOnTransientNetworkLoss) {
            try await performPost(path, body: body, headers: headers)
        }
    }

    private func performPost<T: Decodable, Body: Encodable>(
        _ path: String,
        body: Body,
        headers: [String: String]
    ) async throws -> T {
        let url = baseURL.appending(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        headers.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }
        applyAuthorization(to: &request)
        request.httpBody = try encoder.encode(body)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let apiError = decodeAPIError(data)
            if let http = response as? HTTPURLResponse,
               Self.isRetryableHTTPStatus(http.statusCode)
            {
                throw FanPassTransientHTTPError(apiError: apiError)
            }
            throw apiError
        }
        if data.isEmpty {
            guard let emptyResponse = EmptyResponse() as? T else {
                throw APIClientError.invalidResponse
            }
            return emptyResponse
        }
        return try decoder.decode(T.self, from: data)
    }

    private func retryingTransientFailures<T>(
        enabled: Bool,
        operation: () async throws -> T
    ) async throws -> T {
        let retryDelays: [Duration] = [.milliseconds(300), .milliseconds(900)]
        var attempt = 0

        while true {
            do {
                return try await operation()
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                let surfacedError = (error as? FanPassTransientHTTPError)?.apiError ?? error
                guard enabled,
                      attempt < retryDelays.count,
                      isTransientNetworkFailure(error)
                else {
                    throw surfacedError
                }
                try await Task.sleep(for: retryDelays[attempt])
                attempt += 1
            }
        }
    }

    private func isTransientNetworkFailure(_ error: Error) -> Bool {
        if error is FanPassTransientHTTPError {
            return true
        }
        let nsError = error as NSError
        guard nsError.domain == NSURLErrorDomain else {
            return false
        }
        return nsError.code == NSURLErrorNetworkConnectionLost ||
            nsError.code == NSURLErrorCannotConnectToHost ||
            nsError.code == NSURLErrorCannotFindHost ||
            nsError.code == NSURLErrorNotConnectedToInternet ||
            nsError.code == NSURLErrorDNSLookupFailed ||
            nsError.code == NSURLErrorTimedOut
    }

    private static func isRetryableHTTPStatus(_ statusCode: Int) -> Bool {
        statusCode == 408 || statusCode == 425 || statusCode == 429 || (500...599).contains(statusCode)
    }

    private func applyAuthorization(to request: inout URLRequest) {
        guard let accessToken, !accessToken.isEmpty else {
            return
        }
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    }

    private func decodeAPIError(_ data: Data) -> APIClientError {
        guard let body = try? decoder.decode(APIErrorBody.self, from: data) else {
            return .invalidResponse
        }
        return .api(result: body.result, message: body.messageText)
    }
}

private enum FanPassNetworkSession {
    static let shared: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = true
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 30
        configuration.requestCachePolicy = .useProtocolCachePolicy
        configuration.urlCache = URLCache(
            memoryCapacity: 20 * 1_024 * 1_024,
            diskCapacity: 100 * 1_024 * 1_024
        )
        return URLSession(configuration: configuration)
    }()
}

private struct FanPassTransientHTTPError: Error {
    let apiError: APIClientError
}

struct FanPassWalletBalancesResponse: Codable, Hashable {
    let address: String?
    let chainId: String?
    let balances: [FanPassWalletBalance]
}

struct FanPassWalletBalance: Codable, Hashable, Identifiable {
    let asset: String
    let amount: String?
    let rawAmount: String?
    let decimals: Int
    let contractAddress: String?
    let status: String
    let updatedAt: String

    var id: String { asset }
}

struct EmptyResponse: Codable {}

private struct APIErrorBody: Decodable {
    let result: String?
    let message: Message

    var messageText: String {
        switch message {
        case let .string(value):
            value
        case let .strings(values):
            values.joined(separator: "\n")
        }
    }

    enum Message: Decodable {
        case string(String)
        case strings([String])

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let value = try? container.decode(String.self) {
                self = .string(value)
                return
            }
            self = .strings((try? container.decode([String].self)) ?? [])
        }
    }
}
