// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ReserveManager
 * @dev Manages gold-backed bond reserves and collateral tracking
 * @notice This contract handles the verification and management of bonds
 *         backing the stablecoin, ensuring proper collateralization
 */
contract ReserveManager is Ownable, Pausable, ReentrancyGuard {
    
    // Events
    event BondDeposited(string indexed bondId, uint256 amount, address indexed depositor);
    event BondWithdrawn(string indexed bondId, uint256 amount, address indexed withdrawer);
    event ReserveVerified(string indexed bondId, bool isValid, uint256 value);
    event ReserveRatioUpdated(uint256 newRatio, uint256 timestamp);
    
    // State variables
    uint256 public constant MINIMUM_RESERVE_RATIO = 100; // 100%
    uint256 public constant MAXIMUM_RESERVE_RATIO = 120; // 120%
    
    // Bond tracking
    struct BondInfo {
        string bondId;
        uint256 amount;
        uint256 goldValue;
        uint256 lastVerified;
        bool isValid;
        address depositor;
        string lseListingId;
    }
    
    mapping(string => BondInfo) public bonds;
    mapping(address => string[]) public userBonds;
    mapping(address => mapping(string => uint256)) public userBondBalances;
    uint256 public totalBondValue;
    uint256 public totalGoldValue;
    
    // External contract addresses
    address public stablecoinAddress;
    address public oracleAddress;
    address public complianceAddress;
    
    // Verification settings
    uint256 public verificationInterval = 24 hours;
    mapping(string => bool) public verifiedBonds;
    
    /**
     * @dev Constructor initializes the reserve manager
     */
    constructor() {}
    
    /**
     * @dev Deposit a gold-backed bond as collateral
     * @param bondId Unique bond identifier
     * @param amount Bond amount
     * @param lseListingId LSE listing identifier
     * @notice This function accepts bonds for collateralization
     */
    function depositBond(
        string memory bondId,
        uint256 amount,
        string memory lseListingId
    ) external whenNotPaused nonReentrant {
        require(bytes(bondId).length > 0, "Invalid bond ID");
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(lseListingId).length > 0, "Invalid LSE listing ID");

        // Check if bond already exists
        BondInfo storage bondInfo = bonds[bondId];
        if (bondInfo.lastVerified == 0) {
            // New bond - initialize
            bondInfo.bondId = bondId;
            bondInfo.lseListingId = lseListingId;
            bondInfo.depositor = msg.sender;
            bondInfo.isValid = true; // Simplified for demo - in production, verify with LSE
            bondInfo.lastVerified = block.timestamp;
        } else {
            // Existing bond - verify ownership
            require(bondInfo.depositor == msg.sender, "Not bond owner");
            require(bondInfo.isValid, "Bond is not valid");
        }

        // Update bond amount
        bondInfo.amount += amount;

        // Update user tracking
        if (userBondBalances[msg.sender][bondId] == 0) {
            userBonds[msg.sender].push(bondId);
        }
        userBondBalances[msg.sender][bondId] += amount;

        // Update total values (simplified - in production, get from oracle)
        totalBondValue += amount;
        totalGoldValue += amount; // Assuming 1:1 gold backing

        emit BondDeposited(bondId, amount, msg.sender);
    }
    
    /**
     * @dev Withdraw a gold-backed bond
     * @param bondId Bond identifier to withdraw
     * @param amount Amount to withdraw
     * @notice This function releases bonds back to the depositor
     */
    function withdrawBond(
        string memory bondId,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        require(bytes(bondId).length > 0, "Invalid bond ID");
        require(amount > 0, "Amount must be greater than 0");
        require(userBondBalances[msg.sender][bondId] >= amount, "Insufficient bond balance");

        // Verify bond ownership and validity
        BondInfo storage bondInfo = bonds[bondId];
        require(bondInfo.depositor == msg.sender, "Not bond owner");
        require(bondInfo.isValid, "Bond is not valid");
        require(bondInfo.amount >= amount, "Insufficient bond amount");

        // Check if withdrawal would maintain reserve ratio compliance
        uint256 currentRatio = calculateReserveRatio();
        require(currentRatio >= MINIMUM_RESERVE_RATIO, "Withdrawal would violate reserve ratio");

        // Update user balance
        userBondBalances[msg.sender][bondId] -= amount;
        if (userBondBalances[msg.sender][bondId] == 0) {
            // Remove bond from user's list if balance is zero
            for (uint256 i = 0; i < userBonds[msg.sender].length; i++) {
                if (keccak256(bytes(userBonds[msg.sender][i])) == keccak256(bytes(bondId))) {
                    userBonds[msg.sender][i] = userBonds[msg.sender][userBonds[msg.sender].length - 1];
                    userBonds[msg.sender].pop();
                    break;
                }
            }
        }

        // Update bond amount
        bondInfo.amount -= amount;

        // Update total values
        if (totalBondValue >= amount) {
            totalBondValue -= amount;
        } else {
            totalBondValue = 0;
        }
        if (totalGoldValue >= amount) {
            totalGoldValue -= amount;
        } else {
            totalGoldValue = 0;
        }

        emit BondWithdrawn(bondId, amount, msg.sender);
    }
    
    /**
     * @dev Verify bond authenticity and value
     * @param bondId Bond identifier to verify
     * @notice This function verifies bond authenticity with external sources
     */
    function verifyBond(string memory bondId) external {
        // TODO: Implement full bond verification in Milestone 2
        // - Query LSE for bond information
        // - Verify NI 43-101 compliance
        // - Validate gold backing
        // - Update bond status
        
        emit ReserveVerified(bondId, true, 0); // Placeholder
    }
    
    /**
     * @dev Calculate total reserve ratio
     * @return ratio Current reserve ratio percentage
     * @notice This function calculates the current reserve ratio
     */
    function calculateReserveRatio() public view returns (uint256 ratio) {
        if (totalBondValue == 0) {
            return 0;
        }
        
        // Calculate ratio as (total gold value / total bond value) * 100
        // Assuming 1:1 gold backing for simplicity
        return (totalGoldValue * 100) / totalBondValue;
    }
    
    /**
     * @dev Get bond information
     * @param bondId Bond identifier
     * @return bondInfo Complete bond information
     * @notice This function returns detailed bond information
     */
    function getBondInfo(string memory bondId) 
        external 
        view 
        returns (BondInfo memory bondInfo) 
    {
        return bonds[bondId];
    }
    
    /**
     * @dev Get user's bonds
     * @param user User address
     * @return bondIds Array of user's bond IDs
     * @notice This function returns all bonds deposited by a user
     */
    function getUserBonds(address user) 
        external 
        view 
        returns (string[] memory bondIds) 
    {
        return userBonds[user];
    }
    
    /**
     * @dev Update bond value from oracle
     * @param bondId Bond identifier
     * @param newValue New bond value
     * @notice This function updates bond values from oracle feeds
     */
    function updateBondValue(string memory bondId, uint256 newValue) 
        external 
        onlyOracle 
    {
        require(bytes(bondId).length > 0, "Invalid bond ID");
        require(newValue > 0, "Invalid bond value");
        
        BondInfo storage bondInfo = bonds[bondId];
        require(bondInfo.lastVerified != 0, "Unknown bond");
        
        // Update bond gold value
        bondInfo.goldValue = newValue;
        bondInfo.lastVerified = block.timestamp;
    }

    /**
     * @dev Get user's bond balance
     * @param user User address
     * @param bondId Bond identifier
     * @return balance User's bond balance
     * @notice This function returns a user's balance for a specific bond
     */
    function getUserBondBalance(address user, string memory bondId) 
        external 
        view 
        returns (uint256 balance) 
    {
        return userBondBalances[user][bondId];
    }

    /**
     * @dev Consume user collateral for minting (called by Stablecoin)
     * @param user User address
     * @param bondId Bond identifier
     * @param amount Amount to consume
     * @notice This function is called by the stablecoin contract when minting tokens
     */
    function consumeCollateral(address user, string memory bondId, uint256 amount) 
        external 
        onlyStablecoin 
    {
        require(user != address(0), "Invalid user");
        require(bytes(bondId).length > 0, "Invalid bond ID");
        require(amount > 0, "Amount must be greater than 0");
        require(userBondBalances[user][bondId] >= amount, "Insufficient collateral");

        // Reduce user's bond balance
        userBondBalances[user][bondId] -= amount;
        
        // Update total values to maintain 1:1 ratio
        if (totalBondValue >= amount) {
            totalBondValue -= amount;
        } else {
            totalBondValue = 0;
        }
        if (totalGoldValue >= amount) {
            totalGoldValue -= amount;
        } else {
            totalGoldValue = 0;
        }
    }

    /**
     * @dev Release user collateral after burning (called by Stablecoin)
     * @param user User address
     * @param bondId Bond identifier
     * @param amount Amount to release
     * @notice This function is called by the stablecoin contract when burning tokens
     */
    function releaseCollateral(address user, string memory bondId, uint256 amount) 
        external 
        onlyStablecoin 
    {
        require(user != address(0), "Invalid user");
        require(bytes(bondId).length > 0, "Invalid bond ID");
        require(amount > 0, "Amount must be greater than 0");

        // Increase user's bond balance
        userBondBalances[user][bondId] += amount;
        
        // Update total values to maintain 1:1 ratio
        totalBondValue += amount;
        totalGoldValue += amount;
    }
    
    /**
     * @dev Set stablecoin contract address
     * @param newStablecoin New stablecoin contract address
     * @notice This function updates the stablecoin contract address
     */
    function setStablecoinAddress(address newStablecoin) external onlyOwner {
        require(newStablecoin != address(0), "Invalid stablecoin address");
        stablecoinAddress = newStablecoin;
    }
    
    /**
     * @dev Set oracle contract address
     * @param newOracle New oracle contract address
     * @notice This function updates the oracle contract address
     */
    function setOracleAddress(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        oracleAddress = newOracle;
    }
    
    /**
     * @dev Set compliance contract address
     * @param newCompliance New compliance contract address
     * @notice This function updates the compliance contract address
     */
    function setComplianceAddress(address newCompliance) external onlyOwner {
        require(newCompliance != address(0), "Invalid compliance address");
        complianceAddress = newCompliance;
    }
    
    /**
     * @dev Set verification interval
     * @param newInterval New verification interval in seconds
     * @notice This function updates how often bonds are verified
     */
    function setVerificationInterval(uint256 newInterval) external onlyOwner {
        require(newInterval > 0, "Invalid interval");
        verificationInterval = newInterval;
    }
    
    // Modifiers
    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Only oracle can call this function");
        _;
    }
    
    modifier onlyStablecoin() {
        require(msg.sender == stablecoinAddress, "Only stablecoin contract can call this function");
        _;
    }
    
    modifier onlyCompliance() {
        require(msg.sender == complianceAddress, "Only compliance contract can call this function");
        _;
    }
}
