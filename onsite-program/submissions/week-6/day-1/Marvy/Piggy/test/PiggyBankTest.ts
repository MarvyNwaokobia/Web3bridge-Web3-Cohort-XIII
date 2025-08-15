const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");

describe("PiggyBankFactory Contract", function () {
  async function deployFactory() {
    const [owner, user1, user2, nonUser] = await hre.ethers.getSigners();

    const PiggyBankFactory = await hre.ethers.getContractFactory("PiggyBankFactory");
    const factory = await PiggyBankFactory.deploy();

    return { factory, owner, user1, user2, nonUser };
  }

  describe("Deployment", function () {
    it("Should deploy the contract correctly", async function () {
      const { factory } = await loadFixture(deployFactory);
      expect(factory.address).to.not.equal(hre.ethers.ZeroAddress);
    });
  });

  describe("Main Functions", function () {
    it("Should create a new ETH PiggyBank", async function () {
      const { factory, user1 } = await loadFixture(deployFactory);

      await expect(factory.connect(user1).createPiggyBank(true, hre.ethers.ZeroAddress, 10))
        .to.emit(factory, "PiggyBankCreated");

      const count = await factory.getUserPiggyBankCount(user1.address);
      expect(count).to.equal(1);

      const banks = await factory.getUserPiggyBanks(user1.address);
      expect(banks.length).to.equal(1);
    });

    it("Should create a new ERC20 PiggyBank", async function () {
      const { factory, user1 } = await loadFixture(deployFactory);

      const ERC20Mock = await hre.ethers.getContractFactory("ERC20Mock");
      const token = await ERC20Mock.deploy("Mock Token", "MTK", user1.address, hre.ethers.parseEther("1000"));

      await expect(factory.connect(user1).createPiggyBank(false, token.target, 10))
        .to.emit(factory, "PiggyBankCreated");

      const banks = await factory.getUserPiggyBanks(user1.address);
      expect(banks.length).to.equal(1);
    });

    it("Should fail with duplicate lock period", async function () {
      const { factory, user1 } = await loadFixture(deployFactory);

      await factory.connect(user1).createPiggyBank(true, hre.ethers.ZeroAddress, 10);

      await expect(factory.connect(user1).createPiggyBank(true, hre.ethers.ZeroAddress, 10))
        .to.be.revertedWithCustomError(factory, "DuplicateLockPeriod");
    });

    it("Should fail with invalid parameters", async function () {
      const { factory, user1 } = await loadFixture(deployFactory);

      await expect(factory.connect(user1).createPiggyBank(true, hre.ethers.ZeroAddress, 0))
        .to.be.revertedWithCustomError(factory, "InvalidParameters");

      await expect(factory.connect(user1).createPiggyBank(false, hre.ethers.ZeroAddress, 10))
        .to.be.revertedWithCustomError(factory, "InvalidParameters");
    });

    it("Should return aggregated balances", async function () {
      const { factory, user1 } = await loadFixture(deployFactory);

      await factory.connect(user1).createPiggyBank(true, hre.ethers.ZeroAddress, 10);
      const banks = await factory.getUserPiggyBanks(user1.address);

      const piggy = await hre.ethers.getContractAt("PiggyBank", banks[0]);
      await piggy.connect(user1).deposit(0, { value: hre.ethers.parseEther("1") });

      const [ethBalance, tokenBalances, tokens] = await factory.getUserTotalBalance(user1.address);
      expect(ethBalance).to.equal(hre.ethers.parseEther("1"));
      expect(tokenBalances.length).to.equal(1);
      expect(tokens.length).to.equal(1);
    });
  });
});