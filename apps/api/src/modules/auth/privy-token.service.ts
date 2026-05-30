import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verify as verifySignature } from "crypto";

type JwtAlgorithm = "HS256" | "ES256" | string;

interface PrivyJwtHeader {
  alg?: JwtAlgorithm;
  typ?: string;
}

export interface VerifiedPrivyJwtPayload {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  nbf?: unknown;
}

@Injectable()
export class PrivyTokenService {
  constructor(private readonly config: ConfigService) {}

  configured() {
    return (
      Boolean(this.config.get<string>("PRIVY_APP_ID")) &&
      Boolean(this.config.get<string>("PRIVY_VERIFICATION_KEY"))
    );
  }

  readJwtAlgorithm(token: string): JwtAlgorithm {
    const [encodedHeader] = token.split(".");
    if (!encodedHeader) {
      return "";
    }
    try {
      const header = this.decodeJwtJson<{ alg?: JwtAlgorithm }>(
        encodedHeader,
        "Invalid access token",
      );
      return header.alg ?? "";
    } catch {
      return "";
    }
  }

  verifyAccessToken(token: string) {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException("Invalid Privy access token");
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = this.decodeJwtJson<PrivyJwtHeader>(
      encodedHeader,
      "Invalid Privy access token",
    );
    const payload = this.decodeJwtJson<VerifiedPrivyJwtPayload>(
      encodedPayload,
      "Invalid Privy access token",
    );
    const signedValue = `${encodedHeader}.${encodedPayload}`;
    const signature = Buffer.from(encodedSignature, "base64url");

    if (header.alg !== "ES256") {
      throw new UnauthorizedException("Invalid Privy access token algorithm");
    }
    if (signature.length !== 64) {
      throw new UnauthorizedException("Invalid Privy access token signature");
    }
    if (
      !verifySignature(
        "sha256",
        Buffer.from(signedValue),
        {
          key: this.privyVerificationKey(),
          dsaEncoding: "ieee-p1363",
        },
        signature,
      )
    ) {
      throw new UnauthorizedException("Invalid Privy access token signature");
    }
    this.assertPrivyClaims(payload);
    return { header, payload };
  }

  private assertPrivyClaims(payload: VerifiedPrivyJwtPayload) {
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== "privy.io") {
      throw new UnauthorizedException("Invalid Privy access token issuer");
    }
    if (!this.audienceMatches(payload.aud, this.privyAppId())) {
      throw new UnauthorizedException("Invalid Privy access token audience");
    }
    if (typeof payload.exp !== "number" || payload.exp <= now) {
      throw new UnauthorizedException("Privy access token has expired");
    }
    if (typeof payload.nbf === "number" && payload.nbf > now) {
      throw new UnauthorizedException("Privy access token is not active yet");
    }
  }

  private decodeJwtJson<T>(encodedValue: string, message: string): T {
    try {
      return JSON.parse(
        Buffer.from(encodedValue, "base64url").toString("utf8"),
      ) as T;
    } catch {
      throw new UnauthorizedException(message);
    }
  }

  private audienceMatches(audience: unknown, expected: string) {
    if (typeof audience === "string") {
      return audience === expected;
    }
    if (Array.isArray(audience)) {
      return audience.includes(expected);
    }
    return false;
  }

  private privyAppId() {
    const appId = this.config.get<string>("PRIVY_APP_ID")?.trim();
    if (!appId) {
      throw new UnauthorizedException("Privy app id is not configured");
    }
    return appId;
  }

  private privyVerificationKey() {
    const key = this.config
      .get<string>("PRIVY_VERIFICATION_KEY")
      ?.replace(/\\n/g, "\n")
      .trim();
    if (!key) {
      throw new UnauthorizedException(
        "Privy verification key is not configured",
      );
    }
    return key;
  }
}
