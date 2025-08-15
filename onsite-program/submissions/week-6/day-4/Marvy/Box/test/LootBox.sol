// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/LootBox.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("MockToken", "MOCK") {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockERC721 is ERC721 {
    uint256 private _tokenIdCounter;
    
    constructor() ERC721("MockNFT", "MNFT") {}
    
    function mint(address to) external returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _mint(to, tokenId);
        return tokenId;
    }
}

contract MockERC1155 is ERC1155 {
    constructor() ERC1155("https://mock.uri/{id}") {}
    
    function mint(address to, uint256 id, uint256 amount, bytes memory data) external {
        _mint(to, id, amount, data);
    }
}

contract MockVRFCoordinator {
    mapping(uint256 => address) public requesters;
    uint256 public requestCounter = 1;
    
    function requestRandomWords(
        bytes32,
        uint64,
        uint16,
        uint32,
        uint32
    ) external returns (uint256) {
        uint256 requestId = requestCounter++;
        requesters[requestId] = msg.sender;
        return requestId;
    }
    
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        address requester = requesters[requestId];
        require(requester != address(0), "Invalid request");
        
        LootBox(requester).rawFulfillRandomWords(requestId, randomWords);
    }
}

contract LootBoxTest is Test {
    LootBox public lootBox;
    MockVRFCoordinator public mockVRF;
    MockERC20 public mockToken;
    MockERC721 public mockNFT;
    MockERC1155 public mockMultiToken;
    
    address public owner = makeAddr("owner");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public feeRecipient = makeAddr("feeRecipient");
    
    bytes32 constant KEY_HASH = 0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15;
    uint64 constant SUBSCRIPTION_ID = 1;
    
    uint256 constant BOX_PRICE = 0.1 ether;
    
    event LootBoxTypeCreated(uint256 indexed boxTypeId, string name, uint256 price);
    event RewardAdded(uint256 indexed rewardId, uint256 indexed boxTypeId, LootBox.RewardType rewardType, address tokenContract);
    event BoxOpened(address indexed user, uint256 indexed boxTypeId, uint256 requestId);
    event RewardClaimed(address indexed user, uint256 indexed boxTypeId, uint256 indexed rewardId, LootBox.RewardType rewardType, address tokenContract, uint256 tokenId, uint256 amount);

    function setUp() public {
        vm.startPrank(owner);
        
        mockVRF = new MockVRFCoordinator();
        mockToken = new MockERC20();
        mockNFT = new MockERC721();
        mockMultiToken = new MockERC1155();
        
        // Deploy LootBox contract
        lootBox = new LootBox(
            address(mockVRF),
            KEY_HASH,
            SUBSCRIPTION_ID,
            feeRecipient
        );
        
        // Setup initial state
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        
        // Mint tokens for rewards
        mockToken.mint(address(lootBox), 10000e18);
        
        for (uint256 i = 0; i < 10; i++) {
            mockNFT.mint(address(lootBox));
        }
        
        mockMultiToken.mint(address(lootBox), 1, 100, "");
        mockMultiToken.mint(address(lootBox), 2, 50, "");
        
        vm.stopPrank();
    }
    
    function test_CreateLootBoxType() public {
        vm.startPrank(owner);
        
        vm.expectEmit(true, false, false, true);
        emit LootBoxTypeCreated(1, "Basic Box", BOX_PRICE);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Basic Box", BOX_PRICE);
        assertEq(boxTypeId, 1);
        
        (string memory name, uint256 price, uint256 totalWeight, bool isActive, uint256 rewardCount) = lootBox.getLootBoxType(1);
        assertEq(name, "Basic Box");
        assertEq(price, BOX_PRICE);
        assertEq(totalWeight, 0);
        assertTrue(isActive);
        assertEq(rewardCount, 0);
        
        vm.stopPrank();
    }
    
    function test_AddRewards() public {
        vm.startPrank(owner);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Test Box", BOX_PRICE);
        
        // Add ERC20 reward
        vm.expectEmit(true, true, false, true);
        emit RewardAdded(1, boxTypeId, LootBox.RewardType.ERC20, address(mockToken));
        
        uint256 erc20RewardId = lootBox.addReward(
            boxTypeId,
            LootBox.RewardType.ERC20,
            address(mockToken),
            0,
            100e18,
            5000 // 50% weight
        );
        assertEq(erc20RewardId, 1);
        
        // Add ERC721 reward
        uint256 erc721RewardId = lootBox.addReward(
            boxTypeId,
            LootBox.RewardType.ERC721,
            address(mockNFT),
            0,
            1,
            3000 // 30% weight
        );
        assertEq(erc721RewardId, 2);
        
        // Add ERC1155 reward
        uint256 erc1155RewardId = lootBox.addReward(
            boxTypeId,
            LootBox.RewardType.ERC1155,
            address(mockMultiToken),
            1,
            10,
            2000 // 20% weight
        );
        assertEq(erc1155RewardId, 3);
        
        // Check box type total weight
        (, , uint256 totalWeight, , uint256 rewardCount) = lootBox.getLootBoxType(boxTypeId);
        assertEq(totalWeight, 10000);
        assertEq(rewardCount, 3);
        
        vm.stopPrank();
    }
    
    function test_OpenLootBox() public {
        vm.startPrank(owner);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Test Box", BOX_PRICE);
        
        lootBox.addReward(
            boxTypeId,
            LootBox.RewardType.ERC20,
            address(mockToken),
            0,
            100e18,
            10000
        );
        
        vm.stopPrank();
        
        // User opens loot box
        vm.startPrank(user1);
        
        uint256 userBalanceBefore = user1.balance;
        uint256 feeRecipientBalanceBefore = feeRecipient.balance;
        
        vm.expectEmit(true, true, false, false);
        emit BoxOpened(user1, boxTypeId, 1);
        
        lootBox.openLootBox{value: BOX_PRICE}(boxTypeId);
        
        // Check payment processing
        uint256 expectedFee = (BOX_PRICE * lootBox.platformFee()) / 10000;
        assertEq(feeRecipient.balance, feeRecipientBalanceBefore + expectedFee);
        assertEq(user1.balance, userBalanceBefore - BOX_PRICE);
        
        // Check that pending box is created
        (address pendingUser, uint256 pendingBoxType, uint256 timestamp) = lootBox.pendingBoxes(1);
        assertEq(pendingUser, user1);
        assertEq(pendingBoxType, boxTypeId);
        assertTrue(timestamp > 0);
        
        vm.stopPrank();
    }
    
    function test_VRFFulfillment() public {
        vm.startPrank(owner);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Test Box", BOX_PRICE);
        
        uint256 rewardId = lootBox.addReward(
            boxTypeId,
            LootBox.RewardType.ERC20,
            address(mockToken),
            0,
            100e18,
            10000
        );
        
        vm.stopPrank();
        
        // User opens box
        vm.prank(user1);
        lootBox.openLootBox{value: BOX_PRICE}(boxTypeId);
        
        // Check user's token balance before
        uint256 userTokenBalanceBefore = mockToken.balanceOf(user1);
        
        // Simulate VRF fulfillment
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 12345; // Any random number
        
        vm.expectEmit(true, true, true, true);
        emit RewardClaimed(user1, boxTypeId, rewardId, LootBox.RewardType.ERC20, address(mockToken), 0, 100e18);
        
        mockVRF.fulfillRandomWords(1, randomWords);
        
        // Check reward distribution
        assertEq(mockToken.balanceOf(user1), userTokenBalanceBefore + 100e18);
        
        // Check that pending box is cleared
        (address pendingUser, , ) = lootBox.pendingBoxes(1);
        assertEq(pendingUser, address(0));
    }
    
    function test_WeightedRandomSelection() public {
        vm.startPrank(owner);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Weighted Box", BOX_PRICE);
        
        // Add rewards with different weights
        uint256 commonRewardId = lootBox.addReward(
            boxTypeId,
            LootBox.RewardType.ERC20,
            address(mockToken),
            0,
            10e18,
            7000 // 70% chance
        );
        
        uint256 rareRewardId = lootBox.addReward(
            boxTypeId,
            LootBox.RewardType.ERC721,
            address(mockNFT),
            1,
            1,
            2000 // 20% chance
        );
        
        uint256 epicRewardId = lootBox.addReward(
            boxTypeId,
            LootBox.RewardType.ERC1155,
            address(mockMultiToken),
            1,
            5,
            1000 // 10% chance
        );
        
        vm.stopPrank();
        
        // Test probability calculations
        assertEq(lootBox.getRewardProbability(boxTypeId, commonRewardId), 7000); // 70%
        assertEq(lootBox.getRewardProbability(boxTypeId, rareRewardId), 2000);   // 20%
        assertEq(lootBox.getRewardProbability(boxTypeId, epicRewardId), 1000);   // 10%
        
        // Test multiple openings to verify distribution (simplified test)
        vm.startPrank(user1);
        
        for (uint256 i = 0; i < 5; i++) {
            lootBox.openLootBox{value: BOX_PRICE}(boxTypeId);
            
            uint256[] memory randomWords = new uint256[](1);
            randomWords[0] = uint256(keccak256(abi.encode(block.timestamp, i)));
            
            mockVRF.fulfillRandomWords(i + 1, randomWords);
        }
        
        vm.stopPrank();
        
        // Check that user received some rewards
        assertTrue(mockToken.balanceOf(user1) > 0 || mockNFT.balanceOf(user1) > 0 || mockMultiToken.balanceOf(user1, 1) > 0);
    }
    
    function test_AdminFunctions() public {
        vm.startPrank(owner);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Admin Test Box", BOX_PRICE);
        uint256 rewardId = lootBox.addReward(
            boxTypeId,
            LootBox.RewardType.ERC20,
            address(mockToken),
            0,
            100e18,
            10000
        );
        
        // Test deactivating box type
        lootBox.setLootBoxTypeStatus(boxTypeId, false);
        (, , , bool isActive, ) = lootBox.getLootBoxType(boxTypeId);
        assertFalse(isActive);
        
        // Test changing reward status
        lootBox.setRewardStatus(rewardId, false);
        (, , , , , bool rewardActive) = lootBox.rewards(rewardId);
        assertFalse(rewardActive);
        
        // Test changing platform fee
        lootBox.setPlatformFee(500); // 5%
        assertEq(lootBox.platformFee(), 500);
        
        // Test changing fee recipient
        address newFeeRecipient = makeAddr("newFeeRecipient");
        lootBox.setFeeRecipient(newFeeRecipient);
        assertEq(lootBox.feeRecipient(), newFeeRecipient);
        
        vm.stopPrank();
    }
    
    function test_EmergencyWithdraw() public {
        vm.startPrank(owner);
        
        // Send some ETH to contract
        vm.deal(address(lootBox), 5 ether);
        
        uint256 ownerBalanceBefore = owner.balance;
        lootBox.emergencyWithdraw();
        assertEq(owner.balance, ownerBalanceBefore + 5 ether);
        
        // Test ERC20 emergency withdraw
        uint256 tokenBalance = mockToken.balanceOf(address(lootBox));
        lootBox.emergencyWithdrawERC20(address(mockToken));
        assertEq(mockToken.balanceOf(owner), tokenBalance);
        
        // Test ERC721 emergency withdraw
        lootBox.emergencyWithdrawERC721(address(mockNFT), 0);
        assertEq(mockNFT.ownerOf(0), owner);
        
        // Test ERC1155 emergency withdraw
        uint256 multiTokenBalance = mockMultiToken.balanceOf(address(lootBox), 1);
        lootBox.emergencyWithdrawERC1155(address(mockMultiToken), 1, multiTokenBalance);
        assertEq(mockMultiToken.balanceOf(owner, 1), multiTokenBalance);
        
        vm.stopPrank();
    }
    
    function test_RevertConditions() public {
        vm.startPrank(owner);
        
        // Test creating box with empty name
        vm.expectRevert("Name cannot be empty");
        lootBox.createLootBoxType("", BOX_PRICE);
        
        // Test creating box with zero price
        vm.expectRevert("Price must be greater than 0");
        lootBox.createLootBoxType("Test", 0);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Test Box", BOX_PRICE);
        
        // Test adding reward with zero weight
        vm.expectRevert("Weight must be greater than 0");
        lootBox.addReward(boxTypeId, LootBox.RewardType.ERC20, address(mockToken), 0, 100e18, 0);
        
        // Test adding reward to non-existent box
        vm.expectRevert("Box type does not exist or inactive");
        lootBox.addReward(999, LootBox.RewardType.ERC20, address(mockToken), 0, 100e18, 1000);
        
        vm.stopPrank();
        
        // Test opening box with insufficient payment
        vm.startPrank(user1);
        vm.expectRevert("Insufficient payment");
        lootBox.openLootBox{value: BOX_PRICE - 1}(boxTypeId);
        
        // Test opening box with no rewards
        vm.expectRevert("No rewards available for this box type");
        lootBox.openLootBox{value: BOX_PRICE}(boxTypeId);
        
        vm.stopPrank();
        
        // Test unauthorized access
        vm.startPrank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        lootBox.createLootBoxType("Unauthorized", BOX_PRICE);
        
        vm.stopPrank();
    }
    
    function test_PaymentHandling() public {
        vm.startPrank(owner);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Payment Test", BOX_PRICE);
        lootBox.addReward(boxTypeId, LootBox.RewardType.ERC20, address(mockToken), 0, 100e18, 10000);
        
        vm.stopPrank();
        
        vm.startPrank(user1);
        
        uint256 userBalanceBefore = user1.balance;
        uint256 feeRecipientBalanceBefore = feeRecipient.balance;
        uint256 overpayment = 0.05 ether;
        
        // Open box with overpayment
        lootBox.openLootBox{value: BOX_PRICE + overpayment}(boxTypeId);
        
        // Check that overpayment was refunded
        uint256 expectedFee = (BOX_PRICE * lootBox.platformFee()) / 10000;
        assertEq(user1.balance, userBalanceBefore - BOX_PRICE);
        assertEq(feeRecipient.balance, feeRecipientBalanceBefore + expectedFee);
        
        vm.stopPrank();
    }
    
    function test_MultipleBoxTypes() public {
        vm.startPrank(owner);
        
        // Create multiple box types with different prices and rewards
        uint256 basicBoxId = lootBox.createLootBoxType("Basic Box", 0.05 ether);
        uint256 premiumBoxId = lootBox.createLootBoxType("Premium Box", 0.2 ether);
        
        // Add different rewards to each box type
        lootBox.addReward(basicBoxId, LootBox.RewardType.ERC20, address(mockToken), 0, 50e18, 10000);
        
        lootBox.addReward(premiumBoxId, LootBox.RewardType.ERC20, address(mockToken), 0, 200e18, 5000);
        lootBox.addReward(premiumBoxId, LootBox.RewardType.ERC721, address(mockNFT), 2, 1, 3000);
        lootBox.addReward(premiumBoxId, LootBox.RewardType.ERC1155, address(mockMultiToken), 1, 20, 2000);
        
        vm.stopPrank();
        
        // Test opening both box types
        vm.startPrank(user1);
        
        // Open basic box
        lootBox.openLootBox{value: 0.05 ether}(basicBoxId);
        uint256[] memory randomWords1 = new uint256[](1);
        randomWords1[0] = 11111;
        mockVRF.fulfillRandomWords(1, randomWords1);
        
        // Open premium box
        lootBox.openLootBox{value: 0.2 ether}(premiumBoxId);
        uint256[] memory randomWords2 = new uint256[](1);
        randomWords2[0] = 22222;
        mockVRF.fulfillRandomWords(2, randomWords2);
        
        // Verify rewards were distributed
        assertTrue(mockToken.balanceOf(user1) >= 50e18); // At least basic box reward
        
        vm.stopPrank();
    }
    
    function test_BoxTypeQueries() public {
        vm.startPrank(owner);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Query Test", BOX_PRICE);
        
        uint256 reward1 = lootBox.addReward(boxTypeId, LootBox.RewardType.ERC20, address(mockToken), 0, 100e18, 5000);
        uint256 reward2 = lootBox.addReward(boxTypeId, LootBox.RewardType.ERC721, address(mockNFT), 3, 1, 3000);
        uint256 reward3 = lootBox.addReward(boxTypeId, LootBox.RewardType.ERC1155, address(mockMultiToken), 2, 15, 2000);
        
        vm.stopPrank();
        
        // Test getting box type rewards
        uint256[] memory rewardIds = lootBox.getBoxTypeRewards(boxTypeId);
        assertEq(rewardIds.length, 3);
        assertEq(rewardIds[0], reward1);
        assertEq(rewardIds[1], reward2);
        assertEq(rewardIds[2], reward3);
        
        // Test getting all box type IDs
        uint256[] memory allBoxTypes = lootBox.getAllBoxTypeIds();
        assertEq(allBoxTypes.length, 1);
        assertEq(allBoxTypes[0], boxTypeId);
        
        // Test reward probabilities
        assertEq(lootBox.getRewardProbability(boxTypeId, reward1), 5000); // 50%
        assertEq(lootBox.getRewardProbability(boxTypeId, reward2), 3000); // 30%
        assertEq(lootBox.getRewardProbability(boxTypeId, reward3), 2000); // 20%
    }
    
    function test_LargeScaleOperations() public {
        vm.startPrank(owner);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Large Scale Test", BOX_PRICE);
        
        // Add many rewards to test gas efficiency
        for (uint256 i = 0; i < 20; i++) {
            lootBox.addReward(
                boxTypeId, 
                LootBox.RewardType.ERC20, 
                address(mockToken), 
                0, 
                (i + 1) * 10e18, 
                500 // Equal weights
            );
        }
        
        vm.stopPrank();
        
        // Test multiple users opening boxes simultaneously
        address[] memory users = new address[](5);
        for (uint256 i = 0; i < 5; i++) {
            users[i] = makeAddr(string(abi.encodePacked("user", i)));
            vm.deal(users[i], 10 ether);
        }
        
        uint256 requestIdCounter = 1;
        
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(users[i]);
            lootBox.openLootBox{value: BOX_PRICE}(boxTypeId);
            
            uint256[] memory randomWords = new uint256[](1);
            randomWords[0] = uint256(keccak256(abi.encode(block.timestamp, i, "random")));
            mockVRF.fulfillRandomWords(requestIdCounter++, randomWords);
        }
        
        // Verify all users received rewards
        for (uint256 i = 0; i < 5; i++) {
            assertTrue(mockToken.balanceOf(users[i]) > 0);
        }
        
        // Check total boxes opened counter
        assertEq(lootBox.totalBoxesOpened(), 5);
    }
    
    function test_EdgeCases() public {
        vm.startPrank(owner);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Edge Case Test", BOX_PRICE);
        
        // Test with single reward (100% probability)
        uint256 singleReward = lootBox.addReward(
            boxTypeId,
            LootBox.RewardType.ERC20,
            address(mockToken),
            0,
            1000e18,
            10000
        );
        
        vm.stopPrank();
        
        vm.startPrank(user1);
        
        lootBox.openLootBox{value: BOX_PRICE}(boxTypeId);
        
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = type(uint256).max; // Maximum random value
        mockVRF.fulfillRandomWords(1, randomWords);
        
        // Should still get the single reward
        assertEq(mockToken.balanceOf(user1), 1000e18);
        
        vm.stopPrank();
        
        vm.startPrank(owner);
        
        // Test deactivating and reactivating rewards
        lootBox.setRewardStatus(singleReward, false);
        (, , , , , bool rewardActive) = lootBox.rewards(singleReward);
        assertFalse(rewardActive);
        
        // Check total weight updated
        (, , uint256 totalWeight, , ) = lootBox.getLootBoxType(boxTypeId);
        assertEq(totalWeight, 0);
        
        lootBox.setRewardStatus(singleReward, true);
        (, , totalWeight, , ) = lootBox.getLootBoxType(boxTypeId);
        assertEq(totalWeight, 10000);
        
        vm.stopPrank();
    }
    
    function testFuzz_RandomDistribution(uint256 randomSeed) public {
        vm.startPrank(owner);
        
        uint256 boxTypeId = lootBox.createLootBoxType("Fuzz Test", BOX_PRICE);
        
        uint256 reward1 = lootBox.addReward(boxTypeId, LootBox.RewardType.ERC20, address(mockToken), 0, 100e18, 7000);
        uint256 reward2 = lootBox.addReward(boxTypeId, LootBox.RewardType.ERC20, address(mockToken), 0, 200e18, 3000);
        
        vm.stopPrank();
        
        vm.startPrank(user1);
        
        lootBox.openLootBox{value: BOX_PRICE}(boxTypeId);
        
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = randomSeed;
        mockVRF.fulfillRandomWords(1, randomWords);
        
        // Verify user got one of the rewards
        uint256 userBalance = mockToken.balanceOf(user1);
        assertTrue(userBalance == 100e18 || userBalance == 200e18);
        
        vm.stopPrank();
    }
    
    receive() external payable {}
}