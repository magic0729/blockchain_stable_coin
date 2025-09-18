const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔗 Generating on-chain proof links...");

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

  // Generate explorer links
  const explorerBaseUrl = getExplorerUrl(network.chainId);
  
  console.log("\n=== Contract Information ===");
  console.log("Network:", deploymentInfo.network);
  console.log("Chain ID:", deploymentInfo.chainId);
  console.log("Deployer:", deploymentInfo.deployer);
  console.log("Block Number:", deploymentInfo.blockNumber);
  console.log("Timestamp:", deploymentInfo.timestamp);

  console.log("\n=== Contract Addresses ===");
  console.log("Stablecoin:", deploymentInfo.contracts.stablecoin);
  console.log("ReserveManager:", deploymentInfo.contracts.reserveManager);
  console.log("Oracle:", deploymentInfo.contracts.oracle);

  console.log("\n=== Explorer Links ===");
  console.log("🔗 Contract Pages:");
  console.log(`Stablecoin: ${explorerBaseUrl}/address/${deploymentInfo.contracts.stablecoin}`);
  console.log(`ReserveManager: ${explorerBaseUrl}/address/${deploymentInfo.contracts.reserveManager}`);
  console.log(`Oracle: ${explorerBaseUrl}/address/${deploymentInfo.contracts.oracle}`);

  console.log("\n🔗 Transaction Pages:");
  console.log(`Stablecoin Deployment: ${explorerBaseUrl}/tx/${deploymentInfo.transactionHashes.stablecoin}`);
  console.log(`ReserveManager Deployment: ${explorerBaseUrl}/tx/${deploymentInfo.transactionHashes.reserveManager}`);
  console.log(`Oracle Deployment: ${explorerBaseUrl}/tx/${deploymentInfo.transactionHashes.oracle}`);

  // Generate verification status
  console.log("\n=== Verification Status ===");
  console.log("To verify contracts, run:");
  console.log(`npx hardhat verify --network ${network.name} ${deploymentInfo.contracts.stablecoin} "Gold-Backed Stablecoin" "GBS" 0`);
  console.log(`npx hardhat verify --network ${network.name} ${deploymentInfo.contracts.reserveManager}`);
  console.log(`npx hardhat verify --network ${network.name} ${deploymentInfo.contracts.oracle}`);

  // Generate proof summary
  const proofSummary = {
    title: "Gold-Backed Stablecoin Testnet Deployment Proof",
    network: deploymentInfo.network,
    chainId: deploymentInfo.chainId,
    timestamp: deploymentInfo.timestamp,
    deployer: deploymentInfo.deployer,
    blockNumber: deploymentInfo.blockNumber,
    contracts: {
      stablecoin: {
        address: deploymentInfo.contracts.stablecoin,
        explorer: `${explorerBaseUrl}/address/${deploymentInfo.contracts.stablecoin}`,
        transaction: `${explorerBaseUrl}/tx/${deploymentInfo.transactionHashes.stablecoin}`,
        verified: false
      },
      reserveManager: {
        address: deploymentInfo.contracts.reserveManager,
        explorer: `${explorerBaseUrl}/address/${deploymentInfo.contracts.reserveManager}`,
        transaction: `${explorerBaseUrl}/tx/${deploymentInfo.transactionHashes.reserveManager}`,
        verified: false
      },
      oracle: {
        address: deploymentInfo.contracts.oracle,
        explorer: `${explorerBaseUrl}/address/${deploymentInfo.contracts.oracle}`,
        transaction: `${explorerBaseUrl}/tx/${deploymentInfo.transactionHashes.oracle}`,
        verified: false
      }
    },
    verification: {
      status: "pending",
      commands: [
        `npx hardhat verify --network ${network.name} ${deploymentInfo.contracts.stablecoin} "Gold-Backed Stablecoin" "GBS" 0`,
        `npx hardhat verify --network ${network.name} ${deploymentInfo.contracts.reserveManager}`,
        `npx hardhat verify --network ${network.name} ${deploymentInfo.contracts.oracle}`
      ]
    }
  };

  // Save proof summary
  const proofFile = path.join(deploymentsDir, `proof-${network.name}-${Date.now()}.json`);
  fs.writeFileSync(proofFile, JSON.stringify(proofSummary, null, 2));
  console.log("\n📄 Proof summary saved to:", proofFile);

  // Generate markdown proof
  const markdownProof = generateMarkdownProof(proofSummary, explorerBaseUrl);
  const markdownFile = path.join(deploymentsDir, `proof-${network.name}-${Date.now()}.md`);
  fs.writeFileSync(markdownFile, markdownProof);
  console.log("📄 Markdown proof saved to:", markdownFile);

  console.log("\n✅ On-chain proof links generated successfully!");
  console.log("📋 You can now share these links as proof of your testnet deployment.");

  return proofSummary;
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

function generateMarkdownProof(proofSummary, explorerBaseUrl) {
  return `# Gold-Backed Stablecoin Testnet Deployment Proof

## Deployment Information
- **Network**: ${proofSummary.network}
- **Chain ID**: ${proofSummary.chainId}
- **Deployer**: [${proofSummary.deployer}](${explorerBaseUrl}/address/${proofSummary.deployer})
- **Block Number**: ${proofSummary.blockNumber}
- **Timestamp**: ${proofSummary.timestamp}

## Contract Addresses

### Stablecoin Contract
- **Address**: [${proofSummary.contracts.stablecoin}](${proofSummary.contracts.stablecoin.explorer})
- **Deployment Transaction**: [View on Explorer](${proofSummary.contracts.stablecoin.transaction})
- **Verified**: ${proofSummary.contracts.stablecoin.verified ? '✅ Yes' : '❌ No'}

### ReserveManager Contract
- **Address**: [${proofSummary.contracts.reserveManager}](${proofSummary.contracts.reserveManager.explorer})
- **Deployment Transaction**: [View on Explorer](${proofSummary.contracts.reserveManager.transaction})
- **Verified**: ${proofSummary.contracts.reserveManager.verified ? '✅ Yes' : '❌ No'}

### Oracle Contract
- **Address**: [${proofSummary.contracts.oracle}](${proofSummary.contracts.oracle.explorer})
- **Deployment Transaction**: [View on Explorer](${proofSummary.contracts.oracle.transaction})
- **Verified**: ${proofSummary.contracts.oracle.verified ? '✅ Yes' : '❌ No'}

## Verification Commands

To verify these contracts on Etherscan, run:

\`\`\`bash
${proofSummary.verification.commands.join('\n')}
\`\`\`

## Proof of Deployment

This document serves as proof that the Gold-Backed Stablecoin contracts have been successfully deployed to the ${proofSummary.network} testnet. All contract addresses and transaction hashes are verifiable on the blockchain explorer.

**Generated on**: ${new Date().toISOString()}
`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed to generate proof links:", error);
    process.exit(1);
  });
