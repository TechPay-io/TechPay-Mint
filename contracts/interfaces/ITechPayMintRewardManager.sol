pragma solidity ^0.5.0;

// ITechPayMintRewardManager defines the interface of the rewards distribution manager.
interface ITechPayMintRewardManager {
    // rewardUpdate updates the stored reward distribution state for the account.
    function rewardUpdate(address _account) external;
}
