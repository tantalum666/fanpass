import "@nomicfoundation/hardhat-toolbox";
import fs from "fs";
import type { HardhatUserConfig } from "hardhat/config";
import path from "path";

loadLocalEnvFile(path.resolve(__dirname, "..", "..", ".env.local"));
loadLocalEnvFile(path.resolve(__dirname, ".env.local"));

const sepoliaDevRpcUrl =
  process.env.FANPASS_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.invalid";
const sepoliaDevPrivateKey = normalizePrivateKey(
  process.env.FANPASS_SEPOLIA_DEV_PRIVATE_KEY,
);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {},
    sepoliaDev: {
      url: sepoliaDevRpcUrl,
      chainId: 11155111,
      accounts: sepoliaDevPrivateKey ? [sepoliaDevPrivateKey] : [],
    },
  }
};

function normalizePrivateKey(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.startsWith("0x") ? value : `0x${value}`;
}

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
    if (process.env[key] !== undefined) {
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

export default config;
