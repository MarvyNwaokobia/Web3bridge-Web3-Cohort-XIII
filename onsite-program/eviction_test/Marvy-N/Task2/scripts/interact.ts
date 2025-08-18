import { ethers } from "hardhat";
import { TestToken } from "../typechain-types";
import { Contract, Wallet } from "ethers";

const ROUTER_ABI = [
  "function removeLiquidityETHWithPermit(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) external returns (uint amountToken, uint amountETH)",
  "function removeLiquidityWithPermit(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) external returns (uint amountA, uint amountB)",
  "function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
  "function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)"
];

const ADDRESSES = {
  mainnet: {
    ROUTER: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
  },
  sepolia: {
    ROUTER: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", 
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" 
  }
};

interface DeploymentInfo {
  tokenAddress: string;
  network: string;
  chainId: string;
  deployerAddress: string;
  deploymentBlock: number;
}


async function generatePermitSignature(
  token: TestToken,
  owner: Wallet,
  spender: string,
  value: bigint,
  deadline: number
): Promise<{ v: number; r: string; s: string }> {
  const name = await token.name();
  const chainId = await token.getFunction("DOMAIN_SEPARATOR").staticCall().then(() => 
    ethers.provider.getNetwork().then(n => n.chainId)
  );
  const tokenAddress = await token.getAddress();
  const nonce = await token.nonces(owner.address);

  const domain = {
    name,
    version: "1",
    chainId: Number(chainId),
    verifyingContract: tokenAddress
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ]
  };

  const values = {
    owner: owner.address,
    spender,
    value: value.toString(),
    nonce: Number(nonce),
    deadline
  };

  const signature = await owner.signTypedData(domain, types, values);
  const sig = ethers.Signature.from(signature);
  
  return {
    v: sig.v,
    r: sig.r,
    s: sig.s
  };
}


