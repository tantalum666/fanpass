import {
  isProductionLikeEnvironment,
  readIntegerConfig,
  validateEnvironment,
} from "../src/config/security-config";
import {
  assertLocalSideEffectHealthRuntime,
  isAllowedLocalHealthDatabase,
} from "../src/workers/side-effect-health-runtime";

const TEST_PRIVY_PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\nfanpass-test-key\n-----END PUBLIC KEY-----";

describe("security config validation", () => {
  const productionConfig = {
    NODE_ENV: "production",
    QR_SIGNING_SECRET: "qr-secret-with-at-least-thirty-two-chars",
    FANPASS_ONSALE_QUEUE_SECRET: "onsale-secret-with-at-least-thirty-two-chars",
    PRIVY_APP_ID: "privy-app-demo",
    PRIVY_VERIFICATION_KEY: TEST_PRIVY_PUBLIC_KEY,
    FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
    FANPASS_TRUST_PROXY_HOPS: "1",
    FANPASS_ORDERBOOK_ADMISSION_SECRET:
      "orderbook-admission-secret-with-at-least-thirty-two-chars",
    OWNERSHIP_ADAPTER: "privy",
    FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "true",
    FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "true",
    PRIVY_APP_SECRET: "privy-secret-with-at-least-thirty-two-chars",
    FANPASS_PRIVY_SPONSOR_WALLET_ID: "wallet_production_operator",
    FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS:
      "0x0000000000000000000000000000000000009000",
    FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2: "eip155:11155111",
    FANPASS_TICKET_CONTRACT_ADDRESS:
      "0x0000000000000000000000000000000000001000",
    TESTNET_RPC_URL: "https://rpc.testnet.example",
    FANPASS_DATA_SOURCE: "prisma",
    DATABASE_URL: "postgresql://fanpass:secret@db.example/fanpass",
  };

  it("accepts production-like startup with explicit trusted proxy hops", () => {
    expect(() => validateEnvironment(productionConfig)).not.toThrow();
  });

  it.each([
    [undefined, "missing"],
    ["", "empty"],
    ["eip155:0", "zero chain id"],
    ["eip155:01", "leading-zero chain id"],
    ["eip155:-1", "negative chain id"],
    ["eip155:11155111 ", "surrounding whitespace"],
    ["solana:mainnet", "non-EVM namespace"],
  ])("rejects %s Privy sponsor chain config (%s)", (caip2, _description) => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2: caip2,
      }),
    ).toThrow(/FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2/);
  });

  it.each([undefined, "", "false", "TRUE", " true "])(
    "rejects provider-backed Prisma startup without exact async settlement true (%p)",
    (asyncSettlement) => {
      expect(() =>
        validateEnvironment({
          ...productionConfig,
          FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: asyncSettlement,
        }),
      ).toThrow(/FANPASS_ASYNC_OWNERSHIP_SETTLEMENT must be exactly true/);
    },
  );

  it("rejects beta Prisma/Privy startup when the async settlement fence is absent", () => {
    expect(() =>
      validateEnvironment({
        FANPASS_ENV: "beta",
        FANPASS_DATA_SOURCE: "prisma",
        OWNERSHIP_ADAPTER: "privy",
      }),
    ).toThrow(/FANPASS_ASYNC_OWNERSHIP_SETTLEMENT must be exactly true/);
  });

  it.each([undefined, "false", "TRUE", " true "])(
    "rejects beta Prisma/testnet startup with async settlement %p",
    (value) => {
      expect(() =>
        validateEnvironment({
          FANPASS_ENV: "beta",
          FANPASS_DATA_SOURCE: "prisma",
          OWNERSHIP_ADAPTER: "testnet",
          FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "true",
          FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: value,
        }),
      ).toThrow(/FANPASS_ASYNC_OWNERSHIP_SETTLEMENT must be exactly true/);
    },
  );

  it.each([undefined, "false", "TRUE", " true "])(
    "rejects beta Prisma/testnet startup with chain proof outbox %p",
    (value) => {
      expect(() =>
        validateEnvironment({
          FANPASS_ENV: "beta",
          FANPASS_DATA_SOURCE: "prisma",
          OWNERSHIP_ADAPTER: "testnet",
          FANPASS_CHAIN_PROOF_SYNC_OUTBOX: value,
          FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "true",
        }),
      ).toThrow(/FANPASS_CHAIN_PROOF_SYNC_OUTBOX must be exactly true/);
    },
  );

  it("preserves local mock startup without the provider dispatch fence", () => {
    expect(() =>
      validateEnvironment({
        FANPASS_ENV: "local",
        FANPASS_DATA_SOURCE: "prisma",
        OWNERSHIP_ADAPTER: "mock",
      }),
    ).not.toThrow();
  });

  it("normalizes surrounding whitespace and case only when detecting the environment", () => {
    expect(isProductionLikeEnvironment({ NODE_ENV: "  ProDucTion  " })).toBe(
      true,
    );
    expect(isProductionLikeEnvironment({ FANPASS_ENV: "  StaGing  " })).toBe(
      true,
    );
  });

  it("still fails production startup when a spaced environment value has no database URL", () => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        NODE_ENV: " production ",
        DATABASE_URL: undefined,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it.each([
    ["FANPASS_DATA_SOURCE", " prisma "],
    ["OWNERSHIP_ADAPTER", " privy "],
    ["FANPASS_CHAIN_PROOF_SYNC_OUTBOX", " true "],
    ["FANPASS_ENABLE_DEMO_AUTH", " false "],
  ])("rejects non-canonical production config %s=%p", (key, value) => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        [key]: value,
      }),
    ).toThrow(new RegExp(key));
  });

  it("rejects absent or non-canonical orderbook admission configuration", () => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        FANPASS_ORDERBOOK_ADMISSION_SECRET: undefined,
      }),
    ).toThrow(/FANPASS_ORDERBOOK_ADMISSION_SECRET/);
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        FANPASS_ORDERBOOK_SUBSCRIPTIONS_PER_10_SECONDS: " 12 ",
      }),
    ).toThrow(/FANPASS_ORDERBOOK_SUBSCRIPTIONS_PER_10_SECONDS/);
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        FANPASS_ORDERBOOK_GLOBAL_CONNECTIONS: "0",
      }),
    ).toThrow(/FANPASS_ORDERBOOK_GLOBAL_CONNECTIONS/);
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        FANPASS_ORDERBOOK_IPV6_PREFIX_BITS: "47",
      }),
    ).toThrow(/FANPASS_ORDERBOOK_IPV6_PREFIX_BITS/);
  });

  it("rejects production startup without its database URL", () => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        DATABASE_URL: undefined,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it.each([undefined, "", "mock", "prviy", "Privy"])(
    "rejects production-like ownership adapter value %p",
    (ownershipAdapter) => {
      expect(() =>
        validateEnvironment({
          ...productionConfig,
          OWNERSHIP_ADAPTER: ownershipAdapter,
        }),
      ).toThrow(/OWNERSHIP_ADAPTER/);
    },
  );

  it.each([undefined, "", "demo", "prismaa"])(
    "rejects production-like data source value %p",
    (dataSource) => {
      expect(() =>
        validateEnvironment({
          ...productionConfig,
          FANPASS_DATA_SOURCE: dataSource,
        }),
      ).toThrow(/FANPASS_DATA_SOURCE/);
    },
  );

  it("rejects production-like startup without explicit trusted proxy hops", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        QR_SIGNING_SECRET: "qr-secret-with-at-least-thirty-two-chars",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: TEST_PRIVY_PUBLIC_KEY,
        FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
      }),
    ).toThrow(/FANPASS_TRUST_PROXY_HOPS/);
  });

  it("rejects invalid trusted proxy hop counts", () => {
    expect(() =>
      validateEnvironment({
        FANPASS_TRUST_PROXY_HOPS: "0",
      }),
    ).toThrow(/FANPASS_TRUST_PROXY_HOPS/);
    expect(() =>
      validateEnvironment({
        FANPASS_TRUST_PROXY_HOPS: "4",
      }),
    ).toThrow(/FANPASS_TRUST_PROXY_HOPS/);
  });

  it("rejects production-like startup without explicit signing secrets and Privy config", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
      }),
    ).toThrow(/QR_SIGNING_SECRET is required/);
  });

  it("rejects production-like startup with demo auth enabled", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        QR_SIGNING_SECRET: "qr-secret-with-at-least-thirty-two-chars",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: TEST_PRIVY_PUBLIC_KEY,
        FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
        FANPASS_TRUST_PROXY_HOPS: "1",
        FANPASS_ENABLE_DEMO_AUTH: "true",
      }),
    ).toThrow(/FANPASS_ENABLE_DEMO_AUTH/);
  });

  it("rejects production-like startup with unverified USDC rates enabled", () => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        FANPASS_ALLOW_UNVERIFIED_USDC_RATE: "true",
      }),
    ).toThrow(/FANPASS_ALLOW_UNVERIFIED_USDC_RATE/);
  });

  it("rejects production-like startup without Privy configuration", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        QR_SIGNING_SECRET: "qr-secret-with-at-least-thirty-two-chars",
        FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
        FANPASS_TRUST_PROXY_HOPS: "1",
      }),
    ).toThrow(/PRIVY_APP_ID/);
  });

  it("rejects production-like payment mode without Stripe secrets", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        QR_SIGNING_SECRET: "qr-secret-with-at-least-thirty-two-chars",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: TEST_PRIVY_PUBLIC_KEY,
        FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
        FANPASS_TRUST_PROXY_HOPS: "1",
        FANPASS_ENABLE_PAYMENTS: "true",
      }),
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("rejects production-like payment mode without the settlement authorization gate", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        QR_SIGNING_SECRET: "qr-secret-with-at-least-thirty-two-chars",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: TEST_PRIVY_PUBLIC_KEY,
        FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
        FANPASS_TRUST_PROXY_HOPS: "1",
        FANPASS_ENABLE_PAYMENTS: "true",
        STRIPE_SECRET_KEY: "sk_test_with_at_least_thirty_two_characters",
        STRIPE_WEBHOOK_SECRET: "whsec_test_with_at_least_thirty_two_characters",
      }),
    ).toThrow(/FANPASS_REQUIRE_PAYMENT_AUTHORIZATION/);
  });

  it("rejects production-like testnet ownership until async saga settlement is complete", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        QR_SIGNING_SECRET: "qr-secret-with-at-least-thirty-two-chars",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: TEST_PRIVY_PUBLIC_KEY,
        FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
        FANPASS_TRUST_PROXY_HOPS: "1",
        FANPASS_ORDERBOOK_ADMISSION_SECRET:
          "orderbook-admission-secret-with-at-least-thirty-two-chars",
        OWNERSHIP_ADAPTER: "testnet",
      }),
    ).toThrow(/OWNERSHIP_ADAPTER=testnet/);
  });

  it("allows explicit private-key Sepolia writes for staging development only", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        FANPASS_ENV: "staging",
        QR_SIGNING_SECRET: "qr-secret-with-at-least-thirty-two-chars",
        FANPASS_ONSALE_QUEUE_SECRET:
          "onsale-secret-with-at-least-thirty-two-chars",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: TEST_PRIVY_PUBLIC_KEY,
        FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
        FANPASS_TRUST_PROXY_HOPS: "1",
        FANPASS_ORDERBOOK_ADMISSION_SECRET:
          "orderbook-admission-secret-with-at-least-thirty-two-chars",
        OWNERSHIP_ADAPTER: "testnet",
        FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "true",
        FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "true",
        FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES: "true",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
        TESTNET_OPERATOR_PRIVATE_KEY:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
        FANPASS_DATA_SOURCE: "prisma",
        DATABASE_URL: "postgresql://fanpass:secret@db.example/fanpass",
      }),
    ).not.toThrow();
  });

  it("still rejects explicit private-key testnet writes in production", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        FANPASS_ENV: "production",
        QR_SIGNING_SECRET: "qr-secret-with-at-least-thirty-two-chars",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: TEST_PRIVY_PUBLIC_KEY,
        FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
        FANPASS_TRUST_PROXY_HOPS: "1",
        OWNERSHIP_ADAPTER: "testnet",
        FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES: "true",
        TESTNET_RPC_URL: "https://rpc.testnet.example",
        TESTNET_OPERATOR_PRIVATE_KEY:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        FANPASS_TICKET_CONTRACT_ADDRESS:
          "0x0000000000000000000000000000000000001000",
      }),
    ).toThrow(/OWNERSHIP_ADAPTER=testnet/);
  });

  it("rejects wildcard CORS origins", () => {
    expect(() =>
      validateEnvironment({
        FANPASS_CORS_ORIGINS: "*",
      }),
    ).toThrow(/must not include/);
  });

  it("reads numeric env values as integers", () => {
    expect(
      readIntegerConfig(
        { get: <T>() => "120" as T },
        "RATE_LIMIT_VERIFY_PER_MINUTE",
        10,
      ),
    ).toBe(120);
  });

  it("allows staging QR TTL config while runtime credential windows stay capped", () => {
    expect(() =>
      validateEnvironment({
        QR_TTL_SECONDS: "300",
      }),
    ).not.toThrow();
  });

  it("rejects invalid dedicated auth and staff rate-limit config", () => {
    expect(() =>
      validateEnvironment({
        RATE_LIMIT_PRIVY_PER_MINUTE: "0",
      }),
    ).toThrow(/RATE_LIMIT_PRIVY_PER_MINUTE/);
    expect(() =>
      validateEnvironment({
        RATE_LIMIT_PRIVY_ORIGIN_PER_MINUTE: "10001",
      }),
    ).toThrow(/RATE_LIMIT_PRIVY_ORIGIN_PER_MINUTE/);
    expect(() =>
      validateEnvironment({
        RATE_LIMIT_STAFF_INVITE_PER_MINUTE: "501",
      }),
    ).toThrow(/RATE_LIMIT_STAFF_INVITE_PER_MINUTE/);
    expect(() =>
      validateEnvironment({
        RATE_LIMIT_STAFF_ASSIGNMENT_PER_MINUTE: "invalid",
      }),
    ).toThrow(/RATE_LIMIT_STAFF_ASSIGNMENT_PER_MINUTE/);
  });

  it("rejects invalid side-effect lock timeout config", () => {
    expect(() =>
      validateEnvironment({
        FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS: "29",
      }),
    ).toThrow(/FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS/);
    expect(() =>
      validateEnvironment({
        FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS: "3601",
      }),
    ).toThrow(/FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS/);
  });

  it("rejects invalid side-effect health timeout config", () => {
    expect(() =>
      validateEnvironment({
        SIDE_EFFECT_HEALTH_PROCESSING_STALE_SECONDS: "29",
      }),
    ).toThrow(/SIDE_EFFECT_HEALTH_PROCESSING_STALE_SECONDS/);
    expect(() =>
      validateEnvironment({
        SIDE_EFFECT_HEALTH_PENDING_STALE_SECONDS: "86401",
      }),
    ).toThrow(/SIDE_EFFECT_HEALTH_PENDING_STALE_SECONDS/);
  });
});

