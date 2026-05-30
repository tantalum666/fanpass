// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RedemptionRegistry is Ownable {
    mapping(address => mapping(uint256 => bool)) public redeemed;

    event Redeemed(address indexed ticketContract, uint256 indexed tokenId, bytes32 redemptionHash);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function markRedeemed(address ticketContract, uint256 tokenId, bytes32 redemptionHash) external onlyOwner {
        require(!redeemed[ticketContract][tokenId], "Ticket already redeemed");
        redeemed[ticketContract][tokenId] = true;
        emit Redeemed(ticketContract, tokenId, redemptionHash);
    }
}

