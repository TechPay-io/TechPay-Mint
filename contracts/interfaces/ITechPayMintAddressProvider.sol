pragma solidity ^0.5.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ITechPayMintBalanceGuard.sol";
import "../interfaces/ITechPayDeFiTokenStorage.sol";
import "../interfaces/ITechPayMintTokenRegistry.sol";
import "../interfaces/ITechPayMintRewardManager.sol";
import "../interfaces/IPriceOracleProxy.sol";
import "./IERC20Detailed.sol";

/**
 * This interface defines available functions of the FMint Address Provider contract.
 *
 * Note: We may want to create a cache for certain external contract access scenarios (like
 * for token price/value calculation, which needs the oracle and registry).
 * The contract which frequently connects with another one would use the cached address
 * from the address provider until a protoSync() is called. The protoSync() call would
 * re-load contract addresses from the address provider and cache them locally to save
 * gas on repeated access.
 */
interface ITechPayMintAddressProvider {
	// getTechPayLiquidationManager returns the address of TechPayLiquidationManager contract.
	function getTechPayLiquidationManager() external view returns (address);

	// setTechPayLiquidationManager modifies the address of the TechPayLiquidationManager contract.
	function setTechPayLiquidationManager(address _addr) external;
	
	// getTechPayMint returns the address of the TechPay fMint contract.
	function getTechPayMint() external view returns (ITechPayMintBalanceGuard);

	// setTechPayMint modifies the address of the TechPay fMint contract.
	function setTechPayMint(address _addr) external;

	// getTokenRegistry returns the address of the token registry contract.
	function getTokenRegistry() external view returns (ITechPayMintTokenRegistry);

	// setTokenRegistry modifies the address of the token registry contract.
	function setTokenRegistry(address _addr) external;

	// getCollateralPool returns the address of the collateral pool contract.
	function getCollateralPool() external view returns (ITechPayDeFiTokenStorage);

	// setCollateralPool modifies the address of the collateral pool contract.
	function setCollateralPool(address _addr) external;

	// getDebtPool returns the address of the debt pool contract.
	function getDebtPool() external view returns (ITechPayDeFiTokenStorage);

	// setDebtPool modifies the address of the debt pool contract.
	function setDebtPool(address _addr) external;

	// getRewardDistribution returns the address of the reward distribution contract.
	function getRewardDistribution() external view returns (ITechPayMintRewardManager);

	// setRewardDistribution modifies the address of the reward distribution contract.
	function setRewardDistribution(address _addr) external;

	// getPriceOracleProxy returns the address of the price oracle aggregate.
	function getPriceOracleProxy() external view returns (IPriceOracleProxy);

	// setPriceOracleProxy modifies the address of the price oracle aggregate.
	function setPriceOracleProxy(address _addr) external;

	// getRewardToken returns the address of the reward token ERC20 contract.
	function getRewardToken() external view returns (ERC20);

	// setRewardToken modifies the address of the reward token ERC20 contract.
	function setRewardToken(address _addr) external;

	function getAddress(bytes32 _id) external view returns (address);
}
