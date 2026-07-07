import Foundation
import Security

protocol FanPassSessionStoring: AnyObject {
    func loadValidSession(now: Date) -> UserSession?
    func save(_ session: UserSession)
    func clear()
}

final class FanPassKeychainSessionStore: FanPassSessionStoring {
    private let service = "fun.fanpass.app.session"
    private let account = "primary"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
    private let fractionalIsoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    func loadValidSession(now: Date = Date()) -> UserSession? {
        guard let data = readData(),
              let session = try? decoder.decode(UserSession.self, from: data),
              isPersistable(session),
              isValid(session, now: now)
        else {
            clear()
            return nil
        }
        return session
    }

    func save(_ session: UserSession) {
        guard isPersistable(session),
              let data = try? encoder.encode(session)
        else {
            clear()
            return
        }

        let query = baseQuery()
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var addQuery = query
            attributes.forEach { addQuery[$0.key] = $0.value }
            SecItemAdd(addQuery as CFDictionary, nil)
        }
    }

    func clear() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    private func readData() -> Data? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else {
            return nil
        }
        return result as? Data
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    private func isPersistable(_ session: UserSession) -> Bool {
        guard let token = session.accessToken?.trimmingCharacters(in: .whitespacesAndNewlines),
              !token.isEmpty,
              token != "local-review-token"
        else {
            return false
        }
        return true
    }

    private func isValid(_ session: UserSession, now: Date) -> Bool {
        guard let expiresAt = session.expiresAt else {
            return session.authProvider == "privy"
        }
        guard let expiry = fractionalIsoFormatter.date(from: expiresAt) ?? isoFormatter.date(from: expiresAt) else {
            return false
        }
        return expiry > now
    }
}