async function deployTestToken(): Promise<DeploymentInfo> {
  console.log("🚀 Deploying TestToken for interaction testing...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);

  const TestTokenFactory = await ethers.getContractFactory("TestToken");
  const testToken = await TestTokenFactory.deploy("Test Token", "TEST");
  await testToken.waitForDeployment();

  const tokenAddress = await testToken.getAddress();
  const network = await ethers.provider.getNetwork();

  console.log("✅ TestToken deployed to:", tokenAddress);

  const deploymentInfo: DeploymentInfo = {
    tokenAddress: tokenAddress,
    network: network.name,
    chainId: network.chainId.toString(),
    deployerAddress: deployer.address,
    deploymentBlock: await ethers.provider.getBlockNumber()
  };

  const fs = require('fs');
  const path = require('path');
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, 'token.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );

  return deploymentInfo;
}

async function main() {
  console.log("🦄 Starting Uniswap V2 Router02 Interaction Script\n");

  let deploymentInfo: DeploymentInfo;
  try {
    const fs = require('fs');
    const path = require('path');
    const deploymentPath = path.join(__dirname, '..', 'deployments', 'token.json');
    deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    console.log("📂 Loaded deployment info from deployments/token.json");
  } catch (error) {
    console.log("⚠️  Could not load deployment info. Will deploy TestToken first...");
    deploymentInfo = await deployTestToken();
  }
  
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const isMainnet = network.chainId === 1n;
  const isHardhat = network.chainId === 31337n;

  console.log("🌐 Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("👤 Signer Address:", signer.address);
  console.log("💰 ETH Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH\n");

  const addresses = isMainnet ? ADDRESSES.mainnet : ADDRESSES.sepolia;

  if (isHardhat) {
    console.log("💡 Running on Hardhat local network - using Sepolia addresses for testing");
    console.log("💡 Note: Uniswap contracts are not deployed on local network\n");
  }
  
  const token = await ethers.getContractAt("TestToken", deploymentInfo.tokenAddress, signer) as TestToken;
  const router = new Contract(addresses.ROUTER, ROUTER_ABI, signer);

  console.log("📄 Contract Addresses:");
  console.log("   - TestToken:", await token.getAddress());
  console.log("   - Uniswap Router:", addresses.ROUTER);
  console.log("   - WETH:", addresses.WETH, "\n");

  const contractCode = await ethers.provider.getCode(deploymentInfo.tokenAddress);
  if (contractCode === "0x") {
    if (isHardhat) {
      console.log("⚠️  TestToken contract not found at address:", deploymentInfo.tokenAddress);
      console.log("🚀 Deploying TestToken on Hardhat network...");
      deploymentInfo = await deployTestToken();
    } else {
      console.error("❌ TestToken contract not found at address:", deploymentInfo.tokenAddress);
      console.error("💡 Please run the deploy script first: npx hardhat run scripts/deploy.ts --network", network.name);
      process.exit(1);
    }
  }

  const tokenBalance = await token.balanceOf(signer.address);
  console.log("📊 Initial Balances:");
  console.log("   - TEST Tokens:", ethers.formatEther(tokenBalance));
  console.log("   - ETH:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "\n");
  
  const deadline = Math.floor(Date.now() / 1000) + 1800; 
  const amountIn = ethers.parseEther("1"); 
  const amountOut = ethers.parseEther("0.1"); 
  const minAmountOut = ethers.parseEther("0.05");
  const path = [await token.getAddress(), addresses.WETH];
  const reversePath = [addresses.WETH, await token.getAddress()];
  
  console.log("🎯 Transaction Parameters:");
  console.log("   - Deadline:", new Date(deadline * 1000).toLocaleString());
  console.log("   - Amount In:", ethers.formatEther(amountIn), "TEST");
  console.log("   - Min Amount Out:", ethers.formatEther(minAmountOut), "tokens");
  console.log("   - Slippage Tolerance: ~5%\n");
  
  try {
    console.log("💡 Note: This script assumes a TEST/WETH pair already exists on Uniswap V2");
    console.log("💡 To create a pair, you would need to call router.addLiquidityETH() first\n");
    
    console.log("1️⃣  Testing swapTokensForExactTokens");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    try {
      console.log("📝 Approving router to spend TEST tokens...");
      const approveTx = await token.approve(addresses.ROUTER, ethers.parseEther("100"));
      await approveTx.wait();
      console.log("✅ Approval TX:", approveTx.hash);
      
      const requiredAmounts = await router.getAmountsIn(amountOut, path);
      console.log("💹 Required input amount:", ethers.formatEther(requiredAmounts[0]), "TEST");
      
      const swapTx = await router.swapTokensForExactTokens(
        amountOut,           
        requiredAmounts[0],  
        path,               
        signer.address,     
        deadline           
      );
      
      await swapTx.wait();
      console.log("🎉 swapTokensForExactTokens TX:", swapTx.hash);
      console.log("📸 Screenshot: Save this as 'swapTokensForExactTokens.png'\n");
    } catch (error: any) {
      console.log("⚠️  swapTokensForExactTokens failed (likely no liquidity):", error.reason || error.message);
      console.log("📸 Screenshot: Save this error as 'swapTokensForExactTokens_error.png'\n");
    }

    console.log("2️⃣  Testing swapExactTokensForETHSupportingFeeOnTransferTokens");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    try {
      const swapTx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
        amountIn,           
        minAmountOut,       
        path,               
        signer.address,     
        deadline           
      );
      
      await swapTx.wait();
      console.log("🎉 swapExactTokensForETHSupportingFeeOnTransferTokens TX:", swapTx.hash);
      console.log("📸 Screenshot: Save this as 'swapExactTokensForETHSupportingFeeOnTransferTokens.png'\n");
    } catch (error: any) {
      console.log("⚠️  swapExactTokensForETHSupportingFeeOnTransferTokens failed:", error.reason || error.message);
      console.log("📸 Screenshot: Save this error as 'swapExactTokensForETHSupportingFeeOnTransferTokens_error.png'\n");
    }
    
    console.log("3️⃣  Testing swapTokensForExactETH");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    try {
      const ethAmountOut = ethers.parseEther("0.001"); 
      const requiredAmounts = await router.getAmountsIn(ethAmountOut, path);
      
      const swapTx = await router.swapTokensForExactETH(
        ethAmountOut,       
        requiredAmounts[0], 
        path,               
        signer.address,   
        deadline          
      );
      
      await swapTx.wait();
      console.log("🎉 swapTokensForExactETH TX:", swapTx.hash);
      console.log("📸 Screenshot: Save this as 'swapTokensForExactETH.png'\n");
    } catch (error: any) {
      console.log("⚠️  swapTokensForExactETH failed:", error.reason || error.message);
      console.log("📸 Screenshot: Save this error as 'swapTokensForExactETH_error.png'\n");
    }
    
    console.log("4️⃣  Testing swapETHForExactTokens");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    try {
      const tokenAmountOut = ethers.parseEther("0.5"); 
      const requiredAmounts = await router.getAmountsIn(tokenAmountOut, reversePath);
      
      const swapTx = await router.swapETHForExactTokens(
        tokenAmountOut,    
        reversePath,        
        signer.address,    
        deadline,          
        { value: requiredAmounts[0] } 
      );
      
      await swapTx.wait();
      console.log("🎉 swapETHForExactTokens TX:", swapTx.hash);
      console.log("📸 Screenshot: Save this as 'swapETHForExactTokens.png'\n");
    } catch (error: any) {
      console.log("⚠️  swapETHForExactTokens failed:", error.reason || error.message);
      console.log("📸 Screenshot: Save this error as 'swapETHForExactTokens_error.png'\n");
    }
    
    console.log("5️⃣  Testing swapExactTokensForTokensSupportingFeeOnTransferTokens");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    try {
      const circularPath = [await token.getAddress(), addresses.WETH, await token.getAddress()];
      
      const swapTx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,          
        minAmountOut,       
        circularPath,     
        signer.address,     
        deadline          
      );
      
      await swapTx.wait();
      console.log("🎉 swapExactTokensForTokensSupportingFeeOnTransferTokens TX:", swapTx.hash);
      console.log("📸 Screenshot: Save this as 'swapExactTokensForTokensSupportingFeeOnTransferTokens.png'\n");
    } catch (error: any) {
      console.log("⚠️  swapExactTokensForTokensSupportingFeeOnTransferTokens failed:", error.reason || error.message);
      console.log("📸 Screenshot: Save this error as 'swapExactTokensForTokensSupportingFeeOnTransferTokens_error.png'\n");
    }
    
    console.log("6️⃣  Testing removeLiquidityETHWithPermit");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      console.log("💡 Note: This requires existing liquidity in a TEST/ETH pair");
      console.log("⚠️  Skipping removeLiquidityETHWithPermit (requires LP tokens)");
      console.log("📸 Screenshot: Save this message as 'removeLiquidityETHWithPermit_skipped.png'\n");
    } catch (error: any) {
      console.log("⚠️  removeLiquidityETHWithPermit failed:", error.reason || error.message);
      console.log("📸 Screenshot: Save this error as 'removeLiquidityETHWithPermit_error.png'\n");
    }

    console.log("7️⃣  Testing removeLiquidityWithPermit");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      console.log("💡 Note: This requires existing liquidity in a token pair");
      console.log("⚠️  Skipping removeLiquidityWithPermit (requires LP tokens)");
      console.log("📸 Screenshot: Save this message as 'removeLiquidityWithPermit_skipped.png'\n");
    } catch (error: any) {
      console.log("⚠️  removeLiquidityWithPermit failed:", error.reason || error.message);
      console.log("📸 Screenshot: Save this error as 'removeLiquidityWithPermit_error.png'\n");
    }

    console.log("8️⃣  Testing addLiquidityETH");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      const tokenAmount = ethers.parseEther("10"); 
      const ethAmount = ethers.parseEther("0.01"); 
      const minTokenAmount = ethers.parseEther("9");
      const minEthAmount = ethers.parseEther("0.009");

      console.log("📝 Approving router to spend TEST tokens for liquidity...");
      const approveTx = await token.approve(addresses.ROUTER, tokenAmount);
      await approveTx.wait();
      console.log("✅ Approval TX:", approveTx.hash);

      const addLiquidityTx = await router.addLiquidityETH(
        await token.getAddress(), 
        tokenAmount,             
        minTokenAmount,         
        minEthAmount,            
        signer.address,          
        deadline,                 
        { value: ethAmount }      
      );

      await addLiquidityTx.wait();
      console.log("🎉 addLiquidityETH TX:", addLiquidityTx.hash);
      console.log("📸 Screenshot: Save this as 'addLiquidityETH.png'\n");
    } catch (error: any) {
      console.log("⚠️  addLiquidityETH failed:", error.reason || error.message);
      console.log("📸 Screenshot: Save this error as 'addLiquidityETH_error.png'\n");
    }

    console.log("9️⃣  Testing getAmountsOut");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      const testAmount = ethers.parseEther("1");
      const amounts = await router.getAmountsOut(testAmount, path);
      console.log("💹 getAmountsOut result:");
      console.log("   - Input:", ethers.formatEther(amounts[0]), "TEST");
      console.log("   - Output:", ethers.formatEther(amounts[1]), "WETH");
      console.log("📸 Screenshot: Save this as 'getAmountsOut.png'\n");
    } catch (error: any) {
      console.log("⚠️  getAmountsOut failed:", error.reason || error.message);
      console.log("📸 Screenshot: Save this error as 'getAmountsOut_error.png'\n");
    }

    console.log("🔟 Testing getAmountsIn");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      const desiredOutput = ethers.parseEther("0.001");
      const amounts = await router.getAmountsIn(desiredOutput, path);
      console.log("💹 getAmountsIn result:");
      console.log("   - Required Input:", ethers.formatEther(amounts[0]), "TEST");
      console.log("   - Desired Output:", ethers.formatEther(amounts[1]), "WETH");
      console.log("📸 Screenshot: Save this as 'getAmountsIn.png'\n");
    } catch (error: any) {
      console.log("⚠️  getAmountsIn failed:", error.reason || error.message);
      console.log("📸 Screenshot: Save this error as 'getAmountsIn_error.png'\n");
    }

  } catch (error: any) {
    console.error("❌ Script execution failed:", error);
    process.exit(1);
  }

  const finalTokenBalance = await token.balanceOf(signer.address);
  const finalEthBalance = await ethers.provider.getBalance(signer.address);

  console.log("📊 Final Balances:");
  console.log("   - TEST Tokens:", ethers.formatEther(finalTokenBalance));
  console.log("   - ETH:", ethers.formatEther(finalEthBalance));

  console.log("\n📋 Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎯 TestToken Address:", await token.getAddress());
  console.log("🦄 Uniswap Router:", addresses.ROUTER);
  console.log("🌐 Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("💡 Note: Most swaps will fail without existing liquidity pairs");
  console.log("💡 To create liquidity, use addLiquidityETH first");
  console.log("📸 Screenshot: Save this summary as 'interaction_summary.png'");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Interaction script failed:", error);
    process.exit(1);
  });