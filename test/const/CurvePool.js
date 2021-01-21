const BigNumber = require('bn.js');
const curve3crv = require('../abi/3crv.js');
const curve3pool = require('../abi/3pool.js');
const BNUtils = require("../utils/BNUtils.js");
const AccountUtils = require("../utils/AccountUtils.js");
const timeMachine = require("../utils/TimeMachine.js")
const tokenAddress = require('./Token.js');

const curve3poolAddress = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7'
const curve3crvAddress = tokenAddress._3CRV.token
const curve3poolInstance = new web3.eth.Contract(curve3pool.abiArray, curve3poolAddress);
const curve3crvInstance = new web3.eth.Contract(curve3crv.abiArray, curve3crvAddress);

const poolParam = {
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
    PRECISION_MUL: () => [new BigNumber(1), BNUtils.get10pow(12), BNUtils.get10pow(12)]
}

function ContractStatus(blockNumber) {
    this.A = async () => {
        let A = await curve3poolInstance.methods.A().call({}, blockNumber)
        return new BigNumber(A)
    },
    this.balances = async () => {
        let DAIAmount = await curve3poolInstance.methods.balances(0).call({}, blockNumber)
        let USDCAmount = await curve3poolInstance.methods.balances(1).call({}, blockNumber)
        let USDTAmount = await curve3poolInstance.methods.balances(2).call({}, blockNumber)
        return [new BigNumber(DAIAmount), new BigNumber(USDCAmount), new BigNumber(USDTAmount)]
    },
    this.admin_balances = async () => {
        let DAIAdminFee = await curve3poolInstance.methods.admin_balances(0).call({}, blockNumber)
        let USDCAdminFee = await curve3poolInstance.methods.admin_balances(1).call({}, blockNumber)
        let USDTAdminFee = await curve3poolInstance.methods.admin_balances(2).call({}, blockNumber)
        return [new BigNumber(DAIAdminFee), new BigNumber(USDCAdminFee), new BigNumber(USDTAdminFee)]
    },
    this.tokens = async () => {
        let totalSupply = await curve3crvInstance.methods.totalSupply().call({}, blockNumber)
        return new BigNumber(totalSupply)
    }
}

function ContractView(blockNumber) {
    this.dy = async (inIndex, outIndex, dx) => {
        let dy = await curve3poolInstance.methods.get_dy(inIndex, outIndex, dx).call({}, blockNumber)
        return new BigNumber(dy)
    },
    this.totalSupply = async () => {
        let totalSupply = await curve3crvInstance.methods.totalSupply().call({}, blockNumber)
        return new BigNumber(totalSupply)
    },
    this.virtualPrice = async () => {
        let virtualPrice = await curve3poolInstance.methods.get_virtual_price().call({}, blockNumber)
        return new BigNumber(virtualPrice)
    },
    this.calcWithdrawOneCoin = async (poolTokenAmount, outIndex) => {
        let tokenAmount = await curve3poolInstance.methods.calc_withdraw_one_coin(poolTokenAmount, outIndex).call({}, blockNumber)
        return new BigNumber(tokenAmount)
    },
    this.calcTokenAmount = async (tokenAmounts, isDeposit) => {
        let poolTokenAmount = await curve3poolInstance.methods.calc_token_amount(tokenAmounts.map((value) => value.toString()), isDeposit).call({}, blockNumber)
        return new BigNumber(poolTokenAmount)
    }
}

function ContractTrx() {
    // note that we can hardly run trx at specific block number like call function, so we need to set fork param to status we want to test before run test suites
    const testSender = accounts[0]

    this.exchange = async (inIndex, outIndex, inAmount) => {
        return await timeMachine.sendAndRollback(async () => {
            await AccountUtils.giveERC20Token(poolParam.POOL_TOKEN[inIndex], testSender, inAmount)
            await AccountUtils.doApprove(poolParam.POOL_TOKEN[inIndex], testSender, curve3poolAddress, 0)
            await AccountUtils.doApprove(poolParam.POOL_TOKEN[inIndex], testSender, curve3poolAddress, inAmount)
            let outTokenAmountBefore = await AccountUtils.balanceOfERC20Token(poolParam.POOL_TOKEN[outIndex], testSender)
            await curve3poolInstance.methods.exchange(inIndex, outIndex, inAmount, 0).send({ from: testSender, gas: 500000 })
            let outTokenAmountAfter = await AccountUtils.balanceOfERC20Token(poolParam.POOL_TOKEN[outIndex], testSender)
            return new BigNumber(outTokenAmountAfter).sub(new BigNumber(outTokenAmountBefore))
        })
    },
    this.addLiquidity = async (tokenAmounts) => {
        return await timeMachine.sendAndRollback(async () => {
            for (let index in tokenAmounts) {
                if (BNUtils.isPositive(tokenAmounts[index])) {
                    await AccountUtils.giveERC20Token(poolParam.POOL_TOKEN[index], testSender, tokenAmounts[index])
                    await AccountUtils.doApprove(poolParam.POOL_TOKEN[index], testSender, curve3poolAddress, 0)
                    await AccountUtils.doApprove(poolParam.POOL_TOKEN[index], testSender, curve3poolAddress, tokenAmounts[index])
                }
            }
            let poolTokenAmountBefore = await AccountUtils.balanceOfERC20Token(poolParam.LP_TOKEN, testSender)
            await curve3poolInstance.methods.add_liquidity(tokenAmounts.map((value) => value.toString()), 0).send({ from: testSender, gas: 500000 })
            let poolTokenAmountAfter = await AccountUtils.balanceOfERC20Token(poolParam.LP_TOKEN, testSender)
            return new BigNumber(poolTokenAmountAfter).sub(new BigNumber(poolTokenAmountBefore))
        })
    }
}

var curvePool = {
    param: poolParam,
    input: {
        atBlock: function (number) {
            return new ContractStatus(number);
        }
    },
    view: {
        atBlock: function (number) {
            return new ContractView(number);
        }
    },
    trx: {
        latest: function () {
            return new ContractTrx();
        }
    }
};

module.exports = curvePool