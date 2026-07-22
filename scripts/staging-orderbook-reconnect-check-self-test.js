const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { Server } = require("socket.io");
const {
  OrderbookHarnessError,
  loadOrderbookHarnessConfig,
  runOrderbookStagingHarness,
} = require("./lib/staging-orderbook-reconnect-harness");

const fixtureCookie =
  "fanpass_orderbook_client=fixture-secret-must-never-be-printed";
const fixtureRooms = Array.from({ length: 16 }, (_, index) => ({
  eventId: `evt_fixture_${String(index).padStart(2, "0")}`,
  ticketTypeId: `tt_fixture_${String(index).padStart(2, "0")}`,
}));

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Orderbook staging harness self-test failed",
    })}\n`,
  );
  process.exitCode = 1;
});

async function main() {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-orderbook-harness-"),
  );
  const roomsPath = path.join(tempDir, "rooms.json");
  const cookiePath = path.join(tempDir, "cookie.txt");
  fs.writeFileSync(roomsPath, JSON.stringify({ rooms: fixtureRooms }));
  fs.writeFileSync(cookiePath, fixtureCookie, { mode: 0o600 });

  const results = [];
  try {
    assertConfigFailure(
      {
        STAGING_ORDERBOOK_URL: "http://127.0.0.1:4100/orderbook",
        STAGING_ORDERBOOK_ORIGIN: "http://127.0.0.1:4100",
        STAGING_ORDERBOOK_ROOMS_FILE: roomsPath,
      },
      tempDir,
      "CONFIG_TLS_REQUIRED",
    );
    results.push("rejects localhost unless local fixture mode is explicit");

    assertConfigFailure(
      {
        STAGING_ORDERBOOK_URL: "http://staging.example.test/orderbook",
        STAGING_ORDERBOOK_ORIGIN: "http://staging.example.test",
        STAGING_ORDERBOOK_ROOMS_FILE: roomsPath,
        STAGING_ORDERBOOK_ALLOW_LOCAL_FIXTURE: "true",
      },
      tempDir,
      "CONFIG_LOCAL_FIXTURE_SCOPE_INVALID",
    );
    results.push("local fixture override cannot weaken a remote target");

    fs.chmodSync(cookiePath, 0o644);
    assertConfigFailure(
      localFixtureEnv(4100, roomsPath, cookiePath),
      tempDir,
      "CONFIG_COOKIE_FILE_UNSAFE",
    );
    fs.chmodSync(cookiePath, 0o600);
    results.push("rejects a cookie file readable by other users");

    const cookieSymlinkPath = path.join(tempDir, "cookie-link.txt");
    fs.symlinkSync(cookiePath, cookieSymlinkPath);
    assertConfigFailure(
      localFixtureEnv(4100, roomsPath, cookieSymlinkPath),
      tempDir,
      "CONFIG_COOKIE_FILE_UNSAFE",
    );
    results.push("rejects a symlinked cookie file");

    const shortRoomsPath = path.join(tempDir, "short-rooms.json");
    fs.writeFileSync(
      shortRoomsPath,
      JSON.stringify({ rooms: fixtureRooms.slice(0, 15) }),
    );
    assertConfigFailure(
      localFixtureEnv(4100, shortRoomsPath, cookiePath),
      tempDir,
      "CONFIG_ROOM_COUNT_INVALID",
    );
    results.push("requires the exact sixteen-room admission fixture");

    const happy = await runFixtureCase(tempDir, roomsPath, cookiePath, {});
    assert(happy.ok === true, "happy fixture must pass");
    assert(
      happy.admission.acceptedSubscriptionAttempts === 16 &&
        happy.admission.seventeenthAttemptRateLimited === true,
      "happy fixture must prove the 16/17 admission boundary",
    );
    assert(
      happy.continuity.proofScope ===
        "passive-live-update-to-reconnect-snapshot",
      "happy fixture must observe an update before reconnect",
    );
    const serializedHappy = JSON.stringify(happy);
    assert(
      !serializedHappy.includes(fixtureCookie) &&
        !serializedHappy.includes("fixture-secret") &&
        !fixtureRooms.some(
          (room) =>
            serializedHappy.includes(room.eventId) ||
            serializedHappy.includes(room.ticketTypeId),
        ),
      "result must not print the cookie or room identifiers",
    );
    results.push(
      "passes read-only reconnect, admission, race, and continuity checks",
    );

    await assertFixtureFailure(
      tempDir,
      roomsPath,
      cookiePath,
      { chargeDuplicate: true },
      "SUBSCRIPTION_EXPECTED_ACCEPTANCE",
    );
    results.push("detects duplicate subscriptions consuming admission budget");

    await assertFixtureFailure(
      tempDir,
      roomsPath,
      cookiePath,
      { resetBudgetOnConnection: true },
      "SEVENTEENTH_ATTEMPT_ACCEPTED",
    );
    results.push("detects reconnect resetting the stable actor budget");

    await assertFixtureFailure(
      tempDir,
      roomsPath,
      cookiePath,
      { staleReconnectSnapshot: true },
      "REVISION_REGRESSION",
    );
    results.push("detects a reconnect snapshot older than an observed update");

    await assertFixtureFailure(
      tempDir,
      roomsPath,
      cookiePath,
      { rejoinAfterPendingUnsubscribe: true },
      "PENDING_UNSUBSCRIBE_NOT_CANCELLED",
    );
    results.push("detects pending unsubscribe rejoining the room");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        cases: results.map((label) => ({ label, status: "passed" })),
        secretsRedacted: true,
        externalNetworkUsed: false,
      },
      null,
      2,
    )}\n`,
  );
}

