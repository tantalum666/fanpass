import { computeAddress, getAddress, isAddress, ZeroAddress } from "ethers";

export const LOCAL_NETWORK_NAME = "hardhat";
export const LOCAL_CHAIN_ID = 31337n;
export const SEPOLIA_DEV_NETWORK_NAME = "sepoliaDev";
export const SEPOLIA_STAGING_NETWORK_NAME = "sepoliaStaging";
export const SEPOLIA_CHAIN_ID = 11155111n;
export const SEPOLIA_STAGING_MIGRATION_OPT_IN =
  "DEPLOY_FANPASS_STAGING_TO_PUBLIC_SEPOLIA";

const SEPOLIA_DEV_OPT_IN = "true";
const SECP256K1_ORDER = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);

type Environment = Readonly<Record<string, string | undefined>>;

export type HardhatEnvironmentMode =
  "STANDARD" | "READ_ONLY_PREFLIGHT" | "STAGING_MIGRATION";

export interface HardhatEnvironmentPolicy {
  mode: HardhatEnvironmentMode;
  localEnvFilesAllowed: boolean;
}

const HARDHAT_PROCESS_ONLY_KEYS = new Set([
  "FANPASS_HARDHAT_READ_ONLY_PREFLIGHT",
  "FANPASS_HARDHAT_STAGING_MIGRATION",
]);

export interface DeploymentNetwork {
  networkName: string;
  chainId: bigint;
}

export interface SepoliaDevCredentials {
  rpcUrl: string;
  privateKey: string;
}

export interface SepoliaStagingMigrationConfig extends SepoliaDevCredentials {
  sponsorAddress: string;
  deployerAddress: string;
}

export interface SepoliaStagingPreflightConfig {
  rpcUrl: string;
  sponsorAddress: string;
  expectedBuildManifestSha256: string;
  contracts: {
    fanPassTicket: string;
    fanPassSoulbound: string;
    redemptionRegistry: string;
  };
  directTransferProbeTicketIdHash?: string;
}

export function initializeHardhatEnvironment(options: {
  environment: Environment;
  localEnvFiles: readonly string[];
  loadLocalEnvFile: (filePath: string) => void;
}): HardhatEnvironmentPolicy {
  const readOnlyPreflight =
    options.environment.FANPASS_HARDHAT_READ_ONLY_PREFLIGHT === "true";
  const stagingMigration =
    options.environment.FANPASS_HARDHAT_STAGING_MIGRATION === "true";
  if (readOnlyPreflight && stagingMigration) {
    throw new Error(
      "Hardhat read-only preflight and staging migration modes are mutually exclusive.",
    );
  }

  const mode: HardhatEnvironmentMode = readOnlyPreflight
    ? "READ_ONLY_PREFLIGHT"
    : stagingMigration
      ? "STAGING_MIGRATION"
      : "STANDARD";
  const localEnvFilesAllowed = mode === "STANDARD";
  if (localEnvFilesAllowed) {
    for (const filePath of options.localEnvFiles) {
      options.loadLocalEnvFile(filePath);
    }
  }
  return { mode, localEnvFilesAllowed };
}

export function isHardhatProcessOnlyEnvironmentKey(key: string): boolean {
  return HARDHAT_PROCESS_ONLY_KEYS.has(key);
}

export function assertLocalDeploymentNetworkName(networkName: string): void {
  if (networkName !== LOCAL_NETWORK_NAME) {
    throw new Error(
      `Refusing local deployment on network ${networkName}; expected ${LOCAL_NETWORK_NAME}`,
    );
  }
}

export function assertLocalDeploymentNetwork(network: DeploymentNetwork): void {
  assertLocalDeploymentNetworkName(network.networkName);
  if (network.chainId !== LOCAL_CHAIN_ID) {
    throw new Error(
      `Refusing local deployment on chain ${network.chainId}; expected ${LOCAL_CHAIN_ID}`,
    );
  }
}

export function assertSepoliaDeploymentNetworkName(networkName: string): void {
  if (networkName !== SEPOLIA_DEV_NETWORK_NAME) {
    throw new Error(
      `Refusing Sepolia dev deployment on network ${networkName}; expected ${SEPOLIA_DEV_NETWORK_NAME}`,
    );
  }
}

