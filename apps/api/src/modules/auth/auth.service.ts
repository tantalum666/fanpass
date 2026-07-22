import {
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { DemoStore } from "../../common/demo-store";
import { UserRecord } from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import { FanPassSession } from "../../common/session";
import {
  type VerifiedWalletBinding,
  verifiedWalletBindingOrNull,
  walletBindingFingerprint,
} from "../../common/wallet-binding";
import {
  isProductionLikeEnvironment,
  readIntegerConfig,
} from "../../config/security-config";
import {
  PrivyWalletService,
  type VerifiedPrivyWallet,
} from "../privy/privy-wallet.service";
import { PrivyTokenService } from "./privy-token.service";

interface TokenPayload extends FanPassSession {
  email: string;
  displayName: string;
  walletAddress: string | null;
  exp: number;
}

export interface SyncPrivyUserInput {
  email?: string;
  name?: string;
  walletAddress?: string;
  walletId?: string;
}

export interface AcceptStaffInviteInput {
  inviteToken: string;
  name?: string;
  walletAddress?: string;
  walletId?: string;
}

interface VerifiedWalletBindingPersistence {
  privyWalletId: string;
  walletAddress: string;
  walletBindingStatus: "VERIFIED";
  walletBindingVerifiedAt: Date;
  walletBindingVersion: number;
  walletBindingFingerprint: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly store: DemoStore,
    private readonly privyTokens: PrivyTokenService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly privyWallets?: PrivyWalletService,
  ) {}

  async issueSession(user: UserRecord) {
    this.assertLocalSessionsEnabled();
    const sessionWallet = verifiedWalletBindingOrNull(user);
    const payload: TokenPayload = {
      userId: user.id,
      role: user.role,
      email: user.email,
      displayName: user.name,
      walletAddress: sessionWallet?.walletAddress ?? null,
      exp: Math.floor(Date.now() / 1000) + this.tokenTtlSeconds(),
    };
    return {
      userId: payload.userId,
      displayName: payload.displayName,
      email: payload.email,
      role: payload.role,
      walletAddress: payload.walletAddress,
      privyWalletId: sessionWallet?.privyWalletId ?? null,
      accessToken: this.signPayload(payload),
      authProvider: "local" as const,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  }

  async issueDemoSession(userId: string) {
    if (!this.demoAuthEnabled()) {
      throw new BadRequestException("Demo sessions are disabled");
    }
    const user = await this.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException("Demo user not found");
    }
    return this.issueSession(user);
  }

  async verifyAccessToken(token: string): Promise<FanPassSession> {
    if (this.privyAuthRequired()) {
      return this.verifyPrivyAccessToken(token);
    }

    if (
      this.privyConfigured() &&
      this.privyTokens.readJwtAlgorithm(token) !== "HS256"
    ) {
      return this.verifyPrivyAccessToken(token);
    }

    return this.verifyLocalAccessToken(token);
  }

  async syncPrivyUser(token: string, input: SyncPrivyUserInput = {}) {
    const { payload } = this.privyTokens.verifyAccessToken(token);
    if (typeof payload.sub !== "string" || !payload.sub) {
      throw new UnauthorizedException("Privy access token is missing sub");
    }
    const privyId = payload.sub;
    let user = await this.findUserByPrivyId(payload.sub);
    let verifiedWallet: VerifiedPrivyWallet | null = null;
    let created = false;
    if (!user) {
      verifiedWallet = await this.verifyPrivyWalletInput(privyId, input);
      user = await this.createPrivyFanUser(payload.sub, input, verifiedWallet);
      created = true;
    } else {
      const currentBinding = verifiedWalletBindingOrNull(user);
      if (currentBinding) {
        this.assertSubmittedWalletMatchesVerifiedBinding(
          currentBinding,
          privyId,
          input,
        );
      } else {
        this.assertWalletBindingCanBeUpgraded(user);
        verifiedWallet = await this.verifyPrivyWalletInput(privyId, input);
        user = await this.updatePrivyProfile(user, privyId, verifiedWallet);
      }
    }
    const sessionWallet = verifiedWalletBindingOrNull(user);

    return {
      userId: user.id,
      displayName: user.name,
      email: user.email,
      role: user.role,
      walletAddress: sessionWallet?.walletAddress ?? null,
      privyWalletId: sessionWallet?.privyWalletId ?? null,
      accessToken: null,
      authProvider: "privy" as const,
      privyId: payload.sub,
      created,
      expiresAt:
        typeof payload.exp === "number"
          ? new Date(payload.exp * 1000).toISOString()
          : null,
    };
  }

  async acceptStaffInvite(token: string, input: AcceptStaffInviteInput) {
    const prisma = this.prismaClient();
    if (!prisma) {
      throw new BadRequestException("Staff invites require Prisma storage");
    }
    const { payload } = this.privyTokens.verifyAccessToken(token);
    if (typeof payload.sub !== "string" || !payload.sub) {
      throw new UnauthorizedException("Privy access token is missing sub");
    }
    const privyId = payload.sub;
    const inviteToken = input.inviteToken?.trim();
    if (!inviteToken) {
      throw new BadRequestException("Staff invite token is required");
    }

    const verifiedWallet = await this.verifyPrivyWalletInput(privyId, input);
    const accepted = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const now = new Date();
        const invite = await tx.staffInvite.findUnique({
          where: {
            tokenHash: this.hashStaffInviteToken(inviteToken),
          },
        });
        if (!invite || invite.status !== "PENDING") {
          throw new UnauthorizedException("Staff invite is invalid");
        }
        if (invite.expiresAt <= now) {
          await tx.staffInvite.update({
            where: {
              id: invite.id,
            },
            data: {
              status: "EXPIRED",
            },
          });
          throw new UnauthorizedException("Staff invite has expired");
        }
        await this.lockStaffUser(tx, invite.staffUserId);
        const assignment = await tx.gateAssignment.findUnique({
          where: {
            id: invite.gateAssignmentId,
          },
        });
        if (!assignment?.active) {
          await tx.staffInvite.updateMany({
            where: {
              id: invite.id,
              status: "PENDING",
            },
            data: {
              status: "REVOKED",
            },
          });
          throw new UnauthorizedException("Staff invite is no longer active");
        }

        const alreadyLinked = await tx.user.findUnique({
          where: {
            privyId,
          },
        });
        if (alreadyLinked && alreadyLinked.id !== invite.staffUserId) {
          throw new BadRequestException(
            "Privy account is already linked to another FanPass user",
          );
        }

        const staff = await tx.user.findUnique({
          where: {
            id: invite.staffUserId,
          },
        });
        if (!staff || staff.role !== "GATE_STAFF") {
          throw new BadRequestException("Staff invite target is not valid");
        }
        if (staff.privyId && staff.privyId !== privyId) {
          throw new BadRequestException(
            "Staff invite is already linked to another Privy user",
          );
        }
        const walletBinding = verifiedWallet
          ? this.verifiedWalletBindingPersistence(
              this.toUserRecord(staff),
              privyId,
              verifiedWallet,
              now,
            )
          : null;

        const claimedInvite = await tx.staffInvite.updateMany({
          where: {
            id: invite.id,
            status: "PENDING",
            acceptedAt: null,
            acceptedPrivyId: null,
          },
          data: {
            status: "ACCEPTED",
            acceptedAt: now,
            acceptedPrivyId: privyId,
          },
        });
        if (claimedInvite.count !== 1) {
          throw new UnauthorizedException("Staff invite is invalid");
        }

        const user = await tx.user.update({
          where: {
            id: staff.id,
          },
          data: {
            privyId,
            ...(walletBinding ?? {}),
          },
        });
        return user;
      },
    );
    const acceptedWallet = verifiedWalletBindingOrNull(
      this.toUserRecord(accepted),
    );

    return {
      userId: accepted.id,
      displayName: accepted.name,
      email: accepted.email,
      role: accepted.role,
      walletAddress: acceptedWallet?.walletAddress ?? null,
      privyWalletId: acceptedWallet?.privyWalletId ?? null,
      accessToken: null,
      authProvider: "privy" as const,
      privyId,
      created: false,
      inviteAccepted: true,
      expiresAt:
        typeof payload.exp === "number"
          ? new Date(payload.exp * 1000).toISOString()
          : null,
    };
  }

  localSessionsEnabled() {
    return !this.productionLike();
  }

  private async verifyLocalAccessToken(token: string): Promise<FanPassSession> {
    if (!this.localSessionsEnabled()) {
      throw new UnauthorizedException("Local session tokens are disabled");
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException("Invalid access token");
    }
    const [encodedHeader, encodedPayload, signature] = parts;
    const expected = this.sign(`${encodedHeader}.${encodedPayload}`);
    if (!this.constantTimeEqual(signature, expected)) {
      throw new UnauthorizedException("Invalid access token");
    }

    const payload = this.decodePayload(encodedPayload);
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("Access token has expired");
    }

    const user = await this.findUserById(payload.userId);
    if (!user || user.role !== payload.role) {
      throw new UnauthorizedException("Session user is no longer valid");
    }

    return {
      userId: user.id,
      role: user.role,
    };
  }

  private async verifyPrivyAccessToken(token: string): Promise<FanPassSession> {
    try {
      const { payload } = this.privyTokens.verifyAccessToken(token);
      if (typeof payload.sub !== "string" || !payload.sub) {
        throw new UnauthorizedException("Privy access token is missing sub");
      }

      const user = await this.findUserByPrivyId(payload.sub);
      if (!user) {
        throw new UnauthorizedException("Privy user is not linked to FanPass");
      }

      return {
        userId: user.id,
        role: user.role,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid Privy access token");
    }
  }

  private signPayload(payload: TokenPayload) {
    const header = this.base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = this.base64url(JSON.stringify(payload));
    return `${header}.${body}.${this.sign(`${header}.${body}`)}`;
  }

  private decodePayload(encodedPayload: string): TokenPayload {
    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      ) as TokenPayload;
      if (!payload.userId || !payload.role || typeof payload.exp !== "number") {
        throw new Error("Missing token claims");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
  }

  private sign(value: string) {
    return createHmac("sha256", this.sessionSecret())
      .update(value)
      .digest("base64url");
  }

  private base64url(value: string) {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  private constantTimeEqual(actual: string, expected: string) {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  private async findUserById(userId: string): Promise<UserRecord | null> {
    const prisma = this.prismaClient();
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return user ? this.toUserRecord(user) : null;
    }
    return this.store.users.find((user) => user.id === userId) ?? null;
  }

  private async findUserByPrivyId(privyId: string): Promise<UserRecord | null> {
    const prisma = this.prismaClient();
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { privyId } });
      return user ? this.toUserRecord(user) : null;
    }
    return this.store.users.find((user) => user.privyId === privyId) ?? null;
  }

  private async createPrivyFanUser(
    privyId: string,
    input: SyncPrivyUserInput,
    verifiedWallet: VerifiedPrivyWallet | null,
  ): Promise<UserRecord> {
    const email = await this.safeEmailForNewPrivyUser(input.email, privyId);
    const walletBinding = verifiedWallet
      ? this.verifiedWalletBindingPersistence(
          {
            privyId,
            privyWalletId: null,
            walletAddress: null,
            walletBindingStatus: "UNVERIFIED",
            walletBindingVerifiedAt: null,
            walletBindingVersion: 0,
            walletBindingFingerprint: null,
          },
          privyId,
          verifiedWallet,
        )
      : null;
    const user: UserRecord = {
      id: `usr_${randomUUID()}`,
      name: this.normalizeName(input.name),
      email,
      role: "FAN",
      privyId,
      privyWalletId: walletBinding?.privyWalletId ?? null,
      walletAddress: walletBinding?.walletAddress ?? null,
      walletBindingStatus: walletBinding?.walletBindingStatus ?? "UNVERIFIED",
      walletBindingVerifiedAt:
        walletBinding?.walletBindingVerifiedAt.toISOString() ?? null,
      walletBindingVersion: walletBinding?.walletBindingVersion ?? 0,
      walletBindingFingerprint: walletBinding?.walletBindingFingerprint ?? null,
      riskScore: 0,
    };

    const prisma = this.prismaClient();
    if (prisma) {
      const created = await prisma.user.create({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          privyId: user.privyId,
          privyWalletId: user.privyWalletId,
          walletAddress: user.walletAddress,
          walletBindingStatus: user.walletBindingStatus,
          walletBindingVerifiedAt:
            walletBinding?.walletBindingVerifiedAt ?? null,
          walletBindingVersion: user.walletBindingVersion,
          walletBindingFingerprint: user.walletBindingFingerprint,
          riskScore: user.riskScore,
        },
      });
      return this.toUserRecord(created);
    }

    this.store.users.push(user);
    return user;
  }

  private async safeEmailForNewPrivyUser(
    candidateEmail: string | undefined,
    privyId: string,
  ) {
    const normalized = this.normalizeEmail(candidateEmail);
    if (!normalized) {
      return this.fallbackPrivyEmail(privyId);
    }
    const existing = await this.findUserByEmail(normalized);
    return existing ? this.fallbackPrivyEmail(privyId) : normalized;
  }

  private async findUserByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.toLowerCase();
    const prisma = this.prismaClient();
    if (prisma) {
      const user = await prisma.user.findUnique({
        where: {
          email: normalized,
        },
      });
      return user ? this.toUserRecord(user) : null;
    }
    return (
      this.store.users.find(
        (candidate) => candidate.email.toLowerCase() === normalized,
      ) ?? null
    );
  }

  private async updatePrivyProfile(
    user: UserRecord,
    privyId: string,
    verifiedWallet: VerifiedPrivyWallet | null,
  ): Promise<UserRecord> {
    if (!verifiedWallet) {
      return user;
    }
    const walletBinding = this.verifiedWalletBindingPersistence(
      user,
      privyId,
      verifiedWallet,
    );

    const prisma = this.prismaClient();
    if (prisma) {
      const result = await prisma.user.updateMany({
        where: {
          id: user.id,
          privyId: user.privyId ?? null,
          privyWalletId: user.privyWalletId ?? null,
          walletAddress: user.walletAddress ?? null,
          walletBindingStatus: user.walletBindingStatus ?? "UNVERIFIED",
          walletBindingVerifiedAt: user.walletBindingVerifiedAt
            ? new Date(user.walletBindingVerifiedAt)
            : null,
          walletBindingVersion: user.walletBindingVersion ?? 0,
          walletBindingFingerprint: user.walletBindingFingerprint ?? null,
        },
        data: walletBinding,
      });
      if (result.count !== 1) {
        const concurrentWinner = await prisma.user.findUnique({
          where: {
            id: user.id,
          },
        });
        if (
          concurrentWinner &&
          this.persistedWalletBindingMatches(
            this.toUserRecord(concurrentWinner),
            privyId,
            walletBinding,
          )
        ) {
          return this.toUserRecord(concurrentWinner);
        }
        throw this.walletBindingConflict();
      }
      const persisted = await prisma.user.findUnique({
        where: {
          id: user.id,
        },
      });
      if (
        persisted &&
        this.persistedWalletBindingMatches(
          this.toUserRecord(persisted),
          privyId,
          walletBinding,
        )
      ) {
        return this.toUserRecord(persisted);
      }
      throw this.walletBindingConflict();
    }

    user.walletAddress = walletBinding.walletAddress;
    user.privyWalletId = walletBinding.privyWalletId;
    user.walletBindingStatus = walletBinding.walletBindingStatus;
    user.walletBindingVerifiedAt =
      walletBinding.walletBindingVerifiedAt.toISOString();
    user.walletBindingVersion = walletBinding.walletBindingVersion;
    user.walletBindingFingerprint = walletBinding.walletBindingFingerprint;
    return user;
  }

  private async verifyPrivyWalletInput(
    privyId: string,
    input: { walletAddress?: string; walletId?: string },
  ): Promise<VerifiedPrivyWallet | null> {
    if (!input.walletAddress?.trim() && !input.walletId?.trim()) {
      return null;
    }
    if (!this.privyWallets) {
      throw new ServiceUnavailableException(
        "Privy wallet ownership verification is unavailable",
      );
    }
    return this.privyWallets.resolveUserEmbeddedEthereumWallet({
      privyUserId: privyId,
      walletId: input.walletId,
      walletAddress: input.walletAddress,
    });
  }

  private assertSubmittedWalletMatchesVerifiedBinding(
    binding: VerifiedWalletBinding,
    privyId: string,
    input: { walletAddress?: string; walletId?: string },
  ) {
    const submittedWalletAddress = this.normalizeWalletAddress(
      input.walletAddress,
    );
    const submittedWalletId = this.normalizePrivyWalletId(input.walletId);
    if (!submittedWalletAddress && !submittedWalletId) {
      return;
    }
    if (
      submittedWalletAddress === binding.walletAddress &&
      submittedWalletId === binding.privyWalletId &&
      privyId === binding.privyId
    ) {
      return;
    }
    throw this.walletRebindRequired();
  }

  private assertWalletBindingCanBeUpgraded(user: UserRecord) {
    const status = user.walletBindingStatus ?? "UNVERIFIED";
    if (status === "UNVERIFIED") {
      return;
    }
    if (status === "REVOKED") {
      throw this.walletRebindRequired();
    }
    throw new BadRequestException({
      statusCode: 400,
      code: "WALLET_BINDING_INVALID",
      message: "Existing wallet binding requires support review",
    });
  }

  private persistedWalletBindingMatches(
    user: UserRecord,
    privyId: string,
    expected: VerifiedWalletBindingPersistence,
  ) {
    const binding = verifiedWalletBindingOrNull(user);
    return (
      binding?.privyId === privyId &&
      binding.privyWalletId === expected.privyWalletId &&
      binding.walletAddress === expected.walletAddress &&
      binding.walletBindingFingerprint === expected.walletBindingFingerprint
    );
  }

  private walletRebindRequired() {
    return new BadRequestException({
      statusCode: 400,
      code: "REBIND_REQUIRED",
      message:
        "Wallet binding changes require a dedicated re-verification flow",
    });
  }

  private walletBindingConflict() {
    return new ConflictException({
      statusCode: 409,
      code: "WALLET_BINDING_CONFLICT",
      message: "Wallet binding changed during verification",
    });
  }

  private async lockStaffUser(
    tx: Prisma.TransactionClient,
    staffUserId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "users"
      WHERE "id" = ${staffUserId}
      FOR UPDATE
    `;
    if (rows.length !== 1) {
      throw new BadRequestException("Staff invite target is not valid");
    }
  }

  private verifiedWalletBindingPersistence(
    user: Pick<
      UserRecord,
      | "privyId"
      | "privyWalletId"
      | "walletAddress"
      | "walletBindingStatus"
      | "walletBindingVerifiedAt"
      | "walletBindingVersion"
      | "walletBindingFingerprint"
    >,
    privyId: string,
    wallet: VerifiedPrivyWallet,
    verifiedAt = new Date(),
  ): VerifiedWalletBindingPersistence {
    const walletAddress = this.normalizeWalletAddress(wallet.walletAddress);
    const privyWalletId = this.normalizePrivyWalletId(wallet.walletId);
    if (!walletAddress || !privyWalletId) {
      throw new BadRequestException("Privy wallet binding is incomplete");
    }
    const fingerprint = walletBindingFingerprint({
      privyId,
      walletId: privyWalletId,
      walletAddress,
    });
    const status = user.walletBindingStatus ?? "UNVERIFIED";
    const currentBinding = verifiedWalletBindingOrNull(user);
    if (status === "VERIFIED") {
      if (!currentBinding) {
        throw new BadRequestException(
          "Existing wallet binding requires support review",
        );
      }
      if (
        currentBinding.privyId !== privyId ||
        currentBinding.privyWalletId !== privyWalletId ||
        currentBinding.walletAddress !== walletAddress ||
        currentBinding.walletBindingFingerprint !== fingerprint
      ) {
        throw new BadRequestException(
          "Wallet binding changes require a dedicated re-verification flow",
        );
      }
      return {
        privyWalletId,
        walletAddress,
        walletBindingStatus: "VERIFIED",
        walletBindingVerifiedAt: verifiedAt,
        walletBindingVersion: currentBinding.walletBindingVersion,
        walletBindingFingerprint: fingerprint,
      };
    }
    if (status === "REVOKED") {
      throw new BadRequestException(
        "Revoked wallet bindings require a dedicated re-verification flow",
      );
    }
    return {
      privyWalletId,
      walletAddress,
      walletBindingStatus: "VERIFIED",
      walletBindingVerifiedAt: verifiedAt,
      walletBindingVersion: Math.max(user.walletBindingVersion ?? 0, 0) + 1,
      walletBindingFingerprint: fingerprint,
    };
  }

  private sessionSecret() {
    const configured = this.config.get<string>("SESSION_SIGNING_SECRET");
    if (configured) {
      return configured;
    }
    if (this.productionLike()) {
      throw new Error(
        "SESSION_SIGNING_SECRET is required before issuing local sessions",
      );
    }
    return "fanpass-local-session-secret";
  }

  private tokenTtlSeconds() {
    return readIntegerConfig(this.config, "SESSION_TTL_SECONDS", 60 * 60 * 8);
  }

  private demoAuthEnabled() {
    if (this.config.get<string>("FANPASS_ENABLE_DEMO_AUTH") === "true") {
      return true;
    }
    if (this.config.get<string>("FANPASS_ENABLE_DEMO_AUTH") === "false") {
      return false;
    }
    return !this.productionLike();
  }

  private assertLocalSessionsEnabled() {
    if (!this.localSessionsEnabled()) {
      throw new BadRequestException("Local sessions are disabled; use Privy");
    }
  }

  private privyAuthRequired() {
    return this.productionLike();
  }

  private privyConfigured() {
    return this.privyTokens.configured();
  }

  private productionLike() {
    return isProductionLikeEnvironment({
      NODE_ENV: this.config.get<string>("NODE_ENV") ?? process.env.NODE_ENV,
      FANPASS_ENV:
        this.config.get<string>("FANPASS_ENV") ?? process.env.FANPASS_ENV,
    });
  }

  private toUserRecord(user: {
    id: string;
    name: string;
    email: string;
    role: UserRecord["role"];
    privyId: string | null;
    privyWalletId?: string | null;
    walletAddress: string | null;
    walletBindingStatus?: UserRecord["walletBindingStatus"];
    walletBindingVerifiedAt?: Date | null;
    walletBindingVersion?: number;
    walletBindingFingerprint?: string | null;
    riskScore: number;
  }): UserRecord {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      privyId: user.privyId,
      privyWalletId: user.privyWalletId ?? null,
      walletAddress: user.walletAddress,
      walletBindingStatus: user.walletBindingStatus ?? "UNVERIFIED",
      walletBindingVerifiedAt:
        user.walletBindingVerifiedAt?.toISOString() ?? null,
      walletBindingVersion: user.walletBindingVersion ?? 0,
      walletBindingFingerprint: user.walletBindingFingerprint ?? null,
      riskScore: user.riskScore,
    };
  }

  private prismaClient() {
    return process.env.FANPASS_DATA_SOURCE === "prisma"
      ? this.prisma
      : undefined;
  }

  private normalizeEmail(email: string | undefined) {
    const normalized = email?.trim().toLowerCase();
    return normalized && normalized.includes("@") ? normalized : null;
  }

  private normalizeName(name: string | undefined) {
    const normalized = name?.trim();
    return normalized || "FanPass User";
  }

  private normalizeWalletAddress(walletAddress: string | undefined) {
    const normalized = walletAddress?.trim().toLowerCase();
    return normalized || null;
  }

  private normalizePrivyWalletId(walletId: string | undefined) {
    const normalized = walletId?.trim();
    return normalized || null;
  }

  private fallbackPrivyEmail(privyId: string) {
    const safeId = Buffer.from(privyId).toString("base64url").slice(0, 32);
    return `privy_${safeId}@privy.fanpass.local`;
  }

  private hashStaffInviteToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
