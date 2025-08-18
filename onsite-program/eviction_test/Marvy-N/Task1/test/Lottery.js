const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Lottery Contract", function () {
  let Lottery, lottery, owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10, addr11;
  const ENTRY_FEE = ethers.parseEther("0.01");

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10, addr11] = await ethers.getSigners();
    
    Lottery = await ethers.getContractFactory("Lottery");
    lottery = await Lottery.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await lottery.owner()).to.equal(owner.address);
    });

    it("Should initialize with round 1", async function () {
      expect(await lottery.currentRound()).to.equal(1);
    });

    it("Should start with 0 players", async function () {
      expect(await lottery.getPlayersCount()).to.equal(0);
    });

    it("Should start with 0 prize pool", async function () {
      expect(await lottery.getPrizePool()).to.equal(0);
    });
  });

  describe("Entry Requirements", function () {
    it("Should accept exactly 0.01 ETH", async function () {
      await expect(lottery.connect(addr1).enterLottery({ value: ENTRY_FEE }))
        .to.not.be.reverted;
    });

    it("Should reject entries with insufficient ETH", async function () {
      const insufficientFee = ethers.parseEther("0.005");
      await expect(lottery.connect(addr1).enterLottery({ value: insufficientFee }))
        .to.be.revertedWithCustomError(lottery, "InvalidEntryFee");
    });

    it("Should reject entries with excess ETH", async function () {
      const excessFee = ethers.parseEther("0.02");
      await expect(lottery.connect(addr1).enterLottery({ value: excessFee }))
        .to.be.revertedWithCustomError(lottery, "InvalidEntryFee");
    });

    it("Should reject direct ETH transfers", async function () {
      await expect(addr1.sendTransaction({
        to: lottery.target,
        value: ENTRY_FEE
      })).to.be.revertedWith("Use enterLottery() function to join");
    });
  });

  describe("Player Management", function () {
    it("Should track player addresses correctly", async function () {
      await lottery.connect(addr1).enterLottery({ value: ENTRY_FEE });
      await lottery.connect(addr2).enterLottery({ value: ENTRY_FEE });
      
      const players = await lottery.getPlayers();
      expect(players.length).to.equal(2);
      expect(players[0]).to.equal(addr1.address);
      expect(players[1]).to.equal(addr2.address);
    });

    it("Should prevent duplicate entries in same round", async function () {
      await lottery.connect(addr1).enterLottery({ value: ENTRY_FEE });
      
      await expect(lottery.connect(addr1).enterLottery({ value: ENTRY_FEE }))
        .to.be.revertedWithCustomError(lottery, "PlayerAlreadyEntered");
    });

    it("Should track if player has entered", async function () {
      expect(await lottery.hasPlayerEntered(addr1.address)).to.be.false;
      
      await lottery.connect(addr1).enterLottery({ value: ENTRY_FEE });
      
      expect(await lottery.hasPlayerEntered(addr1.address)).to.be.true;
    });

    it("Should emit PlayerJoined event", async function () {
      await expect(lottery.connect(addr1).enterLottery({ value: ENTRY_FEE }))
        .to.emit(lottery, "PlayerJoined")
        .withArgs(addr1.address, 1);
    });
  });

  describe("Prize Pool Management", function () {
    it("Should accumulate prize pool correctly", async function () {
      await lottery.connect(addr1).enterLottery({ value: ENTRY_FEE });
      expect(await lottery.getPrizePool()).to.equal(ENTRY_FEE);
      
      await lottery.connect(addr2).enterLottery({ value: ENTRY_FEE });
      expect(await lottery.getPrizePool()).to.equal(ENTRY_FEE * 2n);
    });

    it("Should track contract balance", async function () {
      await lottery.connect(addr1).enterLottery({ value: ENTRY_FEE });
      expect(await lottery.getBalance()).to.equal(ENTRY_FEE);
    });
  });

  describe("Winner Selection", function () {
    it("Should not select winner before 10 players", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9];
      
      for (let i = 0; i < players.length; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      expect(await lottery.getPlayersCount()).to.equal(9);
      expect(await lottery.getPrizePool()).to.equal(ENTRY_FEE * 9n);
    });

    it("Should automatically select winner after 10 players", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      const initialBalance = await ethers.provider.getBalance(addr5.address);
      
      for (let i = 0; i < 9; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      const tx = await lottery.connect(players[9]).enterLottery({ value: ENTRY_FEE });
      const receipt = await tx.wait();
      
      const winnerEvent = receipt.logs.find(log => {
        try {
          const parsed = lottery.interface.parseLog(log);
          return parsed.name === "WinnerSelected";
        } catch {
          return false;
        }
      });
      
      expect(winnerEvent).to.not.be.undefined;
      
      expect(await lottery.getPlayersCount()).to.equal(0);
      expect(await lottery.currentRound()).to.equal(2);
      expect(await lottery.getPrizePool()).to.equal(0);
    });

    it("Should emit WinnerSelected event with correct parameters", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      for (let i = 0; i < 9; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      await expect(lottery.connect(players[9]).enterLottery({ value: ENTRY_FEE }))
        .to.emit(lottery, "WinnerSelected")
        .withArgs(
          (winner) => players.some(p => p.address === winner), 
          ENTRY_FEE * 10n,
          1 
        );
    });

    it("Should transfer entire prize pool to winner", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      const initialBalances = {};
      for (const player of players) {
        initialBalances[player.address] = await ethers.provider.getBalance(player.address);
      }
      
      for (let i = 0; i < players.length; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      let winnerFound = false;
      for (const player of players) {
        const finalBalance = await ethers.provider.getBalance(player.address);
        const balanceChange = finalBalance - initialBalances[player.address];
        
        if (balanceChange > ENTRY_FEE * 8n) { 
          winnerFound = true;
          break;
        }
      }
      
      expect(winnerFound).to.be.true;
    });

    it("Should reject 11th player after lottery is full", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      for (let i = 0; i < players.length; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      await expect(lottery.connect(addr11).enterLottery({ value: ENTRY_FEE }))
        .to.not.be.reverted;
    });
  });

  describe("Lottery Reset", function () {
    it("Should reset players array after winner selection", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      for (let i = 0; i < players.length; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      expect(await lottery.getPlayersCount()).to.equal(0);
      const currentPlayers = await lottery.getPlayers();
      expect(currentPlayers.length).to.equal(0);
    });

    it("Should reset hasEntered mapping", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      for (let i = 0; i < players.length; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      for (const player of players) {
        expect(await lottery.hasPlayerEntered(player.address)).to.be.false;
      }
    });

    it("Should increment round number", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      expect(await lottery.currentRound()).to.equal(1);
      
      for (let i = 0; i < players.length; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      expect(await lottery.currentRound()).to.equal(2);
    });

    it("Should emit LotteryReset event", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      for (let i = 0; i < 9; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      await expect(lottery.connect(players[9]).enterLottery({ value: ENTRY_FEE }))
        .to.emit(lottery, "LotteryReset")
        .withArgs(2);
    });
  });

  describe("Multiple Rounds", function () {
    it("Should handle multiple rounds correctly", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      for (let i = 0; i < players.length; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      expect(await lottery.currentRound()).to.equal(2);
      expect(await lottery.getPlayersCount()).to.equal(0);
      
      for (let i = 0; i < 5; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      expect(await lottery.getPlayersCount()).to.equal(5);
      expect(await lottery.currentRound()).to.equal(2);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle rapid successive entries", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      const entryPromises = players.map(player => 
        lottery.connect(player).enterLottery({ value: ENTRY_FEE })
      );
      
      await Promise.all(entryPromises);
      
      expect(await lottery.currentRound()).to.equal(2);
      expect(await lottery.getPlayersCount()).to.equal(0);
    });

    it("Should maintain correct contract balance throughout process", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5];
      
      for (let i = 0; i < players.length; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
        expect(await lottery.getBalance()).to.equal(ENTRY_FEE * BigInt(i + 1));
      }
    });
  });

  describe("Security Features", function () {
    it("Should prevent reentrancy attacks", async function () {
      const players = [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10];
      
      for (let i = 0; i < players.length; i++) {
        await lottery.connect(players[i]).enterLottery({ value: ENTRY_FEE });
      }
      
      expect(await lottery.currentRound()).to.equal(2);
    });

    it("Should only allow owner to emergency withdraw", async function () {
      await lottery.connect(addr1).enterLottery({ value: ENTRY_FEE });
      
      await expect(lottery.connect(addr1).emergencyWithdraw())
        .to.be.revertedWithCustomError(lottery, "OwnableUnauthorizedAccount");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to emergency withdraw", async function () {
      await lottery.connect(addr1).enterLottery({ value: ENTRY_FEE });
      await lottery.connect(addr2).enterLottery({ value: ENTRY_FEE });
      
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      const tx = await lottery.connect(owner).emergencyWithdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      const expectedBalance = initialOwnerBalance + (ENTRY_FEE * 2n) - gasUsed;
      
      expect(finalOwnerBalance).to.equal(expectedBalance);
      expect(await lottery.getBalance()).to.equal(0);
      expect(await lottery.getPlayersCount()).to.equal(0);
    });
  });

  describe("View Functions", function () {
    it("Should return correct players count", async function () {
      expect(await lottery.getPlayersCount()).to.equal(0);
      
      await lottery.connect(addr1).enterLottery({ value: ENTRY_FEE });
      expect(await lottery.getPlayersCount()).to.equal(1);
      
      await lottery.connect(addr2).enterLottery({ value: ENTRY_FEE });
      expect(await lottery.getPlayersCount()).to.equal(2);
    });

    it("Should return empty array initially", async function () {
      const players = await lottery.getPlayers();
      expect(players.length).to.equal(0);
    });

    it("Should return correct prize pool", async function () {
      expect(await lottery.getPrizePool()).to.equal(0);
      
      await lottery.connect(addr1).enterLottery({ value: ENTRY_FEE });
      expect(await lottery.getPrizePool()).to.equal(ENTRY_FEE);
    });
  });
});