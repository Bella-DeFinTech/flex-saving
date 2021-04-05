pragma solidity 0.5.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IWeth.sol";
import "../interfaces/IController.sol";
import "../interfaces/IUniswapRouter.sol";
import "./CrvLocker.sol";

/*

 A strategy must implement the following calls;
 
 - deposit()
 - withdraw(address) must exclude any tokens used in the yield - Controller role - withdraw should return to Controller
 - withdraw(uint) - Controller | Vault role - withdraw should always return to vault
 - withdrawAll() - Controller | Vault role - withdraw should always return to vault
 - balanceOf()
 
 Where possible, strategies must remain as immutable as possible, instead of updating variables, we update the contract by linking it in the controller
 
*/

interface IWETH {
    function deposit() public payable;
    function withdraw(uint wad) public;
    function totalSupply() public view returns (uint);
    function approve(address guy, uint wad) public returns (bool);
    function transfer(address dst, uint wad) public returns (bool);
    function transferFrom(address src, address dst, uint wad) public returns (bool);
}

contract StrategyWeth {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address constant public want = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // weth

    address constant public bella = address(0xA91ac63D040dEB1b7A5E4d4134aD23eb0ba07e14);

    address public governance;
    address public controller;

    uint256 public toWant = 92; // 20% manager fee + 80%*90%
    uint256 public toBella = 8;
    uint256 public manageFee = 22; //92%*22% = 20%

    uint256 public burnPercent = 50;
    uint256 public distributionPercent = 50;
    address public burnAddress = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    // withdrawSome withdraw a bit more to compensate the imbalanced asset, 10000=1
    uint256 public withdrawCompensation = 30;
    
    constructor(address _controller, address _governance) public CrvLocker(_governance) {
        governance = _governance;
        controller = _controller;
        doApprove();
    }

    function doApprove () public {

    }
    
    function deposit() public {
        require((msg.sender == governance || 
            (msg.sender == tx.origin) ||
            (msg.sender == controller)),"!contract");

        // convert all weth to eth

        // deposit balance of this to Ironbank

    }
    
    // Controller only function for creating additional rewards from dust
    function withdraw(IERC20 _asset) external returns (uint balance) {
        require(msg.sender == controller, "!controller");
        require(address(_asset) != address(want), "!want");
        balance = _asset.balanceOf(address(this));
        _asset.safeTransfer(controller, balance);
    }
    
    // Withdraw partial funds, normally used with a vault withdrawal
    function withdraw(uint _amount) external {
        require(msg.sender == controller, "!controller");

        // check balance of weth
        // check balance of eth

        // if weth + eth < _amount: withdraw some

        // transfer weth to vault


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

        // wrap eth balance to weth

        balance = IERC20(want).balanceOf(address(this));
        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds
        IERC20(want).safeTransfer(_vault, balance);
    }
    
    function _withdrawAll() internal {
        // withdraw 3pool crv from gauge
        uint256 amount = ICrvDeposit(threePoolGauge).balanceOf(address(this));
        _withdrawXCurve(threePoolGauge, amount);
        
        // exchange xcrv from pool to say dai 
        ICrvPool(threePool).remove_liquidity_one_coin(amount, tokenIndexThreePool, 1);
    }
    
    function _withdrawSome(uint256 _amount) internal returns (uint) {
        // withdraw 3pool crv from gauge
        uint256 amount = _amount.mul(1e18).div(ICrvPool(threePool).get_virtual_price())
            .mul(10000 + withdrawCompensation).div(10000);
        amount = _withdrawXCurve(threePoolGauge, amount);

        uint256 bBefore = IERC20(want).balanceOf(address(this));

        ICrvPool(threePool).remove_liquidity_one_coin(amount, tokenIndexThreePool, 1);

        uint256 bAfter = IERC20(want).balanceOf(address(this));

        return bAfter.sub(bBefore);
    }
    
    function balanceOf() public view returns (uint) {
        // weth balance + eth balance + balance InPool
        return IERC20(want).balanceOf(address(this))
                .add(balanceInPool());
    }

    function underlyingBalanceOf() public view returns (uint) {
        return balanceOf();
    }


    function balanceInPool() public view returns (uint256) {
        // balance in Ironbank
        return ICrvDeposit(threePoolGauge).balanceOf(address(this)).mul(ICrvPool(threePool).get_virtual_price()).div(1e18);
    }
    
    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }
    
    function setController(address _controller) external {
        require(msg.sender == governance, "!governance");
        controller = _controller;
    }

    function changeManageFee(uint256 newManageFee) external {
        require(msg.sender == governance, "!governance");
        require(newManageFee <= 100, "must less than 100%!");
        manageFee = newManageFee;
    }

    function changeBelWantRatio(uint256 newToBella, uint256 newToWant) external {
        require(msg.sender == governance, "!governance");
        require(newToBella.add(newToWant) == 100, "must divide all the pool");
        toBella = newToBella;
        toWant = newToWant;
    }

    function setDistributionAndBurnRatio(uint256 newDistributionPercent, uint256 newBurnPercent) external{
        require(msg.sender == governance, "!governance");
        require(newDistributionPercent.add(newBurnPercent) == 100, "must be 100% total");
        distributionPercent = newDistributionPercent;
        burnPercent = newBurnPercent;
    }

    function setBurnAddress(address _burnAddress) public{
        require(msg.sender == governance, "!governance");
        require(_burnAddress != address(0), "cannot send bella to 0 address");
        burnAddress = _burnAddress;
    }

    function setWithdrawCompensation(uint256 _withdrawCompensation) public {
        require(msg.sender == governance, "!governance");
        require(_withdrawCompensation <= 100, "too much compensation");
        withdrawCompensation = _withdrawCompensation;
    }

    // TODO:?
    function wrapEth(uint256 amount) internal pure returns (uint256[3] memory) {
        uint256[3] memory amounts = [uint256(0), uint256(0), uint256(0)];
        amounts[tokenIndexThreePool] = amount;
        return amounts;
    }

    // TODO:?
    function unwrapEth(uint256 amount) internal pure returns (uint256[3] memory) {
        uint256[3] memory amounts = [uint256(0), uint256(0), uint256(0)];
        amounts[tokenIndexThreePool] = amount;
        return amounts;
    }

}