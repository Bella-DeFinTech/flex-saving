pragma solidity 0.5.15;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IController.sol";
import "../interfaces/IStakingRewards.sol";
import "../interfaces/IUniswapRouter.sol";
import "../interfaces/IUniHelper.sol";

/*

 A strategy must implement the following calls;
 
 - deposit()
 - withdraw(address) must exclude any tokens used in the yield - Controller role - withdraw should return to Controller
 - withdraw(uint) - Controller | Vault role - withdraw should always return to vault
 - withdrawAll() - Controller | Vault role - withdraw should always return to vault
 - balanceOf()
 
 Where possible, strategies must remain as immutable as possible, instead of updating variables, we update the contract by linking it in the controller
 
*/

contract StrategyETH_USDT_LP {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;
    
    // TODO: change lp according to usdt/dai/usdc/wbtc
    // usdt 0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852
    // dai 0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11
    // usdc 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc
    // wbtc 0xBb2b8038a1640196FbE3e38816F3e67Cba72D940
    address constant public want = address(0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852); // LP
    address constant public unirouter = address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    address constant public bella = address(0xA91ac63D040dEB1b7A5E4d4134aD23eb0ba07e14);
    address constant public output = address(0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984); // UNI   
    address constant public weth = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    // TODO: change pair (= another token in lp) according to usdt/dai/usdc/wbtc
    // usdt 0xdAC17F958D2ee523a2206206994597C13D831ec7
    // dai 0x6B175474E89094C44Da98b954EedeAC495271d0F
    // usdc 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
    // wbtc 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
    address constant public pair = address(0xdAC17F958D2ee523a2206206994597C13D831ec7); // usdt
    // TODO: change miner according to usdt/dai/usdc/wbtc
    // usdt 0x6C3e4cb2E96B01F4b866965A91ed4437839A121a
    // dai 0xa1484C3aa22a66C62b77E0AE78E15258bd0cB711
    // usdc 0x7FBa4B8Dc5E7616e59622806932DBea72537A56b
    // wbtc 0xCA35e32e7926b96A9988f61d510E038108d8068e
    address constant public miner = address(0x6C3e4cb2E96B01F4b866965A91ed4437839A121a); // Uniswap V2: ETH/USDT UNI Pool
    address constant public unihelper = address(0x3AF045FD63Afc040aE9FD8C5b380d2DF2B804cfc); // TODO: use this, 0xe5130f9182ab0ee26ba6600b08a6b66b160867ccedfeb4b3aff1bd6f84da1c24 or new deployment?

    uint256 public manageFee = 20;
    uint256 public toBella = 10;
    uint256 public toLp = 90;

    uint256 public burnPercent = 50;
    uint256 public distributionPercent = 50;
    
    address public governance;
    address public controller;
    address public burnAddress = address(0);

    address[] public swap2BellaRouting; // weth -> bella
    address[] public swap2TokenRouting; // uni -> weth

    
    constructor(address _controller, address _governance) public {
        governance = _governance;
        controller = _controller;
        
        swap2TokenRouting = [output, weth];
        swap2BellaRouting = [weth, bella];
        doApprove();        
    }

    function doApprove () public{
        // uni -> weth
        IERC20(output).safeApprove(unirouter, 0);
        IERC20(output).safeApprove(unirouter, uint(-1));

        // weth -> bella
        IERC20(weth).safeApprove(unirouter, 0);
        IERC20(weth).safeApprove(unirouter, uint(-1)); 

        // lp to mining pool 
        IERC20(want).safeApprove(miner, 0);
        IERC20(want).safeApprove(miner, uint(-1));  

        // weth -> lp
        IERC20(weth).safeApprove(unihelper, 0);
        IERC20(weth).safeApprove(unihelper, uint(-1)); 
        // pair -> lp       
        IERC20(pair).safeApprove(unihelper, 0);
        IERC20(pair).safeApprove(unihelper, uint(-1));
    }
        
    function deposit() public {
        require((msg.sender == governance || 
            (msg.sender == tx.origin) ||
            (msg.sender == controller)),"!contract");
        uint _want = IERC20(want).balanceOf(address(this));
        if (_want > 0) {
            IStakingRewards(miner).stake(_want);            
        }        
    }
    
    // Controller only function for creating additional rewards from dust
    function withdraw(IERC20 _asset) external returns (uint balance) {
        require(msg.sender == controller, "!controller");
        require(want != address(_asset), "want");
        require(output != address(_asset), "uni");
        require(weth != address(_asset), "weth");
        require(pair != address(_asset), "pair");
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
        IStakingRewards(miner).withdraw(balanceOfPool());        
    }
    
    function harvest() public {
        require(tx.origin == msg.sender, "!contract");

        IStakingRewards(miner).getReward();
  
        swapTokens();
        deposit();

        if (toBella != 0) {
            splitBella();
        }
        
    }
    function swapTokens() internal {
        uint256 _2weth = IERC20(output).balanceOf(address(this)); 
        // Uni -> WETH
        IUniswapRouter(unirouter).swapExactTokensForTokens(_2weth, 1, swap2TokenRouting, address(this), now.add(1800));

        uint256 fee = IERC20(weth).balanceOf(address(this)).mul(manageFee).div(100);
        IERC20(weth).safeTransfer(IController(controller).rewards(), fee);

        // WETH -> BEL
        if (toBella != 0) {
            uint256 _2bella = IERC20(weth).balanceOf(address(this)).mul(toBella).div(100);
            IUniswapRouter(unirouter).swapExactTokensForTokens(_2bella, 1, swap2BellaRouting, address(this), now.add(1800));      
        }

        // WETH -> LP
        if (toLp != 0) {
            IUniHelper(unihelper).swapAndAddLiquidityTokenAndToken(weth,pair,uint112(IERC20(weth).balanceOf(address(this))),uint112(IERC20(pair).balanceOf(address(this))),0,address(this),uint64(now.add(1800)));
        }
    }

    function splitBella() internal {
        uint bellaBalance = IERC20(bella).balanceOf(address(this));

        uint burn = bellaBalance.mul(burnPercent).div(100);
        uint distribution = bellaBalance.mul(distributionPercent).div(100);
        
        IERC20(bella).safeTransfer(IController(controller).rewards(), distribution);
        IERC20(bella).safeTransfer(burnAddress, burn); 
    }
    
    function _withdrawSome(uint256 _amount) internal returns (uint) {
        IStakingRewards(miner).withdraw(_amount);        
        return _amount;
    }
    
    function balanceOfWant() public view returns (uint) {
        return IERC20(want).balanceOf(address(this));
    }
    
    function balanceOfPool() public view returns (uint) {
        return IStakingRewards(miner).balanceOf(address(this));
    }
    
    function balanceOf() public view returns (uint) {
        return balanceOfWant()
               .add(balanceOfPool());
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

    function changeBelLpRatio(uint256 newToBella, uint256 newToLp) external {
        require(msg.sender == governance, "!governance");
        require(newToBella.add(newToLp) == 100, "must divide all the pool");
        toBella = newToBella;
        toLp = newToLp;
    }

    function setDistributionAndBurnRatio(uint256 newDistributionPercent, uint256 newBurnPercent) external{
        require(msg.sender == governance, "!governance");
        require(newDistributionPercent.add(newBurnPercent) == 100, "must be 100% total");
        distributionPercent = newDistributionPercent;
        burnPercent = newBurnPercent;
    }

    function setBurnAddress(address _burnAddress) public{
        require(msg.sender == governance, "!governance");
        burnAddress = _burnAddress;
    }

}