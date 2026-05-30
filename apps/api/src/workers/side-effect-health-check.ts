import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SideEffectHealthService } from "../modules/side-effects/side-effect-health.service";

async function main() {
  process.env.FANPASS_ENABLE_PRISMA_CONNECT ??= "true";
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const health = app.get(SideEffectHealthService);
    const result = await health.check();
    const output = JSON.stringify(result, null, 2);
    if (!result.ok) {
      console.error(output);
      process.exitCode = 1;
      return;
    }
    console.log(output);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
