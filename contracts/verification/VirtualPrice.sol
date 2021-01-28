pragma solidity 0.5.15;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/ICrvPool.sol";

/**
 * @title for testing whether virtual price cac change a lot in one block
 */
contract TestVirtualPrice {
    using SafeERC20 for IERC20;
    using Address for address;

    uint256 public virtualPrice0;
    uint256 public virtualPrice1;
    // 0 = dai, 1 = usdc, 2 = usdt in 3pool
    address constant public usdt = address(0xdAC17F958D2ee523a2206206994597C13D831ec7); // usdt
    address constant public dai = address(0x6B175474E89094C44Da98b954EedeAC495271d0F); // dai
    address constant public threeCrv = address(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490); // 3pool crv
    address constant public threePool = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7); // 3pool swap

    constructor() public {
        doApprove();
    }

    function exchangeForDaiHugely() public {
        virtualPrice0 = ICrvPool(threePool).get_virtual_price();
        // exchange USDT for DAI
        uint256 dx = IERC20(usdt).balanceOf(address(this));
        ICrvPool(threePool).exchange(2, 0, dx, 0);
        virtualPrice1 = ICrvPool(threePool).get_virtual_price();
    }

    function exchangeForUsdcHugely() public {
        virtualPrice0 = ICrvPool(threePool).get_virtual_price();
        // exchange USDT for DAI
        uint256 dx = IERC20(usdt).balanceOf(address(this));
        ICrvPool(threePool).exchange(2, 1, dx, 0);
        virtualPrice1 = ICrvPool(threePool).get_virtual_price();
    }

    function doApprove () public {

        // dai/usdt/usdc -> 3pool
        IERC20(usdt).safeApprove(threePool, 0);
        IERC20(usdt).safeApprove(threePool, uint(-1));

    }

}