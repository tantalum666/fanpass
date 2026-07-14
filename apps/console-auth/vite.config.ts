import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const optionalProviderStub = path.resolve(
  appDirectory,
  "src/optional-provider-stub.ts",
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Console authentication is email-only. These optional wallet, on-ramp,
      // and mini-app integrations do not belong in the isolated auth bundle.
      "@farcaster/mini-app-solana": optionalProviderStub,
      "@stripe/crypto": optionalProviderStub,
    },
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
    sourcemap: false,
  },
});
