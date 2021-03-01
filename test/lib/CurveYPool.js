const BigNumber = require('bn.js');
const BNUtils = require("../utils/BNUtils.js");
const curvePoolConstant = require('../const/CurvePool.js');
const CurvePool = require("./CurvePool.js")
const timeMachine = require("./utils/TimeMachine.js")

/**
 * Curve yPool Emulator
 * @param {String} curvePoolSymbol - curve pool name like 'busd'
 * @param {BigNumber} A - amplification coefficient
 * @param {BigNumber[]} balances - available token amount in pool
 * @param {BigNumber[]} admin_balances - cumulated admin fee array
 * @param {BigNumber} total_supply - total supply of pool token
 * 
 * @see https://github.com/curvefi/curve-contract/blob/master/contracts/pool-templates/y/SwapTemplateY.vy
 * @see https://github.com/curvefi/curve-contract/blob/master/contracts/pool-templates/y/DepositTemplateY.vy
 */
function CurveYPool(curvePoolSymbol, A, balances, admin_balances, total_supply, currencyRatesFetcher, depositExecutor, withdrawExecutor) {
    CurvePool.call(this, curvePoolSymbol, A, balances, admin_balances, total_supply)
    this.deposit = depositExecutor
    this.withdraw = withdrawExecutor
    this.getYTokenRates = currencyRatesFetcher
    this.yTokenRates = await this.getYTokenRates()
    let snapshot = await timeMachine.takeSnapshot()
    this.lastSnapshotId = snapshot['result']
    this.stashSnapshotId = -1
    // this.replayYearnInteraction = YearnInteractionProjector
    // this.YearnInteractionMemo = []
}

// function YearnInteraction(tokenName, amount, isDeposit) {
//     this.tokenName = tokenName
//     this.amount = amount
//     this.isDeposit = isDeposit
// }

// deposit underlying、withdraw underlying、exchange underlying要先保存现在的snapshot、然后恢复到lastSnapshotId、做这次的操作、查rates、再恢复到保存的snapshot
CurvePool.prototype._exchange = function (in_index, out_index, in_token_amount, rates) {
    // # in_token_amount and dy are in c-tokens
    let xp = this._xp(rates)
    let x = xp[in_index].add(in_token_amount.mul(rates[in_index]).div(this.PRECISION))
    let y = this._y(in_index, out_index, x, xp)
    let dy = xp[out_index].sub(y)
    let dy_fee = dy.mul(this.EXCHANGE_FEE).div(this.FEE_DENOMINATOR)
    let dy_admin_fee = fee.mul(this.ADMIN_FEE).div(this.FEE_DENOMINATOR)
    this.balances[in_index] = x.mul(this.PRECISION).div(rates[i])
    this.balances[out_index] = y.add(dy_fee.sub(dy_admin_fee)).mul(this.PRECISION).div(rates[out_index])
    let _dy = dy.sub(dy_fee).mul(this.PRECISION).div(rates[out_index])
    return _dy
}

CurvePool.prototype.exchange = function (in_index, out_index, in_y_token_amount) {
    let rates = this.yTokenRates
    let out_y_token_amount = this._exchange(in_index, out_index, in_y_token_amount, rates)
    // assert dy >= min_dy, "Exchange resulted in fewer coins than expected".
    return out_y_token_amount
}

CurvePool.prototype.exchange_underlying = function (in_index, out_index, in_token_amount) {
    return await this.doAndRollback(async () => {
        // we assume no unexpected charge of a fee on transfer (USDT, PAXG)
        let rates = this.yTokenRates
        let rate_in_index = rates[in_index].div(this.PRECISION_MUL[i])
        let rate_out_index = rates[out_index].div(this.PRECISION_MUL[j])
        let in_y_token_amount = in_token_amount.mul(this.PRECISION).div(rate_in_index)
        let out_y_token_amount = this._exchange(in_index, out_index, in_y_token_amount, rates)
        let out_token_amount = out_y_token_amount.mul(rate_out_index).div(this.PRECISION)
        // assert dy >= min_dy, "Exchange resulted in fewer coins than expected"
        // assert dy > 0
        await this.deposit(in_token_amount)
        // y-tokens calculate imprecisely - use all available
        await this.withdraw(out_y_token_amount)
        return out_token_amount
    })
}

CurvePool.prototype.doAndRollback = function (trx) {
    let snapshot
    snapshot = await timeMachine.takeSnapshot()
    this.stashSnapshotId = snapshot['result']
    await timeMachine.revertToSnapshot(this.lastSnapshotId)
    await trx()
    this.yTokenRates = await this.getYTokenRates()
    snapshot = await timeMachine.takeSnapshot()
    this.lastSnapshotId = snapshot['result']
    await timeMachine.revertToSnapshot(this.stashSnapshotId)
}

CurveYPool.prototype = new CurvePool()

module.exports = CurveYPool