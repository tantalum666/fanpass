import { createHmac } from "crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DemoStore } from "../src/common/demo-store";
import { AuditService } from "../src/modules/audit/audit.service";
import { OwnershipService } from "../src/modules/ownership/ownership.service";
import { TicketOwnershipSideEffectsService } from "../src/modules/side-effects/ticket-ownership-side-effects.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";
import {
  SignedQrPayload,
  VerificationService,
} from "../src/modules/verification/verification.service";

describe("VerificationService", () => {
  let store: DemoStore;
  let verification: VerificationService;

  beforeEach(() => {
    store = new DemoStore();
    const audit = new AuditService(store);
    const ticketOwnership = new TicketOwnershipSideEffectsService(
      new OwnershipService(new ConfigService()),
    );
    verification = new VerificationService(
      new ConfigService({ QR_SIGNING_SECRET: "test-secret" }),
      store,
      audit,
      new TicketsService(store, audit, ticketOwnership),
      ticketOwnership,
    );
  });

  it("accepts a valid payload once and records duplicate rejection", async () => {
    const payload = await verification.createPayload("tkt_demo_001");
    expect(payload).toMatchObject({
      v: 1,
      credentialId: expect.stringMatching(/^cred_/),
      ticketTypeId: "tt_cat2_demo",
      entryMode: "qr",
      kid: "local-dev-key-v1",
    });
    expect(
      new Date(payload.expiresAt).getTime() -
        new Date(payload.issuedAt).getTime(),
    ).toBe(30_000);
    expect(payload.signature).toMatch(/^[A-Za-z0-9_-]{32,96}$/);

    const accepted = await verification.redeem(payload, "usr_gate_demo", "A1", {
      userId: "usr_gate_demo",
      role: "GATE_STAFF",
    });
    expect(accepted).toMatchObject({
      ticketId: "tkt_demo_001",
      eventId: "evt_weekend_demo",
      result: "ACCEPTED",
    });
    expect(store.getTicket("tkt_demo_001").status).toBe("REDEEMED");

    await expect(
      verification.redeem(payload, "usr_gate_demo", "A1", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(resultCounts()).toEqual({ ACCEPTED: 1, DUPLICATE: 1 });

    await expect(
      verification.checkinSummary("evt_weekend_demo", "A1"),
    ).resolves.toMatchObject({
      eventId: "evt_weekend_demo",
      gate: "A1",
      total: 2,
      accepted: 1,
      rejected: 1,
      results: {
        ACCEPTED: 1,
        DUPLICATE: 1,
      },
    });
  });

  it("accepts only one concurrent redemption attempt for the same QR payload", async () => {
    let releaseOwnership: (() => void) | undefined;
    const ownershipReleased = new Promise<void>((resolve) => {
      releaseOwnership = resolve;
    });
    const slowOwnership = {
      redeemTicket: jest.fn(async () => {
        await ownershipReleased;
        return {
          adapter: "mock",
          status: "CONFIRMED",
          tokenId: "1",
          ownershipRef: "mock:redeem:tkt_demo_001",
          transactionHash: "mock_redeem_tx",
        };
      }),
      issueTicket: jest.fn(),
      adapterName: jest.fn(() => "mock"),
    };
    const audit = new AuditService(store);
    const ticketOwnership = new TicketOwnershipSideEffectsService(
      slowOwnership as never,
    );
    verification = new VerificationService(
      new ConfigService({ QR_SIGNING_SECRET: "test-secret" }),
      store,
      audit,
      new TicketsService(store, audit, ticketOwnership),
      ticketOwnership,
    );
    const payload = await verification.createPayload("tkt_demo_001");

    const first = verification.redeem(payload, "usr_gate_demo", "A1", {
      userId: "usr_gate_demo",
      role: "GATE_STAFF",
    });
    const second = verification.redeem(payload, "usr_gate_demo", "A1", {
      userId: "usr_gate_demo",
      role: "GATE_STAFF",
    });

    await expect(second).rejects.toMatchObject({
      response: expect.objectContaining({
        result: "DUPLICATE",
      }),
    });

    releaseOwnership?.();
    await expect(first).resolves.toMatchObject({
      ticketId: "tkt_demo_001",
      eventId: "evt_weekend_demo",
      result: "ACCEPTED",
    });
    expect(resultCounts()).toEqual({ ACCEPTED: 1, DUPLICATE: 1 });
  });

  it("accepts only one concurrent redemption attempt for the same ticket even with different signed nonces", async () => {
    let releaseOwnership: (() => void) | undefined;
    const ownershipReleased = new Promise<void>((resolve) => {
      releaseOwnership = resolve;
    });
    const slowOwnership = {
      redeemTicket: jest.fn(async () => {
        await ownershipReleased;
        return {
          adapter: "mock",
          status: "CONFIRMED",
          tokenId: "1",
          ownershipRef: "mock:redeem:tkt_demo_001",
          transactionHash: "mock_redeem_tx",
        };
      }),
      issueTicket: jest.fn(),
      adapterName: jest.fn(() => "mock"),
    };
    const audit = new AuditService(store);
    const ticketOwnership = new TicketOwnershipSideEffectsService(
      slowOwnership as never,
    );
    verification = new VerificationService(
      new ConfigService({ QR_SIGNING_SECRET: "test-secret" }),
      store,
      audit,
      new TicketsService(store, audit, ticketOwnership),
      ticketOwnership,
    );
    const basePayload = await verification.createPayload("tkt_demo_001");
    const firstPayload = buildLegacySignedPayload(basePayload, "nonce_legacy_a");
    const secondPayload = buildLegacySignedPayload(
      basePayload,
      "nonce_legacy_b",
    );

    const first = verification.redeem(firstPayload, "usr_gate_demo", "A1", {
      userId: "usr_gate_demo",
      role: "GATE_STAFF",
    });
    const second = verification.redeem(secondPayload, "usr_gate_demo", "A1", {
      userId: "usr_gate_demo",
      role: "GATE_STAFF",
    });

    await expect(second).rejects.toMatchObject({
      response: expect.objectContaining({
        result: "DUPLICATE",
      }),
    });

    releaseOwnership?.();
    await expect(first).resolves.toMatchObject({
      ticketId: "tkt_demo_001",
      eventId: "evt_weekend_demo",
      result: "ACCEPTED",
    });
    expect(resultCounts()).toEqual({ ACCEPTED: 1, DUPLICATE: 1 });
  });

  it("redeems an NFC NDEF URI payload through the signed entry path", async () => {
    const payload = await verification.createPayload("tkt_demo_001");
    const ndefPayload = `fanpass://entry?payload=${encodeURIComponent(
      JSON.stringify(payload),
    )}`;

    const accepted = await verification.validateNfcPayload(
      ndefPayload,
      "evt_weekend_demo",
      "usr_gate_demo",
      "A1",
      {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      },
    );

    expect(accepted).toMatchObject({
      ticketId: "tkt_demo_001",
      eventId: "evt_weekend_demo",
      result: "ACCEPTED",
    });
  });

  it("revokes the previous dynamic QR credential when a new code is issued", async () => {
    const firstPayload = await verification.createPayload("tkt_demo_001");
    const refreshedPayload = await verification.createPayload("tkt_demo_001");

    await expect(
      verification.redeem(firstPayload, "usr_gate_demo", "A1", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        result: "INVALID_TICKET",
        message: "Entry credential is no longer valid",
      }),
    });
    expect(store.checkins.map((checkin) => checkin.result)).toEqual([
      "INVALID_TICKET",
    ]);

    await expect(
      verification.redeem(refreshedPayload, "usr_gate_demo", "A1", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).resolves.toMatchObject({
      result: "ACCEPTED",
      ticketId: "tkt_demo_001",
    });
  });

  it("rejects NFC payloads for the wrong selected event before recording a check-in", async () => {
    const payload = await verification.createPayload("tkt_demo_001");

    await expect(
      verification.validateNfcPayload(
        JSON.stringify(payload),
        "evt_other_demo",
        "usr_gate_demo",
        "A1",
        {
          userId: "usr_gate_demo",
          role: "GATE_STAFF",
        },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(store.checkins).toEqual([]);
  });

  it("rejects gate staff at unassigned gates before recording a check-in", async () => {
    const payload = await verification.createPayload("tkt_demo_001");

    await expect(
      verification.redeem(payload, "usr_gate_demo", "A2", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(store.checkins).toEqual([]);
  });

  it("rejects gate summaries for unassigned gate staff", async () => {
    await expect(
      verification.checkinSummary("evt_weekend_demo", "A2", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("blocks entry code generation for listed tickets", async () => {
    store.getTicket("tkt_demo_001").status = "LISTED_FOR_RESALE";

    await expect(async () =>
      verification.createPayload("tkt_demo_001"),
    ).rejects.toThrow(BadRequestException);
  });

  it("requires an explicit QR signing secret in production-like environments", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalQrSigningSecret = process.env.QR_SIGNING_SECRET;
    process.env.NODE_ENV = "production";
    delete process.env.QR_SIGNING_SECRET;
    try {
      const productionAudit = new AuditService(store);
      const productionTicketOwnership = new TicketOwnershipSideEffectsService(
        new OwnershipService(new ConfigService()),
      );
      const productionVerification = new VerificationService(
        new ConfigService(),
        store,
        productionAudit,
        new TicketsService(store, productionAudit, productionTicketOwnership),
        productionTicketOwnership,
      );

      await expect(async () =>
        productionVerification.createPayload("tkt_demo_001"),
      ).rejects.toThrow("QR_SIGNING_SECRET is required in production");
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
      if (originalQrSigningSecret === undefined) {
        delete process.env.QR_SIGNING_SECRET;
      } else {
        process.env.QR_SIGNING_SECRET = originalQrSigningSecret;
      }
    }
  });

  it("caps configured QR credential TTL at 30 seconds", async () => {
    const audit = new AuditService(store);
    const ticketOwnership = new TicketOwnershipSideEffectsService(
      new OwnershipService(new ConfigService()),
    );
    const configuredVerification = new VerificationService(
      new ConfigService({
        QR_SIGNING_SECRET: "test-secret",
        QR_TTL_SECONDS: "300",
      }),
      store,
      audit,
      new TicketsService(store, audit, ticketOwnership),
      ticketOwnership,
    );

    const payload = await configuredVerification.createPayload("tkt_demo_001");

    expect(
      new Date(payload.expiresAt).getTime() -
        new Date(payload.issuedAt).getTime(),
    ).toBe(30_000);
  });

  function resultCounts() {
    return store.checkins.reduce<Record<string, number>>((counts, checkin) => {
      counts[checkin.result] = (counts[checkin.result] ?? 0) + 1;
      return counts;
    }, {});
  }
});

function buildLegacySignedPayload(
  payload: SignedQrPayload,
  nonce: string,
): SignedQrPayload {
  const unsigned = {
    ticketId: payload.ticketId,
    eventId: payload.eventId,
    ownerIdHash: payload.ownerIdHash,
    nonce,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
  return {
    ...unsigned,
    signature: signPayload(unsigned),
  };
}

function signPayload(payload: Record<string, string | number | undefined>) {
  return createHmac("sha256", "test-secret")
    .update(canonicalPayload(payload))
    .digest("base64url");
}

function canonicalPayload(payload: Record<string, string | number | undefined>) {
  return JSON.stringify(
    Object.keys(payload)
      .filter((key) => payload[key] !== undefined)
      .sort()
      .reduce<Record<string, string | number>>((accumulator, key) => {
        accumulator[key] = payload[key] as string | number;
        return accumulator;
      }, {}),
  );
}
