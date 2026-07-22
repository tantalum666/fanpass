import { expect } from "chai";
import hre from "hardhat";

import { deployFanPassStagingContracts } from "../scripts/staging-deployment.js";

const connection = await hre.network.create();
const { ethers } = connection;

describe("staging contract migration", () => {
  it("deploys all contracts directly to the sponsor without demo mutations", async () => {
    const [temporaryDeployer, sponsor] = await ethers.getSigners();
    const result = await deployFanPassStagingContracts({
      sponsorAddress: sponsor.address,
      ticketFactory: await ethers.getContractFactory(
        "FanPassTicket",
        temporaryDeployer,
      ),
      soulboundFactory: await ethers.getContractFactory(
        "FanPassSoulbound",
        temporaryDeployer,
      ),
      redemptionRegistryFactory: await ethers.getContractFactory(
        "RedemptionRegistry",
        temporaryDeployer,
      ),
    });

    const ticket = await ethers.getContractAt(
      "FanPassTicket",
      result.contracts.fanPassTicket,
    );
    const soulbound = await ethers.getContractAt(
      "FanPassSoulbound",
      result.contracts.fanPassSoulbound,
    );
    const registry = await ethers.getContractAt(
      "RedemptionRegistry",
      result.contracts.redemptionRegistry,
    );

    expect(await ticket.owner()).to.equal(sponsor.address);
    expect(await soulbound.owner()).to.equal(sponsor.address);
    expect(await registry.owner()).to.equal(sponsor.address);
    expect(
      await ticket.tokenIdByTicketIdHash(ethers.id("no-demo-mint")),
    ).to.equal(0);
    await expect(ticket.ownerOf(1)).to.be.revertedWithCustomError(
      ticket,
      "ERC721NonexistentToken",
    );
    await expect(soulbound.ownerOf(1)).to.be.revertedWithCustomError(
      soulbound,
      "ERC721NonexistentToken",
    );
    expect(await registry.redeemed(result.contracts.fanPassTicket, 1)).to.equal(
      false,
    );
  });
});
