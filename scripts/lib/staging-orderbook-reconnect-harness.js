const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { io } = require("socket.io-client");

const REQUIRED_ROOM_COUNT = 16;
const FANPASS_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/;
const RATE_LIMIT_CODE = "ORDERBOOK_SUBSCRIPTION_RATE_LIMITED";

class OrderbookHarnessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OrderbookHarnessError";
    this.code = code;
  }
}

function loadOrderbookHarnessConfig(env = process.env, cwd = process.cwd()) {
  const allowLocalFixture =
    env.STAGING_ORDERBOOK_ALLOW_LOCAL_FIXTURE === "true";
  const socketUrl = parseSocketUrl(
    requiredString(env.STAGING_ORDERBOOK_URL, "CONFIG_SOCKET_URL_REQUIRED"),
    allowLocalFixture,
  );
  const origin = parseOrigin(
    requiredString(env.STAGING_ORDERBOOK_ORIGIN, "CONFIG_ORIGIN_REQUIRED"),
    allowLocalFixture,
  );
  const rooms = readRoomsFile(
    requiredString(
      env.STAGING_ORDERBOOK_ROOMS_FILE,
      "CONFIG_ROOMS_FILE_REQUIRED",
    ),
    cwd,
  );
  const cookie = readOptionalCookieFile(env.STAGING_ORDERBOOK_COOKIE_FILE, cwd);
  const admissionWindowMs = integerSetting(
    env,
    "STAGING_ORDERBOOK_ADMISSION_WINDOW_MS",
    10_000,
    100,
    30_000,
  );
  const admissionWindowResetMs = integerSetting(
    env,
    "STAGING_ORDERBOOK_ADMISSION_WINDOW_RESET_MS",
    10_500,
    150,
    30_000,
  );
  if (admissionWindowResetMs <= admissionWindowMs) {
    throw new OrderbookHarnessError(
      "CONFIG_ADMISSION_RESET_TOO_SHORT",
      "STAGING_ORDERBOOK_ADMISSION_WINDOW_RESET_MS must be longer than STAGING_ORDERBOOK_ADMISSION_WINDOW_MS.",
    );
  }

  return {
    socketUrl: socketUrl.toString(),
    origin,
    rooms,
    cookie,
    allowLocalFixture,
    connectTimeoutMs: integerSetting(
      env,
      "STAGING_ORDERBOOK_CONNECT_TIMEOUT_MS",
      5_000,
      250,
      30_000,
    ),
    operationTimeoutMs: integerSetting(
      env,
      "STAGING_ORDERBOOK_OPERATION_TIMEOUT_MS",
      5_000,
      250,
      30_000,
    ),
    duplicateObservationMs: integerSetting(
      env,
      "STAGING_ORDERBOOK_DUPLICATE_OBSERVATION_MS",
      200,
      10,
      5_000,
    ),
    continuityObservationMs: integerSetting(
      env,
      "STAGING_ORDERBOOK_CONTINUITY_OBSERVATION_MS",
      500,
      10,
      10_000,
    ),
    admissionWindowMs,
    admissionWindowResetMs,
    pendingRaceObservationMs: integerSetting(
      env,
      "STAGING_ORDERBOOK_PENDING_RACE_OBSERVATION_MS",
      750,
      20,
      10_000,
    ),
  };
}

