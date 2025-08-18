const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying MultiSigWalletFactory...");

  const Factory = await ethers.getContractFactory("MultiSigWalletFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  console.log("Factory deployed to:", await factory.getAddress());


  const [deployer, owner1, owner2] = await ethers.getSigners();
  const owners = [deployer.address, owner1.address, owner2.address];
  
  const tx = await factory.createWallet(owners);
  await tx.wait();
  
  const walletAddress = await factory.getWallet(0);
  console.log("Wallet created at:", walletAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});