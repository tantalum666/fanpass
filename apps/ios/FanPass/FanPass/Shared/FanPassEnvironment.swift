import Foundation

enum FanPassEnvironment {
    static let stripeReturnURL = "fanpass-payments://stripe-redirect"
    static let privyOAuthURLScheme = "fanpass-payments"

    struct PrivyConfiguration: Equatable {
        let appId: String
        let appClientId: String
    }

    static var apiBaseURL: URL {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "FanPassAPIBaseURL") as? String,
              !rawValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !rawValue.hasPrefix("$("),
              let url = URL(string: rawValue)
        else {
            return localDevelopmentAPIBaseURL
        }

        assertSafeDistributionURL(url)
        return url
    }

    static var stripePublishableKey: String? {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "FanPassStripePublishableKey") as? String else {
            return nil
        }

        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              !trimmed.hasPrefix("$("),
              !trimmed.lowercased().contains("replace-me"),
              isStripeTestPublishableKey(trimmed)
        else {
            return nil
        }

        return trimmed
    }

    static var privyConfiguration: PrivyConfiguration? {
        guard let appId = publicConfigValue("FanPassPrivyAppID"),
              let appClientId = publicConfigValue("FanPassPrivyAppClientID")
        else {
            return nil
        }

        return PrivyConfiguration(appId: appId, appClientId: appClientId)
    }

    private static var localDevelopmentAPIBaseURL: URL {
        #if DEBUG
        URL(string: "http://localhost:4000")!
        #else
        fatalError("FanPassAPIBaseURL must be configured for non-Debug builds.")
        #endif
    }

    private static func assertSafeDistributionURL(_ url: URL) {
        #if !DEBUG
        let host = url.host?.lowercased()
        if url.scheme != "https" ||
            host == "localhost" ||
            host == "127.0.0.1" ||
            host?.contains("replace-me") == true {
            fatalError("Non-Debug builds must use a non-local HTTPS FanPass API base URL.")
        }
        #endif
    }

    private static func publicConfigValue(_ key: String) -> String? {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
            return nil
        }

        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              !trimmed.hasPrefix("$("),
              !trimmed.lowercased().contains("replace-me"),
              !containsProviderSecretMarker(trimmed)
        else {
            return nil
        }

        return trimmed
    }

    private static func isStripeTestPublishableKey(_ value: String) -> Bool {
        value.hasPrefix("pk_test_")
    }

    private static func containsProviderSecretMarker(_ value: String) -> Bool {
        let normalized = value.lowercased()
        return [
            "authorization: bearer",
            "bearer ",
            "eyjhbgci",
            "-----begin ",
            "privy_app_secret",
            "privy_verification_key",
            "privy_access_token",
            "sk_test_",
            "sk_live_",
            "pk_test_",
            "pk_live_",
            "whsec_",
            "client_secret",
            "database_url",
        ].contains { normalized.contains($0) }
    }
}
