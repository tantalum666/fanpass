import Foundation
import SocketIO

enum FanPassOrderbookRealtimeStatus: Equatable {
    case idle
    case connecting
    case live
    case offline

    var label: String {
        switch self {
        case .idle:
            "No feed"
        case .connecting:
            "Connecting"
        case .live:
            "Live"
        case .offline:
            "Offline"
        }
    }
}

struct FanPassOrderbookRealtimeUpdate: Equatable {
    let snapshot: OrderbookSnapshot
    let reason: String?
    let emittedAt: String?
}

@MainActor
final class FanPassOrderbookRealtimeClient {
    var onStatusChange: ((FanPassOrderbookRealtimeStatus) -> Void)?
    var onUpdate: ((FanPassOrderbookRealtimeUpdate) -> Void)?

    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private var subscription: OrderbookSubscription?
    private let decoder = JSONDecoder()

    func connect(
        apiBaseURL: URL,
        eventId: String,
        ticketTypeId: String
    ) {
        let nextSubscription = OrderbookSubscription(
            eventId: eventId,
            ticketTypeId: ticketTypeId
        )

        if subscription == nextSubscription, socket?.status == .connected {
            return
        }

        disconnect()
        subscription = nextSubscription
        onStatusChange?(.connecting)

        let socketURL = apiBaseURL.deletingLastPathComponentIfNeeded()
        let manager = SocketManager(
            socketURL: socketURL,
            config: [
                .compress,
                .reconnectAttempts(4),
                .reconnectWait(2),
                .log(false)
            ]
        )
        let socket = manager.socket(forNamespace: "/orderbook")
        self.manager = manager
        self.socket = socket

        socket.on(clientEvent: .connect) { [weak self] _, _ in
            Task { @MainActor in
                guard let self, self.subscription == nextSubscription else {
                    return
                }
                socket.emit("orderbook.subscribe", [
                    "eventId": eventId,
                    "ticketTypeId": ticketTypeId
                ])
            }
        }

        socket.on("orderbook.snapshot") { [weak self] data, _ in
            Task { @MainActor in
                self?.handleSnapshotPayload(data, fallback: nextSubscription)
            }
        }

        socket.on("orderbook.updated") { [weak self] data, _ in
            Task { @MainActor in
                self?.handleUpdatePayload(data, fallback: nextSubscription)
            }
        }

        socket.on(clientEvent: .disconnect) { [weak self] _, _ in
            Task { @MainActor in
                self?.onStatusChange?(.offline)
            }
        }

        socket.on(clientEvent: .error) { [weak self] _, _ in
            Task { @MainActor in
                self?.onStatusChange?(.offline)
            }
        }

        socket.connect()
    }

    func disconnect() {
        if let subscription, let socket {
            socket.emit("orderbook.unsubscribe", [
                "eventId": subscription.eventId,
                "ticketTypeId": subscription.ticketTypeId
            ])
        }
        socket?.removeAllHandlers()
        socket?.disconnect()
        manager?.disconnect()
        socket = nil
        manager = nil
        subscription = nil
        onStatusChange?(.idle)
    }

    private func handleSnapshotPayload(
        _ data: [Any],
        fallback: OrderbookSubscription
    ) {
        guard let payload = decodePayload(OrderbookSnapshotPayload.self, from: data),
              payload.eventId == fallback.eventId,
              payload.ticketTypeId == fallback.ticketTypeId
        else {
            return
        }

        onStatusChange?(.live)
        onUpdate?(
            FanPassOrderbookRealtimeUpdate(
                snapshot: payload.snapshot,
                reason: nil,
                emittedAt: payload.subscribedAt
            )
        )
    }

    private func handleUpdatePayload(
        _ data: [Any],
        fallback: OrderbookSubscription
    ) {
        guard let payload = decodePayload(OrderbookUpdatedPayload.self, from: data),
              payload.eventId == fallback.eventId,
              payload.ticketTypeId == fallback.ticketTypeId
        else {
            return
        }

        onStatusChange?(.live)
        onUpdate?(
            FanPassOrderbookRealtimeUpdate(
                snapshot: payload.snapshot,
                reason: payload.reason,
                emittedAt: payload.emittedAt
            )
        )
    }

    private func decodePayload<T: Decodable>(
        _ type: T.Type,
        from data: [Any]
    ) -> T? {
        guard let first = data.first else {
            return nil
        }

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: first)
            return try decoder.decode(T.self, from: jsonData)
        } catch {
            return nil
        }
    }
}

private struct OrderbookSubscription: Equatable {
    let eventId: String
    let ticketTypeId: String
}

private struct OrderbookSnapshotPayload: Decodable {
    let eventId: String
    let ticketTypeId: String
    let snapshot: OrderbookSnapshot
    let subscribedAt: String
}

private struct OrderbookUpdatedPayload: Decodable {
    let eventId: String
    let ticketTypeId: String
    let reason: String
    let snapshot: OrderbookSnapshot
    let emittedAt: String
}

private extension URL {
    func deletingLastPathComponentIfNeeded() -> URL {
        guard path != "/" && !path.isEmpty else {
            return self
        }
        return deletingLastPathComponent()
    }
}