async function runFixtureCase(tempDir, roomsPath, cookiePath, behavior) {
  const fixture = await startFixtureServer(behavior);
  try {
    const config = loadOrderbookHarnessConfig(
      localFixtureEnv(fixture.port, roomsPath, cookiePath),
      tempDir,
    );
    return await runOrderbookStagingHarness(config);
  } finally {
    await fixture.close();
  }
}

async function assertFixtureFailure(
  tempDir,
  roomsPath,
  cookiePath,
  behavior,
  expectedCode,
) {
  try {
    await runFixtureCase(tempDir, roomsPath, cookiePath, behavior);
  } catch (error) {
    assert(
      error instanceof OrderbookHarnessError && error.code === expectedCode,
      `expected ${expectedCode}, received ${safeErrorCode(error)}`,
    );
    assert(
      !String(error.message).includes(fixtureCookie) &&
        !String(error.message).includes("fixture-secret"),
      "failure diagnostics must not print the cookie",
    );
    return;
  }
  throw new Error(`expected fixture failure ${expectedCode}`);
}

function assertConfigFailure(env, cwd, expectedCode) {
  try {
    loadOrderbookHarnessConfig(env, cwd);
  } catch (error) {
    assert(
      error instanceof OrderbookHarnessError && error.code === expectedCode,
      `expected ${expectedCode}, received ${safeErrorCode(error)}`,
    );
    return;
  }
  throw new Error(`expected config failure ${expectedCode}`);
}

function localFixtureEnv(port, roomsPath, cookiePath) {
  return {
    STAGING_ORDERBOOK_URL: `http://127.0.0.1:${port}/orderbook`,
    STAGING_ORDERBOOK_ORIGIN: `http://127.0.0.1:${port}`,
    STAGING_ORDERBOOK_ROOMS_FILE: roomsPath,
    STAGING_ORDERBOOK_COOKIE_FILE: cookiePath,
    STAGING_ORDERBOOK_ALLOW_LOCAL_FIXTURE: "true",
    STAGING_ORDERBOOK_CONNECT_TIMEOUT_MS: "1000",
    STAGING_ORDERBOOK_OPERATION_TIMEOUT_MS: "1000",
    STAGING_ORDERBOOK_DUPLICATE_OBSERVATION_MS: "15",
    STAGING_ORDERBOOK_CONTINUITY_OBSERVATION_MS: "30",
    STAGING_ORDERBOOK_ADMISSION_WINDOW_MS: "250",
    STAGING_ORDERBOOK_ADMISSION_WINDOW_RESET_MS: "300",
    STAGING_ORDERBOOK_PENDING_RACE_OBSERVATION_MS: "60",
  };
}