async function runOrderbookStagingHarness(config) {
  const firstConnection = await connectOrderbook(config);
  let firstMonitor;
  let firstSnapshot;
  const admissionStartedAt = Date.now();
  try {
    firstMonitor = monitorRoom(firstConnection, config.rooms[0]);
    firstSnapshot = await subscribeAccepted(
      firstConnection,
      config.rooms[0],
      config.operationTimeoutMs,
    );
    firstMonitor.observeSnapshot(firstSnapshot);
    await delay(config.continuityObservationMs);
    firstMonitor.assertHealthy();

    await assertDuplicateSubscriptionIsQuiet(
      firstConnection,
      config.rooms[0],
      config,
    );

    for (const room of config.rooms.slice(1, 8)) {
      await subscribeAccepted(firstConnection, room, config.operationTimeoutMs);
    }
    firstMonitor.assertHealthy();
  } finally {
    firstMonitor?.stop();
    closeSocket(firstConnection);
  }

  const highestRevisionBeforeReconnect = firstMonitor.highestRevision();
  const liveUpdatesBeforeReconnect = firstMonitor.liveUpdatesObserved();
  const secondConnection = await connectOrderbook(config);
  try {
    const reconnectSnapshot = await subscribeAccepted(
      secondConnection,
      config.rooms[0],
      config.operationTimeoutMs,
    );
    if (reconnectSnapshot.revision < highestRevisionBeforeReconnect) {
      throw new OrderbookHarnessError(
        "REVISION_REGRESSION",
        "The reconnect snapshot revision was older than the latest revision observed before reconnect.",
      );
    }

    for (const room of config.rooms.slice(8, 15)) {
      await subscribeAccepted(
        secondConnection,
        room,
        config.operationTimeoutMs,
      );
    }
  } finally {
    closeSocket(secondConnection);
  }

  const thirdConnection = await connectOrderbook(config);
  try {
    if (Date.now() - admissionStartedAt >= config.admissionWindowMs) {
      throw new OrderbookHarnessError(
        "ADMISSION_WINDOW_ELAPSED",
        "The sixteen accepted subscription attempts took too long to test the seventeenth attempt in the same admission window.",
      );
    }
    await expectSubscriptionRateLimit(
      thirdConnection,
      config.rooms[15],
      config.operationTimeoutMs,
    );
  } finally {
    closeSocket(thirdConnection);
  }

  await delay(config.admissionWindowResetMs);
  await verifyPendingUnsubscribeDoesNotRejoin(config, config.rooms[15]);

  return {
    ok: true,
    mode: config.allowLocalFixture ? "local-fixture" : "deployed-staging",
    sideEffects: "read-only-orderbook-subscribe-unsubscribe",
    secretsRedacted: true,
    stableIdentity: {
      serverDerivedNetworkIdentity: true,
      optionalCookieForwardedAcrossReconnects: Boolean(config.cookie),
      secretMaterialPrinted: false,
    },
    admission: {
      duplicateSubscriptionDidNotConsumeBudget: true,
      acceptedSubscriptionAttempts: 16,
      reconnectDidNotResetBudget: true,
      seventeenthAttemptRateLimited: true,
    },
    pendingSubscription: {
      unsubscribeCancelledPendingJoin: true,
      snapshotObservedAfterUnsubscribe: false,
    },
    continuity: {
      snapshotRevisionPresent: true,
      reconnectSnapshotNonRegressing: true,
      liveUpdateObserved: liveUpdatesBeforeReconnect > 0,
      proofScope:
        liveUpdatesBeforeReconnect > 0
          ? "passive-live-update-to-reconnect-snapshot"
          : "snapshot-monotonicity-only-no-market-mutation",
    },
  };
}

async function verifyPendingUnsubscribeDoesNotRejoin(config, room) {
  const socket = await connectOrderbook(config);
  let snapshotsAfterUnsubscribe = 0;
  let unsubscribeAcknowledged = false;
  const onSnapshot = (payload) => {
    if (
      unsubscribeAcknowledged &&
      payload?.eventId === room.eventId &&
      payload?.ticketTypeId === room.ticketTypeId
    ) {
      snapshotsAfterUnsubscribe += 1;
    }
  };
  socket.on("orderbook.snapshot", onSnapshot);

  try {
    const subscribeOutcomePromise = emitOutcome(
      socket,
      "orderbook.subscribe",
      room,
      config.operationTimeoutMs,
    );
    const unsubscribeAck = await emitAck(
      socket,
      "orderbook.unsubscribe",
      room,
      config.operationTimeoutMs,
    );
    assertBasicSuccessAck(unsubscribeAck, "UNSUBSCRIBE_ACK_INVALID");
    unsubscribeAcknowledged = true;

    const subscribeOutcome = await subscribeOutcomePromise;
    if (subscribeOutcome.kind !== "ack") {
      throw new OrderbookHarnessError(
        "PENDING_UNSUBSCRIBE_REJECTED",
        "The pending subscription did not return a cancellation acknowledgement.",
      );
    }
    const ack = subscribeOutcome.payload;
    if (ack?.ok !== true || ack.cancelled !== true) {
      throw new OrderbookHarnessError(
        "PENDING_UNSUBSCRIBE_NOT_CANCELLED",
        "Unsubscribing during snapshot preparation did not cancel the pending room join.",
      );
    }

    await delay(config.pendingRaceObservationMs);
    if (snapshotsAfterUnsubscribe > 0) {
      throw new OrderbookHarnessError(
        "PENDING_UNSUBSCRIBE_REJOINED",
        "A snapshot arrived after the pending subscription had been unsubscribed.",
      );
    }
  } finally {
    socket.off("orderbook.snapshot", onSnapshot);
    closeSocket(socket);
  }
}

