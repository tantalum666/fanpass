// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}

contract FanPassSoulbound is ERC721, IERC5192, Ownable {
    struct BadgeProof {
        bytes32 eventIdHash;
        bytes32 badgeTypeHash;
        bytes32 subjectHash;
        bytes32 metadataHash;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => BadgeProof) public proofs;
    mapping(uint256 => bool) public revoked;
    mapping(uint256 => string) private _tokenUris;

    event AccessBadgeMinted(uint256 indexed tokenId, address indexed owner, bytes32 badgeTypeHash);
    event AccessBadgeRevoked(uint256 indexed tokenId);

    constructor(address initialOwner) ERC721("FanPass Access", "FPACC") Ownable(initialOwner) {}

    function mintLocked(address to, string calldata metadataUri) external onlyOwner returns (uint256 tokenId) {
        return _mintLocked(to, BadgeProof(bytes32(0), bytes32(0), bytes32(0), bytes32(0)), metadataUri);
    }

    function mintLockedWithProof(
        address to,
        bytes32 eventIdHash,
        bytes32 badgeTypeHash,
        bytes32 subjectHash,
        bytes32 metadataHash,
        string calldata metadataUri
    ) external onlyOwner returns (uint256 tokenId) {
        require(badgeTypeHash != bytes32(0), "Badge type hash is required");
        require(subjectHash != bytes32(0), "Subject hash is required");
        return _mintLocked(to, BadgeProof(eventIdHash, badgeTypeHash, subjectHash, metadataHash), metadataUri);
    }

    function _mintLocked(
        address to,
        BadgeProof memory proof,
        string calldata metadataUri
    ) private returns (uint256 tokenId) {
        require(to != address(0), "Owner address is required");
        tokenId = _nextTokenId++;
        proofs[tokenId] = proof;
        _tokenUris[tokenId] = metadataUri;
        _safeMint(to, tokenId);
        emit Locked(tokenId);
        emit AccessBadgeMinted(tokenId, to, proof.badgeTypeHash);
    }

    function revoke(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(!revoked[tokenId], "Token already revoked");
        revoked[tokenId] = true;
        emit AccessBadgeRevoked(tokenId);
    }

    function isActive(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return !revoked[tokenId];
    }

    function locked(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return true;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _tokenUris[tokenId];
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        require(from == address(0) || to == address(0), "Soulbound token cannot be transferred");
    }
}
