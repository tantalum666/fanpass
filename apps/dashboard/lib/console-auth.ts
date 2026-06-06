export const API_BASE_URL =
  process.env.FANPASS_API_BASE_URL ??
  process.env.VITE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";
const CONSOLE_USER_ID =
  process.env.FANPASS_CONSOLE_USER_ID ?? "usr_organizer_demo";
export const CONSOLE_ACCESS_TOKEN_COOKIE = "fanpass_console_access_token";

const configuredAccessToken: string | null =
  process.env.FANPASS_CONSOLE_ACCESS_TOKEN ?? null;
let cachedDemoAccessToken: string | null = null;

export class ConsoleAuthRequiredError extends Error {
  constructor(
    message = "FanPass Console requires organizer/admin authentication",
  ) {
    super(message);
    this.name = "ConsoleAuthRequiredError";
  }
}

export class ConsoleMutationOriginError extends Error {
  constructor(message = "FanPass Console mutation origin is not allowed") {
    super(message);
    this.name = "ConsoleMutationOriginError";
  }
}

export interface CookieAccessTokenSource {
  cookieHeader?: string | null;
}

export async function apiGet<T>(
  path: string,
  source: CookieAccessTokenSource,
): Promise<T> {
  const accessToken = await consoleAccessToken(source);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T, Body extends Record<string, unknown>>(
  path: string,
  body: Body,
  source: CookieAccessTokenSource,
): Promise<T> {
  const accessToken = await consoleAccessToken(source);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function consoleAccessToken(source: CookieAccessTokenSource) {
  if (configuredAccessToken) {
    return configuredAccessToken;
  }

  const cookieAccessToken = consoleCookieAccessToken(source.cookieHeader);
  if (cookieAccessToken) {
    return cookieAccessToken;
  }

  if (isProductionLikeConsole()) {
    throw new ConsoleAuthRequiredError();
  }

  if (cachedDemoAccessToken) {
    return cachedDemoAccessToken;
  }

  const response = await fetch(`${API_BASE_URL}/auth/demo-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: CONSOLE_USER_ID,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Console authentication failed: ${response.status}`);
  }
  const session = (await response.json()) as { accessToken?: string };
  if (!session.accessToken) {
    throw new Error("Console authentication returned no access token");
  }
  cachedDemoAccessToken = session.accessToken;
  return cachedDemoAccessToken;
}

export function assertConsoleMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = consoleAllowedOrigins();

  if (!origin) {
    if (isProductionLikeConsole()) {
      throw new ConsoleMutationOriginError(
        "FanPass Console mutation origin is required",
      );
    }
    return;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
    throw new ConsoleMutationOriginError();
  }
}

export function consoleMutationCorsHeaders(
  request: Request,
): Record<string, string> {
  const origin = request.headers.get("origin");
  const normalizedOrigin = origin ? normalizeOrigin(origin) : null;
  if (!normalizedOrigin || !consoleAllowedOrigins().has(normalizedOrigin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Origin": normalizedOrigin,
    Vary: "Origin",
  };
}

export function consoleCookieAccessToken(cookieHeader?: string | null) {
  return parseCookies(cookieHeader).get(CONSOLE_ACCESS_TOKEN_COOKIE) ?? null;
}

export function consoleSessionCookie(
  accessToken: string,
  expiresAt: string | null,
) {
  const attributes = [
    `${CONSOLE_ACCESS_TOKEN_COOKIE}=${encodeURIComponent(accessToken)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAgeSeconds(expiresAt)}`,
  ];
  if (isProductionLikeConsole()) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function clearConsoleSessionCookie() {
  const attributes = [
    `${CONSOLE_ACCESS_TOKEN_COOKIE}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];
  if (isProductionLikeConsole()) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

function consoleAllowedOrigins() {
  const origins = new Set<string>();
  const configuredOrigins = [
    process.env.FANPASS_CONSOLE_ORIGINS,
    process.env.FANPASS_CONSOLE_ORIGIN,
    process.env.FANPASS_CONSOLE_URL,
    process.env.FANPASS_CONSOLE_AUTH_ORIGIN,
    process.env.VITE_CONSOLE_AUTH_BASE_URL,
    process.env.VITE_CONSOLE_BASE_URL,
    process.env.NEXT_PUBLIC_CONSOLE_AUTH_BASE_URL,
    process.env.NEXT_PUBLIC_CONSOLE_BASE_URL,
  ];

  for (const configuredOrigin of configuredOrigins) {
    for (const value of String(configuredOrigin ?? "").split(",")) {
      addAllowedOrigin(origins, value);
    }
  }

  if (process.env.VERCEL_URL) {
    addAllowedOrigin(origins, `https://${process.env.VERCEL_URL}`);
  }

  if (!isProductionLikeConsole()) {
    addAllowedOrigin(origins, "http://localhost:3000");
    addAllowedOrigin(origins, "http://127.0.0.1:3000");
    addAllowedOrigin(origins, "http://localhost:3100");
    addAllowedOrigin(origins, "http://127.0.0.1:3100");
  }

  return origins;
}

function addAllowedOrigin(origins: Set<string>, value: string) {
  const normalized = normalizeOrigin(value.trim());
  if (normalized) {
    origins.add(normalized);
  }
}

function normalizeOrigin(origin: string) {
  if (!origin) {
    return null;
  }
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader?: string | null) {
  const cookies = new Map<string, string>();
  for (const part of String(cookieHeader ?? "").split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) {
      continue;
    }
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }
  return cookies;
}

function maxAgeSeconds(expiresAt: string | null) {
  if (!expiresAt) {
    return 55 * 60;
  }
  const seconds = Math.floor(
    (new Date(expiresAt).getTime() - Date.now()) / 1000,
  );
  return Math.max(60, Math.min(seconds, 55 * 60));
}

function isProductionLikeConsole() {
  const nodeEnv = String(process.env.NODE_ENV ?? "").toLowerCase();
  const fanpassEnv = String(process.env.FANPASS_ENV ?? "").toLowerCase();
  return (
    nodeEnv === "production" ||
    fanpassEnv === "production" ||
    fanpassEnv === "staging"
  );
}
