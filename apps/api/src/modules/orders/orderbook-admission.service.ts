import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { IncomingMessage } from "http";
import { readIntegerConfig } from "../../config/security-config";
import { TrustedClientIdentity } from "../../common/trusted-client-identity";

export type OrderbookAdmissionErrorCode =
  | "ORDERBOOK_ADMISSION_CAPACITY"
  | "ORDERBOOK_CONNECTION_LIMIT"
  | "ORDERBOOK_CONNECTION_RATE_LIMITED"
  | "ORDERBOOK_GLOBAL_CONNECTION_LIMIT"
  | "ORDERBOOK_GLOBAL_SNAPSHOT_BUSY"
  | "ORDERBOOK_SNAPSHOT_BUSY"
  | "ORDERBOOK_SUBSCRIPTION_RATE_LIMITED";

export class OrderbookAdmissionError extends Error {
  constructor(
    readonly code: OrderbookAdmissionErrorCode,
    message: string,
    readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = "OrderbookAdmissionError";
  }
}

export interface OrderbookAdmissionLease {
  release(): void;
}

interface ActorAdmissionState {
  subscriptionWindowStartedAt: number;
  subscriptionAttempts: number;
  connectionWindowStartedAt: number;
  connectionAttempts: number;
  snapshotLeases: Set<string>;
  connectionLeases: Set<string>;
  lastTouchedAt: number;
}

const SUBSCRIPTION_WINDOW_MS = 10_000;
const CONNECTION_WINDOW_MS = 60_000;

@Injectable()
export class OrderbookAdmissionService {
  private readonly actors = new Map<string, ActorAdmissionState>();
  private readonly globalSnapshotLeases = new Set<string>();
  private readonly globalConnectionLeases = new Set<string>();

  private readonly maxIdentities: number;
  private readonly identityTtlMs: number;
  private readonly subscriptionAttemptsPerWindow: number;
  private readonly connectionAttemptsPerWindow: number;
  private readonly maxSnapshotsPerActor: number;
  private readonly maxGlobalSnapshots: number;
  private readonly maxConnectionsPerActor: number;
  private readonly maxGlobalConnections: number;

  constructor(
    config: ConfigService,
    private readonly identity: TrustedClientIdentity,
  ) {
    this.maxIdentities = readIntegerConfig(
      config,
      "FANPASS_ORDERBOOK_MAX_IDENTITIES",
      4_096,
    );
    this.identityTtlMs = readIntegerConfig(
      config,
      "FANPASS_ORDERBOOK_IDENTITY_TTL_MS",
      60_000,
    );
    this.subscriptionAttemptsPerWindow = readIntegerConfig(
      config,
      "FANPASS_ORDERBOOK_SUBSCRIPTIONS_PER_10_SECONDS",
      16,
    );
    this.connectionAttemptsPerWindow = readIntegerConfig(
      config,
      "FANPASS_ORDERBOOK_CONNECTIONS_PER_MINUTE",
      60,
    );
    this.maxSnapshotsPerActor = readIntegerConfig(
      config,
      "FANPASS_ORDERBOOK_MAX_IN_FLIGHT_SNAPSHOTS_PER_ACTOR",
      2,
    );
    this.maxGlobalSnapshots = readIntegerConfig(
      config,
      "FANPASS_ORDERBOOK_GLOBAL_IN_FLIGHT_SNAPSHOTS",
      32,
    );
    this.maxConnectionsPerActor = readIntegerConfig(
      config,
      "FANPASS_ORDERBOOK_MAX_CONNECTIONS_PER_ACTOR",
      32,
    );
    this.maxGlobalConnections = readIntegerConfig(
      config,
      "FANPASS_ORDERBOOK_GLOBAL_CONNECTIONS",
      512,
    );
  }

  actorKey(request: IncomingMessage) {
    return this.identity.actorKey(request);
  }

  consumeConnectionAttempt(request: IncomingMessage) {
    const actorKey = this.actorKey(request);
    const now = Date.now();
    const state = this.actorState(actorKey, now);
    if (now - state.connectionWindowStartedAt >= CONNECTION_WINDOW_MS) {
      state.connectionWindowStartedAt = now;
      state.connectionAttempts = 0;
    }
    if (state.connectionAttempts >= this.connectionAttemptsPerWindow) {
      throw new OrderbookAdmissionError(
        "ORDERBOOK_CONNECTION_RATE_LIMITED",
        "Orderbook connection rate limit exceeded",
        Math.max(
          1,
          CONNECTION_WINDOW_MS - (now - state.connectionWindowStartedAt),
        ),
      );
    }
    state.connectionAttempts += 1;
    state.lastTouchedAt = now;
    return actorKey;
  }

