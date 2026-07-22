import { ConfigService } from "@nestjs/config";
import { TrustedClientIdentity } from "../src/common/trusted-client-identity";
import { OrderbookAdmissionService } from "../src/modules/orders/orderbook-admission.service";
import { OrderbookGateway } from "../src/modules/orders/orderbook.gateway";

function createClient(remoteAddress = "203.0.113.44") {
  return {
    data: {},
    request: {
      headers: {},
      socket: { remoteAddress },
    },
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
  };
}

describe("OrderbookGateway subscription admission", () => {
  const snapshot = {
    eventId: "evt_public",
    ticketTypeId: "tt_public",
    bids: [],
    asks: [],
    lastTradePrice: null,
    floorPrice: null,
    volume: 0,
    premiumPercent: null,
    priceHistory: [],
  };

  function createGateway(overrides: Record<string, string> = {}) {
    const orderbook = {
      getOrderbook: jest.fn().mockResolvedValue(snapshot),
    };
    const realtime = {
      attach: jest.fn(),
      captureRevision: jest.fn().mockReturnValue(0),
      latestSnapshotSince: jest.fn().mockReturnValue(null),
      roomName: jest.fn(
        (eventId: string, ticketTypeId: string) =>
          `orderbook:${eventId}:${ticketTypeId}`,
      ),
    };
    const config = new ConfigService({
      FANPASS_ENV: "local",
      FANPASS_ORDERBOOK_ADMISSION_SECRET:
        "orderbook-admission-secret-with-32-characters",
      ...overrides,
    });
    const admission = new OrderbookAdmissionService(
      config,
      new TrustedClientIdentity(config),
    );
    return {
      gateway: new OrderbookGateway(
        orderbook as never,
        realtime as never,
        admission,
      ),
      orderbook,
      realtime,
      admission,
    };
  }

  it("rejects identifiers outside the HTTP route contract before work begins", async () => {
    const { gateway, orderbook } = createGateway();
    const client = createClient();

    await expect(
      gateway.subscribe(client as never, {
        eventId: "x".repeat(97),
        ticketTypeId: "tt_public",
      }),
    ).rejects.toThrow("eventId and ticketTypeId are invalid");
    expect(orderbook.getOrderbook).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it("does not join a room when the public snapshot is rejected", async () => {
    const { gateway, orderbook } = createGateway({
      FANPASS_ORDERBOOK_MAX_IN_FLIGHT_SNAPSHOTS_PER_ACTOR: "1",
    });
    const client = createClient();
    orderbook.getOrderbook.mockRejectedValueOnce(new Error("not public"));

    await expect(
      gateway.subscribe(client as never, {
        eventId: "evt_draft",
        ticketTypeId: "tt_draft",
      }),
    ).rejects.toThrow("not public");
    expect(client.join).not.toHaveBeenCalled();

    await expect(
      gateway.subscribe(createClient() as never, {
        eventId: "evt_public",
        ticketTypeId: "tt_public",
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("does not rejoin when unsubscribe cancels an in-flight subscription", async () => {
    const { gateway, orderbook } = createGateway();
    let resolveSnapshot!: (value: typeof snapshot) => void;
    orderbook.getOrderbook.mockImplementationOnce(
      () =>
        new Promise<typeof snapshot>((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
    const client = createClient();
    const input = {
      eventId: "evt_public",
      ticketTypeId: "tt_public",
    };

    const subscription = gateway.subscribe(client as never, input);
    await gateway.unsubscribe(client as never, input);
    resolveSnapshot(snapshot);

    await expect(subscription).resolves.toMatchObject({
      ok: true,
      cancelled: true,
    });
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).not.toHaveBeenCalled();
  });

  it("replays the latest full snapshot when an update lands during subscription", async () => {
    const { gateway, orderbook, realtime } = createGateway();
    let resolveSnapshot!: (value: typeof snapshot) => void;
    orderbook.getOrderbook.mockImplementationOnce(
      () =>
        new Promise<typeof snapshot>((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
    const latestSnapshot = {
      ...snapshot,
      floorPrice: 880,
      lastTradePrice: 900,
    };
    realtime.latestSnapshotSince.mockReturnValue({
      revision: 2,
      snapshot: latestSnapshot,
      emittedAt: "2026-07-20T00:00:02.000Z",
    });
    const client = createClient();

    const subscription = gateway.subscribe(client as never, {
      eventId: "evt_public",
      ticketTypeId: "tt_public",
    });
    resolveSnapshot(snapshot);
    await subscription;

    expect(realtime.captureRevision).toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      "orderbook.snapshot",
      expect.objectContaining({ snapshot: latestSnapshot, revision: 2 }),
    );
  });

  it("suppresses duplicate subscriptions without repeating the snapshot query", async () => {
    const { gateway, orderbook } = createGateway();
    const client = createClient();
    const input = {
      eventId: "evt_public",
      ticketTypeId: "tt_public",
    };

    await gateway.subscribe(client as never, input);
    const duplicate = await gateway.subscribe(client as never, input);

    expect(duplicate).toMatchObject({ ok: true, alreadySubscribed: true });
    expect(orderbook.getOrderbook).toHaveBeenCalledTimes(1);
    expect(client.join).toHaveBeenCalledTimes(1);
  });

  it("caps the number of active orderbook rooms on one socket", async () => {
    const { gateway, orderbook } = createGateway();
    const client = createClient();

    for (let index = 0; index < 8; index += 1) {
      await gateway.subscribe(client as never, {
        eventId: `evt_public_${index}`,
        ticketTypeId: `tt_public_${index}`,
      });
    }

    await expect(
      gateway.subscribe(client as never, {
        eventId: "evt_public_8",
        ticketTypeId: "tt_public_8",
      }),
    ).rejects.toThrow("Orderbook subscription limit reached");
    expect(orderbook.getOrderbook).toHaveBeenCalledTimes(8);
    expect(client.join).toHaveBeenCalledTimes(8);
  });

  it("allows two complete eight-room restores while sharing the next-work budget across replacement sockets", async () => {
    const { gateway, orderbook } = createGateway();
    const first = createClient();
    const second = createClient();
    for (let index = 0; index < 8; index += 1) {
      await gateway.subscribe(first as never, {
        eventId: `evt_restore_first_${index}`,
        ticketTypeId: `tt_restore_first_${index}`,
      });
    }
    await gateway.subscribe(first as never, {
      eventId: "evt_restore_first_0",
      ticketTypeId: "tt_restore_first_0",
    });
    for (let index = 0; index < 8; index += 1) {
      await gateway.subscribe(second as never, {
        eventId: `evt_restore_second_${index}`,
        ticketTypeId: `tt_restore_second_${index}`,
      });
    }

    await expect(
      gateway.subscribe(createClient() as never, {
        eventId: "evt_restore_over_budget",
        ticketTypeId: "tt_restore_over_budget",
      }),
    ).rejects.toThrow("Orderbook subscription rate limit exceeded");
    expect(orderbook.getOrderbook).toHaveBeenCalledTimes(16);
  });

  it("shares the in-flight snapshot ceiling across parallel sockets", async () => {
    const { gateway, orderbook } = createGateway();
    const resolvers: Array<(value: typeof snapshot) => void> = [];
    orderbook.getOrderbook.mockImplementation(
      () =>
        new Promise<typeof snapshot>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const first = gateway.subscribe(createClient() as never, {
      eventId: "evt_public_one",
      ticketTypeId: "tt_public_one",
    });
    const second = gateway.subscribe(createClient() as never, {
      eventId: "evt_public_two",
      ticketTypeId: "tt_public_two",
    });

    await expect(
      gateway.subscribe(createClient() as never, {
        eventId: "evt_public_three",
        ticketTypeId: "tt_public_three",
      }),
    ).rejects.toThrow("Too many orderbook subscriptions in progress");
    expect(orderbook.getOrderbook).toHaveBeenCalledTimes(2);

    resolvers.forEach((resolve) => resolve(snapshot));
    await Promise.all([first, second]);
  });
});
