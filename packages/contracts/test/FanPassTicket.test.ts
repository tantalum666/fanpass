import { expect } from "chai";
import hre from "hardhat";

const { ethers } = await hre.network.create();

describe("FanPassTicket", () => {
  const ticketIdHash = ethers.id("ticket:demo:001");
  const ticketTypeHash = ethers.id("ticket-type:general-admission");
  const policyHash = ethers.id("policy:transferable:cap-1500:max-1");
  const metadataHash = ethers.id("metadata:demo-ticket");

  it("blocks holder transfers, syncs a settlement transfer, and redeems", async () => {
    const [owner, fan, buyer] = await ethers.getSigners();
    const Ticket = await ethers.getContractFactory("FanPassTicket");
    const ticket = await Ticket.deploy(owner.address);

    await ticket.mintTicket(fan.address, 1001, true, 1500, 1, "ipfs://ticket");
    expect(await ticket.ownerOf(1)).to.equal(fan.address);

    await expect(
      (ticket.connect(fan) as any).transferFrom(fan.address, buyer.address, 1),
    ).to.be.revertedWith("Use FanPass settlement");
    expect(await ticket.ownerOf(1)).to.equal(fan.address);
    expect(await ticket.transferCounts(1)).to.equal(0);

    await ticket.syncTicketTransfer(fan.address, buyer.address, 1);
    expect(await ticket.ownerOf(1)).to.equal(buyer.address);
    expect(await ticket.transferCounts(1)).to.equal(1);

    await expect(
      ticket.syncTicketTransfer(buyer.address, fan.address, 1),
    ).to.be.revertedWith("Transfer count exceeded");

    await ticket.redeem(1);
    await expect(
      ticket.syncTicketTransfer(buyer.address, fan.address, 1),
    ).to.be.revertedWith("Ticket is not transferable");
  });

  it("blocks approved operators and both safe-transfer entry points", async () => {
    const [owner, fan, buyer, operator] = await ethers.getSigners();
    const Ticket = await ethers.getContractFactory("FanPassTicket");
    const ticket = await Ticket.deploy(owner.address);

    await ticket.mintTicket(fan.address, 1001, true, 1500, 2, "ipfs://ticket");
    await (ticket.connect(fan) as any).approve(operator.address, 1);

    await expect(
      (ticket.connect(operator) as any).transferFrom(
        fan.address,
        buyer.address,
        1,
      ),
    ).to.be.revertedWith("Use FanPass settlement");
    await expect(
      (ticket.connect(fan) as any)["safeTransferFrom(address,address,uint256)"](
        fan.address,
        buyer.address,
        1,
      ),
    ).to.be.revertedWith("Use FanPass settlement");
    await expect(
      (ticket.connect(operator) as any)[
        "safeTransferFrom(address,address,uint256,bytes)"
      ](fan.address, buyer.address, 1, "0x"),
    ).to.be.revertedWith("Use FanPass settlement");
    expect(await ticket.ownerOf(1)).to.equal(fan.address);
    expect(await ticket.transferCounts(1)).to.equal(0);
  });

  it("stores safe proof hashes without requiring personal data on-chain", async () => {
    const [owner, fan] = await ethers.getSigners();
    const Ticket = await ethers.getContractFactory("FanPassTicket");
    const ticket = await Ticket.deploy(owner.address);

    await expect(
      ticket.mintTicketWithProof(
        fan.address,
        1001,
        ticketIdHash,
        ticketTypeHash,
        policyHash,
        metadataHash,
        true,
        1500,
        2,
        "ipfs://ticket-proof",
      ),
    )
      .to.emit(ticket, "TicketProofUpdated")
      .withArgs(1, ticketIdHash, ticketTypeHash, policyHash, metadataHash);

    const proof = await ticket.proofs(1);
    expect(proof.ticketIdHash).to.equal(ticketIdHash);
    expect(proof.ticketTypeHash).to.equal(ticketTypeHash);
    expect(proof.policyHash).to.equal(policyHash);
    expect(proof.metadataHash).to.equal(metadataHash);

    const updatedMetadataHash = ethers.id("metadata:demo-ticket:v2");
    await ticket.updateProof(
      1,
      ticketIdHash,
      ticketTypeHash,
      policyHash,
      updatedMetadataHash,
    );
    expect((await ticket.proofs(1)).metadataHash).to.equal(updatedMetadataHash);

    await expect(
      (ticket.connect(fan) as any).updateProof(
        1,
        ticketIdHash,
        ticketTypeHash,
        policyHash,
        updatedMetadataHash,
      ),
    ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
  });

  it("allows only one token for each logical ticket id hash", async () => {
    const [owner, fan, buyer] = await ethers.getSigners();
    const Ticket = await ethers.getContractFactory("FanPassTicket");
    const ticket = await Ticket.deploy(owner.address);

    await ticket.mintTicketWithProof(
      fan.address,
      1001,
      ticketIdHash,
      ticketTypeHash,
      policyHash,
      metadataHash,
      true,
      1500,
      2,
      "ipfs://ticket-proof",
    );

    expect(await ticket.tokenIdByTicketIdHash(ticketIdHash)).to.equal(1);
    await expect(
      ticket.mintTicketWithProof(
        buyer.address,
        1001,
        ticketIdHash,
        ticketTypeHash,
        policyHash,
        metadataHash,
        true,
        1500,
        2,
        "ipfs://ticket-proof-retry",
      ),
    ).to.be.revertedWith("Ticket already minted");
    expect(await ticket.ownerOf(1)).to.equal(fan.address);
  });

  it("does not let proof updates remap a logical ticket hash", async () => {
    const [owner, fan] = await ethers.getSigners();
    const Ticket = await ethers.getContractFactory("FanPassTicket");
    const ticket = await Ticket.deploy(owner.address);
    const secondTicketIdHash = ethers.id("ticket:demo:002");

    await ticket.mintTicket(fan.address, 1001, true, 1500, 2, "ipfs://legacy");
    await ticket.updateProof(
      1,
      ticketIdHash,
      ticketTypeHash,
      policyHash,
      metadataHash,
    );
    expect(await ticket.tokenIdByTicketIdHash(ticketIdHash)).to.equal(1);

    await expect(
      ticket.updateProof(
        1,
        secondTicketIdHash,
        ticketTypeHash,
        policyHash,
        metadataHash,
      ),
    ).to.be.revertedWith("Ticket id hash is immutable");
  });

  it("blocks non-transferable, cancelled, refunded, and redeemed tickets from transfer", async () => {
    const [owner, fan, buyer] = await ethers.getSigners();
    const Ticket = await ethers.getContractFactory("FanPassTicket");
    const ticket = await Ticket.deploy(owner.address);

    await ticket.mintTicket(
      fan.address,
      1001,
      false,
      0,
      0,
      "ipfs://non-transferable",
    );
    await expect(
      ticket.syncTicketTransfer(fan.address, buyer.address, 1),
    ).to.be.revertedWith("Ticket is non-transferable");

    await ticket.mintTicket(fan.address, 1001, true, 0, 1, "ipfs://cancelled");
    await ticket.cancel(2);
    await expect(
      ticket.syncTicketTransfer(fan.address, buyer.address, 2),
    ).to.be.revertedWith("Ticket is not transferable");

    await ticket.mintTicket(fan.address, 1001, true, 0, 1, "ipfs://refunded");
    await ticket.refund(3);
    await expect(
      ticket.syncTicketTransfer(fan.address, buyer.address, 3),
    ).to.be.revertedWith("Ticket is not transferable");

    await ticket.mintTicket(fan.address, 1001, true, 0, 1, "ipfs://redeemed");
    await ticket.redeem(4);
    await expect(ticket.refund(2)).to.be.revertedWith(
      "Ticket is not refundable",
    );
    await expect(ticket.cancel(3)).to.be.revertedWith(
      "Ticket is not cancellable",
    );
    await expect(ticket.refund(4)).to.be.revertedWith(
      "Ticket is not refundable",
    );
    await expect(ticket.cancel(4)).to.be.revertedWith(
      "Ticket is not cancellable",
    );
  });

  it("lets the owner sync backend-authorized transfers while preserving ticket policy", async () => {
    const [owner, fan, buyer, outsider] = await ethers.getSigners();
    const Ticket = await ethers.getContractFactory("FanPassTicket");
    const ticket = await Ticket.deploy(owner.address);

    await ticket.mintTicketWithProof(
      fan.address,
      1001,
      ticketIdHash,
      ticketTypeHash,
      policyHash,
      metadataHash,
      true,
      1500,
      1,
      "ipfs://ticket-proof",
    );

    await expect(ticket.syncTicketTransfer(fan.address, buyer.address, 1))
      .to.emit(ticket, "TicketTransferSynced")
      .withArgs(1, fan.address, buyer.address);
    expect(await ticket.ownerOf(1)).to.equal(buyer.address);

    await expect(
      ticket.syncTicketTransfer(buyer.address, fan.address, 1),
    ).to.be.revertedWith("Transfer count exceeded");

    await expect(
      (ticket.connect(outsider) as any).syncTicketTransfer(
        buyer.address,
        outsider.address,
        1,
      ),
    ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
  });
});

describe("FanPassSoulbound", () => {
  it("mints locked access badges, stores proof hashes, and blocks transfer", async () => {
    const [owner, fan, buyer] = await ethers.getSigners();
    const AccessBadge = await ethers.getContractFactory("FanPassSoulbound");
    const badge = await AccessBadge.deploy(owner.address);
    const eventIdHash = ethers.id("event:aurora-nights");
    const badgeTypeHash = ethers.id("access-badge:verified-fan");
    const subjectHash = ethers.id("fan:user:demo-safe");
    const metadataHash = ethers.id("metadata:access-badge");

    await expect(
      badge.mintLockedWithProof(
        fan.address,
        eventIdHash,
        badgeTypeHash,
        subjectHash,
        metadataHash,
        "ipfs://badge",
      ),
    )
      .to.emit(badge, "AccessBadgeMinted")
      .withArgs(1, fan.address, badgeTypeHash);

    expect(await badge.locked(1)).to.equal(true);
    expect(await badge.isActive(1)).to.equal(true);
    expect((await badge.proofs(1)).subjectHash).to.equal(subjectHash);

    await expect(
      (badge.connect(fan) as any).transferFrom(fan.address, buyer.address, 1),
    ).to.be.revertedWith("Soulbound token cannot be transferred");

    await badge.revoke(1);
    expect(await badge.isActive(1)).to.equal(false);
    await expect(badge.revoke(1)).to.be.revertedWith("Token already revoked");
  });
});

describe("RedemptionRegistry", () => {
  it("records redemption context and rejects duplicate redemption", async () => {
    const [owner, fan] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("RedemptionRegistry");
    const registry = await Registry.deploy(owner.address);
    const Ticket = await ethers.getContractFactory("FanPassTicket");
    const ticket = await Ticket.deploy(owner.address);
    const eventHash = ethers.id("event:aurora-nights");
    const gateHash = ethers.id("gate:A1");
    const credentialHash = ethers.id("credential:short-lived-demo");
    const redemptionHash = ethers.id("redemption:accepted-demo");

    await ticket.mintTicket(fan.address, 1001, true, 0, 1, "ipfs://ticket");

    await expect(
      registry.markRedeemedWithContext(
        ticket.getAddress(),
        1,
        eventHash,
        gateHash,
        credentialHash,
        redemptionHash,
      ),
    )
      .to.emit(registry, "RedemptionRecorded")
      .withArgs(
        await ticket.getAddress(),
        1,
        eventHash,
        gateHash,
        credentialHash,
        redemptionHash,
      );

    const record = await registry.records(await ticket.getAddress(), 1);
    expect(record.redeemed).to.equal(true);
    expect(record.eventHash).to.equal(eventHash);
    expect(record.gateHash).to.equal(gateHash);
    expect(record.credentialHash).to.equal(credentialHash);

    await expect(
      registry.markRedeemedWithContext(
        await ticket.getAddress(),
        1,
        eventHash,
        gateHash,
        credentialHash,
        redemptionHash,
      ),
    ).to.be.revertedWith("Ticket already redeemed");
  });
});
