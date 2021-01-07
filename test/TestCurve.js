const BigNumber = require('bn.js');
const CurvePool = require("./lib/CurvePool.js");
const Utils = require("./utils/Utils.js");

// don't capture console
const console = require('console');

jest.setTimeout(300000);

// block #11553066
const A = new BigNumber(200)
const balances = [new BigNumber('49207411069167985957092526'), new BigNumber('75336433192389'), new BigNumber('105376210353127')]
const admin_balances = [new BigNumber('19417477913988179088561'), new BigNumber('21344641050'), new BigNumber('27649688613')]
const n = new BigNumber(3)
const p = [new BigNumber('1000000000000000000'), new BigNumber('1000000000000000000000000000000'), new BigNumber('1000000000000000000000000000000')]
const tokens = new BigNumber('228526126556750785648667813')

describe('Test Curve Stable Pool simulation views', () => {
    let curve
    beforeAll(() => {
        curve = new CurvePool(A, balances, admin_balances, n, p, tokens)
    })

    it('can get accurate dy', () => {
        let dx = new BigNumber('2000000000000000000')
        let dy = curve.dy(0, 1, dx)
        // console.log("dy: " + dy)
        Utils.assertBNEq(dy, '2005380')
    })

    it('can get accurate D', () => {
        let D = curve.D(curve.xp())
        // console.log("D: " + D)
        Utils.assertBNEq(D, '229862018725081085619906054')
    })

    it('can get accurate token total supply', () => {
        let total_supply = curve.get_total_supply()
        // console.log("total_supply: " + total_supply)
        Utils.assertBNEq(total_supply, '228526126556750785648667813')
    })

    it('can get accurate xp', () => {
        let xp = curve.xp()
        // console.log("xp: " + xp)
        Utils.assertBNEq(xp[0], '49207411069167985957092526')
        Utils.assertBNEq(xp[1], '75336433192389000000000000')
        Utils.assertBNEq(xp[2], '105376210353127000000000000')
    })

    it('can get accurate virtual price', () => {
        let virtual_price = curve.get_virtual_price()
        // console.log("virtual price: " + virtual_price)
        Utils.assertBNEq(virtual_price, '1005845686830028831')
    })

    it('can accurately calc_withdraw_one_coin', () => {
        let token_amount = new BigNumber('2000000000000000000')
        let dy = curve.calc_withdraw_one_coin(token_amount, 0)
        // console.log("calc_withdraw_one_coin: " + dy)
        Utils.assertBNEq(dy, '2005327161205174940')
    })

    it('can accurately calc_token_amount when deposit', () => {
        let token_amount = curve.calc_token_amount([new BigNumber('0'), new BigNumber('0'), new BigNumber('10000000000')], true)
        // console.log("calc_token_amount(deposit): " + token_amount)
        Utils.assertBNEq(token_amount, '9923859496363948495418')
    })
})

describe('Test Curve Stable Pool simulation trxs', () => {
    let curve
    beforeEach(() => {
        curve = new CurvePool(A, balances, admin_balances, n, p, tokens)
    })

    it('can accurately exchange', () => {
        let dx = new BigNumber('2000000000000000000')
        let dy = curve.exchange(0, 1, dx)
        // console.log("exchange: " + dy)
        Utils.assertBNEq(dy, '2005379')
    })

    //TODO
    it('can accurately remove_liquidity_imbalance', () => {
        // console.log("remove_liquidity_imbalance: " + curve.remove_liquidity_imbalance([new BigNumber('2000000000000000000'), new BigNumber(0), new BigNumber(0)]))
    })

    it('can accurately add_liquidity', () => {
        let token_amount = curve.add_liquidity([new BigNumber('0'), new BigNumber('0'), new BigNumber('10000000000')])
        console.log("add_liquidity: " + token_amount)
        Utils.assertBNEq(token_amount, '9922244691248228009139')
    })
})