async function startFixtureServer(behavior) {
  const server = http.createServer();
  const io = new Server(server, {
    transports: ["websocket"],
    cors: {
      origin: true,
      credentials: false,
    },
    allowRequest(request, callback) {
      const origin = request.headers.origin;
      const cookie = request.headers.cookie;
      callback(null, Boolean(origin && cookie === fixtureCookie));
    },
  });
  const actors = new Map();
  const roomRevisions = new Map(fixtureRooms.map((room) => [roomKey(room), 1]));
  const namespace = io.of("/orderbook");

  namespace.on("connection", (socket) => {
    const actorKey = socket.handshake.headers.cookie;
    const actor = actors.get(actorKey) ?? {
      attempts: 0,
      windowStartedAt: Date.now(),
      connections: 0,
      updatePublished: false,
    };
    actor.connections += 1;
    if (behavior.resetBudgetOnConnection) {
      actor.attempts = 0;
      actor.windowStartedAt = Date.now();
    }
    actors.set(actorKey, actor);
    const connectionOrdinal = actor.connections;
    const activeRooms = new Set();
    const pendingRooms = new Set();
    const generations = new Map();

    socket.on("orderbook.subscribe", async (room, acknowledge) => {
      const key = roomKey(room);
      if (behavior.chargeDuplicate) {
        if (!consumeAttempt(actor, socket)) {
          return;
        }
      }
      if (activeRooms.has(key)) {
        acknowledge({ ok: true, alreadySubscribed: true });
        return;
      }
      if (!behavior.chargeDuplicate && !consumeAttempt(actor, socket)) {
        return;
      }
      const generation = (generations.get(key) ?? 0) + 1;
      generations.set(key, generation);
      pendingRooms.add(key);
      await delay(key === roomKey(fixtureRooms[15]) ? 35 : 2);
      if (
        !behavior.rejoinAfterPendingUnsubscribe &&
        generations.get(key) !== generation
      ) {
        pendingRooms.delete(key);
        acknowledge({ ok: true, alreadySubscribed: false, cancelled: true });
        return;
      }
      pendingRooms.delete(key);
      activeRooms.add(key);
      await socket.join(key);
      let revision = roomRevisions.get(key) ?? 1;
      if (
        behavior.staleReconnectSnapshot &&
        connectionOrdinal === 2 &&
        key === roomKey(fixtureRooms[0])
      ) {
        revision = 1;
      }
      socket.emit("orderbook.snapshot", snapshotEnvelope(room, revision));
      acknowledge({ ok: true, alreadySubscribed: false });

      if (
        connectionOrdinal === 1 &&
        key === roomKey(fixtureRooms[0]) &&
        !actor.updatePublished
      ) {
        actor.updatePublished = true;
        setTimeout(() => {
          const nextRevision = (roomRevisions.get(key) ?? 1) + 1;
          roomRevisions.set(key, nextRevision);
          socket.emit("orderbook.updated", {
            ...snapshotEnvelope(room, nextRevision),
            reason: "order_created",
          });
        }, 5);
      }
    });

    socket.on("orderbook.unsubscribe", async (room, acknowledge) => {
      const key = roomKey(room);
      if (activeRooms.has(key) || pendingRooms.has(key)) {
        generations.set(key, (generations.get(key) ?? 0) + 1);
      }
      activeRooms.delete(key);
      await socket.leave(key);
      acknowledge({ ok: true });
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  assert(address && typeof address === "object", "fixture port unavailable");

  return {
    port: address.port,
    async close() {
      await new Promise((resolve) => io.close(resolve));
    },
  };
}

function consumeAttempt(actor, socket) {
  const now = Date.now();
  if (now - actor.windowStartedAt >= 250) {
    actor.windowStartedAt = now;
    actor.attempts = 0;
  }
  if (actor.attempts >= 16) {
    socket.emit("exception", {
      code: "ORDERBOOK_SUBSCRIPTION_RATE_LIMITED",
      message: "Orderbook subscription rate limit exceeded",
      retryAfterMs: 50,
    });
    return false;
  }
  actor.attempts += 1;
  return true;
}

function snapshotEnvelope(room, revision) {
  return {
    eventId: room.eventId,
    ticketTypeId: room.ticketTypeId,
    revision,
    snapshot: {
      eventId: room.eventId,
      ticketTypeId: room.ticketTypeId,
      bids: [],
      asks: [],
      lastTradePrice: null,
      floorPrice: null,
      volume: 0,
      premiumPercent: null,
      priceHistory: [],
    },
  };
}

function roomKey(room) {
  return `${room?.eventId ?? ""}:${room?.ticketTypeId ?? ""}`;
}

function safeErrorCode(error) {
  return error instanceof OrderbookHarnessError
    ? error.code
    : "UNEXPECTED_ERROR";
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
