import { ConfigService } from "@nestjs/config";
import { IncomingMessage } from "http";
import { TrustedClientIdentity } from "../src/common/trusted-client-identity";
import {
  OrderbookAdmissionError,
  OrderbookAdmissionService,
} from "../src/modules/orders/orderbook-admission.service";

function createAdmission(overrides: Record<string, string> = {}) {
  const config = new ConfigService({
    FANPASS_ENV: "local",
    FANPASS_ORDERBOOK_ADMISSION_SECRET:
      "orderbook-admission-secret-with-32-characters",
    ...overrides,
  });
  return new OrderbookAdmissionService(
    config,
    new TrustedClientIdentity(config),
  );
}

function expectAdmissionCode(action: () => unknown, code: string) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(OrderbookAdmissionError);
    expect((error as OrderbookAdmissionError).code).toBe(code);
    return;
  }
  throw new Error(`Expected admission error ${code}`);
}

function request(remoteAddress: string) {
  return {
    headers: {},
    socket: { remoteAddress },
  } as IncomingMessage;
}

describe("OrderbookAdmissionService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-20T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shares one subscription-attempt budget across replacement sockets", () => {
    const admission = createAdmission();
    const actor = "anonymous:same-network";

    for (let attempt = 0; attempt < 8; attempt += 1) {
      admission.consumeSubscriptionAttempt(actor);
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
      admission.consumeSubscriptionAttempt(actor);
    }

    expectAdmissionCode(
      () => admission.consumeSubscriptionAttempt(actor),
      "ORDERBOOK_SUBSCRIPTION_RATE_LIMITED",
    );

    jest.advanceTimersByTime(10_000);
    expect(() => admission.consumeSubscriptionAttempt(actor)).not.toThrow();
  });

  it("shares the initial connection-attempt budget across replacement transports", () => {
    const admission = createAdmission({
      FANPASS_ORDERBOOK_CONNECTIONS_PER_MINUTE: "2",
    });

    admission.consumeConnectionAttempt(request("203.0.113.44"));
    admission.consumeConnectionAttempt(request("203.0.113.44"));

    expectAdmissionCode(
      () => admission.consumeConnectionAttempt(request("203.0.113.44")),
      "ORDERBOOK_CONNECTION_RATE_LIMITED",
    );
    expect(() =>
      admission.consumeConnectionAttempt(request("203.0.113.45")),
    ).not.toThrow();
  });

  it("bounds and idempotently releases per-actor and global connection leases", () => {
    const admission = createAdmission({
      FANPASS_ORDERBOOK_MAX_CONNECTIONS_PER_ACTOR: "1",
      FANPASS_ORDERBOOK_GLOBAL_CONNECTIONS: "2",
    });
    const first = admission.acquireConnection("anonymous:one");
    const second = admission.acquireConnection("anonymous:two");

    expectAdmissionCode(
      () => admission.acquireConnection("anonymous:one"),
      "ORDERBOOK_CONNECTION_LIMIT",
    );
    expectAdmissionCode(
      () => admission.acquireConnection("anonymous:three"),
      "ORDERBOOK_GLOBAL_CONNECTION_LIMIT",
    );

    first.release();
    first.release();
    expect(() => admission.acquireConnection("anonymous:three")).not.toThrow();
    second.release();
  });

  it("shares snapshot concurrency across parallel sockets and releases idempotently", () => {
    const admission = createAdmission();
    const actor = "anonymous:same-network";
    const first = admission.acquireSnapshot(actor);
    const second = admission.acquireSnapshot(actor);

    expectAdmissionCode(
      () => admission.acquireSnapshot(actor),
      "ORDERBOOK_SNAPSHOT_BUSY",
    );

    first.release();
    first.release();
    const replacement = admission.acquireSnapshot(actor);
    replacement.release();
    second.release();
  });

  it("enforces a global snapshot ceiling across distinct actors", () => {
    const admission = createAdmission({
      FANPASS_ORDERBOOK_GLOBAL_IN_FLIGHT_SNAPSHOTS: "2",
    });
    const first = admission.acquireSnapshot("anonymous:one");
    const second = admission.acquireSnapshot("anonymous:two");

    expectAdmissionCode(
      () => admission.acquireSnapshot("anonymous:three"),
      "ORDERBOOK_GLOBAL_SNAPSHOT_BUSY",
    );

    first.release();
    expect(() => admission.acquireSnapshot("anonymous:three")).not.toThrow();
    second.release();
  });

  it("fails closed at the identity-state cap and recovers expired inactive state", () => {
    const admission = createAdmission({
      FANPASS_ORDERBOOK_MAX_IDENTITIES: "2",
      FANPASS_ORDERBOOK_IDENTITY_TTL_MS: "1000",
    });
    admission.consumeSubscriptionAttempt("anonymous:one");
    admission.consumeSubscriptionAttempt("anonymous:two");

    expectAdmissionCode(
      () => admission.consumeSubscriptionAttempt("anonymous:three"),
      "ORDERBOOK_ADMISSION_CAPACITY",
    );

    jest.advanceTimersByTime(10_001);
    expect(() =>
      admission.consumeSubscriptionAttempt("anonymous:three"),
    ).not.toThrow();
  });
});
