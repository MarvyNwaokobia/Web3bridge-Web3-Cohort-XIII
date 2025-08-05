const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC20 Token", function () {
  let token;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  const INITIAL_SUPPLY = 1000000; 
  const TOKEN_NAME = "MyToken";
  const TOKEN_SYMBOL = "MTK";
  const DECIMALS = 18;

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Erc20");
    token = await Token.deploy(INITIAL_SUPPLY);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right token details", async function () {
      expect(await token.name()).to.equal(TOKEN_NAME);
      expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
      expect(await token.decimals()).to.equal(DECIMALS);
    });

    it("Should assign the total supply to the owner", async function () {
      const ownerBalance = await token.balanceOf(owner.address);
      expect(await token.totalSupply()).to.equal(ownerBalance);
    });

    it("Should have correct total supply", async function () {
      const expectedSupply = ethers.parseUnits(INITIAL_SUPPLY.toString(), DECIMALS);
      expect(await token.totalSupply()).to.equal(expectedSupply);
    });

    it("Should emit Transfer event on deployment", async function () {
      // Deploy a fresh contract to check the event
      const Token = await ethers.getContractFactory("Erc20");
      const expectedSupply = ethers.parseUnits(INITIAL_SUPPLY.toString(), DECIMALS);
      
      // Deploy and check for the Transfer event
      const newToken = await Token.deploy(INITIAL_SUPPLY);
      
      // Get the deployment transaction receipt
      const deployTx = newToken.deploymentTransaction();
      await expect(deployTx)
        .to.emit(newToken, "Transfer")
        .withArgs(ethers.ZeroAddress, owner.address, expectedSupply);
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseUnits("50", DECIMALS);
      
      // Transfer 50 tokens from owner to addr1
      await expect(token.transfer(addr1.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, transferAmount);

      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(transferAmount);

      const ownerBalance = await token.balanceOf(owner.address);
      const expectedOwnerBalance = ethers.parseUnits(INITIAL_SUPPLY.toString(), DECIMALS) - transferAmount;
      expect(ownerBalance).to.equal(expectedOwnerBalance);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await token.balanceOf(owner.address);
      const excessiveAmount = initialOwnerBalance + 1n;

      await expect(
        token.transfer(addr1.address, excessiveAmount)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });

    it("Should fail when transferring to zero address", async function () {
      const transferAmount = ethers.parseUnits("50", DECIMALS);

      await expect(
        token.transfer(ethers.ZeroAddress, transferAmount)
      ).to.be.revertedWithCustomError(token, "InvalidAddress");
    });

    it("Should update balances after transfers", async function () {
      const transferAmount = ethers.parseUnits("100", DECIMALS);
      
      const initialOwnerBalance = await token.balanceOf(owner.address);
      const initialAddr1Balance = await token.balanceOf(addr1.address);

      await token.transfer(addr1.address, transferAmount);

      expect(await token.balanceOf(owner.address)).to.equal(
        initialOwnerBalance - transferAmount
      );
      expect(await token.balanceOf(addr1.address)).to.equal(
        initialAddr1Balance + transferAmount
      );
    });
  });

  describe("Allowances", function () {
    it("Should approve tokens for delegated transfer", async function () {
      const approveAmount = ethers.parseUnits("100", DECIMALS);

      await expect(token.approve(addr1.address, approveAmount))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, approveAmount);

      const allowance = await token.allowance(owner.address, addr1.address);
      expect(allowance).to.equal(approveAmount);
    });

    it("Should fail when approving zero address", async function () {
      const approveAmount = ethers.parseUnits("100", DECIMALS);

      await expect(
        token.approve(ethers.ZeroAddress, approveAmount)
      ).to.be.revertedWithCustomError(token, "InvalidAddress");
    });

    it("Should allow approved spender to transfer tokens", async function () {
      const approveAmount = ethers.parseUnits("100", DECIMALS);
      const transferAmount = ethers.parseUnits("50", DECIMALS);

      // Owner approves addr1 to spend tokens
      await token.approve(addr1.address, approveAmount);

      // addr1 transfers tokens from owner to addr2
      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)
      ).to.emit(token, "Transfer")
        .withArgs(owner.address, addr2.address, transferAmount);

      // Check balances
      expect(await token.balanceOf(addr2.address)).to.equal(transferAmount);
      
      // Check remaining allowance
      const remainingAllowance = await token.allowance(owner.address, addr1.address);
      expect(remainingAllowance).to.equal(approveAmount - transferAmount);
    });

    it("Should fail if transfer amount exceeds allowance", async function () {
      const approveAmount = ethers.parseUnits("50", DECIMALS);
      const transferAmount = ethers.parseUnits("100", DECIMALS);

      await token.approve(addr1.address, approveAmount);

      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)
      ).to.be.revertedWithCustomError(token, "InsufficientAllowance");
    });

    it("Should fail if owner doesn't have enough balance for transferFrom", async function () {
      const transferAmount = ethers.parseUnits("100", DECIMALS);
      
      // addr1 has no tokens but we approve addr2 to spend
      await token.connect(addr1).approve(addr2.address, transferAmount);

      await expect(
        token.connect(addr2).transferFrom(addr1.address, owner.address, transferAmount)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });

    it("Should fail transferFrom with invalid addresses", async function () {
      const transferAmount = ethers.parseUnits("50", DECIMALS);

      await expect(
        token.transferFrom(ethers.ZeroAddress, addr1.address, transferAmount)
      ).to.be.revertedWithCustomError(token, "InvalidAddress");

      await expect(
        token.transferFrom(owner.address, ethers.ZeroAddress, transferAmount)
      ).to.be.revertedWithCustomError(token, "InvalidAddress");
    });

    it("Should allow updating allowance", async function () {
      const firstAllowance = ethers.parseUnits("100", DECIMALS);
      const secondAllowance = ethers.parseUnits("200", DECIMALS);

      // First approval
      await token.approve(addr1.address, firstAllowance);
      expect(await token.allowance(owner.address, addr1.address)).to.equal(firstAllowance);

      // Update approval
      await token.approve(addr1.address, secondAllowance);
      expect(await token.allowance(owner.address, addr1.address)).to.equal(secondAllowance);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero amount transfers", async function () {
      await expect(token.transfer(addr1.address, 0))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, 0);

      // Balances should remain unchanged
      const totalSupply = await token.totalSupply();
      expect(await token.balanceOf(owner.address)).to.equal(totalSupply);
      expect(await token.balanceOf(addr1.address)).to.equal(0);
    });

    it("Should handle zero amount approvals", async function () {
      await expect(token.approve(addr1.address, 0))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, 0);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(0);
    });

    it("Should handle self transfers", async function () {
      const transferAmount = ethers.parseUnits("100", DECIMALS);
      const initialBalance = await token.balanceOf(owner.address);

      await expect(token.transfer(owner.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, owner.address, transferAmount);

      // Balance should remain the same
      expect(await token.balanceOf(owner.address)).to.equal(initialBalance);
    });

    it("Should handle multiple transfers correctly", async function () {
      const amount1 = ethers.parseUnits("100", DECIMALS);
      const amount2 = ethers.parseUnits("200", DECIMALS);
      const amount3 = ethers.parseUnits("50", DECIMALS);

      // Multiple transfers
      await token.transfer(addr1.address, amount1);
      await token.transfer(addr2.address, amount2);
      await token.connect(addr1).transfer(addr2.address, amount3);

      // Check final balances
      expect(await token.balanceOf(addr1.address)).to.equal(amount1 - amount3);
      expect(await token.balanceOf(addr2.address)).to.equal(amount2 + amount3);
    });
  });

  describe("View Functions", function () {
    it("Should return correct token information", async function () {
      expect(await token.name()).to.equal(TOKEN_NAME);
      expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
      expect(await token.decimals()).to.equal(DECIMALS);
    });

    it("Should return correct balances", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(await token.totalSupply());
      expect(await token.balanceOf(addr1.address)).to.equal(0);
    });

    it("Should return correct allowances", async function () {
      expect(await token.allowance(owner.address, addr1.address)).to.equal(0);
      
      const approveAmount = ethers.parseUnits("500", DECIMALS);
      await token.approve(addr1.address, approveAmount);
      
      expect(await token.allowance(owner.address, addr1.address)).to.equal(approveAmount);
    });
  });

  describe("Gas Usage", function () {
    it("Should have reasonable gas costs for transfers", async function () {
      const transferAmount = ethers.parseUnits("100", DECIMALS);
      const tx = await token.transfer(addr1.address, transferAmount);
      const receipt = await tx.wait();
      
      // Gas usage should be reasonable (adjust threshold as needed)
      expect(receipt.gasUsed).to.be.below(100000);
    });

    it("Should have reasonable gas costs for approvals", async function () {
      const approveAmount = ethers.parseUnits("100", DECIMALS);
      const tx = await token.approve(addr1.address, approveAmount);
      const receipt = await tx.wait();
      
      expect(receipt.gasUsed).to.be.below(50000);
    });
  });
});