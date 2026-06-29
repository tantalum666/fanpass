import Foundation

#if canImport(PrivySDK)
import PrivySDK
#endif

struct PrivyLoginResult: Equatable {
    let accessToken: String
    let email: String?
    let walletAddress: String?
    let walletId: String?
}

enum PrivyOAuthLoginProvider: String, CaseIterable, Identifiable, Hashable {
    case google
    case twitter
    case discord

    var id: String { rawValue }

    var title: String {
        switch self {
        case .google: "Google"
        case .twitter: "X"
        case .discord: "Discord"
        }
    }

    var logoAssetName: String {
        switch self {
        case .google: "auth-google-logo"
        case .twitter: "auth-x-logo"
        case .discord: "auth-discord-symbol"
        }
    }
}

enum PrivyAuthProviderError: LocalizedError, Equatable {
    case notConfigured
    case sdkUnavailable
    case missingAccessToken
    case missingEmbeddedWallet
    case invalidTransferRequest

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            "Email login is temporarily unavailable."
        case .sdkUnavailable:
            "Sign-in service is unavailable in this build."
        case .missingAccessToken:
            "Sign-in did not return a valid session."
        case .missingEmbeddedWallet:
            "Embedded wallet is unavailable for this account."
        case .invalidTransferRequest:
            "Wallet payment could not be prepared."
        }
    }
}

@MainActor
protocol PrivyAuthProviding: AnyObject {
    var isAvailable: Bool { get }

