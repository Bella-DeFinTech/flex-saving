const BigNumber = require('bn.js')
const BNUtils = require("../utils/BNUtils.js")
const curvePoolConstant = require('../const/CurvePool.js')

/**
 * Curve base Pool Emulator
 * @param {String} curvePoolSymbol - curve pool name like '_3pool'
 * @param {BigNumber} A - amplification coefficient
 * @param {BigNumber[]} balances - available token amount in pool
 * @param {BigNumber[]} admin_balances - cumulated admin fee array
 * @param {BigNumber} total_supply - total supply of pool token
 * 
 * @see https://github.com/curvefi/curve-contract/blob/master/contracts/pool-templates/base/SwapTemplateBase.vy
 */
function CurvePool(curvePoolSymbol, A, balances, admin_balances, total_supply) {
    this.curvePoolSymbol = curvePoolSymbol
    this.A = A // actually A * n ** (n - 1) because it's an invariant
    this.balances = balances
    this.admin_balances = admin_balances
    this.total_supply = total_supply
    // for extension by prototype
    if (curvePoolSymbol) {
        this.CURRENCY_NUMBER = curvePoolConstant[curvePoolSymbol].param.CURRENCY_NUMBER()
        this.CURRENCY_RATES = curvePoolConstant[curvePoolSymbol].param.CURRENCY_RATES()
        this.EXCHANGE_FEE = curvePoolConstant[curvePoolSymbol].param.EXCHANGE_FEE()
        this.ADMIN_FEE = curvePoolConstant[curvePoolSymbol].param.ADMIN_FEE()
        this.PRECISION = curvePoolConstant[curvePoolSymbol].param.PRECISION()
        this.FEE_DENOMINATOR = curvePoolConstant[curvePoolSymbol].param.FEE_DENOMINATOR()
        this.PRECISION_MUL = curvePoolConstant[curvePoolSymbol].param.PRECISION_MUL()
    }
}
//------------------------------------------internal----------------------------------------------
CurvePool.prototype.xp = function () {
    return this._xp(this.CURRENCY_RATES)
}

CurvePool.prototype._xp = function (rates) {
    return this.balances.map((value, index) => value.mul(rates[index]).div(this.PRECISION))
}

CurvePool.prototype.xp_mem = function (_balances) {
    return _balances.map((value, index) => value.mul(this.CURRENCY_RATES[index]).div(this.PRECISION))
}

// D invariant calculation in non-overflowing integer operations
// iteratively
// A * sum(x_i) * n**n + D = A * D * n**n + D**(n+1) / (n**n * prod(x_i))
// Converging solution:
// D[j+1] = (A * n**n * sum(x_i) - D[j]**(n+1) / (n**n prod(x_i))) / (A * n**n - 1)
CurvePool.prototype.D = function (xp) {
    let Dprev = new BigNumber(0)
    let S = BNUtils.sum(xp)
    if (S.isZero())
        return
    let D = S
    let Ann = this.A.mul(this.CURRENCY_NUMBER)
    // let count = 0
    while (D.sub(Dprev).abs().gtn(1)) {
        // count++
        let D_P = D
        xp.forEach(x => {
            D_P = D_P.mul(D).div(x.mul(this.CURRENCY_NUMBER))
        });
        Dprev = D
        D = (Ann.mul(S).add(D_P.mul(this.CURRENCY_NUMBER))).mul(D).div(Ann.subn(1).mul(D).add(D_P.mul(this.CURRENCY_NUMBER.addn(1))))
    }
    // console.log(count)
    return D
}

// Calculate x[j] if one makes x[i] = x
// Done by solving quadratic equation iteratively.
// x_1**2 + x1 * (sum' - (A*n**n - 1) * D / (A * n**n)) = D ** (n + 1) / (n ** (2 * n) * prod' * A)
// x_1**2 + b*x_1 = c
// x_1 = (x_1**2 + c) / (2*x_1 + b)
CurvePool.prototype.y = function (i, j, x) {
    return this._y(i, j, x, this.xp())
}

CurvePool.prototype._y = function (i, j, x, xp) {
    let D = this.D(xp)
    let xx = xp
    xx[i] = x  // x is quantity of underlying asset brought to 1e18 precision
    // xx = [xx[k] for k in range(this.n) if k != j]
    xx = xx.filter((_, index) => index != j)
    let Ann = this.A.mul(this.CURRENCY_NUMBER)
    let c = D
    xx.forEach((_x) => c = c.mul(D).div(_x.mul(this.CURRENCY_NUMBER)))
    c = c.mul(D).div(Ann.mul(this.CURRENCY_NUMBER))
    let b = BNUtils.sum(xx).add(D.div(Ann)).sub(D)
    let y_prev = new BigNumber(0)
    let y = D
    // let count = 0
    while (y.sub(y_prev).abs().gtn(1)) {
        // count++
        y_prev = y
        y = (y.pow(new BigNumber(2)).add(c)).div(y.muln(2).add(b))
    }
    // console.log(count)
    return y
}

