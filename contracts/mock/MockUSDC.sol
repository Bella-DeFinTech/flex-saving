pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

contract MockUSDC is ERC20, ERC20Detailed {

    string public constant _name = "USD Coin";
    uint8 public constant _decimals = 6;
    string public constant _symbol = "USDC";
    uint public constant _supply = 1 * 10**8 * 10**uint(_decimals); // 100 million

    constructor() public ERC20Detailed(_name, _symbol, _decimals)  {
        _mint(msg.sender, _supply);
    }
}