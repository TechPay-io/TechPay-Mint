pragma solidity ^0.5.0;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../interfaces/ITechPayMintBalanceGuard.sol";
import "../interfaces/ITechPayDeFiTokenStorage.sol";
import "../interfaces/ITechPayMintTokenRegistry.sol";
import "../interfaces/ITechPayMintRewardManager.sol";
import "../interfaces/IPriceOracleProxy.sol";
import "../interfaces/IERC20Detailed.sol";
import "../interfaces/ITechPayMintAddressProvider.sol";

/**
* This provides addresses to deployed Mint modules
* and related contracts cooperating on the Mint protocol.
* It's used to connects different modules to make the whole
* Mint protocol live and work.
*
* version 0.1.0
* license MIT
* author TechPay
*/
contract TechPayMintAddressProvider is Initializable, Ownable, ITechPayMintAddressProvider {

    // ----------------------------------------------
    // Module identifiers used by the address storage
    // ----------------------------------------------
    //
    bytes32 private constant MOD_LIQUIDATION_MANAGER = "liquidation_manager";
    bytes32 private constant MOD_TECHPAY_MINT = "techpay_mint";
    bytes32 private constant MOD_COLLATERAL_POOL = "collateral_pool";
    bytes32 private constant MOD_DEBT_POOL = "debt_pool";
    bytes32 private constant MOD_PRICE_ORACLE = "price_oracle_proxy";
    bytes32 private constant MOD_REWARD_DISTRIBUTION = "reward_distribution";
    bytes32 private constant MOD_TOKEN_REGISTRY = "token_registry";
    bytes32 private constant MOD_ERC20_REWARD_TOKEN = "erc20_reward_token";

    // -----------------------------------------
    // Address storage state and events
    // -----------------------------------------

    // _addressPool stores addresses to the different modules
    // identified their common names.
    mapping(bytes32 => address) private _addressPool;


    // LiquidationManager event is emitted when
    // a new liquidation address is set.
    event LiquidationManagerChanged(address newAddress);

    // MinterChanged even is emitted when
    // a new Mint Minter address is set.
    event MinterChanged(address newAddress);

    // PriceOracleChanged even is emitted when
    // a new Price Oracle address is set.
    event PriceOracleChanged(address newAddress);

    // RewardDistributionChanged even is emitted when
    // a new Reward Distribution address is set.
    event RewardDistributionChanged(address newAddress);

    // RewardTokenChanged even is emitted when
    // a new reward ERC20 token address is set.
    event RewardTokenChanged(address newAddress);

    // TokenRegistryChanged even is emitted when
    // a new Token Registry address is set.
    event TokenRegistryChanged(address newAddress);

    // CollateralPoolChanged even is emitted when
    // a new Collateral Pool address is set.
    event CollateralPoolChanged(address newAddress);

    // DebtPoolChanged even is emitted when
    // a new Debt Pool address is set.
    event DebtPoolChanged(address newAddress);

    // initialize initializes the instance of the module.
    function initialize(address owner) public initializer {
        Ownable.initialize(owner);
    }

    // --------------------------------------------
    // General address storage management functions
    // --------------------------------------------

    /**
    * getAddress returns the address associated with the given
    * module identifier. If the identifier is not recognized,
    * the function returns zero address instead.
    *
    * @param _id The common name of the module contract.
    * @return The address of the deployed module.
    */
    function getAddress(bytes32 _id) public view returns (address) {
        return _addressPool[_id];
    }

    /**
    * setAddress modifies the active address of the given module,
    * identified by it's common name, to the new address.
    *
    * @param _id The common name of the module contract.
    * @param _addr The new address to be used for the module.
    * @return {void}
    */
    function setAddress(bytes32 _id, address _addr) internal {
        _addressPool[_id] = _addr;
    }

    // -----------------------------------------
    // Module specific getters and setters below
    // -----------------------------------------

    /**
     * getPriceOracleProxy returns the address of the Price Oracle
     * aggregate contract used for the fLend DeFi functions.
     */
    function getPriceOracleProxy() public view returns (IPriceOracleProxy) {
        return IPriceOracleProxy(getAddress(MOD_PRICE_ORACLE));
    }

    /**
     * setPriceOracleProxy modifies the current current active price oracle aggregate
     * to the address specified.
     */
    function setPriceOracleProxy(address _addr) public onlyOwner {
        // make the change
        setAddress(MOD_PRICE_ORACLE, _addr);

        // inform listeners and seekers about the change
        emit PriceOracleChanged(_addr);
    }

    /**
     * getTokenRegistry returns the address of the token registry contract.
     */
    function getTokenRegistry() public view returns (ITechPayMintTokenRegistry) {
        return ITechPayMintTokenRegistry(getAddress(MOD_TOKEN_REGISTRY));
    }

    /**
     * setTokenRegistry modifies the address of the token registry contract.
     */
    function setTokenRegistry(address _addr) public onlyOwner {
        // make the change
        setAddress(MOD_TOKEN_REGISTRY, _addr);

        // inform listeners and seekers about the change
        emit TokenRegistryChanged(_addr);
    }

    /**
     * getRewardDistribution returns the address
     * of the reward distribution contract.
     */
    function getRewardDistribution() public view returns (ITechPayMintRewardManager) {
        return ITechPayMintRewardManager(getAddress(MOD_REWARD_DISTRIBUTION));
    }

    /**
     * setRewardDistribution modifies the address
     * of the reward distribution contract.
     */
    function setRewardDistribution(address _addr) public onlyOwner {
        // make the change
        setAddress(MOD_REWARD_DISTRIBUTION, _addr);

        // inform listeners and seekers about the change
        emit RewardDistributionChanged(_addr);
    }

    /**
     * getRewardPool returns the address of the reward pool contract.
     */
    function getRewardToken() public view returns (ERC20) {
        return ERC20(getAddress(MOD_ERC20_REWARD_TOKEN));
    }

    /**
     * setRewardPool modifies the address of the reward pool contract.
     */
    function setRewardToken(address _addr) public onlyOwner {
        // make the change
        setAddress(MOD_ERC20_REWARD_TOKEN, _addr);

        // inform listeners and seekers about the change
        emit RewardTokenChanged(_addr);
    }

    /**
     * getLiquidationManager returns the address of the TechPayLiquidationManager contract.
     */
    function getTechPayLiquidationManager() public view returns (address) {
        return (getAddress(MOD_LIQUIDATION_MANAGER));
    }

        /**
     * setTechPayMint modifies the address of the TechPay Mint contract.
     */
    function setTechPayLiquidationManager(address _addr) public onlyOwner {
        // make the change
        setAddress(MOD_LIQUIDATION_MANAGER, _addr);

        // inform listeners and seekers about the change
        emit LiquidationManagerChanged(_addr);
    }

    /**
     * getTechPayMint returns the address of the TechPay Mint contract.
     */
    function getTechPayMint() public view returns (ITechPayMintBalanceGuard) {
        return ITechPayMintBalanceGuard(getAddress(MOD_TECHPAY_MINT));
    }

    /**
     * setTechPayMint modifies the address of the TechPay Mint contract.
     */
    function setTechPayMint(address _addr) public onlyOwner {
        // make the change
        setAddress(MOD_TECHPAY_MINT, _addr);

        // inform listeners and seekers about the change
        emit MinterChanged(_addr);
    }

    /**
     * getCollateralPool returns the address of the collateral pool contract.
     */
    function getCollateralPool() public view returns (ITechPayDeFiTokenStorage) {
        return ITechPayDeFiTokenStorage(getAddress(MOD_COLLATERAL_POOL));
    }

    /**
     * setCollateralPool modifies the address of the collateral pool contract.
     */
    function setCollateralPool(address _addr) public onlyOwner {
        // make the change
        setAddress(MOD_COLLATERAL_POOL, _addr);

        // inform listeners and seekers about the change
        emit CollateralPoolChanged(_addr);
    }

    /**
     * getDebtPool returns the address of the debt pool contract.
     */
    function getDebtPool() public view returns (ITechPayDeFiTokenStorage) {
        return ITechPayDeFiTokenStorage(getAddress(MOD_DEBT_POOL));
    }

    /**
     * setDebtPool modifies the address of the debt pool contract.
     */
    function setDebtPool(address _addr) public onlyOwner {
        // make the change
        setAddress(MOD_DEBT_POOL, _addr);

        // inform listeners and seekers about the change
        emit DebtPoolChanged(_addr);
    }
}
