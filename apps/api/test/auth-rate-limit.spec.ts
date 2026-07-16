import type { Request } from "express";
import {
  privyCredentialRateLimitKey,
  usesDedicatedAuthRateLimit,
} from "../src/common/auth-rate-limit";

describe("auth rate-limit policy", () => {
  it.each([
    "/auth/privy/sync",
    "/auth/privy/sync?source=console",
    "/auth/privy/accept-staff-invite",
  ])("keeps %s out of the shared auth bucket", (originalUrl) => {
    expect(usesDedicatedAuthRateLimit({ originalUrl } as Request)).toBe(true);
  });

  it("keeps unrelated authentication routes in the shared auth bucket", () => {
    expect(
      usesDedicatedAuthRateLimit({ originalUrl: "/auth/login" } as Request),
    ).toBe(false);
  });

  it("uses a stable, non-plaintext credential fingerprint", () => {
    const request = {
      headers: { authorization: "Bearer secret-access-token" },
      ip: "203.0.113.10",
    } as Request;
    const key = privyCredentialRateLimitKey(request);

    expect(key).toMatch(/^credential:[A-Za-z0-9_-]{43}$/);
    expect(key).not.toContain("secret-access-token");
    expect(privyCredentialRateLimitKey(request)).toBe(key);
  });

  it("falls back to an IPv6-safe network key without a bearer token", () => {
    const key = privyCredentialRateLimitKey({
      headers: {},
      ip: "2001:db8:abcd:1234::1",
    } as Request);

    expect(key).toBe("ip:2001:db8:abcd:1200::/56");
  });
});
