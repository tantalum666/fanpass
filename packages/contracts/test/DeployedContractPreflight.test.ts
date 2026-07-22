import { expect } from "chai";
import hre from "hardhat";

import {
  runDeployedContractsPreflight,
  type DeployedContractArtifact,
} from "../scripts/deployed-contract-preflight.js";

const connection = await hre.network.create();
const { ethers } = connection;

describe("deployed-contract preflight", () => {
  async function fixture() {
    const [deployer, sponsor, fan, outsider] = await ethers.getSigners();
    const Ticket = await ethers.getContractFactory("FanPassTicket", deployer);
    const Soulbound = await ethers.getContractFactory(
      "FanPassSoulbound",
      deployer,
    );
    const Registry = await ethers.getContractFactory(
      "RedemptionRegistry",
      deployer,
    );
    const ticket = await Ticket.deploy(sponsor.address);
    const soulbound = await Soulbound.deploy(sponsor.address);
    const registry = await Registry.deploy(sponsor.address);
    await Promise.all([
      ticket.waitForDeployment(),
      soulbound.waitForDeployment(),
      registry.waitForDeployment(),
    ]);

    return {
      sponsor,
      fan,
      outsider,
      ticket,
      options: {
        provider: ethers.provider,
        mode: "BASE" as const,
        expectedChainId: 31337n,
        sponsorAddress: sponsor.address,
        addresses: {
          fanPassTicket: await ticket.getAddress(),
          fanPassSoulbound: await soulbound.getAddress(),
          redemptionRegistry: await registry.getAddress(),
        },
        artifacts: {
          fanPassTicket: (await hre.artifacts.readArtifact(
            "FanPassTicket",
          )) as DeployedContractArtifact,
          fanPassSoulbound: (await hre.artifacts.readArtifact(
            "FanPassSoulbound",
          )) as DeployedContractArtifact,
          redemptionRegistry: (await hre.artifacts.readArtifact(
            "RedemptionRegistry",
          )) as DeployedContractArtifact,
        },
      },
    };
  }

  it("verifies chain, exact runtime bytecode, owner, critical ABI, and ticket hash getter", async () => {
    const { options, sponsor } = await fixture();
    const result = await runDeployedContractsPreflight(options);

    expect(result.ok).to.equal(true);
    expect(result.chainId).to.equal("31337");
    expect(result.expectedOwner).to.equal(sponsor.address);
    expect(result.ticketIdGetter).to.deep.equal({
      probeHash: ethers.ZeroHash,
      tokenId: "0",
    });
    expect(result.directTransferPolicy).to.deep.equal({
      status: "NOT_RUN_NO_PROBE",
    });
    expect(result.contracts.fanPassTicket.requiredAbi).to.include(
      "tokenIdByTicketIdHash(bytes32)",
    );
  });

  it("uses only read operations and never invokes a transaction broadcast", async () => {
    const { options } = await fixture();
    const provider = options.provider as any;
    const originalSend = provider.send;
    const originalBroadcastTransaction = provider.broadcastTransaction;
    const rpcMethods: string[] = [];
    let broadcasts = 0;
    provider.send = function (method: string, parameters: unknown[]) {
      rpcMethods.push(method);
      return originalSend.call(this, method, parameters);
    };
    provider.broadcastTransaction = async function () {
      broadcasts += 1;
      throw new Error("Preflight attempted a transaction broadcast");
    };
    try {
      await runDeployedContractsPreflight(options);
    } finally {
      provider.send = originalSend;
      provider.broadcastTransaction = originalBroadcastTransaction;
    }

    expect(broadcasts).to.equal(0);
    expect(
      rpcMethods.filter((method) => /^eth_send/i.test(method)),
    ).to.deep.equal([]);
  });

  it("uses read-only eth_call to prove direct holder transfer stays blocked", async () => {
    const { options, sponsor, fan, ticket } = await fixture();
    const ticketIdHash = ethers.id("ticket:staging-policy-probe");
    await (ticket.connect(sponsor) as any).mintTicketWithProof(
      fan.address,
      1001,
      ticketIdHash,
      ethers.id("ticket-type:ga"),
      ethers.id("policy:controlled-resale"),
      ethers.id("metadata:probe"),
      true,
      1500,
      1,
      "ipfs://probe",
    );

    const result = await runDeployedContractsPreflight({
      ...options,
      mode: "CUTOVER",
      directTransferProbeTicketIdHash: ticketIdHash,
    });

    expect(result.directTransferPolicy).to.deep.equal({
      status: "BLOCKED_AS_REQUIRED",
      ticketIdHash,
      tokenId: "1",
      revertReason: "Use FanPass settlement",
      entrypoints: [
        "transferFrom(address,address,uint256)",
        "safeTransferFrom(address,address,uint256)",
        "safeTransferFrom(address,address,uint256,bytes)",
      ],
    });
    expect(await ticket.ownerOf(1)).to.equal(fan.address);
    expect(await ticket.transferCounts(1)).to.equal(0);
  });

  it("fails closed on chain, owner, runtime bytecode, and missing probe token mismatches", async () => {
    const { options, outsider } = await fixture();

    await expectPromiseToRejectWith(
      runDeployedContractsPreflight({
        ...options,
        expectedChainId: 11155111n,
      }),
      "expected 11155111",
    );
    await expectPromiseToRejectWith(
      runDeployedContractsPreflight({
        ...options,
        sponsorAddress: outsider.address,
      }),
      "owner mismatch",
    );
    await expectPromiseToRejectWith(
      runDeployedContractsPreflight({
        ...options,
        artifacts: {
          ...options.artifacts,
          fanPassTicket: {
            ...options.artifacts.fanPassTicket,
            deployedBytecode: "0x6000",
          },
        },
      }),
      "runtime bytecode",
    );
    await expectPromiseToRejectWith(
      runDeployedContractsPreflight({
        ...options,
        artifacts: {
          ...options.artifacts,
          fanPassTicket: {
            ...options.artifacts.fanPassTicket,
            abi: (options.artifacts.fanPassTicket.abi as any[]).filter(
              (entry) => entry.name !== "tokenIdByTicketIdHash",
            ),
          },
        },
      }),
      "missing required ABI tokenIdByTicketIdHash",
    );
    await expectPromiseToRejectWith(
      runDeployedContractsPreflight({
        ...options,
        mode: "CUTOVER",
        directTransferProbeTicketIdHash: ethers.id("ticket:not-minted"),
      }),
      "is not minted",
    );
    await expectPromiseToRejectWith(
      runDeployedContractsPreflight({
        ...options,
        mode: "CUTOVER",
      }),
      "requires an existing policy-probe",
    );
  });
});

async function expectPromiseToRejectWith(
  promise: Promise<unknown>,
  message: string,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).to.be.instanceOf(Error);
    expect((error as Error).message).to.include(message);
    return;
  }
  throw new Error(`Expected promise to reject with ${message}`);
}
