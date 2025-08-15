// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/LootBox.sol";

contract DeployLootBox is Script {
    
    address constant ETH_VRF_COORDINATOR = 0x271682DEB8C4E0901D1a1550aD2e64D568E69909;
    bytes32 constant ETH_KEY_HASH = 0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef;
    
    address constant SEPOLIA_VRF_COORDINATOR = 0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625;
    bytes32 constant SEPOLIA_KEY_HASH = 0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c;
    
    address constant POLYGON_VRF_COORDINATOR = 0xAE975071Be8F8eE67addBC1A82488F1C24858067;
    bytes32 constant POLYGON_KEY_HASH = 0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying LootBox contract...");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        (address vrfCoordinator, bytes32 keyHash) = getVRFCoordinates();
        
        uint64 subscriptionId = 1;
        
        address feeRecipient = deployer;
        
        LootBox lootBox = new LootBox(
            vrfCoordinator,
            keyHash,
            subscriptionId,
            feeRecipient
        );
        
        console.log("LootBox deployed at:", address(lootBox));
        console.log("VRF Coordinator:", vrfCoordinator);
        console.log("Key Hash:", vm.toString(keyHash));
        console.log("Subscription ID:", subscriptionId);
        console.log("Fee Recipient:", feeRecipient);
        
        vm.stopBroadcast();
        
        console.log("Verifying deployment...");
        console.log("Owner:", lootBox.owner());
        console.log("Platform Fee:", lootBox.platformFee());
        console.log("Fee Recipient:", lootBox.feeRecipient());
        
        string memory deploymentInfo = string(abi.encodePacked(
            "LootBox Contract Deployed\n",
            "Address: ", vm.toString(address(lootBox)), "\n",
            "Network: ", vm.toString(block.chainid), "\n",
            "Deployer: ", vm.toString(deployer), "\n",
            "VRF Coordinator: ", vm.toString(vrfCoordinator), "\n"
        ));
        
        vm.writeFile("deployment.log", deploymentInfo);
        console.log("Deployment info saved to deployment.log");
    }
    
    function getVRFCoordinates() internal view returns (address coordinator, bytes32 keyHash) {
        uint256 chainId = block.chainid;
        
        if (chainId == 1) { 
            return (ETH_VRF_COORDINATOR, ETH_KEY_HASH);
        } else if (chainId == 11155111) { 
            return (SEPOLIA_VRF_COORDINATOR, SEPOLIA_KEY_HASH);
        } else if (chainId == 137) { 
            return (POLYGON_VRF_COORDINATOR, POLYGON_KEY_HASH);
        } else {
            return (SEPOLIA_VRF_COORDINATOR, SEPOLIA_KEY_HASH);
        }
    }
}

