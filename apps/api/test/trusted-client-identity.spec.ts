import { ConfigService } from "@nestjs/config";
import { IncomingMessage } from "http";
import { Socket } from "net";
import {
  TrustedClientIdentity,
  TrustedClientIdentityError,
} from "../src/common/trusted-client-identity";

function request(input: {
  remoteAddress: string;
  forwardedFor?: string;
  origin?: string;
}) {
  return {
    headers: {
      ...(input.forwardedFor ? { "x-forwarded-for": input.forwardedFor } : {}),
      ...(input.origin ? { origin: input.origin } : {}),
    },
    socket: {
      remoteAddress: input.remoteAddress,
    } as Socket,
  } as IncomingMessage;
}

describe("TrustedClientIdentity", () => {
  const secret = "orderbook-admission-secret-with-32-characters";

  it("uses the first untrusted address behind the configured Render proxy", () => {
    const identity = new TrustedClientIdentity(
      new ConfigService({
        NODE_ENV: "production",
        FANPASS_ENV: "staging",
        FANPASS_TRUST_PROXY_HOPS: "1",
        FANPASS_ORDERBOOK_ADMISSION_SECRET: secret,
      }),
    );

    const first = identity.actorKey(
      request({
        remoteAddress: "10.0.0.8",
        forwardedFor: "198.51.100.9, 203.0.113.44",
      }),
    );
    const second = identity.actorKey(
      request({
        remoteAddress: "10.0.0.9",
        forwardedFor: "192.0.2.77, 203.0.113.44",
      }),
    );
    const other = identity.actorKey(
      request({
        remoteAddress: "10.0.0.9",
        forwardedFor: "192.0.2.77, 203.0.113.45",
      }),
    );

    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^anonymous:[a-f0-9]{64}$/);
    expect(first).not.toContain("203.0.113.44");
  });

  it("normalizes IPv4-mapped addresses and does not require browser Origin", () => {
    const identity = new TrustedClientIdentity(
      new ConfigService({
        FANPASS_ENV: "local",
        FANPASS_ORDERBOOK_ADMISSION_SECRET: secret,
      }),
    );

    expect(
      identity.actorKey(request({ remoteAddress: "::ffff:203.0.113.44" })),
    ).toBe(identity.actorKey(request({ remoteAddress: "203.0.113.44" })));
    expect(
      identity.actorKey(
        request({
          remoteAddress: "2001:0db8:0000:0000:0000:0000:0000:0001",
        }),
      ),
    ).toBe(identity.actorKey(request({ remoteAddress: "2001:db8::1" })));
    expect(
      identity.actorKey(request({ remoteAddress: "2001:db8:abcd:10::1" })),
    ).toBe(
      identity.actorKey(
        request({ remoteAddress: "2001:db8:abcd:10:ffff::99" }),
      ),
    );
    expect(
      identity.actorKey(request({ remoteAddress: "2001:db8:abcd:10::1" })),
    ).not.toBe(
      identity.actorKey(request({ remoteAddress: "2001:db8:abcd:11::1" })),
    );
  });

  it("fails closed when a production proxy chain is missing or malformed", () => {
    const identity = new TrustedClientIdentity(
      new ConfigService({
        NODE_ENV: "production",
        FANPASS_TRUST_PROXY_HOPS: "1",
        FANPASS_ORDERBOOK_ADMISSION_SECRET: secret,
      }),
    );

    expect(() =>
      identity.actorKey(request({ remoteAddress: "10.0.0.8" })),
    ).toThrow(TrustedClientIdentityError);
    expect(() =>
      identity.actorKey(
        request({
          remoteAddress: "10.0.0.8",
          forwardedFor: "not-an-ip",
        }),
      ),
    ).toThrow(TrustedClientIdentityError);
  });
});
