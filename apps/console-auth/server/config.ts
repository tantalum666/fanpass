export interface ConsoleAuthRuntimeConfig {
  appId: string;
  sessionBridgeUrl: string;
  consoleUrl: string;
  productionLike: boolean;
  environment: string;
  legacyEnvironmentNames: string[];
  privySessionMode: PrivySessionMode;
}

export type PrivySessionMode = "browser-sdk" | "httponly-cookie";

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeConfigError";
  }
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): ConsoleAuthRuntimeConfig {
  const environment = normalizedEnvironment(env);
  const productionLike = isProductionLike(environment, env.NODE_ENV);
  const legacyEnvironmentNames: string[] = [];
  const privySessionMode = configuredSessionMode(env);

  const appId = configuredValue(
    env,
    "FANPASS_PRIVY_APP_ID",
    "NEXT_PUBLIC_PRIVY_APP_ID",
    legacyEnvironmentNames,
  );
  const sessionBridgeValue =
    configuredValue(
      env,
      "FANPASS_CONSOLE_SESSION_BRIDGE_URL",
      "NEXT_PUBLIC_FANPASS_CONSOLE_SESSION_BRIDGE_URL",
      legacyEnvironmentNames,
    ) || "http://localhost:3000/api/console/privy-session";
  const consoleValue =
    configuredValue(
      env,
      "FANPASS_CONSOLE_URL",
      "NEXT_PUBLIC_FANPASS_CONSOLE_URL",
      legacyEnvironmentNames,
    ) || "http://localhost:3000";

  if (!/^[A-Za-z0-9_-]{10,128}$/.test(appId)) {
    throw new RuntimeConfigError(
      "FANPASS_PRIVY_APP_ID must be a valid public Privy app identifier",
    );
  }
  if (
    ["beta", "production"].includes(environment) &&
    privySessionMode !== "httponly-cookie"
  ) {
    throw new RuntimeConfigError(
      "Beta and production Console Auth must use Privy HttpOnly cookie mode",
    );
  }

  const sessionBridgeUrl = configuredHttpUrl(
    sessionBridgeValue,
    "FANPASS_CONSOLE_SESSION_BRIDGE_URL",
    productionLike,
  );
  const consoleUrl = configuredHttpUrl(
    consoleValue,
    "FANPASS_CONSOLE_URL",
    productionLike,
  );

  if (
    sessionBridgeUrl.pathname !== "/api/console/privy-session" ||
    sessionBridgeUrl.search ||
    sessionBridgeUrl.hash
  ) {
    throw new RuntimeConfigError(
      "FANPASS_CONSOLE_SESSION_BRIDGE_URL must use the exact Console Privy session route",
    );
  }
  if (consoleUrl.pathname !== "/" || consoleUrl.search || consoleUrl.hash) {
    throw new RuntimeConfigError(
      "FANPASS_CONSOLE_URL must be an origin without a path, query, or fragment",
    );
  }
  if (sessionBridgeUrl.origin !== consoleUrl.origin) {
    throw new RuntimeConfigError(
      "Console session bridge and redirect must use the same configured origin",
    );
  }

  return {
    appId,
    sessionBridgeUrl: sessionBridgeUrl.toString(),
    consoleUrl: consoleUrl.origin,
    productionLike,
    environment,
    legacyEnvironmentNames,
    privySessionMode,
  };
}

export function publicRuntimeConfig(config: ConsoleAuthRuntimeConfig) {
  return {
    appId: config.appId,
    sessionBridgeUrl: config.sessionBridgeUrl,
    consoleUrl: config.consoleUrl,
    privySessionMode: config.privySessionMode,
  };
}

function configuredSessionMode(env: NodeJS.ProcessEnv): PrivySessionMode {
  const value = String(env.FANPASS_PRIVY_SESSION_MODE ?? "browser-sdk")
    .trim()
    .toLowerCase();
  if (value !== "browser-sdk" && value !== "httponly-cookie") {
    throw new RuntimeConfigError(
      "FANPASS_PRIVY_SESSION_MODE must be browser-sdk or httponly-cookie",
    );
  }
  return value;
}

function configuredValue(
  env: NodeJS.ProcessEnv,
  primaryName: string,
  legacyName: string,
  legacyEnvironmentNames: string[],
) {
  const primaryValue = String(env[primaryName] ?? "").trim();
  if (primaryValue) return primaryValue;

  const legacyValue = String(env[legacyName] ?? "").trim();
  if (legacyValue) legacyEnvironmentNames.push(legacyName);
  return legacyValue;
}

function configuredHttpUrl(
  value: string,
  label: string,
  productionLike: boolean,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RuntimeConfigError(`${label} must be a valid URL`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new RuntimeConfigError(`${label} must use HTTP or HTTPS`);
  }
  if (url.username || url.password) {
    throw new RuntimeConfigError(`${label} must not contain credentials`);
  }
  if (productionLike && url.protocol !== "https:") {
    throw new RuntimeConfigError(
      `${label} must use HTTPS outside local development`,
    );
  }
  if (url.protocol === "http:" && !isLoopback(url.hostname)) {
    throw new RuntimeConfigError(
      `${label} may use HTTP only on loopback hosts`,
    );
  }
  return url;
}

function normalizedEnvironment(env: NodeJS.ProcessEnv) {
  return String(env.FANPASS_ENV ?? env.NODE_ENV ?? "development")
    .trim()
    .toLowerCase();
}

function isProductionLike(environment: string, nodeEnvironment?: string) {
  return (
    ["staging", "beta", "production"].includes(environment) ||
    String(nodeEnvironment ?? "").toLowerCase() === "production"
  );
}

function isLoopback(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}