async function assertDuplicateSubscriptionIsQuiet(socket, room, config) {
  let duplicateSnapshots = 0;
  const onSnapshot = (payload) => {
    if (
      payload?.eventId === room.eventId &&
      payload?.ticketTypeId === room.ticketTypeId
    ) {
      duplicateSnapshots += 1;
    }
  };
  socket.on("orderbook.snapshot", onSnapshot);
  try {
    const outcome = await emitOutcome(
      socket,
      "orderbook.subscribe",
      room,
      config.operationTimeoutMs,
    );
    if (
      outcome.kind !== "ack" ||
      outcome.payload?.ok !== true ||
      outcome.payload?.alreadySubscribed !== true
    ) {
      throw new OrderbookHarnessError(
        "DUPLICATE_SUBSCRIPTION_NOT_IDEMPOTENT",
        "A duplicate room subscription was not acknowledged as already subscribed.",
      );
    }
    await delay(config.duplicateObservationMs);
    if (duplicateSnapshots > 0) {
      throw new OrderbookHarnessError(
        "DUPLICATE_SUBSCRIPTION_EMITTED_SNAPSHOT",
        "A duplicate room subscription unexpectedly emitted another snapshot.",
      );
    }
  } finally {
    socket.off("orderbook.snapshot", onSnapshot);
  }
}

async function subscribeAccepted(socket, room, timeoutMs) {
  const snapshotPromise = waitForRoomSnapshot(socket, room, timeoutMs);
  let outcome;
  try {
    outcome = await emitOutcome(socket, "orderbook.subscribe", room, timeoutMs);
  } catch (error) {
    snapshotPromise.cancel();
    throw error;
  }
  if (outcome.kind !== "ack") {
    snapshotPromise.cancel();
    throw new OrderbookHarnessError(
      "SUBSCRIPTION_EXPECTED_ACCEPTANCE",
      "An orderbook subscription was rejected before the documented admission boundary.",
    );
  }
  if (
    outcome.payload?.ok !== true ||
    outcome.payload?.alreadySubscribed !== false
  ) {
    snapshotPromise.cancel();
    throw new OrderbookHarnessError(
      "SUBSCRIPTION_ACK_INVALID",
      "An accepted orderbook subscription returned an invalid acknowledgement.",
    );
  }
  const snapshot = await snapshotPromise.promise;
  validateSnapshotEnvelope(snapshot, room);
  return snapshot;
}

async function expectSubscriptionRateLimit(socket, room, timeoutMs) {
  const outcome = await emitOutcome(
    socket,
    "orderbook.subscribe",
    room,
    timeoutMs,
  );
  if (outcome.kind === "ack") {
    throw new OrderbookHarnessError(
      "SEVENTEENTH_ATTEMPT_ACCEPTED",
      "The seventeenth subscription attempt was accepted after reconnect.",
    );
  }
  const code = exceptionCode(outcome.payload);
  if (code !== RATE_LIMIT_CODE) {
    throw new OrderbookHarnessError(
      "SEVENTEENTH_ATTEMPT_WRONG_REJECTION",
      "The seventeenth subscription attempt was rejected for an unexpected reason.",
    );
  }
}

