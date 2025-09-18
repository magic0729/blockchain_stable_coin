const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Oracle", function () {
  let oracle;
  let stablecoin;
  let reserveManager;
  let owner;
  let user1;
  let dataSource;

  beforeEach(async function () {
    [owner, user1, dataSource] = await ethers.getSigners();

    // Deploy contracts
    const Oracle = await ethers.getContractFactory("Oracle");
    const Stablecoin = await ethers.getContractFactory("GoldBackedStablecoin");
    const ReserveManager = await ethers.getContractFactory("ReserveManager");

    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();

    stablecoin = await Stablecoin.deploy("Gold-Backed Stablecoin", "GBS", 0n);
    await stablecoin.waitForDeployment();

    reserveManager = await ReserveManager.deploy();
    await reserveManager.waitForDeployment();

    const stablecoinAddress = await stablecoin.getAddress();
    const reserveManagerAddress = await reserveManager.getAddress();

    // Set up contract relationships
    await oracle.setStablecoinAddress(stablecoinAddress);
    await oracle.setReserveManagerAddress(reserveManagerAddress);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await oracle.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero reserve data", async function () {
      const reserveData = await oracle.getReserveData();
      expect(reserveData.totalReserves).to.equal(0n);
      expect(reserveData.goldValue).to.equal(0n);
      expect(reserveData.bondValue).to.equal(0n);
      expect(reserveData.isValid).to.be.false;
    });
  });

  describe("Data Source Management", function () {
    it("Should add data source successfully", async function () {
      await expect(oracle.addDataSource(dataSource.address, "gold-api"))
        .to.emit(oracle, "DataSourceAdded")
        .withArgs(dataSource.address, "gold-api");

      expect(await oracle.authorizedSources(dataSource.address)).to.be.true;
      expect(await oracle.sourceTypes(dataSource.address)).to.equal("gold-api");
    });

    it("Should remove data source successfully", async function () {
      await oracle.addDataSource(dataSource.address, "gold-api");
      
      await expect(oracle.removeDataSource(dataSource.address))
        .to.emit(oracle, "DataSourceRemoved")
        .withArgs(dataSource.address);

      expect(await oracle.authorizedSources(dataSource.address)).to.be.false;
    });

    it("Should reject adding zero address as data source", async function () {
      await expect(
        oracle.addDataSource(ethers.ZeroAddress, "gold-api")
      ).to.be.revertedWith("Invalid source address");
    });

    it("Should not allow non-owners to manage data sources", async function () {
      await expect(
        oracle.connect(user1).addDataSource(dataSource.address, "gold-api")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Gold Price Updates", function () {
    beforeEach(async function () {
      await oracle.addDataSource(dataSource.address, "gold-api");
    });

    it("Should update gold price successfully", async function () {
      const price = ethers.parseEther("2000");
      const confidence = 95;
      const source = "gold-api";

      await expect(oracle.connect(dataSource).updateGoldPrice(price, confidence, source))
        .to.emit(oracle, "PriceUpdated");

      const goldPrice = await oracle.getGoldPrice();
      expect(goldPrice.price).to.equal(price);
      expect(goldPrice.isValid).to.be.true;
    });

    it("Should reject update with invalid price", async function () {
      await expect(
        oracle.connect(dataSource).updateGoldPrice(0n, 95, "gold-api")
      ).to.be.revertedWith("Invalid gold price");
    });

    it("Should reject update with low confidence", async function () {
      await expect(
        oracle.connect(dataSource).updateGoldPrice(ethers.parseEther("2000"), 70, "gold-api")
      ).to.be.revertedWith("Confidence too low");
    });

    it("Should reject update from unauthorized source", async function () {
      await expect(
        oracle.connect(user1).updateGoldPrice(ethers.parseEther("2000"), 95, "gold-api")
      ).to.be.revertedWith("Unauthorized data source");
    });
  });

  describe("Bond Price Updates", function () {
    beforeEach(async function () {
      await oracle.addDataSource(dataSource.address, "lse-api");
    });

    it("Should update bond price successfully", async function () {
      const bondId = "LSE-BOND-1";
      const price = ethers.parseEther("1000");
      const confidence = 90;
      const source = "lse-api";

      await expect(oracle.connect(dataSource).updateBondPrice(bondId, price, confidence, source))
        .to.emit(oracle, "PriceUpdated");

      const bondPrice = await oracle.getBondPrice(bondId);
      expect(bondPrice.price).to.equal(price);
      expect(bondPrice.isValid).to.be.true;
    });

    it("Should reject update with invalid bond ID", async function () {
      await expect(
        oracle.connect(dataSource).updateBondPrice("", ethers.parseEther("1000"), 90, "lse-api")
      ).to.be.revertedWith("Invalid bond ID");
    });

    it("Should reject update with invalid price", async function () {
      await expect(
        oracle.connect(dataSource).updateBondPrice("LSE-BOND-1", 0n, 90, "lse-api")
      ).to.be.revertedWith("Invalid bond price");
    });
  });

  describe("Reserve Data Updates", function () {
    beforeEach(async function () {
      await oracle.addDataSource(dataSource.address, "reserve-api");
    });

    it("Should update reserve data successfully", async function () {
      const totalReserves = ethers.parseEther("1000");
      const goldValue = ethers.parseEther("800");
      const bondValue = ethers.parseEther("200");

      await expect(oracle.connect(dataSource).updateReserveData(totalReserves, goldValue, bondValue))
        .to.emit(oracle, "ReserveDataUpdated");

      const reserveData = await oracle.getReserveData();
      expect(reserveData.totalReserves).to.equal(totalReserves);
      expect(reserveData.goldValue).to.equal(goldValue);
      expect(reserveData.bondValue).to.equal(bondValue);
      expect(reserveData.isValid).to.be.true;
    });
  });

  describe("Price Data Validation", function () {
    beforeEach(async function () {
      await oracle.addDataSource(dataSource.address, "gold-api");
    });

    it("Should validate fresh price data", async function () {
      await oracle.connect(dataSource).updateGoldPrice(ethers.parseEther("2000"), 95, "gold-api");
      
      const isValid = await oracle.verifyPriceData("GOLD");
      expect(isValid).to.be.true;
    });

    it("Should invalidate expired price data", async function () {
      await oracle.connect(dataSource).updateGoldPrice(ethers.parseEther("2000"), 95, "gold-api");
      
      // Fast forward time beyond validity period
      await ethers.provider.send("evm_increaseTime", [2 * 60 * 60]); // 2 hours
      await ethers.provider.send("evm_mine");
      
      const isValid = await oracle.verifyPriceData("GOLD");
      expect(isValid).to.be.false;
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to set contract addresses", async function () {
      await oracle.setStablecoinAddress(user1.address);
      await oracle.setReserveManagerAddress(user1.address);

      expect(await oracle.stablecoinAddress()).to.equal(user1.address);
      expect(await oracle.reserveManagerAddress()).to.equal(user1.address);
    });

    it("Should reject setting zero addresses", async function () {
      await expect(
        oracle.setStablecoinAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid stablecoin address");

      await expect(
        oracle.setReserveManagerAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid reserve manager address");
    });

    it("Should not allow non-owners to set addresses", async function () {
      await expect(
        oracle.connect(user1).setStablecoinAddress(user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Integration Tests", function () {
    beforeEach(async function () {
      await oracle.addDataSource(dataSource.address, "multi-api");
    });

    it("Should handle multiple price updates", async function () {
      // Update gold price
      await oracle.connect(dataSource).updateGoldPrice(ethers.parseEther("2000"), 95, "gold-api");
      
      // Update bond prices
      await oracle.connect(dataSource).updateBondPrice("LSE-BOND-1", ethers.parseEther("1000"), 90, "lse-api");
      await oracle.connect(dataSource).updateBondPrice("LSE-BOND-2", ethers.parseEther("1200"), 88, "lse-api");
      
      // Update reserve data
      await oracle.connect(dataSource).updateReserveData(
        ethers.parseEther("5000"),
        ethers.parseEther("3000"),
        ethers.parseEther("2000")
      );

      // Verify all data
      const goldPrice = await oracle.getGoldPrice();
      expect(goldPrice.price).to.equal(ethers.parseEther("2000"));

      const bond1Price = await oracle.getBondPrice("LSE-BOND-1");
      expect(bond1Price.price).to.equal(ethers.parseEther("1000"));

      const bond2Price = await oracle.getBondPrice("LSE-BOND-2");
      expect(bond2Price.price).to.equal(ethers.parseEther("1200"));

      const reserveData = await oracle.getReserveData();
      expect(reserveData.totalReserves).to.equal(ethers.parseEther("5000"));
      expect(reserveData.goldValue).to.equal(ethers.parseEther("3000"));
      expect(reserveData.bondValue).to.equal(ethers.parseEther("2000"));
    });
  });
});
