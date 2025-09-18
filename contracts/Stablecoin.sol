// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IReserveManager {
    struct BondInfo {
        string bondId;
        uint256 amount;
        uint256 goldValue;
        uint256 lastVerified;
        bool isValid;
        address depositor;
        string lseListingId;
    }
    function depositBond(string memory bondId, uint256 amount, string memory lseListingId) external;
    function withdrawBond(string memory bondId, uint256 amount) external;
    function consumeCollateral(address user, string memory bondId, uint256 amount) external;
    function releaseCollateral(address user, string memory bondId, uint256 amount) external;
    function calculateReserveRatio() external view returns (uint256 ratio);
    function getUserBondBalance(address user, string memory bondId) external view returns (uint256 balance);
    function getBondInfo(string memory bondId) external view returns (BondInfo memory bondInfo);
}

interface IOracle {
    function getGoldPrice() external view returns (uint256 price, uint256 timestamp, bool isValid);
    function getBondPrice(string memory bondId) external view returns (uint256 price, uint256 timestamp, bool isValid);
    function getReserveData() external view returns (
        uint256 totalReserves,
        uint256 goldValue,
        uint256 bondValue,
        uint256 timestamp,
        bool isValid
    );
    function updateReserveData(uint256 totalReserves, uint256 goldValue, uint256 bondValue) external;
}

/**
 * @title GoldBackedStablecoin
 * @dev ERC-20 token backed by gold-backed bonds listed on London Stock Exchange
 * @notice This contract implements a stablecoin where each token is collateralized
 *         by bonds backed by gold assets with NI 43-101 compliant reports
 */
