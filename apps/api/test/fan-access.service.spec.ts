import { DemoStore } from "../src/common/demo-store";
import { AuditService } from "../src/modules/audit/audit.service";
import { FanAccessService } from "../src/modules/fan-access/fan-access.service";

describe("FanAccessService", () => {
  let store: DemoStore;
  let fanAccess: FanAccessService;

  beforeEach(() => {
    store = new DemoStore();
    fanAccess = new FanAccessService(store, new AuditService(store));
  });

  it("auto-approves auto-verified task submissions and updates event score", async () => {
    const submission = await fanAccess.submitTask("task_quiz_demo", {
      userId: "usr_fan_demo",
      proof: "quiz-score:100"
    });

    expect(submission.status).toBe("APPROVED");
    await expect(await fanAccess.getScore("evt_weekend_demo", "usr_fan_demo")).toMatchObject({
      score: 20,
      entitlementStatus: "WAITLIST"
    });
  });

  it("adds attendance score only for redeemed tickets in the same event", async () => {
    store.getTicket("tkt_demo_001").status = "REDEEMED";

    await expect(await fanAccess.getScore("evt_weekend_demo", "usr_fan_demo")).toMatchObject({
      score: 30,
      entitlementStatus: "ELIGIBLE"
    });
    await expect(await fanAccess.getScore("evt_other_demo", "usr_fan_demo")).toMatchObject({
      score: 0,
      entitlementStatus: "WAITLIST"
    });
  });
});
