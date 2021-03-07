const BigNumber = require('bn.js')
const curve3crv = require('../abi/3CRV.js')
const curve3pool = require('../abi/3Pool.js')
const curveHbtcPool = require('../abi/hbtcPool.js')
const curveHCRV = require('../abi/hCRV.js')
const curveBusdPool = require('../abi/busdPool.js')
const curveBusdPoolDeposit = require('../abi/busdPoolDeposit.js')
const curveBCRV = require('../abi/bCRV.js')

const yToken = require('../abi/yToken.js')
const BNUtils = require("../utils/BNUtils.js")
const AccountUtils = require("../utils/AccountUtils.js")
const timeMachine = require("../utils/TimeMachine.js")
const tokenAddress = require('./Token.js')

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
        curveGaugeAddress: '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A',
        curvePoolAddress: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
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
        curveGaugeAddress: '0x4c18E409Dc8619bFb6a1cB56D114C3f592E0aE79',
        curvePoolAddress: '0x4CA9b3063Ec5866A4B82E437059D2C43d1be596F',
        curvePoolCrvAddress: tokenAddress.hCRV.token,
        curvePoolInstance: function () {
            return new web3.eth.Contract(curveHbtcPool.abiArray, this.curvePoolAddress)
        },
        curvePoolCrvInstance: function () {
            return new web3.eth.Contract(curveHCRV.abiArray, this.curvePoolCrvAddress)
        }
    },
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
        UNDERLYING_POOL_TOKEN: {
            0: 'DAI',
            1: 'USDC',
            2: 'USDT',
            3: 'BUSD',
            findIndex: function (tokenSymbol, compare = (a, b) => a === b) {
                return Object.keys(this).find(k => compare(this[k], tokenSymbol))
            }
        },
        LP_TOKEN: 'bCRV',
        CURRENCY_NUMBER: () => new BigNumber(4),
        CURRENCY_RATES: function () {
            return function (CURRENCY_NUMBER, PRECISION_MUL, yTokenInstance) {
                return async function () {
                    let rates = PRECISION_MUL.slice(0)
                    for (let index = 0; index < CURRENCY_NUMBER.toNumber(); index++) {
                        rates[index].imul(new BigNumber(await yTokenInstance(index).methods.getPricePerFullShare().call({}, 'latest')))
                    }
                    return rates
                }
            }(this.CURRENCY_NUMBER(), this.PRECISION_MUL(), this.yTokenInstance())
        },
        EXCHANGE_FEE: () => BNUtils.mul10pow(new BigNumber(4), 6), // 0.04%
        ADMIN_FEE: () => BNUtils.mul10pow(new BigNumber(50), 8), // 50% of EXCHANGE_FEE
        PRECISION: () => BNUtils.get10pow(18), //The precision to convert to 
        FEE_DENOMINATOR: () => BNUtils.get10pow(10),
        PRECISION_MUL: () => [new BigNumber(1), BNUtils.get10pow(12), BNUtils.get10pow(12), new BigNumber(1)],
        curveGaugeAddress: '0x69Fb7c45726cfE2baDeE8317005d3F94bE838840',
        curvePoolAddress: '0x79a8C46DeA5aDa233ABaFFD40F3A0A2B1e5A4F27',
        curvePoolDepositAddress: '0xb6c057591E073249F2D9D88Ba59a46CFC9B59EdB',
        curvePoolCrvAddress: tokenAddress.bCRV.token,
        curvePoolInstance: function () {
            return new web3.eth.Contract(curveBusdPool.abiArray, this.curvePoolAddress)
        },
        curvePoolDepositInstance: function () {
            return new web3.eth.Contract(curveBusdPoolDeposit.abiArray, this.curvePoolDepositAddress)
        },
        curvePoolCrvInstance: function () {
            return new web3.eth.Contract(curveBCRV.abiArray, this.curvePoolCrvAddress)
        },
        yTokenAddress: {
            0: tokenAddress.yDAI.token,
            1: tokenAddress.yUSDC.token,
            2: tokenAddress.yUSDT.token,
            3: tokenAddress.yBUSD.token,
            findIndex: function (tokenSymbol, compare = (a, b) => a === b) {
                return Object.keys(this).find(k => compare(this[k], tokenSymbol))
            }
        },
        underlyingTokenAddress: {
            0: tokenAddress.DAI.token,
            1: tokenAddress.USDC.token,
            2: tokenAddress.USDT.token,
            3: tokenAddress.BUSD.token,
            findIndex: function (tokenSymbol, compare = (a, b) => a === b) {
                return Object.keys(this).find(k => compare(this[k], tokenSymbol))
            }
        },
        yTokenInstance: function () {
            return function (yTokenAddress) {
                return function (index) {
                    return new web3.eth.Contract(yToken.abiArray, yTokenAddress[index])
                }
            }(this.yTokenAddress)
        },
        deposit: function () {
            return function (POOL_TOKEN, UNDERLYING_POOL_TOKEN, yTokenAddress, yTokenInstance) {
                return async function (index, tokenAmount) {
                    let sender = accounts[0]
                    await AccountUtils.giveERC20Token(UNDERLYING_POOL_TOKEN[index], sender, tokenAmount)
                    await AccountUtils.doApprove(UNDERLYING_POOL_TOKEN[index], sender, yTokenAddress[index], tokenAmount)
                    let yTokenAmountBefore = await AccountUtils.balanceOfERC20Token(POOL_TOKEN[index], sender)
                    await yTokenInstance(index).methods.deposit(tokenAmount).send({ from: sender, gas: 500000 })
                    let yTokenAmountAfter = await AccountUtils.balanceOfERC20Token(POOL_TOKEN[index], sender)
                    return new BigNumber(yTokenAmountAfter).sub(new BigNumber(yTokenAmountBefore))
                }
            }(this.POOL_TOKEN, this.UNDERLYING_POOL_TOKEN, this.yTokenAddress, this.yTokenInstance())
        },
        withdraw: function () {
            return function (POOL_TOKEN, UNDERLYING_POOL_TOKEN, yTokenInstance) {
                return async function (index, yTokenAmount) {
                    let sender = accounts[0]
                    await AccountUtils.giveERC20Token(POOL_TOKEN[index], sender, yTokenAmount)
                    let tokenAmountBefore = await AccountUtils.balanceOfERC20Token(UNDERLYING_POOL_TOKEN[index], sender)
                    await yTokenInstance(index).methods.withdraw(yTokenAmount).send({ from: sender, gas: 500000 })
                    let tokenAmountAfter = await AccountUtils.balanceOfERC20Token(UNDERLYING_POOL_TOKEN[index], sender)
                    return new BigNumber(tokenAmountAfter).sub(new BigNumber(tokenAmountBefore))
                }
            }(this.POOL_TOKEN, this.UNDERLYING_POOL_TOKEN, this.yTokenInstance())
        },
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
            let balances = await this.balances()
            for (let i = 0; i < poolParam[curvePoolSymbol].CURRENCY_NUMBER().toNumber(); i++) {
                adminFeeArr[i] = (await AccountUtils.balanceOfERC20Token(poolParam[curvePoolSymbol].POOL_TOKEN[i], poolParam[curvePoolSymbol].curvePoolAddress)).sub(balances[i])
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

function YPoolContractTrx(curvePoolSymbol) {
    ContractTrx.call(this, curvePoolSymbol)
    this.curvePoolDepositInstance = this.poolParam.curvePoolDepositInstance(),
        this.exchangeUnderlying = async (inIndex, outIndex, inAmount) => {
            return await timeMachine.sendAndRollback(async () => {
                await AccountUtils.giveERC20Token(this.poolParam.UNDERLYING_POOL_TOKEN[inIndex], this.sender, inAmount)
                await AccountUtils.doApprove(this.poolParam.UNDERLYING_POOL_TOKEN[inIndex], this.sender, this.poolParam.curvePoolAddress, inAmount)
                let outTokenAmountBefore = await AccountUtils.balanceOfERC20Token(this.poolParam.UNDERLYING_POOL_TOKEN[outIndex], this.sender)
                await this.curvePoolInstance.methods.exchange_underlying(inIndex, outIndex, inAmount.toString(), 0).send({ from: this.sender, gas: 5000000 })
                let outTokenAmountAfter = await AccountUtils.balanceOfERC20Token(this.poolParam.UNDERLYING_POOL_TOKEN[outIndex], this.sender)
                return new BigNumber(outTokenAmountAfter).sub(new BigNumber(outTokenAmountBefore))
            })
        },
        this.addLiquidityUnderlying = async (uamounts) => {
            return await timeMachine.sendAndRollback(async () => {
                for (let index in uamounts) {
                    if (BNUtils.isPositive(uamounts[index])) {
                        await AccountUtils.giveERC20Token(this.poolParam.UNDERLYING_POOL_TOKEN[index], this.sender, uamounts[index])
                        await AccountUtils.doApprove(this.poolParam.UNDERLYING_POOL_TOKEN[index], this.sender, this.poolParam.curvePoolDepositAddress, uamounts[index])
                    }
                }
                let lpTokenAmountBefore = await AccountUtils.balanceOfERC20Token(this.poolParam.LP_TOKEN, this.sender)
                await this.curvePoolDepositInstance.methods.add_liquidity(uamounts.map((value) => value.toString()), 0).send({ from: this.sender, gas: 5000000 })
                let lpTokenAmountAfter = await AccountUtils.balanceOfERC20Token(this.poolParam.LP_TOKEN, this.sender)
                return new BigNumber(lpTokenAmountAfter).sub(new BigNumber(lpTokenAmountBefore))
            })
        },
        this.removeLiquidityOneCoinUnderlying = async (lpTokenAmount, index) => {
            return await timeMachine.sendAndRollback(async () => {
                await AccountUtils.giveERC20Token(this.poolParam.LP_TOKEN, this.sender, lpTokenAmount)
                await AccountUtils.doApprove(this.poolParam.LP_TOKEN, this.sender, this.poolParam.curvePoolDepositAddress, 0)
                await AccountUtils.doApprove(this.poolParam.LP_TOKEN, this.sender, this.poolParam.curvePoolDepositAddress, lpTokenAmount)
                let uAmountBefore = await AccountUtils.balanceOfERC20Token(this.poolParam.UNDERLYING_POOL_TOKEN[index], this.sender)
                await this.curvePoolDepositInstance.methods.remove_liquidity_one_coin(lpTokenAmount.toString(), index, 0).send({ from: this.sender, gas: 5000000 })
                let uAmountAfter = await AccountUtils.balanceOfERC20Token(this.poolParam.UNDERLYING_POOL_TOKEN[index], this.sender)
                return new BigNumber(uAmountAfter).sub(new BigNumber(uAmountBefore))
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
    },
    busd: {
        param: poolParam.busd,
        input: {
            atBlock: function (number) {
                return new ContractStatus('busd', number);
            }
        },
        view: {
            atBlock: function (number) {
                return new ContractView('busd', number);
            }
        },
        trx: {
            latest: function () {
                return new YPoolContractTrx('busd');
            }
        }
    }
}

module.exports = curvePool
