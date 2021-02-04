const AssertionUtils = require("./utils/AssertionUtils.js")
const AccountUtils = require("./utils/AccountUtils.js")
const BNUtils = require("./utils/BNUtils.js")
const timeMachine = require("./utils/TimeMachine.js")
const deploy = require("./lib/Deploy.js")
const BigNumber = require('bn.js')
const tokenAddress = require('./const/Token.js')
const strategyTokens = require('./const/StrategyToken.js')

jest.setTimeout(30 * 60 * 1000)

describe('Test BellaFlexsaving ARPA Vault', vaultTestSuite('ARPA'))

function vaultTestSuite(strategyTokenSymbol) {
    return () => {
        const governance = accounts[0]
        let vault
        let vaultAddress
        let strategy
        let strategyAddress
        let strategyToken
        let strategyTokenAddress
        let snapshotId

        beforeAll(async (done) => {
            let trxBlock = await web3.eth.getBlock('latest')
            let arpaVaultStartTimestamp = trxBlock.timestamp
            let deployAddress = await deploy(saddle, accounts[0], accounts, [strategyTokens[strategyTokenSymbol].index], arpaVaultStartTimestamp)
            vaultAddress = deployAddress.vault[strategyTokenSymbol]
            strategyAddress = deployAddress.strategy[strategyTokenSymbol]
            strategyTokenAddress = tokenAddress[strategyTokenSymbol].token
            vault = await saddle.getContractAt('bVault', vaultAddress)
            strategy = await saddle.getContractAt(strategyTokens[strategyTokenSymbol].contractName, strategyAddress)
            strategyToken = await saddle.getContractAt('IERC20', strategyTokenAddress)
            done()
        })

        describe('Test Vault deposit-1', () => {
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('10000'), tokenAddress[strategyTokenSymbol].decimals)
            let directRewardTokenAmount = BNUtils.mul10pow(new BigNumber('100000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // make governance deposit first to mint some bToken
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, governance, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: governance })
                // prepare for bToken exchange rate
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, directRewardTokenAmount)
                await send(strategyToken, 'transfer', [strategyAddress, directRewardTokenAmount.toString()], { from: governance })

                // prepare user Token balance(10000 ARPA) for testUser
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                done()
            })

            // Happy Path #1:
            // Given userA’s wallet address is not a contract address
            // And the bVault is not paused
            // And bARPA to ARPA exchange rate equals 1.0100 *which is, let someone deposit first and then, transfer some token to strategy
            // When userA deposits 10000 ARPA
            // Then the bARPA balance of userA’s wallet address(0x) equals 9900.9901
            it('deposit in happy path', async () => {
                // check bToken exchange rate for now
                let bTokenTotalSupply = await call(vault, 'totalSupply')
                let vaultBalance = await call(vault, 'balance')
                // let bTokenExchangeRate = await call(vault, 'getPricePerFullShare')
                // get expected value
                let expectedBTokenMintByDeposit = userTokenAmountToDeposit.mul(new BigNumber(bTokenTotalSupply)).div(new BigNumber(vaultBalance))
                // do deposit
                let bTokenBalanceOfUserBefore = await call(vault, 'balanceOf', [testUser])
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                let bTokenBalanceOfUserAfter = await call(vault, 'balanceOf', [testUser])
                let bTokenMintByDeposit = new BigNumber(bTokenBalanceOfUserAfter).sub(new BigNumber(bTokenBalanceOfUserBefore))
                // assert bTokenMintByDeposit equals expected
                AssertionUtils.assertBNGt(bTokenMintByDeposit, 0)
                AssertionUtils.assertBNEq(bTokenMintByDeposit, expectedBTokenMintByDeposit)
            })

        })

        describe('Test Vault deposit-2', () => {
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('10000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(10000 ARPA) for testUser
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                done()
            })

            // Unhappy Path #1:
            // Given contractA’s address is not whitelisted
            // And the bVault is not paused
            // When contractA deposits any amount of ARPA
            // Then Error: “not in white list”
            it('deposit in unhappy path', async () => {
                // deploy test contract
                let testContractInstance = await saddle.deploy('TestVaultDeposit', [vaultAddress, strategyTokenAddress], { from: testUser })
                await send(strategyToken, 'transfer', [testContractInstance._address, userTokenAmountToDeposit.toString()], { from: testUser })
                // do deposit
                let trxFromContractOutsideWhitelist = send(testContractInstance, 'deposit', [], { from: testUser })
                // assert throw error
                await AssertionUtils.assertThrowErrorAsync(trxFromContractOutsideWhitelist, 'not in white list')
            })
        })

        describe('Test Vault earn-1', () => {
            let testUser = accounts[2]

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
                // prepare user Token balance(250000 ARPA) for testUser and deposit to vault
                let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('250000'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // prepare strategy Token balance(750000 ARPA) for governance and transfer to strategy
                let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('750000'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                done()
            })

            // Happy Path #1
            // Given ARPA vault balance equals 250,000
            // And ARPA vault Buffer equals 10%
            // And ARPA vault total ARPA deposit equals 1,000,000
            // When userA (anyone) call Earn at ARPA vault
            // Then the amount of ARPA transfered from ARPA vault to ARPA strategy equals 150,000
            // Then the remaining amount of ARPA in ARPA vault equals 100,000
            it('earn in happy path', async () => {
                let expectedTokenAmountToStrategy = BNUtils.mul10pow(new BigNumber('150000'), tokenAddress[strategyTokenSymbol].decimals)
                let tokenAmountToStrategy = await call(vault, 'available')
                AssertionUtils.assertBNEq(tokenAmountToStrategy, expectedTokenAmountToStrategy)
                // do earn
                await send(vault, 'earn', [], { from: governance })
                let expectedTokenAmountInVault = BNUtils.mul10pow(new BigNumber('100000'), tokenAddress[strategyTokenSymbol].decimals)
                let tokenAmountInVault = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, vaultAddress)
                AssertionUtils.assertBNEq(tokenAmountInVault, expectedTokenAmountInVault)
            })
        })

        describe('Test Vault earn-2', () => {
            let testUser = accounts[2]

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
                // prepare user Token balance(250000 ARPA) for testUser and deposit to vault
                let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('70000'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // prepare strategy Token balance(750000 ARPA) for governance and transfer to strategy
                let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('930000'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                done()
            })

            // Unhappy Path #1:
            // Given ARPA vault balance equals 70,000
            // And ARPA vault Buffer equals 10%
            // And ARPA vault total ARPA deposit equals 1,000,000
            // When userA (anyone) call Earn at ARPA vault
            // Then Error "Not enough ARPA to be deposited to strategy"
            it('earn in unhappy path', async () => {
                // do earn
                let earnTrx = send(vault, 'earn', [], { from: governance })
                // assert throw error
                await AssertionUtils.assertThrowErrorAsync(earnTrx, 'subtraction overflow')
            })
        })

        describe('Test Vault withdraw-1', () => {
            const day = 24 * 60 * 60
            const vaultWithdrawalManageFeePortion = 25
            const vaultWithdrawalManageFeeBase = 10000
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('10000'), tokenAddress[strategyTokenSymbol].decimals)
            let rewardCycleInDay = 10
            let rewardTokenAmountToLock = BNUtils.mul10pow(new BigNumber('100000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // make governance deposit first to mint some bToken
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, governance, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: governance })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare for bToken exchange rate
                {
                    await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, rewardTokenAmountToLock)
                    await AccountUtils.doApprove(strategyTokenSymbol, governance, strategyAddress, rewardTokenAmountToLock)
                    await send(strategy, 'lock', [rewardTokenAmountToLock.toString(), rewardCycleInDay], { from: governance })
                    // say 5 days passed
                    await timeMachine.advanceTimeAndBlock(5 * day)
                }
                // do harvest
                await send(strategy, 'harvest', [], { from: governance })
                // prepare user Token balance(10000 ARPA) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                done()
            })

            // Happy Path #1:
            // Given the bARPA balance of userA’s wallet address(0x) equals 9900.9901
            // And bARPA to ARPA exchange rate equals 1.0100
            // When userA withdraws 5000 bARPA(returning 5000 bARPA in exchange for 5050 ARPA)
            // And withdrawal fee 0.25% deduction equals 12.625 bARPA
            // Then ARPA balance of userA’s wallet address(0x) equals 5,037.375
            // Then the bARPA balance of userA’s wallet address(0x) equals 4900.9901
            it('withdraw in happy path-1', async () => {
                let userTokenBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                let userBTokenBalanceBefore = await call(vault, 'balanceOf', [testUser])
                let userBTokenAmountToWithdraw = new BigNumber(userBTokenBalanceBefore).divn(2)
                let bTokenTotalSupply = await call(vault, 'totalSupply')
                let vaultBalance = await call(vault, 'balance')
                // get expected value
                let expectedTokenAmountToWithdrawWithoutFee = userBTokenAmountToWithdraw.mul(new BigNumber(vaultBalance)).div(new BigNumber(bTokenTotalSupply))
                let expectedWithdrawalFee = expectedTokenAmountToWithdrawWithoutFee.muln(vaultWithdrawalManageFeePortion).divn(vaultWithdrawalManageFeeBase)
                // do withdraw
                await send(vault, 'withdraw', [userBTokenAmountToWithdraw.toString()], { from: testUser })
                let userBTokenBalanceAfter = await call(vault, 'balanceOf', [testUser])
                AssertionUtils.assertBNEq(new BigNumber(userBTokenBalanceBefore).sub(new BigNumber(userBTokenBalanceAfter)), userBTokenAmountToWithdraw)
                let userTokenBalanceAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                AssertionUtils.assertBNEq(new BigNumber(userTokenBalanceAfter).sub(new BigNumber(userTokenBalanceBefore)), expectedTokenAmountToWithdrawWithoutFee.sub(expectedWithdrawalFee))
            })
        })

        describe('Test Vault withdraw-2', () => {
            const day = 24 * 60 * 60
            const vaultWithdrawalManageFeePortion = 25
            const vaultWithdrawalManageFeeBase = 10000
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('10000'), tokenAddress[strategyTokenSymbol].decimals)
            let rewardCycleInDay = 10
            let rewardTokenAmountToLock = BNUtils.mul10pow(new BigNumber('100000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // make governance deposit first to mint some bToken
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, governance, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: governance })
                // prepare user Token balance(10000 ARPA) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare for bToken exchange rate
                {
                    await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, rewardTokenAmountToLock)
                    await AccountUtils.doApprove(strategyTokenSymbol, governance, strategyAddress, rewardTokenAmountToLock)
                    await send(strategy, 'lock', [rewardTokenAmountToLock.toString(), rewardCycleInDay], { from: governance })
                    // say 5 days passed
                    await timeMachine.advanceTimeAndBlock(5 * day)
                }
                // do harvest
                await send(strategy, 'harvest', [], { from: governance })
                // make governance withdraw all his deposit amount to let vault balance insufficient
                let governanceBTokenBalance = await call(vault, 'balanceOf', [governance])
                let userBTokenAmountToWithdraw = new BigNumber(governanceBTokenBalance)
                let bTokenTotalSupply = await call(vault, 'totalSupply')
                let vaultBalance = await call(vault, 'balance')
                // get expected value
                let expectedTokenAmountToWithdrawWithoutFee = userBTokenAmountToWithdraw.mul(new BigNumber(vaultBalance)).div(new BigNumber(bTokenTotalSupply))
                let expectedWithdrawalFee = expectedTokenAmountToWithdrawWithoutFee.muln(vaultWithdrawalManageFeePortion).divn(vaultWithdrawalManageFeeBase)
                let userTokenBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, governance)
                await send(vault, 'withdraw', [governanceBTokenBalance], { from: governance })
                let userTokenBalanceAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, governance)
                AssertionUtils.assertBNEq(new BigNumber(userTokenBalanceAfter).sub(new BigNumber(userTokenBalanceBefore)), expectedTokenAmountToWithdrawWithoutFee.sub(expectedWithdrawalFee))
                done()
            })

            // Happy Path #2:
            // Given the governance deposit 10000 ARPA to vault for 10000 bARPA
            // And userA deposit 10000 ARPA to vault for 10000 bARPA
            // And someone call earn 
            // And we lock 100000 ARPA of 10 day cycle
            // And 5 day passed 
            // And withdrawal fee 0.25% deduction
            // And the governance withdraw all his bARPA back(he will get (10000 + (100000 * 5 / 10 / 2)) * (1 - 0.25%) = 24937.5 ARPA or based on bARPA totalSupply and vault balance)
            // When userA withdraws 10000 bARPA
            // *and vault buffer is not enough to pay for withdrawal
            // Then userA will get ARPA based on bARPA totalSupply and vault balance
            // Then balance in vault equals 0
            it('withdraw in happy path-2', async () => {
                let userTokenBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                let userBTokenBalanceBefore = await call(vault, 'balanceOf', [testUser])
                // we can withdraw all money out in arpa pool
                let userBTokenAmountToWithdraw = new BigNumber(userBTokenBalanceBefore)
                let bTokenTotalSupply = await call(vault, 'totalSupply')
                let vaultBalanceBefore = await call(vault, 'balance')
                // get expected value
                let expectedTokenAmountToWithdrawWithoutFee = userBTokenAmountToWithdraw.mul(new BigNumber(vaultBalanceBefore)).div(new BigNumber(bTokenTotalSupply))
                let expectedWithdrawalFee = expectedTokenAmountToWithdrawWithoutFee.muln(vaultWithdrawalManageFeePortion).divn(vaultWithdrawalManageFeeBase)
                // do withdraw
                await send(vault, 'withdraw', [userBTokenAmountToWithdraw.toString()], { from: testUser })
                let userBTokenBalanceAfter = await call(vault, 'balanceOf', [testUser])
                AssertionUtils.assertBNEq(new BigNumber(userBTokenBalanceBefore).sub(new BigNumber(userBTokenBalanceAfter)), userBTokenAmountToWithdraw)
                let userTokenBalanceAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                AssertionUtils.assertBNEq(new BigNumber(userTokenBalanceAfter).sub(new BigNumber(userTokenBalanceBefore)), expectedTokenAmountToWithdrawWithoutFee.sub(expectedWithdrawalFee))
                let vaultBalanceAfter = await call(vault, 'balance')
                AssertionUtils.assertBNEq(vaultBalanceAfter, 0)
            })
        })

        describe('Test Vault withdrawAll', () => {
            const day = 24 * 60 * 60
            const vaultWithdrawalManageFeePortion = 25
            const vaultWithdrawalManageFeeBase = 10000
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('10000'), tokenAddress[strategyTokenSymbol].decimals)
            let rewardCycleInDay = 10
            let rewardTokenAmountToLock = BNUtils.mul10pow(new BigNumber('100000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // make governance deposit first to mint some bToken
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, governance, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: governance })
                // prepare user Token balance(10000 ARPA) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare for bToken exchange rate
                {
                    await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, rewardTokenAmountToLock)
                    await AccountUtils.doApprove(strategyTokenSymbol, governance, strategyAddress, rewardTokenAmountToLock)
                    await send(strategy, 'lock', [rewardTokenAmountToLock.toString(), rewardCycleInDay], { from: governance })
                    // say 5 days
                    await timeMachine.advanceTimeAndBlock(5 * day)
                }
                // do harvest
                await send(strategy, 'harvest', [], { from: governance })
                done()
            })

            // Happy Path #1:
            // Given the bARPA balance of userA’s wallet address(0x) equals 9900.9901
            // And bARPA to ARPA exchange rate equals 1.0100
            // When userA withdraws all ARPA(returning all bARPA in exchange for ARPA)
            // Then the bARPA balance of userA’s wallet address(0x) equals 0
            // And the ARPA balance of userA’s wallet address(0x) equals 10000
            // 0.25% withdrawal fee
            it('withdrawAll in happy path', async () => {
                let userTokenBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                let userBTokenBalanceBefore = await call(vault, 'balanceOf', [testUser])
                // can not withdraw all money out because of earn loss from curve fee and harvest(reinvest) after 5 days can not cover that, or assertion will be inaccurate
                let userBTokenAmountToWithdraw = new BigNumber(userBTokenBalanceBefore)
                let bTokenTotalSupply = await call(vault, 'totalSupply')
                let vaultBalance = await call(vault, 'balance')
                // get expected value
                let expectedTokenAmountToWithdrawWithoutFee = userBTokenAmountToWithdraw.mul(new BigNumber(vaultBalance)).div(new BigNumber(bTokenTotalSupply))
                let expectedWithdrawalFee = expectedTokenAmountToWithdrawWithoutFee.muln(vaultWithdrawalManageFeePortion).divn(vaultWithdrawalManageFeeBase)
                // do withdrawAll
                await send(vault, 'withdrawAll', [], { from: testUser })
                let userBTokenBalanceAfter = await call(vault, 'balanceOf', [testUser])
                AssertionUtils.assertBNEq(new BigNumber(userBTokenBalanceAfter), 0)
                let userTokenBalanceAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                AssertionUtils.assertBNEq(new BigNumber(userTokenBalanceAfter).sub(new BigNumber(userTokenBalanceBefore)), expectedTokenAmountToWithdrawWithoutFee.sub(expectedWithdrawalFee))
            })
        })

        describe('Test Vault rebalance-1', () => {
            const day = 24 * 60 * 60
            const vaultBufferPortion = 10
            const vaultBufferBase = 100
            const withdrawalCompensationPortion = 30
            const withdrawalCompensationBase = 10000
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('10000'), tokenAddress[strategyTokenSymbol].decimals)
            let rewardCycleInDay = 10
            let rewardTokenAmountToLock = BNUtils.mul10pow(new BigNumber('100000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // make governance deposit first to mint some bToken
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, governance, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: governance })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare for bToken exchange rate
                {
                    await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, rewardTokenAmountToLock)
                    await AccountUtils.doApprove(strategyTokenSymbol, governance, strategyAddress, rewardTokenAmountToLock)
                    await send(strategy, 'lock', [rewardTokenAmountToLock.toString(), rewardCycleInDay], { from: governance })
                    // say 5 days passed
                    await timeMachine.advanceTimeAndBlock(5 * day)
                }
                // do harvest
                await send(strategy, 'harvest', [], { from: governance })
                // make governance withdraw most of his deposit amount to let vault balance insufficient
                let governanceBTokenBalance = await call(vault, 'balanceOf', [governance])
                await send(vault, 'withdraw', [new BigNumber(governanceBTokenBalance).muln(8).divn(10).toString()], { from: governance })
                done()
            })

            // Happy Path #1:
            // Given ARPA vault balance equals 80,000
            // And ARPA vault Buffer equals 10%
            // And ARPA vault total ARPA deposit equals 1,000,000
            // When userA (anyone) call Rebalance at ARPA vault
            // Then the amount of ARPA withdrawn from ARPA strategy back to ARPA vault equals 20,000
            // Then the remaining amount of ARPA in ARPA vault equals 100,000
            it('rebalance in happy path', async () => {
                let vaultBalance = await call(vault, 'balance', [])
                let expectedVaultBufferAmount = new BigNumber(vaultBalance).muln(vaultBufferPortion).divn(vaultBufferBase)
                let vaultTokenBufferAmountBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, vaultAddress)
                // do rebalance
                await send(vault, 'rebalance', [], { from: governance })
                let vaultTokenBufferAmountAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, vaultAddress)
                // acutually these two assertions are same
                // for withdrawCompensation in strategy, vault buffer balance after `rebalance` can be a little more than expected 
                AssertionUtils.assertBNApproxRange(new BigNumber(vaultTokenBufferAmountAfter).sub(new BigNumber(vaultTokenBufferAmountBefore)), expectedVaultBufferAmount.sub(new BigNumber(vaultTokenBufferAmountBefore)), withdrawalCompensationPortion, withdrawalCompensationBase)
                AssertionUtils.assertBNApproxRange(vaultTokenBufferAmountAfter, expectedVaultBufferAmount, withdrawalCompensationPortion, withdrawalCompensationBase)
            })
        })

        describe('Test Vault rebalance-2', () => {
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('10000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // make governance deposit first to mint some bToken
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, governance, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: governance })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare user Token balance(10000 ARPA) for testUser and deposit to vault, to let vault buffer sufficient
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                done()
            })

            // Unhappy Path #1:
            // Given ARPA vault balance equals 120,000
            // And ARPA vault Buffer equals 10%
            // And ARPA vault total ARPA deposit equals 1,000,000
            // When userA (anyone) call Rebalance at ARPA vault
            // Then Error “No need for rebalance”
            it('rebalance in unhappy path', async () => {
                // do rebalance
                let rebalanceTrx = send(vault, 'rebalance', [], { from: governance })
                // assert throw error
                await AssertionUtils.assertThrowErrorAsync(rebalanceTrx, 'subtraction overflow')
            })
        })
    }
}


