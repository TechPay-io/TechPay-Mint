pragma solidity ^0.5.0;

import "../liquidator/TechPayLiquidationManager.sol";

contract MockTechPayLiquidationManager is TechPayLiquidationManager {

    uint256 public time;
    function setTime(uint256 t) public {
        time = t;
    }

    function increaseTime(uint256 t) public {
        time += t;
    }

    function _now() internal view returns (uint256) {
        return time;
    }


}