  acquireConnection(actorKey: string): OrderbookAdmissionLease {
    const now = Date.now();
    const state = this.actorState(actorKey, now);
    if (state.connectionLeases.size >= this.maxConnectionsPerActor) {
      throw new OrderbookAdmissionError(
        "ORDERBOOK_CONNECTION_LIMIT",
        "Too many orderbook connections from this network",
        1_000,
      );
    }
    if (this.globalConnectionLeases.size >= this.maxGlobalConnections) {
      throw new OrderbookAdmissionError(
        "ORDERBOOK_GLOBAL_CONNECTION_LIMIT",
        "Orderbook connection capacity is temporarily unavailable",
        1_000,
      );
    }

    const leaseId = randomUUID();
    state.connectionLeases.add(leaseId);
    state.lastTouchedAt = now;
    this.globalConnectionLeases.add(leaseId);
    return this.lease(() => {
      state.connectionLeases.delete(leaseId);
      this.globalConnectionLeases.delete(leaseId);
      state.lastTouchedAt = Date.now();
    });
  }

  consumeSubscriptionAttempt(actorKey: string) {
    const now = Date.now();
    const state = this.actorState(actorKey, now);
    if (now - state.subscriptionWindowStartedAt >= SUBSCRIPTION_WINDOW_MS) {
      state.subscriptionWindowStartedAt = now;
      state.subscriptionAttempts = 0;
    }
    if (state.subscriptionAttempts >= this.subscriptionAttemptsPerWindow) {
      throw new OrderbookAdmissionError(
        "ORDERBOOK_SUBSCRIPTION_RATE_LIMITED",
        "Orderbook subscription rate limit exceeded",
        Math.max(
          1,
          SUBSCRIPTION_WINDOW_MS - (now - state.subscriptionWindowStartedAt),
        ),
      );
    }
    state.subscriptionAttempts += 1;
    state.lastTouchedAt = now;
  }

  acquireSnapshot(actorKey: string): OrderbookAdmissionLease {
    const now = Date.now();
    const state = this.actorState(actorKey, now);
    if (state.snapshotLeases.size >= this.maxSnapshotsPerActor) {
      throw new OrderbookAdmissionError(
        "ORDERBOOK_SNAPSHOT_BUSY",
        "Too many orderbook subscriptions in progress",
        250,
      );
    }
    if (this.globalSnapshotLeases.size >= this.maxGlobalSnapshots) {
      throw new OrderbookAdmissionError(
        "ORDERBOOK_GLOBAL_SNAPSHOT_BUSY",
        "Orderbook snapshot capacity is temporarily unavailable",
        250,
      );
    }

    const leaseId = randomUUID();
    state.snapshotLeases.add(leaseId);
    state.lastTouchedAt = now;
    this.globalSnapshotLeases.add(leaseId);
    return this.lease(() => {
      state.snapshotLeases.delete(leaseId);
      this.globalSnapshotLeases.delete(leaseId);
      state.lastTouchedAt = Date.now();
    });
  }

  private actorState(actorKey: string, now: number) {
    const existing = this.actors.get(actorKey);
    if (existing) {
      existing.lastTouchedAt = now;
      return existing;
    }
    if (this.actors.size >= this.maxIdentities) {
      this.pruneInactiveActors(now);
    }
    if (this.actors.size >= this.maxIdentities) {
      throw new OrderbookAdmissionError(
        "ORDERBOOK_ADMISSION_CAPACITY",
        "Orderbook admission capacity is temporarily unavailable",
        1_000,
      );
    }

    const created: ActorAdmissionState = {
      subscriptionWindowStartedAt: now,
      subscriptionAttempts: 0,
      connectionWindowStartedAt: now,
      connectionAttempts: 0,
      snapshotLeases: new Set(),
      connectionLeases: new Set(),
      lastTouchedAt: now,
    };
    this.actors.set(actorKey, created);
    return created;
  }

  private pruneInactiveActors(now: number) {
    for (const [actorKey, state] of this.actors) {
      if (
        state.connectionLeases.size > 0 ||
        state.snapshotLeases.size > 0 ||
        now - state.lastTouchedAt < this.identityTtlMs ||
        (state.subscriptionAttempts > 0 &&
          now - state.subscriptionWindowStartedAt < SUBSCRIPTION_WINDOW_MS) ||
        (state.connectionAttempts > 0 &&
          now - state.connectionWindowStartedAt < CONNECTION_WINDOW_MS)
      ) {
        continue;
      }
      this.actors.delete(actorKey);
    }
  }

  private lease(releaseAction: () => void): OrderbookAdmissionLease {
    let released = false;
    return {
      release() {
        if (released) {
          return;
        }
        released = true;
        releaseAction();
      },
    };
  }
}
