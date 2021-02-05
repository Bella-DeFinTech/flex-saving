const AssertionUtils = require("./utils/AssertionUtils.js")
const AccountUtils = require("./utils/AccountUtils.js")
const BNUtils = require("./utils/BNUtils.js")
const timeMachine = require("./utils/TimeMachine.js")
const deploy = require("./lib/Deploy.js")
const CurvePool = require("./lib/CurvePool.js")
const BigNumber = require('bn.js')
const curvePoolConstant = require('./const/CurvePool.js')
const tokenAddress = require('./const/Token.js')
const curveHbtcPool = require('./abi/hbtcPool.js')
const curveGauge = require('./abi/gauge.js')
const uniswapV2Router02 = require('./abi/UniswapV2Router02.js')
const strategyTokens = require('./const/StrategyToken.js')

jest.setTimeout(30 * 60 * 1000)

describe('Test BellaFlexsaving StrategyWBTC', strategyTestSuite('WBTC'))
describe('Test BellaFlexsaving StrategyHBTC', strategyTestSuite('HBTC'))

function strategyTestSuite(strategyTokenSymbol) {
    return () => {
        const poolTokenSymbol = 'hbtc'
        const poolParam = curvePoolConstant[poolTokenSymbol].param
        const strategyTokenIndexInCurveHbtcPool = poolParam.POOL_TOKEN.findIndex(strategyTokenSymbol)
        let governance
        let strategyTokenRewardsAddress
        let BELRewardsAddress
        let strategy
        let strategyAddress
        let strategyToken
        let strategyTokenAddress
        let snapshotId
        beforeAll(async (done) => {
            let deployAddress = await deploy(saddle, accounts[0], accounts, [strategyTokens[strategyTokenSymbol].index])
            governance = deployAddress.governance
            strategyTokenRewardsAddress = deployAddress.strategyTokenRewardsAddress
            BELRewardsAddress = deployAddress.BELRewardsAddress
            strategyAddress = deployAddress.strategy[strategyTokenSymbol]
            strategyTokenAddress = tokenAddress[strategyTokenSymbol].token
            strategy = await saddle.getContractAt(strategyTokens[strategyTokenSymbol].contractName, strategyAddress)
            strategyToken = await saddle.getContractAt('IERC20', strategyTokenAddress)
            done()
        })

        describe('Test Strategy deposit', () => {
            let curve
            let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('90'), tokenAddress[strategyTokenSymbol].decimals)

            beforeAll(async (done) => {
                let snapshot = await timeMachine.takeSnapshot()
                snapshotId = snapshot['result']
                console.log('snapshot #' + snapshotId + ' saved!')
                done()
            })

            afterAll(async (done) => {
                await timeMachine.revertToSnapshot(snapshotId)
                console.log('reverted to snapshot #' + snapshotId)
                done()
            })

            beforeEach(async (done) => {
                // Pre-test conditions 
                const blockInput = curvePoolConstant[poolTokenSymbol].input.atBlock('latest')
                const A = await blockInput.A()
                const balances = await blockInput.balances()
                const admin_balances = await blockInput.admin_balances()
                const tokens = await blockInput.tokens()
                curve = new CurvePool(poolTokenSymbol, A, balances, admin_balances, tokens)
                // When Flex Savings HBTC Strategy deposits 100 HBTC to Curve HbtcPool
                // prepare strategy Token balance(100 HBTC) for governance
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                done()
            })

            it('lp strategy can accurately deposit', async () => {
                // do deposit
                await send(strategy, 'deposit', [], { from: governance })
                let investmentStrategyTokenAmount = await call(strategy, 'balanceInPool')
                // run simulation
                let liquidityArr = new Array(poolParam.CURRENCY_NUMBER().toNumber()).fill(new BigNumber(0))
                liquidityArr[strategyTokenIndexInCurveHbtcPool] = strategyTokenAmountToDeposit
                let expectedHcrvAmount = curve.add_liquidity(liquidityArr)
                let expectedVirtualPrice = curve.get_virtual_price()
                let expectedInvestmentStrategyTokenAmount = expectedHcrvAmount.mul(expectedVirtualPrice).div(BNUtils.get10pow(tokenAddress.hCRV.decimals + tokenAddress.hCRV.decimals - tokenAddress[strategyTokenSymbol].decimals))
                // assert investmentStrategyTokenAmount equals expected
                AssertionUtils.assertBNEq(new BigNumber(investmentStrategyTokenAmount), expectedInvestmentStrategyTokenAmount)
            })
        })

        describe('Test Strategy harvest', () => {
            const day = 24 * 60 * 60
            const curveHbtcPoolAddress = poolParam.curvePoolAddress
            const curveHbtcPoolInstance = new web3.eth.Contract(curveHbtcPool.abiArray, curveHbtcPoolAddress)
            const curveGaugeAddress = poolParam.curveGaugeAddress
            const curveGaugeInstance = new web3.eth.Contract(curveGauge.abiArray, curveGaugeAddress)
            const uniswapV2Router02Address = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
            const uniswapV2Router02Instance = new web3.eth.Contract(uniswapV2Router02.abiArray, uniswapV2Router02Address)
            const crvToStrategyTokenPortion = 92 // 20% manager fee + 80% * 90%
            const strategyTokenManageFeePortion = 22 // 92% * 22% = 20%
            const BELRewardsDistributionPortion = 50
            const swapToBELRouting = [tokenAddress.CRV.token, tokenAddress.WETH.token, tokenAddress.BEL.token]
            // for liquidity in uniswap, when harvest we choose to always swap crv for wbtc
            const rewardsToken = 'WBTC'
            const rewardsTokenIndexInCurveHbtcPool = poolParam.POOL_TOKEN.findIndex(rewardsToken)
            const swapToStrategyTokenRouting = [tokenAddress.CRV.token, tokenAddress.WETH.token, tokenAddress.WBTC.token]
            let curve
            let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('100'), tokenAddress[strategyTokenSymbol].decimals)

            beforeAll(async (done) => {
                let snapshot = await timeMachine.takeSnapshot()
                snapshotId = snapshot['result']
                console.log('snapshot #' + snapshotId + ' saved!')
                done()
            })

            afterAll(async (done) => {
                await timeMachine.revertToSnapshot(snapshotId)
                console.log('reverted to snapshot #' + snapshotId)
                done()
            })

            beforeEach(async (done) => {
                // Pre-test conditions 
                const blockInput = curvePoolConstant[poolTokenSymbol].input.atBlock('latest')
                const A = await blockInput.A()
                const balances = await blockInput.balances()
                const admin_balances = await blockInput.admin_balances()
                const tokens = await blockInput.tokens()
                curve = new CurvePool(poolTokenSymbol, A, balances, admin_balances, tokens)
                // When Flex Savings HBTC Strategy deposits 100 HBTC to Curve HbtcPool
                // prepare strategy Token balance(100 HBTC) for governance
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                // do deposit
                await send(strategy, 'deposit', [], { from: governance })
                // run CurvePool simulation 
                let liquidityArr = new Array(poolParam.CURRENCY_NUMBER().toNumber()).fill(new BigNumber(0))
                liquidityArr[strategyTokenIndexInCurveHbtcPool] = strategyTokenAmountToDeposit
                curve.add_liquidity(liquidityArr)
                // say 5 days passed and some exchange happened in curve HbtcPool
                await timeMachine.advanceTimeAndBlock(5 * day)
                // swap 88 * 5 btc volume during 5 days
                await AccountUtils.giveERC20Token('HBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.HBTC.decimals))
                await AccountUtils.giveERC20Token('WBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.WBTC.decimals))
                await AccountUtils.doApprove('HBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.HBTC.decimals))
                await AccountUtils.doApprove('WBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.WBTC.decimals))
                for (let i = 0; i < 5; i++) {
                    await curveHbtcPoolInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('HBTC'), poolParam.POOL_TOKEN.findIndex('WBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.HBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    await curveHbtcPoolInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('WBTC'), poolParam.POOL_TOKEN.findIndex('HBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.WBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    curve.exchange(poolParam.POOL_TOKEN.findIndex('HBTC'), poolParam.POOL_TOKEN.findIndex('WBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.HBTC.decimals))
                    curve.exchange(poolParam.POOL_TOKEN.findIndex('WBTC'), poolParam.POOL_TOKEN.findIndex('HBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.WBTC.decimals))
                }
                done()
            })

            it('lp strategy can accurately harvest', async () => {
                // call harvest and rollback
                let BELRewards
                let strategyTokenManageFee
                let investmentStrategyTokenAmount
                let claimTimeStamp
                await timeMachine.sendAndRollback(async () => {
                    let balanceOfBELRewardsAddressBefore = await AccountUtils.balanceOfERC20Token('BEL', BELRewardsAddress)
                    let balanceOfStrategyTokenRewardsAddressBefore = await AccountUtils.balanceOfERC20Token(rewardsToken, strategyTokenRewardsAddress)
                    let investmentStrategyTokenAmountBefore = await call(strategy, 'balanceInPool')
                    // do harvest
                    // claim CRV reward
                    // distribute CRV reward(swap to BEL and WBTC)
                    // reinvest WBTC: deposit & stake in Curve
                    let receipt = await send(strategy, 'harvest', [curveGaugeAddress], { from: governance })
                    let trxBlock = await web3.eth.getBlock(receipt.blockNumber)
                    claimTimeStamp = trxBlock.timestamp
                    let balanceOfBELRewardsAddressAfter = await AccountUtils.balanceOfERC20Token('BEL', BELRewardsAddress)
                    let balanceOfStrategyTokenRewardsAddressAfter = await AccountUtils.balanceOfERC20Token(rewardsToken, strategyTokenRewardsAddress)
                    let investmentStrategyTokenAmountAfter = await call(strategy, 'balanceInPool')
                    BELRewards = new BigNumber(balanceOfBELRewardsAddressAfter).sub(new BigNumber(balanceOfBELRewardsAddressBefore))
                    strategyTokenManageFee = new BigNumber(balanceOfStrategyTokenRewardsAddressAfter).sub(new BigNumber(balanceOfStrategyTokenRewardsAddressBefore))
                    investmentStrategyTokenAmount = new BigNumber(investmentStrategyTokenAmountAfter).sub(new BigNumber(investmentStrategyTokenAmountBefore))
                })
                // get expected value and rollback
                let expectedBELRewards
                let expectedStrategyTokenManageFee
                let expectedInvestmentStrategyTokenAmount
                await timeMachine.sendAndRollback(async () => {
                    let investedHcrvAmountBefore = new BigNumber(await curveGaugeInstance.methods.balanceOf(strategyAddress).call({}, 'latest'))
                    let expectedVirtualPriceBefore = curve.get_virtual_price()
                    let expectedBalanceInPoolBefore = investedHcrvAmountBefore.mul(expectedVirtualPriceBefore).div(BNUtils.get10pow(tokenAddress.hCRV.decimals + tokenAddress.hCRV.decimals - tokenAddress[strategyTokenSymbol].decimals))
                    let strategyTokenAmountBefore = await AccountUtils.balanceOfERC20Token(rewardsToken, strategyAddress)
                    // to make sure claimable crv equal to trx
                    await timeMachine.advanceBlockAndSetTime(claimTimeStamp)
                    let claimableCrvAmount = await curveGaugeInstance.methods.claimable_tokens(strategyAddress).call({}, 'latest')
                    await AccountUtils.giveERC20Token('CRV', governance, new BigNumber(claimableCrvAmount))
                    await AccountUtils.doApprove('CRV', governance, uniswapV2Router02Address, new BigNumber(claimableCrvAmount))
                    // execute uniswap swap to get accurate expect value and revert
                    // this is not accurate enough because wo need to do 2 swaps, and the former will influence the latter
                    // let swapedStrategyTokenAmount = await uniswapV2Router02Instance.methods.getAmountsOut(claimableCrvAmount, swap2HBTCRouting).call({}, 'latest')
                    let crvAmountToSwapStrategyToken = new BigNumber(claimableCrvAmount).muln(crvToStrategyTokenPortion).divn(100)
                    let crvAmountToSwapBEL = new BigNumber(claimableCrvAmount).sub(crvAmountToSwapStrategyToken)
                    let governanceStrategyTokenAmountBefore = await AccountUtils.balanceOfERC20Token(rewardsToken, governance)
                    let latestBlock = await web3.eth.getBlock('latest')
                    let swapDeadline = latestBlock.timestamp + day
                    await uniswapV2Router02Instance.methods.swapExactTokensForTokens(
                        crvAmountToSwapStrategyToken, 1, swapToStrategyTokenRouting, governance, swapDeadline
                    ).send({ from: governance, gas: 500000 })
                    let governanceStrategyTokenAmountAfter = await AccountUtils.balanceOfERC20Token(rewardsToken, governance)
                    let swapedStrategyTokenAmount = new BigNumber(governanceStrategyTokenAmountAfter).sub(new BigNumber(governanceStrategyTokenAmountBefore))
                    let governanceBELAmountBefore = await AccountUtils.balanceOfERC20Token('BEL', governance)
                    await uniswapV2Router02Instance.methods.swapExactTokensForTokens(
                        crvAmountToSwapBEL, 1, swapToBELRouting, governance, swapDeadline
                    ).send({ from: governance, gas: 500000 })
                    let governanceBELAmountAfter = await AccountUtils.balanceOfERC20Token('BEL', governance)
                    let swapedBELAmount = new BigNumber(governanceBELAmountAfter).sub(new BigNumber(governanceBELAmountBefore))
                    expectedBELRewards = new BigNumber(swapedBELAmount).muln(BELRewardsDistributionPortion).divn(100)
                    expectedStrategyTokenManageFee = new BigNumber(swapedStrategyTokenAmount).muln(strategyTokenManageFeePortion).divn(100)
                    let reinvestedStrategyTokenAmount = new BigNumber(swapedStrategyTokenAmount).sub(expectedStrategyTokenManageFee).add(new BigNumber(strategyTokenAmountBefore))
                    // run simulation
                    let liquidityArr = new Array(poolParam.CURRENCY_NUMBER().toNumber()).fill(new BigNumber(0))
                    liquidityArr[rewardsTokenIndexInCurveHbtcPool] = reinvestedStrategyTokenAmount
                    let expectedReinvestHcrvAmount = curve.add_liquidity(liquidityArr)
                    let expectedVirtualPriceAfter = curve.get_virtual_price()
                    let expectedBalanceInpoolAfter = investedHcrvAmountBefore.add(expectedReinvestHcrvAmount).mul(expectedVirtualPriceAfter).div(BNUtils.get10pow(tokenAddress.hCRV.decimals + tokenAddress.hCRV.decimals - tokenAddress[strategyTokenSymbol].decimals))
                    expectedInvestmentStrategyTokenAmount = expectedBalanceInpoolAfter.sub(expectedBalanceInPoolBefore)
                })
                // 1 - assert bella received by operations address
                AssertionUtils.assertBNEq(BELRewards, expectedBELRewards)
                // 2 - assert WBTC manage fee received by operations address
                AssertionUtils.assertBNEq(strategyTokenManageFee, expectedStrategyTokenManageFee)
                // 3 - assert WBTC reinvested into curve
                AssertionUtils.assertBNEq(investmentStrategyTokenAmount, expectedInvestmentStrategyTokenAmount)
            })
        })
    }
}