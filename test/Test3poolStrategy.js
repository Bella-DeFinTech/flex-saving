const AssertionUtils = require("./utils/AssertionUtils.js")
const AccountUtils = require("./utils/AccountUtils.js")
const BNUtils = require("./utils/BNUtils.js")
const timeMachine = require("./utils/TimeMachine.js")
const deploy = require("./lib/Deploy.js")
const CurvePool = require("./lib/CurvePool.js")
const BigNumber = require('bn.js')
const curvePoolConstant = require('./const/CurvePool.js')
const tokenAddress = require('./const/Token.js')
const curve3pool = require('./abi/3Pool.js')
const curveGauge = require('./abi/gauge.js')
const uniswapV2Router02 = require('./abi/UniswapV2Router02.js')
const strategyTokens = require('./const/StrategyToken.js')

jest.setTimeout(30 * 60 * 1000)

describe('Test BellaFlexsaving StrategyUSDT', strategyTestSuite('USDT'))
describe('Test BellaFlexsaving StrategyUSDC', strategyTestSuite('USDC'))
describe('Test BellaFlexsaving StrategyDAI', strategyTestSuite('DAI'))

function strategyTestSuite(strategyTokenSymbol) {
    return () => {
        const poolTokenSymbol = '_3pool'
        const poolParam = curvePoolConstant[poolTokenSymbol].param
        const strategyTokenIndexInCurve3pool = poolParam.POOL_TOKEN.findIndex(strategyTokenSymbol)
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
            let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('9000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // When Flex Savings USDT Strategy deposits 10,000 USDT to Curve 3pool
                // prepare strategy Token balance(10000 USDT) for governance
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
                liquidityArr[strategyTokenIndexInCurve3pool] = strategyTokenAmountToDeposit
                let expected3crvAmount = curve.add_liquidity(liquidityArr)
                let expectedVirtualPrice = curve.get_virtual_price()
                let expectedInvestmentStrategyTokenAmount = expected3crvAmount.mul(expectedVirtualPrice).div(BNUtils.get10pow(tokenAddress._3CRV.decimals + tokenAddress._3CRV.decimals - tokenAddress[strategyTokenSymbol].decimals))
                // assert investmentStrategyTokenAmount equals expected
                AssertionUtils.assertBNEq(new BigNumber(investmentStrategyTokenAmount), expectedInvestmentStrategyTokenAmount)
            })
        })

        describe('Test Strategy harvest', () => {
            const day = 24 * 60 * 60
            const curve3poolAddress = poolParam.curvePoolAddress
            const curve3poolInstance = new web3.eth.Contract(curve3pool.abiArray, curve3poolAddress)
            const curveGaugeAddress = poolParam.curveGaugeAddress
            const curveGaugeInstance = new web3.eth.Contract(curveGauge.abiArray, curveGaugeAddress)
            const uniswapV2Router02Address = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
            const uniswapV2Router02Instance = new web3.eth.Contract(uniswapV2Router02.abiArray, uniswapV2Router02Address)
            const crvToStrategyTokenPortion = 92 // 20% manager fee + 80% * 90%
            const strategyTokenManageFeePortion = 22 // 92% * 22% = 20%
            const BELRewardsDistributionPortion = 50
            const swapToBELRouting = [tokenAddress.CRV.token, tokenAddress.WETH.token, tokenAddress.BEL.token]
            const swapToStrategyTokenRouting = [tokenAddress.CRV.token, tokenAddress.WETH.token, tokenAddress[strategyTokenSymbol].token]
            let curve
            let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('10000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // When Flex Savings USDT Strategy deposits 10,000 USDT to Curve 3pool
                // prepare strategy Token balance(10000 USDT) for governance
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                // do deposit
                await send(strategy, 'deposit', [], { from: governance })
                // run CurvePool simulation 
                let liquidityArr = new Array(poolParam.CURRENCY_NUMBER().toNumber()).fill(new BigNumber(0))
                liquidityArr[strategyTokenIndexInCurve3pool] = strategyTokenAmountToDeposit
                curve.add_liquidity(liquidityArr)
                // say 5 days passed and some exchange happened in curve 3pool
                await timeMachine.advanceTimeAndBlock(5 * day)
                // swap 60 * 5 million volume during 5 days
                await AccountUtils.giveERC20Token('USDT', governance, BNUtils.mul10pow(new BigNumber('25'), 6 + tokenAddress.USDT.decimals))
                await AccountUtils.giveERC20Token('USDC', governance, BNUtils.mul10pow(new BigNumber('25'), 6 + tokenAddress.USDC.decimals))
                await AccountUtils.giveERC20Token('DAI', governance, BNUtils.mul10pow(new BigNumber('25'), 6 + tokenAddress.DAI.decimals))
                await AccountUtils.doApprove('USDT', governance, curve3poolAddress, BNUtils.mul10pow(new BigNumber('20').muln(5), 7 + tokenAddress.USDT.decimals))
                await AccountUtils.doApprove('USDC', governance, curve3poolAddress, BNUtils.mul10pow(new BigNumber('20').muln(5), 7 + tokenAddress.USDC.decimals))
                await AccountUtils.doApprove('DAI', governance, curve3poolAddress, BNUtils.mul10pow(new BigNumber('20').muln(5), 7 + tokenAddress.DAI.decimals))
                for (let i = 0; i < 5; i++) {
                    await curve3poolInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('DAI'), poolParam.POOL_TOKEN.findIndex('USDC'), BNUtils.mul10pow(new BigNumber('20'), 6 + tokenAddress.DAI.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    await curve3poolInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('USDC'), poolParam.POOL_TOKEN.findIndex('USDT'), BNUtils.mul10pow(new BigNumber('20'), 6 + tokenAddress.USDC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    await curve3poolInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('USDT'), poolParam.POOL_TOKEN.findIndex('DAI'), BNUtils.mul10pow(new BigNumber('20'), 6 + tokenAddress.USDT.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    // run CurvePool simulation 
                    curve.exchange(poolParam.POOL_TOKEN.findIndex('DAI'), poolParam.POOL_TOKEN.findIndex('USDC'), BNUtils.mul10pow(new BigNumber('20'), 6 + tokenAddress.DAI.decimals))
                    curve.exchange(poolParam.POOL_TOKEN.findIndex('USDC'), poolParam.POOL_TOKEN.findIndex('USDT'), BNUtils.mul10pow(new BigNumber('20'), 6 + tokenAddress.USDC.decimals))
                    curve.exchange(poolParam.POOL_TOKEN.findIndex('USDT'), poolParam.POOL_TOKEN.findIndex('DAI'), BNUtils.mul10pow(new BigNumber('20'), 6 + tokenAddress.USDT.decimals))
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
                    let balanceOfStrategyTokenRewardsAddressBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, strategyTokenRewardsAddress)
                    let investmentStrategyTokenAmountBefore = await call(strategy, 'balanceInPool')
                    // do harvest
                    // claim CRV reward
                    // distribute CRV reward(swap to BEL and USDT)
                    // reinvest USDT: deposit & stake in Curve
                    let receipt = await send(strategy, 'harvest', [curveGaugeAddress], { from: governance })
                    let trxBlock = await web3.eth.getBlock(receipt.blockNumber)
                    claimTimeStamp = trxBlock.timestamp
                    let balanceOfBELRewardsAddressAfter = await AccountUtils.balanceOfERC20Token('BEL', BELRewardsAddress)
                    let balanceOfStrategyTokenRewardsAddressAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, strategyTokenRewardsAddress)
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
                    let invested3crvAmountBefore = new BigNumber(await curveGaugeInstance.methods.balanceOf(strategyAddress).call({}, 'latest'))
                    let expectedVirtualPriceBefore = curve.get_virtual_price()
                    let expectedBalanceInPoolBefore = invested3crvAmountBefore.mul(expectedVirtualPriceBefore).div(BNUtils.get10pow(tokenAddress._3CRV.decimals + tokenAddress._3CRV.decimals - tokenAddress[strategyTokenSymbol].decimals))
                    let strategyTokenAmountBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, strategyAddress)
                    // to make sure claimable crv equal to trx
                    await timeMachine.advanceBlockAndSetTime(claimTimeStamp)
                    let claimableCrvAmount = await curveGaugeInstance.methods.claimable_tokens(strategyAddress).call({}, 'latest')
                    await AccountUtils.giveERC20Token('CRV', governance, new BigNumber(claimableCrvAmount))
                    await AccountUtils.doApprove('CRV', governance, uniswapV2Router02Address, new BigNumber(claimableCrvAmount))
                    // execute uniswap swap to get accurate expect value and revert
                    // this is not accurate enough because wo need to do 2 swaps, and the former will influence the latter
                    // let swapedStrategyTokenAmount = await uniswapV2Router02Instance.methods.getAmountsOut(claimableCrvAmount, swap2USDTRouting).call({}, 'latest')
                    let crvAmountToSwapStrategyToken = new BigNumber(claimableCrvAmount).muln(crvToStrategyTokenPortion).divn(100)
                    let crvAmountToSwapBEL = new BigNumber(claimableCrvAmount).sub(crvAmountToSwapStrategyToken)
                    let governanceStrategyTokenAmountBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, governance)
                    let latestBlock = await web3.eth.getBlock('latest')
                    let swapDeadline = latestBlock.timestamp + day
                    await uniswapV2Router02Instance.methods.swapExactTokensForTokens(
                        crvAmountToSwapStrategyToken, 1, swapToStrategyTokenRouting, governance, swapDeadline
                    ).send({ from: governance, gas: 500000 })
                    let governanceStrategyTokenAmountAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, governance)
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
                    liquidityArr[strategyTokenIndexInCurve3pool] = reinvestedStrategyTokenAmount
                    let expectedReinvest3crvAmount = curve.add_liquidity(liquidityArr)
                    let expectedVirtualPriceAfter = curve.get_virtual_price()
                    let expectedBalanceInpoolAfter = invested3crvAmountBefore.add(expectedReinvest3crvAmount).mul(expectedVirtualPriceAfter).div(BNUtils.get10pow(tokenAddress._3CRV.decimals + tokenAddress._3CRV.decimals - tokenAddress[strategyTokenSymbol].decimals))
                    expectedInvestmentStrategyTokenAmount = expectedBalanceInpoolAfter.sub(expectedBalanceInPoolBefore)
                })
                // 1 - assert bella received by operations address
                AssertionUtils.assertBNEq(BELRewards, expectedBELRewards)
                // 2 - assert usdt manage fee received by operations address
                AssertionUtils.assertBNEq(strategyTokenManageFee, expectedStrategyTokenManageFee)
                // 3 - assert usdt reinvested into curve
                AssertionUtils.assertBNEq(investmentStrategyTokenAmount, expectedInvestmentStrategyTokenAmount)
            })
        })
    }
}