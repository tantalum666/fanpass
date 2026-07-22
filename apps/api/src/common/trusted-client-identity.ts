import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";
import { IncomingMessage } from "http";
import { isIP } from "net";
import {
  isProductionLikeEnvironment,
  readIntegerConfig,
} from "../config/security-config";

type ProxyTrust = (address: string, index: number) => boolean;
type ProxyAddress = {
  (request: IncomingMessage, trust: ProxyTrust): string;
  all(request: IncomingMessage): string[];
};

// `proxy-addr` is Express' own proxy-chain implementation. Keep the small local
// type surface so the runtime dependency does not require an additional types
// package solely for these two functions.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const proxyAddress = require("proxy-addr") as ProxyAddress;

const LOCAL_ADMISSION_SECRET =
  "fanpass-local-orderbook-admission-secret-not-for-deployment";

export class TrustedClientIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrustedClientIdentityError";
  }
}

@Injectable()
export class TrustedClientIdentity {
  private readonly productionLike: boolean;
  private readonly trustedProxyHops: number;
  private readonly ipv6PrefixBits: number;
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.productionLike = isProductionLikeEnvironment({
      NODE_ENV: config.get("NODE_ENV"),
      FANPASS_ENV: config.get("FANPASS_ENV"),
    });
    this.trustedProxyHops = this.productionLike
      ? readIntegerConfig(config, "FANPASS_TRUST_PROXY_HOPS", 1)
      : 0;
    this.ipv6PrefixBits = readIntegerConfig(
      config,
      "FANPASS_ORDERBOOK_IPV6_PREFIX_BITS",
      64,
    );
    const configuredSecret = String(
      config.get("FANPASS_ORDERBOOK_ADMISSION_SECRET") ?? "",
    ).trim();
    if (this.productionLike && configuredSecret.length < 32) {
      throw new TrustedClientIdentityError(
        "FANPASS_ORDERBOOK_ADMISSION_SECRET is required in production-like environments",
      );
    }
    this.secret = configuredSecret || LOCAL_ADMISSION_SECRET;
  }

  actorKey(request: IncomingMessage) {
    const address = this.clientAddress(request);
    const digest = createHmac("sha256", this.secret)
      .update(`fanpass-orderbook-anonymous:v1:${address}`)
      .digest("hex");
    return `anonymous:${digest}`;
  }

  private clientAddress(request: IncomingMessage) {
    try {
      if (this.trustedProxyHops === 0) {
        return this.normalizeAddress(request.socket.remoteAddress);
      }

      const forwardedFor = request.headers["x-forwarded-for"];
      if (
        typeof forwardedFor !== "string" ||
        forwardedFor.trim().length === 0
      ) {
        throw new TrustedClientIdentityError(
          "Trusted proxy request is missing X-Forwarded-For",
        );
      }

      const chain = proxyAddress.all(request);
      if (chain.length <= this.trustedProxyHops) {
        throw new TrustedClientIdentityError(
          "Trusted proxy chain does not contain a client address",
        );
      }
      const address = proxyAddress(
        request,
        (_address, index) => index < this.trustedProxyHops,
      );
      return this.normalizeAddress(address);
    } catch (error) {
      if (error instanceof TrustedClientIdentityError) {
        throw error;
      }
      throw new TrustedClientIdentityError(
        "Trusted client address could not be resolved",
      );
    }
  }

  private normalizeAddress(value: string | undefined) {
    if (!value) {
      throw new TrustedClientIdentityError(
        "Client connection has no remote address",
      );
    }
    const mapped = value.toLowerCase().startsWith("::ffff:")
      ? value.slice(7)
      : value;
    const version = isIP(mapped);
    if (version === 0) {
      throw new TrustedClientIdentityError("Client address is invalid");
    }
    if (version === 6) {
      const hostname = new URL(`http://[${mapped}]/`).hostname;
      return this.ipv6NetworkPrefix(hostname.slice(1, -1).toLowerCase());
    }
    return mapped.toLowerCase();
  }

  private ipv6NetworkPrefix(canonicalAddress: string) {
    const [head = "", tail = ""] = canonicalAddress.split("::");
    const headWords = head ? head.split(":") : [];
    const tailWords = tail ? tail.split(":") : [];
    const omittedWords = 8 - headWords.length - tailWords.length;
    const words = canonicalAddress.includes("::")
      ? [...headWords, ...Array(omittedWords).fill("0"), ...tailWords]
      : headWords;
    if (words.length !== 8) {
      throw new TrustedClientIdentityError("Client IPv6 address is invalid");
    }
    const bytes = words.flatMap((word) => {
      const value = Number.parseInt(word, 16);
      return [value >>> 8, value & 0xff];
    });
    const prefixBytes = Math.ceil(this.ipv6PrefixBits / 8);
    const retained = bytes.slice(0, prefixBytes);
    const remainingBits = this.ipv6PrefixBits % 8;
    if (remainingBits > 0) {
      retained[retained.length - 1] &= 0xff << (8 - remainingBits);
    }
    return `ipv6:${retained
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")}/${this.ipv6PrefixBits}`;
  }
}