contract SetupLootBox is Script {
    function run() external {
        address lootBoxAddress = vm.envAddress("LOOT_BOX_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        LootBox lootBox = LootBox(payable(lootBoxAddress));
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Setting up LootBox at:", lootBoxAddress);
        
        uint256 basicBoxId = lootBox.createLootBoxType("Basic Mystery Box", 0.01 ether);
        uint256 premiumBoxId = lootBox.createLootBoxType("Premium Mystery Box", 0.05 ether);
        uint256 legendaryBoxId = lootBox.createLootBoxType("Legendary Mystery Box", 0.1 ether);
        
        console.log("Created box types:");
        console.log("Basic Box ID:", basicBoxId);
        console.log("Premium Box ID:", premiumBoxId);
        console.log("Legendary Box ID:", legendaryBoxId);
        

        address mockERC20 = vm.envOr("MOCK_ERC20", address(0));
        address mockERC721 = vm.envOr("MOCK_ERC721", address(0));
        address mockERC1155 = vm.envOr("MOCK_ERC1155", address(0));
        
        if (mockERC20 != address(0)) {
            lootBox.addReward(basicBoxId, LootBox.RewardType.ERC20, mockERC20, 0, 100e18, 6000); 
            lootBox.addReward(basicBoxId, LootBox.RewardType.ERC20, mockERC20, 0, 50e18, 4000);  
            
            lootBox.addReward(premiumBoxId, LootBox.RewardType.ERC20, mockERC20, 0, 500e18, 5000); 
        }
        
        if (mockERC721 != address(0)) {
            lootBox.addReward(premiumBoxId, LootBox.RewardType.ERC721, mockERC721, 1, 1, 3000); 
            
            lootBox.addReward(legendaryBoxId, LootBox.RewardType.ERC721, mockERC721, 10, 1, 2000); 
        }
        
        if (mockERC1155 != address(0)) {
            lootBox.addReward(premiumBoxId, LootBox.RewardType.ERC1155, mockERC1155, 1, 10, 2000); 
            lootBox.addReward(legendaryBoxId, LootBox.RewardType.ERC1155, mockERC1155, 2, 50, 4000);  
            lootBox.addReward(legendaryBoxId, LootBox.RewardType.ERC1155, mockERC1155, 3, 100, 4000); 
        }
        
        vm.stopBroadcast();
        
        console.log("LootBox setup completed!");
        
        displayBoxInfo(lootBox, basicBoxId, "Basic Mystery Box");
        displayBoxInfo(lootBox, premiumBoxId, "Premium Mystery Box");
        displayBoxInfo(lootBox, legendaryBoxId, "Legendary Mystery Box");
    }
    
    function displayBoxInfo(LootBox lootBox, uint256 boxTypeId, string memory boxName) internal view {
        console.log("\n=== %s ===", boxName);
        
        (string memory name, uint256 price, uint256 totalWeight, bool isActive, uint256 rewardCount) = 
            lootBox.getLootBoxType(boxTypeId);
        
        console.log("Name:", name);
        console.log("Price:", price);
        console.log("Total Weight:", totalWeight);
        console.log("Active:", isActive);
        console.log("Reward Count:", rewardCount);
        
        if (rewardCount > 0) {
            uint256[] memory rewardIds = lootBox.getBoxTypeRewards(boxTypeId);
            console.log("Rewards:");
            
            for (uint256 i = 0; i < rewardIds.length; i++) {
                uint256 probability = lootBox.getRewardProbability(boxTypeId, rewardIds[i]);
                console.log("  Reward %s: %s%% chance", vm.toString(rewardIds[i]), vm.toString(probability / 100));
            }
        }
    }
}

contract InteractWithLootBox is Script {
    function run() external {
        address lootBoxAddress = vm.envAddress("LOOT_BOX_ADDRESS");
        uint256 userPrivateKey = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(userPrivateKey);
        
        LootBox lootBox = LootBox(payable(lootBoxAddress));
        
        console.log("User:", user);
        console.log("User balance:", user.balance);
        
        vm.startBroadcast(userPrivateKey);
        
        (string memory name, uint256 price, , bool isActive, uint256 rewardCount) = lootBox.getLootBoxType(1);
        
        if (!isActive || rewardCount == 0) {
            console.log("Box type 1 is not available for opening");
            vm.stopBroadcast();
            return;
        }
        
        console.log("Opening box: %s", name);
        console.log("Price: %s", vm.toString(price));
        
        require(user.balance >= price, "Insufficient balance");
        
        uint256 boxesOpenedBefore = lootBox.totalBoxesOpened();
        lootBox.openLootBox{value: price}(1);
        
        console.log("Box opened! Total boxes opened:", lootBox.totalBoxesOpened());
        console.log("Waiting for VRF fulfillment...");
        console.log("Note: In a real scenario, you would need to wait for Chainlink VRF to fulfill the request");
        
        vm.stopBroadcast();
        
        console.log("Transaction completed. Monitor the RewardClaimed event for results.");
    }
}

contract ManageLootBox is Script {
    function run() external {
        address lootBoxAddress = vm.envAddress("LOOT_BOX_ADDRESS");
        uint256 ownerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        LootBox lootBox = LootBox(payable(lootBoxAddress));
        
        vm.startBroadcast(ownerPrivateKey);
        
        console.log("Managing LootBox at:", lootBoxAddress);
        
        
        console.log("Current platform fee:", lootBox.platformFee());
        lootBox.setPlatformFee(300); 
        console.log("New platform fee:", lootBox.platformFee());
        
        address newFeeRecipient = vm.envOr("NEW_FEE_RECIPIENT", lootBox.feeRecipient());
        lootBox.setFeeRecipient(newFeeRecipient);
        console.log("Fee recipient updated to:", lootBox.feeRecipient());
        
        console.log("Contract ETH balance:", address(lootBox).balance);
        
        vm.stopBroadcast();
        
        console.log("Management operations completed!");
    }
}