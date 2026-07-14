import type { ServerResponse } from "node:http";
import type { ConsoleAuthRuntimeConfig } from "./config.js";

export function applySecurityHeaders(
  response: ServerResponse,
  config: ConsoleAuthRuntimeConfig | null,
) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  response.setHeader("Content-Security-Policy", contentSecurityPolicy(config));

  if (config?.productionLike) {
    response.setHeader(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains",
    );
  }
}

export function contentSecurityPolicy(config: ConsoleAuthRuntimeConfig | null) {
  const consoleOrigin = config?.consoleUrl ?? null;
  const consoleConnectionSource = consoleOrigin ? ` ${consoleOrigin}` : "";
  const consoleFormAction = consoleOrigin ? ` ${consoleOrigin}` : "";
  return [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com",
    "style-src 'self' 'unsafe-inline' https://hcaptcha.com https://*.hcaptcha.com",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "child-src https://auth.privy.io",
    "frame-src https://auth.privy.io https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com",
    `connect-src 'self'${consoleConnectionSource} https://auth.privy.io https://*.rpc.privy.systems https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action 'self'${consoleFormAction}`,
    "object-src 'none'",
  ].join("; ");
}