function monitorRoom(socket, room) {
  let highest = -1;
  let liveUpdates = 0;
  let violation = null;
  const onUpdate = (payload) => {
    if (
      payload?.eventId !== room.eventId ||
      payload?.ticketTypeId !== room.ticketTypeId
    ) {
      return;
    }
    if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) {
      violation = new OrderbookHarnessError(
        "UPDATE_REVISION_INVALID",
        "A live orderbook update carried an invalid revision.",
      );
      return;
    }
    if (payload.revision <= highest) {
      violation = new OrderbookHarnessError(
        "UPDATE_REVISION_NON_MONOTONIC",
        "Live orderbook revisions were not strictly increasing.",
      );
      return;
    }
    highest = payload.revision;
    liveUpdates += 1;
  };
  socket.on("orderbook.updated", onUpdate);
  return {
    observeSnapshot(payload) {
      validateSnapshotEnvelope(payload, room);
      highest = Math.max(highest, payload.revision);
    },
    assertHealthy() {
      if (violation) {
        throw violation;
      }
    },
    highestRevision() {
      if (highest < 0) {
        throw new OrderbookHarnessError(
          "SNAPSHOT_REVISION_MISSING",
          "No valid snapshot revision was observed before reconnect.",
        );
      }
      return highest;
    },
    liveUpdatesObserved() {
      return liveUpdates;
    },
    stop() {
      socket.off("orderbook.updated", onUpdate);
    },
  };
}

async function connectOrderbook(config) {
  return new Promise((resolve, reject) => {
    const extraHeaders = { Origin: config.origin };
    if (config.cookie) {
      extraHeaders.Cookie = config.cookie;
    }
    const socket = io(config.socketUrl, {
      transports: ["websocket"],
      timeout: config.connectTimeoutMs,
      reconnection: false,
      forceNew: true,
      extraHeaders,
    });
    const timer = setTimeout(() => {
      closeSocket(socket);
      reject(
        new OrderbookHarnessError(
          "SOCKET_CONNECT_TIMEOUT",
          "The orderbook WebSocket did not connect before the configured timeout.",
        ),
      );
    }, config.connectTimeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.off("connect_error", onConnectError);
      resolve(socket);
    });
    const onConnectError = () => {
      clearTimeout(timer);
      closeSocket(socket);
      reject(
        new OrderbookHarnessError(
          "SOCKET_CONNECT_REJECTED",
          "The orderbook WebSocket connection was rejected.",
        ),
      );
    };
    socket.once("connect_error", onConnectError);
  });
}

function emitOutcome(socket, eventName, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settle(() =>
        reject(
          new OrderbookHarnessError(
            "SOCKET_OPERATION_TIMEOUT",
            "The orderbook WebSocket operation exceeded its configured timeout.",
          ),
        ),
      );
    }, timeoutMs);
    const onException = (exception) => {
      settle(() => resolve({ kind: "exception", payload: exception }));
    };
    const settle = (action) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.off("exception", onException);
      action();
    };
    socket.on("exception", onException);
    socket.emit(eventName, payload, (ack) => {
      settle(() => resolve({ kind: "ack", payload: ack }));
    });
  });
}

async function emitAck(socket, eventName, payload, timeoutMs) {
  const outcome = await emitOutcome(socket, eventName, payload, timeoutMs);
  if (outcome.kind !== "ack") {
    throw new OrderbookHarnessError(
      "SOCKET_ACK_REJECTED",
      "The orderbook WebSocket operation was rejected.",
    );
  }
  return outcome.payload;
}

function waitForRoomSnapshot(socket, room, timeoutMs) {
  let settled = false;
  let onSnapshot;
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      settle(() =>
        reject(
          new OrderbookHarnessError(
            "SNAPSHOT_TIMEOUT",
            "The accepted orderbook subscription did not emit a snapshot before timeout.",
          ),
        ),
      );
    }, timeoutMs);
    onSnapshot = (payload) => {
      if (
        payload?.eventId === room.eventId &&
        payload?.ticketTypeId === room.ticketTypeId
      ) {
        settle(() => resolve(payload));
      }
    };
    const settle = (action) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.off("orderbook.snapshot", onSnapshot);
      action();
    };
    socket.on("orderbook.snapshot", onSnapshot);
  });
  return {
    promise,
    cancel() {
      if (settled) {
        return;
      }
      settled = true;
      socket.off("orderbook.snapshot", onSnapshot);
    },
  };
}

