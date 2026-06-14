import {
  readIntegerConfig,
  validateEnvironment,
} from "../src/config/security-config";

const TEST_PRIVY_PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\nfanpass-test-key\n-----END PUBLIC KEY-----";

describe("security config validation", () => {
  const productionConfig = {
    NODE_ENV: "production",
    QR_SIGNING_SECRET: "qr-secret-with-at-least-thirty-two-chars",
    PRIVY_APP_ID: "privy-app-demo",
    PRIVY_VERIFICATION_KEY: TEST_PRIVY_PUBLIC_KEY,
    FANPASS_CORS_ORIGINS: "https://console.fanpass.test",
    FANPASS_TRUST_PROXY_HOPS: "1",
  };

  it("accepts production-like startup with explicit trusted proxy hops", () => {
    expect(() => validateEnvironment(productionConfig)).not.toThrow();
  });

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
