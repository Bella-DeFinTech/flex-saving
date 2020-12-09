pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

contract MockWBTC is ERC20, ERC20Detailed {

    string public constant _name = "Wrapped BTC";
    uint8 public constant _decimals = 8;
    string public constant _symbol = "WBTC";
    uint public constant _supply = 1 * 10**8 * 10**uint(_decimals); // 100 million

    constructor() public ERC20Detailed(_name, _symbol, _decimals)  {
        _mint(msg.sender, _supply);
    }
}
