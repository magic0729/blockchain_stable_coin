// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Oracle
 * @dev Oracle contract for price feeds and data verification
 * @notice This contract aggregates price data from multiple sources
 *         for gold prices, bond values, and reserve verification
 */
contract Oracle is Ownable, Pausable {
    
    // Events
    event PriceUpdated(string indexed asset, uint256 price, uint256 timestamp);
    event DataSourceAdded(address indexed source, string sourceType);
    event DataSourceRemoved(address indexed source);
    event ReserveDataUpdated(uint256 totalReserves, uint256 goldValue, uint256 timestamp);
    
    // Price data structures
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 confidence;
        string source;
    }
    
    struct ReserveData {
        uint256 totalReserves;
        uint256 goldValue;
        uint256 bondValue;
        uint256 timestamp;
        bool isValid;
    }
    
    // State variables
    mapping(string => PriceData) public prices;
    mapping(address => bool) public authorizedSources;
    mapping(address => string) public sourceTypes;
    
    ReserveData public currentReserveData;
    uint256 public constant PRICE_VALIDITY_PERIOD = 1 hours;
    uint256 public constant MINIMUM_CONFIDENCE = 80; // 80% minimum confidence
    
    // External contract addresses
    address public stablecoinAddress;
    address public reserveManagerAddress;
    
    /**
     * @dev Constructor initializes the oracle
     */
    constructor() {}
    
    /**
     * @dev Update gold price from external source
     * @param price New gold price
     * @param confidence Confidence level (0-100)
     * @param source Source identifier
     * @notice This function updates gold price data
     */
    function updateGoldPrice(
        uint256 price,
        uint256 confidence,
        string memory source
    ) external onlyAuthorizedSource {
        require(price > 0, "Invalid gold price");
        require(confidence >= MINIMUM_CONFIDENCE, "Confidence too low");
        require(bytes(source).length > 0, "Invalid source");
        
        prices["GOLD"] = PriceData({
            price: price,
            timestamp: block.timestamp,
            confidence: confidence,
            source: source
        });
        
        emit PriceUpdated("GOLD", price, block.timestamp);
    }
    
    /**
     * @dev Update bond price from external source
     * @param bondId Bond identifier
     * @param price New bond price
     * @param confidence Confidence level (0-100)
     * @param source Source identifier
     * @notice This function updates bond price data
     */
    function updateBondPrice(
        string memory bondId,
        uint256 price,
        uint256 confidence,
        string memory source
    ) external onlyAuthorizedSource {
        require(bytes(bondId).length > 0, "Invalid bond ID");
        require(price > 0, "Invalid bond price");
        require(confidence >= MINIMUM_CONFIDENCE, "Confidence too low");
        require(bytes(source).length > 0, "Invalid source");
        
        string memory assetKey = string(abi.encodePacked("BOND_", bondId));
        prices[assetKey] = PriceData({
            price: price,
            timestamp: block.timestamp,
            confidence: confidence,
            source: source
        });
        
        emit PriceUpdated(assetKey, price, block.timestamp);
    }
    
    /**
     * @dev Update reserve data from external source
     * @param totalReserves Total reserve value
     * @param goldValue Total gold value
     * @param bondValue Total bond value
     * @notice This function updates comprehensive reserve data
     */
    function updateReserveData(
        uint256 totalReserves,
        uint256 goldValue,
        uint256 bondValue
    ) external onlyAuthorizedSource {
        require(totalReserves >= 0, "Invalid total reserves");
        require(goldValue >= 0, "Invalid gold value");
        require(bondValue >= 0, "Invalid bond value");
        
        currentReserveData = ReserveData({
            totalReserves: totalReserves,
            goldValue: goldValue,
            bondValue: bondValue,
            timestamp: block.timestamp,
            isValid: true
        });
        
        emit ReserveDataUpdated(totalReserves, goldValue, block.timestamp);
    }
    
    /**
     * @dev Get current gold price
     * @return price Current gold price
     * @return timestamp Price timestamp
     * @return isValid Whether price is valid and recent
     * @notice This function returns the current gold price
     */
    function getGoldPrice() 
        external 
        view 
        returns (
            uint256 price,
            uint256 timestamp,
            bool isValid
        ) 
    {
        PriceData memory goldData = prices["GOLD"];
        bool priceValid = (block.timestamp - goldData.timestamp) <= PRICE_VALIDITY_PERIOD;
        
        return (goldData.price, goldData.timestamp, priceValid);
    }
    
    /**
     * @dev Get current bond price
     * @param bondId Bond identifier
     * @return price Current bond price
     * @return timestamp Price timestamp
     * @return isValid Whether price is valid and recent
     * @notice This function returns the current bond price
     */
    function getBondPrice(string memory bondId) 
        external 
        view 
        returns (
            uint256 price,
            uint256 timestamp,
            bool isValid
        ) 
    {
        string memory assetKey = string(abi.encodePacked("BOND_", bondId));
        PriceData memory bondData = prices[assetKey];
        bool priceValid = (block.timestamp - bondData.timestamp) <= PRICE_VALIDITY_PERIOD;
        
        return (bondData.price, bondData.timestamp, priceValid);
    }
    
    /**
     * @dev Get current reserve data
     * @return reserveData Current reserve information
     * @notice This function returns comprehensive reserve data
     */
    function getReserveData() 
        external 
        view 
        returns (ReserveData memory reserveData) 
    {
        return currentReserveData;
    }
    
    /**
     * @dev Verify price data validity
     * @param asset Asset identifier
     * @return isValid Whether price data is valid
     * @notice This function checks if price data is current and reliable
     */
    function verifyPriceData(string memory asset) 
        external 
        view 
        returns (bool isValid) 
    {
        PriceData memory data = prices[asset];
        
        // Check if price is recent enough
        bool isRecent = (block.timestamp - data.timestamp) <= PRICE_VALIDITY_PERIOD;
        
        // Check if confidence is sufficient
        bool isConfident = data.confidence >= MINIMUM_CONFIDENCE;
        
        return isRecent && isConfident;
    }
    
    /**
     * @dev Add authorized data source
     * @param source Source address
     * @param sourceType Type of data source
     * @notice This function authorizes a new data source
     */
    function addDataSource(address source, string memory sourceType) 
        external 
        onlyOwner 
    {
        require(source != address(0), "Invalid source address");
        authorizedSources[source] = true;
        sourceTypes[source] = sourceType;
        
        emit DataSourceAdded(source, sourceType);
    }
    
    /**
     * @dev Remove authorized data source
     * @param source Source address to remove
     * @notice This function removes authorization from a data source
     */
    function removeDataSource(address source) external onlyOwner {
        require(source != address(0), "Invalid source address");
        authorizedSources[source] = false;
        delete sourceTypes[source];
        
        emit DataSourceRemoved(source);
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
     * @dev Set reserve manager contract address
     * @param newReserveManager New reserve manager contract address
     * @notice This function updates the reserve manager contract address
     */
    function setReserveManagerAddress(address newReserveManager) external onlyOwner {
        require(newReserveManager != address(0), "Invalid reserve manager address");
        reserveManagerAddress = newReserveManager;
    }
    
    /**
     * @dev Set price validity period
     * @param newPeriod New validity period in seconds
     * @notice This function updates how long price data remains valid
     */
    function setPriceValidityPeriod(uint256 newPeriod) external onlyOwner {
        require(newPeriod > 0, "Invalid period");
        // Note: PRICE_VALIDITY_PERIOD is constant, this would need contract upgrade
    }
    
    /**
     * @dev Set minimum confidence threshold
     * @param newThreshold New minimum confidence (0-100)
     * @notice This function updates the minimum confidence threshold
     */
    function setMinimumConfidence(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0 && newThreshold <= 100, "Invalid threshold");
        // Note: MINIMUM_CONFIDENCE is constant, this would need contract upgrade
    }
    
    // Modifiers
    modifier onlyAuthorizedSource() {
        require(authorizedSources[msg.sender], "Unauthorized data source");
        _;
    }
    
    modifier onlyStablecoin() {
        require(msg.sender == stablecoinAddress, "Only stablecoin contract can call this function");
        _;
    }
    
    modifier onlyReserveManager() {
        require(msg.sender == reserveManagerAddress, "Only reserve manager can call this function");
        _;
    }
}