describe("local side-effect health runtime", () => {
  const safeProfile: Record<string, string> = {
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
    DATABASE_URL: "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass",
  };
  const reader = (values: Record<string, string>) => ({
    get: <T>(key: string) => values[key] as T | undefined,
    keys: () => Object.keys(values),
  });

  it("accepts only explicit loopback fanpass database targets", () => {
    for (const databaseUrl of [
      "postgresql://fanpass:secret@127.0.0.1:5432/fanpass",
      "postgres://fanpass:secret@127.0.0.1:55432/fanpass",
      "postgresql://fanpass:secret@[::1]:5432/fanpass",
    ]) {
      expect(isAllowedLocalHealthDatabase(databaseUrl)).toBe(true);
      expect(() =>
        assertLocalSideEffectHealthRuntime(
          reader({ ...safeProfile, DATABASE_URL: databaseUrl }),
        ),
      ).not.toThrow();
    }
  });

  it("rejects remote, aliased, overridden, and wrong-name database targets", () => {
    for (const databaseUrl of [
      "postgresql://fanpass:secret@db.example.test:5432/fanpass",
      "postgresql://fanpass:secret@2130706433:5432/fanpass",
      "postgresql://fanpass:secret@localhost:5432/fanpass",
      "postgresql://fanpass:secret@127.0.0.1:5432/fanpass_prod",
      "postgresql://fanpass:secret@127.0.0.1:5432/fanpass?sslmode=require",
      "postgresql://fanpass@127.0.0.1:5432/fanpass",
      "postgresql://:secret@127.0.0.1:5432/fanpass",
    ]) {
      expect(isAllowedLocalHealthDatabase(databaseUrl)).toBe(false);
      expect(() =>
        assertLocalSideEffectHealthRuntime(
          reader({ ...safeProfile, DATABASE_URL: databaseUrl }),
        ),
      ).toThrow(/explicit loopback host/);
    }
  });

  it("rejects every safety-profile drift and every provider credential", () => {
    for (const [key, value] of Object.entries({
      TZ: "Asia/Shanghai",
      NODE_ENV: "production",
      FANPASS_ENV: "staging",
      FANPASS_ENABLE_DEMO_AUTH: "true",
      FANPASS_ENABLE_PAYMENTS: "true",
      FANPASS_REQUIRE_PAYMENT_AUTHORIZATION: "false",
      FANPASS_ALLOW_MANUAL_CRYPTO_CONFIRMATION: "true",
      FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES: "true",
      FANPASS_ALLOW_UNVERIFIED_USDC_RATE: "true",
      FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "false",
      FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "false",
      FANPASS_SIDE_EFFECT_WORKER_ENABLED: "true",
      FANPASS_TRUST_PROXY_HOPS: "2",
      FANPASS_SIDE_EFFECT_HEALTH_LOCAL_ONLY: "false",
      OWNERSHIP_ADAPTER: "privy",
    })) {
      expect(() =>
        assertLocalSideEffectHealthRuntime(
          reader({ ...safeProfile, [key]: value }),
        ),
      ).toThrow(new RegExp(key));
    }

    for (const key of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "PRIVY_APP_SECRET",
      "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY",
      "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEYS",
      "TESTNET_OPERATOR_PRIVATE_KEY",
      "FANPASS_SEPOLIA_DEV_PRIVATE_KEY",
      "npm_config_//registry.npmjs.org/:_authToken",
      "privy_app_secret",
    ]) {
      expect(() =>
        assertLocalSideEffectHealthRuntime(
          reader({ ...safeProfile, [key]: "must-not-load" }),
        ),
      ).toThrow(new RegExp(key));
    }
  });
});
