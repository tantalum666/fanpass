import { createReadStream } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadRuntimeConfig,
  publicRuntimeConfig,
  RuntimeConfigError,
  type ConsoleAuthRuntimeConfig,
} from "./config.js";
import { applySecurityHeaders } from "./security.js";
import { contentType, resolveStaticFile } from "./static-files.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, "../public");
const port = validatedPort(
  process.env.FANPASS_CONSOLE_AUTH_PORT ?? process.env.PORT ?? "3100",
);

let runtimeConfig: ConsoleAuthRuntimeConfig | null = null;
let startupError: Error | null = null;

try {
  runtimeConfig = loadRuntimeConfig();
} catch (error) {
  startupError =
    error instanceof Error ? error : new Error("Runtime configuration failed");
}

createServer(async (request, response) => {
  applySecurityHeaders(response, runtimeConfig);
  try {
    await routeRequest(request, response);
  } catch (error) {
    logServerError("request_failed", error);
    sendJson(response, 500, {
      ok: false,
      message: "Console authentication request failed.",
    });
  }
}).listen(port, "0.0.0.0", () => {
  if (startupError) logServerError("runtime_config_invalid", startupError);
  if (runtimeConfig?.legacyEnvironmentNames.length) {
    console.warn(
      JSON.stringify({
        level: "warn",
        service: "fanpass-console-auth",
        event: "legacy_runtime_environment_names",
        names: runtimeConfig.legacyEnvironmentNames,
      }),
    );
  }
  console.log(
    JSON.stringify({
      ok: startupError === null,
      service: "fanpass-console-auth",
      runtime: "vite-node-static",
      environment: runtimeConfig?.environment ?? "invalid",
      port,
    }),
  );
});

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", "http://fanpass.local").pathname;

  if (pathname === "/health") {
    if (method !== "GET" && method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      return sendJson(response, 405, {
        ok: false,
        message: "Method not allowed",
      });
    }
    response.setHeader("Cache-Control", "no-store");
    return sendJson(
      response,
      runtimeConfig ? 200 : 503,
      {
        ok: Boolean(runtimeConfig),
        service: "fanpass-console-auth",
        runtime: "vite-node-static",
      },
      method === "HEAD",
    );
  }

  if (pathname === "/api/runtime-config") {
    if (method !== "GET" && method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      return sendJson(response, 405, {
        ok: false,
        message: "Method not allowed",
      });
    }
    response.setHeader("Cache-Control", "no-store");
    if (!runtimeConfig) {
      return sendJson(response, 503, {
        ok: false,
        message: "Console authentication is not configured.",
      });
    }
    return sendJson(
      response,
      200,
      publicRuntimeConfig(runtimeConfig),
      method === "HEAD",
    );
  }

  if (method !== "GET" && method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    return sendJson(response, 405, {
      ok: false,
      message: "Method not allowed",
    });
  }

  const staticFile = resolveStaticFile(publicDirectory, pathname);
  if (!staticFile) {
    return sendJson(response, 404, { ok: false, message: "Not found" });
  }

  response.statusCode = 200;
  response.setHeader("Cache-Control", staticFile.cacheControl);
  response.setHeader("Content-Type", contentType(staticFile.filePath));
  if (method === "HEAD") return response.end();
  const stream = createReadStream(staticFile.filePath);
  stream.on("error", (error) => {
    logServerError("static_file_failed", error);
    response.destroy();
  });
  stream.pipe(response);
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
  headOnly = false,
) {
  if (response.headersSent) return;
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(headOnly ? undefined : JSON.stringify(payload));
}

function validatedPort(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new RuntimeConfigError(
      "Console Auth port must be an integer from 1 to 65535",
    );
  }
  return parsed;
}

function logServerError(event: string, error: unknown) {
  console.error(
    JSON.stringify({
      level: "error",
      service: "fanpass-console-auth",
      event,
      error:
        error instanceof RuntimeConfigError
          ? error.message
          : "Internal Console Auth error",
    }),
  );
}
