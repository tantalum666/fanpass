import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createSign, generateKeyPairSync } from "crypto";
import { DemoStore } from "../src/common/demo-store";
import { AuthService } from "../src/modules/auth/auth.service";
import { PrivyTokenService } from "../src/modules/auth/privy-token.service";

describe("AuthService", () => {
  it("issues and verifies a signed session token", async () => {
    const store = new DemoStore();
    const auth = createAuth(
      { SESSION_SIGNING_SECRET: "test-session-secret" },
      store,
    );

    const session = await auth.issueDemoSession("usr_fan_demo");

    await expect(auth.verifyAccessToken(session.accessToken)).resolves.toEqual({
      userId: "usr_fan_demo",
      role: "FAN",
    });
  });

  it("rejects tampered session tokens", async () => {
    const store = new DemoStore();
    const auth = createAuth(
      { SESSION_SIGNING_SECRET: "test-session-secret" },
      store,
    );
    const session = await auth.issueDemoSession("usr_fan_demo");
    const tampered = session.accessToken.replace(
      /.$/,
      session.accessToken.endsWith("a") ? "b" : "a",
    );

    await expect(auth.verifyAccessToken(tampered)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("can disable local demo sessions", async () => {
    const store = new DemoStore();
    const auth = createAuth(
      {
        FANPASS_ENABLE_DEMO_AUTH: "false",
        SESSION_SIGNING_SECRET: "test-session-secret",
      },
      store,
    );

    await expect(auth.issueDemoSession("usr_fan_demo")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("verifies Privy access tokens against linked FanPass users", async () => {
    const store = new DemoStore();
    const { privateKey, publicKey } = createEs256KeyPair();
    const auth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: publicKey,
      },
      store,
    );
    const token = signPrivyToken(privateKey, {
      iss: "privy.io",
      aud: "privy-app-demo",
      sub: "did:privy:fan-demo",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(auth.verifyAccessToken(token)).resolves.toEqual({
      userId: "usr_fan_demo",
      role: "FAN",
    });
  });

  it("syncs a first-time Privy user without requiring Privy webhooks", async () => {
    const store = new DemoStore();
    const { privateKey, publicKey } = createEs256KeyPair();
    const auth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: publicKey,
      },
      store,
    );
    const token = signPrivyToken(privateKey, {
      iss: "privy.io",
      aud: "privy-app-demo",
      sub: "did:privy:new-fan",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(auth.verifyAccessToken(token)).rejects.toThrow(
      UnauthorizedException,
    );

    const synced = await auth.syncPrivyUser(token, {
      email: "new-fan@example.com",
      name: "New Fan",
      walletAddress: "0x0000000000000000000000000000000000003001",
      walletId: "wallet_new_fan",
    });

    expect(synced).toMatchObject({
      displayName: "New Fan",
      email: "new-fan@example.com",
      role: "FAN",
      walletAddress: "0x0000000000000000000000000000000000003001",
      accessToken: null,
      authProvider: "privy",
      privyId: "did:privy:new-fan",
      created: true,
    });
    expect(store.users.find((user) => user.id === synced.userId)).toMatchObject({
      privyWalletId: "wallet_new_fan",
    });
    await expect(auth.verifyAccessToken(token)).resolves.toEqual({
      userId: synced.userId,
      role: "FAN",
    });
  });

  it("preserves linked FanPass roles during Privy sync", async () => {
    const store = new DemoStore();
    const { privateKey, publicKey } = createEs256KeyPair();
    const auth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: publicKey,
      },
      store,
    );
    const token = signPrivyToken(privateKey, {
      iss: "privy.io",
      aud: "privy-app-demo",
      sub: "did:privy:organizer-demo",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    const synced = await auth.syncPrivyUser(token, {
      email: "attempted-change@example.com",
      name: "Attempted Change",
    });

    expect(synced).toMatchObject({
      userId: "usr_organizer_demo",
      displayName: "Demo Organizer",
      email: "organizer@fanpass.test",
      role: "ORGANIZER",
      authProvider: "privy",
      created: false,
    });
  });

  it("does not let first-time Privy users claim an existing FanPass email", async () => {
    const store = new DemoStore();
    const { privateKey, publicKey } = createEs256KeyPair();
    const auth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: publicKey,
      },
      store,
    );
    const token = signPrivyToken(privateKey, {
      iss: "privy.io",
      aud: "privy-app-demo",
      sub: "did:privy:email-collision",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    const synced = await auth.syncPrivyUser(token, {
      email: "organizer@fanpass.test",
      name: "Email Collision",
    });

    expect(synced).toMatchObject({
      displayName: "Email Collision",
      role: "FAN",
      created: true,
    });
    expect(synced.email).toMatch(/^privy_/);
    expect(synced.email).toContain("@privy.fanpass.local");
  });

  it("rejects local session tokens in production-like environments", async () => {
    const store = new DemoStore();
    const localAuth = createAuth(
      { SESSION_SIGNING_SECRET: "test-session-secret" },
      store,
    );
    const productionAuth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY:
          "-----BEGIN PUBLIC KEY-----\ninvalid\n-----END PUBLIC KEY-----",
      },
      store,
    );
    const session = await localAuth.issueDemoSession("usr_fan_demo");

    await expect(
      productionAuth.verifyAccessToken(session.accessToken),
    ).rejects.toThrow(UnauthorizedException);
  });
});

function createAuth(configValues: Record<string, string>, store: DemoStore) {
  const config = new ConfigService(configValues);
  return new AuthService(config, store, new PrivyTokenService(config));
}

function createEs256KeyPair() {
  return generateKeyPairSync("ec", {
    namedCurve: "P-256",
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
  });
}

function signPrivyToken(privateKey: string, payload: Record<string, unknown>) {
  const header = base64url(JSON.stringify({ alg: "ES256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = createSign("sha256")
    .update(`${header}.${body}`)
    .sign({ key: privateKey, dsaEncoding: "ieee-p1363" })
    .toString("base64url");

  return `${header}.${body}.${signature}`;
}

function base64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}
