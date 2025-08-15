// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PiggyBank.sol";

contract PiggyBankFactory is Ownable {
    mapping(address => address[]) public userPiggyBanks; 
    mapping(address => mapping(uint256 => bool)) private userLockPeriods;

    event PiggyBankCreated(address indexed user, address piggyBank, uint256 lockPeriod);

    error DuplicateLockPeriod();
    error InvalidParameters();

    constructor() Ownable(msg.sender) {} 

    function createPiggyBank(bool isETH, address token, uint256 lockPeriod) external {
        if (lockPeriod == 0) revert InvalidParameters();
        if (!isETH && token == address(0)) revert InvalidParameters();
        if (userLockPeriods[msg.sender][lockPeriod]) revert DuplicateLockPeriod();

        PiggyBank newPiggy = new PiggyBank(msg.sender, owner(), isETH, token, lockPeriod);
        userPiggyBanks[msg.sender].push(address(newPiggy));
        userLockPeriods[msg.sender][lockPeriod] = true;

        emit PiggyBankCreated(msg.sender, address(newPiggy), lockPeriod);
    }

    function getUserPiggyBankCount(address user) external view returns (uint256) {
        return userPiggyBanks[user].length;
    }

    function getUserPiggyBanks(address user) external view returns (address[] memory) {
        return userPiggyBanks[user];
    }

    function getUserTotalBalance(address user) external view returns (uint256 ethBalance, uint256[] memory tokenBalances, address[] memory tokens) {
        address[] memory banks = userPiggyBanks[user];
        tokenBalances = new uint256[](banks.length);
        tokens = new address[](banks.length);
        for (uint256 i = 0; i < banks.length; i++) {
            PiggyBank bank = PiggyBank(banks[i]);
            if (bank.isETH()) {
                ethBalance += bank.getBalance();
            } else {
                tokenBalances[i] = bank.getBalance();
                tokens[i] = address(bank.token());
            }
        }
    }
}