export function assertSepoliaDeploymentNetwork(
  network: DeploymentNetwork,
): void {
  assertSepoliaDeploymentNetworkName(network.networkName);
  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Refusing Sepolia dev deployment on chain ${network.chainId}; expected ${SEPOLIA_CHAIN_ID}`,
    );
  }
}

export function assertSepoliaStagingDeploymentNetworkName(
  networkName: string,
): void {
  if (networkName !== SEPOLIA_STAGING_NETWORK_NAME) {
    throw new Error(
      `Refusing Sepolia staging deployment on network ${networkName}; expected ${SEPOLIA_STAGING_NETWORK_NAME}`,
    );
  }
}

export function assertSepoliaStagingDeploymentNetwork(
  network: DeploymentNetwork,
): void {
  assertSepoliaStagingDeploymentNetworkName(network.networkName);
  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Refusing Sepolia staging deployment on chain ${network.chainId}; expected ${SEPOLIA_CHAIN_ID}`,
    );
  }
}

export function resolveSepoliaDevCredentials(
  environment: Environment,
): SepoliaDevCredentials | null {
  if (environment.FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY !== SEPOLIA_DEV_OPT_IN) {
    return null;
  }

  const rpcUrl = environment.FANPASS_SEPOLIA_RPC_URL?.trim();
  if (!rpcUrl || !isHttpsUrl(rpcUrl)) {
    throw new Error(
      "FANPASS_SEPOLIA_RPC_URL must be set to an HTTPS Sepolia RPC URL. Do not commit or save the raw URL in evidence.",
    );
  }

  const privateKey = normalizePrivateKey(
    environment.FANPASS_SEPOLIA_DEV_PRIVATE_KEY,
  );
  if (!privateKey) {
    throw new Error(
      "FANPASS_SEPOLIA_DEV_PRIVATE_KEY must be a valid temporary Sepolia-only private key. Never paste it into chat or commit it.",
    );
  }

  return { rpcUrl, privateKey };
}

export function requireSepoliaDevCredentials(
  environment: Environment,
): SepoliaDevCredentials {
  const credentials = resolveSepoliaDevCredentials(environment);
  if (!credentials) {
    throw new Error(
      "Refusing to use a temporary hot key. Set FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY=true only for Sepolia dev-only deployment.",
    );
  }
  return credentials;
}

export function resolveSepoliaStagingMigrationConfig(
  environment: Environment,
): SepoliaStagingMigrationConfig | null {
  if (
    environment.FANPASS_ALLOW_SEPOLIA_STAGING_MIGRATION !==
    SEPOLIA_STAGING_MIGRATION_OPT_IN
  ) {
    return null;
  }
  if (environment.FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY === SEPOLIA_DEV_OPT_IN) {
    throw new Error(
      "Disable FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY before a Staging migration.",
    );
  }
  for (const key of [
    "FANPASS_SEPOLIA_DEV_PRIVATE_KEY",
    "TESTNET_OPERATOR_PRIVATE_KEY",
    "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY",
  ]) {
    if (environment[key]?.trim()) {
      throw new Error(
        `${key} must be unset for the isolated Staging migration process.`,
      );
    }
  }

  const rpcUrl = requireHttpsRpcUrl(environment);
  const privateKey = normalizePrivateKey(
    environment.FANPASS_SEPOLIA_STAGING_TEMP_PRIVATE_KEY,
  );
  if (!privateKey) {
    throw new Error(
      "FANPASS_SEPOLIA_STAGING_TEMP_PRIVATE_KEY must be a valid temporary Sepolia-only private key. Never paste it into chat or commit it.",
    );
  }

  const sponsorAddress = requireAddress(
    environment.FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS,
    "FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS Privy sponsor",
  );
  const deployerAddress = getAddress(computeAddress(privateKey));
  if (sponsorAddress === deployerAddress) {
    throw new Error(
      "The Privy sponsor and temporary deployer must be different addresses so staging ownership cannot remain with the hot key.",
    );
  }

  return { rpcUrl, privateKey, sponsorAddress, deployerAddress };
}

export function requireSepoliaStagingMigrationConfig(
  environment: Environment,
): SepoliaStagingMigrationConfig {
  const config = resolveSepoliaStagingMigrationConfig(environment);
  if (!config) {
    throw new Error(
      `Refusing Sepolia staging migration. Set FANPASS_ALLOW_SEPOLIA_STAGING_MIGRATION=${SEPOLIA_STAGING_MIGRATION_OPT_IN} only for the reviewed migration window.`,
    );
  }
  return config;
}

export function resolveSepoliaRpcUrl(environment: Environment): string | null {
  if (!environment.FANPASS_SEPOLIA_RPC_URL?.trim()) {
    return null;
  }
  return requireHttpsRpcUrl(environment);
}

