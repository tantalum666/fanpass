import { expect } from "chai";
import { ethers } from "hardhat";

describe("FanPassTicket", () => {
  it("mints, transfers within policy, and redeems", async () => {
    const [owner, fan, buyer] = await ethers.getSigners();
    const Ticket = await ethers.getContractFactory("FanPassTicket");
    const ticket = await Ticket.deploy(owner.address);

    await ticket.mintTicket(fan.address, 1001, true, 1500, 1, "ipfs://ticket");
    expect(await ticket.ownerOf(1)).to.equal(fan.address);

    await ticket.connect(fan).transferFrom(fan.address, buyer.address, 1);
    expect(await ticket.ownerOf(1)).to.equal(buyer.address);

    await expect(ticket.connect(buyer).transferFrom(buyer.address, fan.address, 1)).to.be.revertedWith(
      "Transfer count exceeded"
    );

    await ticket.redeem(1);
    await expect(ticket.connect(buyer).transferFrom(buyer.address, fan.address, 1)).to.be.revertedWith(
      "Ticket is not transferable"
    );
  });
});

