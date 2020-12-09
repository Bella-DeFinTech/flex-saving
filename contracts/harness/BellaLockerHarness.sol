pragma solidity 0.5.15;

import "../bella-locking/BellaLocker.sol";

contract BellaLockerHarness is BellaLocker {
    constructor(address governence, address _bel) BellaLocker(governence, _bel) public {}

    function userSavingsLength(address user, uint pid) external view returns (uint) {
        UserSaving[] memory savings = userSavings[user][pid];
        return savings.length;
    }
}