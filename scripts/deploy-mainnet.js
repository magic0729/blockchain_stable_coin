const { ethers } = require("hardhat");

async function main() {
  console.log("Starting MAINNET deployment...");
  console.log("⚠️  WARNING: This will deploy to MAINNET!");
  console.log("⚠️  Make sure you have:");
  console.log("   - Sufficient ETH for gas fees");
  console.log("   - Verified all contract code");
  console.log("   - Completed security audits");
  console.log("   - Set up proper oracle data sources");
  console.log("   - Configured compliance monitoring");
  
  // Confirmation prompt (in a real scenario, you'd want user input)
  console.log("\nProceeding with mainnet deployment in 5 seconds...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");

  // Get the contract factories
  const Stablecoin = await ethers.getContractFactory("GoldBackedStablecoin");
  const ReserveManager = await ethers.getContractFactory("ReserveManager");
  const Oracle = await ethers.getContractFactory("Oracle");

  // Deploy contracts with higher gas limits for mainnet
  console.log("\n=== Deploying Contracts ===");
  
  console.log("Deploying Stablecoin contract...");
  const stablecoin = await Stablecoin.deploy(
    "Gold-Backed Stablecoin",
    "GBS",
    0, // No initial supply
    {
      gasLimit: 5000000 // Higher gas limit for mainnet
    }
  );
  await stablecoin.deployed();
  console.log("Stablecoin deployed to:", stablecoin.address);

  console.log("Deploying ReserveManager contract...");
  const reserveManager = await ReserveManager.deploy({
    gasLimit: 3000000
  });
  await reserveManager.deployed();
  console.log("ReserveManager deployed to:", reserveManager.address);

  console.log("Deploying Oracle contract...");
  const oracle = await Oracle.deploy({
    gasLimit: 3000000
  });
  await oracle.deployed();
  console.log("Oracle deployed to:", oracle.address);

  // Wait for multiple confirmations on mainnet
  console.log("\n=== Waiting for Confirmations ===");
  console.log("Waiting for 5 confirmations on mainnet...");
  await stablecoin.deployTransaction.wait(5);
  await reserveManager.deployTransaction.wait(5);
  await oracle.deployTransaction.wait(5);
  console.log("All contracts confirmed!");

  // Set up contract relationships
  console.log("\n=== Setting up Contract Relationships ===");
  
  // Set oracle address in stablecoin
  const tx1 = await stablecoin.setOracleAddress(oracle.address, { gasLimit: 200000 });
  await tx1.wait(2);
  console.log("Oracle address set in Stablecoin");

  // Set reserve manager address in stablecoin
  const tx2 = await stablecoin.setReserveManagerAddress(reserveManager.address, { gasLimit: 200000 });
  await tx2.wait(2);
  console.log("ReserveManager address set in Stablecoin");

  // Set stablecoin address in reserve manager
  const tx3 = await reserveManager.setStablecoinAddress(stablecoin.address, { gasLimit: 200000 });
  await tx3.wait(2);
  console.log("Stablecoin address set in ReserveManager");

  // Set oracle address in reserve manager
  const tx4 = await reserveManager.setOracleAddress(oracle.address, { gasLimit: 200000 });
  await tx4.wait(2);
  console.log("Oracle address set in ReserveManager");

  // Set stablecoin address in oracle
  const tx5 = await oracle.setStablecoinAddress(stablecoin.address, { gasLimit: 200000 });
  await tx5.wait(2);
  console.log("Stablecoin address set in Oracle");

  // Set reserve manager address in oracle
  const tx6 = await oracle.setReserveManagerAddress(reserveManager.address, { gasLimit: 200000 });
  await tx6.wait(2);
  console.log("ReserveManager address set in Oracle");

  // Deployer becomes the first whitelisted user
  const tx7 = await stablecoin.whitelistUser(deployer.address, { gasLimit: 200000 });
  await tx7.wait(2);
  console.log("Deployer whitelisted as user");

  // Set up initial oracle data source (for testing - replace with real sources)
  const tx8 = await oracle.addDataSource(deployer.address, "mainnet-initial", { gasLimit: 200000 });
  await tx8.wait(2);
  console.log("Initial oracle data source added");

  // Update initial oracle data with real-world values
  const tx9 = await oracle.updateGoldPrice(
    ethers.utils.parseEther("2000"), // $2000 per ounce (update with real price)
    95, // 95% confidence
    "mainnet-initial",
    { gasLimit: 200000 }
  );
  await tx9.wait(2);
  console.log("Initial gold price set: $2000/oz");

  const tx10 = await oracle.updateReserveData(0, 0, 0, { gasLimit: 200000 });
  await tx10.wait(2);
  console.log("Initial reserve data set");

  console.log("\n=== MAINNET Deployment Summary ===");
  console.log("Network:", await ethers.provider.getNetwork().then(n => n.name));
  console.log("Chain ID:", await ethers.provider.getNetwork().then(n => n.chainId));
  console.log("Deployer:", deployer.address);
  console.log("Stablecoin:", stablecoin.address);
  console.log("ReserveManager:", reserveManager.address);
  console.log("Oracle:", oracle.address);
  console.log("\n🎉 MAINNET DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉");

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
    },
    transactionHashes: {
      stablecoin: stablecoin.deployTransaction.hash,
      reserveManager: reserveManager.deployTransaction.hash,
      oracle: oracle.deployTransaction.hash
    }
  };

  console.log("\nDeployment Info (JSON):");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file for record keeping
  const fs = require('fs');
  const filename = `deployment-mainnet-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${filename}`);

  // Verification instructions
  console.log("\n=== Verification Instructions ===");
  console.log("To verify contracts on Etherscan, run:");
  console.log(`npx hardhat verify --network mainnet ${stablecoin.address} "Gold-Backed Stablecoin" "GBS" 0`);
  console.log(`npx hardhat verify --network mainnet ${reserveManager.address}`);
  console.log(`npx hardhat verify --network mainnet ${oracle.address}`);

  // Post-deployment checklist
  console.log("\n=== Post-Deployment Checklist ===");
  console.log("✅ Contracts deployed to mainnet");
  console.log("⏳ Verify contracts on Etherscan");
  console.log("⏳ Set up real oracle data sources (Chainlink, etc.)");
  console.log("⏳ Configure LSE bond price feeds");
  console.log("⏳ Set up compliance monitoring");
  console.log("⏳ Deploy frontend application");
  console.log("⏳ Set up multi-signature wallet for admin functions");
  console.log("⏳ Configure emergency pause procedures");
  console.log("⏳ Set up monitoring and alerting");
  console.log("⏳ Conduct final security audit");
  console.log("⏳ Launch public announcement");

  // Security reminders
  console.log("\n=== Security Reminders ===");
  console.log("🔒 Transfer ownership to multi-signature wallet");
  console.log("🔒 Set up proper access controls");
  console.log("🔒 Configure emergency pause procedures");
  console.log("🔒 Set up monitoring and alerting");
  console.log("🔒 Regular security audits");
  console.log("🔒 Keep private keys secure");
  console.log("🔒 Regular backup procedures");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Mainnet deployment failed:", error);
    process.exit(1);
  });
