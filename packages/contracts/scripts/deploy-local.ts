import hre from "hardhat";

import {
  assertLocalDeploymentNetwork,
  assertLocalDeploymentNetworkName,
} from "./deployment-policy.js";

async function main() {
  const connection = await hre.network.create();
  assertLocalDeploymentNetworkName(connection.networkName);

  const { ethers } = connection;
  const chain = await ethers.provider.getNetwork();
  assertLocalDeploymentNetwork({
    networkName: connection.networkName,
    chainId: chain.chainId,
  });

  const [deployer, demoFan] = await ethers.getSigners();

  const Ticket = await ethers.getContractFactory("FanPassTicket");
  const ticket = await Ticket.deploy(deployer.address);
  await ticket.waitForDeployment();

  const AccessBadge = await ethers.getContractFactory("FanPassSoulbound");
  const accessBadge = await AccessBadge.deploy(deployer.address);
  await accessBadge.waitForDeployment();

  const RedemptionRegistry =
    await ethers.getContractFactory("RedemptionRegistry");
  const redemptionRegistry = await RedemptionRegistry.deploy(deployer.address);
  await redemptionRegistry.waitForDeployment();

  const ticketTx = await ticket.mintTicketWithProof(
    demoFan.address,
    1001,
    ethers.id("ticket:local-demo:001"),
    ethers.id("ticket-type:general-admission"),
    ethers.id("policy:transferable:cap-1500:max-1"),
    ethers.id("metadata:local-demo-ticket"),
    true,
    1500,
    1,
    "ipfs://fanpass-local-demo-ticket",
  );
  await ticketTx.wait();

  const badgeTx = await accessBadge.mintLockedWithProof(
    demoFan.address,
    ethers.id("event:local-demo"),
    ethers.id("access-badge:verified-fan"),
    ethers.id("fan:local-demo"),
    ethers.id("metadata:local-demo-access-badge"),
    "ipfs://fanpass-local-demo-access-badge",
  );
  await badgeTx.wait();

  const redemptionTx = await redemptionRegistry.markRedeemedWithContext(
    await ticket.getAddress(),
    1,
    ethers.id("event:local-demo"),
    ethers.id("gate:A1"),
    ethers.id("credential:local-demo"),
    ethers.id("redemption:local-demo"),
  );
  await redemptionTx.wait();

  console.log(
    JSON.stringify(
      {
        ok: true,
        network: connection.networkName,
        deployer: shortenAddress(deployer.address),
        contracts: {
          fanPassTicket: shortenAddress(await ticket.getAddress()),
          fanPassSoulbound: shortenAddress(await accessBadge.getAddress()),
          redemptionRegistry: shortenAddress(
            await redemptionRegistry.getAddress(),
          ),
        },
        demo: {
          ticketTokenId: "1",
          accessBadgeTokenId: "1",
          redemptionRecorded: true,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function shortenAddress(value: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
