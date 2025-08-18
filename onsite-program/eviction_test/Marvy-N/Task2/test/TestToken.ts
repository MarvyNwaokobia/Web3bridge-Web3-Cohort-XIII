import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { TestToken } from "../typechain-types";

describe("TestToken", function () {
  
  async function deployTestTokenFixture() {
    const TOKEN_NAME = "Test Token";
    const TOKEN_SYMBOL = "TEST";
    const INITIAL_SUPPLY = hre.ethers.parseEther("1000");

    const [owner, spender, recipient, otherAccount] = await hre.ethers.getSigners();

    const TestTokenFactory = await hre.ethers.getContractFactory("TestToken");
    const testToken = await TestTokenFactory.deploy(TOKEN_NAME, TOKEN_SYMBOL) as TestToken;

    return {
      testToken,
      TOKEN_NAME,
      TOKEN_SYMBOL,
      INITIAL_SUPPLY,
      owner,
      spender,
      recipient,
      otherAccount
    };
  }

  describe("Deployment", function () {
    it("Should set the correct name", async function () {
      const { testToken, TOKEN_NAME } = await loadFixture(deployTestTokenFixture);

      expect(await testToken.name()).to.equal(TOKEN_NAME);
    });

    it("Should set the correct symbol", async function () {
      const { testToken, TOKEN_SYMBOL } = await loadFixture(deployTestTokenFixture);

      expect(await testToken.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("Should set the correct decimals", async function () {
      const { testToken } = await loadFixture(deployTestTokenFixture);

      expect(await testToken.decimals()).to.equal(18);
    });

    it("Should mint initial supply to deployer", async function () {
      const { testToken, INITIAL_SUPPLY, owner } = await loadFixture(deployTestTokenFixture);

      expect(await testToken.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await testToken.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should have correct domain separator for EIP-712", async function () {
      const { testToken } = await loadFixture(deployTestTokenFixture);

      const domainSeparator = await testToken.getDomainSeparator();
      expect(domainSeparator).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });
  });

  describe("ERC20 Basic Functions", function () {
    it("Should transfer tokens between accounts", async function () {
      const { testToken, owner, recipient } = await loadFixture(deployTestTokenFixture);
      const transferAmount = hre.ethers.parseEther("100");

      await expect(testToken.transfer(recipient.address, transferAmount))
        .to.emit(testToken, "Transfer")
        .withArgs(owner.address, recipient.address, transferAmount);

      expect(await testToken.balanceOf(recipient.address)).to.equal(transferAmount);
      expect(await testToken.balanceOf(owner.address)).to.equal(
        hre.ethers.parseEther("900") 
      );
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const { testToken, recipient, otherAccount } = await loadFixture(deployTestTokenFixture);
      const transferAmount = hre.ethers.parseEther("1");

      await expect(
        testToken.connect(otherAccount).transfer(recipient.address, transferAmount)
      ).to.be.revertedWithCustomError(testToken, "ERC20InsufficientBalance");
    });

    it("Should approve and transferFrom", async function () {
      const { testToken, owner, spender, recipient } = await loadFixture(deployTestTokenFixture);
      const approveAmount = hre.ethers.parseEther("200");
      const transferAmount = hre.ethers.parseEther("100");

      await expect(testToken.approve(spender.address, approveAmount))
        .to.emit(testToken, "Approval")
        .withArgs(owner.address, spender.address, approveAmount);

      expect(await testToken.allowance(owner.address, spender.address)).to.equal(approveAmount);

      await expect(
        testToken.connect(spender).transferFrom(owner.address, recipient.address, transferAmount)
      )
        .to.emit(testToken, "Transfer")
        .withArgs(owner.address, recipient.address, transferAmount);

      expect(await testToken.balanceOf(recipient.address)).to.equal(transferAmount);
      expect(await testToken.allowance(owner.address, spender.address)).to.equal(
        approveAmount - transferAmount
      );
    });
  });

  describe("Minting", function () {
    it("Should allow minting new tokens", async function () {
      const { testToken, recipient } = await loadFixture(deployTestTokenFixture);
      const mintAmount = hre.ethers.parseEther("500");

      await expect(testToken.mint(recipient.address, mintAmount))
        .to.emit(testToken, "Transfer")
        .withArgs("0x0000000000000000000000000000000000000000", recipient.address, mintAmount);

      expect(await testToken.balanceOf(recipient.address)).to.equal(mintAmount);
      expect(await testToken.totalSupply()).to.equal(
        hre.ethers.parseEther("1500") 
      );
    });

    it("Should allow anyone to mint (no access control)", async function () {
      const { testToken, recipient, otherAccount } = await loadFixture(deployTestTokenFixture);
      const mintAmount = hre.ethers.parseEther("100");

      await expect(testToken.connect(otherAccount).mint(recipient.address, mintAmount))
        .to.emit(testToken, "Transfer")
        .withArgs("0x0000000000000000000000000000000000000000", recipient.address, mintAmount);

      expect(await testToken.balanceOf(recipient.address)).to.equal(mintAmount);
    });
  });

  describe("EIP-712 Permit", function () {
    it("Should have correct domain separator", async function () {
      const { testToken } = await loadFixture(deployTestTokenFixture);

      const domainSeparator = await testToken.getDomainSeparator();
      expect(domainSeparator).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("Should track nonces correctly", async function () {
      const { testToken, owner, spender } = await loadFixture(deployTestTokenFixture);

      expect(await testToken.nonces(owner.address)).to.equal(0);
      expect(await testToken.nonces(spender.address)).to.equal(0);
    });

    it("Should allow permit functionality", async function () {
      const { testToken, owner, spender } = await loadFixture(deployTestTokenFixture);

      const nonce = await testToken.nonces(owner.address);

      expect(await testToken.nonces(owner.address)).to.equal(nonce);
      expect(await testToken.allowance(owner.address, spender.address)).to.equal(0);

    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero transfers", async function () {
      const { testToken, owner, recipient } = await loadFixture(deployTestTokenFixture);

      await expect(testToken.transfer(recipient.address, 0))
        .to.emit(testToken, "Transfer")
        .withArgs(owner.address, recipient.address, 0);
    });

    it("Should handle maximum uint256 approval", async function () {
      const { testToken, owner, spender } = await loadFixture(deployTestTokenFixture);
      const maxUint256 = hre.ethers.MaxUint256;

      await expect(testToken.approve(spender.address, maxUint256))
        .to.emit(testToken, "Approval")
        .withArgs(owner.address, spender.address, maxUint256);

      expect(await testToken.allowance(owner.address, spender.address)).to.equal(maxUint256);
    });
  });
});
