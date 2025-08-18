const { ethers } = require("hardhat");

async function main() {
  console.log("🎰 Deploying Lottery Smart Contract...\n");

  const [deployer] = await ethers.getSigners();
  
  console.log("📝 Deployment Details:");
  console.log("├─ Deployer address:", deployer.address);
  console.log("├─ Network:", hre.network.name);
  
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log("├─ Deployer balance:", ethers.formatEther(deployerBalance), "ETH\n");

  if (deployerBalance < ethers.parseEther("0.1")) {
    console.warn("⚠️  Warning: Low balance. Make sure you have enough ET}H to cover deployment costs and testing fees.");
  }

  const Lottery = await ethers.getContractFactory("Lottery");
  const lottery = await Lottery.deploy();
  
  await lottery.waitForDeployment();
  
  console.log("└─ Lottery contract deployed to:", await lottery.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});