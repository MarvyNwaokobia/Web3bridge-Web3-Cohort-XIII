// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";

contract LootBox is VRFConsumerBaseV2, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    VRFCoordinatorV2Interface private immutable vrfCoordinator;
    bytes32 private immutable keyHash;
    uint64 private immutable subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant CALLBACK_GAS_LIMIT = 200000;

    enum RewardType { ERC20, ERC721, ERC1155 }

    struct Reward {
        RewardType rewardType;
        address tokenContract;
        uint256 tokenId; 
        uint256 amount;  
        uint16 weight;   
        bool isActive;
    }

    struct LootBoxType {
        string name;
        uint256 price;
        uint256 totalWeight;
        bool isActive;
        EnumerableSet.UintSet rewardIds;
    }

    struct PendingBox {
        address user;
        uint256 boxTypeId;
        uint256 timestamp;
    }

    mapping(uint256 => Reward) public rewards;
    mapping(uint256 => LootBoxType) private lootBoxTypes;
    mapping(uint256 => PendingBox) public pendingBoxes; 
    
    uint256 public nextRewardId = 1;
    uint256 public nextBoxTypeId = 1;
    uint256 public totalBoxesOpened;
    
    address public feeRecipient;
    uint256 public platformFee = 250; 


    event LootBoxTypeCreated(uint256 indexed boxTypeId, string name, uint256 price);
    event RewardAdded(uint256 indexed rewardId, uint256 indexed boxTypeId, RewardType rewardType, address tokenContract);
    event BoxOpened(address indexed user, uint256 indexed boxTypeId, uint256 requestId);
    event RewardClaimed(
        address indexed user, 
        uint256 indexed boxTypeId, 
        uint256 indexed rewardId, 
        RewardType rewardType, 
        address tokenContract, 
        uint256 tokenId, 
        uint256 amount
    );
    event BoxTypeStatusChanged(uint256 indexed boxTypeId, bool isActive);
    event RewardStatusChanged(uint256 indexed rewardId, bool isActive);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor(
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId,
        address _feeRecipient,
        address initialOwner

    ) VRFConsumerBaseV2(_vrfCoordinator) {
        vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        feeRecipient = _feeRecipient;
        initialOwner= _initialOwner
    }

    function createLootBoxType(
        string memory _name,
        uint256 _price
    ) external onlyOwner returns (uint256) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_price > 0, "Price must be greater than 0");

        uint256 boxTypeId = nextBoxTypeId++;
        LootBoxType storage boxType = lootBoxTypes[boxTypeId];
        boxType.name = _name;
        boxType.price = _price;
        boxType.isActive = true;

        emit LootBoxTypeCreated(boxTypeId, _name, _price);
        return boxTypeId;
    }

    function addReward(
        uint256 _boxTypeId,
        RewardType _rewardType,
        address _tokenContract,
        uint256 _tokenId,
        uint256 _amount,
        uint16 _weight
    ) external onlyOwner returns (uint256) {
        require(lootBoxTypes[_boxTypeId].isActive, "Box type does not exist or inactive");
        require(_tokenContract != address(0), "Invalid token contract");
        require(_weight > 0, "Weight must be greater than 0");

        uint256 rewardId = nextRewardId++;
        rewards[rewardId] = Reward({
            rewardType: _rewardType,
            tokenContract: _tokenContract,
            tokenId: _tokenId,
            amount: _amount,
            weight: _weight,
            isActive: true
        });

        lootBoxTypes[_boxTypeId].rewardIds.add(rewardId);
        lootBoxTypes[_boxTypeId].totalWeight += _weight;

        emit RewardAdded(rewardId, _boxTypeId, _rewardType, _tokenContract);
        return rewardId;
    }

    function openLootBox(uint256 _boxTypeId) external payable nonReentrant {
        LootBoxType storage boxType = lootBoxTypes[_boxTypeId];
        require(boxType.isActive, "Box type inactive or does not exist");
        require(msg.value >= boxType.price, "Insufficient payment");
        require(boxType.rewardIds.length() > 0, "No rewards available for this box type");

        uint256 fee = (boxType.price * platformFee) / 10000;
        uint256 netAmount = boxType.price - fee;
        
        if (fee > 0) {
            payable(feeRecipient).transfer(fee);
        }

        if (msg.value > boxType.price) {
            payable(msg.sender).transfer(msg.value - boxType.price);
        }

        uint256 requestId = vrfCoordinator.requestRandomWords(
            keyHash,
            subscriptionId,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            1
        );

        pendingBoxes[requestId] = PendingBox({
            user: msg.sender,
            boxTypeId: _boxTypeId,
            timestamp: block.timestamp
        });

        totalBoxesOpened++;
        emit BoxOpened(msg.sender, _boxTypeId, requestId);
    }

    function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) internal override {
        PendingBox memory pendingBox = pendingBoxes[_requestId];
        require(pendingBox.user != address(0), "Invalid request ID");

        uint256 randomValue = _randomWords[0];
        uint256 rewardId = _selectReward(pendingBox.boxTypeId, randomValue);
        
        _distributeReward(pendingBox.user, pendingBox.boxTypeId, rewardId);
        delete pendingBoxes[_requestId];
    }

    function _selectReward(uint256 _boxTypeId, uint256 _randomValue) private view returns (uint256) {
        LootBoxType storage boxType = lootBoxTypes[_boxTypeId];
        uint256 randomWeight = (_randomValue % boxType.totalWeight) + 1;
        uint256 cumulativeWeight = 0;

        uint256[] memory rewardIds = boxType.rewardIds.values();
        
        for (uint256 i = 0; i < rewardIds.length; i++) {
            uint256 rewardId = rewardIds[i];
            Reward storage reward = rewards[rewardId];
            
            if (reward.isActive) {
                cumulativeWeight += reward.weight;
                if (randomWeight <= cumulativeWeight) {
                    return rewardId;
                }
            }
        }
        
        revert("No valid reward found");
    }

    function _distributeReward(address _user, uint256 _boxTypeId, uint256 _rewardId) private {
        Reward storage reward = rewards[_rewardId];
        
        if (reward.rewardType == RewardType.ERC20) {
            IERC20(reward.tokenContract).safeTransfer(_user, reward.amount);
        } else if (reward.rewardType == RewardType.ERC721) {
            IERC721(reward.tokenContract).safeTransferFrom(address(this), _user, reward.tokenId);
        } else if (reward.rewardType == RewardType.ERC1155) {
            IERC1155(reward.tokenContract).safeTransferFrom(address(this), _user, reward.tokenId, reward.amount, "");
        }

        emit RewardClaimed(
            _user,
            _boxTypeId,
            _rewardId,
            reward.rewardType,
            reward.tokenContract,
            reward.tokenId,
            reward.amount
        );
    }

    function setLootBoxTypeStatus(uint256 _boxTypeId, bool _isActive) external onlyOwner {
        require(bytes(lootBoxTypes[_boxTypeId].name).length > 0, "Box type does not exist");
        lootBoxTypes[_boxTypeId].isActive = _isActive;
        emit BoxTypeStatusChanged(_boxTypeId, _isActive);
    }

    function setRewardStatus(uint256 _rewardId, bool _isActive) external onlyOwner {
        require(rewards[_rewardId].tokenContract != address(0), "Reward does not exist");
        
        uint256[] memory boxTypeIds = getAllBoxTypeIds();
        for (uint256 i = 0; i < boxTypeIds.length; i++) {
            if (lootBoxTypes[boxTypeIds[i]].rewardIds.contains(_rewardId)) {
                if (_isActive && !rewards[_rewardId].isActive) {
                    lootBoxTypes[boxTypeIds[i]].totalWeight += rewards[_rewardId].weight;
                } else if (!_isActive && rewards[_rewardId].isActive) {
                    lootBoxTypes[boxTypeIds[i]].totalWeight -= rewards[_rewardId].weight;
                }
            }
        }
        
        rewards[_rewardId].isActive = _isActive;
        emit RewardStatusChanged(_rewardId, _isActive);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        address oldRecipient = feeRecipient;
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(oldRecipient, _feeRecipient);
    }

    function setPlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= 1000, "Fee too high"); 
        uint256 oldFee = platformFee;
        platformFee = _platformFee;
        emit PlatformFeeUpdated(oldFee, _platformFee);
    }

    function getLootBoxType(uint256 _boxTypeId) external view returns (
        string memory name,
        uint256 price,
        uint256 totalWeight,
        bool isActive,
        uint256 rewardCount
    ) {
        LootBoxType storage boxType = lootBoxTypes[_boxTypeId];
        return (
            boxType.name,
            boxType.price,
            boxType.totalWeight,
            boxType.isActive,
            boxType.rewardIds.length()
        );
    }

    function getBoxTypeRewards(uint256 _boxTypeId) external view returns (uint256[] memory) {
        return lootBoxTypes[_boxTypeId].rewardIds.values();
    }

    function getRewardProbability(uint256 _boxTypeId, uint256 _rewardId) external view returns (uint256) {
        require(lootBoxTypes[_boxTypeId].rewardIds.contains(_rewardId), "Reward not in this box type");
        return (rewards[_rewardId].weight * 10000) / lootBoxTypes[_boxTypeId].totalWeight; 
    }

    function getAllBoxTypeIds() public view returns (uint256[] memory) {
        uint256[] memory boxTypeIds = new uint256[](nextBoxTypeId - 1);
        for (uint256 i = 1; i < nextBoxTypeId; i++) {
            boxTypeIds[i - 1] = i;
        }
        return boxTypeIds;
    }

    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function emergencyWithdrawERC20(address _token) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), IERC20(_token).balanceOf(address(this)));
    }

    function emergencyWithdrawERC721(address _token, uint256 _tokenId) external onlyOwner {
        IERC721(_token).safeTransferFrom(address(this), owner(), _tokenId);
    }

    function emergencyWithdrawERC1155(address _token, uint256 _tokenId, uint256 _amount) external onlyOwner {
        IERC1155(_token).safeTransferFrom(address(this), owner(), _tokenId, _amount, "");
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x150b7a02 || interfaceId == 0x4e2312e0;
    }
}