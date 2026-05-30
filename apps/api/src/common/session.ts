import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "./domain";

export interface FanPassSession {
  userId: string;
  role: UserRole;
}

export const fanPassRoles: UserRole[] = ["FAN", "ORGANIZER", "GATE_STAFF", "ADMIN"];

export function assertRole(session: FanPassSession, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(session.role)) {
    throw new ForbiddenException(`Role ${session.role} cannot perform this action`);
  }
}
