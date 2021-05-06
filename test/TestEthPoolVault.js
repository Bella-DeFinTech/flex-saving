const AssertionUtils = require("./utils/AssertionUtils.js")
const AccountUtils = require("./utils/AccountUtils.js")
const BNUtils = require("./utils/BNUtils.js")
const timeMachine = require("./utils/TimeMachine.js")
const deploy = require("./lib/Deploy.js")
const BigNumber = require('bn.js')
const tokenAddress = require('./const/Token.js')
const strategyTokens = require('./const/StrategyToken.js')
const cyWETH = require('./abi/cyWETH.js')

jest.setTimeout(30 * 60 * 1000)

describe('Test BellaFlexsaving ETH Vault', vaultTestSuite('WETH'))

function vaultTestSuite(strategyTokenSymbol) {
    return () => {
        let governance
        let vault
        let vaultAddress
        let strategy
        let strategyAddress
        let strategyToken
        let strategyTokenAddress
        let controller
        let controllerAddress
        let snapshotId
        beforeAll(async (done) => {
            let deployAddress = await deploy(saddle, accounts[0], accounts, [strategyTokens[strategyTokenSymbol].index])
            governance = deployAddress.governance
            vaultAddress = deployAddress.vault[strategyTokenSymbol]
            strategyAddress = deployAddress.strategy[strategyTokenSymbol]
            strategyTokenAddress = tokenAddress[strategyTokenSymbol].token
            controllerAddress = deployAddress.controller
            vault = await saddle.getContractAt('bVault', vaultAddress)
            strategy = await saddle.getContractAt(strategyTokens[strategyTokenSymbol].contractName, strategyAddress)
            strategyToken = await saddle.getContractAt('IERC20', strategyTokenAddress)
            controller = await saddle.getContractAt('Controller', controllerAddress)
            done()
        })

        describe('Test Vault deposit-1', () => {
            const day = 24 * 60 * 60
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[strategyTokenSymbol].decimals)

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
                {
                    // prepare strategy Token balance(1000 ETH) for governance
                    let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[strategyTokenSymbol].decimals)
                    await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                    await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                    // do deposit to curve pool from strategy, take this as reinvestment
                    await send(strategy, 'deposit', [], { from: governance })
                    // say 5 days passed 
                    await timeMachine.advanceTimeAndBlock(5 * day)
                }
                // prepare user Token balance(1000 ETH) for testUser
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                done()
            })

            // Happy Path #1:
            // Given userA’s wallet address is not a contract address
            // And the bVault is not paused
            // And bWETH to WETH exchange rate equals 1.0100 *which is, let someone deposit first and then, reinvest some amount to strategy pool and 5 days passed
            // When userA deposits 1000 ETH
            // Then the bWETH balance of userA’s wallet address(0x) equals 990.09901
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
                AssertionUtils.assertBNApproxRange(bTokenMintByDeposit, expectedBTokenMintByDeposit, 1, 10000)
            })

        })

        describe('Test Vault deposit-2', () => {
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(1000 ETH) for testUser
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                done()
            })

            // Unhappy Path #1:
            // Given contractA’s address is not whitelisted
            // And the bVault is not paused
            // When contractA deposits any amount of WETH
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
                // prepare user Token balance(250000 WETH) for testUser and deposit to vault
                let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('2500'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // prepare strategy Token balance(750000 WETH) for governance and transfer to strategy
                let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('7500'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                done()
            })

            // Happy Path #1
            // Given WETH vault balance equals 2,500
            // And WETH vault Buffer equals 10%
            // And WETH vault total WETH deposit equals 1,000,000
            // When userA (anyone) call Earn at WETH vault
            // Then the amount of WETH deployed from WETH vault to WETH strategy equals 1,500
            // Then the remaining amount of WETH in WETH vault equals 1,000
            it('earn in happy path', async () => {
                let expectedTokenAmountToStrategy = BNUtils.mul10pow(new BigNumber('1500'), tokenAddress[strategyTokenSymbol].decimals)
                let tokenAmountToStrategy = await call(vault, 'available')
                AssertionUtils.assertBNApproxRange(tokenAmountToStrategy, expectedTokenAmountToStrategy, 1, 10000)
                // do earn
                await send(vault, 'earn', [], { from: governance })
                let expectedTokenAmountInVault = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[strategyTokenSymbol].decimals)
                let tokenAmountInVault = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, vaultAddress)
                AssertionUtils.assertBNApproxRange(tokenAmountInVault, expectedTokenAmountInVault, 1, 10000)
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
                // prepare user Token balance(2500 WETH) for testUser and deposit to vault
                let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('700'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // prepare strategy Token balance(7500 WETH) for governance and transfer to strategy
                let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('9300'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                done()
            })

            // Unhappy Path #1:
            // Given WETH vault balance equals 700
            // And WETH vault Buffer equals 10%
            // And WETH vault total WETH deposit equals 10,000
            // When userA (anyone) call Earn at WETH vault
            // Then Error "Not enough WETH to be deployed to strategy"
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
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[strategyTokenSymbol].decimals)

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
                    // say 5 days passed 
                    await timeMachine.advanceTimeAndBlock(5 * day)
                }
                // prepare user Token balance(1000 ETH) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                done()
            })

            // Happy Path #1:
            // Given the bWETH balance of userA’s wallet address(0x) equals 990.09901
            // And bWETH to WETH exchange rate equals 1.0100
            // When userA withdraws 5000 bWETH(returning 500 bWETH in exchange for 505 WETH)
            // And withdrawal fee 0.25% deduction equals 1.2625 bWETH
            // Then WETH balance of userA’s wallet address(0x) equals 503.7375
            // Then the bWETH balance of userA’s wallet address(0x) equals 490.9901
            it('withdraw in happy path-1', async () => {
                let userTokenBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                let userBTokenBalanceBefore = await call(vault, 'balanceOf', [testUser])
                let userBTokenAmountToWithdraw = new BigNumber(userBTokenBalanceBefore).divn(2)
                let bTokenTotalSupply = await call(vault, 'totalSupply')
                let vaultBalance = await call(vault, 'underlyingBalance')
                // get expected value
                let expectedTokenAmountToWithdrawWithoutFee = userBTokenAmountToWithdraw.mul(new BigNumber(vaultBalance)).div(new BigNumber(bTokenTotalSupply))
                let expectedWithdrawalFee = expectedTokenAmountToWithdrawWithoutFee.muln(vaultWithdrawalManageFeePortion).divn(vaultWithdrawalManageFeeBase)
                // do withdraw
                await send(vault, 'withdraw', [userBTokenAmountToWithdraw.toString()], { from: testUser })
                let userBTokenBalanceAfter = await call(vault, 'balanceOf', [testUser])
                AssertionUtils.assertBNApproxRange(new BigNumber(userBTokenBalanceBefore).sub(new BigNumber(userBTokenBalanceAfter)), userBTokenAmountToWithdraw, 1, 10000)
                let userTokenBalanceAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                AssertionUtils.assertBNApproxRange(new BigNumber(userTokenBalanceAfter).sub(new BigNumber(userTokenBalanceBefore)), expectedTokenAmountToWithdrawWithoutFee.sub(expectedWithdrawalFee), 1, 10000)
            })
        })

        describe('Test Vault withdraw-2', () => {
            const day = 24 * 60 * 60
            const vaultWithdrawalManageFeePortion = 25
            const vaultWithdrawalManageFeeBase = 10000
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(1000 ETH) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare for bToken exchange rate
                {
                    // say 5 days passed 
                    await timeMachine.advanceTimeAndBlock(5 * day)
                }
                // make governance withdraw all his deposit amount to let vault balance insufficient
                let governanceBTokenBalance = await call(vault, 'balanceOf', [governance])
                let userBTokenAmountToWithdraw = new BigNumber(governanceBTokenBalance)
                let bTokenTotalSupply = await call(vault, 'totalSupply')
                let vaultBalance = await call(vault, 'underlyingBalance')
                // get expected value
                let expectedTokenAmountToWithdrawWithoutFee = userBTokenAmountToWithdraw.mul(new BigNumber(vaultBalance)).div(new BigNumber(bTokenTotalSupply))
                let expectedWithdrawalFee = expectedTokenAmountToWithdrawWithoutFee.muln(vaultWithdrawalManageFeePortion).divn(vaultWithdrawalManageFeeBase)
                let userTokenBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, governance)
                await send(vault, 'withdraw', [governanceBTokenBalance], { from: governance })
                let userTokenBalanceAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, governance)
                AssertionUtils.assertBNApproxRange(new BigNumber(userTokenBalanceAfter).sub(new BigNumber(userTokenBalanceBefore)), expectedTokenAmountToWithdrawWithoutFee.sub(expectedWithdrawalFee), 1, 10000)
                done()
            })

            // Happy Path #2:
            // Given the governance deposit 1000 ETH to vault for 1000 bWETH
            // And userA deposit 1000 ETH to vault for 1000 bWETH
            // And someone call earn 
            // And 5 day passed 
            // And withdrawal fee 0.25% deduction
            // And the governance withdraw all his bWETH back based on bWETH totalSupply and vault balance
            // When userA withdraws 1000 bWETH
            // *and vault buffer is not enough to pay for withdrawal
            // Then userA will get WETH based on bWETH totalSupply and vault balance
            it('withdraw in happy path-2', async () => {
                let userTokenBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                let userBTokenBalanceBefore = await call(vault, 'balanceOf', [testUser])
                // can not withdraw all money out because of earn loss from curve fee and harvest(reinvest) after 5 days can not cover that, or assertion will be inaccurate
                let userBTokenAmountToWithdraw = new BigNumber(userBTokenBalanceBefore).divn(2)
                let bTokenTotalSupply = await call(vault, 'totalSupply')
                let vaultBalance = await call(vault, 'underlyingBalance')
                // get expected value
                let expectedTokenAmountToWithdrawWithoutFee = userBTokenAmountToWithdraw.mul(new BigNumber(vaultBalance)).div(new BigNumber(bTokenTotalSupply))
                let expectedWithdrawalFee = expectedTokenAmountToWithdrawWithoutFee.muln(vaultWithdrawalManageFeePortion).divn(vaultWithdrawalManageFeeBase)
                // do withdraw
                await send(vault, 'withdraw', [userBTokenAmountToWithdraw.toString()], { from: testUser })
                let userBTokenBalanceAfter = await call(vault, 'balanceOf', [testUser])
                AssertionUtils.assertBNApproxRange(new BigNumber(userBTokenBalanceBefore).sub(new BigNumber(userBTokenBalanceAfter)), userBTokenAmountToWithdraw, 1, 10000)
                let userTokenBalanceAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                AssertionUtils.assertBNApproxRange(new BigNumber(userTokenBalanceAfter).sub(new BigNumber(userTokenBalanceBefore)), expectedTokenAmountToWithdrawWithoutFee.sub(expectedWithdrawalFee), 1, 10000)
            })
        })

        describe('Test Vault withdrawAll', () => {
            const day = 24 * 60 * 60
            const vaultWithdrawalManageFeePortion = 25
            const vaultWithdrawalManageFeeBase = 10000
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(1000 ETH) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare for bToken exchange rate
                {
                    // say 5 days passed 
                    await timeMachine.advanceTimeAndBlock(5 * day)
                }
                done()
            })

            // Happy Path #1:
            // Given the bWETH balance of userA’s wallet address(0x) equals 990.09901
            // And bWETH to WETH exchange rate equals 1.0100
            // When userA withdraws all WETH(returning all bWETH in exchange for WETH)
            // Then the bWETH balance of userA’s wallet address(0x) equals 0
            // And the WETH balance of userA’s wallet address(0x) equals 1000
            // 0.25% withdrawal fee
            it('withdrawAll in happy path', async () => {
                let userTokenBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                let userBTokenBalanceBefore = await call(vault, 'balanceOf', [testUser])
                // can not withdraw all money out because of earn loss from curve fee and harvest(reinvest) after 5 days can not cover that, or assertion will be inaccurate
                let userBTokenAmountToWithdraw = new BigNumber(userBTokenBalanceBefore)
                let bTokenTotalSupply = await call(vault, 'totalSupply')
                let vaultBalance = await call(vault, 'underlyingBalance')
                // get expected value
                let expectedTokenAmountToWithdrawWithoutFee = userBTokenAmountToWithdraw.mul(new BigNumber(vaultBalance)).div(new BigNumber(bTokenTotalSupply))
                let expectedWithdrawalFee = expectedTokenAmountToWithdrawWithoutFee.muln(vaultWithdrawalManageFeePortion).divn(vaultWithdrawalManageFeeBase)
                // do withdrawAll
                await send(vault, 'withdrawAll', [], { from: testUser })
                let userBTokenBalanceAfter = await call(vault, 'balanceOf', [testUser])
                AssertionUtils.assertBNEq(new BigNumber(userBTokenBalanceAfter), 0)
                let userTokenBalanceAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                AssertionUtils.assertBNApproxRange(new BigNumber(userTokenBalanceAfter).sub(new BigNumber(userTokenBalanceBefore)), expectedTokenAmountToWithdrawWithoutFee.sub(expectedWithdrawalFee), 1, 10000)
            })
        })

        describe('Test Vault rebalance-1', () => {
            const day = 24 * 60 * 60
            const vaultBufferPortion = 10
            const vaultBufferBase = 100
            const withdrawalCompensationPortion = 30
            const withdrawalCompensationBase = 10000
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[strategyTokenSymbol].decimals)

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
                    // say 5 days passed 
                    await timeMachine.advanceTimeAndBlock(5 * day)
                }
                // make governance withdraw most of his deposit amount to let vault balance insufficient
                let governanceBTokenBalance = await call(vault, 'balanceOf', [governance])
                await send(vault, 'withdraw', [new BigNumber(governanceBTokenBalance).muln(8).divn(10).toString()], { from: governance })
                done()
            })

            // Happy Path #1:
            // Given WETH vault balance equals 800
            // And WETH vault Buffer equals 10%
            // And WETH vault total WETH deposit equals 10,000
            // When userA (anyone) call Rebalance at WETH vault
            // Then the amount of WETH withdrawn from WETH strategy back to WETH vault equals 200
            // Then the remaining amount of WETH in WETH vault equals 1,000
            it('rebalance in happy path', async () => {
                let vaultBalance = await call(vault, 'balance', [])
                let expectedVaultBufferAmount = new BigNumber(vaultBalance).muln(vaultBufferPortion).divn(vaultBufferBase)
                let vaultTokenBufferAmountBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, vaultAddress)
                // do rebalance
                await send(vault, 'rebalance', [], { from: governance })
                let vaultTokenBufferAmountAfter = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, vaultAddress)
                // acutually these two assertions are same
                // for withdrawCompensation in strategy, vault buffer balance after `rebalance` can be a little more than expected 
                AssertionUtils.assertBNApproxRange(new BigNumber(vaultTokenBufferAmountAfter).sub(new BigNumber(vaultTokenBufferAmountBefore)), expectedVaultBufferAmount.sub(new BigNumber(vaultTokenBufferAmountBefore)), withdrawalCompensationPortion + 5, withdrawalCompensationBase)
                AssertionUtils.assertBNApproxRange(vaultTokenBufferAmountAfter, expectedVaultBufferAmount, withdrawalCompensationPortion + 5, withdrawalCompensationBase)
            })
        })

        describe('Test Vault rebalance-2', () => {
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(1000 ETH) for testUser and deposit to vault, to let vault buffer sufficient
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                done()
            })

            // Unhappy Path #1:
            // Given WETH vault balance equals 120
            // And WETH vault Buffer equals 10%
            // And WETH vault total WETH deposit equals 1,000
            // When userA (anyone) call Rebalance at WETH vault
            // Then Error “No need for rebalance”
            it('rebalance in unhappy path', async () => {
                // do rebalance
                let rebalanceTrx = send(vault, 'rebalance', [], { from: governance })
                // assert throw error
                await AssertionUtils.assertThrowErrorAsync(rebalanceTrx, 'subtraction overflow')
            })
        })

        describe('Test controller withdrawAll', () => {
            const day = 24 * 60 * 60
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('1000'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(1000 ETH) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare for bToken exchange rate
                {
                    // say 5 days passed 
                    await timeMachine.advanceTimeAndBlock(5 * day)
                }
                done()
            })

            it('withdrawAll in happy path', async () => {
                let vaultBalanceBefore = await call(vault, 'underlyingBalance', [])
                await send(controller, 'withdrawAll', [strategyTokenAddress], { from: governance })
                let vaultBalanceAfter = await call(vault, 'underlyingBalance', [])
                let vaultBufferBalance = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, vaultAddress)
                AssertionUtils.assertBNApproxRange(vaultBufferBalance, vaultBalanceBefore, 5, 10000)
                AssertionUtils.assertBNApproxRange(vaultBufferBalance, vaultBalanceAfter, 5, 10000)
            })
        })
    }
}


