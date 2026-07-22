import { IoAdapter } from "@nestjs/platform-socket.io";
import { EventEmitter } from "events";
import { IncomingMessage } from "http";
import { ServerOptions } from "socket.io";
import { FanPassSocketIoAdapter } from "../src/common/fanpass-socket-io.adapter";

function request(options?: { origin?: string; sid?: string }) {
  return {
    headers: options?.origin !== undefined ? { origin: options.origin } : {},
    socket: { remoteAddress: "203.0.113.10" },
    url: `/socket.io/?EIO=4&transport=polling${
      options?.sid ? `&sid=${options.sid}` : ""
    }`,
  } as IncomingMessage;
}

async function evaluateAllowRequest(
  options: ServerOptions,
  incoming: IncomingMessage,
) {
  return new Promise<{ error: string | null | undefined; allowed: boolean }>(
    (resolve) => {
      options.allowRequest?.(incoming, (error, allowed) => {
        resolve({ error, allowed });
      });
    },
  );
}

describe("FanPassSocketIoAdapter", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("admits an allowed browser origin only after the initial handshake budget passes", async () => {
    const createServer = jest
      .spyOn(IoAdapter.prototype, "createIOServer")
      .mockReturnValue({});
    const admitConnection = jest.fn().mockResolvedValue(undefined);
    const adapter = new FanPassSocketIoAdapter(
      {} as never,
      ["https://console.fanpass.test"],
      admitConnection,
    );

    adapter.createIOServer(0);

    const options = createServer.mock.calls[0]?.[1] as ServerOptions;
    await expect(
      evaluateAllowRequest(
        options,
        request({ origin: "https://console.fanpass.test" }),
      ),
    ).resolves.toEqual({ error: null, allowed: true });
    expect(admitConnection).toHaveBeenCalledTimes(1);
  });

  it("preserves originless native clients while rejecting untrusted browser origins", async () => {
    const createServer = jest
      .spyOn(IoAdapter.prototype, "createIOServer")
      .mockReturnValue({});
    const admitConnection = jest.fn().mockResolvedValue(undefined);
    const adapter = new FanPassSocketIoAdapter(
      {} as never,
      ["https://console.fanpass.test"],
      admitConnection,
    );

    adapter.createIOServer(0);

    const options = createServer.mock.calls[0]?.[1] as ServerOptions;
    await expect(evaluateAllowRequest(options, request())).resolves.toEqual({
      error: null,
      allowed: true,
    });
    await expect(
      evaluateAllowRequest(options, request({ origin: "" })),
    ).resolves.toEqual({ error: null, allowed: true });
    await expect(
      evaluateAllowRequest(
        options,
        request({ origin: "https://attacker.example" }),
      ),
    ).resolves.toEqual({ error: null, allowed: false });
    expect(admitConnection).toHaveBeenCalledTimes(2);
  });

  it("does not charge polling continuations or WebSocket upgrades carrying an engine sid", async () => {
    const createServer = jest
      .spyOn(IoAdapter.prototype, "createIOServer")
      .mockReturnValue({});
    const admitConnection = jest.fn().mockResolvedValue(undefined);
    const adapter = new FanPassSocketIoAdapter(
      {} as never,
      ["https://console.fanpass.test"],
      admitConnection,
    );

    adapter.createIOServer(0);

    const options = createServer.mock.calls[0]?.[1] as ServerOptions;
    await expect(
      evaluateAllowRequest(options, request({ sid: "engine-session-id" })),
    ).resolves.toEqual({ error: null, allowed: true });
    expect(admitConnection).not.toHaveBeenCalled();
  });

  it("fails the handshake closed when admission rejects", async () => {
    const createServer = jest
      .spyOn(IoAdapter.prototype, "createIOServer")
      .mockReturnValue({});
    const adapter = new FanPassSocketIoAdapter(
      {} as never,
      ["https://console.fanpass.test"],
      jest.fn().mockRejectedValue(new Error("rate limited")),
    );

    adapter.createIOServer(0);

    const options = createServer.mock.calls[0]?.[1] as ServerOptions;
    await expect(evaluateAllowRequest(options, request())).resolves.toEqual({
      error: null,
      allowed: false,
    });
  });

  it("holds an active-connection lease for the full Engine.IO lifetime", () => {
    const engine = new EventEmitter();
    const server = { engine };
    jest.spyOn(IoAdapter.prototype, "createIOServer").mockReturnValue(server);
    const release = jest.fn();
    const acquireConnection = jest.fn().mockReturnValue({ release });
    const adapter = new FanPassSocketIoAdapter(
      {} as never,
      ["https://console.fanpass.test"],
      undefined,
      acquireConnection,
    );
    adapter.createIOServer(0);
    const connection = Object.assign(new EventEmitter(), {
      request: request(),
      close: jest.fn(),
    });

    engine.emit("connection", connection);

    expect(acquireConnection).toHaveBeenCalledWith(connection.request);
    expect(connection.close).not.toHaveBeenCalled();
    connection.emit("close");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("immediately closes an Engine.IO connection when the active cap rejects", () => {
    const engine = new EventEmitter();
    jest
      .spyOn(IoAdapter.prototype, "createIOServer")
      .mockReturnValue({ engine });
    const adapter = new FanPassSocketIoAdapter(
      {} as never,
      ["https://console.fanpass.test"],
      undefined,
      jest.fn(() => {
        throw new Error("connection capacity");
      }),
    );
    adapter.createIOServer(0);
    const connection = Object.assign(new EventEmitter(), {
      request: request(),
      close: jest.fn(),
    });

    engine.emit("connection", connection);

    expect(connection.close).toHaveBeenCalledWith(true);
  });
});
