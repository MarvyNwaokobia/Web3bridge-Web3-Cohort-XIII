// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/UniswapPermitSwap.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying from address:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Balance:", deployer.balance / 1e18, "ETH");

        address uniswapRouter = getUniswapRouter();
        console.log("Using Uniswap Router:", uniswapRouter);

        vm.startBroadcast(deployerPrivateKey);
        
        UniswapPermitSwap permitSwap = new UniswapPermitSwap(uniswapRouter);
        
        vm.stopBroadcast();

        console.log("=================================");
        console.log("UniswapPermitSwap deployed at:", address(permitSwap));
        console.log("Domain Separator:", vm.toString(permitSwap.DOMAIN_SEPARATOR()));
        console.log("=================================");

        require(address(permitSwap) != address(0), "Deployment failed");
        require(address(permitSwap.uniswapRouter()) == uniswapRouter, "Router not set correctly");
        
        console.log("Deployment verification passed!");
    }

    function getUniswapRouter() internal view returns (address) {
        if (block.chainid == 1) { // Mainnet
            return 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
        } else if (block.chainid == 5) { // Goerli
            return 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
        } else if (block.chainid == 11155111) { // Sepolia
            return 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008;
        } else if (block.chainid == 137) { // Polygon
            return 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff;
        } else if (block.chainid == 31337) { // Local/Anvil
            // For local testing, you might need to deploy or use a mock
            return 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
        } else {
            revert("Unsupported chain ID");
        }
    }
}
 

library DeploymentUtils {
    function toHexString(bytes memory data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint256(uint8(data[i] >> 4))];
            str[3 + i * 2] = alphabet[uint256(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }
}