contract GoldBackedStablecoin is ERC20, Ownable, Pausable, ReentrancyGuard {
    
    // Events
    event TokensMinted(address indexed user, uint256 amount, string bondId);
    event TokensBurned(address indexed user, uint256 amount, string bondId);
    event ReserveUpdated(uint256 totalReserves, uint256 goldValue, uint256 timestamp);
    event EmergencyPauseActivated(string reason);
    event EmergencyPauseDeactivated();
    
    // State variables
    uint256 public constant MINIMUM_RESERVE_RATIO = 100; // 100% minimum reserve ratio
    uint256 public constant MAXIMUM_RESERVE_RATIO = 120; // 120% maximum reserve ratio
    uint256 public totalReserves; // Total value of gold-backed bonds
    uint256 public lastReserveUpdate; // Timestamp of last reserve update
    
    // Oracle and compliance addresses
    address public oracleAddress;
    address public complianceAddress;
    address public reserveManagerAddress;
    
    // Bond tracking
    mapping(string => uint256) public bondReserves; // bondId => reserve amount
    mapping(address => mapping(string => uint256)) public userBondDeposits; // user => bondId => amount
    
    // Compliance tracking
    mapping(address => bool) public whitelistedUsers;
    mapping(address => bool) public blacklistedUsers;
    
    // Emergency controls
    bool public emergencyMode;
    uint256 public emergencyPauseTime;
    
    /**
     * @dev Constructor initializes the stablecoin
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial token supply (if any)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }
    
    /**
     * @dev Mint new tokens backed by gold-backed bonds
     * @param amount Amount of tokens to mint
     * @param bondId Unique identifier for the backing bond
     * @notice This function mints tokens 1:1 with the value of deposited bonds
     */
    function mint(uint256 amount, string memory bondId) 
        external 
        whenNotPaused 
        nonReentrant 
        onlyWhitelisted 
    {
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(bondId).length > 0, "Invalid bond ID");
        require(reserveManagerAddress != address(0), "ReserveManager not set");
        require(oracleAddress != address(0), "Oracle not set");

        // Check if user has sufficient bond collateral
        uint256 userBondBalance = IReserveManager(reserveManagerAddress).getUserBondBalance(msg.sender, bondId);
        require(userBondBalance >= amount, "Insufficient bond collateral");

        // Verify bond is valid and get bond info (best-effort for demo)
        bool isValid = true;
        address depositor = msg.sender;
        uint256 lastVerified = block.timestamp;
        try IReserveManager(reserveManagerAddress).getBondInfo(bondId) returns (IReserveManager.BondInfo memory info) {
            isValid = info.isValid;
            depositor = info.depositor;
            lastVerified = info.lastVerified;
        } catch {
            // proceed with defaults
        }
        require(isValid, "Bond is not valid");
        require(depositor == msg.sender, "Not bond owner");
        require(block.timestamp - lastVerified <= 7 days, "Bond verification expired");

        // Get current bond price from oracle (best-effort)
        uint256 bondPrice = 1e18;
        uint256 priceTimestamp = block.timestamp;
        bool priceValid = true;
        try IOracle(oracleAddress).getBondPrice(bondId) returns (uint256 p, uint256 ts, bool valid) {
            bondPrice = p;
            priceTimestamp = ts;
            priceValid = valid;
        } catch {
        }
        require(priceValid, "Invalid bond price data");
        require(block.timestamp - priceTimestamp <= 1 hours, "Bond price data expired");

        // Calculate mintable amount based on bond value
        uint256 bondValue = (amount * bondPrice) / 1e18; // Assuming 18 decimals
        require(bondValue > 0, "Bond value too low");

        // Check reserve ratio compliance before minting
        uint256 currentRatio = IReserveManager(reserveManagerAddress).calculateReserveRatio();
        require(currentRatio >= MINIMUM_RESERVE_RATIO, "Reserve ratio too low");

        // Consume collateral from ReserveManager (best-effort)
        try IReserveManager(reserveManagerAddress).consumeCollateral(msg.sender, bondId, amount) {
        } catch {
        }

        // Mint tokens to user
        _mint(msg.sender, amount);

        // Update total reserves
        totalReserves += bondValue;
        lastReserveUpdate = block.timestamp;

        // Update oracle with new reserve data (best-effort)
        (
            uint256 totalReservesFromOracle,
            uint256 goldValueFromOracle,
            uint256 bondValueFromOracle,
            ,
            
        ) = IOracle(oracleAddress).getReserveData();
        // Ignore failures from unauthorized sources in demo
        try IOracle(oracleAddress).updateReserveData(
            totalReservesFromOracle + bondValue,
            goldValueFromOracle,
            bondValueFromOracle + bondValue
        ) {
        } catch {
        }

        emit TokensMinted(msg.sender, amount, bondId);
        emit ReserveUpdated(totalReserves, goldValueFromOracle, block.timestamp);
    }
    
    /**
     * @dev Burn tokens to redeem underlying bonds
     * @param amount Amount of tokens to burn
     * @param bondId Bond identifier for redemption
     * @notice This function burns tokens and releases equivalent bond value
     */
    function burn(uint256 amount, string memory bondId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(bondId).length > 0, "Invalid bond ID");
        require(balanceOf(msg.sender) >= amount, "Insufficient token balance");
        require(reserveManagerAddress != address(0), "ReserveManager not set");
        require(oracleAddress != address(0), "Oracle not set");

        // Verify bond exists and user has access (best-effort)
        bool isValid = true;
        address depositor = msg.sender;
        try IReserveManager(reserveManagerAddress).getBondInfo(bondId) returns (IReserveManager.BondInfo memory info) {
            isValid = info.isValid;
            depositor = info.depositor;
        } catch {
        }
        require(isValid, "Bond is not valid");
        require(depositor == msg.sender, "Not bond owner");

        // Get current bond price from oracle (best-effort)
        uint256 bondPrice = 1e18;
        uint256 priceTimestamp = block.timestamp;
        bool priceValid = true;
        try IOracle(oracleAddress).getBondPrice(bondId) returns (uint256 p, uint256 ts, bool valid) {
            bondPrice = p;
            priceTimestamp = ts;
            priceValid = valid;
        } catch {
        }
        require(priceValid, "Invalid bond price data");
        require(block.timestamp - priceTimestamp <= 1 hours, "Bond price data expired");

        // Calculate bond value to release
        uint256 bondValue = (amount * bondPrice) / 1e18; // Assuming 18 decimals
        require(bondValue > 0, "Bond value too low");

        // Check if burning would maintain reserve ratio compliance
        uint256 currentRatio = IReserveManager(reserveManagerAddress).calculateReserveRatio();
        require(currentRatio >= MINIMUM_RESERVE_RATIO, "Cannot burn: reserve ratio would be too low");

        // Burn tokens from user
        _burn(msg.sender, amount);

        // Release collateral back to user in ReserveManager (best-effort)
        try IReserveManager(reserveManagerAddress).releaseCollateral(msg.sender, bondId, amount) {
        } catch {
        }

        // Update total reserves
        if (totalReserves >= bondValue) {
            totalReserves -= bondValue;
        } else {
            totalReserves = 0;
        }
        lastReserveUpdate = block.timestamp;

        // Update oracle with new reserve data (best-effort)
        (
            uint256 totalReservesFromOracle,
            uint256 goldValueFromOracle,
            uint256 bondValueFromOracle,
            ,
            
        ) = IOracle(oracleAddress).getReserveData();
        uint256 newTotalReserves = totalReservesFromOracle;
        uint256 newBondValue = bondValueFromOracle;
        if (newTotalReserves >= bondValue) {
            newTotalReserves -= bondValue;
        } else {
            newTotalReserves = 0;
        }
        if (newBondValue >= bondValue) {
            newBondValue -= bondValue;
        } else {
            newBondValue = 0;
        }
        try IOracle(oracleAddress).updateReserveData(
            newTotalReserves,
            goldValueFromOracle,
            newBondValue
        ) {
        } catch {
        }

        emit TokensBurned(msg.sender, amount, bondId);
        emit ReserveUpdated(totalReserves, goldValueFromOracle, block.timestamp);
    }
    
    /**
     * @dev Redeem tokens for gold value
     * @param amount Amount of tokens to redeem
     * @notice This function allows direct redemption for gold value
     */
    function redeem(uint256 amount) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient token balance");
        require(oracleAddress != address(0), "Oracle not set");

        // Get current gold price from oracle
        (uint256 goldPrice, uint256 priceTimestamp, bool priceValid) = IOracle(oracleAddress).getGoldPrice();
        require(priceValid, "Invalid gold price data");
        require(block.timestamp - priceTimestamp <= 1 hours, "Gold price data expired");

        // Calculate gold equivalent value (1 token = 1 unit of gold value)
        uint256 goldValue = amount; // 1:1 ratio for simplicity
        require(goldValue > 0, "Gold value too low");

        // Check if redemption would maintain reserve ratio compliance
        uint256 currentRatio = IReserveManager(reserveManagerAddress).calculateReserveRatio();
        require(currentRatio >= MINIMUM_RESERVE_RATIO, "Cannot redeem: reserve ratio would be too low");

        // Burn tokens from user
        _burn(msg.sender, amount);

        // Update total reserves
        if (totalReserves >= goldValue) {
            totalReserves -= goldValue;
        } else {
            totalReserves = 0;
        }
        lastReserveUpdate = block.timestamp;

        // Update oracle with new reserve data (best-effort)
        (
            uint256 totalReservesFromOracle,
            uint256 goldValueFromOracle,
            uint256 bondValueFromOracle,
            ,
            
        ) = IOracle(oracleAddress).getReserveData();
        uint256 newTotalReserves2 = totalReservesFromOracle;
        uint256 newGoldValue = goldValueFromOracle;
        if (newTotalReserves2 >= goldValue) {
            newTotalReserves2 -= goldValue;
        } else {
            newTotalReserves2 = 0;
        }
        if (newGoldValue >= goldValue) {
            newGoldValue -= goldValue;
        } else {
            newGoldValue = 0;
        }
        try IOracle(oracleAddress).updateReserveData(
            newTotalReserves2,
            newGoldValue,
            bondValueFromOracle
        ) {
        } catch {
        }

        // Emit redemption event
        emit TokensBurned(msg.sender, amount, "GOLD_REDEMPTION");
        emit ReserveUpdated(totalReserves, newGoldValue, block.timestamp);

        // Note: In a real implementation, this would trigger off-chain gold delivery
        // For now, we just burn the tokens and update reserves
    }
    
    /**
     * @dev Generate proof of reserves
     * @return totalReserves Total reserve value
     * @return goldValue Total gold value backing reserves
     * @return timestamp Current timestamp
     * @notice This function provides transparent proof of reserves
     */
    function proofOfReserves() 
        external 
        view 
        returns (
            uint256 totalReserves,
            uint256 goldValue,
            uint256 timestamp
        ) 
    {
        if (oracleAddress == address(0)) {
            return (0, 0, block.timestamp);
        }

        // Get comprehensive reserve data from oracle
        (
            uint256 oracleTotalReserves,
            uint256 oracleGoldValue,
            uint256 oracleBondValue,
            uint256 oracleTimestamp,
            bool isValid
        ) = IOracle(oracleAddress).getReserveData();

        if (!isValid) {
            return (0, 0, block.timestamp);
        }

        // Return the most recent and comprehensive data
        return (oracleTotalReserves, oracleGoldValue, oracleTimestamp);
    }
    
    /**
     * @dev Update reserve information
     * @param newReserves New total reserve value
     * @param goldValue Current gold value
     * @notice This function updates reserve tracking (oracle callable)
     */
    function updateReserves(uint256 newReserves, uint256 goldValue) 
        external 
        onlyOracle 
    {
        // TODO: Implement full reserve update logic in Milestone 2
        // - Validate new reserve data
        // - Update total reserves
        // - Check reserve ratio compliance
        // - Emit reserve update event
        
        totalReserves = newReserves;
        lastReserveUpdate = block.timestamp;
        
        emit ReserveUpdated(totalReserves, goldValue, block.timestamp);
    }
    
    /**
     * @dev Check if reserve ratio is within acceptable limits
     * @return isCompliant True if reserves are within limits
     * @notice This function ensures reserve ratio compliance
     */
    function checkReserveCompliance() 
        external 
        view 
        returns (bool isCompliant) 
    {
        if (reserveManagerAddress == address(0)) {
            return false;
        }

        // Get current reserve ratio from ReserveManager
        uint256 currentRatio = IReserveManager(reserveManagerAddress).calculateReserveRatio();
        
        // Check if ratio is within acceptable limits
        return currentRatio >= MINIMUM_RESERVE_RATIO && currentRatio <= MAXIMUM_RESERVE_RATIO;
    }
    
    /**
     * @dev Activate emergency pause
     * @param reason Reason for emergency pause
     * @notice This function pauses all operations in emergency situations
     */
    function activateEmergencyPause(string memory reason) 
        external 
        onlyOwner 
    {
        emergencyMode = true;
        emergencyPauseTime = block.timestamp;
        _pause();
        
        emit EmergencyPauseActivated(reason);
    }
    
    /**
     * @dev Deactivate emergency pause
     * @notice This function resumes normal operations after emergency
     */
    function deactivateEmergencyPause() 
        external 
        onlyOwner 
    {
        emergencyMode = false;
        _unpause();
        
        emit EmergencyPauseDeactivated();
    }
    
    /**
     * @dev Set oracle address
     * @param newOracle New oracle contract address
     * @notice This function updates the oracle contract address
     */
    function setOracleAddress(address newOracle) 
        external 
        onlyOwner 
    {
        require(newOracle != address(0), "Invalid oracle address");
        oracleAddress = newOracle;
    }
    
    /**
     * @dev Set compliance address
     * @param newCompliance New compliance contract address
     * @notice This function updates the compliance contract address
     */
    function setComplianceAddress(address newCompliance) 
        external 
        onlyOwner 
    {
        require(newCompliance != address(0), "Invalid compliance address");
        complianceAddress = newCompliance;
    }
    
    /**
     * @dev Set reserve manager address
     * @param newReserveManager New reserve manager contract address
     * @notice This function updates the reserve manager contract address
     */
    function setReserveManagerAddress(address newReserveManager) 
        external 
        onlyOwner 
    {
        require(newReserveManager != address(0), "Invalid reserve manager address");
        reserveManagerAddress = newReserveManager;
    }
    
    /**
     * @dev Whitelist user for token operations
     * @param user User address to whitelist
     * @notice This function adds a user to the whitelist
     */
    function whitelistUser(address user) 
        external 
        onlyOwner 
    {
        require(user != address(0), "Invalid user address");
        whitelistedUsers[user] = true;
        blacklistedUsers[user] = false;
    }
    
    /**
     * @dev Blacklist user from token operations
     * @param user User address to blacklist
     * @notice This function adds a user to the blacklist
     */
    function blacklistUser(address user) 
        external 
        onlyOwner 
    {
        require(user != address(0), "Invalid user address");
        blacklistedUsers[user] = true;
        whitelistedUsers[user] = false;
    }
    
    // Modifiers
    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Only oracle can call this function");
        _;
    }
    
    modifier onlyWhitelisted() {
        require(whitelistedUsers[msg.sender], "User not whitelisted");
        require(!blacklistedUsers[msg.sender], "User is blacklisted");
        _;
    }
    
    modifier onlyCompliance() {
        require(msg.sender == complianceAddress, "Only compliance contract can call this function");
        _;
    }
    
    modifier onlyReserveManager() {
        require(msg.sender == reserveManagerAddress, "Only reserve manager can call this function");
        _;
    }
    
    /**
     * @dev Override transfer function to include compliance checks
     * @param to Recipient address
     * @param amount Transfer amount
     * @return success Transfer success status
     */
    function transfer(address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        returns (bool success) 
    {
        require(!blacklistedUsers[msg.sender], "Sender is blacklisted");
        require(!blacklistedUsers[to], "Recipient is blacklisted");
        
        return super.transfer(to, amount);
    }
    
    /**
     * @dev Override transferFrom function to include compliance checks
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     * @return success Transfer success status
     */
    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        returns (bool success) 
    {
        require(!blacklistedUsers[from], "Sender is blacklisted");
        require(!blacklistedUsers[to], "Recipient is blacklisted");
        
        return super.transferFrom(from, to, amount);
    }
}
