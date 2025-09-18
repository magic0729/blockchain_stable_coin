const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment of Gold-Backed Stablecoin contracts...");

  // Get the contract factories
  const Stablecoin = await ethers.getContractFactory("GoldBackedStablecoin");
  const ReserveManager = await ethers.getContractFactory("ReserveManager");
  const Oracle = await ethers.getContractFactory("Oracle");

  // Deploy contracts
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

  // Set up contract relationships
  console.log("Setting up contract relationships...");
  
  // Set oracle address in stablecoin
  await stablecoin.setOracleAddress(oracle.address);
  console.log("Oracle address set in Stablecoin");

  // Set reserve manager address in stablecoin
  await stablecoin.setReserveManagerAddress(reserveManager.address);
  console.log("ReserveManager address set in Stablecoin");

  // Set stablecoin address in reserve manager
  await reserveManager.setStablecoinAddress(stablecoin.address);
  console.log("Stablecoin address set in ReserveManager");

  // Set oracle address in reserve manager
  await reserveManager.setOracleAddress(oracle.address);
  console.log("Oracle address set in ReserveManager");

  // Set stablecoin address in oracle
  await oracle.setStablecoinAddress(stablecoin.address);
  console.log("Stablecoin address set in Oracle");

  // Set reserve manager address in oracle
  await oracle.setReserveManagerAddress(reserveManager.address);
  console.log("ReserveManager address set in Oracle");

  // Deployer becomes the owner and first whitelisted user
  const [deployer] = await ethers.getSigners();
  await stablecoin.whitelistUser(deployer.address);
  console.log("Deployer whitelisted as user");

  console.log("\n=== Deployment Summary ===");
  console.log("Network:", await ethers.provider.getNetwork().then(n => n.name));
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
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
