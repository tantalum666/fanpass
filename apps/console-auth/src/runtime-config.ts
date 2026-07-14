export interface ConsoleAuthRuntimeConfig {
  appId: string;
  sessionBridgeUrl: string;
  consoleUrl: string;
  privySessionMode: "browser-sdk" | "httponly-cookie";
}

export async function loadRuntimeConfig(
  signal?: AbortSignal,
): Promise<ConsoleAuthRuntimeConfig> {
  const response = await fetch("/api/runtime-config", {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error("Console authentication is temporarily unavailable.");
  }

  return validateRuntimeConfig(payload);
}

export function validateRuntimeConfig(
  payload: unknown,
): ConsoleAuthRuntimeConfig {
  if (!payload || typeof payload !== "object") {
    throw new Error("Console authentication configuration is invalid.");
  }

  const candidate = payload as Record<string, unknown>;
  const appId = stringValue(candidate.appId);
  const sessionBridgeUrl = validatedHttpUrl(candidate.sessionBridgeUrl);
  const consoleUrl = validatedHttpUrl(candidate.consoleUrl);
  const privySessionMode = candidate.privySessionMode;

  if (!/^[A-Za-z0-9_-]{10,128}$/.test(appId)) {
    throw new Error("Console authentication configuration is invalid.");
  }
  if (
    privySessionMode !== "browser-sdk" &&
    privySessionMode !== "httponly-cookie"
  ) {
    throw new Error("Console authentication configuration is invalid.");
  }

  if (
    sessionBridgeUrl.pathname !== "/api/console/privy-session" ||
    sessionBridgeUrl.search ||
    sessionBridgeUrl.hash ||
    sessionBridgeUrl.origin !== consoleUrl.origin ||
    consoleUrl.pathname !== "/" ||
    consoleUrl.search ||
    consoleUrl.hash
  ) {
    throw new Error("Console authentication configuration is invalid.");
  }

  return {
    appId,
    sessionBridgeUrl: sessionBridgeUrl.toString(),
    consoleUrl: consoleUrl.origin,
    privySessionMode,
  };
}

function validatedHttpUrl(value: unknown) {
  const raw = stringValue(value);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Console authentication configuration is invalid.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.protocol === "http:" && !isLoopback(url.hostname))
  ) {
    throw new Error("Console authentication configuration is invalid.");
  }
  return url;
}

function isLoopback(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
