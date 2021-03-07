const BigNumber = require('bn.js')
const BNUtils = require("../utils/BNUtils.js")
const CurvePool = require("./CurvePool.js")
const timeMachine = require("../utils/TimeMachine.js")

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
class CurveYPool extends CurvePool {
    constructor(curvePoolSymbol, A, balances, admin_balances, total_supply, currencyRatesFetcher, depositExecutor, withdrawExecutor) {
        super(curvePoolSymbol, A, balances, admin_balances, total_supply)
        this.deposit = depositExecutor
        this.withdraw = withdrawExecutor
        this.getCURRENCY_RATES = currencyRatesFetcher
        this.stashSnapshotId = -1
        this.FEE_IMPRECISION = BNUtils.mul10pow(new BigNumber(25), 8)
        return (async () => {
            this.CURRENCY_RATES = await this.getCURRENCY_RATES()
            let snapshot = await timeMachine.takeSnapshot()
            this.lastSnapshotId = snapshot['result']
            return this
        })()
    }
}

// deposit underlying、withdraw underlying、exchange underlying要先保存现在的snapshot、然后恢复到lastSnapshotId、做这次的操作、查rates、再恢复到保存的snapshot
CurveYPool.prototype._exchange = function (in_index, out_index, in_token_amount, rates) {
    // # in_token_amount and dy are in c-tokens
    let xp = this._xp(rates)
    let x = xp[in_index].add(in_token_amount.mul(rates[in_index]).div(this.PRECISION))
    let y = this._y(in_index, out_index, x, xp)
    let dy = xp[out_index].sub(y)
    let dy_fee = dy.mul(this.EXCHANGE_FEE).div(this.FEE_DENOMINATOR)
    let dy_admin_fee = dy_fee.mul(this.ADMIN_FEE).div(this.FEE_DENOMINATOR)
    this.balances[in_index] = x.mul(this.PRECISION).div(rates[in_index])
    this.balances[out_index] = y.add(dy_fee.sub(dy_admin_fee)).mul(this.PRECISION).div(rates[out_index])
    let _dy = dy.sub(dy_fee).mul(this.PRECISION).div(rates[out_index])
    return _dy
}

CurveYPool.prototype.exchange = function (in_index, out_index, in_y_token_amount) {
    let rates = this.CURRENCY_RATES
    let out_y_token_amount = this._exchange(in_index, out_index, in_y_token_amount, rates)
    // assert dy >= min_dy, "Exchange resulted in fewer coins than expected".
    return out_y_token_amount
}

CurveYPool.prototype.exchange_underlying = async function (in_index, out_index, in_token_amount) {
    return await this.doAndRollback(async () => {
        // we assume no unexpected charge of a fee on transfer (USDT, PAXG)
        let rates = this.CURRENCY_RATES
        let rate_in_index = rates[in_index].div(this.PRECISION_MUL[in_index])
        let rate_out_index = rates[out_index].div(this.PRECISION_MUL[out_index])
        let in_y_token_amount = in_token_amount.mul(this.PRECISION).div(rate_in_index)
        let out_y_token_amount = this._exchange(in_index, out_index, in_y_token_amount, rates)
        let out_token_amount = out_y_token_amount.mul(rate_out_index).div(this.PRECISION)
        // assert dy >= min_dy, "Exchange resulted in fewer coins than expected"
        // assert dy > 0
        await this.deposit(in_index, in_token_amount)
        // y-tokens calculate imprecisely - use all available
        await this.withdraw(out_index, out_y_token_amount)
        return out_token_amount
    })
}

CurveYPool.prototype.add_liquidity_underlying = async function (uamounts) {
    return await this.doAndRollback(async () => {
        let amounts = new Array(this.CURRENCY_NUMBER.toNumber()).fill(new BigNumber(0))
        for (let i = 0; i < this.CURRENCY_NUMBER.toNumber(); i++) {
            let uamount = uamounts[i]
            if (uamount.lten(0))
                continue
            amounts[i] = await this.deposit(i, uamount)
        }
        let lpTokenAmount = this.add_liquidity(amounts)
        return lpTokenAmount
    })
}

CurveYPool.prototype.remove_liquidity_underlying = async function (lp_token_amount) {
    return await this.doAndRollback(async () => {
        let uamounts = new Array(this.CURRENCY_NUMBER.toNumber()).fill(new BigNumber(0))
        let amounts = this.remove_liquidity(lp_token_amount)
        for (let i = 0; i < this.CURRENCY_NUMBER.toNumber(); i++) {
            if (amounts[i].lten(0))
                continue
            uamounts[i] = this.withdraw(i, amounts[i])
        }
        return uamounts
    })
}

