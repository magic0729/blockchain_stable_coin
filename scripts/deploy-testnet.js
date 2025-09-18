const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment to testnet...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Get the contract factories
  const Stablecoin = await ethers.getContractFactory("GoldBackedStablecoin");
  const ReserveManager = await ethers.getContractFactory("ReserveManager");
  const Oracle = await ethers.getContractFactory("Oracle");

  // Deploy contracts
  console.log("\n=== Deploying Contracts ===");
  
  console.log("Deploying Stablecoin contract...");
  const stablecoin = await Stablecoin.deploy(
    "Gold-Backed Stablecoin",
    "GBS",
    0 // No initial supply
  );
  await stablecoin.deployed();
  console.log("Stablecoin deployed to:", stablecoin.address);

  console.log("Deploying ReserveManager contract...");
  const reserveManager = await ReserveManager.deploy();
  await reserveManager.deployed();
  console.log("ReserveManager deployed to:", reserveManager.address);

  console.log("Deploying Oracle contract...");
  const oracle = await Oracle.deploy();
  await oracle.deployed();
  console.log("Oracle deployed to:", oracle.address);

  // Wait for confirmations
  console.log("\n=== Waiting for Confirmations ===");
  await stablecoin.deployTransaction.wait(3);
  await reserveManager.deployTransaction.wait(3);
  await oracle.deployTransaction.wait(3);

  // Set up contract relationships
  console.log("\n=== Setting up Contract Relationships ===");
  
  // Set oracle address in stablecoin
  const tx1 = await stablecoin.setOracleAddress(oracle.address);
  await tx1.wait();
  console.log("Oracle address set in Stablecoin");

  // Set reserve manager address in stablecoin
  const tx2 = await stablecoin.setReserveManagerAddress(reserveManager.address);
  await tx2.wait();
  console.log("ReserveManager address set in Stablecoin");

  // Set stablecoin address in reserve manager
  const tx3 = await reserveManager.setStablecoinAddress(stablecoin.address);
  await tx3.wait();
  console.log("Stablecoin address set in ReserveManager");

  // Set oracle address in reserve manager
  const tx4 = await reserveManager.setOracleAddress(oracle.address);
  await tx4.wait();
  console.log("Oracle address set in ReserveManager");

  // Set stablecoin address in oracle
  const tx5 = await oracle.setStablecoinAddress(stablecoin.address);
  await tx5.wait();
  console.log("Stablecoin address set in Oracle");

  // Set reserve manager address in oracle
  const tx6 = await oracle.setReserveManagerAddress(reserveManager.address);
  await tx6.wait();
  console.log("ReserveManager address set in Oracle");

  // Deployer becomes the first whitelisted user
  const tx7 = await stablecoin.whitelistUser(deployer.address);
  await tx7.wait();
  console.log("Deployer whitelisted as user");

  // Set up initial oracle data source (for testing)
  const tx8 = await oracle.addDataSource(deployer.address, "testnet-mock");
  await tx8.wait();
  console.log("Initial oracle data source added");

  // Update initial oracle data
  const tx9 = await oracle.updateGoldPrice(
    ethers.utils.parseEther("2000"), // $2000 per ounce
    95, // 95% confidence
    "testnet-mock"
  );
  await tx9.wait();
  console.log("Initial gold price set: $2000/oz");

  const tx10 = await oracle.updateReserveData(0, 0, 0);
  await tx10.wait();
  console.log("Initial reserve data set");

  console.log("\n=== Deployment Summary ===");
  console.log("Network:", await ethers.provider.getNetwork().then(n => n.name));
  console.log("Chain ID:", await ethers.provider.getNetwork().then(n => n.chainId));
  console.log("Deployer:", deployer.address);
  console.log("Stablecoin:", stablecoin.address);
  console.log("ReserveManager:", reserveManager.address);
  console.log("Oracle:", oracle.address);
  console.log("\nDeployment completed successfully!");

  // Save deployment info
  const deploymentInfo = {
    network: await ethers.provider.getNetwork().then(n => n.name),
    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
    deployer: deployer.address,
    contracts: {
      stablecoin: stablecoin.address,
      reserveManager: reserveManager.address,
      oracle: oracle.address
    },
    timestamp: new Date().toISOString(),
    gasUsed: {
      stablecoin: stablecoin.deployTransaction.gasLimit.toString(),
      reserveManager: reserveManager.deployTransaction.gasLimit.toString(),
      oracle: oracle.deployTransaction.gasLimit.toString()
    }
  };

  console.log("\nDeployment Info (JSON):");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Verification instructions
  console.log("\n=== Verification Instructions ===");
  console.log("To verify contracts on Etherscan, run:");
  console.log(`npx hardhat verify --network ${await ethers.provider.getNetwork().then(n => n.name)} ${stablecoin.address} "Gold-Backed Stablecoin" "GBS" 0`);
  console.log(`npx hardhat verify --network ${await ethers.provider.getNetwork().then(n => n.name)} ${reserveManager.address}`);
  console.log(`npx hardhat verify --network ${await ethers.provider.getNetwork().then(n => n.name)} ${oracle.address}`);

  // Next steps
  console.log("\n=== Next Steps ===");
  console.log("1. Verify contracts on Etherscan");
  console.log("2. Set up real oracle data sources");
  console.log("3. Configure LSE bond price feeds");
  console.log("4. Set up compliance monitoring");
  console.log("5. Deploy frontend application");
  console.log("6. Conduct security audit");
  console.log("7. Launch mainnet deployment");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
