import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DemoStore } from "../src/common/demo-store";
import { AuditService } from "../src/modules/audit/audit.service";
import { OwnershipService } from "../src/modules/ownership/ownership.service";
import { TicketOwnershipSideEffectsService } from "../src/modules/side-effects/ticket-ownership-side-effects.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";
import { VerificationService } from "../src/modules/verification/verification.service";

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
    expect(store.checkins.map((checkin) => checkin.result)).toEqual([
      "DUPLICATE",
      "ACCEPTED",
    ]);

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
});