// Calculate x[j] if one makes x[i] = x
// Done by solving quadratic equation iteratively.
// x_1**2 + x1 * (sum' - (A*n**n - 1) * D / (A * n**n)) = D ** (n + 1) / (n ** (2 * n) * prod' * A)
// x_1**2 + b*x_1 = c
// x_1 = (x_1**2 + c) / (2*x_1 + b)
CurvePool.prototype.y_D = function (i, xx, _D) {
    // xx = [xx[k] for k in range(this.n) if k != i]
    xx = xx.filter((_, index) => index != i)
    let S = BNUtils.sum(xx)
    let Ann = this.A.mul(this.CURRENCY_NUMBER)
    let c = _D
    xx.forEach((_x) => c = c.mul(_D).div(_x.mul(this.CURRENCY_NUMBER)))
    c = c.mul(_D).div(Ann.mul(this.CURRENCY_NUMBER))
    let b = _D.div(Ann).add(S)
    let y_prev = new BigNumber(0)
    let y = _D
    // let count = 0
    while (y.sub(y_prev).abs().gtn(1)) {
        // count++
        y_prev = y
        y = (y.pow(new BigNumber(2)).add(c)).div(y.muln(2).add(b).sub(_D))
    }
    // console.log(count)
    return y
}

CurvePool.prototype.dy = function (i, j, dx) {
    let xp = this.xp()
    let x = xp[i].add(dx.mul(this.CURRENCY_RATES[i]).div(this.PRECISION))
    let y = this.y(i, j, x)
    let dy = xp[j].sub(y).subn(1).mul(this.PRECISION).div(this.CURRENCY_RATES[j])
    let _fee = this.EXCHANGE_FEE.mul(dy).div(this.FEE_DENOMINATOR)
    return dy.sub(_fee)
}

CurvePool.prototype._calc_withdraw_one_coin = function (token_amount, i) {
    let xp = this.xp()
    let _fee = this.EXCHANGE_FEE.mul(this.CURRENCY_NUMBER).div(this.CURRENCY_NUMBER.subn(1).muln(4))
    let D0 = this.D(xp)
    let D1 = D0.sub(token_amount.mul(D0).div(this.total_supply))
    let precisions = this.PRECISION_MUL
    let xp_reduced = this.xp().slice(0)
    let new_y = this.y_D(i, xp, D1)
    let dy_0 = xp[i].sub(new_y).div(precisions[i])
    for (let j = 0; j < this.CURRENCY_NUMBER; j++) {
        let dx_expected = new BigNumber(0)
        if (j == i) {
            dx_expected = xp[j].mul(D1).div(D0).sub(new_y)
        }
        else {
            dx_expected = xp[j].sub(xp[j].mul(D1).div(D0))
        }
        xp_reduced[j] = xp_reduced[j].sub(_fee.mul(dx_expected).div(this.FEE_DENOMINATOR))
    }
    let dy = xp_reduced[i].sub(this.y_D(i, xp_reduced, D1))
    return [dy.subn(1).div(precisions[i]), dy_0.sub(dy)]
}

//------------------------------------------view----------------------------------------------
CurvePool.prototype.get_total_supply = function () {
    return this.total_supply
}

CurvePool.prototype.get_virtual_price = function () {
    return this.D(this.xp()).mul(this.PRECISION).div(this.total_supply)
}

CurvePool.prototype.calc_token_amount = function (token_amounts, is_deposit) {
    let new_balances = this.balances.slice(0)
    let D0 = this.D(this.xp())
    for (let i = 0; i < this.CURRENCY_NUMBER; i++) {
        if (is_deposit) {
            new_balances[i].iadd(token_amounts[i])
        } else {
            new_balances[i].isub(token_amounts[i])
        }
    }
    let D1 = this.D(this.xp_mem(new_balances))
    let difference = D1.sub(D0).abs()
    return difference.mul(this.total_supply).div(D0)
}

CurvePool.prototype.calc_withdraw_one_coin = function (pool_token_amount, i) {
    return this._calc_withdraw_one_coin(pool_token_amount, i)[0]
}

CurvePool.prototype.admin_balances = function () {
    return this.admin_balances
}

//------------------------------------------trx----------------------------------------------
CurvePool.prototype.exchange = function (in_index, out_index, in_token_amount) {
    // we assume no unexpected charge of a fee on transfer (USDT, PAXG)
    let xp = this.xp()
    let x = xp[in_index].add(in_token_amount.mul(this.CURRENCY_RATES[in_index]).div(this.PRECISION))
    let y = this.y(in_index, out_index, x)
    let dy = xp[out_index].sub(y).subn(1) // -1 just in case there were some rounding errors
    let fee = dy.mul(this.EXCHANGE_FEE).div(this.FEE_DENOMINATOR)
    dy = dy.sub(fee).mul(this.PRECISION).div(this.CURRENCY_RATES[out_index])
    // assert dy >= min_dy, "Exchange resulted in fewer coins than expected"
    // assert dy > 0
    let dy_admin_fee = fee.mul(this.ADMIN_FEE).div(this.FEE_DENOMINATOR)
    dy_admin_fee = dy_admin_fee.mul(this.PRECISION).div(this.CURRENCY_RATES[out_index])
    this.balances[in_index] = this.balances[in_index].add(in_token_amount)
    this.balances[out_index] = this.balances[out_index].sub(dy).sub(dy_admin_fee)
    return dy
}

