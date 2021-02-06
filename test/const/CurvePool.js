const BigNumber = require('bn.js');
const curve3crv = require('../abi/3CRV.js');
const curve3pool = require('../abi/3Pool.js');
const curveHbtcPool = require('../abi/hbtcPool.js');
const curveHCRV = require('../abi/hCRV.js');
const BNUtils = require("../utils/BNUtils.js");
const AccountUtils = require("../utils/AccountUtils.js");
const timeMachine = require("../utils/TimeMachine.js")
const tokenAddress = require('./Token.js');

const poolParam = {
    _3pool: {
        POOL_TOKEN: {
            0: 'DAI',
            1: 'USDC',
            2: 'USDT',
            findIndex: function (tokenSymbol, compare = (a, b) => a === b) {
                return Object.keys(this).find(k => compare(this[k], tokenSymbol))
            }
        },
        LP_TOKEN: '_3CRV',
        CURRENCY_NUMBER: () => new BigNumber(3),
        CURRENCY_RATES: () => [BNUtils.get10pow(18), BNUtils.get10pow(18 + 12), BNUtils.get10pow(18 + 12)],
        EXCHANGE_FEE: () => BNUtils.mul10pow(new BigNumber(4), 6), // 0.04%
        ADMIN_FEE: () => BNUtils.mul10pow(new BigNumber(50), 8), // 50% of EXCHANGE_FEE
        PRECISION: () => BNUtils.get10pow(18), //The precision to convert to 
        FEE_DENOMINATOR: () => BNUtils.get10pow(10),
        PRECISION_MUL: () => [new BigNumber(1), BNUtils.get10pow(12), BNUtils.get10pow(12)],
        curveGaugeAddress: '0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB',
        curvePoolAddress: '0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB',
        curvePoolCrvAddress: tokenAddress._3CRV.token,
        curvePoolInstance: function () {
            return new web3.eth.Contract(curve3pool.abiArray, this.curvePoolAddress)
        },
        curvePoolCrvInstance: function () {
            return new web3.eth.Contract(curve3crv.abiArray, this.curvePoolCrvAddress)
        }
    },
    hbtc: {
        POOL_TOKEN: {
            0: 'HBTC',
            1: 'WBTC',
            findIndex: function (tokenSymbol, compare = (a, b) => a === b) {
                return Object.keys(this).find(k => compare(this[k], tokenSymbol))
            }
        },
        LP_TOKEN: 'hCRV',
        CURRENCY_NUMBER: () => new BigNumber(2),
        CURRENCY_RATES: () => [BNUtils.get10pow(18), BNUtils.get10pow(18 + 10)],
        EXCHANGE_FEE: () => BNUtils.mul10pow(new BigNumber(4), 6), // 0.04%
        ADMIN_FEE: () => BNUtils.mul10pow(new BigNumber(50), 8), // 50% of EXCHANGE_FEE
        PRECISION: () => BNUtils.get10pow(18), //The precision to convert to 
        FEE_DENOMINATOR: () => BNUtils.get10pow(10),
        PRECISION_MUL: () => [new BigNumber(1), BNUtils.get10pow(10)],
        curveGaugeAddress: '0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB',
        curvePoolAddress: '0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB',
        curvePoolCrvAddress: tokenAddress.hCRV.token,
        curvePoolInstance: function () {
            return new web3.eth.Contract(curveHbtcPool.abiArray, this.curvePoolAddress)
        },
        curvePoolCrvInstance: function () {
            return new web3.eth.Contract(curveHCRV.abiArray, this.curvePoolCrvAddress)
        }
    },
    // TODO
    busd: {
        POOL_TOKEN: {
            0: 'yDAI',
            1: 'yUSDC',
            2: 'yUSDT',
            3: 'yBUSD',
            findIndex: function (tokenSymbol, compare = (a, b) => a === b) {
                return Object.keys(this).find(k => compare(this[k], tokenSymbol))
            }
        },
        LP_TOKEN: 'yBUSD_CRV',
        CURRENCY_NUMBER: () => new BigNumber(4),
        //result: uint256[N_COINS] = PRECISION_MUL
        // for i in range(N_COINS):
        // result[i] *= yERC20(self.coins[i]).getPricePerFullShare()
        // CURRENCY_RATES: () => [BNUtils.get10pow(18), BNUtils.get10pow(18 + 12), BNUtils.get10pow(18 + 12)],
        EXCHANGE_FEE: () => BNUtils.mul10pow(new BigNumber(4), 6), // 0.04%
        ADMIN_FEE: () => BNUtils.mul10pow(new BigNumber(50), 8), // 50% of EXCHANGE_FEE
        PRECISION: () => BNUtils.get10pow(18), //The precision to convert to 
        FEE_DENOMINATOR: () => BNUtils.get10pow(10),
        PRECISION_MUL: () => [new BigNumber(1), BNUtils.get10pow(12), BNUtils.get10pow(12), new BigNumber(1)]
    }
}

