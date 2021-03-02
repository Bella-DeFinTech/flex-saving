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
        await this.deposit(in_index, in_token_amount)
        // y-tokens calculate imprecisely - use all available
        await this.withdraw(out_index, out_y_token_amount)
        return out_token_amount
    })
}

// CurvePool.prototype.add_liquidity_underlying = function (uamounts) {
//     let amounts = new Array(this.CURRENCY_NUMBER.toNumber()).fill(new BigNumber(0))

//     for i in range(N_COINS):
//         uamount: uint256 = uamounts[i]

//     if uamount > 0:
//             # Transfer the underlying coin from owner
//     if tethered[i]:
//         USDT(self.underlying_coins[i]).transferFrom(
//             msg.sender, self, uamount)
//     else:
//     assert_modifiable(ERC20(self.underlying_coins[i]) \
//                     .transferFrom(msg.sender, self, uamount))

//             # Mint if needed
//             ERC20(self.underlying_coins[i]).approve(self.coins[i], uamount)
//     yERC20(self.coins[i]).deposit(uamount)
//     amounts[i] = yERC20(self.coins[i]).balanceOf(self)
//     ERC20(self.coins[i]).approve(self.curve, amounts[i])

//     Curve(self.curve).add_liquidity(amounts, min_mint_amount)

//     tokens: uint256 = ERC20(self.token).balanceOf(self)
//     assert_modifiable(ERC20(self.token).transfer(msg.sender, tokens))
// }

CurvePool.prototype.remove_liquidity_underlying = function (lp_token_amount) {
    let amounts = this.remove_liquidity(lp_token_amount)
    for (let i = 0; i < this.CURRENCY_NUMBER; i++) {
        this.withdraw(i, amounts[i])
    }
}

// Get max_burn_amount in, remove requested liquidity and transfer back what is left
// CurvePool.prototype.remove_liquidity_imbalance_underlying = function (uamounts) {
//     tethered: bool[N_COINS] = TETHERED
//     _token: address = self.token

//     amounts: uint256[N_COINS] = uamounts
//     for i in range(N_COINS):
//         if amounts[i] > 0:
//             rate: uint256 = yERC20(self.coins[i]).getPricePerFullShare()
//     amounts[i] = amounts[i] * LENDING_PRECISION / rate

//     # Transfrer max tokens in
//         _tokens: uint256 = ERC20(_token).balanceOf(msg.sender)
//     if _tokens > max_burn_amount:
//         _tokens = max_burn_amount
//     assert_modifiable(ERC20(_token).transferFrom(msg.sender, self, _tokens))

//     Curve(self.curve).remove_liquidity_imbalance(amounts, max_burn_amount)

//     //  Transfer unused tokens back
//     _tokens = ERC20(_token).balanceOf(self)
//     assert_modifiable(ERC20(_token).transfer(msg.sender, _tokens))

//     //  Unwrap and transfer all the coins we've got
//     self._send_all(msg.sender, ZEROS, -1)
// }

// Remove _amount of liquidity all in a form of coin i
CurvePool.prototype.remove_liquidity_one_coin_underlying = function (lp_token_amount, index) {
    let rates = this.yTokenRates
    let dy = this._calc_withdraw_one_underlying_coin(lp_token_amount, index, rates)
    let amounts = new Array(this.CURRENCY_NUMBER.toNumber()).fill(new BigNumber(0))
    //LENDING_PRECISION?
    amounts[index] = dy.mul(this.PRECISION).div(rates[index])
    this.remove_liquidity_imbalance(amounts)
    let uTokenAmount = await this.withdraw(index, amounts[index])
    return uTokenAmount
}

// CurvePool.prototype._calc_withdraw_one_coin_underlying = function (lp_token_amount, index, rates) {
//     // # First, need to calculate
//     // # * Get current D
//     // # * Solve Eqn against y_i for D - lp_token_amount
//     crv: address = self.curve
//     A: uint256 = Curve(crv).A()
//     fee: uint256 = Curve(crv).fee() * N_COINS / (4 * (N_COINS - 1))
//     fee += fee * FEE_IMPRECISION / FEE_DENOMINATOR  # Overcharge to account for imprecision
//     precisions: uint256[N_COINS] = PRECISION_MUL
//     total_supply: uint256 = ERC20(self.token).totalSupply()

//     xp: uint256[N_COINS] = PRECISION_MUL
//     S: uint256 = 0
//     for j in range(N_COINS):
//         xp[j] *= Curve(crv).balances(j)
//     xp[j] = xp[j] * rates[j] / LENDING_PRECISION
//     S += xp[j]

//     D0: uint256 = self.get_D(A, xp)
//     D1: uint256 = D0 - lp_token_amount * D0 / total_supply
//     xp_reduced: uint256[N_COINS] = xp

//     //  xp = xp - fee * | xp * D1 / D0 - (xp - S * dD / D0 * (0, ... 1, ..0))|
//     for j in range(N_COINS):
//         dx_expected: uint256 = 0
//     b_ideal: uint256 = xp[j] * D1 / D0
//     b_expected: uint256 = xp[j]
//     if j == i:
//         b_expected -= S * (D0 - D1) / D0
//     if b_ideal >= b_expected:
//         dx_expected += (b_ideal - b_expected)
//     else:
//     dx_expected += (b_expected - b_ideal)
//     xp_reduced[j] -= fee * dx_expected / FEE_DENOMINATOR

//     dy: uint256 = xp_reduced[i] - self.get_y(A, i, xp_reduced, D1)
//     dy = dy / precisions[i]

//     return dy
// }

CurvePool.prototype.calc_withdraw_one_coin_underlying = function (lp_token_amount, index) {
    let rates = this.yTokenRates
    return this._calc_withdraw_one_coin_underlying(lp_token_amount, index, rates)
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