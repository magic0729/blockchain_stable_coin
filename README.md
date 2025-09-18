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
  deploy-testnet.js     # Testnet deploy (with confirmations)
  deploy-mainnet.js     # Mainnet deploy (caution)
  test-all.js           # Convenience runner for tests/coverage
test/
  Stablecoin.test.js
  ReserveManager.test.js
  Oracle.test.js
docs/
  architecture.md
  regulatory-framework.md
hardhat.config.js
package.json
```

## Setup
Prereqs: Node.js 18+, npm 8+, Git

1) Install dependencies
```
npm install
```

2) Environment (optional for deploy/testnet/mainnet)
Create `env.example` → `.env` and fill RPCs and keys.

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
- Testnet deploy: `npm run deploy:testnet`
- Mainnet deploy: `npm run deploy:mainnet` (caution)
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
