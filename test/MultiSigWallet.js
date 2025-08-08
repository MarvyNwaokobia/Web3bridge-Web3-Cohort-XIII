const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet System", function () {
  let multiSigFactory;
  let multiSigWallet;
  let owner1, owner2, owner3, owner4, nonOwner, recipient;
  let owners;

  beforeEach(async function () {
    [owner1, owner2, owner3, owner4, nonOwner, recipient] = await ethers.getSigners();
    owners = [owner1.address, owner2.address, owner3.address, owner4.address];

    const MultiSigFactory = await ethers.getContractFactory("MultiSigWalletFactory");
    multiSigFactory = await MultiSigFactory.deploy();
    await multiSigFactory.waitForDeployment();
  });

  describe("MultiSigWalletFactory", function () {
    it("Should create a new wallet", async function () {
      const tx = await multiSigFactory.createWallet(owners);
      const receipt = await tx.wait();
      
      const walletAddress = await multiSigFactory.getWallet(0);
      expect(walletAddress).to.not.equal(ethers.ZeroAddress);
      
      const walletsCount = await multiSigFactory.getWalletsCount();
      expect(walletsCount).to.equal(1);
    });

    it("Should revert if less than 3 owners provided", async function () {
      await expect(
        multiSigFactory.createWallet([owner1.address, owner2.address])
      ).to.be.revertedWith("Need at least 3 owners");
    });

    it("Should track user wallets correctly", async function () {
      await multiSigFactory.createWallet(owners);
      const walletAddress = await multiSigFactory.getWallet(0);
      
      const owner1Wallets = await multiSigFactory.getUserWallets(owner1.address);
      expect(owner1Wallets).to.include(walletAddress);
      
      const owner2Wallets = await multiSigFactory.getUserWallets(owner2.address);
      expect(owner2Wallets).to.include(walletAddress);
    });

    it("Should emit WalletCreated event", async function () {
      await expect(multiSigFactory.createWallet(owners))
        .to.emit(multiSigFactory, "WalletCreated");
    });
  });

  describe("MultiSigWallet", function () {
    beforeEach(async function () {
      await multiSigFactory.createWallet(owners);
      const walletAddress = await multiSigFactory.getWallet(0);
      
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      multiSigWallet = MultiSigWallet.attach(walletAddress);
    });

    it("Should initialize with correct owners", async function () {
      const walletOwners = await multiSigWallet.getOwners();
      expect(walletOwners).to.deep.equal(owners);
      
      expect(await multiSigWallet.isOwner(owner1.address)).to.be.true;
      expect(await multiSigWallet.isOwner(owner2.address)).to.be.true;
      expect(await multiSigWallet.isOwner(nonOwner.address)).to.be.false;
    });

    it("Should require at least 3 owners", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([owner1.address, owner2.address])
      ).to.be.revertedWith("owners required must be at least 3");
    });

    it("Should receive Ether", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      await expect(
        owner1.sendTransaction({
          to: await multiSigWallet.getAddress(),
          value: depositAmount
        })
      ).to.emit(multiSigWallet, "Deposit")
        .withArgs(owner1.address, depositAmount, depositAmount);

      const balance = await ethers.provider.getBalance(await multiSigWallet.getAddress());
      expect(balance).to.equal(depositAmount);
    });

    describe("Transaction Management", function () {
      beforeEach(async function () {
        await owner1.sendTransaction({
          to: await multiSigWallet.getAddress(),
          value: ethers.parseEther("2.0")
        });
      });

      it("Should allow owners to submit transactions", async function () {
        const value = ethers.parseEther("0.5");
        
        await expect(
          multiSigWallet.connect(owner1).submitTransaction(
            recipient.address,
            value,
            "0x"
          )
        ).to.emit(multiSigWallet, "SubmitTransaction")
          .withArgs(owner1.address, 0, recipient.address, value, "0x");

        const txCount = await multiSigWallet.getTransactionCount();
        expect(txCount).to.equal(1);
      });

      it("Should not allow non-owners to submit transactions", async function () {
        await expect(
          multiSigWallet.connect(nonOwner).submitTransaction(
            recipient.address,
            ethers.parseEther("0.5"),
            "0x"
          )
        ).to.be.revertedWith("not owner");
      });

      it("Should allow owners to confirm transactions", async function () {
        const value = ethers.parseEther("0.5");
        
        await multiSigWallet.connect(owner1).submitTransaction(
          recipient.address,
          value,
          "0x"
        );

        await expect(
          multiSigWallet.connect(owner2).confirmTransaction(0)
        ).to.emit(multiSigWallet, "ConfirmTransaction")
          .withArgs(owner2.address, 0);

        const tx = await multiSigWallet.getTransaction(0);
        expect(tx.numConfirmations).to.equal(1);
      });

      it("Should not allow same owner to confirm twice", async function () {
        const value = ethers.parseEther("0.5");
        
        await multiSigWallet.connect(owner1).submitTransaction(
          recipient.address,
          value,
          "0x"
        );

        await multiSigWallet.connect(owner1).confirmTransaction(0);
        
        await expect(
          multiSigWallet.connect(owner1).confirmTransaction(0)
        ).to.be.revertedWith("tx already confirmed");
      });

      it("Should require at least 3 confirmations to execute", async function () {
        const value = ethers.parseEther("0.5");
        
        await multiSigWallet.connect(owner1).submitTransaction(
          recipient.address,
          value,
          "0x"
        );

        await multiSigWallet.connect(owner1).confirmTransaction(0);
        await multiSigWallet.connect(owner2).confirmTransaction(0);

        await expect(
          multiSigWallet.connect(owner3).executeTransaction(0)
        ).to.be.revertedWith("cannot execute tx - need at least 3 confirmations");
      });

      it("Should execute transaction with 3 confirmations", async function () {
        const value = ethers.parseEther("0.5");
        const recipientBalanceBefore = await ethers.provider.getBalance(recipient.address);
        
        await multiSigWallet.connect(owner1).submitTransaction(
          recipient.address,
          value,
          "0x"
        );

        await multiSigWallet.connect(owner1).confirmTransaction(0);
        await multiSigWallet.connect(owner2).confirmTransaction(0);
        await multiSigWallet.connect(owner3).confirmTransaction(0);

        await expect(
          multiSigWallet.connect(owner4).executeTransaction(0)
        ).to.emit(multiSigWallet, "ExecuteTransaction")
          .withArgs(owner4.address, 0);

        const recipientBalanceAfter = await ethers.provider.getBalance(recipient.address);
        expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(value);

        const tx = await multiSigWallet.getTransaction(0);
        expect(tx.executed).to.be.true;
      });

      it("Should not execute already executed transaction", async function () {
        const value = ethers.parseEther("0.5");
        
        await multiSigWallet.connect(owner1).submitTransaction(
          recipient.address,
          value,
          "0x"
        );

        await multiSigWallet.connect(owner1).confirmTransaction(0);
        await multiSigWallet.connect(owner2).confirmTransaction(0);
        await multiSigWallet.connect(owner3).confirmTransaction(0);
        await multiSigWallet.connect(owner4).executeTransaction(0);

        await expect(
          multiSigWallet.connect(owner1).executeTransaction(0)
        ).to.be.revertedWith("tx already executed");
      });

      it("Should allow revoking confirmations", async function () {
        const value = ethers.parseEther("0.5");
        
        await multiSigWallet.connect(owner1).submitTransaction(
          recipient.address,
          value,
          "0x"
        );

        await multiSigWallet.connect(owner1).confirmTransaction(0);
        await multiSigWallet.connect(owner2).confirmTransaction(0);

        let tx = await multiSigWallet.getTransaction(0);
        expect(tx.numConfirmations).to.equal(2);

        await expect(
          multiSigWallet.connect(owner2).revokeConfirmation(0)
        ).to.emit(multiSigWallet, "RevokeConfirmation")
          .withArgs(owner2.address, 0);

        tx = await multiSigWallet.getTransaction(0);
        expect(tx.numConfirmations).to.equal(1);
      });

      it("Should not allow revoking non-existent confirmation", async function () {
        const value = ethers.parseEther("0.5");
        
        await multiSigWallet.connect(owner1).submitTransaction(
          recipient.address,
          value,
          "0x"
        );

        await expect(
          multiSigWallet.connect(owner2).revokeConfirmation(0)
        ).to.be.revertedWith("tx not confirmed");
      });
    });

    describe("Edge Cases", function () {
      it("Should handle multiple transactions", async function () {
        await owner1.sendTransaction({
          to: await multiSigWallet.getAddress(),
          value: ethers.parseEther("5.0")
        });

        await multiSigWallet.connect(owner1).submitTransaction(
          recipient.address,
          ethers.parseEther("1.0"),
          "0x"
        );
        
        await multiSigWallet.connect(owner2).submitTransaction(
          recipient.address,
          ethers.parseEther("2.0"),
          "0x"
        );

        expect(await multiSigWallet.getTransactionCount()).to.equal(2);
      });

      it("Should fail execution if wallet has insufficient balance", async function () {
        const value = ethers.parseEther("10.0"); 
        
        await multiSigWallet.connect(owner1).submitTransaction(
          recipient.address,
          value,
          "0x"
        );

        await multiSigWallet.connect(owner1).confirmTransaction(0);
        await multiSigWallet.connect(owner2).confirmTransaction(0);
        await multiSigWallet.connect(owner3).confirmTransaction(0);

        await expect(
          multiSigWallet.connect(owner4).executeTransaction(0)
        ).to.be.revertedWith("tx failed");
      });
    });
  });
});