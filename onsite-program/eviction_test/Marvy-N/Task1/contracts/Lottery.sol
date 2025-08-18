// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract Lottery is ReentrancyGuard, Ownable {
    uint256 public constant ENTRY_FEE = 0.01 ether;
    uint256 public constant MAX_PLAYERS = 10;
    
    address[] public players;
    mapping(address => bool) public hasEntered;
    uint256 public currentRound;
    uint256 public totalPrizePool;
    
    event PlayerJoined(address indexed player, uint256 round);
    event WinnerSelected(address indexed winner, uint256 amount, uint256 round);
    event LotteryReset(uint256 newRound);
    
    error InvalidEntryFee();
    error PlayerAlreadyEntered();
    error LotteryFull();
    error TransferFailed();
    error NoPlayersInLottery();
    
   
    constructor() Ownable(msg.sender) {
        currentRound = 1;
    }
    
  
    function enterLottery() external payable nonReentrant {
        if (msg.value != ENTRY_FEE) {
            revert InvalidEntryFee();
        }
        
        if (hasEntered[msg.sender]) {
            revert PlayerAlreadyEntered();
        }
        
        if (players.length >= MAX_PLAYERS) {
            revert LotteryFull();
        }
        
        players.push(msg.sender);
        hasEntered[msg.sender] = true;
        totalPrizePool += msg.value;
        
        emit PlayerJoined(msg.sender, currentRound);
        
        if (players.length == MAX_PLAYERS) {
            _selectWinner();
        }
    }
    
    
    function _selectWinner() internal {
        if (players.length == 0) {
            revert NoPlayersInLottery();
        }
        
        uint256 randomNumber = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao, 
                    players.length,
                    currentRound
                )
            )
        );
        
        uint256 winnerIndex = randomNumber % players.length;
        address winner = players[winnerIndex];
        uint256 prizeAmount = totalPrizePool;
        
        emit WinnerSelected(winner, prizeAmount, currentRound);
        
        _resetLottery();
        
        (bool success, ) = payable(winner).call{value: prizeAmount}("");
        if (!success) {
            revert TransferFailed();
        }
    }
    
    function _resetLottery() internal {
        for (uint256 i = 0; i < players.length; i++) {
            hasEntered[players[i]] = false;
        }
        
        delete players;
        totalPrizePool = 0;
        currentRound++;
        
        emit LotteryReset(currentRound);
    }
    
    function getPlayersCount() external view returns (uint256) {
        return players.length;
    }
    
    function getPlayers() external view returns (address[] memory) {
        return players;
    }
    
    function getPrizePool() external view returns (uint256) {
        return totalPrizePool;
    }
    
  
    function hasPlayerEntered(address player) external view returns (bool) {
        return hasEntered[player];
    }
   
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) {
            revert TransferFailed();
        }
        
        _resetLottery();
    }
        function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    receive() external payable {
        revert("Use enterLottery() function to join");
    }
}