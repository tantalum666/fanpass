import {
  AbiCoder,
  Contract,
  getAddress,
  Interface,
  keccak256,
  type InterfaceAbi,
  type Provider,
  ZeroHash,
} from "ethers";

export interface DeployedContractArtifact {
  contractName: string;
  abi: InterfaceAbi;
  deployedBytecode: string;
}

export interface FanPassDeploymentAddresses {
  fanPassTicket: string;
  fanPassSoulbound: string;
  redemptionRegistry: string;
}

export interface DeployedContractPreflightOptions {
  provider: Provider;
  mode: "BASE" | "CUTOVER";
  expectedChainId: bigint;
  sponsorAddress: string;
  addresses: FanPassDeploymentAddresses;
  artifacts: {
    fanPassTicket: DeployedContractArtifact;
    fanPassSoulbound: DeployedContractArtifact;
    redemptionRegistry: DeployedContractArtifact;
  };
  directTransferProbeTicketIdHash?: string;
}

export interface DeployedContractPreflightResult {
  ok: true;
  mode: "BASE" | "CUTOVER";
  checkedAt: string;
  chainId: string;
  expectedOwner: string;
  contracts: Record<
    keyof FanPassDeploymentAddresses,
    {
      address: string;
      owner: string;
      runtimeBytecodeHash: string;
      requiredAbi: string[];
    }
  >;
  ticketIdGetter: {
    probeHash: string;
    tokenId: string;
  };
  directTransferPolicy:
    | { status: "NOT_RUN_NO_PROBE" }
    | {
        status: "BLOCKED_AS_REQUIRED";
        ticketIdHash: string;
        tokenId: string;
        revertReason: "Use FanPass settlement";
        entrypoints: [
          "transferFrom(address,address,uint256)",
          "safeTransferFrom(address,address,uint256)",
          "safeTransferFrom(address,address,uint256,bytes)",
        ];
      };
}

const REQUIRED_ABI: Record<keyof FanPassDeploymentAddresses, string[]> = {
  fanPassTicket: [
    "owner()",
    "mintTicketWithProof(address,uint256,bytes32,bytes32,bytes32,bytes32,bool,uint256,uint256,string)",
    "tokenIdByTicketIdHash(bytes32)",
    "syncTicketTransfer(address,address,uint256)",
    "transferFrom(address,address,uint256)",
    "safeTransferFrom(address,address,uint256)",
    "safeTransferFrom(address,address,uint256,bytes)",
    "redeem(uint256)",
    "cancel(uint256)",
    "refund(uint256)",
  ],
  fanPassSoulbound: [
    "owner()",
    "mintLockedWithProof(address,bytes32,bytes32,bytes32,bytes32,string)",
    "locked(uint256)",
    "isActive(uint256)",
    "revoke(uint256)",
    "transferFrom(address,address,uint256)",
  ],
  redemptionRegistry: [
    "owner()",
    "markRedeemedWithContext(address,uint256,bytes32,bytes32,bytes32,bytes32)",
    "redeemed(address,uint256)",
    "records(address,uint256)",
  ],
};

export async function runDeployedContractsPreflight(
  options: DeployedContractPreflightOptions,
): Promise<DeployedContractPreflightResult> {
  if (options.mode === "CUTOVER" && !options.directTransferProbeTicketIdHash) {
    throw new Error(
      "CUTOVER preflight requires an existing policy-probe ticket id hash.",
    );
  }
  const network = await options.provider.getNetwork();
  if (network.chainId !== options.expectedChainId) {
    throw new Error(
      `Refusing deployed-contract preflight on chain ${network.chainId}; expected ${options.expectedChainId}`,
    );
  }

  const sponsorAddress = getAddress(options.sponsorAddress);
  const normalizedAddresses = normalizeDistinctAddresses(options.addresses);
  const contracts = {} as DeployedContractPreflightResult["contracts"];

  for (const key of Object.keys(normalizedAddresses) as Array<
    keyof FanPassDeploymentAddresses
  >) {
    const artifact = options.artifacts[key];
    const address = normalizedAddresses[key];
    const requiredAbi = REQUIRED_ABI[key];
    const contractInterface = assertRequiredAbi(artifact, requiredAbi);
    const runtimeBytecodeHash = await assertRuntimeBytecode(
      options.provider,
      address,
      artifact,
    );
    const contract = new Contract(address, contractInterface, options.provider);
    const actualOwner = getAddress(await contract.owner());
    if (actualOwner !== sponsorAddress) {
      throw new Error(
        `${artifact.contractName} owner mismatch: expected the configured sponsor`,
      );
    }
    contracts[key] = {
      address,
      owner: actualOwner,
      runtimeBytecodeHash,
      requiredAbi,
    };
  }

  const ticket = new Contract(
    normalizedAddresses.fanPassTicket,
    options.artifacts.fanPassTicket.abi,
    options.provider,
  );
  const zeroHashTokenId = BigInt(await ticket.tokenIdByTicketIdHash(ZeroHash));
  if (zeroHashTokenId !== 0n) {
    throw new Error(
      "FanPassTicket tokenIdByTicketIdHash zero-hash probe returned a non-zero token id",
    );
  }

  const directTransferPolicy = options.directTransferProbeTicketIdHash
    ? await assertDirectTransferBlocked({
        provider: options.provider,
        ticket,
        ticketAddress: normalizedAddresses.fanPassTicket,
        ticketIdHash: options.directTransferProbeTicketIdHash,
        sponsorAddress,
      })
    : ({ status: "NOT_RUN_NO_PROBE" } as const);

  return {
    ok: true,
    mode: options.mode,
    checkedAt: new Date().toISOString(),
    chainId: network.chainId.toString(),
    expectedOwner: sponsorAddress,
    contracts,
    ticketIdGetter: { probeHash: ZeroHash, tokenId: "0" },
    directTransferPolicy,
  };
}

