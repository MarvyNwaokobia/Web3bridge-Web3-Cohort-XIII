const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TimeNFT", function () {
  let timeNFT;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const TimeNFT = await ethers.getContractFactory("TimeNFT");
    timeNFT = await TimeNFT.deploy();
    await timeNFT.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await timeNFT.name()).to.equal("Dynamic Time NFT");
      expect(await timeNFT.symbol()).to.equal("TIMENFT");
    });

    it("Should set the deployer as owner", async function () {
      expect(await timeNFT.owner()).to.equal(owner.address);
    });

    it("Should start with zero total supply", async function () {
      expect(await timeNFT.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint NFTs", async function () {
      const tokenId = await timeNFT.mint(addr1.address);
      await expect(tokenId).to.not.be.reverted;
      
      expect(await timeNFT.totalSupply()).to.equal(1);
      expect(await timeNFT.ownerOf(1)).to.equal(addr1.address);
    });

    it("Should increment token IDs correctly", async function () {
      await timeNFT.mint(addr1.address);
      await timeNFT.mint(addr2.address);
      
      expect(await timeNFT.totalSupply()).to.equal(2);
      expect(await timeNFT.ownerOf(1)).to.equal(addr1.address);
      expect(await timeNFT.ownerOf(2)).to.equal(addr2.address);
    });

    it("Should not allow non-owner to mint", async function () {
      await expect(
        timeNFT.connect(addr1).mint(addr1.address)
      ).to.be.revertedWithCustomError(timeNFT, "OwnableUnauthorizedAccount");
    });

    it("Should emit Transfer event on mint", async function () {
      await expect(timeNFT.mint(addr1.address))
        .to.emit(timeNFT, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, 1);
    });
  });

  describe("TokenURI", function () {
    beforeEach(async function () {
      await timeNFT.mint(addr1.address);
    });

    it("Should return a valid tokenURI for existing token", async function () {
      const tokenURI = await timeNFT.tokenURI(1);
      expect(tokenURI).to.not.be.empty;
      expect(tokenURI).to.include("data:application/json;base64,");
    });

    it("Should revert for non-existent token", async function () {
      await expect(timeNFT.tokenURI(999)).to.be.revertedWith("Token does not exist");
    });

    it("Should generate different tokenURIs at different times", async function () {
      const tokenURI1 = await timeNFT.tokenURI(1);
      
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);
      
      const tokenURI2 = await timeNFT.tokenURI(1);
      
      expect(tokenURI1).to.not.equal(tokenURI2);
    });

    it("Should contain valid base64 encoded JSON metadata", async function () {
      const tokenURI = await timeNFT.tokenURI(1);
      const base64Part = tokenURI.split(",")[1];
      
      expect(() => {
        Buffer.from(base64Part, 'base64').toString();
      }).to.not.throw();
      
      const jsonString = Buffer.from(base64Part, 'base64').toString();
      const metadata = JSON.parse(jsonString);
      
      expect(metadata.name).to.equal("Dynamic Time NFT");
      expect(metadata.description).to.include("blockchain time");
      expect(metadata.image).to.include("data:image/svg+xml;base64,");
      expect(metadata.attributes).to.be.an('array');
      expect(metadata.attributes.length).to.be.greaterThan(0);
    });

    it("Should generate valid SVG content", async function () {
      const tokenURI = await timeNFT.tokenURI(1);
      const base64Part = tokenURI.split(",")[1];
      const jsonString = Buffer.from(base64Part, 'base64').toString();
      const metadata = JSON.parse(jsonString);
      
      const svgBase64 = metadata.image.split(",")[1];
      const svgString = Buffer.from(svgBase64, 'base64').toString();
      
      expect(svgString).to.include('<svg');
      expect(svgString).to.include('</svg>');
      expect(svgString).to.include('width="400"');
      expect(svgString).to.include('height="400"');
      
      expect(svgString).to.include('<text');
      expect(svgString).to.include('Block:');
    });
  });

  describe("SVG Generation Functions", function () {
    beforeEach(async function () {
      await timeNFT.mint(addr1.address);
    });

    it("Should handle different times of day correctly", async function () {
      await ethers.provider.send("evm_setNextBlockTimestamp", [9 * 3600]); 
      await ethers.provider.send("evm_mine", []);
      
      const morningURI = await timeNFT.tokenURI(1);
      expect(morningURI).to.not.be.empty;
      
      await ethers.provider.send("evm_setNextBlockTimestamp", [20 * 3600]); 
      await ethers.provider.send("evm_mine", []);
      
      const eveningURI = await timeNFT.tokenURI(1);
      expect(eveningURI).to.not.be.empty;
      expect(eveningURI).to.not.equal(morningURI);
    });

    it("Should handle time transitions correctly", async function () {
      await ethers.provider.send("evm_setNextBlockTimestamp", [86399]); 
      await ethers.provider.send("evm_mine", []);
      
      const beforeMidnight = await timeNFT.tokenURI(1);
      expect(beforeMidnight).to.not.be.empty;
      
      await ethers.provider.send("evm_setNextBlockTimestamp", [86400]); 
      await ethers.provider.send("evm_mine", []);
      
      const afterMidnight = await timeNFT.tokenURI(1);
      expect(afterMidnight).to.not.be.empty;
      expect(afterMidnight).to.not.equal(beforeMidnight);
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to transfer ownership", async function () {
      await timeNFT.transferOwnership(addr1.address);
      expect(await timeNFT.owner()).to.equal(addr1.address);
    });

    it("Should allow new owner to mint after ownership transfer", async function () {
      await timeNFT.transferOwnership(addr1.address);
      
      await expect(timeNFT.connect(addr1).mint(addr2.address))
        .to.emit(timeNFT, "Transfer")
        .withArgs(ethers.ZeroAddress, addr2.address, 1);
    });

    it("Should prevent old owner from minting after ownership transfer", async function () {
      await timeNFT.transferOwnership(addr1.address);
      
      await expect(
        timeNFT.connect(owner).mint(addr2.address)
      ).to.be.revertedWithCustomError(timeNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("ERC721 Compliance", function () {
    beforeEach(async function () {
      await timeNFT.mint(addr1.address);
      await timeNFT.mint(addr2.address);
    });

    it("Should support ERC721 interface", async function () {
      expect(await timeNFT.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("Should allow token transfers", async function () {
      await timeNFT.connect(addr1).transferFrom(addr1.address, addr2.address, 1);
      expect(await timeNFT.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should allow token approvals", async function () {
      await timeNFT.connect(addr1).approve(addr2.address, 1);
      expect(await timeNFT.getApproved(1)).to.equal(addr2.address);
    });

    it("Should allow operator approvals", async function () {
      await timeNFT.connect(addr1).setApprovalForAll(addr2.address, true);
      expect(await timeNFT.isApprovedForAll(addr1.address, addr2.address)).to.be.true;
    });

    it("Should return correct balance", async function () {
      expect(await timeNFT.balanceOf(addr1.address)).to.equal(1);
      expect(await timeNFT.balanceOf(addr2.address)).to.equal(1);
    });
  });
});