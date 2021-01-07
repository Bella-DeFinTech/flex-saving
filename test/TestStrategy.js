const Utils = require("./utils/Utils.js")
const timeMachine = require("./utils/TimeMachine.js")
const deploy = require("./lib/Deploy.js");
const CurvePool = require("./lib/CurvePool.js");
const BigNumber = require('bn.js');

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
        strategyAddress = deployAddress.strategy.usdt
        strategyTokenAddress = deployAddress.token.usdt
        strategyTokenHolder = deployAddress.tokenHolder.usdt
        strategy = await saddle.getContractAt('StrategyDai', strategyAddress)
        strategyToken = await saddle.getContractAt('IERC20', strategyTokenAddress)
        // console.log(await call(strategyToken, 'balanceOf', [strategyTokenHolder]))
        web3.eth.getBalance(governance)
            .then((balance) => {
                console.log("ETH Balance: " + balance)
            })
        // unlock unknown account for transaction
        await Utils.unlockAccount(strategyTokenHolder)
        // prepare strategyTokenHolder eth for gas from test account
        await web3.eth.sendTransaction({
            from: governance,
            to: strategyTokenHolder,
            value: web3.utils.toWei("1"),
            gas: 23000
        })
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
            const A = new BigNumber(200)
            const balances = [new BigNumber('49207411069167985957092526'), new BigNumber('75336433192389'), new BigNumber('105376210353127')]
            const admin_balances = [new BigNumber('19417477913988179088561'), new BigNumber('21344641050'), new BigNumber('27649688613')]
            const n = new BigNumber(3)
            const p = [new BigNumber('1000000000000000000'), new BigNumber('1000000000000000000000000000000'), new BigNumber('1000000000000000000000000000000')]
            const tokens = new BigNumber('228526126556750785648667813')
            curve = new CurvePool(A, balances, admin_balances, n, p, tokens)
            // When Flex Savings USDT Strategy deposits 10,000 USDT to Curve 3pool
            // prepare strategy Token balance(10000 USDT) from strategyTokenHolder
            send(strategyToken, 'transfer', [strategy._address, new BigNumber("10000").mul(new BigNumber(10).pow(new BigNumber(6))).toString()], { from: strategyTokenHolder }).then(() => {
                console.log("Token distributed")
                done()
            })
        })

        it('lp strategy can accurately deposit', async () => {
            // do deposit
            await send(strategy, 'deposit', [], { from: governance })
            let investmentStrategyTokenAmount = await call(strategy, 'balanceInPool')
            console.log("balanceInPool: " + investmentStrategyTokenAmount)
            // run simulation
            let expected3crvAmount = curve.add_liquidity([new BigNumber('0'), new BigNumber('0'), new BigNumber('10000000000')])
            let expectedVirtualPrice = curve.get_virtual_price()
            let expectedInvestmentStrategyTokenAmount = expected3crvAmount.mul(expectedVirtualPrice).div(new BigNumber(10).pow(new BigNumber(18)))
            // assert investmentStrategyTokenAmount equals expected
            Utils.assertBNEq(expectedInvestmentStrategyTokenAmount, new BigNumber(investmentStrategyTokenAmount))
        })
    })
})