const AssertionUtils = require("./utils/AssertionUtils.js")
const AccountUtils = require("./utils/AccountUtils.js")
const BNUtils = require("./utils/BNUtils.js")
const timeMachine = require("./utils/TimeMachine.js")
const deploy = require("./lib/Deploy.js")
const BigNumber = require('bn.js')
const tokenAddress = require('./const/Token.js')
const strategyTokens = require('./const/StrategyToken.js')

jest.setTimeout(30 * 60 * 1000)

describe('Test BellaFlexsaving StrategyARPA', strategyTestSuite('ARPA'))

function strategyTestSuite(strategyTokenSymbol) {
    return () => {
        let governance
        let strategy
        let strategyAddress
        let lockedPoolAddress
        let snapshotId

        beforeAll(async (done) => {
            let trxBlock = await web3.eth.getBlock('latest')
            let arpaVaultStartTimestamp = trxBlock.timestamp
            let deployAddress = await deploy(saddle, accounts[0], accounts, [strategyTokens[strategyTokenSymbol].index], arpaVaultStartTimestamp)
            governance = deployAddress.governance
            strategyAddress = deployAddress.strategy[strategyTokenSymbol]
            strategy = await saddle.getContractAt(strategyTokens[strategyTokenSymbol].contractName, strategyAddress)
            lockedPoolAddress = await call(strategy, 'lockedPool')
            done()
        })

        describe('Test Strategy lock', () => {
            const day = 24 * 60 * 60
            let rewardTokenAmountToLock = BNUtils.mul10pow(new BigNumber('100000'), tokenAddress[strategyTokenSymbol].decimals)
            let rewardCycleInDay = 10

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
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, rewardTokenAmountToLock)
                await AccountUtils.doApprove(strategyTokenSymbol, governance, strategyAddress, rewardTokenAmountToLock)
                done()
            })

            it('lp strategy can accurately lock', async () => {
                let receipt = await send(strategy, 'lock', [rewardTokenAmountToLock.toString(), rewardCycleInDay], { from: governance })
                let trxBlock = await web3.eth.getBlock(receipt.blockNumber)
                let expectedLastUnlockTime = trxBlock.timestamp
                let currentUnlockCycle = await call(strategy, 'currentUnlockCycle')
                let lastUnlockTime = await call(strategy, 'lastUnlockTime')
                let lockedPoolBalance = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, lockedPoolAddress)
                AssertionUtils.assertBNEq(lockedPoolBalance, rewardTokenAmountToLock)
                AssertionUtils.assertBNEq(currentUnlockCycle, rewardCycleInDay * day)
                AssertionUtils.assertBNEq(lastUnlockTime, expectedLastUnlockTime)
            })
        })

        describe('Test Strategy harvest-1', () => {
            const day = 24 * 60 * 60
            let rewardTokenAmountToLock = BNUtils.mul10pow(new BigNumber('100000'), tokenAddress[strategyTokenSymbol].decimals)
            let rewardCycleInDay = 10

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
                // lock 100000 arpa by governance
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, rewardTokenAmountToLock)
                await AccountUtils.doApprove(strategyTokenSymbol, governance, strategyAddress, rewardTokenAmountToLock)
                await send(strategy, 'lock', [rewardTokenAmountToLock.toString(), rewardCycleInDay], { from: governance })
                // say 5 days passed
                await timeMachine.advanceTimeAndBlock(5 * day)
                done()
            })

            it('lp strategy can accurately harvest first', async () => {
                let lastUnlockTimeBefore = await call(strategy, 'lastUnlockTime')
                let strategyTokenBalanceBefore = await call(strategy, 'balanceOf')
                let currentUnlockCycleBefore = await call(strategy, 'currentUnlockCycle')
                // do harvest
                let receipt = await send(strategy, 'harvest', [], { from: governance })
                let trxBlock = await web3.eth.getBlock(receipt.blockNumber)
                let harvestTime = trxBlock.timestamp
                let strategyTokenBalanceAfter = await call(strategy, 'balanceOf')
                let currentUnlockCycleAfter = await call(strategy, 'currentUnlockCycle')
                let harvestTimeDelta = new BigNumber(harvestTime).sub(new BigNumber(lastUnlockTimeBefore))
                let expectedHarvestTokenAmount = rewardTokenAmountToLock.mul(harvestTimeDelta).div(new BigNumber(rewardCycleInDay * day))
                let lastUnlockTimeAfter = await call(strategy, 'lastUnlockTime')
                // 1 - assert strategy token balance
                AssertionUtils.assertBNEq(new BigNumber(strategyTokenBalanceAfter).sub(new BigNumber(strategyTokenBalanceBefore)), expectedHarvestTokenAmount)
                // 2 - assert lastUnlockTime
                AssertionUtils.assertBNEq(lastUnlockTimeAfter, harvestTime)
                // 3 - assert currentUnlockCycle
                AssertionUtils.assertBNEq(currentUnlockCycleAfter, new BigNumber(currentUnlockCycleBefore).sub(harvestTimeDelta))
            })
        })

        describe('Test Strategy harvest-2', () => {
            const day = 24 * 60 * 60
            let rewardTokenAmountToLock = BNUtils.mul10pow(new BigNumber('100000'), tokenAddress[strategyTokenSymbol].decimals)
            let rewardCycleInDay = 10

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
                // lock 100000 arpa by governance
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, rewardTokenAmountToLock)
                await AccountUtils.doApprove(strategyTokenSymbol, governance, strategyAddress, rewardTokenAmountToLock)
                await send(strategy, 'lock', [rewardTokenAmountToLock.toString(), rewardCycleInDay], { from: governance })
                // say 3 days passed
                await timeMachine.advanceTimeAndBlock(3 * day)
                // do harvest
                await send(strategy, 'harvest', [], { from: governance })
                // say another 4 days passed
                await timeMachine.advanceTimeAndBlock(4 * day)
                done()
            })

            it('lp strategy can accurately harvest second', async () => {
                let lastUnlockTimeBefore = await call(strategy, 'lastUnlockTime')
                let strategyTokenBalanceBefore = await call(strategy, 'balanceOf')
                let currentUnlockCycleBefore = await call(strategy, 'currentUnlockCycle')
                let lockedPoolBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, lockedPoolAddress)
                // do harvest
                let receipt = await send(strategy, 'harvest', [], { from: governance })
                let trxBlock = await web3.eth.getBlock(receipt.blockNumber)
                let harvestTime = trxBlock.timestamp
                let strategyTokenBalanceAfter = await call(strategy, 'balanceOf')
                let currentUnlockCycleAfter = await call(strategy, 'currentUnlockCycle')
                let harvestTimeDelta = new BigNumber(harvestTime).sub(new BigNumber(lastUnlockTimeBefore))
                let expectedHarvestTokenAmount = new BigNumber(lockedPoolBalanceBefore).mul(harvestTimeDelta).div(new BigNumber(currentUnlockCycleBefore))
                let lastUnlockTimeAfter = await call(strategy, 'lastUnlockTime')
                // 1 - assert strategy token balance
                AssertionUtils.assertBNEq(new BigNumber(strategyTokenBalanceAfter).sub(new BigNumber(strategyTokenBalanceBefore)), expectedHarvestTokenAmount)
                // 2 - assert lastUnlockTime
                AssertionUtils.assertBNEq(lastUnlockTimeAfter, harvestTime)
                // 3 - assert currentUnlockCycle
                AssertionUtils.assertBNEq(currentUnlockCycleAfter, new BigNumber(currentUnlockCycleBefore).sub(harvestTimeDelta))
            })
        })

        describe('Test Strategy harvest-3', () => {
            const day = 24 * 60 * 60
            let rewardTokenAmountToLock = BNUtils.mul10pow(new BigNumber('100000'), tokenAddress[strategyTokenSymbol].decimals)
            let rewardCycleInDay = 10

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
                // lock 100000 arpa by governance
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, rewardTokenAmountToLock)
                await AccountUtils.doApprove(strategyTokenSymbol, governance, strategyAddress, rewardTokenAmountToLock)
                await send(strategy, 'lock', [rewardTokenAmountToLock.toString(), rewardCycleInDay], { from: governance })
                // say 3 days passed
                await timeMachine.advanceTimeAndBlock(3 * day)
                // do harvest
                await send(strategy, 'harvest', [], { from: governance })
                // say another 4 days passed
                await timeMachine.advanceTimeAndBlock(4 * day)
                // do harvest
                await send(strategy, 'harvest', [], { from: governance })
                // say another 4 days passed, which adds up greater than rewardCycle(10 day)
                await timeMachine.advanceTimeAndBlock(4 * day)
                done()
            })

            it('lp strategy can accurately harvest finally', async () => {
                let lastUnlockTimeBefore = await call(strategy, 'lastUnlockTime')
                let strategyTokenBalanceBefore = await call(strategy, 'balanceOf')
                let currentUnlockCycleBefore = await call(strategy, 'currentUnlockCycle')
                let lockedPoolBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, lockedPoolAddress)
                // do harvest
                let receipt = await send(strategy, 'harvest', [], { from: governance })
                let trxBlock = await web3.eth.getBlock(receipt.blockNumber)
                let harvestTime = trxBlock.timestamp
                let strategyTokenBalanceAfter = await call(strategy, 'balanceOf')
                let currentUnlockCycleAfter = await call(strategy, 'currentUnlockCycle')
                let harvestTimeDelta = new BigNumber(harvestTime).sub(new BigNumber(lastUnlockTimeBefore))
                // 1 - assert harvestTimeDelta
                AssertionUtils.assertBNGt(harvestTimeDelta, currentUnlockCycleBefore)
                let expectedHarvestTokenAmount = new BigNumber(lockedPoolBalanceBefore)
                let lastUnlockTimeAfter = await call(strategy, 'lastUnlockTime')
                // 2 - assert strategy token balance
                AssertionUtils.assertBNEq(new BigNumber(strategyTokenBalanceAfter).sub(new BigNumber(strategyTokenBalanceBefore)), expectedHarvestTokenAmount)
                // 3 - assert lastUnlockTime
                AssertionUtils.assertBNEq(lastUnlockTimeAfter, harvestTime)
                // 4 - assert currentUnlockCycle
                AssertionUtils.assertBNEq(currentUnlockCycleAfter, 0)
            })
        })
    }
}