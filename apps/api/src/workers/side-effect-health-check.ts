import { SideEffectHealthService } from "../modules/side-effects/side-effect-health.service";
import { PostgresSideEffectHealthStore } from "./postgres-side-effect-health.store";
import { assertLocalSideEffectHealthRuntime } from "./side-effect-health-runtime";

const environmentConfig = {
  get<T = string>(key: string): T | undefined {
    return process.env[key] as T | undefined;
  },
  keys() {
    return Object.keys(process.env);
  },
};

export async function runLocalSideEffectHealthCheck() {
  assertLocalSideEffectHealthRuntime(environmentConfig);
  const store = await PostgresSideEffectHealthStore.connect(
    process.env.DATABASE_URL ?? "",
  );
  try {
    const health = new SideEffectHealthService(store, environmentConfig);
    const result = await health.check();
    assertLocalSideEffectHealthRuntime(environmentConfig);
    const output = JSON.stringify(result, null, 2);
    if (!result.ok) {
      console.error(output);
      process.exitCode = 1;
      return;
    }
    console.log(output);
  } finally {
    await store.close();
  }
}

if (require.main === module) {
  runLocalSideEffectHealthCheck().catch(() => {
    console.error("Local side-effect health check failed");
    process.exitCode = 1;
  });
}
