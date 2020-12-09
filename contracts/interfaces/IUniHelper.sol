pragma solidity ^0.5.15;

// https://etherscan.io/tx/0xe5130f9182ab0ee26ba6600b08a6b66b160867ccedfeb4b3aff1bd6f84da1c24
interface IUniHelper {
    function swapAndAddLiquidityTokenAndToken(
        address tokenAddressA,
        address tokenAddressB,
        uint112 amountA,
        uint112 amountB,
        uint112 minLiquidityOut,
        address to,
        uint64 deadline
    ) external returns(uint liquidity);
}