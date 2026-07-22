import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createSign, generateKeyPairSync } from "crypto";
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

  it("does not expose an unverified wallet in a local session", async () => {
    const store = new DemoStore();
    const auth = createAuth(
      { SESSION_SIGNING_SECRET: "test-session-secret" },
      store,
    );

    const session = await auth.issueDemoSession("usr_fan_demo");
    const encodedPayload = session.accessToken.split(".")[1];
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as { walletAddress: string | null };

    expect(session).toMatchObject({
      walletAddress: null,
      privyWalletId: null,
    });
    expect(payload.walletAddress).toBeNull();
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
    const walletAddress = "0x0000000000000000000000000000000000003001";
    const privyWallets = {
      resolveUserEmbeddedEthereumWallet: jest.fn(async () => ({
        walletId: "wallet_new_fan",
        walletAddress,
      })),
    };
    const auth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: publicKey,
      },
      store,
      privyWallets,
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
      walletAddress,
      walletId: "wallet_new_fan",
    });

    expect(synced).toMatchObject({
      displayName: "New Fan",
      email: "new-fan@example.com",
      role: "FAN",
      walletAddress,
      accessToken: null,
      authProvider: "privy",
      privyId: "did:privy:new-fan",
      created: true,
    });
    expect(store.users.find((user) => user.id === synced.userId)).toMatchObject(
      {
        privyWalletId: "wallet_new_fan",
        walletBindingStatus: "VERIFIED",
        walletBindingVersion: 1,
        walletBindingVerifiedAt: expect.any(String),
        walletBindingFingerprint: walletBindingFingerprintForTest({
          privyId: "did:privy:new-fan",
          walletId: "wallet_new_fan",
          walletAddress,
        }),
      },
    );
    expect(privyWallets.resolveUserEmbeddedEthereumWallet).toHaveBeenCalledWith(
      {
        privyUserId: "did:privy:new-fan",
        walletId: "wallet_new_fan",
        walletAddress,
      },
    );
    await expect(auth.verifyAccessToken(token)).resolves.toEqual({
      userId: synced.userId,
      role: "FAN",
    });
  });

  it("does not persist a caller-supplied wallet when Privy ownership validation fails", async () => {
    const store = new DemoStore();
    const { privateKey, publicKey } = createEs256KeyPair();
    const auth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: publicKey,
      },
      store,
      {
        resolveUserEmbeddedEthereumWallet: jest.fn(async () => {
          throw new UnauthorizedException(
            "Wallet is not linked to the authenticated Privy user",
          );
        }),
      },
    );
    const token = signPrivyToken(privateKey, {
      iss: "privy.io",
      aud: "privy-app-demo",
      sub: "did:privy:wallet-attacker",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(
      auth.syncPrivyUser(token, {
        walletAddress: "0x0000000000000000000000000000000000003999",
        walletId: "wallet_victim",
      }),
    ).rejects.toThrow("Wallet is not linked to the authenticated Privy user");
    expect(
      store.users.find((user) => user.privyId === "did:privy:wallet-attacker"),
    ).toBeUndefined();
  });

  it("does not expose a legacy unverified wallet during a wallet-less Privy sync", async () => {
    const store = new DemoStore();
    const legacyUser = store.users.find(
      (user) => user.privyId === "did:privy:fan-demo",
    );
    expect(legacyUser).toBeDefined();
    Object.assign(legacyUser!, {
      privyWalletId: "wallet_legacy_unverified",
      walletAddress: "0x0000000000000000000000000000000000003999",
      walletBindingStatus: "UNVERIFIED",
      walletBindingVerifiedAt: null,
      walletBindingVersion: 0,
      walletBindingFingerprint: null,
    });
    const { privateKey, publicKey } = createEs256KeyPair();
    const privyWallets = {
      resolveUserEmbeddedEthereumWallet: jest.fn(),
    };
    const auth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: publicKey,
      },
      store,
      privyWallets as never,
    );
    const token = signPrivyToken(privateKey, {
      iss: "privy.io",
      aud: "privy-app-demo",
      sub: "did:privy:fan-demo",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(auth.syncPrivyUser(token)).resolves.toMatchObject({
      userId: "usr_fan_demo",
      walletAddress: null,
      privyWalletId: null,
      created: false,
    });
    expect(
      privyWallets.resolveUserEmbeddedEthereumWallet,
    ).not.toHaveBeenCalled();
    expect(legacyUser).toMatchObject({
      privyWalletId: "wallet_legacy_unverified",
      walletAddress: "0x0000000000000000000000000000000000003999",
      walletBindingStatus: "UNVERIFIED",
      walletBindingVersion: 0,
    });
  });

  it("lets a provider-authoritative wallet replace an unverified legacy binding", async () => {
    const store = new DemoStore();
    const legacyUser = store.users.find(
      (user) => user.privyId === "did:privy:fan-demo",
    );
    expect(legacyUser).toBeDefined();
    Object.assign(legacyUser!, {
      privyWalletId: "wallet_legacy_unverified",
      walletAddress: "0x0000000000000000000000000000000000003999",
      walletBindingStatus: "UNVERIFIED",
      walletBindingVerifiedAt: null,
      walletBindingVersion: 0,
      walletBindingFingerprint: null,
    });
    const walletId = "wallet_verified_fan";
    const walletAddress = "0x0000000000000000000000000000000000003001";
    const { privateKey, publicKey } = createEs256KeyPair();
    const privyWallets = {
      resolveUserEmbeddedEthereumWallet: jest.fn(async () => ({
        walletId,
        walletAddress,
      })),
    };
    const auth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: publicKey,
      },
      store,
      privyWallets,
    );
    const token = signPrivyToken(privateKey, {
      iss: "privy.io",
      aud: "privy-app-demo",
      sub: "did:privy:fan-demo",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(
      auth.syncPrivyUser(token, { walletId, walletAddress }),
    ).resolves.toMatchObject({
      userId: "usr_fan_demo",
      walletAddress,
      privyWalletId: walletId,
    });
    expect(legacyUser).toMatchObject({
      privyWalletId: walletId,
      walletAddress,
      walletBindingStatus: "VERIFIED",
      walletBindingVersion: 1,
      walletBindingVerifiedAt: expect.any(String),
      walletBindingFingerprint: walletBindingFingerprintForTest({
        privyId: "did:privy:fan-demo",
        walletId,
        walletAddress,
      }),
    });
  });

  it("restores an exact verified wallet session without a Privy Management API call", async () => {
    const store = new DemoStore();
    const user = store.users.find(
      (candidate) => candidate.privyId === "did:privy:fan-demo",
    );
    expect(user).toBeDefined();
    const walletId = "wallet_verified_fan";
    const walletAddress = "0x0000000000000000000000000000000000003001";
    Object.assign(user!, {
      privyWalletId: walletId,
      walletAddress,
      walletBindingStatus: "VERIFIED",
      walletBindingVerifiedAt: "2026-07-19T00:00:00.000Z",
      walletBindingVersion: 7,
      walletBindingFingerprint: walletBindingFingerprintForTest({
        privyId: "did:privy:fan-demo",
        walletId,
        walletAddress,
      }),
    });
    const { privateKey, publicKey } = createEs256KeyPair();
    const resolveUserEmbeddedEthereumWallet = jest.fn(async () => {
      throw new Error("Privy Management API must not be called");
    });
    const auth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: publicKey,
      },
      store,
      {
        resolveUserEmbeddedEthereumWallet,
      },
    );
    const token = signPrivyToken(privateKey, {
      iss: "privy.io",
      aud: "privy-app-demo",
      sub: "did:privy:fan-demo",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(
      auth.syncPrivyUser(token, { walletId, walletAddress }),
    ).resolves.toMatchObject({
      walletAddress,
      privyWalletId: walletId,
    });

    expect(user).toMatchObject({
      walletBindingStatus: "VERIFIED",
      walletBindingVersion: 7,
      walletBindingVerifiedAt: "2026-07-19T00:00:00.000Z",
    });
    await expect(auth.syncPrivyUser(token)).resolves.toMatchObject({
      walletAddress,
      privyWalletId: walletId,
    });
    const partialTupleAttempt = auth.syncPrivyUser(token, { walletId });
    await expect(partialTupleAttempt).rejects.toMatchObject({
      response: { code: "REBIND_REQUIRED" },
    });
    expect(resolveUserEmbeddedEthereumWallet).not.toHaveBeenCalled();
  });

  it("does not silently replace an already verified wallet binding", async () => {
    const store = new DemoStore();
    const user = store.users.find(
      (candidate) => candidate.privyId === "did:privy:fan-demo",
    );
    expect(user).toBeDefined();
    const currentWalletId = "wallet_verified_fan";
    const currentWalletAddress = "0x0000000000000000000000000000000000003001";
    Object.assign(user!, {
      privyWalletId: currentWalletId,
      walletAddress: currentWalletAddress,
      walletBindingStatus: "VERIFIED",
      walletBindingVerifiedAt: "2026-07-20T00:00:00.000Z",
      walletBindingVersion: 4,
      walletBindingFingerprint: walletBindingFingerprintForTest({
        privyId: "did:privy:fan-demo",
        walletId: currentWalletId,
        walletAddress: currentWalletAddress,
      }),
    });
    const nextWalletId = "wallet_different";
    const nextWalletAddress = "0x0000000000000000000000000000000000003999";
    const { privateKey, publicKey } = createEs256KeyPair();
    const resolveUserEmbeddedEthereumWallet = jest.fn(async () => ({
      walletId: nextWalletId,
      walletAddress: nextWalletAddress,
    }));
    const auth = createAuth(
      {
        FANPASS_ENV: "production",
        PRIVY_APP_ID: "privy-app-demo",
        PRIVY_VERIFICATION_KEY: publicKey,
      },
      store,
      {
        resolveUserEmbeddedEthereumWallet,
      },
    );
    const token = signPrivyToken(privateKey, {
      iss: "privy.io",
      aud: "privy-app-demo",
      sub: "did:privy:fan-demo",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    const attempt = auth.syncPrivyUser(token, {
      walletId: nextWalletId,
      walletAddress: nextWalletAddress,
    });
    await expect(attempt).rejects.toThrow(BadRequestException);
    await expect(attempt).rejects.toMatchObject({
      response: {
        code: "REBIND_REQUIRED",
      },
    });
    expect(resolveUserEmbeddedEthereumWallet).not.toHaveBeenCalled();
    expect(user).toMatchObject({
      privyWalletId: currentWalletId,
      walletAddress: currentWalletAddress,
      walletBindingStatus: "VERIFIED",
      walletBindingVersion: 4,
    });
  });

  it("writes the provider tuple and provenance with a Prisma compare-and-swap", async () => {
    const previousDataSource = process.env.FANPASS_DATA_SOURCE;
    process.env.FANPASS_DATA_SOURCE = "prisma";
    try {
      const store = new DemoStore();
      const walletId = "wallet_prisma_verified";
      const walletAddress = "0x0000000000000000000000000000000000003001";
      const prismaUser = {
        id: "usr_prisma_fan",
        name: "Prisma Fan",
        email: "prisma-fan@example.com",
        role: "FAN" as const,
        privyId: "did:privy:prisma-fan",
        privyWalletId: "wallet_legacy",
        walletAddress: "0x0000000000000000000000000000000000003999",
        walletBindingStatus: "UNVERIFIED" as const,
        walletBindingVerifiedAt: null,
        walletBindingVersion: 0,
        walletBindingFingerprint: null,
        riskScore: 0,
      };
      const updateMany = jest.fn(
        async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const matches = Object.entries(args.where).every(([key, value]) =>
            key === "id"
              ? value === prismaUser.id
              : prismaUser[key as keyof typeof prismaUser] === value,
          );
          if (!matches) {
            return { count: 0 };
          }
          Object.assign(prismaUser, args.data);
          return { count: 1 };
        },
      );
      const prisma = {
        user: {
          findUnique: jest.fn(
            async (args: { where: Record<string, unknown> }) =>
              args.where.privyId === prismaUser.privyId ||
              args.where.id === prismaUser.id
                ? prismaUser
                : null,
          ),
          updateMany,
        },
      };
      const { privateKey, publicKey } = createEs256KeyPair();
      const auth = createAuth(
        {
          FANPASS_ENV: "production",
          PRIVY_APP_ID: "privy-app-demo",
          PRIVY_VERIFICATION_KEY: publicKey,
        },
        store,
        {
          resolveUserEmbeddedEthereumWallet: jest.fn(async () => ({
            walletId,
            walletAddress,
          })),
        },
        prisma,
      );
      const token = signPrivyToken(privateKey, {
        iss: "privy.io",
        aud: "privy-app-demo",
        sub: prismaUser.privyId,
        exp: Math.floor(Date.now() / 1000) + 300,
      });

      await expect(
        auth.syncPrivyUser(token, { walletId, walletAddress }),
      ).resolves.toMatchObject({
        userId: prismaUser.id,
        walletAddress,
        privyWalletId: walletId,
      });
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: prismaUser.id,
          privyId: prismaUser.privyId,
          privyWalletId: "wallet_legacy",
          walletAddress: "0x0000000000000000000000000000000000003999",
          walletBindingStatus: "UNVERIFIED",
          walletBindingVerifiedAt: null,
          walletBindingVersion: 0,
          walletBindingFingerprint: null,
        },
        data: {
          privyWalletId: walletId,
          walletAddress,
          walletBindingStatus: "VERIFIED",
          walletBindingVerifiedAt: expect.any(Date),
          walletBindingVersion: 1,
          walletBindingFingerprint: walletBindingFingerprintForTest({
            privyId: prismaUser.privyId,
            walletId,
            walletAddress,
          }),
        },
      });
    } finally {
      if (previousDataSource === undefined) {
        delete process.env.FANPASS_DATA_SOURCE;
      } else {
        process.env.FANPASS_DATA_SOURCE = previousDataSource;
      }
    }
  });

  it("treats a lost compare-and-swap as idempotent when the same tuple won", async () => {
    const previousDataSource = process.env.FANPASS_DATA_SOURCE;
    process.env.FANPASS_DATA_SOURCE = "prisma";
    try {
      const store = new DemoStore();
      const walletId = "wallet_same_winner";
      const walletAddress = "0x0000000000000000000000000000000000003021";
      const prismaUser: Record<string, unknown> = {
        id: "usr_prisma_same_race",
        name: "Same Race",
        email: "same-race@example.com",
        role: "FAN",
        privyId: "did:privy:same-race",
        privyWalletId: null,
        walletAddress: null,
        walletBindingStatus: "UNVERIFIED",
        walletBindingVerifiedAt: null,
        walletBindingVersion: 0,
        walletBindingFingerprint: null,
        riskScore: 0,
      };
      const updateMany = jest.fn(
        async (args: { data: Record<string, unknown> }) => {
          Object.assign(prismaUser, args.data);
          return { count: 0 };
        },
      );
      const prisma = {
        user: {
          findUnique: jest.fn(
            async (args: { where: Record<string, unknown> }) =>
              args.where.privyId === prismaUser.privyId ||
              args.where.id === prismaUser.id
                ? prismaUser
                : null,
          ),
          updateMany,
        },
      };
      const { privateKey, publicKey } = createEs256KeyPair();
      const auth = createAuth(
        {
          FANPASS_ENV: "production",
          PRIVY_APP_ID: "privy-app-demo",
          PRIVY_VERIFICATION_KEY: publicKey,
        },
        store,
        {
          resolveUserEmbeddedEthereumWallet: jest.fn(async () => ({
            walletId,
            walletAddress,
          })),
        },
        prisma,
      );
      const token = signPrivyToken(privateKey, {
        iss: "privy.io",
        aud: "privy-app-demo",
        sub: prismaUser.privyId,
        exp: Math.floor(Date.now() / 1000) + 300,
      });

      await expect(
        auth.syncPrivyUser(token, { walletId, walletAddress }),
      ).resolves.toMatchObject({
        userId: prismaUser.id,
        privyWalletId: walletId,
        walletAddress,
      });
      expect(updateMany).toHaveBeenCalledTimes(1);
      await expect(updateMany.mock.results[0].value).resolves.toEqual({
        count: 0,
      });
    } finally {
      if (previousDataSource === undefined) {
        delete process.env.FANPASS_DATA_SOURCE;
      } else {
        process.env.FANPASS_DATA_SOURCE = previousDataSource;
      }
    }
  });

  it("allows only one of two concurrent authoritative wallet tuples to win", async () => {
    const previousDataSource = process.env.FANPASS_DATA_SOURCE;
    process.env.FANPASS_DATA_SOURCE = "prisma";
    try {
      const store = new DemoStore();
      const prismaUser: Record<string, unknown> = {
        id: "usr_prisma_race",
        name: "Prisma Race",
        email: "prisma-race@example.com",
        role: "FAN",
        privyId: "did:privy:prisma-race",
        privyWalletId: null,
        walletAddress: null,
        walletBindingStatus: "UNVERIFIED",
        walletBindingVerifiedAt: null,
        walletBindingVersion: 0,
        walletBindingFingerprint: null,
        riskScore: 0,
      };
      const updateMany = jest.fn(
        async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const matches = Object.entries(args.where).every(
            ([key, value]) => prismaUser[key] === value,
          );
          if (!matches) {
            return { count: 0 };
          }
          Object.assign(prismaUser, args.data);
          return { count: 1 };
        },
      );
      const prisma = {
        user: {
          findUnique: jest.fn(
            async (args: { where: Record<string, unknown> }) =>
              args.where.privyId === prismaUser.privyId ||
              args.where.id === prismaUser.id
                ? prismaUser
                : null,
          ),
          updateMany,
        },
      };
      let providerCalls = 0;
      let releaseProviderCalls: (() => void) | undefined;
      const bothProviderCallsStarted = new Promise<void>((resolve) => {
        releaseProviderCalls = resolve;
      });
      const resolveUserEmbeddedEthereumWallet = jest.fn(
        async (input: { walletId?: string; walletAddress?: string }) => {
          providerCalls += 1;
          if (providerCalls === 2) {
            releaseProviderCalls?.();
          }
          await bothProviderCallsStarted;
          return {
            walletId: input.walletId!,
            walletAddress: input.walletAddress!,
          };
        },
      );
      const { privateKey, publicKey } = createEs256KeyPair();
      const auth = createAuth(
        {
          FANPASS_ENV: "production",
          PRIVY_APP_ID: "privy-app-demo",
          PRIVY_VERIFICATION_KEY: publicKey,
        },
        store,
        { resolveUserEmbeddedEthereumWallet },
        prisma,
      );
      const token = signPrivyToken(privateKey, {
        iss: "privy.io",
        aud: "privy-app-demo",
        sub: prismaUser.privyId,
        exp: Math.floor(Date.now() / 1000) + 300,
      });
      const tuples = [
        {
          walletId: "wallet_race_a",
          walletAddress: "0x0000000000000000000000000000000000003011",
        },
        {
          walletId: "wallet_race_b",
          walletAddress: "0x0000000000000000000000000000000000003012",
        },
      ];

      const results = await Promise.allSettled(
        tuples.map((tuple) => auth.syncPrivyUser(token, tuple)),
      );
      const fulfilled = results.filter(
        (
          result,
        ): result is PromiseFulfilledResult<
          Awaited<ReturnType<typeof auth.syncPrivyUser>>
        > => result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({
        response: { code: "WALLET_BINDING_CONFLICT" },
      });
      expect(updateMany).toHaveBeenCalledTimes(2);
      expect(prismaUser).toMatchObject({
        privyWalletId: fulfilled[0].value.privyWalletId,
        walletAddress: fulfilled[0].value.walletAddress,
        walletBindingStatus: "VERIFIED",
        walletBindingVersion: 1,
      });
    } finally {
      if (previousDataSource === undefined) {
        delete process.env.FANPASS_DATA_SOURCE;
      } else {
        process.env.FANPASS_DATA_SOURCE = previousDataSource;
      }
    }
  });

  it("locks the invited staff user before reading or linking its Privy identity", async () => {
    const previousDataSource = process.env.FANPASS_DATA_SOURCE;
    process.env.FANPASS_DATA_SOURCE = "prisma";
    try {
      const store = new DemoStore();
      const fake = createStaffInvitePrismaFake();
      const { privateKey, publicKey } = createEs256KeyPair();
      const auth = createAuth(
        {
          FANPASS_ENV: "production",
          PRIVY_APP_ID: "privy-app-demo",
          PRIVY_VERIFICATION_KEY: publicKey,
        },
        store,
        undefined,
        fake.prisma,
      );
      const token = signPrivyToken(privateKey, {
        iss: "privy.io",
        aud: "privy-app-demo",
        sub: "did:privy:staff-a",
        exp: Math.floor(Date.now() / 1000) + 300,
      });

      await expect(
        auth.acceptStaffInvite(token, { inviteToken: "invite-a" }),
      ).resolves.toMatchObject({
        userId: fake.staff.id,
        privyId: "did:privy:staff-a",
        inviteAccepted: true,
      });

      const lockIndex = fake.order.indexOf("user.lock");
      const firstUserReadIndex = fake.order.findIndex((entry) =>
        entry.startsWith("user.findUnique"),
      );
      expect(lockIndex).toBeGreaterThanOrEqual(0);
      expect(lockIndex).toBeLessThan(firstUserReadIndex);
      expect(fake.lockQueries).toHaveLength(1);
      expect(fake.lockQueries[0]).toContain('FROM "users"');
      expect(fake.lockQueries[0]).toContain('WHERE "id" =');
      expect(fake.lockQueries[0]).toContain("FOR UPDATE");
    } finally {
      if (previousDataSource === undefined) {
        delete process.env.FANPASS_DATA_SOURCE;
      } else {
        process.env.FANPASS_DATA_SOURCE = previousDataSource;
      }
    }
  });

  it("does not let two different invites concurrently overwrite one staff identity", async () => {
    const previousDataSource = process.env.FANPASS_DATA_SOURCE;
    process.env.FANPASS_DATA_SOURCE = "prisma";
    try {
      const store = new DemoStore();
      const fake = createStaffInvitePrismaFake();
      const { privateKey, publicKey } = createEs256KeyPair();
      const auth = createAuth(
        {
          FANPASS_ENV: "production",
          PRIVY_APP_ID: "privy-app-demo",
          PRIVY_VERIFICATION_KEY: publicKey,
        },
        store,
        undefined,
        fake.prisma,
      );
      const tokenA = signPrivyToken(privateKey, {
        iss: "privy.io",
        aud: "privy-app-demo",
        sub: "did:privy:staff-a",
        exp: Math.floor(Date.now() / 1000) + 300,
      });
      const tokenB = signPrivyToken(privateKey, {
        iss: "privy.io",
        aud: "privy-app-demo",
        sub: "did:privy:staff-b",
        exp: Math.floor(Date.now() / 1000) + 300,
      });

      const results = await Promise.allSettled([
        auth.acceptStaffInvite(tokenA, { inviteToken: "invite-a" }),
        auth.acceptStaffInvite(tokenB, { inviteToken: "invite-b" }),
      ]);
      const fulfilled = results.filter(
        (result) => result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({
        response: {
          message: "Staff invite is already linked to another Privy user",
        },
      });
      expect(
        fake.invites.filter((invite) => invite.status === "ACCEPTED"),
      ).toHaveLength(1);
      expect(fake.staff.privyId).toBe(
        fake.invites.find((invite) => invite.status === "ACCEPTED")
          ?.acceptedPrivyId,
      );
    } finally {
      if (previousDataSource === undefined) {
        delete process.env.FANPASS_DATA_SOURCE;
      } else {
        process.env.FANPASS_DATA_SOURCE = previousDataSource;
      }
    }
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

function createStaffInvitePrismaFake() {
  const order: string[] = [];
  const lockQueries: string[] = [];
  const staff = {
    id: "usr_staff_invited",
    name: "Invited Staff",
    email: "invited-staff@example.com",
    role: "GATE_STAFF" as const,
    privyId: null as string | null,
    privyWalletId: null,
    walletAddress: null,
    walletBindingStatus: "UNVERIFIED" as const,
    walletBindingVerifiedAt: null,
    walletBindingVersion: 0,
    walletBindingFingerprint: null,
    riskScore: 0,
  };
  const invites = ["a", "b"].map((suffix) => ({
    id: `invite_${suffix}`,
    eventId: "evt_staff",
    gateAssignmentId: `assignment_${suffix}`,
    staffUserId: staff.id,
    email: staff.email,
    tokenHash: createHash("sha256").update(`invite-${suffix}`).digest("hex"),
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null as Date | null,
    acceptedPrivyId: null as string | null,
    createdByUserId: "usr_organizer_demo",
  }));
  const assignments = new Map(
    invites.map((invite) => [
      invite.gateAssignmentId,
      { id: invite.gateAssignmentId, active: true },
    ]),
  );
  let lockTail = Promise.resolve();

  const prisma = {
    $transaction: jest.fn(
      async (
        callback: (transaction: Record<string, unknown>) => Promise<unknown>,
      ) => {
        const predecessor = lockTail;
        let releaseLock: (() => void) | undefined;
        lockTail = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
        const transaction = {
          $queryRaw: jest.fn(
            async (query: TemplateStringsArray, _staffUserId: string) => {
              order.push("user.lock");
              lockQueries.push(query.join(" ? "));
              await predecessor;
              return [{ id: staff.id }];
            },
          ),
          staffInvite: {
            findUnique: jest.fn(
              async (args: { where: { tokenHash: string } }) => {
                order.push("invite.findUnique");
                return (
                  invites.find(
                    (invite) => invite.tokenHash === args.where.tokenHash,
                  ) ?? null
                );
              },
            ),
            update: jest.fn(
              async (args: {
                where: { id: string };
                data: Record<string, unknown>;
              }) => {
                const invite = invites.find(
                  (candidate) => candidate.id === args.where.id,
                );
                if (!invite) {
                  throw new Error("invite not found");
                }
                Object.assign(invite, args.data);
                return invite;
              },
            ),
            updateMany: jest.fn(
              async (args: {
                where: Record<string, unknown>;
                data: Record<string, unknown>;
              }) => {
                const invite = invites.find(
                  (candidate) => candidate.id === args.where.id,
                );
                const matches =
                  invite &&
                  Object.entries(args.where).every(
                    ([key, value]) =>
                      invite[key as keyof typeof invite] === value,
                  );
                if (!invite || !matches) {
                  return { count: 0 };
                }
                Object.assign(invite, args.data);
                return { count: 1 };
              },
            ),
          },
          gateAssignment: {
            findUnique: jest.fn(async (args: { where: { id: string } }) => {
              order.push("assignment.findUnique");
              return assignments.get(args.where.id) ?? null;
            }),
          },
          user: {
            findUnique: jest.fn(
              async (args: { where: Record<string, unknown> }) => {
                if ("privyId" in args.where) {
                  order.push("user.findUnique:privyId");
                  return staff.privyId === args.where.privyId ? staff : null;
                }
                order.push("user.findUnique:id");
                return staff.id === args.where.id ? staff : null;
              },
            ),
            update: jest.fn(
              async (args: {
                where: { id: string };
                data: Record<string, unknown>;
              }) => {
                if (args.where.id !== staff.id) {
                  throw new Error("staff not found");
                }
                Object.assign(staff, args.data);
                return staff;
              },
            ),
          },
        };
        try {
          return await callback(transaction);
        } finally {
          releaseLock?.();
        }
      },
    ),
  };

  return { prisma, order, lockQueries, staff, invites };
}

function createAuth(
  configValues: Record<string, string>,
  store: DemoStore,
  privyWallets?: {
    resolveUserEmbeddedEthereumWallet: (input: {
      privyUserId: string;
      walletId?: string;
      walletAddress?: string;
    }) => Promise<{ walletId: string; walletAddress: string }>;
  },
  prisma?: unknown,
) {
  const config = new ConfigService(configValues);
  return new AuthService(
    config,
    store,
    new PrivyTokenService(config),
    prisma as never,
    privyWallets as never,
  );
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

function walletBindingFingerprintForTest(input: {
  privyId: string;
  walletId: string;
  walletAddress: string;
}) {
  return createHash("sha256")
    .update(
      [
        "fanpass-wallet-binding-v1",
        "privy",
        input.privyId.trim(),
        input.walletId.trim(),
        input.walletAddress.trim().toLowerCase(),
      ].join("\0"),
    )
    .digest("hex");
}
