import XCTest
@testable import FanPass

final class FanPassV4APIMapperTests: XCTestCase {
    func testFractionalISO8601DateMapsToServerTime() throws {
        let mapped = try FanPassV4APIMapper.event(
            makeEvent(startTime: "2026-10-12T12:00:00.123Z")
        )

        let expected = try XCTUnwrap(utcDate(
            year: 2026,
            month: 10,
            day: 12,
            hour: 12,
            nanosecond: 123_000_000
        ))
        XCTAssertEqual(
            mapped.startTime.timeIntervalSince1970,
            expected.timeIntervalSince1970,
            accuracy: 0.001
        )
    }

    func testInvalidEventDateFailsClosed() {
        XCTAssertThrowsError(
            try FanPassV4APIMapper.event(makeEvent(startTime: "not-a-date"))
        ) { error in
            guard case let FanPassV4APIDataError.invalidEventDate(eventId, value) = error else {
                return XCTFail("Expected invalidEventDate, received \(error)")
            }
            XCTAssertEqual(eventId, "evt_test")
            XCTAssertEqual(value, "not-a-date")
        }
    }

    func testEventWithoutOrderbookDoesNotInventMarketPrices() throws {
        let mapped = try FanPassV4APIMapper.event(makeEvent())

        XCTAssertNil(mapped.marketSummary.floorPrice)
        XCTAssertNil(mapped.marketSummary.recentSale)
        XCTAssertNil(mapped.marketSummary.suggestedResalePrice)
        XCTAssertEqual(mapped.marketSummary.floorPriceLabel, "No asks")
        XCTAssertEqual(mapped.marketSummary.recentSaleLabel, "No sales")
        XCTAssertEqual(mapped.marketSummary.organizerCap, 120)
    }

    func testFanAccessAvailabilityComesFromPublicAPI() throws {
        XCTAssertFalse(try FanPassV4APIMapper.event(makeEvent(fanAccessAvailable: false)).fanAccessAvailable)
        XCTAssertTrue(try FanPassV4APIMapper.event(makeEvent(fanAccessAvailable: true)).fanAccessAvailable)
    }

    func testCryptoCompensationNeverQualifiesAsTicketSettlement() throws {
        let response = try decodeCryptoConfirmation(
            status: "crypto_compensation_required",
            ok: false,
            compensationRequired: true
        )

        XCTAssertFalse(response.isTicketSettlementConfirmed)
        XCTAssertEqual(response.compensationReason, "event_not_published")
    }

    func testOnlyConfirmedCryptoPaymentQualifiesAsTicketSettlement() throws {
        let response = try decodeCryptoConfirmation(
            status: "crypto_confirmed",
            ok: true,
            compensationRequired: false
        )

        XCTAssertTrue(response.isTicketSettlementConfirmed)
    }

    private func makeEvent(
        startTime: String = "2026-10-12T12:00:00.000Z",
        fanAccessAvailable: Bool? = false
    ) -> FanPassEvent {
        FanPassEvent(
            id: "evt_test",
            title: "Test Event",
            startTime: startTime,
            status: "PUBLISHED",
            fanAccessAvailable: fanAccessAvailable,
            venue: .init(name: "Test Venue", city: "Singapore"),
            ticketTypes: [
                TicketType(
                    id: "tt_test",
                    eventId: "evt_test",
                    name: "General Admission",
                    faceValue: 100,
                    currency: "USD",
                    supply: 100,
                    transferable: true,
                    resaleCap: 120,
                    maxTransferCount: 2
                )
            ]
        )
    }

    private func utcDate(
        year: Int,
        month: Int,
        day: Int,
        hour: Int,
        nanosecond: Int
    ) -> Date? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar.date(from: DateComponents(
            timeZone: calendar.timeZone,
            year: year,
            month: month,
            day: day,
            hour: hour,
            minute: 0,
            second: 0,
            nanosecond: nanosecond
        ))
    }

    private func decodeCryptoConfirmation(
        status: String,
        ok: Bool,
        compensationRequired: Bool
    ) throws -> FanPassCryptoConfirmationResponse {
        let json = """
        {
          "ok": \(ok),
          "payment": {
            "id": "pay_crypto_test",
            "orderId": "ord_crypto_test",
            "stripePaymentIntentId": "crypto:0xabc",
            "clientSecret": null,
            "amount": 1000,
            "currency": "usdc",
            "status": "\(status)",
            "captureStatus": "CAPTURED",
            "idempotencyKey": "ios-v4-crypto-test",
            "createdAt": "2026-07-20T00:00:00.000Z",
            "updatedAt": "2026-07-20T00:00:00.000Z"
          },
          "transactionHash": "0xabc",
          "alreadyConfirmed": false,
          "compensationRequired": \(compensationRequired),
          "compensationReason": "event_not_published"
        }
        """
        return try JSONDecoder().decode(
            FanPassCryptoConfirmationResponse.self,
            from: try XCTUnwrap(json.data(using: .utf8))
        )
    }
}
