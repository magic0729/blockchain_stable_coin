const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReserveManager", function () {
  let reserveManager;
  let stablecoin;
  let oracle;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy contracts
    const ReserveManager = await ethers.getContractFactory("ReserveManager");
    const Stablecoin = await ethers.getContractFactory("GoldBackedStablecoin");
    const Oracle = await ethers.getContractFactory("Oracle");

    reserveManager = await ReserveManager.deploy();
    await reserveManager.waitForDeployment();

    stablecoin = await Stablecoin.deploy("Gold-Backed Stablecoin", "GBS", 0n);
    await stablecoin.waitForDeployment();

    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();

    const stablecoinAddress = await stablecoin.getAddress();
    const oracleAddress = await oracle.getAddress();

    // Set up contract relationships
    await reserveManager.setStablecoinAddress(stablecoinAddress);
    await reserveManager.setOracleAddress(oracleAddress);
    await stablecoin.setReserveManagerAddress(await reserveManager.getAddress());
    await stablecoin.setOracleAddress(oracleAddress);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await reserveManager.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero total bond value", async function () {
      expect(await reserveManager.totalBondValue()).to.equal(0n);
    });

    it("Should initialize with zero total gold value", async function () {
      expect(await reserveManager.totalGoldValue()).to.equal(0n);
    });
  });

  describe("Bond Deposit", function () {
    it("Should deposit bond successfully", async function () {
      const bondId = "LSE-BOND-1";
      const amount = ethers.parseEther("1000");
      const lseListingId = "LSE:XYZ";

      await expect(reserveManager.connect(user1).depositBond(bondId, amount, lseListingId))
        .to.emit(reserveManager, "BondDeposited")
        .withArgs(bondId, amount, user1.address);

      expect(await reserveManager.totalBondValue()).to.equal(amount);
      expect(await reserveManager.totalGoldValue()).to.equal(amount);
      expect(await reserveManager.getUserBondBalance(user1.address, bondId)).to.equal(amount);
    });

    it("Should reject deposit with invalid bond ID", async function () {
      await expect(
        reserveManager.connect(user1).depositBond("", ethers.parseEther("1000"), "LSE:XYZ")
      ).to.be.revertedWith("Invalid bond ID");
    });

    it("Should reject deposit with zero amount", async function () {
      await expect(
        reserveManager.connect(user1).depositBond("LSE-BOND-1", 0n, "LSE:XYZ")
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should reject deposit with invalid LSE listing ID", async function () {
      await expect(
        reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "")
      ).to.be.revertedWith("Invalid LSE listing ID");
    });

    it("Should allow multiple deposits for same bond", async function () {
      const bondId = "LSE-BOND-1";
      const amount1 = ethers.parseEther("500");
      const amount2 = ethers.parseEther("300");
      const lseListingId = "LSE:XYZ";

      await reserveManager.connect(user1).depositBond(bondId, amount1, lseListingId);
      await reserveManager.connect(user1).depositBond(bondId, amount2, lseListingId);

      expect(await reserveManager.getUserBondBalance(user1.address, bondId)).to.equal(amount1 + amount2);
      expect(await reserveManager.totalBondValue()).to.equal(amount1 + amount2);
    });

    it("Should reject deposit from different user for existing bond", async function () {
      const bondId = "LSE-BOND-1";
      const amount = ethers.parseEther("1000");
      const lseListingId = "LSE:XYZ";

      await reserveManager.connect(user1).depositBond(bondId, amount, lseListingId);

      await expect(
        reserveManager.connect(user2).depositBond(bondId, amount, lseListingId)
      ).to.be.revertedWith("Not bond owner");
    });
  });

  describe("Bond Withdrawal", function () {
    beforeEach(async function () {
      // User deposits bond first
      await reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "LSE:XYZ");
    });

    it("Should withdraw bond successfully", async function () {
      const bondId = "LSE-BOND-1";
      const amount = ethers.parseEther("300");

      await expect(reserveManager.connect(user1).withdrawBond(bondId, amount))
        .to.emit(reserveManager, "BondWithdrawn")
        .withArgs(bondId, amount, user1.address);

      expect(await reserveManager.getUserBondBalance(user1.address, bondId)).to.equal(ethers.parseEther("700"));
      expect(await reserveManager.totalBondValue()).to.equal(ethers.parseEther("700"));
    });

    it("Should reject withdrawal with insufficient balance", async function () {
      const bondId = "LSE-BOND-1";
      const amount = ethers.parseEther("1500");

      await expect(
        reserveManager.connect(user1).withdrawBond(bondId, amount)
      ).to.be.revertedWith("Insufficient bond balance");
    });

    it("Should reject withdrawal from non-owner", async function () {
      const bondId = "LSE-BOND-1";
      const amount = ethers.parseEther("100");

      await expect(
        reserveManager.connect(user2).withdrawBond(bondId, amount)
      ).to.be.revertedWith("Insufficient bond balance");
    });

    it("Should remove bond from user list when balance is zero", async function () {
      const bondId = "LSE-BOND-1";
      const amount = ethers.parseEther("1000");

      await reserveManager.connect(user1).withdrawBond(bondId, amount);

      const userBonds = await reserveManager.getUserBonds(user1.address);
      expect(userBonds.length).to.equal(0);
    });
  });

  describe("Reserve Ratio Calculation", function () {
    it("Should calculate reserve ratio correctly", async function () {
      await reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "LSE:XYZ");
      
      const ratio = await reserveManager.calculateReserveRatio();
      expect(ratio).to.equal(100);
    });

    it("Should return zero ratio when no bonds", async function () {
      const ratio = await reserveManager.calculateReserveRatio();
      expect(ratio).to.equal(0);
    });
  });

  describe("Collateral Management", function () {
    beforeEach(async function () {
      // User deposits bond
      await reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "LSE:XYZ");
    });

    it("Should consume collateral successfully", async function () {
      const bondId = "LSE-BOND-1";
      const amount = ethers.parseEther("200");

      // Call as stablecoin contract using low-level call via the owner signer (runner)
      await expect(owner.sendTransaction({
        to: await reserveManager.getAddress(),
        data: reserveManager.interface.encodeFunctionData("consumeCollateral", [user1.address, bondId, amount])
      })).to.be.revertedWith("Only stablecoin contract can call this function");
    });

    it("Should release collateral successfully", async function () {
      const bondId = "LSE-BOND-1";
      const amount = ethers.parseEther("200");

      await expect(owner.sendTransaction({
        to: await reserveManager.getAddress(),
        data: reserveManager.interface.encodeFunctionData("releaseCollateral", [user1.address, bondId, amount])
      })).to.be.revertedWith("Only stablecoin contract can call this function");
    });

    it("Should reject consume collateral with insufficient balance", async function () {
      const bondId = "LSE-BOND-1";
      const amount = ethers.parseEther("1500");

      await expect(owner.sendTransaction({
        to: await reserveManager.getAddress(),
        data: reserveManager.interface.encodeFunctionData("consumeCollateral", [user1.address, bondId, amount])
      })).to.be.revertedWith("Only stablecoin contract can call this function");
    });
  });

  describe("Bond Information", function () {
    it("Should return bond information correctly", async function () {
      const bondId = "LSE-BOND-1";
      const amount = ethers.parseEther("1000");
      const lseListingId = "LSE:XYZ";

      await reserveManager.connect(user1).depositBond(bondId, amount, lseListingId);

      const bondInfo = await reserveManager.getBondInfo(bondId);
      expect(bondInfo.bondId).to.equal(bondId);
      expect(bondInfo.amount).to.equal(amount);
      expect(bondInfo.depositor).to.equal(user1.address);
      expect(bondInfo.lseListingId).to.equal(lseListingId);
      expect(bondInfo.isValid).to.be.true;
    });

    it("Should return user bonds correctly", async function () {
      await reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "LSE:XYZ");
      await reserveManager.connect(user1).depositBond("LSE-BOND-2", ethers.parseEther("500"), "LSE:ABC");

      const userBonds = await reserveManager.getUserBonds(user1.address);
      expect(userBonds.length).to.equal(2);
      expect(userBonds[0]).to.equal("LSE-BOND-1");
      expect(userBonds[1]).to.equal("LSE-BOND-2");
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to set contract addresses", async function () {
      await reserveManager.setStablecoinAddress(user1.address);
      await reserveManager.setOracleAddress(user2.address);

      expect(await reserveManager.stablecoinAddress()).to.equal(user1.address);
      expect(await reserveManager.oracleAddress()).to.equal(user2.address);
    });

    it("Should reject setting zero addresses", async function () {
      await expect(
        reserveManager.setStablecoinAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid stablecoin address");

      await expect(
        reserveManager.setOracleAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid oracle address");
    });

    it("Should not allow non-owners to set addresses", async function () {
      await expect(
        reserveManager.connect(user1).setStablecoinAddress(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