function validateSnapshotEnvelope(payload, room) {
  if (
    payload?.eventId !== room.eventId ||
    payload?.ticketTypeId !== room.ticketTypeId ||
    !payload.snapshot ||
    typeof payload.snapshot !== "object" ||
    !Number.isSafeInteger(payload.revision) ||
    payload.revision < 0
  ) {
    throw new OrderbookHarnessError(
      "SNAPSHOT_ENVELOPE_INVALID",
      "The orderbook snapshot envelope or revision was invalid.",
    );
  }
}

function assertBasicSuccessAck(payload, code) {
  if (payload?.ok !== true) {
    throw new OrderbookHarnessError(
      code,
      "The orderbook operation did not return a success acknowledgement.",
    );
  }
}

function exceptionCode(payload) {
  if (typeof payload?.code === "string") {
    return payload.code;
  }
  if (typeof payload?.message?.code === "string") {
    return payload.message.code;
  }
  return null;
}

function parseSocketUrl(value, allowLocalFixture) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new OrderbookHarnessError(
      "CONFIG_SOCKET_URL_INVALID",
      "STAGING_ORDERBOOK_URL must be an absolute URL.",
    );
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new OrderbookHarnessError(
      "CONFIG_SOCKET_URL_UNSAFE",
      "STAGING_ORDERBOOK_URL must not contain credentials, query parameters, or a fragment.",
    );
  }
  if (normalizePathname(parsed.pathname) !== "/orderbook") {
    throw new OrderbookHarnessError(
      "CONFIG_SOCKET_NAMESPACE_INVALID",
      "STAGING_ORDERBOOK_URL must target the /orderbook namespace.",
    );
  }
  assertTargetTransport(parsed, allowLocalFixture, "STAGING_ORDERBOOK_URL");
  return parsed;
}

function parseOrigin(value, allowLocalFixture) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new OrderbookHarnessError(
      "CONFIG_ORIGIN_INVALID",
      "STAGING_ORDERBOOK_ORIGIN must be an absolute origin.",
    );
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    normalizePathname(parsed.pathname) !== "/"
  ) {
    throw new OrderbookHarnessError(
      "CONFIG_ORIGIN_UNSAFE",
      "STAGING_ORDERBOOK_ORIGIN must contain only a scheme, host, and optional port.",
    );
  }
  assertTargetTransport(parsed, allowLocalFixture, "STAGING_ORDERBOOK_ORIGIN");
  return parsed.origin;
}

function assertTargetTransport(parsed, allowLocalFixture, label) {
  const loopback = isLoopbackHostname(parsed.hostname);
  if (allowLocalFixture) {
    if (!loopback || !["http:", "ws:"].includes(parsed.protocol)) {
      throw new OrderbookHarnessError(
        "CONFIG_LOCAL_FIXTURE_SCOPE_INVALID",
        `${label} local fixture mode only permits loopback HTTP or WS targets.`,
      );
    }
    return;
  }
  if (!["https:", "wss:"].includes(parsed.protocol)) {
    throw new OrderbookHarnessError(
      "CONFIG_TLS_REQUIRED",
      `${label} must use HTTPS or WSS for deployed staging.`,
    );
  }
  if (isNonPublicHostname(parsed.hostname)) {
    throw new OrderbookHarnessError(
      "CONFIG_PUBLIC_STAGING_REQUIRED",
      `${label} must not target localhost, a private address, or a local-only hostname.`,
    );
  }
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized.startsWith("127.")
  );
}

function isNonPublicHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    isLoopbackHostname(normalized) ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  const version = net.isIP(normalized);
  if (version === 4) {
    const [first, second] = normalized.split(".").map(Number);
    return (
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 0
    );
  }
  if (version === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized)
    );
  }
  return false;
}

