import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { VerificationController } from "../src/modules/verification/verification.controller";

describe("VerificationController", () => {
  const payload = {
    v: 1,
    credentialId: "cred_test",
    ticketId: "tkt_demo_001",
    eventId: "evt_weekend_demo",
    ticketTypeId: "tt_cat2_demo",
    ownerIdHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    nonce: "nonce_test",
    issuedAt: "2026-07-07T09:00:00.000Z",
    expiresAt: "2026-07-07T09:00:30.000Z",
    entryMode: "qr" as const,
    kid: "local-dev-key-v1",
    signature: "a".repeat(64),
    gate: "A1",
  };

  it("rejects turnstile redemption when the key is not configured", () => {
    const controller = new VerificationController(
      { redeem: jest.fn() } as never,
      new ConfigService(),
    );

    expect(() => controller.redeemTurnstile(payload, "key")).toThrow(
      ServiceUnavailableException,
    );
  });

  it("rejects turnstile redemption with the wrong key", () => {
    const controller = new VerificationController(
      { redeem: jest.fn() } as never,
      new ConfigService({ FANPASS_TURNSTILE_REDEEM_KEY: "correct-key" }),
    );

    expect(() => controller.redeemTurnstile(payload, "wrong-key")).toThrow(
      UnauthorizedException,
    );
  });

  it("redeems turnstile scans as gate staff with a valid key", () => {
    const redeem = jest.fn().mockReturnValue({ result: "ACCEPTED" });
    const controller = new VerificationController(
      { redeem } as never,
      new ConfigService({
        FANPASS_TURNSTILE_REDEEM_KEY: "correct-key",
        FANPASS_TURNSTILE_STAFF_USER_ID: "usr_gate_demo",
      }),
    );

    expect(controller.redeemTurnstile(payload, "correct-key")).toEqual({
      result: "ACCEPTED",
    });
    expect(redeem).toHaveBeenCalledWith(payload, "usr_gate_demo", "A1", {
      userId: "usr_gate_demo",
      role: "GATE_STAFF",
    });
  });
});