function normalizeDistinctAddresses(
  addresses: FanPassDeploymentAddresses,
): FanPassDeploymentAddresses {
  const normalized = {
    fanPassTicket: getAddress(addresses.fanPassTicket),
    fanPassSoulbound: getAddress(addresses.fanPassSoulbound),
    redemptionRegistry: getAddress(addresses.redemptionRegistry),
  };
  if (new Set(Object.values(normalized)).size !== 3) {
    throw new Error("Each FanPass contract must have a distinct address.");
  }
  return normalized;
}

function assertRequiredAbi(
  artifact: DeployedContractArtifact,
  requiredAbi: string[],
): Interface {
  const contractInterface = new Interface(artifact.abi);
  for (const signature of requiredAbi) {
    if (!contractInterface.getFunction(signature)) {
      throw new Error(
        `${artifact.contractName} artifact is missing required ABI ${signature}`,
      );
    }
  }
  return contractInterface;
}

async function assertRuntimeBytecode(
  provider: Provider,
  address: string,
  artifact: DeployedContractArtifact,
): Promise<string> {
  const actualBytecode = await provider.getCode(address);
  if (actualBytecode === "0x") {
    throw new Error(`${artifact.contractName} has no deployed bytecode.`);
  }
  if (!artifact.deployedBytecode || artifact.deployedBytecode === "0x") {
    throw new Error(
      `${artifact.contractName} artifact has no runtime bytecode.`,
    );
  }
  const actualHash = keccak256(actualBytecode);
  const expectedHash = keccak256(artifact.deployedBytecode);
  if (actualHash !== expectedHash) {
    throw new Error(
      `${artifact.contractName} runtime bytecode does not match the reviewed build artifact.`,
    );
  }
  return actualHash;
}

async function assertDirectTransferBlocked(options: {
  provider: Provider;
  ticket: Contract;
  ticketAddress: string;
  ticketIdHash: string;
  sponsorAddress: string;
}): Promise<DeployedContractPreflightResult["directTransferPolicy"]> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(options.ticketIdHash)) {
    throw new Error(
      "Direct-transfer probe ticket id hash must be 32-byte hex.",
    );
  }
  const tokenId = BigInt(
    await options.ticket.tokenIdByTicketIdHash(options.ticketIdHash),
  );
  if (tokenId === 0n) {
    throw new Error(
      "Direct-transfer probe ticket hash is not minted; omit the probe or provide an existing hash.",
    );
  }

  const holder = getAddress(await options.ticket.ownerOf(tokenId));
  if (holder === options.sponsorAddress) {
    throw new Error(
      "Direct-transfer probe ticket must be held by a non-sponsor address.",
    );
  }
  const receiver = selectProbeReceiver(holder, options.sponsorAddress);
  const entrypoints = [
    "transferFrom(address,address,uint256)",
    "safeTransferFrom(address,address,uint256)",
    "safeTransferFrom(address,address,uint256,bytes)",
  ] as const;

  for (const entrypoint of entrypoints) {
    const args = entrypoint.endsWith(",bytes)")
      ? [holder, receiver, tokenId, "0x"]
      : [holder, receiver, tokenId];
    const data = options.ticket.interface.encodeFunctionData(entrypoint, args);
    try {
      await options.provider.call({
        to: options.ticketAddress,
        from: holder,
        data,
      });
    } catch (error) {
      const reason = decodeRevertReason(error);
      if (reason === "Use FanPass settlement") {
        continue;
      }
      throw new Error(
        `${entrypoint} policy probe reverted for an unexpected reason: ${reason ?? "unknown"}`,
      );
    }
    throw new Error(
      `${entrypoint} policy probe unexpectedly succeeded; holder transfers must use FanPass settlement.`,
    );
  }

  return {
    status: "BLOCKED_AS_REQUIRED",
    ticketIdHash: options.ticketIdHash,
    tokenId: tokenId.toString(),
    revertReason: "Use FanPass settlement",
    entrypoints: [...entrypoints],
  };
}

function selectProbeReceiver(holder: string, sponsorAddress: string): string {
  for (const candidate of [
    getAddress("0x000000000000000000000000000000000000dEaD"),
    sponsorAddress,
  ]) {
    if (candidate !== holder) {
      return candidate;
    }
  }
  return getAddress("0x000000000000000000000000000000000000bEEF");
}

function decodeRevertReason(error: unknown): string | null {
  const data = findRevertData(error, 0);
  if (!data?.startsWith("0x08c379a0")) {
    return null;
  }
  try {
    const [reason] = AbiCoder.defaultAbiCoder().decode(
      ["string"],
      `0x${data.slice(10)}`,
    );
    return String(reason);
  } catch {
    return null;
  }
}

function findRevertData(value: unknown, depth: number): string | null {
  if (depth > 4 || value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return /^0x[a-fA-F0-9]+$/.test(value) ? value : null;
  }
  if (typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["data", "error", "info", "cause"]) {
    const found = findRevertData(record[key], depth + 1);
    if (found) {
      return found;
    }
  }
  return null;
}
