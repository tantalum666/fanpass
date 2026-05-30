import Foundation

struct FanPassCheckoutDraft: Identifiable, Hashable {
    let order: FanPassOrder
    let payment: FanPassPaymentIntent
    let eventTitle: String
    let ticketTypeName: String

    var id: String { payment.id }
}

struct FanPassPaymentCoordinator {
    let apiClient: FanPassAPIClient

    func prepareCheckout(
        order: FanPassOrder,
        eventTitle: String,
        ticketTypeName: String
    ) async throws -> FanPassCheckoutDraft {
        let payment = try await apiClient.createPaymentIntent(
            orderId: order.id,
            idempotencyKey: "ios-payment-intent:\(order.id)"
        )

        return FanPassCheckoutDraft(
            order: order,
            payment: payment,
            eventTitle: eventTitle,
            ticketTypeName: ticketTypeName
        )
    }
}
