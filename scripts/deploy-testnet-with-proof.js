const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting testnet deployment with on-chain proof generation...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Get network information
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);

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
  await stablecoin.waitForDeployment();
  console.log("✅ Stablecoin deployed to:", await stablecoin.getAddress());

  console.log("Deploying ReserveManager contract...");
  const reserveManager = await ReserveManager.deploy();
  await reserveManager.waitForDeployment();
  console.log("✅ ReserveManager deployed to:", await reserveManager.getAddress());

  console.log("Deploying Oracle contract...");
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();
  console.log("✅ Oracle deployed to:", await oracle.getAddress());

  // Wait for confirmations (skip for hardhat network)
  console.log("\n=== Waiting for Confirmations ===");
  if (network.name !== "hardhat") {
    await stablecoin.deploymentTransaction().wait(3);
    await reserveManager.deploymentTransaction().wait(3);
    await oracle.deploymentTransaction().wait(3);
    console.log("✅ Confirmations received");
  } else {
    console.log("✅ Hardhat network - confirmations not needed");
  }

  // Set up contract relationships
  console.log("\n=== Setting up Contract Relationships ===");
  
  // Set oracle address in stablecoin
  const tx1 = await stablecoin.setOracleAddress(await oracle.getAddress());
  await tx1.wait();
  console.log("✅ Oracle address set in Stablecoin");

  // Set reserve manager address in stablecoin
  const tx2 = await stablecoin.setReserveManagerAddress(await reserveManager.getAddress());
  await tx2.wait();
  console.log("✅ ReserveManager address set in Stablecoin");

  // Set stablecoin address in reserve manager
  const tx3 = await reserveManager.setStablecoinAddress(await stablecoin.getAddress());
  await tx3.wait();
  console.log("✅ Stablecoin address set in ReserveManager");

  // Set oracle address in reserve manager
  const tx4 = await reserveManager.setOracleAddress(await oracle.getAddress());
  await tx4.wait();
  console.log("✅ Oracle address set in ReserveManager");

  // Set stablecoin address in oracle
  const tx5 = await oracle.setStablecoinAddress(await stablecoin.getAddress());
  await tx5.wait();
  console.log("✅ Stablecoin address set in Oracle");

  // Set reserve manager address in oracle
  const tx6 = await oracle.setReserveManagerAddress(await reserveManager.getAddress());
  await tx6.wait();
  console.log("✅ ReserveManager address set in Oracle");

  // Deployer becomes the first whitelisted user
  const tx7 = await stablecoin.whitelistUser(deployer.address);
  await tx7.wait();
  console.log("✅ Deployer whitelisted as user");

  // Set up initial oracle data source (for testing)
  const tx8 = await oracle.addDataSource(deployer.address, "testnet-mock");
  await tx8.wait();
  console.log("✅ Initial oracle data source added");

  // Update initial oracle data
  const tx9 = await oracle.updateGoldPrice(
    ethers.parseEther("2000"), // $2000 per ounce
    95, // 95% confidence
    "testnet-mock"
  );
  await tx9.wait();
  console.log("✅ Initial gold price set: $2000/oz");

  const tx10 = await oracle.updateReserveData(0, 0, 0);
  await tx10.wait();
  console.log("✅ Initial reserve data set");

  // Generate deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    contracts: {
      stablecoin: await stablecoin.getAddress(),
      reserveManager: await reserveManager.getAddress(),
      oracle: await oracle.getAddress()
    },
    transactionHashes: {
      stablecoin: stablecoin.deploymentTransaction().hash,
      reserveManager: reserveManager.deploymentTransaction().hash,
      oracle: oracle.deploymentTransaction().hash
    },
    gasUsed: {
      stablecoin: stablecoin.deploymentTransaction().gasLimit.toString(),
      reserveManager: reserveManager.deploymentTransaction().gasLimit.toString(),
      oracle: oracle.deploymentTransaction().gasLimit.toString()
    },
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };

  // Save deployment info to file
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(deploymentFile), { recursive: true });
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("📁 Deployment info saved to:", deploymentFile);

  // Generate on-chain proof links
  console.log("\n=== On-Chain Proof Links ===");
  
  const explorerBaseUrl = getExplorerUrl(network.chainId);
  
  console.log("🔗 Contract Addresses:");
  console.log(`Stablecoin: ${await stablecoin.getAddress()}`);
  console.log(`ReserveManager: ${await reserveManager.getAddress()}`);
  console.log(`Oracle: ${await oracle.getAddress()}`);
  
  console.log("\n🔗 Explorer Links:");
  console.log(`Stablecoin Contract: ${explorerBaseUrl}/address/${await stablecoin.getAddress()}`);
  console.log(`ReserveManager Contract: ${explorerBaseUrl}/address/${await reserveManager.getAddress()}`);
  console.log(`Oracle Contract: ${explorerBaseUrl}/address/${await oracle.getAddress()}`);
  
  console.log("\n🔗 Transaction Links:");
  console.log(`Stablecoin Deployment: ${explorerBaseUrl}/tx/${stablecoin.deploymentTransaction().hash}`);
  console.log(`ReserveManager Deployment: ${explorerBaseUrl}/tx/${reserveManager.deploymentTransaction().hash}`);
  console.log(`Oracle Deployment: ${explorerBaseUrl}/tx/${oracle.deploymentTransaction().hash}`);

  // Generate verification commands
  console.log("\n=== Contract Verification Commands ===");
  console.log("Run these commands to verify contracts on Etherscan:");
  console.log(`npx hardhat verify --network ${network.name} ${await stablecoin.getAddress()} "Gold-Backed Stablecoin" "GBS" 0`);
  console.log(`npx hardhat verify --network ${network.name} ${await reserveManager.getAddress()}`);
  console.log(`npx hardhat verify --network ${network.name} ${await oracle.getAddress()}`);

  // Generate proof summary
  const stablecoinAddress = await stablecoin.getAddress();
  const reserveManagerAddress = await reserveManager.getAddress();
  const oracleAddress = await oracle.getAddress();
  
  const proofSummary = {
    title: "Gold-Backed Stablecoin Testnet Deployment Proof",
    network: network.name,
    chainId: network.chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      stablecoin: {
        address: stablecoinAddress,
        explorer: `${explorerBaseUrl}/address/${stablecoinAddress}`,
        transaction: `${explorerBaseUrl}/tx/${stablecoin.deploymentTransaction().hash}`
      },
      reserveManager: {
        address: reserveManagerAddress,
        explorer: `${explorerBaseUrl}/address/${reserveManagerAddress}`,
        transaction: `${explorerBaseUrl}/tx/${reserveManager.deploymentTransaction().hash}`
      },
      oracle: {
        address: oracleAddress,
        explorer: `${explorerBaseUrl}/address/${oracleAddress}`,
        transaction: `${explorerBaseUrl}/tx/${oracle.deploymentTransaction().hash}`
      }
    },
    verification: {
      status: "pending",
      commands: [
        `npx hardhat verify --network ${network.name} ${stablecoinAddress} "Gold-Backed Stablecoin" "GBS" 0`,
        `npx hardhat verify --network ${network.name} ${reserveManagerAddress}`,
        `npx hardhat verify --network ${network.name} ${oracleAddress}`
      ]
    }
  };

  // Save proof summary
  const proofFile = path.join(__dirname, "..", "deployments", `proof-${network.name}-${Date.now()}.json`);
  fs.writeFileSync(proofFile, JSON.stringify(proofSummary, null, 2));
  console.log("📄 Proof summary saved to:", proofFile);

  console.log("\n=== Deployment Summary ===");
  console.log("✅ All contracts deployed successfully!");
  console.log("✅ Contract relationships configured!");
  console.log("✅ On-chain proof links generated!");
  console.log("✅ Deployment info saved!");
  
  console.log("\n=== Next Steps ===");
  console.log("1. Verify contracts on Etherscan using the commands above");
  console.log("2. Share the explorer links as proof of deployment");
  console.log("3. Set up real oracle data sources");
  console.log("4. Configure LSE bond price feeds");
  console.log("5. Deploy frontend application");
  console.log("6. Conduct security audit");
  console.log("7. Launch mainnet deployment");

  return deploymentInfo;
}

function getExplorerUrl(chainId) {
  switch (chainId.toString()) {
    case "1":
      return "https://etherscan.io";
    case "11155111":
      return "https://sepolia.etherscan.io";
    case "5":
      return "https://goerli.etherscan.io";
    case "137":
      return "https://polygonscan.com";
    case "80001":
      return "https://mumbai.polygonscan.com";
    case "56":
      return "https://bscscan.com";
    case "97":
      return "https://testnet.bscscan.com";
    case "42161":
      return "https://arbiscan.io";
    case "421614":
      return "https://sepolia.arbiscan.io";
    default:
      return `https://explorer.chainid=${chainId}`;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
