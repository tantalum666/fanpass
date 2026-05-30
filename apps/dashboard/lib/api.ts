import { cookies } from "next/headers";

const API_BASE_URL =
  process.env.FANPASS_API_BASE_URL ??
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

export async function apiGet<T>(path: string): Promise<T> {
  const accessToken = await consoleAccessToken();
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
): Promise<T> {
  const accessToken = await consoleAccessToken();
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

export async function consoleAccessToken() {
  if (configuredAccessToken) {
    return configuredAccessToken;
  }

  const cookieAccessToken = await consoleCookieAccessToken();
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

async function consoleCookieAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(CONSOLE_ACCESS_TOKEN_COOKIE)?.value ?? null;
}

function consoleAllowedOrigins() {
  const origins = new Set<string>();
  const configuredOrigins = [
    process.env.FANPASS_CONSOLE_ORIGINS,
    process.env.FANPASS_CONSOLE_ORIGIN,
    process.env.FANPASS_CONSOLE_URL,
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

function isProductionLikeConsole() {
  const nodeEnv = String(process.env.NODE_ENV ?? "").toLowerCase();
  const fanpassEnv = String(process.env.FANPASS_ENV ?? "").toLowerCase();
  return (
    nodeEnv === "production" ||
    fanpassEnv === "production" ||
    fanpassEnv === "staging"
  );
}
