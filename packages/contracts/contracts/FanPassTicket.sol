// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FanPassTicket is ERC721, Ownable {
    enum TicketState {
        Minted,
        Redeemed,
        Cancelled,
        Refunded
    }

    struct TicketPolicy {
        bool transferable;
        uint256 resaleCap;
        uint256 maxTransferCount;
    }

    struct TicketProof {
        bytes32 ticketIdHash;
        bytes32 ticketTypeHash;
        bytes32 policyHash;
        bytes32 metadataHash;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => uint256) public eventIds;
    mapping(uint256 => TicketPolicy) public policies;
    mapping(uint256 => TicketProof) public proofs;
    mapping(uint256 => TicketState) public states;
    mapping(uint256 => uint256) public transferCounts;
    mapping(uint256 => string) private _tokenUris;
    mapping(bytes32 => uint256) public tokenIdByTicketIdHash;

    event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed owner);
    event TicketRedeemed(uint256 indexed tokenId, uint256 indexed eventId);
    event TicketCancelled(uint256 indexed tokenId, uint256 indexed eventId);
    event TicketRefunded(uint256 indexed tokenId, uint256 indexed eventId);
    event TicketTransferSynced(uint256 indexed tokenId, address indexed from, address indexed to);
    event TicketProofUpdated(
        uint256 indexed tokenId,
        bytes32 ticketIdHash,
        bytes32 ticketTypeHash,
        bytes32 policyHash,
        bytes32 metadataHash
    );

    constructor(address initialOwner) ERC721("FanPass Ticket", "FPTIX") Ownable(initialOwner) {}

    function mintTicket(
        address to,
        uint256 eventId,
        bool transferable,
        uint256 resaleCap,
        uint256 maxTransferCount,
        string calldata metadataUri
    ) external onlyOwner returns (uint256 tokenId) {
        return _mintTicket(
            to,
            eventId,
            TicketProof(bytes32(0), bytes32(0), bytes32(0), bytes32(0)),
            transferable,
            resaleCap,
            maxTransferCount,
            metadataUri
        );
    }

    function mintTicketWithProof(
        address to,
        uint256 eventId,
        bytes32 ticketIdHash,
        bytes32 ticketTypeHash,
        bytes32 policyHash,
        bytes32 metadataHash,
        bool transferable,
        uint256 resaleCap,
        uint256 maxTransferCount,
        string calldata metadataUri
    ) external onlyOwner returns (uint256 tokenId) {
        require(ticketIdHash != bytes32(0), "Ticket id hash is required");
        require(policyHash != bytes32(0), "Policy hash is required");
        require(tokenIdByTicketIdHash[ticketIdHash] == 0, "Ticket already minted");
        uint256 reservedTokenId = _nextTokenId;
        tokenIdByTicketIdHash[ticketIdHash] = reservedTokenId;
        tokenId = _mintTicket(
            to,
            eventId,
            TicketProof(ticketIdHash, ticketTypeHash, policyHash, metadataHash),
            transferable,
            resaleCap,
            maxTransferCount,
            metadataUri
        );
        assert(tokenId == reservedTokenId);
    }

    function _mintTicket(
        address to,
        uint256 eventId,
        TicketProof memory proof,
        bool transferable,
        uint256 resaleCap,
        uint256 maxTransferCount,
        string calldata metadataUri
    ) private returns (uint256 tokenId) {
        require(to != address(0), "Owner address is required");
        tokenId = _nextTokenId++;
        eventIds[tokenId] = eventId;
        policies[tokenId] = TicketPolicy(transferable, resaleCap, maxTransferCount);
        proofs[tokenId] = proof;
        states[tokenId] = TicketState.Minted;
        _tokenUris[tokenId] = metadataUri;
        _safeMint(to, tokenId);
        emit TicketMinted(tokenId, eventId, to);
        if (
            proof.ticketIdHash != bytes32(0) || proof.ticketTypeHash != bytes32(0) || proof.policyHash != bytes32(0)
                || proof.metadataHash != bytes32(0)
        ) {
            emit TicketProofUpdated(
                tokenId,
                proof.ticketIdHash,
                proof.ticketTypeHash,
                proof.policyHash,
                proof.metadataHash
            );
        }
    }

    function redeem(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        require(states[tokenId] == TicketState.Minted, "Ticket is not redeemable");
        states[tokenId] = TicketState.Redeemed;
        emit TicketRedeemed(tokenId, eventIds[tokenId]);
    }

    function cancel(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        require(states[tokenId] == TicketState.Minted, "Ticket is not cancellable");
        states[tokenId] = TicketState.Cancelled;
        emit TicketCancelled(tokenId, eventIds[tokenId]);
    }

    function refund(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        require(states[tokenId] == TicketState.Minted, "Ticket is not refundable");
        states[tokenId] = TicketState.Refunded;
        emit TicketRefunded(tokenId, eventIds[tokenId]);
    }

    function syncTicketTransfer(address from, address to, uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        _transfer(from, to, tokenId);
        emit TicketTransferSynced(tokenId, from, to);
    }

    function updateProof(
        uint256 tokenId,
        bytes32 ticketIdHash,
        bytes32 ticketTypeHash,
        bytes32 policyHash,
        bytes32 metadataHash
    ) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        require(ticketIdHash != bytes32(0), "Ticket id hash is required");
        require(policyHash != bytes32(0), "Policy hash is required");
        bytes32 currentTicketIdHash = proofs[tokenId].ticketIdHash;
        if (currentTicketIdHash == bytes32(0)) {
            require(tokenIdByTicketIdHash[ticketIdHash] == 0, "Ticket already minted");
            tokenIdByTicketIdHash[ticketIdHash] = tokenId;
        } else {
            require(currentTicketIdHash == ticketIdHash, "Ticket id hash is immutable");
            require(tokenIdByTicketIdHash[ticketIdHash] == tokenId, "Ticket id hash mapping mismatch");
        }
        proofs[tokenId] = TicketProof(ticketIdHash, ticketTypeHash, policyHash, metadataHash);
        emit TicketProofUpdated(tokenId, ticketIdHash, ticketTypeHash, policyHash, metadataHash);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        return _tokenUris[tokenId];
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        address currentOwner = _ownerOf(tokenId);
        if (currentOwner != address(0) && to != address(0)) {
            require(_msgSender() == owner(), "Use FanPass settlement");
            TicketPolicy memory policy = policies[tokenId];
            require(policy.transferable, "Ticket is non-transferable");
            require(states[tokenId] == TicketState.Minted, "Ticket is not transferable");
            require(transferCounts[tokenId] < policy.maxTransferCount, "Transfer count exceeded");
        }

        from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) {
            transferCounts[tokenId] += 1;
        }
    }
}
