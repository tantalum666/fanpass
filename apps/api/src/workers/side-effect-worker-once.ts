import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SideEffectWorkerService } from "../modules/side-effects/side-effect-worker.service";

async function main() {
  process.env.FANPASS_ENABLE_PRISMA_CONNECT ??= "true";
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const worker = app.get(SideEffectWorkerService);
    const limit = Number.parseInt(
      process.env.SIDE_EFFECT_WORKER_LIMIT ?? "10",
      10,
    );
    const result = await worker.workOnce(Number.isFinite(limit) ? limit : 10);
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
