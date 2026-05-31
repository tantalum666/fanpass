import { ConfigService } from "@nestjs/config";
import { SideEffectWorkerSchedulerService } from "../src/modules/side-effects/side-effect-worker-scheduler.service";

describe("SideEffectWorkerSchedulerService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("stays disabled unless explicitly enabled", () => {
    const worker = { workOnce: jest.fn() };
    const scheduler = new SideEffectWorkerSchedulerService(
      config({}) as unknown as ConfigService,
      worker as never,
    );

    scheduler.onModuleInit();

    expect(worker.workOnce).not.toHaveBeenCalled();
  });

  it("runs immediately and on the configured interval when enabled", async () => {
    jest.useFakeTimers();
    const worker = {
      workOnce: jest.fn(async () => ({
        recovered: 0,
        processed: 0,
        completed: 0,
        retried: 0,
        dead: 0,
      })),
    };
    const scheduler = new SideEffectWorkerSchedulerService(
      config({
        FANPASS_SIDE_EFFECT_WORKER_ENABLED: "true",
        FANPASS_SIDE_EFFECT_WORKER_INTERVAL_MS: "1000",
        SIDE_EFFECT_WORKER_LIMIT: "3",
      }) as unknown as ConfigService,
      worker as never,
    );

    scheduler.onModuleInit();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
    scheduler.onApplicationShutdown();

    expect(worker.workOnce).toHaveBeenCalledTimes(2);
    expect(worker.workOnce).toHaveBeenCalledWith(3);
  });
});

function config(values: Record<string, string>) {
  return {
    get: jest.fn((key: string) => values[key]),
  };
}
