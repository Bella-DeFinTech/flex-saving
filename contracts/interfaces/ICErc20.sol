pragma solidity 0.5.15;

interface ICErc20 {
    function mint(uint mintAmount) external returns (uint);

    function redeem(uint redeemTokens) external returns (uint);

    function redeemUnderlying(uint redeemAmount) external returns (uint);

    function balanceOf(address user) external view returns (uint);

    /**
     * @notice Get the underlying balance of the `owner`
     * @dev This also accrues interest in a transaction
     * @param owner The address of the account to query
     * @return The amount of underlying owned by `owner`
     */
    function balanceOfUnderlying(address owner) external returns (uint);

    // 20*10^18/（100822722474676019882966277/10^18）/ 10^8 (cyWeth decimal = 8)
    // weth / (rate / 10 ^18 ) 
    /**
     * @notice Calculates the exchange rate from the underlying to the CToken
     * @dev This function does not accrue interest before calculating the exchange rate
     * @return Calculated exchange rate scaled by 1e18
     */
    function exchangeRateStored() public view returns (uint);

    function approve(address spender, uint256 amount) external returns (bool);

    function balanceOfUnderlying(address owner) external returns (uint);

}