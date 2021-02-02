const BigNumber = require('bn.js');
const CurvePool = require("./lib/AdjustableCurvePool.js");
const AssertionUtils = require("./utils/AssertionUtils.js");
const BNUtils = require("./utils/BNUtils.js");
const curvePoolConstant = require('./const/CurvePool.js');
const tokenAddress = require('./const/Token.js')

// don't capture console
// const console = require('console');

jest.setTimeout(30 * 60 * 1000);

describe('Test Curve StableSwap 3Pool simulation views', curvePoolViewTestSuite('_3pool'))
describe('Test Curve StableSwap 3Pool simulation trxs', curvePoolTrxTestSuite('_3pool'))

describe('Test Curve StableSwap hbtcPool simulation views', curvePoolViewTestSuite('hbtc'))
describe('Test Curve StableSwap hbtcPool simulation trxs', curvePoolTrxTestSuite('hbtc'))

    function curvePoolViewTestSuite(curvePoolSymbol) {
        return () => {
            let curve
            let contractView = curvePoolConstant[curvePoolSymbol].view.atBlock('latest')
            let poolParam = curvePoolConstant[curvePoolSymbol].param
            beforeAll(async () => {
                const blockInput = curvePoolConstant[curvePoolSymbol].input.atBlock('latest')
                const A = await blockInput.A()
                const balances = await blockInput.balances()
                // console.log(balances.toString())
                const admin_balances = await blockInput.admin_balances()
                const tokens = await blockInput.tokens()
                curve = new CurvePool(curvePoolSymbol, A, balances, admin_balances, tokens)
            })

            it('can get accurate dy', async () => {
                let swapInPoolTokenIndex = 0
                let swapInPoolTokenSymbol = poolParam.POOL_TOKEN[swapInPoolTokenIndex]
                let swapInPoolTokenAmount = BNUtils.mul10pow(new BigNumber(2), tokenAddress[swapInPoolTokenSymbol].decimals)
                let swapOutPoolTokenIndex = 1
                let swapOutPoolTokenAmount = curve.dy(swapInPoolTokenIndex, swapOutPoolTokenIndex, swapInPoolTokenAmount)
                // console.log("dy: " + dy)
                let expectedSwapOutPoolTokenAmount = await contractView.dy(swapInPoolTokenIndex, swapOutPoolTokenIndex, swapInPoolTokenAmount)
                AssertionUtils.assertBNEq(swapOutPoolTokenAmount, expectedSwapOutPoolTokenAmount.toString())
            })

            it('can get accurate token total supply', async () => {
                let totalSupply = curve.get_total_supply()
                // console.log("total_supply: " + totalSupply)
                let expectedTotalSupply = await contractView.totalSupply()
                AssertionUtils.assertBNEq(totalSupply, expectedTotalSupply.toString())
            })

            it('can get accurate virtual price', async () => {
                let virtualPrice = curve.get_virtual_price()
                // console.log("virtual price: " + virtual_price)
                let expectedVirtualPrice = await contractView.virtualPrice()
                AssertionUtils.assertBNEq(virtualPrice, expectedVirtualPrice.toString())
            })

            it('can accurately calc_withdraw_one_coin', async () => {
                let poolTokenIndex = 0
                let lpTokenSymbol = poolParam.LP_TOKEN
                let lpTokenAmount = BNUtils.mul10pow(new BigNumber(2), tokenAddress[lpTokenSymbol].decimals)
                let tokenAmount = curve.calc_withdraw_one_coin(lpTokenAmount, poolTokenIndex)
                // console.log("calc_withdraw_one_coin: " + tokenAmount)
                let expectedTokenAmount = await contractView.calcWithdrawOneCoin(lpTokenAmount, poolTokenIndex)
                AssertionUtils.assertBNEq(tokenAmount, expectedTokenAmount.toString())
            })

            it('can accurately calc_token_amount when deposit', async () => {
                // deposit 10000 token
                let poolTokenIndex = 0
                let poolTokenSymbol = poolParam.POOL_TOKEN[poolTokenIndex]
                let tokenAmounts = new Array(poolParam.CURRENCY_NUMBER().toNumber()).fill(new BigNumber(0))
                tokenAmounts[poolTokenIndex] = BNUtils.mul10pow(new BigNumber('10000'), tokenAddress[poolTokenSymbol].decimals)
                let lpTokenAmount = curve.calc_token_amount(tokenAmounts, true)
                // console.log("calc_token_amount(deposit): " + token_amount)
                let expectedpoolTokenAmount = await contractView.calcTokenAmount(tokenAmounts, true)
                AssertionUtils.assertBNEq(lpTokenAmount, expectedpoolTokenAmount.toString())
            })
        }
    }

    function curvePoolTrxTestSuite(curvePoolSymbol) {
        return () => {
            let curve
            let contractTrx = curvePoolConstant[curvePoolSymbol].trx.latest()
            let poolParam = curvePoolConstant[curvePoolSymbol].param
            beforeEach(async () => {
                const blockInput = curvePoolConstant[curvePoolSymbol].input.atBlock('latest')
                const A = await blockInput.A()
                const balances = await blockInput.balances()
                const admin_balances = await blockInput.admin_balances()
                const tokens = await blockInput.tokens()
                curve = new CurvePool(curvePoolSymbol, A, balances, admin_balances, tokens)
            })

            it('can accurately exchange', async () => {
                let swapInPoolTokenIndex = 0
                let swapInPoolTokenSymbol = poolParam.POOL_TOKEN[swapInPoolTokenIndex]
                let swapInPoolTokenAmount = BNUtils.mul10pow(new BigNumber(2), tokenAddress[swapInPoolTokenSymbol].decimals)
                let swapOutPoolTokenIndex = 1
                let swapOutPoolTokenAmount = curve.exchange(swapInPoolTokenIndex, swapOutPoolTokenIndex, swapInPoolTokenAmount)
                // console.log("exchange: " + swapOutPoolTokenAmount)
                AssertionUtils.assertBNEq(swapOutPoolTokenAmount, (await contractTrx.exchange(swapInPoolTokenIndex, swapOutPoolTokenIndex, swapInPoolTokenAmount)).toString())
            })

            it('can accurately add_liquidity', async () => {
                let poolTokenIndex = 0
                let poolTokenSymbol = poolParam.POOL_TOKEN[poolTokenIndex]
                let tokenAmounts = new Array(poolParam.CURRENCY_NUMBER().toNumber()).fill(new BigNumber(0))
                tokenAmounts[poolTokenIndex] = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[poolTokenSymbol].decimals)
                let lpTokenAmount = curve.add_liquidity(tokenAmounts)
                // console.log("add_liquidity: " + poolTokenAmount)
                AssertionUtils.assertBNEq(lpTokenAmount, (await contractTrx.addLiquidity(tokenAmounts)).toString())
            })
        }
    }

    // some tests below for verification of ideas, still untidy

    // describe('Test Curve Stable Pool D calculation', () => {
    //     let curve, curve1, curve2
    //     beforeAll(() => {
    //         const A = new BigNumber(200)
    //         const balances = [new BigNumber('300000000000000000000'), new BigNumber('300000000'), new BigNumber('300000000')]
    //         const admin_balances = [new BigNumber('19417477913988179088561'), new BigNumber('21344641050'), new BigNumber('27649688613')]
    //         const tokens = new BigNumber('228526126556750785648667813')
    //         curve = new CurvePool(A, balances, admin_balances, tokens)

    //         const A1 = new BigNumber(200)
    //         const balances1 = [new BigNumber('49207411069167985957092526'), new BigNumber('75336433192389'), new BigNumber('105376210353127')]
    //         const admin_balances1 = [new BigNumber('19417477913988179088561'), new BigNumber('21344641050'), new BigNumber('27649688613')]
    //         const tokens1 = new BigNumber('228526126556750785648667813')
    //         curve1 = new CurvePool(A1, balances1, admin_balances1, tokens1)

    //         const A2 = new BigNumber(200)
    //         const balances2 = [new BigNumber('49207411069167985957092526').muln(2), new BigNumber('75336433192389').muln(2), new BigNumber('105376210353127').muln(2)]
    //         const admin_balances2 = [new BigNumber('19417477913988179088561'), new BigNumber('21344641050'), new BigNumber('27649688613')]
    //         const tokens2 = new BigNumber('228526126556750785648667813')
    //         curve2 = new CurvePool(A2, balances2, admin_balances2, tokens2)
    //     })

    //     it('D = sum(xp()) or single_token_amount * n when token balanced', () => {
    //         function sum(bnArr) {
    //             return bnArr.reduce((prev, current) => {
    //                 return prev.add(current)
    //             })
    //         }
    //         let xp = curve.xp()
    //         let D = curve.D(xp)
    //         AssertionUtils.assertBNEq(BNUtils.sum(xp), new BigNumber(300).muln(3).mul(new BigNumber(10).pow(new BigNumber(18))))
    //         AssertionUtils.assertBNEq(D, new BigNumber(300).muln(3).mul(new BigNumber(10).pow(new BigNumber(18))))
    //     })

    //     it('D in proportion to token amount', () => {
    //         let D1 = curve1.D(curve1.xp())
    //         let D2 = curve2.D(curve2.xp())
    //         AssertionUtils.assertBNEq(D2, D1.muln(2))
    //     })

    //     it('fee of iteration with differect token amounts variates', async () => {
    //         var abiArray = [{ "name": "TokenExchange", "inputs": [{ "type": "address", "name": "buyer", "indexed": true }, { "type": "int128", "name": "sold_id", "indexed": false }, { "type": "uint256", "name": "tokens_sold", "indexed": false }, { "type": "int128", "name": "bought_id", "indexed": false }, { "type": "uint256", "name": "tokens_bought", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "AddLiquidity", "inputs": [{ "type": "address", "name": "provider", "indexed": true }, { "type": "uint256[3]", "name": "token_amounts", "indexed": false }, { "type": "uint256[3]", "name": "fees", "indexed": false }, { "type": "uint256", "name": "invariant", "indexed": false }, { "type": "uint256", "name": "token_supply", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "RemoveLiquidity", "inputs": [{ "type": "address", "name": "provider", "indexed": true }, { "type": "uint256[3]", "name": "token_amounts", "indexed": false }, { "type": "uint256[3]", "name": "fees", "indexed": false }, { "type": "uint256", "name": "token_supply", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "RemoveLiquidityOne", "inputs": [{ "type": "address", "name": "provider", "indexed": true }, { "type": "uint256", "name": "token_amount", "indexed": false }, { "type": "uint256", "name": "coin_amount", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "RemoveLiquidityImbalance", "inputs": [{ "type": "address", "name": "provider", "indexed": true }, { "type": "uint256[3]", "name": "token_amounts", "indexed": false }, { "type": "uint256[3]", "name": "fees", "indexed": false }, { "type": "uint256", "name": "invariant", "indexed": false }, { "type": "uint256", "name": "token_supply", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "CommitNewAdmin", "inputs": [{ "type": "uint256", "name": "deadline", "indexed": true }, { "type": "address", "name": "admin", "indexed": true }], "anonymous": false, "type": "event" }, { "name": "NewAdmin", "inputs": [{ "type": "address", "name": "admin", "indexed": true }], "anonymous": false, "type": "event" }, { "name": "CommitNewFee", "inputs": [{ "type": "uint256", "name": "deadline", "indexed": true }, { "type": "uint256", "name": "fee", "indexed": false }, { "type": "uint256", "name": "admin_fee", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "NewFee", "inputs": [{ "type": "uint256", "name": "fee", "indexed": false }, { "type": "uint256", "name": "admin_fee", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "RampA", "inputs": [{ "type": "uint256", "name": "old_A", "indexed": false }, { "type": "uint256", "name": "new_A", "indexed": false }, { "type": "uint256", "name": "initial_time", "indexed": false }, { "type": "uint256", "name": "future_time", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "StopRampA", "inputs": [{ "type": "uint256", "name": "A", "indexed": false }, { "type": "uint256", "name": "t", "indexed": false }], "anonymous": false, "type": "event" }, { "outputs": [], "inputs": [{ "type": "address", "name": "_owner" }, { "type": "address[3]", "name": "_coins" }, { "type": "address", "name": "_pool_token" }, { "type": "uint256", "name": "_A" }, { "type": "uint256", "name": "_fee" }, { "type": "uint256", "name": "_admin_fee" }], "stateMutability": "nonpayable", "type": "constructor" }, { "name": "A", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 5227 }, { "name": "get_virtual_price", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 1133537 }, { "name": "calc_token_amount", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [{ "type": "uint256[3]", "name": "amounts" }, { "type": "bool", "name": "deposit" }], "stateMutability": "view", "type": "function", "gas": 4508776 }, { "name": "add_liquidity", "outputs": [], "inputs": [{ "type": "uint256[3]", "name": "amounts" }, { "type": "uint256", "name": "min_mint_amount" }], "stateMutability": "nonpayable", "type": "function", "gas": 6954858 }, { "name": "get_dy", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [{ "type": "int128", "name": "i" }, { "type": "int128", "name": "j" }, { "type": "uint256", "name": "dx" }], "stateMutability": "view", "type": "function", "gas": 2673791 }, { "name": "get_dy_underlying", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [{ "type": "int128", "name": "i" }, { "type": "int128", "name": "j" }, { "type": "uint256", "name": "dx" }], "stateMutability": "view", "type": "function", "gas": 2673474 }, { "name": "exchange", "outputs": [], "inputs": [{ "type": "int128", "name": "i" }, { "type": "int128", "name": "j" }, { "type": "uint256", "name": "dx" }, { "type": "uint256", "name": "min_dy" }], "stateMutability": "nonpayable", "type": "function", "gas": 2818066 }, { "name": "remove_liquidity", "outputs": [], "inputs": [{ "type": "uint256", "name": "_amount" }, { "type": "uint256[3]", "name": "min_amounts" }], "stateMutability": "nonpayable", "type": "function", "gas": 192846 }, { "name": "remove_liquidity_imbalance", "outputs": [], "inputs": [{ "type": "uint256[3]", "name": "amounts" }, { "type": "uint256", "name": "max_burn_amount" }], "stateMutability": "nonpayable", "type": "function", "gas": 6951851 }, { "name": "calc_withdraw_one_coin", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [{ "type": "uint256", "name": "_token_amount" }, { "type": "int128", "name": "i" }], "stateMutability": "view", "type": "function", "gas": 1102 }, { "name": "remove_liquidity_one_coin", "outputs": [], "inputs": [{ "type": "uint256", "name": "_token_amount" }, { "type": "int128", "name": "i" }, { "type": "uint256", "name": "min_amount" }], "stateMutability": "nonpayable", "type": "function", "gas": 4025523 }, { "name": "ramp_A", "outputs": [], "inputs": [{ "type": "uint256", "name": "_future_A" }, { "type": "uint256", "name": "_future_time" }], "stateMutability": "nonpayable", "type": "function", "gas": 151919 }, { "name": "stop_ramp_A", "outputs": [], "inputs": [], "stateMutability": "nonpayable", "type": "function", "gas": 148637 }, { "name": "commit_new_fee", "outputs": [], "inputs": [{ "type": "uint256", "name": "new_fee" }, { "type": "uint256", "name": "new_admin_fee" }], "stateMutability": "nonpayable", "type": "function", "gas": 110461 }, { "name": "apply_new_fee", "outputs": [], "inputs": [], "stateMutability": "nonpayable", "type": "function", "gas": 97242 }, { "name": "revert_new_parameters", "outputs": [], "inputs": [], "stateMutability": "nonpayable", "type": "function", "gas": 21895 }, { "name": "commit_transfer_ownership", "outputs": [], "inputs": [{ "type": "address", "name": "_owner" }], "stateMutability": "nonpayable", "type": "function", "gas": 74572 }, { "name": "apply_transfer_ownership", "outputs": [], "inputs": [], "stateMutability": "nonpayable", "type": "function", "gas": 60710 }, { "name": "revert_transfer_ownership", "outputs": [], "inputs": [], "stateMutability": "nonpayable", "type": "function", "gas": 21985 }, { "name": "admin_balances", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [{ "type": "uint256", "name": "i" }], "stateMutability": "view", "type": "function", "gas": 3481 }, { "name": "withdraw_admin_fees", "outputs": [], "inputs": [], "stateMutability": "nonpayable", "type": "function", "gas": 21502 }, { "name": "donate_admin_fees", "outputs": [], "inputs": [], "stateMutability": "nonpayable", "type": "function", "gas": 111389 }, { "name": "kill_me", "outputs": [], "inputs": [], "stateMutability": "nonpayable", "type": "function", "gas": 37998 }, { "name": "unkill_me", "outputs": [], "inputs": [], "stateMutability": "nonpayable", "type": "function", "gas": 22135 }, { "name": "coins", "outputs": [{ "type": "address", "name": "" }], "inputs": [{ "type": "uint256", "name": "arg0" }], "stateMutability": "view", "type": "function", "gas": 2220 }, { "name": "balances", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [{ "type": "uint256", "name": "arg0" }], "stateMutability": "view", "type": "function", "gas": 2250 }, { "name": "fee", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2171 }, { "name": "admin_fee", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2201 }, { "name": "owner", "outputs": [{ "type": "address", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2231 }, { "name": "initial_A", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2261 }, { "name": "future_A", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2291 }, { "name": "initial_A_time", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2321 }, { "name": "future_A_time", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2351 }, { "name": "admin_actions_deadline", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2381 }, { "name": "transfer_ownership_deadline", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2411 }, { "name": "future_fee", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2441 }, { "name": "future_admin_fee", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2471 }, { "name": "future_owner", "outputs": [{ "type": "address", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function", "gas": 2501 }]
    //         var contractInstance = new web3.eth.Contract(abiArray, "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7");
    //         var dataHash0 = contractInstance.methods.A().encodeABI();
    //         web3.eth.estimateGas({
    //             to: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
    //             data: dataHash0
    //         })
    //             .then(res => console.log('gas when call A: ' + res));
    //         var dataHash1 = contractInstance.methods.calc_token_amount([new BigNumber('0').toString(), new BigNumber('0').toString(), new BigNumber('10000000000').toString()], true).encodeABI();
    //         web3.eth.estimateGas({
    //             to: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
    //             data: dataHash1
    //         })
    //             .then(res => console.log('gas when deposit 10000 USDT: ' + res));
    //         var dataHash2 = contractInstance.methods.calc_token_amount([new BigNumber('0').toString(), new BigNumber('0').toString(), new BigNumber('10000000000000').toString()], true).encodeABI();
    //         web3.eth.estimateGas({
    //             to: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
    //             data: dataHash2
    //         })
    //             .then(res => console.log('gas when deposit 10000000 USDT: ' + res));
    //         var dataHash3 = contractInstance.methods.calc_token_amount([new BigNumber('0').toString(), new BigNumber('0').toString(), new BigNumber('10000000000000000').toString()], true).encodeABI();
    //         web3.eth.estimateGas({
    //             to: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
    //             data: dataHash3
    //         })
    //             .then(res => console.log('gas when deposit 10000000000 USDT: ' + res));
    //         var dataHash4 = contractInstance.methods.calc_token_amount([new BigNumber('0').toString(), new BigNumber('10000000000000000').toString(), new BigNumber('10000000000000000000').toString()], true).encodeABI();
    //         web3.eth.estimateGas({
    //             to: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
    //             data: dataHash4
    //         })
    //             .then(res => console.log('iteration count when token amount differ hugely: ' + res));


    //         // var value = web3.eth.call({
    //         //     to: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
    //         //     data: dataHash
    //         // }, 'latest');
    //         // console.log('' + value);
    //     })

    //     it('iteration counts with differect token amounts', () => {
    //         console.log('iteration count when deposit 10000 USDT');
    //         curve1.calc_token_amount([new BigNumber('0'), new BigNumber('0'), new BigNumber('10000000000')], true)
    //         console.log('iteration count when deposit 10000000 USDT');
    //         curve1.calc_token_amount([new BigNumber('0'), new BigNumber('0'), new BigNumber('10000000000000')], true)
    //         console.log('iteration count when deposit 10000000000 USDT');
    //         curve1.calc_token_amount([new BigNumber('0'), new BigNumber('0'), new BigNumber('10000000000000000')], true)

    //         console.log('iteration count when token amount differ hugely');
    //         curve1.calc_token_amount([new BigNumber('0'), new BigNumber('10000000000000000'), new BigNumber('10000000000000000000')], true)
    //     })

    // })

    // describe('pool status in extreme circumstance', () => {
    //     let curve1
    //     beforeEach(() => {
            // const A1 = new BigNumber(200)
            // const balances1 = [new BigNumber('49207411069167985957092526'), new BigNumber('75336433192389'), new BigNumber('105376210353127')]
            // const admin_balances1 = [new BigNumber('19417477913988179088561'), new BigNumber('21344641050'), new BigNumber('27649688613')]
            // const tokens1 = new BigNumber('228526126556750785648667813')
            // curve1 = new CurvePool(A1, balances1, admin_balances1, tokens1)
        // });

        // it('use get_virtual_price() + remove_liquidity_one_coin()', () => {
        //     let virtual_price = curve1.get_virtual_price()
        //     console.log("virtual price: " + virtual_price)
        //     // let _3crv_to_withdraw = new BigNumber(9500).muln(1000000).mul(new BigNumber(10).pow(new BigNumber(18))).div(virtual_price)
        //     let _3crv_to_withdraw = new BigNumber(9500).muln(1000000).mul(new BigNumber('1000000000000')).mul(new BigNumber(10).pow(new BigNumber(18))).div(virtual_price)
        //     console.log('_3crv_to_withdraw: ' + _3crv_to_withdraw)
        //     let coin_amount = curve1.remove_liquidity_one_coin(_3crv_to_withdraw, 2)
        //     console.log('coin_amount: ' + coin_amount)
        // })

        // it('use remove_liquidity_imbalance()', () => {
        //     let _3crv_to_withdraw = curve1.remove_liquidity_imbalance([new BigNumber('0'), new BigNumber('0'), new BigNumber(9500).muln(1000000)])
        //     console.log('_3crv_to_withdraw: ' + _3crv_to_withdraw)
        // })

        // it('get_virtual_price() differ a lot', () => {
        //     let virtual_price0 = curve1.get_virtual_price()
        //     console.log("virtual price: " + virtual_price0)
        //     console.log('assume a huge exchange happens, then USDT have more share in pool');
        //     console.log(curve1.exchange(2, 0, BNUtils.mul10pow(new BigNumber('100000000'), 6)).toString())
        //     let virtual_price1 = curve1.get_virtual_price()
        //     console.log("virtual price: " + virtual_price1)
        // })

        // it('find withdraw buffer threshold(use virtual price) when vault has insufficient buffer', async () => {
        //     const strategyTokenSymbol = 'USDT'
        //     // simulate when doing vault withdraw test
        //     let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('18000'), tokenAddress[strategyTokenSymbol].decimals)
        //     curve.add_liquidity([new BigNumber('0'), new BigNumber('0'), strategyTokenAmountToDeposit])
        //     for (let i = 0; i < 5; i++) {
        //         curve.exchange(curvePoolConstant.param.POOL_TOKEN.findIndex('DAI'), curvePoolConstant.param.POOL_TOKEN.findIndex('USDC'), BNUtils.mul10pow(new BigNumber('20'), 6 + tokenAddress.DAI.decimals))
        //         curve.exchange(curvePoolConstant.param.POOL_TOKEN.findIndex('USDC'), curvePoolConstant.param.POOL_TOKEN.findIndex('USDT'), BNUtils.mul10pow(new BigNumber('20'), 6 + tokenAddress.USDC.decimals))
        //         curve.exchange(curvePoolConstant.param.POOL_TOKEN.findIndex('USDT'), curvePoolConstant.param.POOL_TOKEN.findIndex('DAI'), BNUtils.mul10pow(new BigNumber('20'), 6 + tokenAddress.USDT.decimals))
        //     }
        //     console.log(curve.get_virtual_price().toString())
        //     let snapshotId = curve.snapshot()
        //     const tokenAmountToWithdraw = BNUtils.mul10pow(new BigNumber('9990528926'), 0)



        //     // const balances_0 = [BNUtils.mul10pow(new BigNumber('10000'), 18), BNUtils.mul10pow(new BigNumber('10000'), 6), BNUtils.mul10pow(new BigNumber('10000'), 6)]
        //     // let curve_0 = new CurvePool(A1, balances_0, admin_balances1, tokens1)
        //     let _3crvAmountToWithdraw = tokenAmountToWithdraw.mul(BNUtils.get10pow(18)).div(curve.get_virtual_price()).mul(BNUtils.get10pow(12))
        //     console.log(_3crvAmountToWithdraw.toString())
        //     let actualDaiAmount = curve.remove_liquidity_one_coin(_3crvAmountToWithdraw, 2)
        //     console.log(actualDaiAmount.toString())
        //     // console.log(DaiAmountToWithdraw.muln(100).div(actualDaiAmount).subn(100).toString())

        //     curve.revert(snapshotId)
        //     let _3crvToWithdrawFullAmount = curve.remove_liquidity_imbalance([new BigNumber('0'), new BigNumber('0'), tokenAmountToWithdraw])
        //     console.log(_3crvToWithdrawFullAmount.toString())
        //     console.log(_3crvToWithdrawFullAmount.muln(10000).div(_3crvAmountToWithdraw).subn(10000).toString())

        //     curve.revert(snapshotId)
        //     let actualDaiAmount2 = curve.remove_liquidity_one_coin(_3crvToWithdrawFullAmount, 2)
        //     console.log(actualDaiAmount2.toString())
        //     // dai: down, usdc: still, usdt: up 
        //     // for (let i = 0; i < 45; i++) {
        //     //     let dbalance = new BigNumber('2000000').muln(i)
        //     //     // console.log(dbalance.toString())
        //     //     let arr = []
        //     //     for (let j = 0; j < 8; j++) {
        //     //         let DaiAmountToWithdraw = BNUtils.mul10pow(BNUtils.get10pow(j), 18)
        //     //         // console.log(DaiAmountToWithdraw.toString())
        //     //         let balances_0 = [BNUtils.mul10pow(new BigNumber('100000000').sub(dbalance), 18), BNUtils.mul10pow(new BigNumber('100000000'), 6), BNUtils.mul10pow(new BigNumber('100000000').add(dbalance), 6)]
        //     //         let curve_0 = new CurvePool(A1, balances_0, admin_balances1, new BigNumber('228526126556750785648667'))
        //     //         let _3crvAmountToWithdraw = DaiAmountToWithdraw.mul(BNUtils.get10pow(18)).div(curve_0.get_virtual_price())
        //     //         // console.log(_3crvAmountToWithdraw.toString())
        //     //         let actualDaiAmount = curve_0.remove_liquidity_one_coin(_3crvAmountToWithdraw, 0)
        //     //         // console.log(actualDaiAmount.toString())
        //     //         let balances_1 = [BNUtils.mul10pow(new BigNumber('100000000').sub(dbalance), 18), BNUtils.mul10pow(new BigNumber('100000000'), 6), BNUtils.mul10pow(new BigNumber('100000000').add(dbalance), 6)]
        //     //         let curve_1 = new CurvePool(A1, balances_1, admin_balances1, new BigNumber('228526126556750785648667'))
        //     //         let _3crvToWithdrawFullAmount = curve_1.remove_liquidity_imbalance([DaiAmountToWithdraw, new BigNumber('0'), new BigNumber('0')])
        //     //         // console.log(_3crvToWithdrawFullAmount.toString())
        //     //         // arr[j] = DaiAmountToWithdraw.muln(10000).div(actualDaiAmount).subn(10000)
        //     //         arr[j] = _3crvToWithdrawFullAmount.muln(10000).div(_3crvAmountToWithdraw).subn(10000)
        //     //     }
        //     //     // console.log(arr.toString())
        //     // }

        //     // // dai: down, usdc: up, usdt: up 
        //     // for (let i = 0; i < 45; i++) {
        //     //     let dbalance = new BigNumber('1000000').muln(i)
        //     //     // console.log(dbalance.toString())
        //     //     let arr = []
        //     //     for (let j = 0; j < 8; j++) {
        //     //         let DaiAmountToWithdraw = BNUtils.mul10pow(BNUtils.get10pow(j), 18)
        //     //         // console.log(DaiAmountToWithdraw.toString())
        //     //         let balances_0 = [BNUtils.mul10pow(new BigNumber('100000000').sub(dbalance.muln(2)), 18), BNUtils.mul10pow(new BigNumber('100000000').add(dbalance), 6), BNUtils.mul10pow(new BigNumber('100000000').add(dbalance), 6)]
        //     //         let curve_0 = new CurvePool(A1, balances_0, admin_balances1, new BigNumber('228526126556750785648667'))
        //     //         let _3crvAmountToWithdraw = DaiAmountToWithdraw.mul(BNUtils.get10pow(18)).div(curve_0.get_virtual_price())
        //     //         // console.log(_3crvAmountToWithdraw.toString())
        //     //         let actualDaiAmount = curve_0.remove_liquidity_one_coin(_3crvAmountToWithdraw, 0)
        //     //         // console.log(actualDaiAmount.toString())
        //     //         let balances_1 = [BNUtils.mul10pow(new BigNumber('100000000').sub(dbalance.muln(2)), 18), BNUtils.mul10pow(new BigNumber('100000000').add(dbalance), 6), BNUtils.mul10pow(new BigNumber('100000000').add(dbalance), 6)]
        //     //         let curve_1 = new CurvePool(A1, balances_1, admin_balances1, new BigNumber('228526126556750785648667'))
        //     //         let _3crvToWithdrawFullAmount = curve_1.remove_liquidity_imbalance([DaiAmountToWithdraw, new BigNumber('0'), new BigNumber('0')])
        //     //         // console.log(_3crvToWithdrawFullAmount.toString())
        //     //         // arr[j] = DaiAmountToWithdraw.muln(10000).div(actualDaiAmount).subn(10000)
        //     //         arr[j] = _3crvToWithdrawFullAmount.muln(10000).div(_3crvAmountToWithdraw).subn(10000)
        //     //     }
        //     //     // console.log(arr.toString())
        //     // }
        // })
    // })