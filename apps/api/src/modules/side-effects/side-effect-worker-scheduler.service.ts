import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readIntegerConfig } from "../../config/security-config";
import { SideEffectWorkerService } from "./side-effect-worker.service";

@Injectable()
export class SideEffectWorkerSchedulerService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(SideEffectWorkerSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private activeTick: Promise<void> | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly worker: SideEffectWorkerService,
  ) {}

  onModuleInit() {
    if (
      this.config.get<string>("FANPASS_SIDE_EFFECT_WORKER_ENABLED") !== "true"
    ) {
      return;
    }
    const intervalMs = this.intervalMs();
    this.timer = setInterval(() => {
      this.startTick();
    }, intervalMs);
    this.timer.unref?.();
    this.startTick();
    this.logger.log(`Side-effect worker scheduler enabled (${intervalMs}ms)`);
  }

  async onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.activeTick;
  }

  private startTick() {
    if (this.activeTick) {
      return;
    }
    const tick = this.runTick();
    this.activeTick = tick;
    void tick.finally(() => {
      if (this.activeTick === tick) {
        this.activeTick = undefined;
      }
    });
  }

  private async runTick() {
    try {
      const result = await this.worker.workOnce(this.limit());
      if (result.processed > 0 || result.recovered > 0) {
        this.logger.log(
          `Side-effect worker processed=${result.processed} completed=${result.completed} retried=${result.retried} dead=${result.dead} recovered=${result.recovered}`,
        );
      }
    } catch (error) {
      this.logger.error(
        "Side-effect worker scheduler tick failed",
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private intervalMs() {
    const value = readIntegerConfig(
      this.config,
      "FANPASS_SIDE_EFFECT_WORKER_INTERVAL_MS",
      15_000,
    );
    return Math.min(300_000, Math.max(1_000, value));
  }

  private limit() {
    const value = readIntegerConfig(
      this.config,
      "SIDE_EFFECT_WORKER_LIMIT",
      10,
    );
    return Math.min(100, Math.max(1, value));
  }
}
