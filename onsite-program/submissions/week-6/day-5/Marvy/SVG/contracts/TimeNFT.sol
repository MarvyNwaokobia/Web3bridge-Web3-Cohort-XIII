// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract TimeNFT is ERC721, Ownable {
    using Strings for uint256;
    
    uint256 private _tokenIds;
    
    constructor() ERC721("Dynamic Time NFT", "TIMENFT") Ownable(msg.sender) {}
    
    function mint(address to) external onlyOwner returns (uint256) {
        _tokenIds++;
        uint256 tokenId = _tokenIds;
        _mint(to, tokenId);
        return tokenId;
    }
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        
        string memory svg = generateSVG();
        string memory metadata = generateMetadata(svg);
        
        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(metadata))
            )
        );
    }
    
    function generateSVG() internal view returns (string memory) {
        uint256 timestamp = block.timestamp;
        (uint256 hour, uint256 minute, uint256 second) = timestampToTime(timestamp);
        
        string memory gradientColor1 = getGradientColor1(hour);
        string memory gradientColor2 = getGradientColor2(hour);
        
        string memory timeString = string(abi.encodePacked(
            padZero(hour), ":", padZero(minute), ":", padZero(second)
        ));
        
        string memory dateString = generateDateString(timestamp);
        
        return string(abi.encodePacked(
            '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">',
            '<defs>',
            '<radialGradient id="bg" cx="50%" cy="50%" r="50%">',
            '<stop offset="0%" style="stop-color:', gradientColor1, ';stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:', gradientColor2, ';stop-opacity:1" />',
            '</radialGradient>',
            '<filter id="glow">',
            '<feGaussianBlur stdDeviation="3" result="coloredBlur"/>',
            '<feMerge>',
            '<feMergeNode in="coloredBlur"/>',
            '<feMergeNode in="SourceGraphic"/>',
            '</feMerge>',
            '</filter>',
            '</defs>',
            '<rect width="400" height="400" fill="url(#bg)"/>',
            
            '<circle cx="200" cy="200" r="180" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>',
            '<circle cx="200" cy="200" r="160" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>',
            
            generateClockMarkers(),
            
            generateClockHands(hour % 12, minute, second),
            
            '<rect x="120" y="280" width="160" height="50" rx="10" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>',
            '<text x="200" y="305" text-anchor="middle" font-family="monospace" font-size="24" font-weight="bold" fill="white" filter="url(#glow)">',
            timeString,
            '</text>',
            
            '<text x="200" y="350" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.8)">',
            dateString,
            '</text>',
            
            '<text x="200" y="370" text-anchor="middle" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.6)">',
            'Block: ', timestamp.toString(),
            '</text>',
            
            '</svg>'
        ));
    }
    
    function generateClockMarkers() internal pure returns (string memory) {
        string memory markers = "";
        
        for (uint256 i = 0; i < 12; i++) {
            uint256 angle = i * 30; 
            
            (int256 x1, int256 y1) = polarToCartesian(140, angle);
            (int256 x2, int256 y2) = polarToCartesian(155, angle);
            
            markers = string(abi.encodePacked(
                markers,
                '<line x1="', uint256(x1 + 200).toString(), '" y1="', uint256(y1 + 200).toString(), 
                '" x2="', uint256(x2 + 200).toString(), '" y2="', uint256(y2 + 200).toString(), 
                '" stroke="rgba(255,255,255,0.8)" stroke-width="3"/>'
            ));
        }
        
        for (uint256 i = 0; i < 60; i++) {
            if (i % 5 != 0) { 
                uint256 angle = i * 6; 
                (int256 x1, int256 y1) = polarToCartesian(150, angle);
                (int256 x2, int256 y2) = polarToCartesian(155, angle);
                
                markers = string(abi.encodePacked(
                    markers,
                    '<line x1="', uint256(x1 + 200).toString(), '" y1="', uint256(y1 + 200).toString(), 
                    '" x2="', uint256(x2 + 200).toString(), '" y2="', uint256(y2 + 200).toString(), 
                    '" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>'
                ));
            }
        }
        
        return markers;
    }
    
    function generateClockHands(uint256 hour, uint256 minute, uint256 second) internal pure returns (string memory) {
        uint256 secondAngle = (second * 6) % 360; 
        uint256 minuteAngle = (minute * 6 + second / 10) % 360; 
        uint256 hourAngle = (hour * 30 + minute / 2) % 360; 
        
        (int256 hx, int256 hy) = polarToCartesian(80, hourAngle);
        (int256 mx, int256 my) = polarToCartesian(120, minuteAngle);
        (int256 sx, int256 sy) = polarToCartesian(130, secondAngle);
        
        return string(abi.encodePacked(
            '<line x1="200" y1="200" x2="', uint256(hx + 200).toString(), '" y2="', uint256(hy + 200).toString(), 
            '" stroke="white" stroke-width="6" stroke-linecap="round" filter="url(#glow)"/>',
            
            '<line x1="200" y1="200" x2="', uint256(mx + 200).toString(), '" y2="', uint256(my + 200).toString(), 
            '" stroke="white" stroke-width="4" stroke-linecap="round" filter="url(#glow)"/>',
            
            '<line x1="200" y1="200" x2="', uint256(sx + 200).toString(), '" y2="', uint256(sy + 200).toString(), 
            '" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round"/>',
            
            '<circle cx="200" cy="200" r="8" fill="white" stroke="#333" stroke-width="2" filter="url(#glow)"/>'
        ));
    }
    
    function polarToCartesian(uint256 radius, uint256 angleInDegrees) internal pure returns (int256 x, int256 y) {
       
        int256 angleInRadians = int256(angleInDegrees * 174533) / 10000000;
        
        angleInRadians -= 1570796; 
        
        x = int256(radius) * cos(angleInRadians) / 10000000;
        y = int256(radius) * sin(angleInRadians) / 10000000;
    }
    
    function sin(int256 x) internal pure returns (int256) {
        while (x < 0) x += 62831853; 
        while (x > 62831853) x -= 62831853;
        
        int256 x2 = x * x / 10000000;
        int256 x3 = x2 * x / 10000000;
        int256 x5 = x3 * x2 / 10000000;
        
        return x - x3 / 6 + x5 / 120;
    }
    
    function cos(int256 x) internal pure returns (int256) {
        return sin(x + 15707963); 
    }
    
    function timestampToTime(uint256 timestamp) internal pure returns (uint256 hour, uint256 minute, uint256 second) {
        uint256 secondsInDay = timestamp % 86400; 
        hour = secondsInDay / 3600;
        minute = (secondsInDay % 3600) / 60;
        second = secondsInDay % 60;
    }
    
    function generateDateString(uint256 timestamp) internal pure returns (string memory) {
        uint256 daysSinceEpoch = timestamp / 86400;
        uint256 year = 1970 + (daysSinceEpoch / 365);
        uint256 month = ((daysSinceEpoch % 365) / 30) + 1;
        uint256 day = (daysSinceEpoch % 30) + 1;
        
        if (month > 12) month = 12;
        if (day > 31) day = 31;
        
        return string(abi.encodePacked(
            month.toString(), "/", day.toString(), "/", year.toString()
        ));
    }
    
    function getGradientColor1(uint256 hour) internal pure returns (string memory) {
        if (hour >= 6 && hour < 12) return "#87CEEB"; 
        if (hour >= 12 && hour < 18) return "#FFD700"; 
        if (hour >= 18 && hour < 22) return "#FF6347"; 
        return "#191970"; 
    }
    
    function getGradientColor2(uint256 hour) internal pure returns (string memory) {
        if (hour >= 6 && hour < 12) return "#98FB98"; 
        if (hour >= 12 && hour < 18) return "#FFA500"; 
        if (hour >= 18 && hour < 22) return "#8B0000"; 
        return "#000080"; 
    }    
    
    function padZero(uint256 value) internal pure returns (string memory) {
        if (value < 10) {
            return string(abi.encodePacked("0", value.toString()));
        }
        return value.toString();
    }
    
    function generateMetadata(string memory svg) internal view returns (string memory) {
        return string(abi.encodePacked(
            '{"name": "Dynamic Time NFT",',
            '"description": "A fully on-chain NFT that displays the current blockchain time",',
            '"attributes": [',
            '{"trait_type": "Type", "value": "Dynamic Time Display"},',
            '{"trait_type": "Timestamp", "value": "', block.timestamp.toString(), '"},',
            '{"trait_type": "Updated", "value": "Real-time"}',
            '],',
            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '"}'
        ));
    }
    
    function totalSupply() external view returns (uint256) {
        return _tokenIds;
    }
}