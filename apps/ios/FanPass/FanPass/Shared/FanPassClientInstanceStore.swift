import Foundation
import Security

final class FanPassClientInstanceStore: @unchecked Sendable {
    static let shared = FanPassClientInstanceStore()

    private let service = "fun.fanpass.app.client-instance"
    private let account = "primary"
    private let lock = NSLock()

    private init() {}

    func identifier() -> String {
        lock.lock()
        defer { lock.unlock() }

        if let stored = readIdentifier() {
            return stored
        }
        let created = UUID().uuidString.lowercased()
        save(created)
        return created
    }

    private func readIdentifier() -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8),
              !value.isEmpty
        else {
            return nil
        }
        return value
    }

    private func save(_ value: String) {
        let data = Data(value.utf8)
        var query = baseQuery()
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemDelete(baseQuery() as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
