pragma solidity 0.5.15;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IVault.sol";

/**
 * @title for testing whether virtual price cac change a lot in one block
 */
contract TestVaultDeposit {
    using SafeERC20 for IERC20;
    using Address for address;

    address public vaultAddress;
    address public tokenAddress;

    constructor(address _vaultAddress, address _tokenAddress) public {
        vaultAddress = _vaultAddress;
        tokenAddress = _tokenAddress;
        doApprove();
    }

    function deposit() public {
        uint256 tokenToDeposit = IERC20(tokenAddress).balanceOf(address(this));
        IVault(vaultAddress).deposit(tokenToDeposit);
    }

    function doApprove () public {
        // HBTC trx will be reverted by this
        // IERC20(tokenAddress).safeApprove(vaultAddress, 0);
        IERC20(tokenAddress).safeApprove(vaultAddress, uint(-1));
    }

}