import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "../modules/auth/auth.service";
import { FANPASS_ROLES_KEY, AuthenticatedRequest } from "./auth.decorators";
import { UserRole } from "./domain";

@Injectable()
export class FanPassAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { headers: Record<string, string | string[] | undefined> }>();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException("Authentication is required");
    }

    const session = await this.auth.verifyAccessToken(token);
    request.fanPassSession = session;

    const allowedRoles =
      this.reflector.getAllAndOverride<UserRole[]>(FANPASS_ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      throw new ForbiddenException(`Role ${session.role} cannot perform this action`);
    }

    return true;
  }

  private extractBearerToken(header: string | string[] | undefined) {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value?.startsWith("Bearer ")) {
      return null;
    }
    return value.slice("Bearer ".length).trim();
  }
}
