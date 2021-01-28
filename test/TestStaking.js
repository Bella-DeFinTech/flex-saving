const AssertionUtils = require("./utils/AssertionUtils.js")
const AccountUtils = require("./utils/AccountUtils.js")
const BNUtils = require("./utils/BNUtils.js");
const BigNumber = require('bn.js');
const assert = require('assert');
const timeMachine = require("./utils/TimeMachine.js")
const deploy = require("./lib/StakingDeploy.js");
const tokenAddress = require('./const/Token.js');

jest.setTimeout(30 * 60 * 1000);

describe('Test BellaStaking', () => {
    const governanceAddress = accounts[0]
    const deployerAddress = accounts[1]
    const initStaker = accounts[2]

    // use real erc20 tokens' addresses
    const testVaultAddressObj = {
        bUsdt: tokenAddress.USDT.token,
        bUsdc: tokenAddress.USDC.token,
        bWbtc: tokenAddress.WBTC.token,
        // bArpa: "0xba50933c268f567bdc86e1ac131be072c6b0b71a",
        bDai: tokenAddress.DAI.token,
        // bBusd: "0x4fabb145d64652a948d72533023f6e7a623c7c53",
        // bHbtc: "0x0316EB71485b0Ab14103307bf65a021042c6d380"
    }

    let stakingContractInstance

    let belToken
    let belTokenAddress

    let usdtToken
    let usdtTokenAddress
    let usdtTokenHolder

    let wbtcToken
    let wbtcTokenAddress
    let wbtcTokenHolder

    let daiToken
    let daiTokenAddress
    let daiTokenHolder

    let stakingContractAddress

    // config parameters
    const belRewardAmount = '10000'
    const belRewardUnlockCycle = 7 // days
    const expectedUsdtTotalStakedAmount = '1000000'
    const expectedWbtcTotalStakedAmount = '500'
    const expectedDaiTotalStakedAmount = '10000'

    beforeAll(async (done) => {
        // deploy staking contract with erc20 token obj
        //      add staking pools done with in deploy script
        stakingContractAddress = await deploy(saddle, deployerAddress, governanceAddress, testVaultAddressObj)
        console.log('[INFO]: Staking contract deploy success')

        stakingContractInstance = await saddle.getContractAt('BellaStaking', stakingContractAddress)

        let poolLenght = await call(stakingContractInstance, 'poolLength', [], { from: governanceAddress })
        console.log('[INFO]: PoolLength is ' + poolLenght)

        // init BEL token, in order to transfer reward to staking contract 
        belTokenAddress = tokenAddress.BEL.token
        belToken = await saddle.getContractAt('IERC20', belTokenAddress)
        // send BEL token from belTokenHolder to governacne address
        await AccountUtils.giveERC20Token('BEL', governanceAddress, BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimal))
        // approve staking contract usage of BEL token
        await AccountUtils.doApprove('BEL', governanceAddress, stakingContractAddress, BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimal).toString()).then(() => {
            console.log('[INFO]: Send BEL token to governanceAddress success')
        })

        // transfer USDT token from token holder to initStaker
        usdtTokenAddress = tokenAddress.USDT.token
        usdtToken = await saddle.getContractAt('IERC20', usdtTokenAddress)
        await AccountUtils.balanceOfERC20Token('USDT', tokenAddress.USDT.tokenHolder).then((res) => {
            console.log('[INFO]: USDT token holder balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimal) + ' USDT')
        })
        console.log('[INFO]: USDT', initStaker, BNUtils.mul10pow(new BigNumber(expectedUsdtTotalStakedAmount), tokenAddress.USDT.decimal))
        await AccountUtils.giveERC20Token('USDT', initStaker, BNUtils.mul10pow(new BigNumber(expectedUsdtTotalStakedAmount), tokenAddress.USDT.decimal)).then(() => {
            console.log('[INFO]: Success transfer ' + expectedUsdtTotalStakedAmount + ' USDT to initStaker: ' + initStaker)
        })
        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then((res) => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimal) + ' USDT')
        })

        // transfer WBTC token from token holder to initStaker
        wbtcTokenAddress = tokenAddress.WBTC.token
        wbtcToken = await saddle.getContractAt('IERC20', wbtcTokenAddress)
        await AccountUtils.balanceOfERC20Token('WBTC', tokenAddress.WBTC.tokenHolder).then((res) => {
            console.log('[INFO]: WBTC token holder balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimal) + ' WBTC')
        })
        console.log('WBTC', initStaker, BNUtils.mul10pow(new BigNumber(expectedWbtcTotalStakedAmount), tokenAddress.WBTC.decimal), expectedWbtcTotalStakedAmount, tokenAddress.WBTC.decimal)
        await AccountUtils.giveERC20Token('WBTC', initStaker, BNUtils.mul10pow(new BigNumber(expectedWbtcTotalStakedAmount), tokenAddress.WBTC.decimal)).then(() => {
            console.log('[INFO]: Success transfer ' + expectedWbtcTotalStakedAmount + ' WBTC to initStaker: ' + initStaker)
        })
        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then((res) => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimal) + ' WBTC')
        })

        // transfer DAI token from token holder to initStaker
        daiTokenAddress = tokenAddress.DAI.token
        daiToken = await saddle.getContractAt('IERC20', daiTokenAddress)
        await AccountUtils.balanceOfERC20Token('DAI', tokenAddress.DAI.tokenHolder).then(res => {
            console.log('[INFO]: DAI token holder balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimal) + ' DAI')
        })
        console.log('DAI', initStaker, BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.DAI.decimal), expectedDaiTotalStakedAmount, tokenAddress.DAI.decimal)
        await AccountUtils.giveERC20Token('DAI', initStaker, BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.DAI.decimal)).then(() => {
            console.log('[INFO]: Success transfer ' + expectedDaiTotalStakedAmount + ' DAI to initStaker: ' + initStaker)
        })
        await AccountUtils.balanceOfERC20Token('DAI', initStaker).then((res) => {
            console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimal) + ' DAI')
        })

        done()
    })

    let snapshotId

    beforeEach(async () => {
        let snapshot = await timeMachine.takeSnapshot()
        snapshotId = snapshot['result']
        console.log('[INFO]: take snapshot')
    });

    it('Governance address success changed', async () => {
        call(stakingContractInstance, 'isOwner', [], { from: governanceAddress }).then(res => {
            assert.strictEqual(res, true)
        })
    })

    it('Governor can lock BEL reward to contract', async () => {
        // lock 10000 BEL to staking contract as reward
        await send(stakingContractInstance,
            'lock', [
            BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimal).toString(), belRewardUnlockCycle],
            { from: governanceAddress })

        console.log('[INFO]: Lock ' + belRewardAmount + ' BEL to staking contract at' + stakingContractAddress)
        await AccountUtils.balanceOfERC20Token('BEL', stakingContractAddress).then(res => {
            AssertionUtils.assertBNEq(BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimal), belRewardAmount)
        })
    })

    it('USDT can be accurately staked', async () => {
        const poolId = '0'

        // lock 10000 BEL to staking contract as reward
        await send(stakingContractInstance,
            'lock', [
            BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimal).toString(), belRewardUnlockCycle],
            { from: governanceAddress })
        console.log('[INFO]: Lock ' + belRewardAmount + ' BEL to staking contract at' + stakingContractAddress)

        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimal) + ' USDT')
        })

        // approve staking contract can use USDT token
        // USDT need to clear allowrance and reapprove
        await AccountUtils.doApprove(
            'USDT',
            initStaker,
            stakingContractAddress,
            BNUtils.mul10pow(new BigNumber('0'), tokenAddress.USDT.decimal).toString())
            .then(() => {
                console.log('[INFO]: clear USDT approve amount to 0 on address: ' + initStaker)
            })

        await AccountUtils.doApprove(
            'USDT',
            initStaker,
            stakingContractAddress,
            BNUtils.mul10pow(new BigNumber(expectedUsdtTotalStakedAmount), tokenAddress.USDT.decimal).toString())
            .then(() => {
                console.log('[INFO]: approve ' + expectedUsdtTotalStakedAmount + ' USDT token to staking contract, contract address: ' + stakingContractAddress)
            })

        await call(usdtToken, 'allowance', [initStaker, stakingContractAddress]).then(res => {
            console.log('[INFO]: Allowance of staking contract usage of USDT token is : ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimal) + ' USDT')
        })

        // init stake USDT as bUsdt
        // function deposit(uint256 _pid, uint256 _amount, uint256 savingType) 
        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('300000'), tokenAddress.USDT.decimal), '0'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 300000 USDT to pool ' + poolId + ', savingType 0')
            })
        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimal) + ' USDT')
        })

        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('350000'), tokenAddress.USDT.decimal), '1'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 350000 USDT to pool ' + poolId + ', savingType 1')
            })
        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimal) + 'USDT')
        })

        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('250000'), tokenAddress.USDT.decimal), '2'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 250000 USDT to pool ' + poolId + ', savingType 2')
            })
        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimal) + ' USDT')
        })

        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('100000'), tokenAddress.USDT.decimal), '3'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 100000 USDT to pool ' + poolId + ', savingType 3')
            })

        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimal) + ' USDT')
        })

        let usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [poolId, initStaker])
        console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimal) + ' USDT , holder address: ' + initStaker)
        AssertionUtils.assertBNEq(usdtTokenStaked, BNUtils.mul10pow(new BigNumber(expectedUsdtTotalStakedAmount), tokenAddress.USDT.decimal).toString())
    })

    it('DAI can be accurately staked', async () => {
        const poolId = '3'

        // lock 10000 BEL to staking contract as reward
        await send(stakingContractInstance,
            'lock', [
            BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimal).toString(), belRewardUnlockCycle],
            { from: governanceAddress })
        console.log('[INFO]: Lock ' + belRewardAmount + ' BEL to staking contract at' + stakingContractAddress)

        await AccountUtils.balanceOfERC20Token('DAI', initStaker).then(res => {
            console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimal) + ' DAI')
        })

        // approve staking contract can use DAI token
        // DAI need to clear allowrance and reapprove
        await AccountUtils.doApprove(
            'DAI',
            initStaker,
            stakingContractAddress,
            BNUtils.mul10pow(new BigNumber('0'), tokenAddress.DAI.decimal).toString())
            .then(() => {
                console.log('[INFO]: clear DAI approve amount to 0 on address: ' + initStaker)
            })

        await AccountUtils.doApprove(
            'DAI',
            initStaker,
            stakingContractAddress,
            BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.DAI.decimal).toString())
            .then(() => {
                console.log('[INFO]: approve ' + expectedDaiTotalStakedAmount + ' DAI token to staking contract, contract address: ' + stakingContractAddress)
            })

        await call(daiToken, 'allowance', [initStaker, stakingContractAddress]).then(res => {
            console.log('[INFO]: Allowance of staking contract usage of DAI token is : ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimal) + ' DAI')
        })

        // init stake DAI as bDai
        // function deposit(uint256 _pid, uint256 _amount, uint256 savingType) 
        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('3000'), tokenAddress.DAI.decimal), '0'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 3000 DAI to pool '+ poolId + ', savingType 0')
            })
        await AccountUtils.balanceOfERC20Token('DAI', initStaker).then(res => {
            console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimal) + ' DAI')
        })

        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('3500'), tokenAddress.DAI.decimal), '1'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 3500 DAI to pool '+ poolId + ', savingType 1')
            })
        await AccountUtils.balanceOfERC20Token('DAI', initStaker).then(res => {
            console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimal) + ' DAI')
        })

        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('2500'), tokenAddress.DAI.decimal), '2'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 2500 DAI to pool '+ poolId + ', savingType 2')
            })
        await AccountUtils.balanceOfERC20Token('DAI', initStaker).then(res => {
            console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimal) + ' DAI')
        })

        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('1000'), tokenAddress.DAI.decimal), '3'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 1000 DAI to pool '+ poolId + ', savingType 3')
            })

        await AccountUtils.balanceOfERC20Token('DAI', initStaker).then(res => {
            console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimal) + ' DAI')
        })

        let daiTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [poolId, initStaker])
        console.log('[INFO]: DAI Staked amount is ' + BNUtils.div10pow(new BigNumber(daiTokenStaked), tokenAddress.DAI.decimal) + ' DAI , holder address: ' + initStaker)
        AssertionUtils.assertBNEq(daiTokenStaked, BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.DAI.decimal).toString())
    })

    it('WBTC can be accurately staked', async () => {
        const poolId = '2'

        // lock 10000 BEL to staking contract as reward
        await send(stakingContractInstance,
            'lock', [
            BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimal).toString(), belRewardUnlockCycle],
            { from: governanceAddress })
        console.log('[INFO]: Lock ' + belRewardAmount + ' BEL to staking contract at' + stakingContractAddress)

        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimal) + ' WBTC')
        })

        // approve staking contract can use WBTC token
        // WBTC need to clear allowrance and reapprove
        await AccountUtils.doApprove(
            'WBTC',
            initStaker,
            stakingContractAddress,
            BNUtils.mul10pow(new BigNumber('0'), tokenAddress.WBTC.decimal).toString())
            .then(() => {
                console.log('[INFO]: clear WBTC approve amount to 0 on address: ' + initStaker)
            })

        await AccountUtils.doApprove(
            'WBTC',
            initStaker,
            stakingContractAddress,
            BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.WBTC.decimal).toString())
            .then(() => {
                console.log('[INFO]: approve ' + expectedDaiTotalStakedAmount + ' WBTC token to staking contract, contract address: ' + stakingContractAddress)
            })

        await call(daiToken, 'allowance', [initStaker, stakingContractAddress]).then(res => {
            console.log('[INFO]: Allowance of staking contract usage of WBTC token is : ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimal) + ' WBTC')
        })

        // init stake WBTC as bDai
        // function deposit(uint256 _pid, uint256 _amount, uint256 savingType) 
        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('200'), tokenAddress.WBTC.decimal), '0'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 200 WBTC to pool '+ poolId + ', savingType 0')
            })
        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimal) + ' WBTC')
        })

        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.WBTC.decimal), '1'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 50 WBTC to pool '+ poolId + ', savingType 1')
            })
        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimal) + ' WBTC')
        })

        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('100'), tokenAddress.WBTC.decimal), '2'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 100 WBTC to pool '+ poolId + ', savingType 2')
            })
        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimal) + ' WBTC')
        })

        await send(stakingContractInstance,
            'deposit',
            [poolId, BNUtils.mul10pow(new BigNumber('150'), tokenAddress.WBTC.decimal), '3'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 150 WBTC to pool '+ poolId + ', savingType 3')
            })

        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimal) + ' WBTC')
        })

        let wbtcTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [poolId, initStaker])
        console.log('[INFO]: WBTC Staked amount is ' + BNUtils.div10pow(new BigNumber(wbtcTokenStaked), tokenAddress.WBTC.decimal) + ' WBTC , holder address: ' + initStaker)
        AssertionUtils.assertBNEq(wbtcTokenStaked, BNUtils.mul10pow(new BigNumber(expectedWbtcTotalStakedAmount), tokenAddress.WBTC.decimal).toString())
    })

    afterEach(async () => {
        await timeMachine.revertToSnapshot(snapshotId).then(() => {
            console.log('[INFO]: revert snapshot')
        })
    })

    // describe('Test steps ', () => {

    // })


    afterAll(async () => {

    })

})