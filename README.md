# Gold-Backed Stablecoin (LSE Bond-Collateralized)

## Overview
A gold-backed stablecoin where each token is collateralized by London Stock Exchange-listed bonds backed by NI 43-101 compliant gold assets. The system emphasizes transparency (proof-of-reserves), regulatory alignment, and operational safety.

## Milestones
- Milestone 1: Foundation & Legal Structuring ✅
  - Repo scaffold, docs, architecture, interfaces only
- Milestone 2: Core Development ✅
  - Full contract logic (ERC-20 + mint/burn/redeem)
  - Oracle integration stubs and data model
  - Reserve management (bond deposit/withdraw/consume/release)
  - Proof-of-Reserves view function
  - Tests and deployment scripts
- Milestone 3: Production Deployment (Next)
  - Security audits, real oracle feeds, frontend, compliance monitoring, production deployment

## Repo Structure
```
contracts/
  Stablecoin.sol        # ERC-20 + mint/burn/redeem + PoR
  ReserveManager.sol    # Bond collateral lifecycle and ratios
  Oracle.sol            # Prices, reserves snapshot, source management
scripts/
  deploy.js             # Local deploy
  deploy-testnet.js     # Testnet deploy (basic)
  deploy-testnet-with-proof.js  # Testnet deploy with proof generation ⭐
  deploy-mainnet.js     # Mainnet deploy (caution)
  verify-contracts.js   # Automated contract verification
  generate-proof-links.js # Generate proof links from deployment
  test-all.js           # Convenience runner for tests/coverage
test/
  Stablecoin.test.js
  ReserveManager.test.js
  Oracle.test.js
deployments/            # Generated deployment info and proof files (auto-created)
  {network}-{timestamp}.json
  proof-{network}-{timestamp}.json
  proof-{network}-{timestamp}.md
docs/
  architecture.md
  regulatory-framework.md
  TESTNET_DEPLOYMENT_GUIDE.md  # Detailed testnet deployment guide
hardhat.config.js
package.json
env.example             # Environment template
```

## Setup
Prereqs: Node.js 18+, npm 8+, Git

1) Install dependencies
```
npm install
```

2) Environment (required for testnet/mainnet deployment)
```bash
cp env.example .env
# Edit .env with your actual values:
# - TESTNET_RPC_URL (Infura/Alchemy)
# - PRIVATE_KEY (your wallet private key) 
# - ETHERSCAN_API_KEY (for verification)
```

## Quick Test Run
```
npx hardhat test
```
Windows PowerShell users: commands are the same; no special shell flags needed.

## Common Commands
- Compile: `npm run compile`
- Run all tests: `npm run test:all`
- Single test files:
  - Stablecoin: `npm run test:stablecoin`
  - ReserveManager: `npm run test:reserve`
  - Oracle: `npm run test:oracle`
- Local node: `npm run node`
- Local deploy: `npm run deploy:local`
- **Testnet deploy with proof**: `npm run deploy:testnet:proof` ⭐
- Testnet deploy: `npm run deploy:testnet`
- Mainnet deploy: `npm run deploy:mainnet` (caution)
- Verify contracts: `npm run verify:contracts`
- Generate proof links: `npm run generate:proof`
- Coverage: `npm run coverage`
- Lint: `npm run lint`
- Gas report (PowerShell): `$env:REPORT_GAS=1; npx hardhat test; $env:REPORT_GAS=$null`

## Contracts (Milestone 2)
- Stablecoin.sol
  - ERC-20 with compliance hooks (pause, blacklist)
  - `mint(amount, bondId)` consumes user bond collateral (from `ReserveManager`) using oracle pricing and ratio checks
  - `burn(amount, bondId)` releases collateral back to user
  - `redeem(amount)` burns tokens for gold-equivalent value (settlement off-chain in demo)
  - `proofOfReserves()` returns latest reserves snapshot from `Oracle`
- ReserveManager.sol
  - `depositBond(bondId, amount, lseListingId)` / `withdrawBond(...)`
  - Tracks per-user bond balances and system totals
  - `consumeCollateral`/`releaseCollateral` called by `Stablecoin`
  - `calculateReserveRatio()` returns percentage (gold/bond * 100)
- Oracle.sol
  - Managed data sources (owner-add/remove)
  - Update/get gold price, bond price, and aggregate reserve data
  - `getReserveData()` returns {totalReserves, goldValue, bondValue, timestamp, isValid}

Note: Price/confidence/validity windows are enforced in contract checks. Values are simplified for demo; real feeds will be wired in next milestone.

## Troubleshooting
- If you see "Stack too deep", we enable Solidity via-IR in `hardhat.config.js`.
- Ethers v6 is required by the toolchain. If a test errors on `getAddress`, ensure `ethers` is `^6.x` in `package.json` and reinstall.
- Use Node 18+.

## Testnet Deployment with On-Chain Proof

### Quick Start
1) **Set up environment**:
   ```bash
   cp env.example .env
   # Edit .env with your actual values:
   # - TESTNET_RPC_URL (get from Infura/Alchemy)
   # - PRIVATE_KEY (your wallet private key - 64 chars)
   # - ETHERSCAN_API_KEY (get from Etherscan)
   ```

2) **Deploy with proof generation**:
   ```bash
   npm run deploy:testnet:proof
   ```

3) **Verify contracts** (optional but recommended):
   ```bash
   npm run verify:contracts
   ```

### What You Get
- ✅ Contract addresses on blockchain explorer
- ✅ Deployment transaction hashes
- ✅ Verification commands
- ✅ JSON and Markdown proof files
- ✅ Ready-to-share proof links

### Supported Testnets
- **Sepolia** (recommended) - Chain ID: 11155111
- **Goerli** - Chain ID: 5
- **Mumbai** (Polygon) - Chain ID: 80001
- **BSC Testnet** - Chain ID: 97
- **Arbitrum Sepolia** - Chain ID: 421614

### Getting Testnet ETH
- **Sepolia**: [Sepolia Faucet](https://sepoliafaucet.com/)
- **Goerli**: [Goerli Faucet](https://goerlifaucet.com/)
- **Mumbai**: [Mumbai Faucet](https://faucet.polygon.technology/)
- **BSC Testnet**: [BSC Faucet](https://testnet.bnbchain.org/faucet-smart)

## Demo Flow (Local)
1) Start local chain
```
npx hardhat node
```
2) In another terminal, deploy
```
npm run deploy:local
```
3) Run tests
```
npm test
# or
npm run test:all
```

## Proof of Reserves (PoR) Demo
- Oracle maintains a reserves snapshot via `updateReserveData(totalReserves, goldValue, bondValue)`.
- Stablecoin users (or any observer) can call `proofOfReserves()` to get `(totalReserves, goldValue, timestamp)`.
- In tests, PoR is demonstrated by updating the oracle and asserting values from `Stablecoin.proofOfReserves()`.

## Security & Compliance
- Pause and emergency controls (owner)
- Blacklist/whitelist for basic compliance
- Separate `ReserveManager` to isolate collateral accounting
- NI 43-101 and LSE listing details in `docs/regulatory-framework.md`

## Next (Milestone 3)
- Real oracle feeds (e.g., Chainlink/partners) for gold and LSE bond pricing
- Off-chain settlement integration for redemption workflows
- Role-based access and multisig ownership
- Monitoring/alerting and automated reserve attestations
- External security audit

## Packaging the Demo
- Export `README.md` and `docs/architecture.md` to PDF (print-to-PDF).
- Zip the repo (excluding `node_modules`) for delivery.

## License
MIT
