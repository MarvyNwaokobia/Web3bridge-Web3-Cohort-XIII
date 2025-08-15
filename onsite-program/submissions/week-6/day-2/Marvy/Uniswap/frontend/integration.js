// Frontend Integration Example (JavaScript/TypeScript)
// npm install ethers @metamask/eth-sig-util

import { ethers } from 'ethers';
import { SignTypedDataVersion, signTypedData } from '@metamask/eth-sig-util';

const UNISWAP_PERMIT_SWAP_ABI = [
    "function executeSwapWithPermit((address,address,address,uint256,uint256,uint256,uint256),uint8,bytes32,bytes32,uint8,bytes32,bytes32)",
    "function nonces(address) view returns (uint256)",
    "function getExpectedAmountOut(address,address,uint256) view returns (uint256)",
    "function DOMAIN_SEPARATOR() view returns (bytes32)"
];

const ERC20_PERMIT_ABI = [
    "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
    "function nonces(address) view returns (uint256)",
    "function DOMAIN_SEPARATOR() view returns (bytes32)",
    "function name() view returns (string)",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

class UniswapPermitSwapClient {
    constructor(contractAddress, provider, chainId = 1) {
        this.contractAddress = contractAddress;
        this.provider = provider;
        this.chainId = chainId;
        this.contract = new ethers.Contract(contractAddress, UNISWAP_PERMIT_SWAP_ABI, provider);
        
        this.swapDomain = {
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
        try {
            return await signer._signTypedData(
                this.swapDomain,
                this.getSwapPermitTypes(),
                swapPermit
            );
        } catch (error) {
            const msgParams = {
                domain: this.swapDomain,
                types: this.getSwapPermitTypes(),
                primaryType: 'SwapPermit',
                message: swapPermit
            };

            const signature = await signer.provider.send('eth_signTypedData_v4', [
                await signer.getAddress(),
                JSON.stringify(msgParams)
            ]);

            return signature;
        }
    }

    async signTokenPermit(signer, tokenAddress, spender, value, deadline) {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_PERMIT_ABI, signer);
        const owner = await signer.getAddress();
        
        const [nonce, name, domainSeparator] = await Promise.all([
            tokenContract.nonces(owner),
            tokenContract.name(),
            tokenContract.DOMAIN_SEPARATOR()
        ]);

        const domain = {
            name: name,
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
            owner: owner,
            spender: spender,
            value: value.toString(),
            nonce: nonce.toString(),
            deadline: deadline.toString()
        };

        try {
            return await signer._signTypedData(domain, types, permit);
        } catch (error) {
            const msgParams = {
                domain: domain,
                types: types,
                primaryType: 'Permit',
                message: permit
            };

            return await signer.provider.send('eth_signTypedData_v4', [
                await signer.getAddress(),
                JSON.stringify(msgParams)
            ]);
        }
    }

    async getExpectedAmountOut(tokenIn, tokenOut, amountIn) {
        return await this.contract.getExpectedAmountOut(tokenIn, tokenOut, amountIn);
    }

    async executeSwapWithPermit(signer, swapParams, relayer = null) {
        const owner = await signer.getAddress();
        const nonce = await this.contract.nonces(owner);

        const swapPermit = {
            owner: owner,
            tokenIn: swapParams.tokenIn,
            tokenOut: swapParams.tokenOut,
            amountIn: swapParams.amountIn.toString(),
            amountOutMin: swapParams.amountOutMin.toString(),
            deadline: swapParams.deadline.toString(),
            nonce: nonce.toString()
        };

        const swapPermitSignature = await this.signSwapPermit(signer, swapPermit);
        const swapSig = ethers.utils.splitSignature(swapPermitSignature);

        const tokenPermitSignature = await this.signTokenPermit(
            signer,
            swapParams.tokenIn,
            this.contractAddress,
            swapParams.amountIn,
            swapParams.deadline
        );
        const tokenSig = ethers.utils.splitSignature(tokenPermitSignature);

        const executor = relayer ? relayer : signer;
        const contractWithSigner = this.contract.connect(executor);

        const tx = await contractWithSigner.executeSwapWithPermit(
            [
                swapPermit.owner,
                swapPermit.tokenIn,
                swapPermit.tokenOut,
                swapPermit.amountIn,
                swapPermit.amountOutMin,
                swapPermit.deadline,
                swapPermit.nonce
            ],
            swapSig.v,
            swapSig.r,
            swapSig.s,
            tokenSig.v,
            tokenSig.r,
            tokenSig.s
        );

        return tx;
    }

    getDeadline(minutes = 20) {
        return Math.floor(Date.now() / 1000) + (minutes * 60);
    }

    parseTokenAmount(amount, decimals) {
        return ethers.utils.parseUnits(amount.toString(), decimals);
    }
}

async function main() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    const PERMIT_SWAP_CONTRACT = "0x..."; 
    const USDC_ADDRESS = "0xA0b86a33E6441d340B22c5C4F3db6C80e8b84EB4";
    const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

    const client = new UniswapPermitSwapClient(PERMIT_SWAP_CONTRACT, provider, 1);

    const swapParams = {
        tokenIn: USDC_ADDRESS,
        tokenOut: WETH_ADDRESS,
        amountIn: client.parseTokenAmount(1000, 6), 
        amountOutMin: ethers.utils.parseEther("0.3"), 
        deadline: client.getDeadline(20) 
    };

    try {
        const expectedOut = await client.getExpectedAmountOut(
            swapParams.tokenIn,
            swapParams.tokenOut,
            swapParams.amountIn
        );
        console.log("Expected output:", ethers.utils.formatEther(expectedOut), "WETH");

        const tx = await client.executeSwapWithPermit(signer, swapParams);
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt.transactionHash);

    } catch (error) {
        console.error("Swap failed:", error);
    }
}

import { useState, useCallback } from 'react';

export function useUniswapPermitSwap(contractAddress, chainId) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const executeSwap = useCallback(async (signer, swapParams) => {
        setIsLoading(true);
        setError(null);

        try {
            const provider = signer.provider;
            const client = new UniswapPermitSwapClient(contractAddress, provider, chainId);
            
            const tx = await client.executeSwapWithPermit(signer, swapParams);
            const receipt = await tx.wait();
            
            setIsLoading(false);
            return receipt;
        } catch (err) {
            setError(err.message);
            setIsLoading(false);
            throw err;
        }
    }, [contractAddress, chainId]);

    return { executeSwap, isLoading, error };
}

export { UniswapPermitSwapClient };