function readRoomsFile(fileValue, cwd) {
  let contents;
  try {
    const filePath = path.resolve(cwd, fileValue);
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > 64 * 1024) {
      throw new Error("invalid room fixture file");
    }
    contents = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new OrderbookHarnessError(
      "CONFIG_ROOMS_FILE_UNREADABLE",
      "STAGING_ORDERBOOK_ROOMS_FILE must point to a readable regular JSON file no larger than 64 KiB.",
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new OrderbookHarnessError(
      "CONFIG_ROOMS_FILE_INVALID_JSON",
      "The orderbook room fixture file must contain valid JSON.",
    );
  }
  const rooms = Array.isArray(parsed) ? parsed : parsed?.rooms;
  if (!Array.isArray(rooms) || rooms.length !== REQUIRED_ROOM_COUNT) {
    throw new OrderbookHarnessError(
      "CONFIG_ROOM_COUNT_INVALID",
      `The orderbook room fixture must contain exactly ${REQUIRED_ROOM_COUNT} rooms.`,
    );
  }
  const normalized = rooms.map((room) => {
    if (
      !room ||
      typeof room !== "object" ||
      !FANPASS_ID_PATTERN.test(room.eventId) ||
      !FANPASS_ID_PATTERN.test(room.ticketTypeId)
    ) {
      throw new OrderbookHarnessError(
        "CONFIG_ROOM_ID_INVALID",
        "Every orderbook room fixture must contain valid eventId and ticketTypeId values.",
      );
    }
    return { eventId: room.eventId, ticketTypeId: room.ticketTypeId };
  });
  const uniqueRooms = new Set(
    normalized.map((room) => `${room.eventId}\u0000${room.ticketTypeId}`),
  );
  if (uniqueRooms.size !== REQUIRED_ROOM_COUNT) {
    throw new OrderbookHarnessError(
      "CONFIG_ROOMS_NOT_UNIQUE",
      "The orderbook room fixture must contain sixteen unique room pairs.",
    );
  }
  return normalized;
}

function readOptionalCookieFile(fileValue, cwd) {
  if (!fileValue) {
    return null;
  }
  let descriptor;
  try {
    const filePath = path.resolve(cwd, fileValue);
    descriptor = fs.openSync(
      filePath,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
    );
    const stat = fs.fstatSync(descriptor);
    if (
      !stat.isFile() ||
      stat.size === 0 ||
      stat.size > 4 * 1024 ||
      (process.platform !== "win32" && (stat.mode & 0o077) !== 0)
    ) {
      throw new Error("unsafe cookie file");
    }
    const cookie = fs.readFileSync(descriptor, "utf8").trim();
    if (
      !cookie ||
      cookie.includes("\r") ||
      cookie.includes("\n") ||
      !cookie.split(";").every((part) => /^[^=;\s]+=[^;]*$/.test(part.trim()))
    ) {
      throw new Error("invalid cookie header");
    }
    return cookie;
  } catch {
    throw new OrderbookHarnessError(
      "CONFIG_COOKIE_FILE_UNSAFE",
      "STAGING_ORDERBOOK_COOKIE_FILE must be a private non-symlink regular file containing one valid Cookie header and mode 0600 or stricter.",
    );
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
  }
}

function requiredString(value, code) {
  if (typeof value !== "string" || !value.trim()) {
    throw new OrderbookHarnessError(
      code,
      "A required orderbook staging harness setting is missing.",
    );
  }
  return value.trim();
}

function integerSetting(env, name, fallback, minimum, maximum) {
  const raw = env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  if (!/^\d+$/.test(raw)) {
    throw new OrderbookHarnessError(
      "CONFIG_TIMEOUT_INVALID",
      `${name} must be an integer number of milliseconds.`,
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new OrderbookHarnessError(
      "CONFIG_TIMEOUT_OUT_OF_RANGE",
      `${name} must be between ${minimum} and ${maximum} milliseconds.`,
    );
  }
  return value;
}

function normalizePathname(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function closeSocket(socket) {
  if (!socket) {
    return;
  }
  socket.removeAllListeners();
  socket.close();
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = {
  OrderbookHarnessError,
  loadOrderbookHarnessConfig,
  runOrderbookStagingHarness,
};
