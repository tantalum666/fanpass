import { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { IncomingMessage } from "http";
import { Server, ServerOptions } from "socket.io";

export type SocketConnectionAdmission = (
  request: IncomingMessage,
) => void | Promise<void>;

export interface SocketConnectionLease {
  release(): void;
}

export type SocketActiveConnectionAdmission = (
  request: IncomingMessage,
) => SocketConnectionLease;

interface EngineConnection {
  request: IncomingMessage;
  once(event: "close", listener: () => void): void;
  close(discard?: boolean): void;
}

export class FanPassSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: string[],
    private readonly admitConnection?: SocketConnectionAdmission,
    private readonly acquireConnection?: SocketActiveConnectionAdmission,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const delegatedAllowRequest = options?.allowRequest;
    const serverOptions = {
      ...options,
      cors: {
        origin: (
          origin: string | undefined,
          callback: (error: Error | null, allow?: boolean) => void,
        ) => {
          if (!origin || this.allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error("WebSocket CORS origin is not allowed"), false);
        },
        credentials: false,
      },
      allowRequest: (
        request: IncomingMessage,
        callback: (error: string | null | undefined, success: boolean) => void,
      ) => {
        if (!this.isAllowedOrigin(request.headers.origin)) {
          callback(null, false);
          return;
        }

        const delegate = () => {
          if (!delegatedAllowRequest) {
            callback(null, true);
            return;
          }
          try {
            delegatedAllowRequest(request, callback);
          } catch {
            callback(null, false);
          }
        };

        let isInitialHandshake: boolean;
        try {
          isInitialHandshake = this.isInitialHandshake(request);
        } catch {
          callback(null, false);
          return;
        }
        if (!isInitialHandshake || !this.admitConnection) {
          delegate();
          return;
        }

        Promise.resolve()
          .then(() => this.admitConnection?.(request))
          .then(delegate, () => callback(null, false));
      },
      maxHttpBufferSize: 64 * 1024,
    };
    const server = super.createIOServer(
      port,
      serverOptions as ServerOptions,
    ) as Server;
    this.bindActiveConnectionAdmission(server);
    return server;
  }

  private bindActiveConnectionAdmission(server: Server) {
    const acquireConnection = this.acquireConnection;
    if (!acquireConnection) {
      return;
    }
    server.engine.on("connection", (connection: EngineConnection) => {
      let lease: SocketConnectionLease;
      try {
        lease = acquireConnection(connection.request);
      } catch {
        connection.close(true);
        return;
      }
      connection.once("close", () => lease.release());
    });
  }

  private isAllowedOrigin(origin: string | string[] | undefined) {
    return (
      origin === undefined ||
      origin === "" ||
      (typeof origin === "string" && this.allowedOrigins.includes(origin))
    );
  }

  private isInitialHandshake(request: IncomingMessage) {
    const parsed = new URL(request.url ?? "/", "http://fanpass.internal");
    return !parsed.searchParams.has("sid");
  }
}
