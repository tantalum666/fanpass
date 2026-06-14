import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    var selectedTab: AppTab = .events
    var session: UserSession?
    var authRequest: AuthRequest?
    var apiClient = FanPassAPIClient(baseURL: FanPassEnvironment.apiBaseURL)
    let privyAuthProvider: PrivyAuthProviding

    init(privyAuthProvider: PrivyAuthProviding? = nil) {
        self.privyAuthProvider = privyAuthProvider ?? FanPassPrivyAuthProvider()
    }

    func register(name: String, email: String) async throws {
        session = try await apiClient.register(name: name, email: email)
        apiClient = apiClient.withAccessToken(session?.accessToken)
        authRequest = nil
    }

    func login(email: String) async throws {
        session = try await apiClient.login(email: email)
        apiClient = apiClient.withAccessToken(session?.accessToken)
        authRequest = nil
    }

    func continueAsDemoFan() async throws {
        session = try await apiClient.demoSession(userId: UserSession.demoFan.userId)
        apiClient = apiClient.withAccessToken(session?.accessToken)
        authRequest = nil
    }

    func sendPrivyEmailCode(email: String) async throws {
        try await privyAuthProvider.sendEmailCode(to: email)
    }

    func loginWithPrivyEmailCode(email: String, code: String) async throws {
        let privySession = try await privyAuthProvider.loginWithEmailCode(code, sentTo: email)
        try await loginWithPrivyAccessToken(
            privySession.accessToken,
            email: privySession.email,
            walletAddress: privySession.walletAddress
        )
    }

    func loginWithPrivyOAuth(_ provider: PrivyOAuthLoginProvider) async throws {
        let privySession = try await privyAuthProvider.loginWithOAuth(provider)
        try await loginWithPrivyAccessToken(
            privySession.accessToken,
            email: privySession.email,
            walletAddress: privySession.walletAddress
        )
    }

    func loginWithPrivyAccessToken(
        _ accessToken: String,
        email: String? = nil,
        walletAddress: String? = nil
    ) async throws {
        let fanPassSession = try await apiClient.syncPrivySession(
            privyAccessToken: accessToken,
            email: email,
            walletAddress: walletAddress
        )
        session = fanPassSession.withAccessToken(fanPassSession.accessToken ?? accessToken)
        apiClient = apiClient.withAccessToken(accessToken)
        authRequest = nil
    }

    func signOut() {
        let provider = privyAuthProvider
        Task { await provider.signOut() }
        session = nil
        apiClient = apiClient.withAccessToken(nil)
        selectedTab = .events
    }

    func requireAuth(_ request: AuthRequest) -> Bool {
        guard session == nil else {
            return true
        }

        authRequest = request
        return false
    }
}

enum AuthRequest: String, Identifiable {
    case checkout
    case wallet
    case market
    case fanAccess
    case profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .checkout: "Sign in to continue"
        case .wallet: "Sign in to view tickets"
        case .market: "Sign in to trade"
        case .fanAccess: "Sign in for access"
        case .profile: "Sign in to manage account"
        }
    }
}

enum AppTab: Hashable {
    case events
    case tickets
    case marketplace
    case fanAccess
    case profile

    var title: String {
        switch self {
        case .events: "Events"
        case .tickets: "Tickets"
        case .marketplace: "Market"
        case .fanAccess: "Access"
        case .profile: "Profile"
        }
    }

    var systemImage: String {
        switch self {
        case .events: "calendar"
        case .tickets: "ticket"
        case .marketplace: "chart.line.uptrend.xyaxis"
        case .fanAccess: "star"
        case .profile: "person.crop.circle"
        }
    }
}
