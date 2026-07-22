import { OrderbookRealtimeService } from "../src/modules/orders/orderbook-realtime.service";

describe("OrderbookRealtimeService subscription replay", () => {
  it("retains the latest full snapshot and revision for updates after a subscriber checkpoint", () => {
    const realtime = new OrderbookRealtimeService();
    const room = realtime.roomName("evt_public", "tt_public");
    const checkpoint = realtime.captureRevision(room);
    const snapshot = {
      eventId: "evt_public",
      ticketTypeId: "tt_public",
      bids: [],
      asks: [{ price: 880, quantity: 1 }],
      lastTradePrice: 900,
      floorPrice: 880,
      volume: 1,
      premiumPercent: 10,
      priceHistory: [],
    };

    realtime.publish({
      eventId: "evt_public",
      ticketTypeId: "tt_public",
      reason: "trade_settled",
      snapshot,
    });

    expect(realtime.latestSnapshotSince(room, checkpoint)).toMatchObject({
      revision: 1,
      snapshot,
    });
    expect(realtime.latestSnapshotSince(room, 1)).toBeNull();
  });
});
