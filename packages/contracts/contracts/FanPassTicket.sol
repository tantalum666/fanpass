// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FanPassTicket is ERC721, Ownable {
    enum TicketState {
        Minted,
        Redeemed,
        Cancelled
    }

    struct TicketPolicy {
        bool transferable;
        uint256 resaleCap;
        uint256 maxTransferCount;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => uint256) public eventIds;
    mapping(uint256 => TicketPolicy) public policies;
    mapping(uint256 => TicketState) public states;
    mapping(uint256 => uint256) public transferCounts;
    mapping(uint256 => string) private _tokenUris;

    event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed owner);
    event TicketRedeemed(uint256 indexed tokenId, uint256 indexed eventId);
    event TicketCancelled(uint256 indexed tokenId, uint256 indexed eventId);

    constructor(address initialOwner) ERC721("FanPass Ticket", "FPTIX") Ownable(initialOwner) {}

    function mintTicket(
        address to,
        uint256 eventId,
        bool transferable,
        uint256 resaleCap,
        uint256 maxTransferCount,
        string calldata metadataUri
    ) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        eventIds[tokenId] = eventId;
        policies[tokenId] = TicketPolicy(transferable, resaleCap, maxTransferCount);
        states[tokenId] = TicketState.Minted;
        _tokenUris[tokenId] = metadataUri;
        _safeMint(to, tokenId);
        emit TicketMinted(tokenId, eventId, to);
    }

    function redeem(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        require(states[tokenId] == TicketState.Minted, "Ticket is not redeemable");
        states[tokenId] = TicketState.Redeemed;
        emit TicketRedeemed(tokenId, eventIds[tokenId]);
    }

    function cancel(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        require(states[tokenId] != TicketState.Redeemed, "Redeemed ticket cannot be cancelled");
        states[tokenId] = TicketState.Cancelled;
        emit TicketCancelled(tokenId, eventIds[tokenId]);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        return _tokenUris[tokenId];
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) {
            TicketPolicy memory policy = policies[tokenId];
            require(policy.transferable, "Ticket is non-transferable");
            require(states[tokenId] == TicketState.Minted, "Ticket is not transferable");
            require(transferCounts[tokenId] < policy.maxTransferCount, "Transfer count exceeded");
            transferCounts[tokenId] += 1;
        }
    }
}

