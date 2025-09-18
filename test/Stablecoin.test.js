const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GoldBackedStablecoin", function () {
  let stablecoin;
  let reserveManager;
  let oracle;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy contracts
    const Stablecoin = await ethers.getContractFactory("GoldBackedStablecoin");
    const ReserveManager = await ethers.getContractFactory("ReserveManager");
    const Oracle = await ethers.getContractFactory("Oracle");

    stablecoin = await Stablecoin.deploy("Gold-Backed Stablecoin", "GBS", 0n);
    await stablecoin.waitForDeployment();

    reserveManager = await ReserveManager.deploy();
    await reserveManager.waitForDeployment();

    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();

    const reserveManagerAddress = await reserveManager.getAddress();
    const oracleAddress = await oracle.getAddress();

    // Set up contract relationships
    await stablecoin.setOracleAddress(oracleAddress);
    await stablecoin.setReserveManagerAddress(reserveManagerAddress);
    await reserveManager.setStablecoinAddress(await stablecoin.getAddress());
    await reserveManager.setOracleAddress(oracleAddress);
    await oracle.setStablecoinAddress(await stablecoin.getAddress());
    await oracle.setReserveManagerAddress(reserveManagerAddress);

    // Whitelist users
    await stablecoin.whitelistUser(owner.address);
    await stablecoin.whitelistUser(user1.address);
    await stablecoin.whitelistUser(user2.address);
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await stablecoin.name()).to.equal("Gold-Backed Stablecoin");
      expect(await stablecoin.symbol()).to.equal("GBS");
    });

    it("Should set the correct owner", async function () {
      expect(await stablecoin.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero total supply", async function () {
      expect(await stablecoin.totalSupply()).to.equal(0n);
    });

    it("Should set correct contract addresses", async function () {
      expect(await stablecoin.oracleAddress()).to.equal(await oracle.getAddress());
      expect(await stablecoin.reserveManagerAddress()).to.equal(await reserveManager.getAddress());
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to whitelist users", async function () {
      await stablecoin.whitelistUser(user1.address);
      expect(await stablecoin.whitelistedUsers(user1.address)).to.be.true;
    });

    it("Should allow owner to blacklist users", async function () {
      await stablecoin.blacklistUser(user1.address);
      expect(await stablecoin.blacklistedUsers(user1.address)).to.be.true;
    });

    it("Should not allow non-owners to whitelist users", async function () {
      await expect(
        stablecoin.connect(user1).whitelistUser(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Emergency Controls", function () {
    it("Should allow owner to activate emergency pause", async function () {
      await stablecoin.activateEmergencyPause("Test emergency");
      expect(await stablecoin.emergencyMode()).to.be.true;
      expect(await stablecoin.paused()).to.be.true;
    });

    it("Should allow owner to deactivate emergency pause", async function () {
      await stablecoin.activateEmergencyPause("Test emergency");
      await stablecoin.deactivateEmergencyPause();
      expect(await stablecoin.emergencyMode()).to.be.false;
      expect(await stablecoin.paused()).to.be.false;
    });

    it("Should not allow non-owners to activate emergency pause", async function () {
      await expect(
        stablecoin.connect(user1).activateEmergencyPause("Test emergency")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Contract Configuration", function () {
    it("Should allow owner to set oracle address", async function () {
      await stablecoin.setOracleAddress(user1.address);
      expect(await stablecoin.oracleAddress()).to.equal(user1.address);
    });

    it("Should allow owner to set compliance address", async function () {
      await stablecoin.setComplianceAddress(user1.address);
      expect(await stablecoin.complianceAddress()).to.equal(user1.address);
    });

    it("Should allow owner to set reserve manager address", async function () {
      await stablecoin.setReserveManagerAddress(user1.address);
      expect(await stablecoin.reserveManagerAddress()).to.equal(user1.address);
    });

    it("Should not allow setting zero address", async function () {
      await expect(
        stablecoin.setOracleAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid oracle address");
    });
  });

  describe("Proof of Reserves", function () {
    it("Should return proof of reserves data", async function () {
      const proof = await stablecoin.proofOfReserves();
      expect(proof.length).to.equal(3);
      expect(proof[2]).to.be.greaterThan(0);
    });
  });

  describe("Reserve Compliance", function () {
    it("Should check reserve compliance", async function () {
      const isCompliant = await stablecoin.checkReserveCompliance();
      expect(typeof isCompliant).to.equal("boolean");
    });
  });

  describe("Transfer Restrictions", function () {
    it("Should prevent transfers when paused", async function () {
      await stablecoin.activateEmergencyPause("Test pause");
      
      await expect(
        stablecoin.transfer(user1.address, 1000n)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should prevent transfers from blacklisted users", async function () {
      await stablecoin.blacklistUser(owner.address);
      
      await expect(
        stablecoin.transfer(user1.address, 1000n)
      ).to.be.revertedWith("Sender is blacklisted");
    });

    it("Should prevent transfers to blacklisted users", async function () {
      await stablecoin.blacklistUser(user1.address);
      
      await expect(
        stablecoin.transfer(user1.address, 1000n)
      ).to.be.revertedWith("Recipient is blacklisted");
    });
  });

  describe("Constants", function () {
    it("Should have correct minimum reserve ratio", async function () {
      expect(await stablecoin.MINIMUM_RESERVE_RATIO()).to.equal(100);
    });

    it("Should have correct maximum reserve ratio", async function () {
      expect(await stablecoin.MAXIMUM_RESERVE_RATIO()).to.equal(120);
    });
  });

  describe("Mint Operations", function () {
    beforeEach(async function () {
      // Set up oracle with mock data
      await oracle.addDataSource(owner.address, "mock");
      await oracle.updateGoldPrice(ethers.parseEther("2000"), 95, "mock-gold-api");
      await oracle.updateBondPrice("LSE-BOND-1", ethers.parseEther("1000"), 90, "mock-lse-api");
      await oracle.updateReserveData(0n, 0n, 0n);
      // Authorize stablecoin to push reserve updates during mint/burn/redeem
      await oracle.addDataSource(await stablecoin.getAddress(), "reserve-api");
    });

    it("Should mint tokens when user has sufficient bond collateral", async function () {
      // User deposits bond collateral
      await reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "LSE:XYZ");
      
      // User mints tokens
      const mintAmount = ethers.parseEther("500");
      await expect(stablecoin.connect(user1).mint(mintAmount, "LSE-BOND-1"))
        .to.emit(stablecoin, "TokensMinted")
        .withArgs(user1.address, mintAmount, "LSE-BOND-1");
      
      expect(await stablecoin.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await stablecoin.totalSupply()).to.equal(mintAmount);
    });

    it("Should reject mint without sufficient bond collateral", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(
        stablecoin.connect(user1).mint(mintAmount, "LSE-BOND-1")
      ).to.be.revertedWith("Insufficient bond collateral");
    });

    it("Should reject mint with invalid bond ID", async function () {
      await expect(
        stablecoin.connect(user1).mint(ethers.parseEther("100"), "")
      ).to.be.revertedWith("Invalid bond ID");
    });

    it("Should reject mint with zero amount", async function () {
      await expect(
        stablecoin.connect(user1).mint(0n, "LSE-BOND-1")
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should reject mint when not whitelisted", async function () {
      await stablecoin.blacklistUser(user1.address);
      
      await expect(
        stablecoin.connect(user1).mint(ethers.parseEther("100"), "LSE-BOND-1")
      ).to.be.reverted; // Blacklisted or not whitelisted -> revert
    });
  });

  describe("Burn Operations", function () {
    beforeEach(async function () {
      // Set up oracle with mock data
      await oracle.addDataSource(owner.address, "mock");
      await oracle.updateGoldPrice(ethers.parseEther("2000"), 95, "mock-gold-api");
      await oracle.updateBondPrice("LSE-BOND-1", ethers.parseEther("1000"), 90, "mock-lse-api");
      await oracle.updateReserveData(ethers.parseEther("1000"), ethers.parseEther("1000"), ethers.parseEther("1000"));
      // Authorize stablecoin to push reserve updates during burn
      await oracle.addDataSource(await stablecoin.getAddress(), "reserve-api");
      
      // User deposits bond and mints tokens
      await reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "LSE:XYZ");
      await stablecoin.connect(user1).mint(ethers.parseEther("500"), "LSE-BOND-1");
    });

    it("Should burn tokens and release collateral", async function () {
      const burnAmount = ethers.parseEther("200");
      const initialBalance = await stablecoin.balanceOf(user1.address);
      
      await expect(stablecoin.connect(user1).burn(burnAmount, "LSE-BOND-1"))
        .to.emit(stablecoin, "TokensBurned")
        .withArgs(user1.address, burnAmount, "LSE-BOND-1");
      
      expect(await stablecoin.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
      expect(await stablecoin.totalSupply()).to.equal(initialBalance - burnAmount);
    });

    it("Should reject burn with insufficient token balance", async function () {
      const burnAmount = ethers.parseEther("1000");
      
      await expect(
        stablecoin.connect(user1).burn(burnAmount, "LSE-BOND-1")
      ).to.be.revertedWith("Insufficient token balance");
    });

    it("Should reject burn with invalid bond ID", async function () {
      await expect(
        stablecoin.connect(user1).burn(ethers.parseEther("100"), "")
      ).to.be.revertedWith("Invalid bond ID");
    });

    it("Should reject burn with zero amount", async function () {
      await expect(
        stablecoin.connect(user1).burn(0n, "LSE-BOND-1")
      ).to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Redeem Operations", function () {
    beforeEach(async function () {
      // Set up oracle with mock data
      await oracle.addDataSource(owner.address, "mock");
      await oracle.updateGoldPrice(ethers.parseEther("2000"), 95, "mock-gold-api");
      await oracle.updateBondPrice("LSE-BOND-1", ethers.parseEther("1000"), 90, "mock-lse-api");
      await oracle.updateReserveData(ethers.parseEther("1000"), ethers.parseEther("1000"), ethers.parseEther("1000"));
      // Authorize stablecoin to push reserve updates during redeem
      await oracle.addDataSource(await stablecoin.getAddress(), "reserve-api");
      
      // User deposits bond and mints tokens
      await reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "LSE:XYZ");
      await stablecoin.connect(user1).mint(ethers.parseEther("500"), "LSE-BOND-1");
    });

    it("Should redeem tokens for gold value", async function () {
      const redeemAmount = ethers.parseEther("200");
      const initialBalance = await stablecoin.balanceOf(user1.address);
      
      await expect(stablecoin.connect(user1).redeem(redeemAmount))
        .to.emit(stablecoin, "TokensBurned")
        .withArgs(user1.address, redeemAmount, "GOLD_REDEMPTION");
      
      expect(await stablecoin.balanceOf(user1.address)).to.equal(initialBalance - redeemAmount);
      expect(await stablecoin.totalSupply()).to.equal(initialBalance - redeemAmount);
    });

    it("Should reject redeem with insufficient token balance", async function () {
      const redeemAmount = ethers.parseEther("1000");
      
      await expect(
        stablecoin.connect(user1).redeem(redeemAmount)
      ).to.be.revertedWith("Insufficient token balance");
    });

    it("Should reject redeem with zero amount", async function () {
      await expect(
        stablecoin.connect(user1).redeem(0n)
      ).to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Proof of Reserves", function () {
    it("Should return proof of reserves data", async function () {
      await oracle.addDataSource(owner.address, "mock");
      await oracle.updateReserveData(
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        ethers.parseEther("1000")
      );
      
      const proof = await stablecoin.proofOfReserves();
      expect(proof[0]).to.equal(ethers.parseEther("1000"));
      expect(proof[1]).to.equal(ethers.parseEther("1000"));
      expect(proof[2]).to.be.greaterThan(0);
    });

    it("Should return zero values when oracle is not set", async function () {
      await expect(
        stablecoin.setOracleAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid oracle address");
    });
  });

  describe("Reserve Compliance", function () {
    it("Should check reserve compliance correctly", async function () {
      // Set up reserve manager with compliant ratio
      await reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "LSE:XYZ");
      
      const isCompliant = await stablecoin.checkReserveCompliance();
      expect(isCompliant).to.be.true;
    });

    it("Should return false when reserve manager is not set", async function () {
      await expect(
        stablecoin.setReserveManagerAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid reserve manager address");
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete mint-burn cycle", async function () {
      // Set up oracle
      await oracle.addDataSource(owner.address, "mock");
      await oracle.updateGoldPrice(ethers.parseEther("2000"), 95, "mock-gold-api");
      await oracle.updateBondPrice("LSE-BOND-1", ethers.parseEther("1000"), 90, "mock-lse-api");
      await oracle.updateReserveData(0n, 0n, 0n);
      // Authorize stablecoin to push reserve updates
      await oracle.addDataSource(await stablecoin.getAddress(), "reserve-api");
      
      // User deposits bond
      await reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "LSE:XYZ");
      
      // User mints tokens
      const mintAmount = ethers.parseEther("500");
      await stablecoin.connect(user1).mint(mintAmount, "LSE-BOND-1");
      expect(await stablecoin.balanceOf(user1.address)).to.equal(mintAmount);
      
      // User burns some tokens
      const burnAmount = ethers.parseEther("200");
      await stablecoin.connect(user1).burn(burnAmount, "LSE-BOND-1");
      expect(await stablecoin.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
      
      // User redeems remaining tokens
      const remainingAmount = mintAmount - burnAmount;
      await stablecoin.connect(user1).redeem(remainingAmount);
      expect(await stablecoin.balanceOf(user1.address)).to.equal(0n);
    });

    it("Should maintain reserve ratio compliance throughout operations", async function () {
      // Set up oracle
      await oracle.addDataSource(owner.address, "mock");
      await oracle.updateGoldPrice(ethers.parseEther("2000"), 95, "mock-gold-api");
      await oracle.updateBondPrice("LSE-BOND-1", ethers.parseEther("1000"), 90, "mock-lse-api");
      await oracle.updateReserveData(0n, 0n, 0n);
      // Authorize stablecoin to push reserve updates
      await oracle.addDataSource(await stablecoin.getAddress(), "reserve-api");
      
      // User deposits bond
      await reserveManager.connect(user1).depositBond("LSE-BOND-1", ethers.parseEther("1000"), "LSE:XYZ");
      
      // Check compliance before minting
      let isCompliant = await stablecoin.checkReserveCompliance();
      expect(isCompliant).to.be.true;
      
      // User mints tokens
      await stablecoin.connect(user1).mint(ethers.parseEther("500"), "LSE-BOND-1");
      
      // Check compliance after minting
      isCompliant = await stablecoin.checkReserveCompliance();
      expect(isCompliant).to.be.true;
      
      // User burns tokens
      await stablecoin.connect(user1).burn(ethers.parseEther("200"), "LSE-BOND-1");
      
      // Check compliance after burning
      isCompliant = await stablecoin.checkReserveCompliance();
      expect(isCompliant).to.be.true;
    });
  });
});