    func sendEmailCode(to email: String) async throws
    func loginWithEmailCode(_ code: String, sentTo email: String) async throws -> PrivyLoginResult
    func loginWithOAuth(_ provider: PrivyOAuthLoginProvider) async throws -> PrivyLoginResult
    func sendUSDCTransfer(quote: FanPassCryptoQuote) async throws -> String
    func sponsoredPaymentAuthorization(quote: FanPassCryptoQuote, walletId: String) async throws -> FanPassPrivySponsoredAuthorization
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
        return try await loginResult(for: user, fallbackEmail: email)
        #else
        throw PrivyAuthProviderError.sdkUnavailable
        #endif
    }

    func loginWithOAuth(_ provider: PrivyOAuthLoginProvider) async throws -> PrivyLoginResult {
        #if canImport(PrivySDK)
        guard let privy else {
            throw PrivyAuthProviderError.notConfigured
        }

        _ = await privy.getAuthState()
        let user = try await privy.oAuth.login(
            with: provider.oauthProvider,
            appUrlScheme: FanPassEnvironment.privyOAuthURLScheme
        )
        return try await loginResult(for: user, fallbackEmail: nil)
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

    func sendUSDCTransfer(quote: FanPassCryptoQuote) async throws -> String {
        #if canImport(PrivySDK)
        guard let privy,
              let user = await privy.getUser()
        else {
            throw PrivyAuthProviderError.notConfigured
        }

        let wallet = try await ethereumWallet(for: user)
        let chainId = try chainId(from: quote.chainId)
        let currentChainId = await wallet.provider.chainId
        if currentChainId != chainId {
            await wallet.provider.switchChain(chainId: chainId, rpcUrl: nil)
        }

        let transaction = EthereumRpcRequest.UnsignedEthTransaction(
            from: wallet.address,
            to: quote.tokenContractAddress,
            data: quote.erc20TransferData,
            value: .hexadecimalNumber("0x0"),
            chainId: .int(chainId)
        )
        let request = try EthereumRpcRequest.ethSendTransaction(transaction: transaction)
        let transactionHash = try await wallet.provider.request(request).lowercased()
        guard transactionHash.range(
            of: #"^0x[0-9a-f]{64}$"#,
            options: .regularExpression
        ) != nil else {
            throw PrivyAuthProviderError.invalidTransferRequest
        }
        return transactionHash
        #else
        throw PrivyAuthProviderError.sdkUnavailable
        #endif
    }

    func sponsoredPaymentAuthorization(quote: FanPassCryptoQuote, walletId: String) async throws -> FanPassPrivySponsoredAuthorization {
        #if canImport(PrivySDK)
        guard let configuration = FanPassEnvironment.privyConfiguration,
              let privy,
              let user = await privy.getUser()
        else {
            throw PrivyAuthProviderError.notConfigured
        }

        let wallet = try await ethereumWallet(for: user)
        guard wallet.id == walletId else {
            throw PrivyAuthProviderError.missingEmbeddedWallet
        }

        let requestExpiry = Int64(Date().timeIntervalSince1970 * 1_000) + 60_000
        let body = PrivySponsoredEthereumRpcBody(
            caip2: "eip155:\(try chainId(from: quote.chainId))",
            params: .init(
                transaction: .init(
                    to: quote.tokenContractAddress,
                    data: quote.erc20TransferData,
                    value: "0x0"
                )
            )
        )
        let payload = WalletApiPayload(
            version: 1,
            url: Self.walletRpcUrl(walletId: walletId),
            method: "POST",
            headers: [
                "privy-app-id": configuration.appId,
                "privy-request-expiry": String(requestExpiry)
            ],
            body: body
        )
        let signature = try await user.generateAuthorizationSignature(payload: payload)
        guard !signature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw PrivyAuthProviderError.invalidTransferRequest
        }
        return FanPassPrivySponsoredAuthorization(
            authorizationSignature: signature,
            requestExpiry: requestExpiry
        )
        #else
        throw PrivyAuthProviderError.sdkUnavailable
        #endif
    }

    #if canImport(PrivySDK)
    private func loginResult(for user: any PrivyUser, fallbackEmail: String?) async throws -> PrivyLoginResult {
        let accessToken = try await user.getAccessToken()
        guard !accessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw PrivyAuthProviderError.missingAccessToken
        }
        let wallet = try await ethereumWallet(for: user)

        return PrivyLoginResult(
            accessToken: accessToken,
            email: emailAddress(for: user) ?? fallbackEmail,
            walletAddress: wallet.address,
            walletId: wallet.id
        )
    }

    private func ethereumWallet(for user: any PrivyUser) async throws -> any EmbeddedEthereumWallet {
        if let wallet = user.embeddedEthereumWallets.first {
            return wallet
        }
        let wallet = try await user.createEthereumWallet()
        guard !wallet.address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw PrivyAuthProviderError.missingEmbeddedWallet
        }
        return wallet
    }

    private func chainId(from value: String) throws -> Int {
        let raw = value.split(separator: ":").last.map(String.init) ?? value
        guard let chainId = Int(raw), chainId > 0 else {
            throw PrivyAuthProviderError.invalidTransferRequest
        }
        return chainId
    }

    private static func walletRpcUrl(walletId: String) -> String {
        "https://api.privy.io/v1/wallets/\(walletId)/rpc"
    }

    private func emailAddress(for user: any PrivyUser) -> String? {
        for account in user.linkedAccounts {
            switch account {
            case .email(let email):
                return email.email
            case .google(let google):
                return google.email
            case .twitter:
                continue
            case .discord(let discord):
                if let email = discord.email {
                    return email
                }
            case .apple(let apple):
                return apple.email
            default:
                continue
            }
        }
        return nil
    }
    #endif
}

#if canImport(PrivySDK)
private struct PrivySponsoredEthereumRpcBody: Encodable {
    let caip2: String
    let chainType = "ethereum"
    let method = "eth_sendTransaction"
    let params: Params
    let sponsor = true

    enum CodingKeys: String, CodingKey {
        case caip2
        case chainType = "chain_type"
        case method
        case params
        case sponsor
    }

    struct Params: Encodable {
        let transaction: Transaction
    }

    struct Transaction: Encodable {
        let to: String
        let data: String
        let value: String
    }
}

private extension PrivyOAuthLoginProvider {
    var oauthProvider: OAuthProvider {
        switch self {
        case .google: .google
        case .twitter: .twitter
        case .discord: .discord
        }
    }
}
#endif
