const AssertionUtils = require("./utils/AssertionUtils.js")
const AccountUtils = require("./utils/AccountUtils.js")
const BNUtils = require("./utils/BNUtils.js")
const timeMachine = require("./utils/TimeMachine.js")
const deploy = require("./lib/Deploy.js")
const BigNumber = require('bn.js')
const curvePoolConstant = require('./const/CurvePool.js')
const tokenAddress = require('./const/Token.js')
const curveHbtcPool = require('./abi/hbtcPool.js')
const strategyTokens = require('./const/StrategyToken.js')

jest.setTimeout(30 * 60 * 1000)

describe('Test BellaFlexsaving WBTC Vault', vaultTestSuite('WBTC'))
describe('Test BellaFlexsaving HBTC Vault', vaultTestSuite('HBTC'))

function vaultTestSuite(strategyTokenSymbol) {
    return () => {
        const poolTokenSymbol = 'hbtc'
        const poolParam = curvePoolConstant[poolTokenSymbol].param
        const curveHbtcPoolAddress = poolParam.curvePoolAddress
        const curveGaugeAddress = poolParam.curveGaugeAddress
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
            const curveHbtcInstance = new web3.eth.Contract(curveHbtcPool.abiArray, curveHbtcPoolAddress)
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('100'), tokenAddress[strategyTokenSymbol].decimals)

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
                    // prepare strategy Token balance(100 HBTC) for governance
                    let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('100'), tokenAddress[strategyTokenSymbol].decimals)
                    await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                    await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                    // do deposit to curve pool from strategy, take this as reinvestment
                    await send(strategy, 'deposit', [], { from: governance })
                    // say 5 days passed and some exchange happened in curve hbtcPool
                    await timeMachine.advanceTimeAndBlock(5 * day)
                    // swap 88 * 5 btc volume during 5 days
                    await AccountUtils.giveERC20Token('HBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.HBTC.decimals))
                    await AccountUtils.giveERC20Token('WBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.WBTC.decimals))
                    await AccountUtils.doApprove('HBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.HBTC.decimals))
                    await AccountUtils.doApprove('WBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.WBTC.decimals))
                    for (let i = 0; i < 5; i++) {
                        await curveHbtcInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('HBTC'), poolParam.POOL_TOKEN.findIndex('WBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.HBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                        await curveHbtcInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('WBTC'), poolParam.POOL_TOKEN.findIndex('HBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.WBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    }
                }
                // prepare user Token balance(100 HBTC) for testUser
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                done()
            })

            // Happy Path #1:
            // Given userA’s wallet address is not a contract address
            // And the bVault is not paused
            // And bHBTC to HBTC exchange rate equals 1.0100 *which is, let someone deposit first and then, reinvest some amount to strategy pool and do some exchange in curve pool
            // When userA deposits 100 HBTC
            // Then the bHBTC balance of userA’s wallet address(0x) equals 99.009901
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
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('100'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(100 HBTC) for testUser
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                done()
            })

            // Unhappy Path #1:
            // Given contractA’s address is not whitelisted
            // And the bVault is not paused
            // When contractA deposits any amount of HBTC
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
                // prepare user Token balance(2500 HBTC) for testUser and deposit to vault
                let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('25'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // prepare strategy Token balance(7500 HBTC) for governance and transfer to strategy
                let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('75'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                done()
            })

            // Happy Path #1
            // Given HBTC vault balance equals 25
            // And HBTC vault Buffer equals 10%
            // And HBTC vault total HBTC deposit equals 100
            // When userA (anyone) call Earn at HBTC vault
            // Then the amount of HBTC deployed from HBTC vault to HBTC strategy equals 15
            // Then the remaining amount of HBTC in HBTC vault equals 10
            it('earn in happy path', async () => {
                let expectedTokenAmountToStrategy = BNUtils.mul10pow(new BigNumber('15'), tokenAddress[strategyTokenSymbol].decimals)
                let tokenAmountToStrategy = await call(vault, 'available')
                AssertionUtils.assertBNEq(tokenAmountToStrategy, expectedTokenAmountToStrategy)
                // do earn
                await send(vault, 'earn', [], { from: governance })
                let expectedTokenAmountInVault = BNUtils.mul10pow(new BigNumber('10'), tokenAddress[strategyTokenSymbol].decimals)
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
                // prepare user Token balance(2500 HBTC) for testUser and deposit to vault
                let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('7'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // prepare strategy Token balance(7500 HBTC) for governance and transfer to strategy
                let strategyTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('93'), tokenAddress[strategyTokenSymbol].decimals)
                await AccountUtils.giveERC20Token(strategyTokenSymbol, governance, strategyTokenAmountToDeposit)
                await send(strategyToken, 'transfer', [strategy._address, strategyTokenAmountToDeposit.toString()], { from: governance })
                done()
            })

            // Unhappy Path #1:
            // Given HBTC vault balance equals 7
            // And HBTC vault Buffer equals 10%
            // And HBTC vault total HBTC deposit equals 100
            // When userA (anyone) call Earn at HBTC vault
            // Then Error "Not enough HBTC to be deployed to strategy"
            it('earn in unhappy path', async () => {
                // do earn
                let earnTrx = send(vault, 'earn', [], { from: governance })
                // assert throw error
                await AssertionUtils.assertThrowErrorAsync(earnTrx, 'subtraction overflow')
            })
        })

        describe('Test Vault withdraw-1', () => {
            const day = 24 * 60 * 60
            const curveHbtcInstance = new web3.eth.Contract(curveHbtcPool.abiArray, curveHbtcPoolAddress)
            const vaultWithdrawalManageFeePortion = 25
            const vaultWithdrawalManageFeeBase = 10000
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('100'), tokenAddress[strategyTokenSymbol].decimals)

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
                    // say 5 days passed and some exchange happened in curve hbtcPool
                    await timeMachine.advanceTimeAndBlock(5 * day)
                    // swap 88 * 5 btc volume during 5 days
                    await AccountUtils.giveERC20Token('HBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.HBTC.decimals))
                    await AccountUtils.giveERC20Token('WBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.WBTC.decimals))
                    await AccountUtils.doApprove('HBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.HBTC.decimals))
                    await AccountUtils.doApprove('WBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.WBTC.decimals))
                    for (let i = 0; i < 5; i++) {
                        await curveHbtcInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('HBTC'), poolParam.POOL_TOKEN.findIndex('WBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.HBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                        await curveHbtcInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('WBTC'), poolParam.POOL_TOKEN.findIndex('HBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.WBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    }
                }
                // do harvest
                await send(strategy, 'harvest', [curveGaugeAddress], { from: governance })
                // prepare user Token balance(100 HBTC) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                done()
            })

            // Happy Path #1:
            // Given the bHBTC balance of userA’s wallet address(0x) equals 99.009901
            // And bHBTC to HBTC exchange rate equals 1.0100
            // When userA withdraws 50 bHBTC(returning 50 bHBTC in exchange for 50.5 HBTC)
            // And withdrawal fee 0.25%
            // Then HBTC balance of userA’s wallet address(0x) equals 50.37375
            // Then the bHBTC balance of userA’s wallet address(0x) equals 49.009901
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
            const curveHbtcInstance = new web3.eth.Contract(curveHbtcPool.abiArray, curveHbtcPoolAddress)
            const vaultWithdrawalManageFeePortion = 25
            const vaultWithdrawalManageFeeBase = 10000
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('100'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(100 HBTC) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare for bToken exchange rate
                {
                    // say 5 days passed and some exchange happened in curve hbtcPool
                    await timeMachine.advanceTimeAndBlock(5 * day)
                    // swap 88 * 5 btc volume during 5 days
                    await AccountUtils.giveERC20Token('HBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.HBTC.decimals))
                    await AccountUtils.giveERC20Token('WBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.WBTC.decimals))
                    await AccountUtils.doApprove('HBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.HBTC.decimals))
                    await AccountUtils.doApprove('WBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.WBTC.decimals))
                    for (let i = 0; i < 5; i++) {
                        await curveHbtcInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('HBTC'), poolParam.POOL_TOKEN.findIndex('WBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.HBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                        await curveHbtcInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('WBTC'), poolParam.POOL_TOKEN.findIndex('HBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.WBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    }
                }
                // do harvest
                await send(strategy, 'harvest', [curveGaugeAddress], { from: governance })
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
            // Given the governance deposit 100 HBTC to vault for 100 bHBTC
            // And userA deposit 100 HBTC to vault for 100 bHBTC
            // And someone call earn 
            // And 5 day passed and some exchange happened in curve hbtcPool
            // And withdrawal fee 0.25% deduction
            // And the governance withdraw all his bHBTC back based on bHBTC totalSupply and vault balance
            // When userA withdraws 100 bHBTC
            // *and vault buffer is not enough to pay for withdrawal
            // Then userA will get HBTC based on bHBTC totalSupply and vault balance
            it('withdraw in happy path-2', async () => {
                let userTokenBalanceBefore = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, testUser)
                let userBTokenBalanceBefore = await call(vault, 'balanceOf', [testUser])
                // can not withdraw all money out because of earn loss from curve fee and harvest(reinvest) after 5 days can not cover that, or assertion will be inaccurate
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

        describe('Test Vault withdrawAll', () => {
            const day = 24 * 60 * 60
            const curveHbtcInstance = new web3.eth.Contract(curveHbtcPool.abiArray, curveHbtcPoolAddress)
            const vaultWithdrawalManageFeePortion = 25
            const vaultWithdrawalManageFeeBase = 10000
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('100'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(100 HBTC) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare for bToken exchange rate
                {
                    // say 5 days passed and some exchange happened in curve hbtcPool
                    await timeMachine.advanceTimeAndBlock(5 * day)
                    // swap 88 * 5 btc volume during 5 days
                    await AccountUtils.giveERC20Token('HBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.HBTC.decimals))
                    await AccountUtils.giveERC20Token('WBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.WBTC.decimals))
                    await AccountUtils.doApprove('HBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.HBTC.decimals))
                    await AccountUtils.doApprove('WBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.WBTC.decimals))
                    for (let i = 0; i < 5; i++) {
                        await curveHbtcInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('HBTC'), poolParam.POOL_TOKEN.findIndex('WBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.HBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                        await curveHbtcInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('WBTC'), poolParam.POOL_TOKEN.findIndex('HBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.WBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    }
                }
                // do harvest
                await send(strategy, 'harvest', [curveGaugeAddress], { from: governance })
                done()
            })

            // Happy Path #1:
            // Given the bHBTC balance of userA’s wallet address(0x) equals 99.009901
            // And bHBTC to HBTC exchange rate equals 1.0100
            // When userA withdraws all HBTC(returning all bHBTC in exchange for HBTC)
            // Then the bHBTC balance of userA’s wallet address(0x) equals 0
            // And the HBTC balance of userA’s wallet address(0x) equals 100
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
            const curveHbtcPoolInstance = new web3.eth.Contract(curveHbtcPool.abiArray, curveHbtcPoolAddress)
            const vaultBufferPortion = 10
            const vaultBufferBase = 100
            const withdrawalCompensationPortion = 30
            const withdrawalCompensationBase = 100
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('100'), tokenAddress[strategyTokenSymbol].decimals)

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
                    // say 5 days passed and some exchange happened in curve hbtcPool
                    await timeMachine.advanceTimeAndBlock(5 * day)
                    // swap 88 * 5 btc volume during 5 days
                    await AccountUtils.giveERC20Token('HBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.HBTC.decimals))
                    await AccountUtils.giveERC20Token('WBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.WBTC.decimals))
                    await AccountUtils.doApprove('HBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.HBTC.decimals))
                    await AccountUtils.doApprove('WBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.WBTC.decimals))
                    for (let i = 0; i < 5; i++) {
                        await curveHbtcPoolInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('HBTC'), poolParam.POOL_TOKEN.findIndex('WBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.HBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                        await curveHbtcPoolInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('WBTC'), poolParam.POOL_TOKEN.findIndex('HBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.WBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    }
                }
                // do harvest
                await send(strategy, 'harvest', [curveGaugeAddress], { from: governance })
                // make governance withdraw most of his deposit amount to let vault balance insufficient
                let governanceBTokenBalance = await call(vault, 'balanceOf', [governance])
                await send(vault, 'withdraw', [new BigNumber(governanceBTokenBalance).muln(8).divn(10).toString()], { from: governance })
                done()
            })

            // Happy Path #1:
            // Given HBTC vault balance equals 10
            // And HBTC vault Buffer equals 10%
            // And HBTC vault total HBTC deposit equals 110
            // When userA (anyone) call Rebalance at HBTC vault
            // Then the amount of HBTC withdrawn from HBTC strategy back to HBTC vault equals 1
            // Then the remaining amount of HBTC in HBTC vault equals 11
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
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('100'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(100 HBTC) for testUser and deposit to vault, to let vault buffer sufficient
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                done()
            })

            // Unhappy Path #1:
            // Given HBTC vault balance equals 110
            // And HBTC vault Buffer equals 10%
            // And HBTC vault total HBTC deposit equals 200
            // When userA (anyone) call Rebalance at HBTC vault
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
            const curveHbtcPoolInstance = new web3.eth.Contract(curveHbtcPool.abiArray, curveHbtcPoolAddress)
            let testUser = accounts[2]
            let userTokenAmountToDeposit = BNUtils.mul10pow(new BigNumber('100'), tokenAddress[strategyTokenSymbol].decimals)

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
                // prepare user Token balance(10000 USDT) for testUser and deposit to vault
                await AccountUtils.giveERC20Token(strategyTokenSymbol, testUser, userTokenAmountToDeposit)
                await AccountUtils.doApprove(strategyTokenSymbol, testUser, vaultAddress, userTokenAmountToDeposit)
                await send(vault, 'deposit', [userTokenAmountToDeposit.toString()], { from: testUser })
                // call earn to invest to curve pool
                await send(vault, 'earn', [], { from: governance })
                // prepare for bToken exchange rate
                {
                    // say 5 days passed and some exchange happened in curve hbtcPool
                    await timeMachine.advanceTimeAndBlock(5 * day)
                    // swap 88 * 5 btc volume during 5 days
                    await AccountUtils.giveERC20Token('HBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.HBTC.decimals))
                    await AccountUtils.giveERC20Token('WBTC', governance, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.WBTC.decimals))
                    await AccountUtils.doApprove('HBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.HBTC.decimals))
                    await AccountUtils.doApprove('WBTC', governance, curveHbtcPoolAddress, BNUtils.mul10pow(new BigNumber('44'), 1 + tokenAddress.WBTC.decimals))
                    for (let i = 0; i < 5; i++) {
                        await curveHbtcPoolInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('HBTC'), poolParam.POOL_TOKEN.findIndex('WBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.HBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                        await curveHbtcPoolInstance.methods.exchange(poolParam.POOL_TOKEN.findIndex('WBTC'), poolParam.POOL_TOKEN.findIndex('HBTC'), BNUtils.mul10pow(new BigNumber('44'), tokenAddress.WBTC.decimals).toString(), 0).send({ from: governance, gas: 500000 })
                    }
                }
                // do harvest
                await send(strategy, 'harvest', [curveGaugeAddress], { from: governance })
                done()
            })

            it('withdrawAll in happy path', async () => {
                let vaultBalanceBefore = await call(vault, 'balance', [])
                await send(controller, 'withdrawAll', [strategyTokenAddress], { from: governance })
                let vaultBalanceAfter = await call(vault, 'balance', [])
                let vaultBufferBalance = await AccountUtils.balanceOfERC20Token(strategyTokenSymbol, vaultAddress)
                AssertionUtils.assertBNApproxRange(vaultBufferBalance, vaultBalanceBefore, 5, 10000)
                AssertionUtils.assertBNApproxRange(vaultBufferBalance, vaultBalanceAfter, 5, 10000)
            })
        })
    }
}


