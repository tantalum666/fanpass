import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { PublicRoute, Roles } from "./common/auth.decorators";
import { DemoStore } from "./common/demo-store";
import { FanPassAuthGuard } from "./common/fanpass-auth.guard";
import { VerificationService } from "./modules/verification/verification.service";

@Controller()
export class AppController {
  constructor(
    private readonly store: DemoStore,
    private readonly verification: VerificationService,
  ) {}

  @Get("/health")
  @PublicRoute()
  health() {
    return {
      ok: true,
      service: "fanpass-api",
      target: "technical-prototype",
    };
  }

  @Post("/prototype/reset")
  @UseGuards(FanPassAuthGuard)
  @Roles("ORGANIZER", "ADMIN")
  resetPrototype() {
    this.store.reset();
    this.verification.reset();
    return {
      ok: true,
      resetAt: this.store.now(),
    };
  }
}
