const AssertionUtils = require("./utils/AssertionUtils.js")
const AccountUtils = require("./utils/AccountUtils.js")
const BNUtils = require("./utils/BNUtils.js");
const timeMachine = require("./utils/TimeMachine.js")
const deploy = require("./lib/Deploy.js");
const CurvePool = require("./lib/CurvePool.js");
const BigNumber = require('bn.js');
const curvePoolConstant = require('./const/CurvePool.js');
const tokenAddress = require('./const/Token.js');

jest.setTimeout(300000)

describe('Test BellaFlexsaving Strategy, take USDT for example', () => {

    const governance = accounts[0]

    let strategy
    let strategyAddress
    let strategyToken
    let strategyTokenAddress
    let strategyTokenHolder
    beforeAll(async (done) => {
        let deployAddress = await deploy(saddle, accounts[0], accounts, [0])
        strategyAddress = deployAddress.strategy.USDT
        strategyTokenAddress = tokenAddress.USDT.token
        strategyTokenHolder = tokenAddress.USDT.tokenHolder
        strategy = await saddle.getContractAt('StrategyUsdt', strategyAddress)
        strategyToken = await saddle.getContractAt('IERC20', strategyTokenAddress)
        // unlock unknown account for transaction
        await AccountUtils.unlockAccount(strategyTokenHolder)
        // prepare strategyTokenHolder eth for gas from test account
        await AccountUtils.give10ETH(strategyTokenHolder)
        done()
    })

    let snapshotId

    beforeEach(async () => {
        let snapshot = await timeMachine.takeSnapshot();
        snapshotId = snapshot['result'];
    });

    afterEach(async () => {
        await timeMachine.revertToSnapshot(snapshotId);
    });

    describe('Test Strategy deposit', () => {
        let curve
        beforeAll(async (done) => {
            // Pre-test conditions 
            // block #11553066
            const blockInput = curvePoolConstant.input.atBlock('11553066')
            const A = await blockInput.A()
            const balances = await blockInput.balances()
            const admin_balances = await blockInput.admin_balances()
            const tokens = await blockInput.tokens()
            curve = new CurvePool(A, balances, admin_balances, tokens)
            // When Flex Savings USDT Strategy deposits 10,000 USDT to Curve 3pool
            // prepare strategy Token balance(10000 USDT) from strategyTokenHolder
            send(strategyToken, 'transfer', [strategy._address, BNUtils.mul10pow(new BigNumber('10000'), 6).toString()], { from: strategyTokenHolder }).then((res) => {
                console.log("Token distributed")
                done()
            })
        })

        it('lp strategy can accurately deposit', async () => {
            // do deposit
            await send(strategy, 'deposit', [], { from: governance })
            let investmentStrategyTokenAmount = await call(strategy, 'balanceInPool')
            // run simulation
            let expected3crvAmount = curve.add_liquidity([new BigNumber('0'), new BigNumber('0'), BNUtils.mul10pow(new BigNumber('10000'), 6)])
            let expectedVirtualPrice = curve.get_virtual_price()
            let expectedInvestmentStrategyTokenAmount = expected3crvAmount.mul(expectedVirtualPrice).div(new BigNumber(10).pow(new BigNumber(18)))
            // assert investmentStrategyTokenAmount equals expected
            AssertionUtils.assertBNEq(expectedInvestmentStrategyTokenAmount, new BigNumber(investmentStrategyTokenAmount))
        })
    })
})