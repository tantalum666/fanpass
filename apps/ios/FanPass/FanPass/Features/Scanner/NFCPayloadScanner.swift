import Foundation

#if canImport(CoreNFC)
import CoreNFC
#endif

final class NFCPayloadScanner: NSObject, ObservableObject {
    @Published private(set) var isReading = false
    @Published private(set) var lastError: String?

    var isAvailable: Bool {
        #if canImport(CoreNFC)
        NFCNDEFReaderSession.readingAvailable
        #else
        false
        #endif
    }

    private var onPayload: ((String) -> Void)?

    func begin(onPayload: @escaping (String) -> Void) {
        guard isAvailable else {
            lastError = Self.nfcUnavailableMessage
            return
        }

        self.onPayload = onPayload
        lastError = nil
        isReading = true

        #if canImport(CoreNFC)
        let session = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: true)
        session.alertMessage = "Hold FanPass Ops near the venue NFC tag."
        session.begin()
        #endif
    }

    private func finish(payload: String? = nil, error: String? = nil) {
        DispatchQueue.main.async {
            self.isReading = false
            self.lastError = error
            if let payload {
                self.onPayload?(payload)
            }
            self.onPayload = nil
        }
    }

    private static var nfcUnavailableMessage: String {
        #if DEBUG
        return "NFC reading is unavailable on this device. Use QR instead."
        #else
        return "NFC reading is unavailable on this device. Use QR instead."
        #endif
    }
}

#if canImport(CoreNFC)
extension NFCPayloadScanner: NFCNDEFReaderSessionDelegate {
    func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        let nsError = error as NSError
        if nsError.domain == NFCReaderError.errorDomain,
           nsError.code == NFCReaderError.readerSessionInvalidationErrorUserCanceled.rawValue {
            finish()
            return
        }

        finish(error: "NFC scan ended before a valid FanPass payload was read.")
    }

    func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        for message in messages {
            for record in message.records {
                if let payload = payloadString(from: record) {
                    session.alertMessage = "FanPass payload captured."
                    finish(payload: payload)
                    return
                }
            }
        }

        session.invalidate(errorMessage: "This tag does not contain a FanPass entry payload.")
        finish(error: "This NFC tag did not contain a readable FanPass payload.")
    }

    private func payloadString(from record: NFCNDEFPayload) -> String? {
        if let wellKnownText = wellKnownTextPayload(from: record) {
            return normalizedPayload(wellKnownText)
        }

        if let uriPayload = record.wellKnownTypeURIPayload()?.absoluteString,
           let normalized = normalizedPayload(uriPayload) {
            return normalized
        }

        return normalizedPayload(String(data: record.payload, encoding: .utf8))
    }

    private func wellKnownTextPayload(from record: NFCNDEFPayload) -> String? {
        guard record.typeNameFormat == .nfcWellKnown,
              let type = String(data: record.type, encoding: .utf8),
              type == "T",
              let status = record.payload.first
        else {
            return nil
        }

        let languageCodeLength = Int(status & 0x3F)
        let textStart = 1 + languageCodeLength
        guard record.payload.count > textStart else {
            return nil
        }

        let textData = record.payload.subdata(in: textStart..<record.payload.count)
        return String(data: textData, encoding: .utf8)
    }

    private func normalizedPayload(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty
        else {
            return nil
        }

        if trimmed.hasPrefix("fanpass://entry?payload="),
           let components = URLComponents(string: trimmed),
           let encodedPayload = components.queryItems?.first(where: { $0.name == "payload" })?.value,
           let decodedPayload = encodedPayload.removingPercentEncoding {
            return decodedPayload
        }

        return trimmed
    }
}
#endif
