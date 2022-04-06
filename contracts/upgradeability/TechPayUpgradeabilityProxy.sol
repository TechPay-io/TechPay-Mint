pragma solidity ^0.5.0;

import "@openzeppelin/upgrades/contracts/upgradeability/AdminUpgradeabilityProxy.sol";

// TechPayUpgradeabilityProxy inherits fully from OpenZeppelin Upgradeability Proxy
// contract with admin access control.
contract TechPayUpgradeabilityProxy is AdminUpgradeabilityProxy {
    // create the contract instance
    constructor(address _logic, address _admin, bytes memory _data) AdminUpgradeabilityProxy(_logic, _admin, _data) public payable
    {
        // nothing to do here
    }
}