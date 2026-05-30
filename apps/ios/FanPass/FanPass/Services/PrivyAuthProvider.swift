import Foundation

#if canImport(PrivySDK)
import PrivySDK
#endif

struct PrivyLoginResult: Equatable {
    let accessToken: String
    let email: String?
    let walletAddress: String?
}

enum PrivyAuthProviderError: LocalizedError, Equatable {
    case notConfigured
    case sdkUnavailable
    case missingAccessToken

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            "Privy is not configured for this build."
        case .sdkUnavailable:
            "Privy SDK is not linked into this build."
        case .missingAccessToken:
            "Privy did not return an access token."
        }
    }
}

@MainActor
protocol PrivyAuthProviding: AnyObject {
    var isAvailable: Bool { get }

    func sendEmailCode(to email: String) async throws
    func loginWithEmailCode(_ code: String, sentTo email: String) async throws -> PrivyLoginResult
    func signOut() async
}

@MainActor
final class FanPassPrivyAuthProvider: PrivyAuthProviding {
    #if canImport(PrivySDK)
    private static let sharedPrivy: Privy? = {
        guard let configuration = FanPassEnvironment.privyConfiguration else {
            return nil
        }

        let config = PrivyConfig(
            appId: configuration.appId,
            appClientId: configuration.appClientId
        )
        return PrivySdk.initialize(config: config)
    }()

    private var privy: Privy? {
        Self.sharedPrivy
    }
    #endif

    var isAvailable: Bool {
        #if canImport(PrivySDK)
        privy != nil
        #else
        false
        #endif
    }

    func sendEmailCode(to email: String) async throws {
        #if canImport(PrivySDK)
        guard let privy else {
            throw PrivyAuthProviderError.notConfigured
        }

        _ = await privy.getAuthState()
        try await privy.email.sendCode(to: email)
        #else
        throw PrivyAuthProviderError.sdkUnavailable
        #endif
    }

    func loginWithEmailCode(_ code: String, sentTo email: String) async throws -> PrivyLoginResult {
        #if canImport(PrivySDK)
        guard let privy else {
            throw PrivyAuthProviderError.notConfigured
        }

        _ = await privy.getAuthState()
        let user = try await privy.email.loginWithCode(code, sentTo: email)
        let accessToken = try await user.getAccessToken()
        guard !accessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw PrivyAuthProviderError.missingAccessToken
        }

        return PrivyLoginResult(
            accessToken: accessToken,
            email: email,
            walletAddress: nil
        )
        #else
        throw PrivyAuthProviderError.sdkUnavailable
        #endif
    }

    func signOut() async {
        #if canImport(PrivySDK)
        guard let privy,
              let user = await privy.getUser()
        else {
            return
        }

        await user.logout()
        #endif
    }
}