function ContractStatus(curvePoolSymbol, blockNumber) {
    this.curvePoolInstance = poolParam[curvePoolSymbol].curvePoolInstance(),
    this.curvePoolCrvInstance = poolParam[curvePoolSymbol].curvePoolCrvInstance(),
    this.A = async () => {
        let A = await this.curvePoolInstance.methods.A().call({}, blockNumber)
        return new BigNumber(A)
    },
    this.balances = async () => {
        let balanceArr = new Array(poolParam[curvePoolSymbol].CURRENCY_NUMBER().toNumber()).fill(new BigNumber(0))
        for (let i = 0; i < poolParam[curvePoolSymbol].CURRENCY_NUMBER().toNumber(); i++) {
            balanceArr[i] = new BigNumber(await this.curvePoolInstance.methods.balances(i).call({}, blockNumber))
        }
        return balanceArr
    },
    this.admin_balances = async () => {
        let adminFeeArr = new Array(poolParam[curvePoolSymbol].CURRENCY_NUMBER().toNumber()).fill(new BigNumber(0))
        for (let i = 0; i < poolParam[curvePoolSymbol].CURRENCY_NUMBER().toNumber(); i++) {
            adminFeeArr[i] = new BigNumber(await this.curvePoolInstance.methods.admin_balances(i).call({}, blockNumber))
        }
        return adminFeeArr
    },
    this.tokens = async () => {
        let totalSupply = await this.curvePoolCrvInstance.methods.totalSupply().call({}, blockNumber)
        return new BigNumber(totalSupply)
    }
}

function ContractView(curvePoolSymbol, blockNumber) {
    this.curvePoolInstance = poolParam[curvePoolSymbol].curvePoolInstance(),
    this.curvePoolCrvInstance = poolParam[curvePoolSymbol].curvePoolCrvInstance(),
    this.dy = async (inIndex, outIndex, dx) => {
        let dy = await this.curvePoolInstance.methods.get_dy(inIndex, outIndex, dx).call({}, blockNumber)
        return new BigNumber(dy)
    },
    this.totalSupply = async () => {
        let totalSupply = await this.curvePoolCrvInstance.methods.totalSupply().call({}, blockNumber)
        return new BigNumber(totalSupply)
    },
    this.virtualPrice = async () => {
        let virtualPrice = await this.curvePoolInstance.methods.get_virtual_price().call({}, blockNumber)
        return new BigNumber(virtualPrice)
    },
    this.calcWithdrawOneCoin = async (poolTokenAmount, outIndex) => {
        let tokenAmount = await this.curvePoolInstance.methods.calc_withdraw_one_coin(poolTokenAmount, outIndex).call({}, blockNumber)
        return new BigNumber(tokenAmount)
    },
    this.calcTokenAmount = async (tokenAmounts, isDeposit) => {
        let poolTokenAmount = await this.curvePoolInstance.methods.calc_token_amount(tokenAmounts.map((value) => value.toString()), isDeposit).call({}, blockNumber)
        return new BigNumber(poolTokenAmount)
    }
}

function ContractTrx(curvePoolSymbol) {
    // note that we can hardly run trx at specific block number like call function, so we need to set fork param to status we want to test before run test suites
    this.sender = accounts[0],
    this.poolParam = poolParam[curvePoolSymbol],
    this.curvePoolInstance = this.poolParam.curvePoolInstance(),
    this.exchange = async (inIndex, outIndex, inAmount) => {
        return await timeMachine.sendAndRollback(async () => {
            await AccountUtils.giveERC20Token(this.poolParam.POOL_TOKEN[inIndex], this.sender, inAmount)
            await AccountUtils.doApprove(this.poolParam.POOL_TOKEN[inIndex], this.sender, this.poolParam.curvePoolAddress, inAmount)
            let outTokenAmountBefore = await AccountUtils.balanceOfERC20Token(this.poolParam.POOL_TOKEN[outIndex], this.sender)
            await this.curvePoolInstance.methods.exchange(inIndex, outIndex, inAmount.toString(), 0).send({ from: this.sender, gas: 500000 })
            let outTokenAmountAfter = await AccountUtils.balanceOfERC20Token(this.poolParam.POOL_TOKEN[outIndex], this.sender)
            return new BigNumber(outTokenAmountAfter).sub(new BigNumber(outTokenAmountBefore))
        })
    },
    this.addLiquidity = async (tokenAmounts) => {
        return await timeMachine.sendAndRollback(async () => {
            for (let index in tokenAmounts) {
                if (BNUtils.isPositive(tokenAmounts[index])) {
                    await AccountUtils.giveERC20Token(this.poolParam.POOL_TOKEN[index], this.sender, tokenAmounts[index])
                    await AccountUtils.doApprove(this.poolParam.POOL_TOKEN[index], this.sender, this.poolParam.curvePoolAddress, tokenAmounts[index])
                }
            }
            let poolTokenAmountBefore = await AccountUtils.balanceOfERC20Token(this.poolParam.LP_TOKEN, this.sender)
            await this.curvePoolInstance.methods.add_liquidity(tokenAmounts.map((value) => value.toString()), 0).send({ from: this.sender, gas: 500000 })
            let poolTokenAmountAfter = await AccountUtils.balanceOfERC20Token(this.poolParam.LP_TOKEN, this.sender)
            return new BigNumber(poolTokenAmountAfter).sub(new BigNumber(poolTokenAmountBefore))
        })
    }
}

const curvePool = {
    _3pool: {
        param: poolParam._3pool,
        input: {
            atBlock: function (number) {
                return new ContractStatus('_3pool', number);
            }
        },
        view: {
            atBlock: function (number) {
                return new ContractView('_3pool', number);
            }
        },
        trx: {
            latest: function () {
                return new ContractTrx('_3pool');
            }
        }
    },
    hbtc: {
        param: poolParam.hbtc,
        input: {
            atBlock: function (number) {
                return new ContractStatus('hbtc', number);
            }
        },
        view: {
            atBlock: function (number) {
                return new ContractView('hbtc', number);
            }
        },
        trx: {
            latest: function () {
                return new ContractTrx('hbtc');
            }
        }
    }
}

module.exports = curvePool
