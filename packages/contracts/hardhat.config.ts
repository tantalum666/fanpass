import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import fs from "fs";
import { defineConfig } from "hardhat/config";
import path from "path";
import { fileURLToPath } from "url";

import {
  initializeHardhatEnvironment,
  isHardhatProcessOnlyEnvironmentKey,
  resolveSepoliaDevCredentials,
  resolveSepoliaRpcUrl,
} from "./scripts/deployment-policy.js";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const environmentPolicy = initializeHardhatEnvironment({
  environment: process.env,
  localEnvFiles: [
    path.resolve(configDir, "..", "..", ".env.local"),
    path.resolve(configDir, ".env.local"),
  ],
  loadLocalEnvFile,
});
const protectedMode = environmentPolicy.mode !== "STANDARD";
const sepoliaDevCredentials = protectedMode
  ? null
  : resolveSepoliaDevCredentials(process.env);
const sepoliaRpcUrl = resolveSepoliaRpcUrl(process.env);

export default defineConfig({
  plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha],
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },
    sepoliaDev: {
      type: "http",
      chainType: "l1",
      url: sepoliaDevCredentials?.rpcUrl ?? "https://rpc.sepolia.invalid",
      chainId: 11155111,
      accounts: sepoliaDevCredentials ? [sepoliaDevCredentials.privateKey] : [],
    },
    sepoliaStaging: {
      type: "http",
      chainType: "l1",
      url: sepoliaRpcUrl ?? "https://rpc.sepolia.invalid",
      chainId: 11155111,
      accounts: [],
    },
  },
});

function loadLocalEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (
      process.env[key] !== undefined ||
      isHardhatProcessOnlyEnvironmentKey(key)
    ) {
      continue;
    }
    process.env[key] = unquoteEnvValue(rawValue.trim());
  }
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
