pragma solidity 0.5.15;

// only for 3 token pools
// checked for 3pool
interface ICrvPool {
    function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount) external;
    function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 min_amount) external;
    function get_virtual_price() external view returns (uint256);
    function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external;
}

interface ICrvPool2Coins {
    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount) external;
    function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 min_amount) external;
    function get_virtual_price() external view returns (uint256);
}