// Get max_burn_amount in, remove requested liquidity and transfer back what is left
CurveYPool.prototype.remove_liquidity_imbalance_underlying = async function (uamounts) {
    return await this.doAndRollback(async () => {
        let amounts = new Array(this.CURRENCY_NUMBER.toNumber()).fill(new BigNumber(0))
        let rates = this.CURRENCY_RATES
        for (let i = 0; i < this.CURRENCY_NUMBER.toNumber(); i++) {
            let uamount = uamounts[i]
            if (uamount.lten(0))
                continue
            // LENDING_PRECISION?
            amounts[i] = uamount.mul(this.PRECISION).div(rates[index])
        }
        let lpTokenAmount = this.remove_liquidity_imbalance(amounts)
        //  Unwrap and transfer all the coins we've got
        for (let i = 0; i < this.CURRENCY_NUMBER.toNumber(); i++) {
            if (amounts[i].lten(0))
                continue
            await this.withdraw(i, amounts[i])
        }
        return lpTokenAmount
    })
}

// Remove _amount of liquidity all in a form of coin i
CurveYPool.prototype.remove_liquidity_one_coin_underlying = async function (lp_token_amount, index) {
    return await this.doAndRollback(async () => {
        let rates = this.CURRENCY_RATES
        let dy = this._calc_withdraw_one_coin_underlying(lp_token_amount, index, rates)
        let amounts = new Array(this.CURRENCY_NUMBER.toNumber()).fill(new BigNumber(0))
        //LENDING_PRECISION?
        amounts[index] = dy.mul(this.PRECISION).div(rates[index]).div(this.PRECISION_MUL[index])
        this.remove_liquidity_imbalance(amounts)
        let uTokenAmount = await this.withdraw(index, amounts[index])
        return uTokenAmount
    })
}

CurveYPool.prototype._calc_withdraw_one_coin_underlying = function (lp_token_amount, index, rates) {
    // # First, need to calculate
    // # * Get current D
    // # * Solve Eqn against y_i for D - lp_token_amount
    let fee = this.EXCHANGE_FEE.mul(this.CURRENCY_NUMBER).div(this.CURRENCY_NUMBER.subn(1).muln(4))
    fee = fee.add(fee.mul(this.FEE_IMPRECISION).div(this.FEE_DENOMINATOR))//  # Overcharge to account for imprecision
    let precisions = this.PRECISION_MUL
    let total_supply = this.get_total_supply()
    let xp = this.PRECISION_MUL.slice(0)
    let S = new BigNumber(0)
    for (let j = 0; j < this.CURRENCY_NUMBER.toNumber(); j++) {
        xp[j] = xp[j].mul(this.balances[j])
        // LENDING_PRECISION?
        xp[j] = xp[j].mul(rates[j]).div(this.PRECISION_MUL[j]).div(this.PRECISION)
        S = S.add(xp[j])
    }
    let D0 = this.D(xp)
    // console.log(D0.toString())
    let D1 = D0.sub(lp_token_amount.mul(D0).div(total_supply))
    // console.log(D1.toString())
    let xp_reduced = xp.slice(0)
    //  xp = xp - fee * | xp * D1 / D0 - (xp - S * dD / D0 * (0, ... 1, ..0))|
    for (let j = 0; j < this.CURRENCY_NUMBER.toNumber(); j++) {
        let dx_expected = new BigNumber(0)
        let b_ideal = xp[j].mul(D1).div(D0)
        let b_expected = new BigNumber(xp[j])
        if (j == index) {
            b_expected = b_expected.sub(S.mul(D0.sub(D1)).div(D0))
        }
        if (b_ideal.gte(b_expected)) {
            dx_expected.iadd(b_ideal.sub(b_expected))
        } else {
            dx_expected.iadd(b_expected.sub(b_ideal))
        }
        xp_reduced[j] = xp_reduced[j].sub(fee.mul(dx_expected).div(this.FEE_DENOMINATOR))
    }
    let dy = xp_reduced[index].sub(this.y_D(index, xp_reduced, D1))
    dy = dy.div(precisions[index])
    return dy
}

CurveYPool.prototype.calc_withdraw_one_coin_underlying = function (lp_token_amount, index) {
    let rates = this.CURRENCY_RATES
    return this._calc_withdraw_one_coin_underlying(lp_token_amount, index, rates)
}

CurveYPool.prototype.doAndRollback = async function (trx) {
    let snapshot
    snapshot = await timeMachine.takeSnapshot()
    this.stashSnapshotId = snapshot['result']
    await timeMachine.revertToSnapshot(this.lastSnapshotId)
    let res = await trx()
    this.CURRENCY_RATES = await this.getCURRENCY_RATES()
    snapshot = await timeMachine.takeSnapshot()
    this.lastSnapshotId = snapshot['result']
    await timeMachine.revertToSnapshot(this.stashSnapshotId)
    return res
}

CurveYPool.prototype = new CurvePool()

module.exports = CurveYPool