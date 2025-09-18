const { ethers } = require("hardhat");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 Starting contract verification process...");

  // Get network information
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);

  // Check if deployment info exists
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    console.error("❌ No deployments directory found. Please deploy contracts first.");
    process.exit(1);
  }

  // Find the most recent deployment file
  const deploymentFiles = fs.readdirSync(deploymentsDir)
    .filter(file => file.endsWith('.json') && file.startsWith(network.name))
    .sort()
    .reverse();

  if (deploymentFiles.length === 0) {
    console.error("❌ No deployment files found for this network.");
    console.log("Please run: npm run deploy:testnet");
    process.exit(1);
  }

  const latestDeployment = deploymentFiles[0];
  const deploymentPath = path.join(deploymentsDir, latestDeployment);
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

  console.log("📁 Using deployment file:", latestDeployment);

  // Check if Etherscan API key is available
  if (!process.env.ETHERSCAN_API_KEY) {
    console.error("❌ ETHERSCAN_API_KEY not found in environment variables.");
    console.log("Please add your Etherscan API key to your .env file:");
    console.log("ETHERSCAN_API_KEY=your-etherscan-api-key");
    process.exit(1);
  }

  const contracts = [
    {
      name: "Stablecoin",
      address: deploymentInfo.contracts.stablecoin,
      constructorArgs: `"Gold-Backed Stablecoin" "GBS" 0`
    },
    {
      name: "ReserveManager",
      address: deploymentInfo.contracts.reserveManager,
      constructorArgs: ""
    },
    {
      name: "Oracle",
      address: deploymentInfo.contracts.oracle,
      constructorArgs: ""
    }
  ];

  console.log("\n=== Verifying Contracts ===");

  for (const contract of contracts) {
    console.log(`\n🔍 Verifying ${contract.name}...`);
    
    const command = `npx hardhat verify --network ${network.name} ${contract.address} ${contract.constructorArgs}`.trim();
    console.log("Command:", command);

    try {
      await executeCommand(command);
      console.log(`✅ ${contract.name} verified successfully!`);
    } catch (error) {
      console.error(`❌ Failed to verify ${contract.name}:`, error.message);
      
      // Check if contract is already verified
      if (error.message.includes("already verified")) {
        console.log(`ℹ️  ${contract.name} is already verified.`);
      } else {
        console.log(`🔧 Manual verification command:`);
        console.log(command);
      }
    }
  }

  // Update deployment info with verification status
  console.log("\n=== Updating Verification Status ===");
  
  const explorerBaseUrl = getExplorerUrl(network.chainId);
  
  // Check verification status for each contract
  for (const contract of contracts) {
    try {
      const isVerified = await checkVerificationStatus(contract.address, explorerBaseUrl);
      console.log(`${contract.name} verification status: ${isVerified ? '✅ Verified' : '❌ Not verified'}`);
    } catch (error) {
      console.log(`${contract.name} verification status: ❓ Unknown`);
    }
  }

  console.log("\n=== Verification Summary ===");
  console.log("Contract verification process completed!");
  console.log("Check the explorer links to confirm verification status:");
  
  for (const contract of contracts) {
    console.log(`${contract.name}: ${explorerBaseUrl}/address/${contract.address}`);
  }

  console.log("\n=== Next Steps ===");
  console.log("1. Verify all contracts are showing as verified on the explorer");
  console.log("2. Run 'npm run generate:proof' to generate updated proof links");
  console.log("3. Share the verified contract links as proof of deployment");
}

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr && !stderr.includes("Warning")) {
        reject(new Error(stderr));
        return;
      }
      resolve(stdout);
    });
  });
}

async function checkVerificationStatus(contractAddress, explorerBaseUrl) {
  try {
    // This is a simplified check - in practice, you might want to use the Etherscan API
    // to check verification status more accurately
    const response = await fetch(`${explorerBaseUrl}/api?module=contract&action=getsourcecode&address=${contractAddress}`);
    const data = await response.json();
    return data.result && data.result[0] && data.result[0].SourceCode !== "";
  } catch (error) {
    return false;
  }
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
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
