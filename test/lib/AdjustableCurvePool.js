const CurvePool = require("./CurvePool.js")

function AdjustableCurvePool(curvePoolSymbol, A, balances, admin_balances, total_supply) {
    CurvePool.call(this, curvePoolSymbol, A, balances, admin_balances, total_supply)
    this.snaps = []
}

AdjustableCurvePool.prototype = new CurvePool()

AdjustableCurvePool.prototype.snapshot = function () {
    const curvePoolSymbol = this.curvePoolSymbol
    const A = this.A.clone()
    const total_supply = this.total_supply.clone()
    const balances = this.balances.map((value) => value.clone())
    const admin_balances = this.admin_balances.map((value) => value.clone())
    const snapshot = new AdjustableCurvePool(curvePoolSymbol, A, balances, admin_balances, total_supply)
    return this.snaps.push(snapshot)
}

AdjustableCurvePool.prototype.revert = function (snapshotId) {
    let snapshot = this.snaps[snapshotId - 1]
    this.A = snapshot.A
    this.balances = snapshot.balances
    this.admin_balances = snapshot.admin_balances
    this.total_supply = snapshot.total_supply
}

module.exports = AdjustableCurvePool
