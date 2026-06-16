import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  NotFoundException,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { randomUUID } from "crypto";
import { DemoStore } from "../../common/demo-store";
import { PublicRoute } from "../../common/auth.decorators";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "./auth.service";

class RegisterRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;
}

class LoginRequest {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

class DemoSessionRequest {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  userId!: string;
}

class PrivySyncRequest {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  walletAddress?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  walletId?: string;
}

class AcceptStaffInviteRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  inviteToken!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  walletAddress?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  walletId?: string;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly store: DemoStore,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  @Post("register")
  @PublicRoute()
  register(@Body() body: RegisterRequest) {
    this.ensureLocalAuthEnabled();

    const email = this.normalizeEmail(body.email);
    const name = body.name?.trim();

    if (!name || !email) {
      throw new BadRequestException("Name and email are required");
    }

    const existing = this.store.users.find(
      (user) => user.email.toLowerCase() === email,
    );
    if (existing) {
      throw new ConflictException("Email is already registered");
    }

    const user = {
      id: `usr_${randomUUID()}`,
      name,
      email,
      role: "FAN" as const,
      privyId: null,
      walletAddress: null,
      riskScore: 0,
    };

    this.store.users.push(user);
    this.audit.record(user.id, "USER_REGISTERED", "user", user.id, { email });

    return this.auth.issueSession(user);
  }

  @Post("login")
  @PublicRoute()
  login(@Body() body: LoginRequest) {
    this.ensureLocalAuthEnabled();

    const email = this.normalizeEmail(body.email);
    const user = this.store.users.find(
      (candidate) => candidate.email.toLowerCase() === email,
    );

    if (!user) {
      throw new NotFoundException("User not found");
    }

    this.audit.record(user.id, "USER_LOGGED_IN", "user", user.id);
    return this.auth.issueSession(user);
  }

  @Post("demo-session")
  @PublicRoute()
  demoSession(@Body() body: DemoSessionRequest) {
    return this.auth.issueDemoSession(body.userId);
  }

  @Post("privy/sync")
  @PublicRoute()
  async syncPrivyUser(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: PrivySyncRequest,
  ) {
    const token = this.extractBearerToken(authorization);
    if (!token) {
      throw new UnauthorizedException("Privy access token is required");
    }
    const session = await this.auth.syncPrivyUser(token, body);
    await this.audit.record(
      session.userId,
      session.created ? "PRIVY_USER_CREATED" : "PRIVY_USER_SYNCED",
      "user",
      session.userId,
      {
        authProvider: "privy",
      },
    );
    return session;
  }

  @Post("privy/accept-staff-invite")
  @PublicRoute()
  async acceptStaffInvite(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: AcceptStaffInviteRequest,
  ) {
    const token = this.extractBearerToken(authorization);
    if (!token) {
      throw new UnauthorizedException("Privy access token is required");
    }
    const session = await this.auth.acceptStaffInvite(token, body);
    await this.audit.record(
      session.userId,
      "STAFF_INVITE_ACCEPTED",
      "user",
      session.userId,
      {
        authProvider: "privy",
      },
    );
    return session;
  }

  private normalizeEmail(email: string | undefined) {
    return email?.trim().toLowerCase() ?? "";
  }

  private ensureLocalAuthEnabled() {
    if (!this.auth.localSessionsEnabled()) {
      throw new BadRequestException("Local email auth is disabled; use Privy");
    }
  }

  private extractBearerToken(header: string | undefined) {
    if (!header?.startsWith("Bearer ")) {
      return null;
    }
    return header.slice("Bearer ".length).trim();
  }
}
