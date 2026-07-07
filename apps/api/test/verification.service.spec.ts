import { createHmac } from "crypto";
import { BadRequestException } from "@nestjs/common";
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

  it("returns recent check-ins without raw nonce or payload data", async () => {
    const payload = await verification.createPayload("tkt_demo_001");
    await verification.redeem(payload, "usr_gate_demo", "A1", {
      userId: "usr_gate_demo",
      role: "GATE_STAFF",
    });
    await expect(
      verification.redeem(payload, "usr_gate_demo", "A1", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).rejects.toThrow(BadRequestException);

    const history = await verification.recentCheckins({
      userId: "usr_gate_demo",
      role: "GATE_STAFF",
    });

    expect(history.items).toHaveLength(2);
    expect(history.items[0]).toMatchObject({
      result: "DUPLICATE",
      accepted: false,
      ticketRef: "FP-EMO001",
      reason: "Already used",
    });
    expect(history.items[1]).toMatchObject({
      result: "ACCEPTED",
      accepted: true,
      reason: null,
    });
    expect(history.items[0]).not.toHaveProperty("nonce");
    expect(history.items[0]).not.toHaveProperty("payload");
    expect(history.items[0]).not.toHaveProperty("signature");
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

  it("keeps Ops and turnstile redemption mutually exclusive for the same ticket", async () => {
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
    store.users.push({
      id: "usr_ops_gate_demo",
      name: "Ops Gate Staff",
      email: "ops-gate@fanpass.test",
      role: "GATE_STAFF",
      privyId: "did:privy:ops-gate-demo",
      walletAddress: null,
      riskScore: 0,
    });

    const basePayload = await verification.createPayload("tkt_demo_001");
    const turnstilePayload = buildLegacySignedPayload(
      basePayload,
      "nonce_turnstile_gate",
    );
    const opsPayload = buildLegacySignedPayload(basePayload, "nonce_ops_gate");

    const turnstileScan = verification.redeem(
      turnstilePayload,
      "usr_gate_demo",
      "A1",
      {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      },
    );
    const opsScan = verification.redeem(
      opsPayload,
      "usr_ops_gate_demo",
      "OPS",
      {
        userId: "usr_ops_gate_demo",
        role: "GATE_STAFF",
      },
    );

    await expect(opsScan).rejects.toMatchObject({
      response: expect.objectContaining({
        result: "DUPLICATE",
      }),
    });

    releaseOwnership?.();
    await expect(turnstileScan).resolves.toMatchObject({
      ticketId: "tkt_demo_001",
      eventId: "evt_weekend_demo",
      result: "ACCEPTED",
    });
    expect(store.getTicket("tkt_demo_001").status).toBe("REDEEMED");
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

  it("allows gate staff to redeem valid QR payloads at any gate", async () => {
    const payload = await verification.createPayload("tkt_demo_001");

    await expect(
      verification.redeem(payload, "usr_gate_demo", "A2", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).resolves.toMatchObject({
      eventId: "evt_weekend_demo",
      result: "ACCEPTED",
      ticketId: "tkt_demo_001",
    });
    expect(store.checkins).toMatchObject([{ gate: "A2", result: "ACCEPTED" }]);
  });

  it("allows gate staff to view summaries for any gate", async () => {
    await expect(
      verification.checkinSummary("evt_weekend_demo", "A2", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).resolves.toMatchObject({
      eventId: "evt_weekend_demo",
      gate: "A2",
      total: 0,
    });
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

  it("rejects signed entry credentials that are not active yet", async () => {
    const payload = await verification.createPayload("tkt_demo_001");
    const issuedAt = new Date(Date.now() + 60_000);
    const notYetActivePayload = resignPayload({
      ...payload,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + 30_000).toISOString(),
    });

    await expect(
      verification.redeem(notYetActivePayload, "usr_gate_demo", "A1", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        result: "INVALID_TICKET",
        message: "Entry credential is not active yet",
      }),
    });
    expect(store.getTicket("tkt_demo_001").status).toBe("ACTIVE");
    expect(resultCounts()).toEqual({ INVALID_TICKET: 1 });
  });

  it("rejects signed entry credentials with a lifetime beyond the server TTL", async () => {
    const payload = await verification.createPayload("tkt_demo_001");
    const issuedAt = new Date();
    const longLivedPayload = resignPayload({
      ...payload,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + 120_000).toISOString(),
    });

    await expect(
      verification.redeem(longLivedPayload, "usr_gate_demo", "A1", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        result: "INVALID_TICKET",
        message: "Entry credential lifetime is too long",
      }),
    });
    expect(store.getTicket("tkt_demo_001").status).toBe("ACTIVE");
    expect(resultCounts()).toEqual({ INVALID_TICKET: 1 });
  });

  it("rejects signed entry credentials whose timing differs from the stored credential", async () => {
    const payload = await verification.createPayload("tkt_demo_001");
    const shiftedIssuedAt = new Date(
      new Date(payload.issuedAt).getTime() - 1_000,
    );
    const shiftedPayload = resignPayload({
      ...payload,
      issuedAt: shiftedIssuedAt.toISOString(),
      expiresAt: new Date(shiftedIssuedAt.getTime() + 30_000).toISOString(),
    });

    await expect(
      verification.redeem(shiftedPayload, "usr_gate_demo", "A1", {
        userId: "usr_gate_demo",
        role: "GATE_STAFF",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        result: "INVALID_TICKET",
        message: "Entry credential is no longer valid",
      }),
    });
    expect(store.getTicket("tkt_demo_001").status).toBe("ACTIVE");
    expect(resultCounts()).toEqual({ INVALID_TICKET: 1 });
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

function resignPayload(payload: SignedQrPayload): SignedQrPayload {
  const unsigned = {
    v: payload.v,
    credentialId: payload.credentialId,
    ticketId: payload.ticketId,
    eventId: payload.eventId,
    ticketTypeId: payload.ticketTypeId,
    ownerIdHash: payload.ownerIdHash,
    nonce: payload.nonce,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    entryMode: payload.entryMode,
    kid: payload.kid,
  };
  return {
    ...payload,
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
