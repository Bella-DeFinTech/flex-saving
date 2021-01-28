const tokenAddress = require('./Token.js');

const strategyTokens = {
    USDT: { index: 0, symbol: 'USDT', _address: tokenAddress.USDT.token },
    USDC: { index: 1, symbol: 'USDC', _address: tokenAddress.USDC.token },
    WBTC: { index: 2, symbol: 'WBTC', _address: tokenAddress.WBTC.token },
    ARPA: { index: 3, symbol: 'ARPA', _address: tokenAddress.ARPA.token },
    DAI: { index: 4, symbol: 'DAI', _address: tokenAddress.DAI.token },
    BUSD: { index: 5, symbol: 'BUSD', _address: tokenAddress.BUSD.token },
    HBTC: { index: 6, symbol: 'HBTC', _address: tokenAddress.HBTC.token }
}
module.exports = strategyTokens