export function requireSepoliaStagingPreflightConfig(
  environment: Environment,
): SepoliaStagingPreflightConfig {
  const expectedBuildManifestSha256 =
    environment.FANPASS_SEPOLIA_STAGING_EXPECTED_BUILD_MANIFEST_SHA256?.trim();
  if (
    !expectedBuildManifestSha256 ||
    !/^sha256:[a-fA-F0-9]{64}$/.test(expectedBuildManifestSha256)
  ) {
    throw new Error(
      "FANPASS_SEPOLIA_STAGING_EXPECTED_BUILD_MANIFEST_SHA256 must be the protected migration build digest.",
    );
  }
  const directTransferProbeTicketIdHash =
    environment.FANPASS_SEPOLIA_STAGING_POLICY_PROBE_TICKET_ID_HASH?.trim();
  if (
    directTransferProbeTicketIdHash &&
    !/^0x[a-fA-F0-9]{64}$/.test(directTransferProbeTicketIdHash)
  ) {
    throw new Error(
      "FANPASS_SEPOLIA_STAGING_POLICY_PROBE_TICKET_ID_HASH must be a 32-byte hex hash.",
    );
  }

  return {
    rpcUrl: requireHttpsRpcUrl(environment),
    expectedBuildManifestSha256: expectedBuildManifestSha256.toLowerCase(),
    sponsorAddress: requireAddress(
      environment.FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS,
      "FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS Privy sponsor",
    ),
    contracts: {
      fanPassTicket: requireAddress(
        environment.FANPASS_SEPOLIA_STAGING_TICKET_ADDRESS,
        "FANPASS_SEPOLIA_STAGING_TICKET_ADDRESS",
      ),
      fanPassSoulbound: requireAddress(
        environment.FANPASS_SEPOLIA_STAGING_SOULBOUND_ADDRESS,
        "FANPASS_SEPOLIA_STAGING_SOULBOUND_ADDRESS",
      ),
      redemptionRegistry: requireAddress(
        environment.FANPASS_SEPOLIA_STAGING_REDEMPTION_REGISTRY_ADDRESS,
        "FANPASS_SEPOLIA_STAGING_REDEMPTION_REGISTRY_ADDRESS",
      ),
    },
    ...(directTransferProbeTicketIdHash
      ? { directTransferProbeTicketIdHash }
      : {}),
  };
}

export function assertSepoliaStagingPreflightIsKeyless(
  environment: Environment,
): void {
  for (const key of [
    "FANPASS_SEPOLIA_STAGING_TEMP_PRIVATE_KEY",
    "FANPASS_SEPOLIA_DEV_PRIVATE_KEY",
    "TESTNET_OPERATOR_PRIVATE_KEY",
    "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY",
  ]) {
    if (environment[key]?.trim()) {
      throw new Error(`${key} must be unset for the read-only preflight.`);
    }
  }

  if (
    environment.FANPASS_ALLOW_SEPOLIA_STAGING_MIGRATION ===
      SEPOLIA_STAGING_MIGRATION_OPT_IN ||
    environment.FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY === SEPOLIA_DEV_OPT_IN ||
    environment.FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES === "true"
  ) {
    throw new Error(
      "All chain-write opt-ins must be disabled for the read-only preflight.",
    );
  }
}

function requireHttpsRpcUrl(environment: Environment): string {
  const rpcUrl = environment.FANPASS_SEPOLIA_RPC_URL?.trim();
  if (!rpcUrl || !isHttpsUrl(rpcUrl)) {
    throw new Error(
      "FANPASS_SEPOLIA_RPC_URL must be set to an HTTPS Sepolia RPC URL. Do not commit or save the raw URL in evidence.",
    );
  }
  return rpcUrl;
}

function requireAddress(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed || !isAddress(trimmed)) {
    throw new Error(`${label} must be a valid non-zero address.`);
  }
  const normalized = getAddress(trimmed);
  if (normalized === ZeroAddress) {
    throw new Error(`${label} must be a valid non-zero address.`);
  }
  return normalized;
}

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function normalizePrivateKey(value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^(0x)?[a-fA-F0-9]{64}$/.test(trimmed)) {
    return null;
  }

  const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  const scalar = BigInt(`0x${hex}`);
  if (scalar === 0n || scalar >= SECP256K1_ORDER) {
    return null;
  }
  return `0x${hex}`;
}
