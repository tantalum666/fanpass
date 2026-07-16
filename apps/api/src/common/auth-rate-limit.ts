import { createHash } from "crypto";
import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

const DEDICATED_AUTH_RATE_LIMIT_PATHS = new Set([
  "/auth/privy/sync",
  "/auth/privy/accept-staff-invite",
]);

export function usesDedicatedAuthRateLimit(
  request: Pick<Request, "originalUrl">,
) {
  const pathname = request.originalUrl.split("?", 1)[0];
  return DEDICATED_AUTH_RATE_LIMIT_PATHS.has(pathname);
}

export function privyCredentialRateLimitKey(
  request: Pick<Request, "headers" | "ip">,
) {
  const authorization = request.headers.authorization;
  const token = readBearerToken(authorization);
  if (token) {
    return `credential:${createHash("sha256").update(token).digest("base64url")}`;
  }
  return request.ip ? `ip:${ipKeyGenerator(request.ip)}` : "ip:unknown";
}

function readBearerToken(authorization: string | undefined) {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}