CurvePool.prototype.add_liquidity = function (in_token_amounts) {
    let _fee = this.EXCHANGE_FEE.mul(this.CURRENCY_NUMBER).div(this.CURRENCY_NUMBER.subn(1).muln(4))
    let fees = new Array(this.CURRENCY_NUMBER.toNumber()).fill(new BigNumber(0))
    let old_balances = this.balances
    let new_balances = this.balances.slice(0)
    let D0 = this.total_supply.gtn(0) ? this.D(this.xp()) : new BigNumber(0)
    for (let i = 0; i < this.CURRENCY_NUMBER; i++) {
        let in_amount = in_token_amounts[i]
        // if token_supply == 0:
        //     assert in_amount > 0  // dev: initial deposit requires all coins
        new_balances[i] = old_balances[i].add(in_amount)
    }
    let D1 = this.D(this.xp_mem(new_balances))
    // assert D1 > D0
    let D2 = D1
    if (this.total_supply.gtn(0)) {
        for (let i = 0; i < this.CURRENCY_NUMBER; i++) {
            let ideal_balance = D1.mul(old_balances[i]).div(D0)
            let difference = ideal_balance.sub(new_balances[i]).abs()
            fees[i] = _fee.mul(difference).div(this.FEE_DENOMINATOR)
            this.balances[i] = new_balances[i].sub(fees[i].mul(this.ADMIN_FEE).div(this.FEE_DENOMINATOR))
            new_balances[i] = new_balances[i].sub(fees[i])
        }
        D2 = this.D(this.xp_mem(new_balances))
    } else (
        this.balances = new_balances
    )
    let mint_amount = this.total_supply.isZero() ? D1 : this.total_supply.mul(D2.sub(D0)).div(D0)
    // assert mint_amount >= min_mint_amount, "Slippage screwed you"
    this.mint_token(mint_amount)
    return mint_amount
}

CurvePool.prototype.remove_liquidity = function (pool_token_amount) {
    let amounts = new Array(this.CURRENCY_NUMBER.toNumber()).fill(new BigNumber(0))
    for (let i = 0; i < this.CURRENCY_NUMBER; i++) {
        amounts[i] = this.balances[i] * pool_token_amount / this.total_supply
        this.balances[i].isub(amounts[i])
    }
    this.burn_token(pool_token_amount)
    return amounts
}

CurvePool.prototype.remove_liquidity_one_coin = function (pool_token_amount, i) {
    let [dy, dy_fee] = this._calc_withdraw_one_coin(pool_token_amount, i)
    // assert dy >= min_amount, "Not enough coins removed"
    this.balances[i].isub(dy.add(dy_fee.mul(this.ADMIN_FEE).div(this.FEE_DENOMINATOR)))
    this.burn_token(pool_token_amount)
    return dy
}

CurvePool.prototype.remove_liquidity_imbalance = function (token_amounts) {
    let _fee = this.EXCHANGE_FEE.mul(this.CURRENCY_NUMBER).div(this.CURRENCY_NUMBER.subn(1).muln(4))
    let fees = new Array(this.CURRENCY_NUMBER.toNumber()).fill(new BigNumber(0))
    let old_balances = this.balances
    let new_balances = this.balances.slice(0)
    let D0 = this.D(this.xp())
    for (let i = 0; i < this.CURRENCY_NUMBER; i++)
        new_balances[i] = new_balances[i].sub(token_amounts[i])
    let D1 = this.D(this.xp_mem(new_balances))
    let ideal_balance
    for (let i = 0; i < this.CURRENCY_NUMBER; i++) {
        ideal_balance = D1.mul(old_balances[i]).div(D0)
        let difference = ideal_balance.sub(new_balances[i]).abs()
        fees[i] = _fee.mul(difference).div(this.FEE_DENOMINATOR)
        this.balances[i] = new_balances[i].sub(fees[i].mul(this.ADMIN_FEE).div(this.FEE_DENOMINATOR))
        new_balances[i] = new_balances[i].sub(fees[i])
    }
    D2 = this.D(this.xp_mem(new_balances))
    let token_amount = D0.sub(D2).mul(this.total_supply).div(D0)
    token_amount = token_amount.addn(1) // In case of rounding errors - make it unfavorable for the "attacker"
    // assert token_amount <= max_burn_amount, "Slippage screwed you"
    this.burn_token(token_amount)
    return token_amount
}

CurvePool.prototype.mint_token = function (pool_token_amount) {
    this.total_supply.iadd(pool_token_amount)
}

CurvePool.prototype.burn_token = function (pool_token_amount) {
    this.total_supply.isub(pool_token_amount)
}

module.exports = CurvePool
