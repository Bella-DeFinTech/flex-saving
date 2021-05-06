const tokenAddress = require('./Token.js');

const strategyTokens = {
    USDT: { index: 0, symbol: 'USDT', _address: tokenAddress.USDT.token, contractName: 'StrategyUsdt' },
    USDC: { index: 1, symbol: 'USDC', _address: tokenAddress.USDC.token, contractName: 'StrategyUsdc' },
    WBTC: { index: 2, symbol: 'WBTC', _address: tokenAddress.WBTC.token, contractName: 'StrategyWbtc' },
    ARPA: { index: 3, symbol: 'ARPA', _address: tokenAddress.ARPA.token, contractName: 'StrategyArpa' },
    DAI: { index: 4, symbol: 'DAI', _address: tokenAddress.DAI.token, contractName: 'StrategyDai' },
    BUSD: { index: 5, symbol: 'BUSD', _address: tokenAddress.BUSD.token, contractName: 'StrategyBusd' },
    HBTC: { index: 6, symbol: 'HBTC', _address: tokenAddress.HBTC.token, contractName: 'StrategyHbtc' },
    WETH: { index: 7, symbol: 'WETH', _address: tokenAddress.WETH.token, contractName: 'StrategyWeth' }
}
module.exports = strategyTokens