import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import { Request } from "express";
import { UserRole } from "./domain";
import { FanPassSession } from "./session";

export const FANPASS_ROLES_KEY = "fanpass:roles";
export const FANPASS_PUBLIC_ROUTE_KEY = "fanpass:public-route";

export const Roles = (...roles: UserRole[]) =>
  SetMetadata(FANPASS_ROLES_KEY, roles);
export const PublicRoute = () => SetMetadata(FANPASS_PUBLIC_ROUTE_KEY, true);

export interface AuthenticatedRequest extends Request {
  fanPassSession?: FanPassSession;
}

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.fanPassSession;
  },
);
