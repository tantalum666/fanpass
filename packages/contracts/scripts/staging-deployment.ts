import {
  getAddress,
  type BaseContract,
  type ContractFactory,
  type TransactionResponse,
} from "ethers";

export interface StagingDeploymentResult {
  contracts: {
    fanPassTicket: string;
    fanPassSoulbound: string;
    redemptionRegistry: string;
  };
  deploymentTransactions: {
    fanPassTicket: string;
    fanPassSoulbound: string;
    redemptionRegistry: string;
  };
}

export async function deployFanPassStagingContracts(options: {
  sponsorAddress: string;
  ticketFactory: ContractFactory;
  soulboundFactory: ContractFactory;
  redemptionRegistryFactory: ContractFactory;
  confirmations?: number;
  onContractDeployed?: (
    name: keyof StagingDeploymentResult["contracts"],
    record: { address: string; transactionHash: string },
  ) => void | Promise<void>;
}): Promise<StagingDeploymentResult> {
  const sponsorAddress = getAddress(options.sponsorAddress);
  const confirmations = options.confirmations ?? 1;
  if (!Number.isSafeInteger(confirmations) || confirmations < 1) {
    throw new Error("Deployment confirmations must be a positive integer.");
  }
  const ticket = await options.ticketFactory.deploy(sponsorAddress);
  await ticket.waitForDeployment();
  await requireSuccessfulReceipt(ticket, "FanPassTicket", confirmations);
  const ticketRecord = {
    address: await ticket.getAddress(),
    transactionHash: requireDeploymentHash(ticket, "FanPassTicket"),
  };
  await options.onContractDeployed?.("fanPassTicket", ticketRecord);

  const soulbound = await options.soulboundFactory.deploy(sponsorAddress);
  await soulbound.waitForDeployment();
  await requireSuccessfulReceipt(soulbound, "FanPassSoulbound", confirmations);
  const soulboundRecord = {
    address: await soulbound.getAddress(),
    transactionHash: requireDeploymentHash(soulbound, "FanPassSoulbound"),
  };
  await options.onContractDeployed?.("fanPassSoulbound", soulboundRecord);

  const redemptionRegistry =
    await options.redemptionRegistryFactory.deploy(sponsorAddress);
  await redemptionRegistry.waitForDeployment();
  await requireSuccessfulReceipt(
    redemptionRegistry,
    "RedemptionRegistry",
    confirmations,
  );
  const redemptionRecord = {
    address: await redemptionRegistry.getAddress(),
    transactionHash: requireDeploymentHash(
      redemptionRegistry,
      "RedemptionRegistry",
    ),
  };
  await options.onContractDeployed?.("redemptionRegistry", redemptionRecord);

  return {
    contracts: {
      fanPassTicket: ticketRecord.address,
      fanPassSoulbound: soulboundRecord.address,
      redemptionRegistry: redemptionRecord.address,
    },
    deploymentTransactions: {
      fanPassTicket: ticketRecord.transactionHash,
      fanPassSoulbound: soulboundRecord.transactionHash,
      redemptionRegistry: redemptionRecord.transactionHash,
    },
  };
}

async function requireSuccessfulReceipt(
  contract: BaseContract,
  name: string,
  confirmations: number,
): Promise<void> {
  const transaction =
    contract.deploymentTransaction() as TransactionResponse | null;
  if (!transaction) {
    throw new Error(`${name} deployment transaction is unavailable.`);
  }
  const receipt = await transaction.wait(confirmations);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`${name} deployment transaction was not successful.`);
  }
}

function requireDeploymentHash(contract: BaseContract, name: string): string {
  const transaction =
    contract.deploymentTransaction() as TransactionResponse | null;
  if (!transaction?.hash) {
    throw new Error(`${name} deployment transaction hash is unavailable.`);
  }
  return transaction.hash;
}
