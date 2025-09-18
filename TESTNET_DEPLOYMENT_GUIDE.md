# Client Deployment Guide - Gold-Backed Stablecoin

## 🚀 Quick Start for Testnet Deployment

### Step 1: Setup (5 minutes)
```bash
# 1. Install dependencies
npm install

# 2. Copy environment template (REQUIRED)
cp env.example .env

# 3. Edit .env with your actual credentials:
#    - TESTNET_RPC_URL (get from Infura/Alchemy)
#    - PRIVATE_KEY (your wallet private key - 64 characters)
#    - ETHERSCAN_API_KEY (get from Etherscan)
```

### Step 2: Get Testnet ETH
- **Sepolia (Recommended)**: [Sepolia Faucet](https://sepoliafaucet.com/)
- **Goerli**: [Goerli Faucet](https://goerlifaucet.com/)
- **Mumbai (Polygon)**: [Mumbai Faucet](https://faucet.polygon.technology/)

### Step 3: Deploy with Proof Generation
```bash
npm run deploy:testnet:proof
```

### Step 4: Verify Contracts (Optional)
```bash
npm run verify:contracts
```

## 📋 What You Get

After deployment, you'll receive:

### ✅ **On-Chain Proof Links**
- Contract addresses on blockchain explorer
- Deployment transaction hashes
- Verification status

### ✅ **Generated Files**
- `deployments/{network}-{timestamp}.json` - Deployment details
- `deployments/proof-{network}-{timestamp}.json` - Proof summary (JSON)
- `deployments/proof-{network}-{timestamp}.md` - Proof summary (Markdown)

### ✅ **Example Output**
```
🔗 Contract Addresses:
Stablecoin: 0x1234...5678
ReserveManager: 0x2345...6789
Oracle: 0x3456...7890

🔗 Explorer Links:
Stablecoin: https://sepolia.etherscan.io/address/0x1234...5678
ReserveManager: https://sepolia.etherscan.io/address/0x2345...6789
Oracle: https://sepolia.etherscan.io/address/0x3456...7890
```

## 🔧 Available Commands

| Command | Description |
|---------|-------------|
| `npm run deploy:testnet:proof` | **Main command** - Deploy with proof generation |
| `npm run verify:contracts` | Verify contracts on Etherscan |
| `npm run generate:proof` | Generate proof links from existing deployment |
| `npm run test:all` | Run all tests |
| `npm run compile` | Compile contracts |

## 🌐 Supported Testnets

| Network | Chain ID | Explorer |
|---------|----------|----------|
| **Sepolia** (Recommended) | 11155111 | [sepolia.etherscan.io](https://sepolia.etherscan.io) |
| Goerli | 5 | [goerli.etherscan.io](https://goerli.etherscan.io) |
| Mumbai (Polygon) | 80001 | [mumbai.polygonscan.com](https://mumbai.polygonscan.com) |
| BSC Testnet | 97 | [testnet.bscscan.com](https://testnet.bscscan.com) |
| Arbitrum Sepolia | 421614 | [sepolia.arbiscan.io](https://sepolia.arbiscan.io) |

## 🔑 Getting API Keys

### **Infura/Alchemy (RPC URL)**
1. Go to [Infura](https://infura.io/) or [Alchemy](https://alchemy.com/)
2. Create account and new project
3. Copy the HTTPS URL for your chosen testnet

### **Etherscan API Key**
1. Go to [Etherscan](https://etherscan.io/apis)
2. Create account and generate API key
3. Add to `.env` file

## ⚠️ Security Notes

- **Never share your private key**
- **Use different wallets for testnet and mainnet**
- **Never commit `.env` file to version control**
- **Test thoroughly before mainnet deployment**

## 🆘 Troubleshooting

### **"Private key too short"**
- Ensure your private key is 64 characters (plus 0x prefix)
- Example: `0x1234567890abcdef...` (66 characters total)

### **"Insufficient funds"**
- Get testnet ETH from faucets listed above
- Ensure you have enough for gas fees

### **"Network not found"**
- Check your RPC URL in `.env` file
- Ensure network is supported (see list above)

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your `.env` configuration
3. Ensure you have sufficient testnet ETH
4. Review the detailed [TESTNET_DEPLOYMENT_GUIDE.md](TESTNET_DEPLOYMENT_GUIDE.md)

---

**Ready to deploy?** Run `npm run deploy:testnet:proof` and get your on-chain proof links! 🎯
