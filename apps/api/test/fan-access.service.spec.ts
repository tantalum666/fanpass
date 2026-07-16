import { DemoStore } from "../src/common/demo-store";
import { demoSeedIds } from "../src/common/demo-seed";
import { AuditService } from "../src/modules/audit/audit.service";
import { EventsService } from "../src/modules/events/events.service";
import { FanAccessService } from "../src/modules/fan-access/fan-access.service";

describe("FanAccessService", () => {
  let store: DemoStore;
  let fanAccess: FanAccessService;
  let events: EventsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-20T00:00:00.000Z"));
    store = new DemoStore();
    const audit = new AuditService(store);
    fanAccess = new FanAccessService(store, audit);
    events = new EventsService(store, audit);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the transparent campaign contract and no more than three tasks", async () => {
    const campaign = await fanAccess.getCampaign(demoSeedIds.arenaEventId);
    expect(campaign).toMatchObject({
      rewardTitle: "Aurora Encore Priority Presale",
      rewardSupply: 240,
      qualificationPoints: 40,
      allocationMethod: "EQUAL_DRAW",
      tasks: [
        { taskType: "FOLLOW", points: 5 },
        { taskType: "TICKET_HOLD", points: 35 },
        { taskType: "CHECK_IN", points: 30, optional: true },
      ],
    });
    expect(campaign).not.toHaveProperty("createdByUserId");
    expect(campaign).not.toHaveProperty("maxLinkedWallets");
    expect(campaign).not.toHaveProperty("maxActiveEarningWallets");
  });

  it("publishes one backend-owned availability flag only while a campaign is open", async () => {
    expect(
      (await events.listEvents()).find(
        (event) => event.id === demoSeedIds.arenaEventId,
      ),
    ).toMatchObject({ fanAccessAvailable: true });

    const campaign = store.fanCampaigns.find(
      (candidate) => candidate.eventId === demoSeedIds.arenaEventId,
    )!;
    const taskId = store.fanTasks.find(
      (task) => task.campaignId === campaign.id,
    )!.id;
    campaign.status = "DRAFT";

    expect(
      (await events.listEvents()).find(
        (event) => event.id === demoSeedIds.arenaEventId,
      ),
    ).toMatchObject({ fanAccessAvailable: false });
    expect(fanAccess.getCampaign(demoSeedIds.arenaEventId)).toBeNull();
    await expect(
      fanAccess.listTasks(demoSeedIds.arenaEventId),
    ).resolves.toEqual([]);
    await expect(
      fanAccess.submitTask(taskId, { userId: demoSeedIds.fanId }),
    ).rejects.toThrow("This Fan Access task is not available");
    await expect(
      fanAccess.getScore(demoSeedIds.arenaEventId, demoSeedIds.fanId),
    ).resolves.toMatchObject({ campaignId: null, fanScore: 0 });
  });

  it("uses server-owned ticket state for automatic task verification", async () => {
    const submission = await fanAccess.submitTask(demoSeedIds.shareTaskId, {
      userId: demoSeedIds.fanId,
    });

    expect(submission).toMatchObject({
      status: "APPROVED",
      proof: "server-verified",
    });
    await expect(
      fanAccess.getScore(demoSeedIds.eventId, demoSeedIds.fanId),
    ).resolves.toMatchObject({
      fanScore: 35,
      qualificationPoints: 40,
      pointsToQualify: 5,
      entitlementStatus: "NOT_ELIGIBLE",
    });
  });

  it("keeps fan score separate from private risk signals", async () => {
    const fan = store.users.find((user) => user.id === demoSeedIds.fanId)!;
    fan.riskScore = 1;

    await expect(
      fanAccess.getScore(demoSeedIds.eventId, demoSeedIds.fanId),
    ).resolves.toMatchObject({
      fanScore: 35,
      score: 35,
      pointsToQualify: 5,
    });
  });

  it("adds attendance points only through the campaign check-in task", async () => {
    const eventId = demoSeedIds.arenaEventId;
    const task = store.fanTasks.find(
      (candidate) =>
        candidate.eventId === eventId && candidate.taskType === "CHECK_IN",
    )!;
    store.tickets.push({
      id: "tkt_aurora_redeemed",
      tokenId: "fan-access-attendance",
      eventId,
      ticketTypeId: demoSeedIds.arenaGeneralTicketTypeId,
      ownerId: demoSeedIds.fanId,
      seatHash: null,
      status: "REDEEMED",
      transferCount: 0,
      metadataUri: null,
    });

    await expect(
      fanAccess.submitTask(task.id, { userId: demoSeedIds.fanId }),
    ).resolves.toMatchObject({ status: "APPROVED" });
    await expect(
      fanAccess.getScore(eventId, demoSeedIds.fanId),
    ).resolves.toMatchObject({
      fanScore: 65,
      entitlementStatus: "ELIGIBLE",
    });
  });

  it("requires an audited organizer decision for manual tasks", async () => {
    const submission = await fanAccess.submitTask(demoSeedIds.quizTaskId, {
      userId: demoSeedIds.fanId,
      proof: "fanpass-follow-profile",
    });

    expect(submission.status).toBe("PENDING");
    await expect(
      fanAccess.reviewSubmission(
        submission.id,
        { decision: "APPROVED", reason: "Official FanPass follow confirmed" },
        { userId: demoSeedIds.organizerUserId, role: "ORGANIZER" },
      ),
    ).resolves.toMatchObject({ status: "APPROVED" });
    await expect(
      fanAccess.getScore(demoSeedIds.eventId, demoSeedIds.fanId),
    ).resolves.toMatchObject({
      fanScore: 40,
      pointsToQualify: 0,
      entitlementStatus: "ELIGIBLE",
    });
    expect(store.auditLogs[0]).toMatchObject({
      action: "FAN_TASK_REVIEWED",
      entityId: submission.id,
    });
  });
});
