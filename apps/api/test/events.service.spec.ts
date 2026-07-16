import { NotFoundException } from "@nestjs/common";
import { DemoStore } from "../src/common/demo-store";
import { AuditService } from "../src/modules/audit/audit.service";
import { EventsService } from "../src/modules/events/events.service";

describe("EventsService public catalog", () => {
  const originalDataSource = process.env.FANPASS_DATA_SOURCE;

  afterEach(() => {
    if (originalDataSource === undefined) {
      delete process.env.FANPASS_DATA_SOURCE;
    } else {
      process.env.FANPASS_DATA_SOURCE = originalDataSource;
    }
  });

  it("returns published events and excludes draft events from the public list", async () => {
    delete process.env.FANPASS_DATA_SOURCE;
    const store = new DemoStore();
    const service = new EventsService(store, new AuditService(store));
    const draft = await service.createEvent({
      title: "Organizer draft",
      venueName: "Private venue",
      city: "London",
      startTime: "2027-01-01T12:00:00.000Z",
      endTime: "2027-01-01T14:00:00.000Z",
    });

    const events = await service.listEvents();

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.status === "PUBLISHED")).toBe(true);
    expect(events).not.toContainEqual(expect.objectContaining({ id: draft.id }));
  });

  it("returns not found for a draft event through the public detail boundary", async () => {
    delete process.env.FANPASS_DATA_SOURCE;
    const store = new DemoStore();
    const service = new EventsService(store, new AuditService(store));
    const draft = await service.createEvent({
      title: "Unpublished event",
      venueName: "Private venue",
      city: "Tokyo",
      startTime: "2027-02-01T12:00:00.000Z",
      endTime: "2027-02-01T14:00:00.000Z",
    });

    await expect(service.getEvent(draft.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.getEvent(store.events.find((event) => event.status === "PUBLISHED")!.id)).resolves.toMatchObject({
      status: "PUBLISHED",
    });
  });

  it("enforces publication status in Prisma list and detail queries", async () => {
    process.env.FANPASS_DATA_SOURCE = "prisma";
    const prisma = {
      event: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const store = new DemoStore();
    const service = new EventsService(
      store,
      new AuditService(store),
      prisma as never,
    );

    await expect(service.listEvents()).resolves.toEqual([]);
    await expect(service.getEvent("evt_private")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PUBLISHED" } }),
    );
    expect(prisma.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_private", status: "PUBLISHED" },
      }),
    );
  });
});
