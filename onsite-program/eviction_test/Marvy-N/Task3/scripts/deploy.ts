import { ethers } from "hardhat";

async function main() {
  console.log("🎲 Starting Ludo Game deployment...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  try {
    console.log("🪙 Deploying LudoToken...");
    const LudoTokenFactory = await ethers.getContractFactory("LudoToken");
    const ludoToken = await LudoTokenFactory.deploy(deployer.address);
    await ludoToken.waitForDeployment();

    const ludoTokenAddress = await ludoToken.getAddress();
    console.log("✅ LudoToken deployed to:", ludoTokenAddress);

    const ludoTokenDeployTx = ludoToken.deploymentTransaction();
    if (ludoTokenDeployTx) {
      console.log("📋 LudoToken deployment tx hash:", ludoTokenDeployTx.hash);
    }
    console.log("");

    console.log("🎮 Deploying LudoGame...");
    const LudoGameFactory = await ethers.getContractFactory("LudoGame");
    const ludoGame = await LudoGameFactory.deploy(ludoTokenAddress, deployer.address);
    await ludoGame.waitForDeployment();
    
    const ludoGameAddress = await ludoGame.getAddress();
    console.log("✅ LudoGame deployed to:", ludoGameAddress);
    
    const ludoGameDeployTx = ludoGame.deploymentTransaction();
    if (ludoGameDeployTx) {
      console.log("📋 LudoGame deployment tx hash:", ludoGameDeployTx.hash);
    }
    console.log("");

    console.log("💸 Transferring prize pool to game contract...");
    const prizePoolAmount = ethers.parseEther("100"); 
    const transferTx = await ludoToken.transfer(ludoGameAddress, prizePoolAmount);
    await transferTx.wait();
    
    console.log("✅ Transferred", ethers.formatEther(prizePoolAmount), "LUDO tokens to game contract");
    console.log("📋 Transfer tx hash:", transferTx.hash);
    console.log("");

    const deployerBalance = await ludoToken.balanceOf(deployer.address);
    const gameBalance = await ludoToken.balanceOf(ludoGameAddress);
    const totalSupply = await ludoToken.totalSupply();

    console.log("📊 Token Distribution:");
    console.log("   Deployer balance:", ethers.formatEther(deployerBalance), "LUDO");
    console.log("   Game contract balance:", ethers.formatEther(gameBalance), "LUDO");
    console.log("   Total supply:", ethers.formatEther(totalSupply), "LUDO");
    console.log("");

    console.log("🎯 Deployment Summary:");
    console.log("=".repeat(50));
    console.log("LudoToken Address:", ludoTokenAddress);
    console.log("LudoGame Address:", ludoGameAddress);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Deployer:", deployer.address);
    console.log("=".repeat(50));
    console.log("");

    const deploymentInfo = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      deployer: deployer.address,
      contracts: {
        LudoToken: {
          address: ludoTokenAddress,
          deploymentTxHash: ludoTokenDeployTx?.hash
        },
        LudoGame: {
          address: ludoGameAddress,
          deploymentTxHash: ludoGameDeployTx?.hash
        }
      },
      deploymentTime: new Date().toISOString()
    };

    const fs = require('fs');
    const path = require('path');
    
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentsDir, `deployment-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("💾 Deployment info saved to:", deploymentFile);
    console.log("");

    console.log("🎉 Deployment completed successfully!");
    console.log("");
    console.log("📸 SCREENSHOT INSTRUCTIONS:");
    console.log("1. Save this console output as 'deploy.png'");
    console.log("2. Visit the block explorer and screenshot the contract deployment transactions:");

    const network = await ethers.provider.getNetwork();
    let explorerUrl = "";

    if (network.chainId === 4202n) { 
      explorerUrl = "https://sepolia-blockscout.lisk.com";
    } else if (network.chainId === 11155111n) { 
      explorerUrl = "https://sepolia.etherscan.io";
    } else {
      explorerUrl = "https://etherscan.io"; 
    }

    console.log(`   - LudoToken: ${explorerUrl}/tx/${ludoTokenDeployTx?.hash}`);
    console.log(`   - LudoGame: ${explorerUrl}/tx/${ludoGameDeployTx?.hash}`);
    console.log("");
    console.log("🚀 Ready to interact with the contracts!");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment script failed:", error);
    process.exit(1);
  });
