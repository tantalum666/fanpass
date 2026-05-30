import { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions } from "socket.io";

export class FanPassSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions) {
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
      maxHttpBufferSize: 64 * 1024,
    };
    return super.createIOServer(port, serverOptions as ServerOptions);
  }
}
