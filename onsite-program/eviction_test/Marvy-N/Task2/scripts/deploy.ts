import { ethers } from "hardhat";
import { TestToken } from "../typechain-types";


async function main() {
  console.log("🚀 Starting TestToken deployment...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  console.log("🏗️  Deploying TestToken...");
  const TestTokenFactory = await ethers.getContractFactory("TestToken");

  const testToken: TestToken = await TestTokenFactory.deploy(
    "Test Token",
    "TEST"
  );

  await testToken.waitForDeployment();
  const tokenAddress = await testToken.getAddress();

  console.log("✅ TestToken deployed to:", tokenAddress);
  console.log("📊 Token details:");
  console.log("   - Name:", await testToken.name());
  console.log("   - Symbol:", await testToken.symbol());
  console.log("   - Decimals:", await testToken.decimals());
  console.log("   - Total Supply:", ethers.formatEther(await testToken.totalSupply()), "TEST");
  console.log("   - Deployer Balance:", ethers.formatEther(await testToken.balanceOf(deployer.address)), "TEST");
  
  const network = await ethers.provider.getNetwork();
  if (network.chainId === 11155111n) {
    console.log("\n🔍 Contract verification info:");
    console.log("Run this command to verify on Etherscan:");
    console.log(`npx hardhat verify --network sepolia ${tokenAddress} "Test Token" "TEST"`);
  }

  console.log("\n📋 Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎯 TestToken Address:", tokenAddress);
  console.log("🌐 Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("⛽ Gas Used: Check transaction receipt above");
  console.log("📸 Screenshot: Save this output as 'deploy.png'");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const deploymentInfo = {
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
  
  console.log("💾 Deployment info saved to deployments/token.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });