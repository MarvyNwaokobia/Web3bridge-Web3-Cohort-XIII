// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PiggyBank is Ownable {
    using SafeERC20 for IERC20;

    address public immutable factoryAdmin; 
    bool public immutable isETH; 
    IERC20 public token; 
    uint256 public immutable lockPeriod; 
    uint256 public lastDepositTime; 
    uint256 public balance; 

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 fee);
    event BrokenEarly(address indexed user, uint256 fee);

    error InvalidDeposit();
    error WithdrawalFailed();
    error InvalidLockPeriod();

    constructor(
        address _owner,
        address _factoryAdmin,
        bool _isETH,
        address _token,
        uint256 _lockPeriod
    ) Ownable(_owner) {
        if (_lockPeriod == 0) revert InvalidLockPeriod();
        factoryAdmin = _factoryAdmin;
        isETH = _isETH;
        if (!_isETH) {
            token = IERC20(_token);
        }
        lockPeriod = _lockPeriod;
    }

    function deposit(uint256 amount) external payable onlyOwner {
        // CHECKS
        if (isETH) {
            if (msg.value == 0) revert InvalidDeposit();
        } else {
            if (amount == 0) revert InvalidDeposit();
        }

        uint256 depositAmount = isETH ? msg.value : amount;
        balance += depositAmount;
        lastDepositTime = block.timestamp;

        if (!isETH) {
            token.safeTransferFrom(msg.sender, address(this), amount);
        }

        emit Deposited(msg.sender, depositAmount);
    }

    function withdraw() external onlyOwner {
        if (balance == 0) revert WithdrawalFailed();

        uint256 amount = balance;
        uint256 fee = 0;
        balance = 0; 

        bool isEarly = block.timestamp < lastDepositTime + lockPeriod;
        if (isEarly) {
            fee = (amount * 3) / 100; 
            amount -= fee;
        }

        if (isEarly) {
            if (isETH) {
                payable(factoryAdmin).transfer(fee);
            } else {
                token.safeTransfer(factoryAdmin, fee);
            }
            emit BrokenEarly(msg.sender, fee);
        }

        if (isETH) {
            payable(msg.sender).transfer(amount);
        } else {
            token.safeTransfer(msg.sender, amount);
        }

        emit Withdrawn(msg.sender, amount, fee);
    }

    function getBalance() external view returns (uint256) {
        return balance;
    }
}
