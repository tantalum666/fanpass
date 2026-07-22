interface ConfigReader {
  get<T = string>(key: string): T | undefined;
  keys?(): string[];
}

const LOCAL_HEALTH_PROFILE = {
  TZ: "UTC",
  NODE_ENV: "test",
  FANPASS_ENV: "local",
  FANPASS_ENABLE_DEMO_AUTH: "false",
  FANPASS_ENABLE_PAYMENTS: "false",
  FANPASS_REQUIRE_PAYMENT_AUTHORIZATION: "true",
  FANPASS_ALLOW_MANUAL_CRYPTO_CONFIRMATION: "false",
  FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES: "false",
  FANPASS_ALLOW_UNVERIFIED_USDC_RATE: "false",
  FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "true",
  FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "true",
  FANPASS_SIDE_EFFECT_WORKER_ENABLED: "false",
  FANPASS_TRUST_PROXY_HOPS: "1",
  FANPASS_SIDE_EFFECT_HEALTH_LOCAL_ONLY: "true",
  OWNERSHIP_ADAPTER: "mock",
} as const;

const PROVIDER_ENV_PREFIXES = [
  "STRIPE_",
  "PRIVY_",
  "FANPASS_SEPOLIA_",
  "TESTNET_OPERATOR_",
] as const;
const SAFE_SENSITIVE_CONTROL_KEYS = new Set([
  "FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES",
]);
const SENSITIVE_ENV_NAME =
  /(?:^|_)(?:API_?KEY|AUTH_?TOKEN|PASSWORD|PRIVATE_?KEYS?|SECRET|TOKEN|WEBHOOK)(?:_|$)/i;

const ALLOWED_LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "[::1]"]);

export function assertLocalSideEffectHealthRuntime(config: ConfigReader) {
  const driftedKeys = Object.entries(LOCAL_HEALTH_PROFILE)
    .filter(([key, expected]) => readConfig(config, key) !== expected)
    .map(([key]) => key);
  if (driftedKeys.length > 0) {
    throw new Error(
      `Local side-effect health profile drifted: ${driftedKeys.join(", ")}`,
    );
  }

  const presentSensitiveKeys = findUnexpectedSensitiveEnvironmentKeys(
    config.keys?.() ?? Object.keys(process.env),
  );
  if (presentSensitiveKeys.length > 0) {
    throw new Error(
      `Local side-effect health profile contains unexpected sensitive variables: ${presentSensitiveKeys.join(", ")}`,
    );
  }

  if (!isAllowedLocalHealthDatabase(readConfig(config, "DATABASE_URL"))) {
    throw new Error(
      "Local side-effect health profile requires the fanpass database on an explicit loopback host",
    );
  }
}

export function findUnexpectedSensitiveEnvironmentKeys(keys: string[]) {
  return keys.filter((key) => {
    const normalizedKey = key.toUpperCase();
    return (
      !SAFE_SENSITIVE_CONTROL_KEYS.has(normalizedKey) &&
      (PROVIDER_ENV_PREFIXES.some((prefix) =>
        normalizedKey.startsWith(prefix),
      ) ||
        SENSITIVE_ENV_NAME.test(key))
    );
  });
}

export function isAllowedLocalHealthDatabase(connectionString: string) {
  let target: URL;
  try {
    target = new URL(connectionString);
  } catch {
    return false;
  }

  const authorityMatch = connectionString.match(
    /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i,
  );
  const authority = authorityMatch?.[1] ?? "";
  const hostAndPort = authority.slice(authority.lastIndexOf("@") + 1);
  let explicitHost = hostAndPort;
  let explicitPort = "";
  if (hostAndPort.startsWith("[")) {
    const closingBracket = hostAndPort.indexOf("]");
    if (closingBracket === -1) {
      return false;
    }
    explicitHost = hostAndPort.slice(0, closingBracket + 1);
    explicitPort = hostAndPort.slice(closingBracket + 1);
  } else {
    const colon = hostAndPort.lastIndexOf(":");
    if (colon >= 0) {
      explicitHost = hostAndPort.slice(0, colon);
      explicitPort = hostAndPort.slice(colon);
    }
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(target.pathname.slice(1));
  } catch {
    return false;
  }

  return (
    (target.protocol === "postgres:" || target.protocol === "postgresql:") &&
    target.username.length > 0 &&
    target.password.length > 0 &&
    ALLOWED_LOCAL_DATABASE_HOSTS.has(explicitHost.toLowerCase()) &&
    ALLOWED_LOCAL_DATABASE_HOSTS.has(target.hostname.toLowerCase()) &&
    (!explicitPort || /^:[0-9]+$/.test(explicitPort)) &&
    databaseName === "fanpass" &&
    !target.hash &&
    target.search.length === 0
  );
}

function readConfig(config: ConfigReader, key: string) {
  const value = config.get<unknown>(key);
  return typeof value === "string" ? value : value == null ? "" : String(value);
}
