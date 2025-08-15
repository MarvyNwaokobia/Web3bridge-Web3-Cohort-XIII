// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

contract UniswapPermitSwap {
    bytes32 private constant DOMAIN_TYPEHASH = 
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    
    bytes32 private constant SWAP_PERMIT_TYPEHASH = 
        keccak256("SwapPermit(address owner,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOutMin,uint256 deadline,uint256 nonce)");

    string public constant name = "UniswapPermitSwap";
    string public constant version = "1";

    IUniswapV2Router02 public immutable uniswapRouter;
    mapping(address => uint256) public nonces;

    struct SwapPermit {
        address owner;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        uint256 deadline;
        uint256 nonce;
    }

    event SwapExecuted(
        address indexed owner,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _uniswapRouter) {
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
    }

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                address(this)
            )
        );
    }

    function getSwapPermitHash(SwapPermit memory permit) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        SWAP_PERMIT_TYPEHASH,
                        permit.owner,
                        permit.tokenIn,
                        permit.tokenOut,
                        permit.amountIn,
                        permit.amountOutMin,
                        permit.deadline,
                        permit.nonce
                    )
                )
            )
        );
    }

    function executeSwapWithPermit(
        SwapPermit calldata swapPermit,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint8 tokenPermitV,
        bytes32 tokenPermitR,
        bytes32 tokenPermitS
    ) external {
        bytes32 digest = getSwapPermitHash(swapPermit);
        address signer = ecrecover(digest, v, r, s);
        require(signer == swapPermit.owner, "Invalid swap signature");
        require(signer != address(0), "Invalid signer");

        require(block.timestamp <= swapPermit.deadline, "Expired deadline");

        require(nonces[swapPermit.owner] == swapPermit.nonce, "Invalid nonce");
        nonces[swapPermit.owner]++;

        IERC20Permit tokenIn = IERC20Permit(swapPermit.tokenIn);
        tokenIn.permit(
            swapPermit.owner,
            address(this),
            swapPermit.amountIn,
            swapPermit.deadline,
            tokenPermitV,
            tokenPermitR,
            tokenPermitS
        );

        require(
            tokenIn.transferFrom(swapPermit.owner, address(this), swapPermit.amountIn),
            "Transfer failed"
        );

        require(
            tokenIn.approve(address(uniswapRouter), swapPermit.amountIn),
            "Approve failed"
        );

        address[] memory path = new address[](2);
        path[0] = swapPermit.tokenIn;
        path[1] = swapPermit.tokenOut;

        uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(
            swapPermit.amountIn,
            swapPermit.amountOutMin,
            path,
            swapPermit.owner,
            swapPermit.deadline
        );

        emit SwapExecuted(
            swapPermit.owner,
            swapPermit.tokenIn,
            swapPermit.tokenOut,
            amounts[0],
            amounts[1]
        );
    }

    function getExpectedAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = uniswapRouter.getAmountsOut(amountIn, path);
        return amounts[1];
    }
}

// JavaScript helper for off-chain signing (to be used in frontend)
/*
const ethers = require('ethers');

class UniswapPermitHelper {
    constructor(contractAddress, chainId) {
        this.contractAddress = contractAddress;
        this.chainId = chainId;
        this.domain = {
            name: 'UniswapPermitSwap',
            version: '1',
            chainId: chainId,
            verifyingContract: contractAddress
        };
    }

    getSwapPermitTypes() {
        return {
            SwapPermit: [
                { name: 'owner', type: 'address' },
                { name: 'tokenIn', type: 'address' },
                { name: 'tokenOut', type: 'address' },
                { name: 'amountIn', type: 'uint256' },
                { name: 'amountOutMin', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
                { name: 'nonce', type: 'uint256' }
            ]
        };
    }

    async signSwapPermit(signer, swapPermit) {
        return await signer._signTypedData(
            this.domain,
            this.getSwapPermitTypes(),
            swapPermit
        );
    }

    async signTokenPermit(signer, tokenAddress, spender, value, deadline) {
        const token = new ethers.Contract(tokenAddress, ERC20_PERMIT_ABI, signer);
        const nonce = await token.nonces(await signer.getAddress());
        const domain = {
            name: await token.name(),
            version: '1',
            chainId: this.chainId,
            verifyingContract: tokenAddress
        };

        const types = {
            Permit: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' }
            ]
        };

        const permit = {
            owner: await signer.getAddress(),
            spender: spender,
            value: value,
            nonce: nonce,
            deadline: deadline
        };

        return await signer._signTypedData(domain, types, permit);
    }
}

// Usage example:
async function executeSwapWithPermit(signer, permitSwapContract, swapParams) {
    const helper = new UniswapPermitHelper(permitSwapContract.address, 1);
    
    // Sign swap permit
    const swapPermitSig = await helper.signSwapPermit(signer, swapParams);
    const { v, r, s } = ethers.utils.splitSignature(swapPermitSig);
    
    // Sign token permit
    const tokenPermitSig = await helper.signTokenPermit(
        signer,
        swapParams.tokenIn,
        permitSwapContract.address,
        swapParams.amountIn,
        swapParams.deadline
    );
    const { v: tv, r: tr, s: ts } = ethers.utils.splitSignature(tokenPermitSig);
    
    // Execute transaction
    return await permitSwapContract.executeSwapWithPermit(
        swapParams,
        v, r, s,
        tv, tr, ts
    );
}
*/