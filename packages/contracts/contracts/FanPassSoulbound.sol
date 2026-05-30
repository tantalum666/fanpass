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
    uint256 private _nextTokenId = 1;
    mapping(uint256 => string) private _tokenUris;

    constructor(address initialOwner) ERC721("FanPass Access", "FPACC") Ownable(initialOwner) {}

    function mintLocked(address to, string calldata metadataUri) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _tokenUris[tokenId] = metadataUri;
        _safeMint(to, tokenId);
        emit Locked(tokenId);
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

