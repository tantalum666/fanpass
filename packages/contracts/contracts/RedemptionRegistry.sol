// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RedemptionRegistry is Ownable {
    struct RedemptionRecord {
        bool redeemed;
        bytes32 eventHash;
        bytes32 gateHash;
        bytes32 credentialHash;
        bytes32 redemptionHash;
        uint256 redeemedAt;
    }

    mapping(address => mapping(uint256 => bool)) public redeemed;
    mapping(address => mapping(uint256 => RedemptionRecord)) public records;

    event Redeemed(address indexed ticketContract, uint256 indexed tokenId, bytes32 redemptionHash);
    event RedemptionRecorded(
        address indexed ticketContract,
        uint256 indexed tokenId,
        bytes32 eventHash,
        bytes32 gateHash,
        bytes32 credentialHash,
        bytes32 redemptionHash
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    function markRedeemed(address ticketContract, uint256 tokenId, bytes32 redemptionHash) external onlyOwner {
        _markRedeemed(ticketContract, tokenId, bytes32(0), bytes32(0), bytes32(0), redemptionHash);
    }

    function markRedeemedWithContext(
        address ticketContract,
        uint256 tokenId,
        bytes32 eventHash,
        bytes32 gateHash,
        bytes32 credentialHash,
        bytes32 redemptionHash
    ) external onlyOwner {
        require(eventHash != bytes32(0), "Event hash is required");
        require(credentialHash != bytes32(0), "Credential hash is required");
        _markRedeemed(ticketContract, tokenId, eventHash, gateHash, credentialHash, redemptionHash);
    }

    function _markRedeemed(
        address ticketContract,
        uint256 tokenId,
        bytes32 eventHash,
        bytes32 gateHash,
        bytes32 credentialHash,
        bytes32 redemptionHash
    ) private {
        require(ticketContract != address(0), "Ticket contract is required");
        require(!redeemed[ticketContract][tokenId], "Ticket already redeemed");
        redeemed[ticketContract][tokenId] = true;
        records[ticketContract][tokenId] = RedemptionRecord(
            true,
            eventHash,
            gateHash,
            credentialHash,
            redemptionHash,
            block.timestamp
        );
        emit Redeemed(ticketContract, tokenId, redemptionHash);
        emit RedemptionRecorded(ticketContract, tokenId, eventHash, gateHash, credentialHash, redemptionHash);
    }
}
