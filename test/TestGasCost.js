const AccountUtils = require("./utils/AccountUtils.js")
const BNUtils = require("./utils/BNUtils.js")
const timeMachine = require("./utils/TimeMachine.js")
const deploy = require("./lib/Deploy.js")
const BigNumber = require('bn.js')
const tokenAddress = require('./const/Token.js')
const strategyTokens = require('./const/StrategyToken.js')
const deployStaking = require("./lib/StakingDeploy.js");

jest.setTimeout(30 * 60 * 1000)

// run before set governanceAddress and deployerAddress as accounts[3] in Deploy.js
describe('Test BellaFlexsaving one day manual operation gas cost', testSuite('USDT'))


function testSuite(strategyTokenSymbol) {
    return () => {
        const governance = accounts[3]
        let vault
        let vaultAddress
        let strategy
        let strategyAddress
        let strategyToken
        let strategyTokenAddress
        let snapshotId
        let testUser = accounts[2]
        let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('10000'), tokenAddress[strategyTokenSymbol].decimals)
        const curveGaugeAddress = '0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB'

        async function getETHBalance(msg, address = governance) {
            console.log(msg)
            let balance = await AccountUtils.balanceOfETH(address)
            console.log(balance)
            return balance
        }

        async function doTrxAndCalcETHUsed(operationName, trx, address = governance) {
            let b0 = await getETHBalance('ETH balance before ' + operationName + '...', address)
            let res = await trx()
            let b1 = await getETHBalance('ETH balance after ' + operationName + '...', address)
            let gasUsedInEth = new BigNumber(b0).sub(new BigNumber(b1))
            console.log('gasUsedInEth: ' + gasUsedInEth.toString())
            return res
        }

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

        test('simulate and calculate FS cost', async () => {
            // deploy
            let deployAddress = await doTrxAndCalcETHUsed('deploy', async () => {
                return await deploy(saddle, governance, accounts, [strategyTokens[strategyTokenSymbol].index])
            })

            vaultAddress = deployAddress.vault[strategyTokenSymbol]
            strategyAddress = deployAddress.strategy[strategyTokenSymbol]
            strategyTokenAddress = tokenAddress[strategyTokenSymbol].token
            vault = await saddle.getContractAt('bVault', vaultAddress)
            strategy = await saddle.getContractAt(strategyTokens[strategyTokenSymbol].contractName, strategyAddress)
            strategyToken = await saddle.getContractAt('IERC20', strategyTokenAddress)

            // prepare user Token balance(10000 USDT) for testUser and deposit to vault
            await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
            await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
            // withdraw
            await doTrxAndCalcETHUsed('deposit', async () => {
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
            }, testUser)

            // earn 
            await doTrxAndCalcETHUsed('earn', async () => {
                await send(vault, 'earn', [], { from: governance })
            })
            // harvest
            await doTrxAndCalcETHUsed('harvest', async () => {
                await send(strategy, 'harvest', [curveGaugeAddress], { from: governance })
            })

            // let testUser withdraw to make vault buffer balance insufficient
            let testUserBTokenBalance = await call(vault, 'balanceOf', [testUser])

            let testUserBTokenAmountToWithdraw1 = new BigNumber(testUserBTokenBalance).muln(8).divn(100)
            await doTrxAndCalcETHUsed('withdraw', async () => {
                await send(vault, 'withdraw', [testUserBTokenAmountToWithdraw1], { from: testUser })
            }, testUser)

            let testUserBTokenAmountToWithdraw2 = new BigNumber(testUserBTokenBalance).muln(8).divn(10)
            await doTrxAndCalcETHUsed('withdraw', async () => {
                await send(vault, 'withdraw', [testUserBTokenAmountToWithdraw2], { from: testUser })
            }, testUser)

            // rebalance
            await doTrxAndCalcETHUsed('rebalance', async () => {
                await send(vault, 'rebalance', [], { from: governance })
            })

        })

        test.only('simulate and calculate staking deploy cost', async () => {
            // deploy
            const deployer = accounts[4]

            await doTrxAndCalcETHUsed('deploy 2 staking pool', async () => {
                await deployStaking(saddle, deployer, governance)
            }, deployer)
        })
    }
}


