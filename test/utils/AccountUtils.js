const BigNumber = require('bn.js');
const tokenAddress = require('../const/Token.js');

web3.eth.extend({
  methods: [{
    name: 'unlockAccount',
    call: 'evm_unlockUnknownAccount',
    params: 1,
    inputFormatter: [web3.extend.formatters.inputAddressFormatter]
  }]
})

const ADMIN = accounts[0]

async function unlockAccount(address) {
  return web3.eth.unlockAccount(address)
}

async function give10ETH(toAddress) {
  this.unlockAccount(toAddress).catch((err) => {
    // looks like it is an account known to the personal namespace or one of accounts returned by eth_accounts, ignore it
  })
  await web3.eth.sendTransaction({
    from: ADMIN,
    to: toAddress,
    value: web3.utils.toWei("10"),
    gas: 23000
  })
}

async function giveERC20Token(tokenSymbol, toAddress, amountInWei) {
  let tokenInstance = await saddle.getContractAt('IERC20', tokenAddress[tokenSymbol].token)
  this.unlockAccount(toAddress).catch((err) => {
    // looks like it is an account known to the personal namespace or one of accounts returned by eth_accounts, ignore it
  })
  this.unlockAccount(tokenAddress[tokenSymbol].tokenHolder).catch((err) => {
    // looks like it is an account known to the personal namespace or one of accounts returned by eth_accounts, ignore it
  })
  await this.give10ETH(tokenAddress[tokenSymbol].tokenHolder)
  await send(tokenInstance, 'transfer', [toAddress, new BigNumber(amountInWei).toString()], { from: tokenAddress[tokenSymbol].tokenHolder })
}

async function balanceOfETH(address) {
  return await web3.eth.getBalance(address)
}

async function balanceOfERC20Token(tokenSymbol, address) {
  let tokenInstance = await saddle.getContractAt('IERC20', tokenAddress[tokenSymbol].token)
  return await call(tokenInstance, 'balanceOf', [address])
}

async function doApprove(tokenSymbol, holderAddress, spenderAddress, amountInWei) {
  let tokenInstance = await saddle.getContractAt('IERC20', tokenAddress[tokenSymbol].token)
  await send(tokenInstance, 'approve', [spenderAddress, amountInWei.toString()], { from: holderAddress })
}

module.exports = {
  unlockAccount,
  give10ETH,
  giveERC20Token,
  balanceOfETH,
  balanceOfERC20Token,
  doApprove
};
