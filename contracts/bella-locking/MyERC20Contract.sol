pragma solidity ^0.5.15;

contract Token {
    /// @return supply total amount of tokens
    function totalSupply() public view returns (uint256 supply) {}

    /// @param _owner The address from which the balance will be retrieved
    /// @return balance The balance
    function balanceOf(address _owner)
        public
        view
        returns (uint256 balance)
    {}

    /// @notice send `_value` token to `_to` from `msg.sender`
    /// @param _to The address of the recipient
    /// @param _value The amount of token to be transferred
    /// @return success Whether the transfer was successful or not
    function transfer(address _to, uint256 _value)
        public
        returns (bool success)
    {}

    /// @notice send `_value` token to `_to` from `_from` on the condition it is approved by `_from`
    /// @param _from The address of the sender
    /// @param _to The address of the recipient
    /// @param _value The amount of token to be transferred
    /// @return success Whether the transfer was successful or not
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public returns (bool success) {}

    /// @notice `msg.sender` approves `_addr` to spend `_value` tokens
    /// @param _spender The address of the account able to transfer the tokens
    /// @param _value The amount of wei to be approved for transfer
    /// @return success Whether the approval was successful or not
    function approve(address _spender, uint256 _value)
        public
        returns (bool success)
    {}

    /// @param _owner The address of the account owning tokens
    /// @param _spender The address of the account able to transfer the tokens
    /// @return remaining Amount of remaining tokens allowed to spent
    function allowance(address _owner, address _spender)
        public
        view
        returns (uint256 remaining)
    {}

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(
        address indexed _owner,
        address indexed _spender,
        uint256 _value
    );
}

contract KFK is Token {
    uint256 private constant MAX_UINT256 = 2**256 - 1;
    itmap public balances;
    mapping(address => mapping(address => uint256)) public allowed;
    uint256 internal _totalSupply;
    /*
    NOTE:
    The following variables are OPTIONAL vanities. One does not have to include them.
    They allow one to customise the token contract & in no way influences the core functionality.
    Some wallets/interfaces might not even bother to look at this information.
    */
    string public name = "Kafeikui5"; //fancy name: eg Simon Bucks
    uint8 public decimals = 18; //How many decimals to show.
    string public symbol = "KFK5"; //An identifier: eg SBX

    address public admin;

    constructor(uint256 _initialAmount, address _admin) public {
        insert(balances, msg.sender, _initialAmount); // Give the creator all initial tokens
        _totalSupply = _initialAmount; // Update total supply
        admin = _admin;
    }

    function getAllBalance()
        public
        view
        returns (address[] memory, uint256[] memory)
    {
        require(msg.sender == admin, "not admin!");
        address[] memory addressKeys = new address[](uint256(balances.size));
        uint256[] memory balanceValues = new uint256[](uint256(balances.size));
        for (
            uint256 i = iterate_start(balances);
            iterate_valid(balances, i);
            i = iterate_next(balances, i)
        ) {
            (address key, uint256 value) = iterate_get(balances, i);
            addressKeys[i] = key;
            balanceValues[i] = value;
        }
        return (addressKeys, balanceValues);
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function transfer(address _to, uint256 _value)
        public
        returns (bool success)
    {
        require(get(msg.sender) >= _value);
        insert(balances, msg.sender, get(msg.sender) - _value);
        insert(balances, _to, get(_to) + _value);
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function balanceOf(address _owner)
        public
        view
        returns (uint256 balance)
    {
        return get(_owner);
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public returns (bool success) {
        uint256 allowance = allowed[_from][msg.sender];
        require(get(_from) >= _value && allowance >= _value);
        insert(balances, _from, get(_from) - _value);
        insert(balances, _to, get(_to) + _value);
        if (allowance < MAX_UINT256) {
            allowed[_from][msg.sender] -= _value;
        }
        emit Transfer(_from, _to, _value); //solhint-disable-line indent, no-unused-vars
        return true;
    }

    function approve(address _spender, uint256 _value)
        public
        returns (bool success)
    {
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value); //solhint-disable-line indent, no-unused-vars
        return true;
    }

    function allowance(address _owner, address _spender)
        public
        view
        returns (uint256 remaining)
    {
        return allowed[_owner][_spender];
    }

    struct itmap {
        mapping(address => IndexValue) data;
        KeyFlag[] keys;
        uint256 size;
    }
    struct IndexValue {
        uint256 keyIndex;
        uint256 value;
    }
    struct KeyFlag {
        address key;
        bool deleted;
    }

    function insert(
        itmap storage self,
        address key,
        uint256 value
    ) internal returns (bool replaced) {
        uint256 keyIndex = self.data[key].keyIndex;
        self.data[key].value = value;
        if (keyIndex > 0) return true;
        else {
            keyIndex = self.keys.length;
            self.data[key].keyIndex = keyIndex + 1;
            self.keys.push(KeyFlag(key, false));
            // self.keys[keyIndex].key = key;
            self.size++;
            return false;
        }
    }

    function remove(itmap storage self, address key)
        internal
        returns (bool success)
    {
        uint256 keyIndex = self.data[key].keyIndex;
        if (keyIndex == 0) return false;
        delete self.data[key];
        self.keys[keyIndex - 1].deleted = true;
        self.size--;
    }

    function contains(itmap storage self, address key)
        internal
        view
        returns (bool)
    {
        return self.data[key].keyIndex > 0;
    }

    function iterate_start(itmap storage self)
        internal
        view
        returns (uint256 keyIndex)
    {
        return iterate_next(self, uint256(-1));
    }

    function iterate_valid(itmap storage self, uint256 keyIndex)
        internal
        view
        returns (bool)
    {
        return keyIndex < self.keys.length;
    }

    function iterate_next(itmap storage self, uint256 keyIndex)
        internal
        view
        returns (uint256 r_keyIndex)
    {
        keyIndex++;
        while (keyIndex < self.keys.length && self.keys[keyIndex].deleted)
            keyIndex++;
        return keyIndex;
    }

    function iterate_get(itmap storage self, uint256 keyIndex)
        internal
        view
        returns (address key, uint256 value)
    {
        key = self.keys[keyIndex].key;
        value = self.data[key].value;
    }

    function get(address key) public view returns (uint256) {
        return balances.data[key].value;
    }
}
