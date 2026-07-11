type EnvMap = Record<string, unknown>;

const LOCAL_FALLBACK_SECRETS = new Set([
  "fanpass-local-dev-secret",
  "replace-with-local-dev-secret",
  "replace-with-local-session-secret",
]);

export function isProductionLikeEnvironment(
  env: NodeJS.ProcessEnv | EnvMap = process.env,
) {
  const nodeEnv = String(env.NODE_ENV ?? "").toLowerCase();
  const fanpassEnv = String(env.FANPASS_ENV ?? "").toLowerCase();
  return (
    nodeEnv === "production" ||
    fanpassEnv === "production" ||
    fanpassEnv === "staging"
  );
}

export function allowsPrivateKeyTestnetWrites(
  env: NodeJS.ProcessEnv | EnvMap = process.env,
) {
  const fanpassEnv = String(env.FANPASS_ENV ?? "").toLowerCase();
  return (
    fanpassEnv !== "production" &&
    stringValue(env.FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES) === "true"
  );
}

export function validateEnvironment(config: EnvMap) {
  const errors: string[] = [];
  const productionLike = isProductionLikeEnvironment(config);

  validatePositiveInteger(config, "QR_TTL_SECONDS", errors, 30, 900);
  validatePositiveInteger(config, "SESSION_TTL_SECONDS", errors, 300, 86_400);
  validatePositiveInteger(
    config,
    "RATE_LIMIT_GENERAL_PER_MINUTE",
    errors,
    1,
    10_000,
  );
  validatePositiveInteger(
    config,
    "RATE_LIMIT_AUTH_PER_MINUTE",
    errors,
    1,
    1_000,
  );
  validatePositiveInteger(
    config,
    "RATE_LIMIT_VERIFY_PER_MINUTE",
    errors,
    1,
    5_000,
  );
  validatePositiveInteger(
    config,
    "RATE_LIMIT_PRIVY_PER_MINUTE",
    errors,
    1,
    1_000,
  );
  validatePositiveInteger(
    config,
    "RATE_LIMIT_STAFF_INVITE_PER_MINUTE",
    errors,
    1,
    500,
  );
  validatePositiveInteger(
    config,
    "RATE_LIMIT_STAFF_ASSIGNMENT_PER_MINUTE",
    errors,
    1,
    1_000,
  );
  validatePositiveInteger(
    config,
    "FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS",
    errors,
    30,
    3_600,
  );
  validatePositiveInteger(
    config,
    "SIDE_EFFECT_HEALTH_PROCESSING_STALE_SECONDS",
    errors,
    30,
    86_400,
  );
  validatePositiveInteger(
    config,
    "SIDE_EFFECT_HEALTH_PENDING_STALE_SECONDS",
    errors,
    30,
    86_400,
  );
  validatePositiveInteger(config, "FANPASS_TRUST_PROXY_HOPS", errors, 1, 3);

  const corsOrigins = stringValue(config.FANPASS_CORS_ORIGINS);
  if (corsOrigins) {
    for (const origin of corsOrigins
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)) {
      validateCorsOrigin(origin, productionLike, errors);
    }
  } else if (productionLike) {
    errors.push(
      "FANPASS_CORS_ORIGINS is required in production-like environments",
    );
  }

  if (productionLike) {
    validateProductionSecret(config, "QR_SIGNING_SECRET", errors);
    validateProductionSecret(config, "FANPASS_ONSALE_QUEUE_SECRET", errors);
    validatePrivyConfiguration(config, errors);
    validatePaymentConfiguration(config, errors);
    validateOwnershipConfiguration(config, errors);

    if (!stringValue(config.FANPASS_TRUST_PROXY_HOPS)) {
      errors.push(
        "FANPASS_TRUST_PROXY_HOPS is required in production-like environments",
      );
    }

    if (stringValue(config.FANPASS_ENABLE_DEMO_AUTH) === "true") {
      errors.push(
        "FANPASS_ENABLE_DEMO_AUTH must not be true in production-like environments",
      );
    }

    if (
      stringValue(config.FANPASS_DATA_SOURCE) === "prisma" &&
      !stringValue(config.DATABASE_URL)
    ) {
      errors.push("DATABASE_URL is required when FANPASS_DATA_SOURCE=prisma");
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid FanPass API configuration:\n- ${errors.join("\n- ")}`,
    );
  }

  return config;
}

function validatePaymentConfiguration(config: EnvMap, errors: string[]) {
  if (stringValue(config.FANPASS_ENABLE_PAYMENTS) !== "true") {
    return;
  }
  validateProductionSecret(config, "STRIPE_SECRET_KEY", errors);
  validateProductionSecret(config, "STRIPE_WEBHOOK_SECRET", errors);
  if (stringValue(config.FANPASS_REQUIRE_PAYMENT_AUTHORIZATION) !== "true") {
    errors.push(
      "FANPASS_REQUIRE_PAYMENT_AUTHORIZATION must be true when payments are enabled in production-like environments",
    );
  }
}

function validateOwnershipConfiguration(config: EnvMap, errors: string[]) {
  if (stringValue(config.OWNERSHIP_ADAPTER) === "privy") {
    validatePrivyOwnershipConfiguration(config, errors);
    return;
  }
  if (stringValue(config.OWNERSHIP_ADAPTER) !== "testnet") {
    return;
  }
  if (!allowsPrivateKeyTestnetWrites(config)) {
    errors.push(
      "OWNERSHIP_ADAPTER=testnet is blocked in production-like environments unless FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES=true is explicitly set outside production",
    );
    return;
  }

  const rpcUrl = stringValue(config.TESTNET_RPC_URL);
  if (!rpcUrl || !rpcUrl.startsWith("https://")) {
    errors.push(
      "TESTNET_RPC_URL must be an HTTPS RPC URL when private-key testnet writes are explicitly enabled",
    );
  }

  const privateKey = stringValue(config.TESTNET_OPERATOR_PRIVATE_KEY);
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    errors.push(
      "TESTNET_OPERATOR_PRIVATE_KEY must be a 0x-prefixed 32-byte private key when private-key testnet writes are explicitly enabled",
    );
  }

  const contractAddress = stringValue(config.FANPASS_TICKET_CONTRACT_ADDRESS);
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    errors.push(
      "FANPASS_TICKET_CONTRACT_ADDRESS must be an EVM address when private-key testnet writes are explicitly enabled",
    );
  }
}

function validatePrivyOwnershipConfiguration(config: EnvMap, errors: string[]) {
  validateProductionSecret(config, "PRIVY_APP_SECRET", errors);

  if (!stringValue(config.FANPASS_PRIVY_SPONSOR_WALLET_ID)) {
    errors.push(
      "FANPASS_PRIVY_SPONSOR_WALLET_ID is required when OWNERSHIP_ADAPTER=privy",
    );
  }

  const sponsorWalletAddress = stringValue(
    config.FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS,
  );
  if (!/^0x[a-fA-F0-9]{40}$/.test(sponsorWalletAddress)) {
    errors.push(
      "FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS must be an EVM address when OWNERSHIP_ADAPTER=privy",
    );
  }

  const contractAddress = stringValue(config.FANPASS_TICKET_CONTRACT_ADDRESS);
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    errors.push(
      "FANPASS_TICKET_CONTRACT_ADDRESS must be an EVM address when OWNERSHIP_ADAPTER=privy",
    );
  }

  const caip2 = stringValue(config.FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2);
  if (caip2 && !/^eip155:\d+$/.test(caip2)) {
    errors.push(
      "FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2 must use eip155:<chainId> format",
    );
  }
}

export function readIntegerConfig(
  config: { get<T = unknown>(propertyPath: string): T | undefined },
  key: string,
  fallback: number,
) {
  const rawValue = config.get<string | number>(key);
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function validateProductionSecret(
  config: EnvMap,
  key: string,
  errors: string[],
) {
  const value = stringValue(config[key]);
  if (!value) {
    errors.push(`${key} is required in production-like environments`);
    return;
  }
  if (LOCAL_FALLBACK_SECRETS.has(value) || value.startsWith("replace-with-")) {
    errors.push(
      `${key} must not use a local placeholder value in production-like environments`,
    );
  }
  if (value.length < 32) {
    errors.push(
      `${key} must be at least 32 characters in production-like environments`,
    );
  }
}

function validatePrivyConfiguration(config: EnvMap, errors: string[]) {
  const appId = stringValue(config.PRIVY_APP_ID);
  const verificationKey = normalizePemValue(
    stringValue(config.PRIVY_VERIFICATION_KEY),
  );

  if (!appId) {
    errors.push("PRIVY_APP_ID is required in production-like environments");
  }

  if (!verificationKey) {
    errors.push(
      "PRIVY_VERIFICATION_KEY is required in production-like environments",
    );
    return;
  }

  if (
    verificationKey.startsWith("replace-with-") ||
    !verificationKey.includes("BEGIN PUBLIC KEY") ||
    !verificationKey.includes("END PUBLIC KEY")
  ) {
    errors.push(
      "PRIVY_VERIFICATION_KEY must be a PEM public key from Privy in production-like environments",
    );
  }
}

function validatePositiveInteger(
  config: EnvMap,
  key: string,
  errors: string[],
  min: number,
  max: number,
) {
  const rawValue = config[key];
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return;
  }
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${key} must be an integer between ${min} and ${max}`);
  }
}

function validateCorsOrigin(
  origin: string,
  productionLike: boolean,
  errors: string[],
) {
  if (origin === "*") {
    errors.push("FANPASS_CORS_ORIGINS must not include *");
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    errors.push(`FANPASS_CORS_ORIGINS contains an invalid origin: ${origin}`);
    return;
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    errors.push(
      `FANPASS_CORS_ORIGINS must contain origins only, not paths: ${origin}`,
    );
  }

  if (productionLike && parsed.protocol !== "https:") {
    errors.push(
      `FANPASS_CORS_ORIGINS must use https in production-like environments: ${origin}`,
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePemValue(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}
