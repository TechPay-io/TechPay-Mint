pragma solidity ^0.5.0;

// ITechPayMintTokenRegistry defines an interface of the TechPay DeFi tokens
// registry contract used to identify ERC20 tokens available for TechPay
// DeFi platform with their important details.
interface ITechPayMintTokenRegistry {

    // priceDecimals returns the number of decimal places a price
    // returned for the given token will be encoded to.
	function priceDecimals(address _token) external view returns (uint8);

    // isActive informs if the specified token is active and can be used in DeFi protocols.
    function isActive(address _token) external view returns (bool);

    // canMint informs if the specified token can be deposited to collateral pool.
    function canDeposit(address _token) external view returns (bool);

	// canMint informs if the given token can be minted in the fMint protocol.
    function canMint(address _token) external view returns (bool);

     // canTrade informs if the given token can be traded in the fMint protocol.
     function canTrade(address _token) external view returns (bool);
}
