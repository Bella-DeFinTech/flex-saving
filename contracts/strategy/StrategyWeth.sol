pragma solidity 0.5.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IWeth.sol";
import "../interfaces/ICErc20.sol";
import "../interfaces/IController.sol";
import "../interfaces/IUniswapRouter.sol";

/*

 A strategy must implement the following calls;
 
 - deposit()
 - withdraw(address) must exclude any tokens used in the yield - Controller role - withdraw should return to Controller
 - withdraw(uint) - Controller | Vault role - withdraw should always return to vault
 - withdrawAll() - Controller | Vault role - withdraw should always return to vault
 - balanceOf()
 
 Where possible, strategies must remain as immutable as possible, instead of updating variables, we update the contract by linking it in the controller
 
*/

contract StrategyWeth {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint;

    address constant public want = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // weth
    address constant public cyWeth = address(0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393); // cyWeth

    address public governance;
    address public controller;
    
    constructor(address _controller, address _governance) public {
        governance = _governance;
        controller = _controller;
        doApprove();
    }

    function doApprove () public {
        IERC20(want).safeApprove(cyWeth, uint(-1)); 
    }

    function deposit(uint _amount) public {
        require((msg.sender == governance || 
            (msg.sender == tx.origin) ||
            (msg.sender == controller)),"!contract");
        require(ICErc20(cyWeth).mint(_amount) == 0, '!mint');
    }
    
    // Controller only function for creating additional rewards from dust
    function withdraw(IERC20 _asset) external returns (uint balance) {
        require(msg.sender == controller, "!controller");
        require(address(_asset) != address(want), "!want");
        require(address(_asset) != address(cyWeth), "!cyWeth");
        balance = _asset.balanceOf(address(this));
        _asset.safeTransfer(controller, balance);
    }

    // Withdraw partial funds, normally used with a vault withdrawal
    function withdraw(uint _amount) external {
        require(msg.sender == controller, "!controller");

        uint _balance = IERC20(want).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_amount.sub(_balance));
            _amount = _amount.add(_balance);
        }
        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds
        IERC20(want).safeTransfer(_vault, _amount);
    }
    
    // Withdraw all funds, normally used when migrating strategies
    function withdrawAll() external returns (uint balance) {
        require(msg.sender == controller, "!controller");
        _withdrawAll();

        balance = IERC20(want).balanceOf(address(this));
        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds
        IERC20(want).safeTransfer(_vault, balance);
    }
    
    function _withdrawAll() internal {
        
        uint balance = ICErc20(cyWeth).balanceOf(address(this));
        require(ICErc20(cyWeth).redeem(balance) == 0, '!redeem');

    }
    
    function _withdrawSome(uint _amount) internal returns (uint) {

        // 1e10 = 1e18 / 1e8 = rate scale factor / cyWeth decimal
        uint cyWethAmount = _amount.mul(1e10).div(ICErc20(cyWeth).exchangeRateStored()); 
        uint amount = Math.min(cyWethAmount, ICErc20(cyWeth).balanceOf(address(this)));

        uint bBefore = IERC20(want).balanceOf(address(this));

        require(ICErc20(cyWeth).redeem(amount) == 0, '!redeem');

        uint bAfter = IERC20(want).balanceOf(address(this));

        return bAfter.sub(bBefore);
    }
    
    function balanceOf() public view returns (uint) {
        return IERC20(want).balanceOf(address(this))
                .add(balanceInPool());
    }

    function underlyingBalanceOf() public view returns (uint) {
        return balanceOf();
    }

    function balanceInPool() public view returns (uint) {
        return ICErc20(cyWeth).balanceOf(address(this)).mul(ICErc20(cyWeth).exchangeRateStored()).div(1e10);
    }
    
    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }
    
    function setController(address _controller) external {
        require(msg.sender == governance, "!governance");
        controller = _controller;
    }

}