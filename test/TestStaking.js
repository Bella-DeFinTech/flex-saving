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
        // bUsdc: tokenAddress.USDC.token,
        bWbtc: tokenAddress.WBTC.token,
        // bArpa: "0xba50933c268f567bdc86e1ac131be072c6b0b71a",
        // bDai: tokenAddress.DAI.token,
        // bBusd: "0x4fabb145d64652a948d72533023f6e7a623c7c53",
        // bHbtc: "0x0316EB71485b0Ab14103307bf65a021042c6d380"
    }

    const usdtPoolId = '0'
    const wbtcPoolId = '1'
    // const daiPoolId = '3'

    let stakingContractInstance
    let forkedBlockTimestamp

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
    const belRewardAmount = '200000'
    const belRewardUnlockCycle = 30 // days
    const expectedUsdtTotalStakedAmount = '1000000'
    const expectedWbtcTotalStakedAmount = '500'
    const expectedDaiTotalStakedAmount = '10000'

    beforeAll(async (done) => {
        // deploy staking contract with erc20 token obj
        //      add staking pools done with in deploy script
        let forkedBlockNumber = 11690921
        forkedBlockTimestamp = await web3.eth.getBlock(forkedBlockNumber).then(res => {
            return res.timestamp
        })
        console.log('[INFO]: forked block timestamp: ' + forkedBlockTimestamp)

        stakingContractAddress = await deploy(saddle, deployerAddress, governanceAddress, testVaultAddressObj, forkedBlockTimestamp)
        console.log('[INFO]: Staking contract deploy success')

        stakingContractInstance = await saddle.getContractAt('BellaStaking', stakingContractAddress)

        let poolLenght = await call(stakingContractInstance, 'poolLength', [], { from: governanceAddress })
        console.log('[INFO]: PoolLength is ' + poolLenght)

        // init BEL token, in order to transfer reward to staking contract 
        belTokenAddress = tokenAddress.BEL.token
        belToken = await saddle.getContractAt('IERC20', belTokenAddress)
        // send BEL token from belTokenHolder to governacne address
        await AccountUtils.giveERC20Token('BEL', governanceAddress, BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimals))
        // approve staking contract usage of BEL token
        await AccountUtils.doApprove('BEL', governanceAddress, stakingContractAddress, BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimals).toString()).then(() => {
            console.log('[INFO]: Send BEL token to governanceAddress success')
        })

        // transfer USDT token from token holder to initStaker
        usdtTokenAddress = tokenAddress.USDT.token
        usdtToken = await saddle.getContractAt('IERC20', usdtTokenAddress)
        await AccountUtils.balanceOfERC20Token('USDT', tokenAddress.USDT.tokenHolder).then((res) => {
            console.log('[INFO]: USDT token holder balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
        })
        console.log('[INFO]: USDT', initStaker, BNUtils.mul10pow(new BigNumber(expectedUsdtTotalStakedAmount), tokenAddress.USDT.decimals))
        await AccountUtils.giveERC20Token('USDT', initStaker, BNUtils.mul10pow(new BigNumber(expectedUsdtTotalStakedAmount), tokenAddress.USDT.decimals)).then(() => {
            console.log('[INFO]: Success transfer ' + expectedUsdtTotalStakedAmount + ' USDT to initStaker: ' + initStaker)
        })
        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then((res) => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
        })

        // transfer WBTC token from token holder to initStaker
        wbtcTokenAddress = tokenAddress.WBTC.token
        wbtcToken = await saddle.getContractAt('IERC20', wbtcTokenAddress)
        await AccountUtils.balanceOfERC20Token('WBTC', tokenAddress.WBTC.tokenHolder).then((res) => {
            console.log('[INFO]: WBTC token holder balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
        })
        console.log('WBTC', initStaker, BNUtils.mul10pow(new BigNumber(expectedWbtcTotalStakedAmount), tokenAddress.WBTC.decimals), expectedWbtcTotalStakedAmount, tokenAddress.WBTC.decimals)
        await AccountUtils.giveERC20Token('WBTC', initStaker, BNUtils.mul10pow(new BigNumber(expectedWbtcTotalStakedAmount), tokenAddress.WBTC.decimals)).then(() => {
            console.log('[INFO]: Success transfer ' + expectedWbtcTotalStakedAmount + ' WBTC to initStaker: ' + initStaker)
        })
        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then((res) => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
        })

        // transfer DAI token from token holder to initStaker
        // daiTokenAddress = tokenAddress.DAI.token
        // daiToken = await saddle.getContractAt('IERC20', daiTokenAddress)
        // await AccountUtils.balanceOfERC20Token('DAI', tokenAddress.DAI.tokenHolder).then(res => {
        //     console.log('[INFO]: DAI token holder balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimals) + ' DAI')
        // })
        // console.log('DAI', initStaker, BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.DAI.decimals), expectedDaiTotalStakedAmount, tokenAddress.DAI.decimals)
        // await AccountUtils.giveERC20Token('DAI', initStaker, BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.DAI.decimals)).then(() => {
        //     console.log('[INFO]: Success transfer ' + expectedDaiTotalStakedAmount + ' DAI to initStaker: ' + initStaker)
        // })
        // await AccountUtils.balanceOfERC20Token('DAI', initStaker).then((res) => {
        //     console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimals) + ' DAI')
        // })

        done()
    })

    let snapshotId

    beforeEach(async (done) => {
        let snapshot = await timeMachine.takeSnapshot()
        snapshotId = snapshot['result']
        console.log('[INFO]: ---------- take snapshot ----------')
        done()
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
            BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimals).toString(), belRewardUnlockCycle],
            { from: governanceAddress })

        console.log('[INFO]: Lock ' + belRewardAmount + ' BEL to staking contract at' + stakingContractAddress)
        await AccountUtils.balanceOfERC20Token('BEL', stakingContractAddress).then(res => {
            AssertionUtils.assertBNEq(BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals), belRewardAmount)
        })
    })

    it('USDT can be accurately staked', async () => {
        // lock 10000 BEL to staking contract as reward
        await send(stakingContractInstance,
            'lock', [
            BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimals).toString(), belRewardUnlockCycle],
            { from: governanceAddress })
        console.log('[INFO]: Lock ' + belRewardAmount + ' BEL to staking contract at' + stakingContractAddress)

        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
        })

        // approve staking contract can use USDT token
        // USDT need to clear allowrance and reapprove
        await AccountUtils.doApprove(
            'USDT',
            initStaker,
            stakingContractAddress,
            BNUtils.mul10pow(new BigNumber('0'), tokenAddress.USDT.decimals).toString())
            .then(() => {
                console.log('[INFO]: clear USDT approve amount to 0 on address: ' + initStaker)
            })

        await AccountUtils.doApprove(
            'USDT',
            initStaker,
            stakingContractAddress,
            BNUtils.mul10pow(new BigNumber(expectedUsdtTotalStakedAmount), tokenAddress.USDT.decimals).toString())
            .then(() => {
                console.log('[INFO]: approve ' + expectedUsdtTotalStakedAmount + ' USDT token to staking contract, contract address: ' + stakingContractAddress)
            })

        await call(usdtToken, 'allowance', [initStaker, stakingContractAddress]).then(res => {
            console.log('[INFO]: Allowance of staking contract usage of USDT token is : ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
        })

        // init stake USDT as bUsdt
        // function deposit(uint256 _pid, uint256 _amount, uint256 savingType) 
        await send(stakingContractInstance,
            'deposit',
            [usdtPoolId, BNUtils.mul10pow(new BigNumber('300000'), tokenAddress.USDT.decimals), '0'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 300000 USDT to pool ' + usdtPoolId + ', savingType 0')
            })
        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
        })

        await send(stakingContractInstance,
            'deposit',
            [usdtPoolId, BNUtils.mul10pow(new BigNumber('350000'), tokenAddress.USDT.decimals), '1'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 350000 USDT to pool ' + usdtPoolId + ', savingType 1')
            })
        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
        })

        await send(stakingContractInstance,
            'deposit',
            [usdtPoolId, BNUtils.mul10pow(new BigNumber('250000'), tokenAddress.USDT.decimals), '2'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 250000 USDT to pool ' + usdtPoolId + ', savingType 2')
            })
        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
        })

        await send(stakingContractInstance,
            'deposit',
            [usdtPoolId, BNUtils.mul10pow(new BigNumber('100000'), tokenAddress.USDT.decimals), '3'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 100000 USDT to pool ' + usdtPoolId + ', savingType 3')
            })

        await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
            console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
        })

        let usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, initStaker])
        console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + initStaker)
        AssertionUtils.assertBNEq(usdtTokenStaked, BNUtils.mul10pow(new BigNumber(expectedUsdtTotalStakedAmount), tokenAddress.USDT.decimals).toString())
    })

    {
        // it('DAI can be accurately staked', async () => {

    //     // lock 10000 BEL to staking contract as reward
    //     await send(stakingContractInstance,
    //         'lock', [
    //         BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimals).toString(), belRewardUnlockCycle],
    //         { from: governanceAddress })
    //     console.log('[INFO]: Lock ' + belRewardAmount + ' BEL to staking contract at' + stakingContractAddress)

    //     await AccountUtils.balanceOfERC20Token('DAI', initStaker).then(res => {
    //         console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimals) + ' DAI')
    //     })

    //     // approve staking contract can use DAI token
    //     // DAI need to clear allowrance and reapprove
    //     await AccountUtils.doApprove(
    //         'DAI',
    //         initStaker,
    //         stakingContractAddress,
    //         BNUtils.mul10pow(new BigNumber('0'), tokenAddress.DAI.decimals).toString())
    //         .then(() => {
    //             console.log('[INFO]: clear DAI approve amount to 0 on address: ' + initStaker)
    //         })

    //     await AccountUtils.doApprove(
    //         'DAI',
    //         initStaker,
    //         stakingContractAddress,
    //         BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.DAI.decimals).toString())
    //         .then(() => {
    //             console.log('[INFO]: approve ' + expectedDaiTotalStakedAmount + ' DAI token to staking contract, contract address: ' + stakingContractAddress)
    //         })

    //     await call(daiToken, 'allowance', [initStaker, stakingContractAddress]).then(res => {
    //         console.log('[INFO]: Allowance of staking contract usage of DAI token is : ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimals) + ' DAI')
    //     })

    //     // init stake DAI as bDai
    //     // function deposit(uint256 _pid, uint256 _amount, uint256 savingType) 
    //     await send(stakingContractInstance,
    //         'deposit',
    //         [daiPoolId, BNUtils.mul10pow(new BigNumber('3000'), tokenAddress.DAI.decimals), '0'],
    //         { from: initStaker })
    //         .then(() => {
    //             console.log('[INFO]: stake 3000 DAI to pool ' + daiPoolId + ', savingType 0')
    //         })
    //     await AccountUtils.balanceOfERC20Token('DAI', initStaker).then(res => {
    //         console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimals) + ' DAI')
    //     })

    //     await send(stakingContractInstance,
    //         'deposit',
    //         [daiPoolId, BNUtils.mul10pow(new BigNumber('3500'), tokenAddress.DAI.decimals), '1'],
    //         { from: initStaker })
    //         .then(() => {
    //             console.log('[INFO]: stake 3500 DAI to pool ' + daiPoolId + ', savingType 1')
    //         })
    //     await AccountUtils.balanceOfERC20Token('DAI', initStaker).then(res => {
    //         console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimals) + ' DAI')
    //     })

    //     await send(stakingContractInstance,
    //         'deposit',
    //         [daiPoolId, BNUtils.mul10pow(new BigNumber('2500'), tokenAddress.DAI.decimals), '2'],
    //         { from: initStaker })
    //         .then(() => {
    //             console.log('[INFO]: stake 2500 DAI to pool ' + daiPoolId + ', savingType 2')
    //         })
    //     await AccountUtils.balanceOfERC20Token('DAI', initStaker).then(res => {
    //         console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimals) + ' DAI')
    //     })

    //     await send(stakingContractInstance,
    //         'deposit',
    //         [daiPoolId, BNUtils.mul10pow(new BigNumber('1000'), tokenAddress.DAI.decimals), '3'],
    //         { from: initStaker })
    //         .then(() => {
    //             console.log('[INFO]: stake 1000 DAI to pool ' + daiPoolId + ', savingType 3')
    //         })

    //     await AccountUtils.balanceOfERC20Token('DAI', initStaker).then(res => {
    //         console.log('[INFO]: initStaker DAI balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.DAI.decimals) + ' DAI')
    //     })

    //     let daiTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [daiPoolId, initStaker])
    //     console.log('[INFO]: DAI Staked amount is ' + BNUtils.div10pow(new BigNumber(daiTokenStaked), tokenAddress.DAI.decimals) + ' DAI , holder address: ' + initStaker)
    //     AssertionUtils.assertBNEq(daiTokenStaked, BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.DAI.decimals).toString())
    // })
    }
    
    it('WBTC can be accurately staked', async () => {
        // lock 10000 BEL to staking contract as reward
        await send(stakingContractInstance,
            'lock', [
            BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimals).toString(), belRewardUnlockCycle],
            { from: governanceAddress })
        console.log('[INFO]: Lock ' + belRewardAmount + ' BEL to staking contract at' + stakingContractAddress)

        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
        })

        // approve staking contract can use WBTC token
        // WBTC need to clear allowrance and reapprove
        await AccountUtils.doApprove(
            'WBTC',
            initStaker,
            stakingContractAddress,
            BNUtils.mul10pow(new BigNumber('0'), tokenAddress.WBTC.decimals).toString())
            .then(() => {
                console.log('[INFO]: clear WBTC approve amount to 0 on address: ' + initStaker)
            })

        await AccountUtils.doApprove(
            'WBTC',
            initStaker,
            stakingContractAddress,
            BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.WBTC.decimals).toString())
            .then(() => {
                console.log('[INFO]: approve ' + expectedDaiTotalStakedAmount + ' WBTC token to staking contract, contract address: ' + stakingContractAddress)
            })

        await call(wbtcToken, 'allowance', [initStaker, stakingContractAddress]).then(res => {
            console.log('[INFO]: Allowance of staking contract usage of WBTC token is : ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
        })

        // init stake WBTC as bDai
        // function deposit(uint256 _pid, uint256 _amount, uint256 savingType) 
        await send(stakingContractInstance,
            'deposit',
            [wbtcPoolId, BNUtils.mul10pow(new BigNumber('200'), tokenAddress.WBTC.decimals), '0'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 200 WBTC to pool ' + wbtcPoolId + ', savingType 0')
            })
        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
        })

        await send(stakingContractInstance,
            'deposit',
            [wbtcPoolId, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.WBTC.decimals), '1'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 50 WBTC to pool ' + wbtcPoolId + ', savingType 1')
            })
        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
        })

        await send(stakingContractInstance,
            'deposit',
            [wbtcPoolId, BNUtils.mul10pow(new BigNumber('100'), tokenAddress.WBTC.decimals), '2'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 100 WBTC to pool ' + wbtcPoolId + ', savingType 2')
            })
        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
        })

        await send(stakingContractInstance,
            'deposit',
            [wbtcPoolId, BNUtils.mul10pow(new BigNumber('150'), tokenAddress.WBTC.decimals), '3'],
            { from: initStaker })
            .then(() => {
                console.log('[INFO]: stake 150 WBTC to pool ' + wbtcPoolId + ', savingType 3')
            })

        await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
            console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
        })

        let wbtcTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [wbtcPoolId, initStaker])
        console.log('[INFO]: WBTC Staked amount is ' + BNUtils.div10pow(new BigNumber(wbtcTokenStaked), tokenAddress.WBTC.decimals) + ' WBTC , holder address: ' + initStaker)
        AssertionUtils.assertBNEq(wbtcTokenStaked, BNUtils.mul10pow(new BigNumber(expectedWbtcTotalStakedAmount), tokenAddress.WBTC.decimals).toString())
    })

    afterEach(async (done) => {
        await timeMachine.revertToSnapshot(snapshotId).then(() => {
            console.log('[INFO]: ---------- revert snapshot ----------')
        })
        done()
    })

    describe('Test user deposit and reward by step', () => {
        const belRewardAmount = '187200' // 30day * 24 hour *( 60 BEL / hour(USDT) + 200 BEL / hour(WBTC) )
        const userAusdtAmount = '50000'
        const userAwbtcAmount = '10'
        const userA = accounts[3]

        let usdtTokenStaked
        let wbtcTokenStaked

        beforeAll(async (done) => {
            // check governor wallet BEL balance
            await AccountUtils.balanceOfERC20Token('BEL', governanceAddress).then((res) => {
                console.log('[INFO]: governanceAddress BEL balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
            })

            // lock belRewardAmount BEL to staking contract as reward
            await send(stakingContractInstance,
                'lock', [
                BNUtils.mul10pow(new BigNumber(belRewardAmount), tokenAddress.BEL.decimals).toString(), belRewardUnlockCycle],
                { from: governanceAddress })

            console.log('[INFO]: Lock ' + belRewardAmount + ' BEL to staking contract at: ' + stakingContractAddress)
            await AccountUtils.balanceOfERC20Token('BEL', stakingContractAddress).then(res => {
                console.log('[INFO]: staking contract BEL balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
            })


            await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
                console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })

            // approve staking contract can use USDT token
            // USDT need to clear allowrance and reapprove
            await AccountUtils.doApprove(
                'USDT',
                initStaker,
                stakingContractAddress,
                BNUtils.mul10pow(new BigNumber('0'), tokenAddress.USDT.decimals).toString())
                .then(() => {
                    console.log('[INFO]: clear USDT approve amount to 0 on address: ' + initStaker)
                })

            await AccountUtils.doApprove(
                'USDT',
                initStaker,
                stakingContractAddress,
                BNUtils.mul10pow(new BigNumber(expectedUsdtTotalStakedAmount), tokenAddress.USDT.decimals).toString())
                .then(() => {
                    console.log('[INFO]: approve ' + expectedUsdtTotalStakedAmount + ' USDT token to staking contract, contract address: ' + stakingContractAddress)
                })

            await call(usdtToken, 'allowance', [initStaker, stakingContractAddress]).then(res => {
                console.log('[INFO]: Allowance of staking contract usage of USDT token is : ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })

            // init stake USDT as bUsdt
            // function deposit(uint256 _pid, uint256 _amount, uint256 savingType) 
            await send(stakingContractInstance,
                'deposit',
                [usdtPoolId, BNUtils.mul10pow(new BigNumber('300000'), tokenAddress.USDT.decimals), '0'],
                { from: initStaker })
                .then(() => {
                    console.log('[INFO]: stake 300000 USDT to pool ' + usdtPoolId + ', savingType 0')
                })
            await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
                console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })

            await send(stakingContractInstance,
                'deposit',
                [usdtPoolId, BNUtils.mul10pow(new BigNumber('350000'), tokenAddress.USDT.decimals), '1'],
                { from: initStaker })
                .then(() => {
                    console.log('[INFO]: stake 350000 USDT to pool ' + usdtPoolId + ', savingType 1')
                })
            await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
                console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + 'USDT')
            })

            await send(stakingContractInstance,
                'deposit',
                [usdtPoolId, BNUtils.mul10pow(new BigNumber('250000'), tokenAddress.USDT.decimals), '2'],
                { from: initStaker })
                .then(() => {
                    console.log('[INFO]: stake 250000 USDT to pool ' + usdtPoolId + ', savingType 2')
                })
            await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
                console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })

            await send(stakingContractInstance,
                'deposit',
                [usdtPoolId, BNUtils.mul10pow(new BigNumber('100000'), tokenAddress.USDT.decimals), '3'],
                { from: initStaker })
                .then(() => {
                    console.log('[INFO]: stake 100000 USDT to pool ' + usdtPoolId + ', savingType 3')
                })

            await AccountUtils.balanceOfERC20Token('USDT', initStaker).then(res => {
                console.log('[INFO]: initStaker USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })

            usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, initStaker])
            console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + initStaker)

            // init stake WBTC

            // approve staking contract can use WBTC token
            // WBTC need to clear allowrance and reapprove
            await AccountUtils.doApprove(
                'WBTC',
                initStaker,
                stakingContractAddress,
                BNUtils.mul10pow(new BigNumber('0'), tokenAddress.WBTC.decimals).toString())
                .then(() => {
                    console.log('[INFO]: clear WBTC approve amount to 0 on address: ' + initStaker)
                })

            await AccountUtils.doApprove(
                'WBTC',
                initStaker,
                stakingContractAddress,
                BNUtils.mul10pow(new BigNumber(expectedDaiTotalStakedAmount), tokenAddress.WBTC.decimals).toString())
                .then(() => {
                    console.log('[INFO]: approve ' + expectedDaiTotalStakedAmount + ' WBTC token to staking contract, contract address: ' + stakingContractAddress)
                })

            await call(wbtcToken, 'allowance', [initStaker, stakingContractAddress]).then(res => {
                console.log('[INFO]: Allowance of staking contract usage of WBTC token is : ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            // init stake WBTC as bDai
            // function deposit(uint256 _pid, uint256 _amount, uint256 savingType) 
            await send(stakingContractInstance,
                'deposit',
                [wbtcPoolId, BNUtils.mul10pow(new BigNumber('200'), tokenAddress.WBTC.decimals), '0'],
                { from: initStaker })
                .then(() => {
                    console.log('[INFO]: stake 200 WBTC to pool ' + wbtcPoolId + ', savingType 0')
                })
            await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
                console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            await send(stakingContractInstance,
                'deposit',
                [wbtcPoolId, BNUtils.mul10pow(new BigNumber('50'), tokenAddress.WBTC.decimals), '1'],
                { from: initStaker })
                .then(() => {
                    console.log('[INFO]: stake 50 WBTC to pool ' + wbtcPoolId + ', savingType 1')
                })
            await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
                console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            await send(stakingContractInstance,
                'deposit',
                [wbtcPoolId, BNUtils.mul10pow(new BigNumber('100'), tokenAddress.WBTC.decimals), '2'],
                { from: initStaker })
                .then(() => {
                    console.log('[INFO]: stake 100 WBTC to pool ' + wbtcPoolId + ', savingType 2')
                })
            await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
                console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            await send(stakingContractInstance,
                'deposit',
                [wbtcPoolId, BNUtils.mul10pow(new BigNumber('150'), tokenAddress.WBTC.decimals), '3'],
                { from: initStaker })
                .then(() => {
                    console.log('[INFO]: stake 150 WBTC to pool ' + wbtcPoolId + ', savingType 3')
                })

            await AccountUtils.balanceOfERC20Token('WBTC', initStaker).then(res => {
                console.log('[INFO]: initStaker WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            wbtcTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [wbtcPoolId, initStaker])
            console.log('[INFO]: WBTC Staked amount is ' + BNUtils.div10pow(new BigNumber(wbtcTokenStaked), tokenAddress.WBTC.decimals) + ' WBTC , holder address: ' + initStaker)

            // give userA 50000 USDT
            await AccountUtils.giveERC20Token('USDT', userA, BNUtils.mul10pow(new BigNumber(userAusdtAmount), tokenAddress.USDT.decimals)).then(() => {
                console.log('[INFO]: Success transfer ' + userAusdtAmount + ' USDT to userA: ' + userA)
            })
            await AccountUtils.balanceOfERC20Token('USDT', userA).then((res) => {
                console.log('[INFO]: userA USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })
            // give userA 20 WBTC
            await AccountUtils.giveERC20Token('WBTC', userA, BNUtils.mul10pow(new BigNumber(userAwbtcAmount), tokenAddress.WBTC.decimals)).then(() => {
                console.log('[INFO]: Success transfer ' + userAwbtcAmount + ' WBTC to userA: ' + userA)
            })
            await AccountUtils.balanceOfERC20Token('WBTC', userA).then((res) => {
                console.log('[INFO]: userA WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            // userA stake 50000 USDT to pool 0, with type 0, 1, 2
            // approve staking contract can use USDT token
            // USDT need to clear allowrance and reapprove
            await AccountUtils.doApprove(
                'USDT',
                userA,
                stakingContractAddress,
                BNUtils.mul10pow(new BigNumber('0'), tokenAddress.USDT.decimals).toString())
                .then(() => {
                    console.log('[INFO]: clear USDT approve amount to 0 on address: ' + userA)
                })

            await AccountUtils.doApprove(
                'USDT',
                userA,
                stakingContractAddress,
                BNUtils.mul10pow(new BigNumber(userAusdtAmount), tokenAddress.USDT.decimals).toString())
                .then(() => {
                    console.log('[INFO]: approve ' + userAusdtAmount + ' USDT token to staking contract, contract address: ' + stakingContractAddress)
                })

            await call(usdtToken, 'allowance', [userA, stakingContractAddress]).then(res => {
                console.log('[INFO]: Allowance of staking contract usage of USDT token is : ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })

            // init stake USDT as bUsdt
            // function deposit(uint256 _pid, uint256 _amount, uint256 savingType) 
            await send(stakingContractInstance,
                'deposit',
                [usdtPoolId, BNUtils.mul10pow(new BigNumber('10000'), tokenAddress.USDT.decimals), '0'],
                { from: userA })
                .then(() => {
                    console.log('[INFO]: stake 10000 USDT to pool ' + usdtPoolId + ', savingType 0')
                })
            await AccountUtils.balanceOfERC20Token('USDT', userA).then(res => {
                console.log('[INFO]: userA USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })

            await send(stakingContractInstance,
                'deposit',
                [usdtPoolId, BNUtils.mul10pow(new BigNumber('25000'), tokenAddress.USDT.decimals), '1'],
                { from: userA })
                .then(() => {
                    console.log('[INFO]: stake 25000 USDT to pool ' + usdtPoolId + ', savingType 1')
                })
            await AccountUtils.balanceOfERC20Token('USDT', userA).then(res => {
                console.log('[INFO]: userA USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })

            await send(stakingContractInstance,
                'deposit',
                [usdtPoolId, BNUtils.mul10pow(new BigNumber('15000'), tokenAddress.USDT.decimals), '2'],
                { from: userA })
                .then(() => {
                    console.log('[INFO]: stake 15000 USDT to pool ' + usdtPoolId + ', savingType 2')
                })
            await AccountUtils.balanceOfERC20Token('USDT', userA).then(res => {
                console.log('[INFO]: userA USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })

            await AccountUtils.balanceOfERC20Token('USDT', userA).then(res => {
                console.log('[INFO]: userA USDT balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.USDT.decimals) + ' USDT')
            })

            usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, userA])
            console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + userA)

            // userA stake 10 WBTC to pool 2, with type 0, 1, 2, 3
            // approve staking contract can use WBTC token
            // WBTC need to clear allowrance and reapprove
            await AccountUtils.doApprove(
                'WBTC',
                userA,
                stakingContractAddress,
                BNUtils.mul10pow(new BigNumber('0'), tokenAddress.WBTC.decimals).toString())
                .then(() => {
                    console.log('[INFO]: clear WBTC approve amount to 0 on address: ' + initStaker)
                })

            await AccountUtils.doApprove(
                'WBTC',
                userA,
                stakingContractAddress,
                BNUtils.mul10pow(new BigNumber(userAwbtcAmount), tokenAddress.WBTC.decimals).toString())
                .then(() => {
                    console.log('[INFO]: approve ' + userAwbtcAmount + ' WBTC token to staking contract, contract address: ' + stakingContractAddress)
                })

            await call(wbtcToken, 'allowance', [userA, stakingContractAddress]).then(res => {
                console.log('[INFO]: Allowance of staking contract usage of WBTC token is : ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            // init stake WBTC as bWbtc
            // function deposit(uint256 _pid, uint256 _amount, uint256 savingType) 
            await send(stakingContractInstance,
                'deposit',
                [wbtcPoolId, BNUtils.mul10pow(new BigNumber('2'), tokenAddress.WBTC.decimals), '0'],
                { from: userA })
                .then(() => {
                    console.log('[INFO]: stake 2 WBTC to pool ' + wbtcPoolId + ', savingType 0')
                })
            await AccountUtils.balanceOfERC20Token('WBTC', userA).then(res => {
                console.log('[INFO]: userA WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            await send(stakingContractInstance,
                'deposit',
                [wbtcPoolId, BNUtils.mul10pow(new BigNumber('3'), tokenAddress.WBTC.decimals), '1'],
                { from: userA })
                .then(() => {
                    console.log('[INFO]: stake 3 WBTC to pool ' + wbtcPoolId + ', savingType 1')
                })
            await AccountUtils.balanceOfERC20Token('WBTC', userA).then(res => {
                console.log('[INFO]: userA WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            await send(stakingContractInstance,
                'deposit',
                [wbtcPoolId, BNUtils.mul10pow(new BigNumber('4'), tokenAddress.WBTC.decimals), '2'],
                { from: userA })
                .then(() => {
                    console.log('[INFO]: stake 4 WBTC to pool ' + wbtcPoolId + ', savingType 2')
                })
            await AccountUtils.balanceOfERC20Token('WBTC', userA).then(res => {
                console.log('[INFO]: userA WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            await send(stakingContractInstance,
                'deposit',
                [wbtcPoolId, BNUtils.mul10pow(new BigNumber('1'), tokenAddress.WBTC.decimals), '3'],
                { from: userA })
                .then(() => {
                    console.log('[INFO]: stake 1 WBTC to pool ' + wbtcPoolId + ', savingType 3')
                })

            await AccountUtils.balanceOfERC20Token('WBTC', userA).then(res => {
                console.log('[INFO]: userA WBTC balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.WBTC.decimals) + ' WBTC')
            })

            wbtcTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [wbtcPoolId, userA])
            console.log('[INFO]: WBTC Staked amount is ' + BNUtils.div10pow(new BigNumber(wbtcTokenStaked), tokenAddress.WBTC.decimals) + ' WBTC, holder address: ' + userA)

            done()
        })

        it('total lock USDT amount is expected', async () => {
            
            let initStakerUsdtAmount = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, initStaker])
            console.log('[INFO]: initstaker USDT stake amount: ' + BNUtils.div10pow(new BigNumber(initStakerUsdtAmount), tokenAddress.USDT.decimals))
            let userAStakeUsdtAmount = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, userA])
            console.log('[INFO]: userA USDT stake amount: ' + BNUtils.div10pow(new BigNumber(userAStakeUsdtAmount), tokenAddress.USDT.decimals))

            let receivedBn = BNUtils.sum([new BigNumber(initStakerUsdtAmount), new BigNumber(userAStakeUsdtAmount)]) 
            AssertionUtils.assertBNEq(receivedBn, BNUtils.mul10pow(new BigNumber('1050000'), tokenAddress.USDT.decimals))
        })

        it('total lock WBTC amount is expected', async() => {
            let initStakerWbtcAmount = await call(stakingContractInstance, 'getBtokenStaked', [wbtcPoolId, initStaker], { from: initStaker })
            console.log('[INFO]: initstaker WBTC stake amount: ' + BNUtils.div10pow(new BigNumber(initStakerWbtcAmount), tokenAddress.WBTC.decimals))
            let userAStakeWbtcAmount = await call(stakingContractInstance, 'getBtokenStaked', [wbtcPoolId, userA], { from: userA })
            console.log('[INFO]: userA WBTC stake amount: ' + BNUtils.div10pow(new BigNumber(userAStakeWbtcAmount), tokenAddress.WBTC.decimals))

            let receivedBn = BNUtils.sum([new BigNumber(initStakerWbtcAmount), new BigNumber(userAStakeWbtcAmount)]) 
            AssertionUtils.assertBNEq(receivedBn, BNUtils.mul10pow(new BigNumber('510'), tokenAddress.WBTC.decimals))
        })

        it('after 100 hours user can accrately get collectable reward BEL in USDT pool ', async () => {
            // set timestamp plus 100 hours
            const diff100HoursTimestamp = 360000// 100 * 60 * 60
            const refineBelRewardNumber = 28055
            let earnedBellaAllInUSDTPool

            await timeMachine.sendAndRollback(async() => {
                // forward 100 hours from start timestamp
                let targetTimestamp = forkedBlockTimestamp + diff100HoursTimestamp
                await timeMachine.advanceBlockAndSetTime(targetTimestamp)

                console.log('[INFO]: forkedBlockTimestamp: ' + forkedBlockTimestamp)
                console.log('[INFO]: targetTimestamp: ' + targetTimestamp)

                usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, initStaker])
                console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + initStaker)

                wbtcTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [wbtcPoolId, userA])
                console.log('[INFO]: WBTC Staked amount is ' + BNUtils.div10pow(new BigNumber(wbtcTokenStaked), tokenAddress.WBTC.decimals) + ' WBTC, holder address: ' + userA)

                earnedBellaAllInUSDTPool = await call(stakingContractInstance, 'earnedBellaAll', [usdtPoolId, userA])
                console.log('[INFO]: EearnedBelAllUSDT: ' + earnedBellaAllInUSDTPool)

                await call(stakingContractInstance, 'earnedBella', [usdtPoolId, userA, '0']).then((res) => {
                    console.log('[INFO]: USDT POOL saving type 0 BEL reward: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })

                await call(stakingContractInstance, 'earnedBella', [usdtPoolId, userA, '1']).then((res) => {
                    console.log('[INFO]: USDT POOL saving type 1 BEL reward: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })

                await call(stakingContractInstance, 'earnedBella', [usdtPoolId, userA, '2']).then((res) => {
                    console.log('[INFO]: USDT POOL saving type 2 BEL reward: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })
            })

            AssertionUtils.assertBNEq(earnedBellaAllInUSDTPool, BNUtils.mul10pow(new BigNumber(refineBelRewardNumber), 16))
        })

        it('after 100 hours user can accrately get collectable reward BEL in WBTC pool', async() => {
            // set timestamp plus 100 hours
            const diff100HoursTimestamp = 360000 // 100 * 60 * 60
            const refineBelRewardNumber = 38296
            let earnedBellaAllInWBTCPool 

            await timeMachine.sendAndRollback(async() => {
                // forward 100 hours from start timestamp
                let targetTimestamp = forkedBlockTimestamp + diff100HoursTimestamp
                await timeMachine.advanceBlockAndSetTime(targetTimestamp)

                console.log('[INFO]: forkedBlockTimestamp: ' + forkedBlockTimestamp)
                console.log('[INFO]: targetTimestamp: ' + targetTimestamp)

                usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, initStaker])
                console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + initStaker)

                wbtcTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [wbtcPoolId, userA])
                console.log('[INFO]: WBTC Staked amount is ' + BNUtils.div10pow(new BigNumber(wbtcTokenStaked), tokenAddress.WBTC.decimals) + ' WBTC, holder address: ' + userA)

                earnedBellaAllInWBTCPool = await call(stakingContractInstance, 'earnedBellaAll', [wbtcPoolId, userA])
                console.log('[INFO]: EearnedBelAllWBTC: ' + earnedBellaAllInWBTCPool)

                await call(stakingContractInstance, 'earnedBella', [wbtcPoolId, userA, '0']).then((res) => {
                    console.log('[INFO]: WBTC POOL saving type 0 BEL reward: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })

                await call(stakingContractInstance, 'earnedBella', [wbtcPoolId, userA, '1']).then((res) => {
                    console.log('[INFO]: WBTC POOL saving type 1 BEL reward: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })

                await call(stakingContractInstance, 'earnedBella', [wbtcPoolId, userA, '2']).then((res) => {
                    console.log('[INFO]: WBTC POOL saving type 2 BEL reward: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })

                await call(stakingContractInstance, 'earnedBella', [wbtcPoolId, userA, '3']).then((res) => {
                    console.log('[INFO]: WBTC POOL saving type 3 BEL reward: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })
            })

            AssertionUtils.assertBNEq(earnedBellaAllInWBTCPool, BNUtils.mul10pow(new BigNumber(refineBelRewardNumber), 16))
        })

        it('after 100 hours user can accrately get collectable reward BEL in all pool (USDT and WBTC)', async() => {
            // set timestamp plus 100 hours
            const diff100HoursTimestamp = 360000 // 100 * 60 * 60
            const refineBelRewardNumber = 66351
            let earnedBellaInAllPool 

            await timeMachine.sendAndRollback(async() => {
                // forward 100 hours from start timestamp
                let targetTimestamp = forkedBlockTimestamp + diff100HoursTimestamp
                await timeMachine.advanceBlockAndSetTime(targetTimestamp)

                console.log('[INFO]: forkedBlockTimestamp: ' + forkedBlockTimestamp)
                console.log('[INFO]: targetTimestamp: ' + targetTimestamp)

                usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, userA])
                console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + userA)

                wbtcTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [wbtcPoolId, userA])
                console.log('[INFO]: WBTC Staked amount is ' + BNUtils.div10pow(new BigNumber(wbtcTokenStaked), tokenAddress.WBTC.decimals) + ' WBTC, holder address: ' + userA)

                earnedBellaInAllPool = await call(stakingContractInstance, 'earnedBellaAllPool', [userA])
                console.log('[INFO]: EearnedBelAllPool: ' + earnedBellaInAllPool)
            })

            AssertionUtils.assertBNEq(earnedBellaInAllPool, BNUtils.mul10pow(new BigNumber(refineBelRewardNumber), 16))
        })

        it('after 100 hours user can unstake acurately amount from USDT pool saving type 2', async() => {
            // set timestamp plus 100 hours
            const diff100HoursTimestamp = 360000 // 100 * 60 * 60
            const unstakeUsdtAmount = '5000'
            const savingType15day = '2'

            const expectedStakedAmountInUsdtPool = 45000

            await timeMachine.sendAndRollback(async() => {
                // forward 100 hours from start timestamp
                let targetTimestamp = forkedBlockTimestamp + diff100HoursTimestamp
                await timeMachine.advanceBlockAndSetTime(targetTimestamp)

                console.log('[INFO]: forkedBlockTimestamp: ' + forkedBlockTimestamp)
                console.log('[INFO]: targetTimestamp: ' + targetTimestamp)

                // check usdt pool staked
                usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, userA])
                console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + userA)

                // unstake USDT from saving type 2, 15days
                await send(
                    stakingContractInstance, 
                    'withdraw', 
                    [usdtPoolId, BNUtils.mul10pow(new BigNumber(unstakeUsdtAmount), tokenAddress.USDT.decimals), savingType15day],
                    { from: userA }).then(() => {
                    console.log('[INFO]: Unstake ' + unstakeUsdtAmount + ' USDT from saving type ' + savingType15day)
                })

                // recheck staked amount in USDT pool
                usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, userA])
                console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + userA)
            })

            AssertionUtils.assertBNEq(usdtTokenStaked, BNUtils.mul10pow(new BigNumber(expectedStakedAmountInUsdtPool), tokenAddress.USDT.decimals))
        })

        it('after 100 hours user can get accurately BEL reward from USDT pool, saving type instance', async() => {
            // set timestamp plus 100 hours
            const diff100HoursTimestamp = 360000 // 100 * 60 * 60
            const unstakeUsdtAmount = '5000'
            const savingTypeInstance = '0'

            const expectedBelRewardRefineAmount = 4816
            let belReceivedAmount

            await timeMachine.sendAndRollback(async () => {
                // forward 100 hours from start timestamp
                let targetTimestamp = forkedBlockTimestamp + diff100HoursTimestamp
                await timeMachine.advanceBlockAndSetTime(targetTimestamp)

                console.log('[INFO]: forkedBlockTimestamp: ' + forkedBlockTimestamp)
                console.log('[INFO]: targetTimestamp: ' + targetTimestamp)

                // check usdt poolstaked
                usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, userA])
                console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + userA)

                // unstake USDT from saving type 2, 15days
                await send(
                    stakingContractInstance,
                    'withdraw',
                    [usdtPoolId, BNUtils.mul10pow(new BigNumber(unstakeUsdtAmount), tokenAddress.USDT.decimals), savingTypeInstance],
                    { from: userA }).then(() => {
                        console.log('[INFO]: Unstake ' + unstakeUsdtAmount + ' USDT from saving type ' + savingTypeInstance)
                    })

                // check usdt poolstaked
                usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, userA])
                console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + userA)

                await send(stakingContractInstance, 'claimBella', [usdtPoolId, savingTypeInstance], { from: userA }).then(() => {
                    console.log('[INFO]: Success call claimBella method by userA ' + userA)
                })

                await AccountUtils.balanceOfERC20Token('BEL', userA).then(res => {
                    belReceivedAmount = res
                    console.log('[INFO]: userA BEL balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })

                let earnedBellaInAllPool = await call(stakingContractInstance, 'earnedBellaAllPool', [userA], { from: userA})
                console.log('[INFO]: EearnedBelAllPool: ' + earnedBellaInAllPool)

                AssertionUtils.assertBNEq(belReceivedAmount, BNUtils.mul10pow(new BigNumber(expectedBelRewardRefineAmount), 16))
            })
        })

        it('after 100 hours user can get accurately delayed BEL reward from USDT pool', async() => {
            // set timestamp plus 100 hours
            const diff100HoursTimestamp = 360000 // 100 * 60 * 60
            const unstakeUsdtAmount = '5000'
            const savingType15Days = '2'

            const expectedDelayedBelAmount = 23239
            const expectedCollectableBelAmount = 0

            let delayedBel
            let collectableBel

            await timeMachine.sendAndRollback(async () => {
                // forward 100 hours from start timestamp
                let targetTimestamp = forkedBlockTimestamp + diff100HoursTimestamp
                await timeMachine.advanceBlockAndSetTime(targetTimestamp)

                console.log('[INFO]: forkedBlockTimestamp: ' + forkedBlockTimestamp)
                console.log('[INFO]: targetTimestamp: ' + targetTimestamp)

                // check usdt poolstaked
                usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, userA])
                console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + userA)

                // unstake USDT from saving type 2, 15days
                await send(
                    stakingContractInstance,
                    'withdraw',
                    [usdtPoolId, BNUtils.mul10pow(new BigNumber(unstakeUsdtAmount), tokenAddress.USDT.decimals), savingType15Days],
                    { from: userA }).then(() => {
                        console.log('[INFO]: Unstake ' + unstakeUsdtAmount + ' USDT from saving type ' + savingType15Days)
                    })

                // check usdt pool staked amount
                usdtTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [usdtPoolId, userA])
                console.log('[INFO]: USDT Staked amount is ' + BNUtils.div10pow(new BigNumber(usdtTokenStaked), tokenAddress.USDT.decimals) + ' USDT , holder address: ' + userA)


                await call(stakingContractInstance, 'userInfos', [usdtPoolId, userA, '1']).then(res => {
                    console.log('[INFO]: before claimBella, userInfos on saving type 1 --------------------------------------------------------')
                    console.log(res)
                })
                
              
               // claim usdt pool with saving type 1
                await send(stakingContractInstance, 'claimAllBella', [usdtPoolId], { from: userA }).then(() => {
                    console.log('[INFO]: Success call claimAllBella method on usdt pool by userA ' + userA)
                })

                delayedBel = await call(stakingContractInstance, 'delayedBella', [], { from: userA})
                console.log('[INFO]: Delayed Bel amount: ' + delayedBel)

                AssertionUtils.assertBNEq(delayedBel, BNUtils.mul10pow(new BigNumber(expectedDelayedBelAmount), 16))

                collectableBel = await call(stakingContractInstance, 'collectiableBella', [])
                console.log('[INFO]: collectiableBella Bel amount: ' + collectableBel)

                AssertionUtils.assertBNEq(collectableBel, BNUtils.mul10pow(new BigNumber(expectedCollectableBelAmount), 16))
            })
        })

        it('after 100 hours user can get accuratly BEL reward from WBTC pool, saving type instance', async() => {
            // set timestamp plus 100 hours
            const diff100HoursTimestamp = 360000 // 100 * 60 * 60
            const expectedBelRewardAmount = 6252

            let belReceivedAmount

            await timeMachine.sendAndRollback(async () => {
                // forward 100 hours from start timestamp
                let targetTimestamp = forkedBlockTimestamp + diff100HoursTimestamp
                await timeMachine.advanceBlockAndSetTime(targetTimestamp)

                console.log('[INFO]: forkedBlockTimestamp: ' + forkedBlockTimestamp)
                console.log('[INFO]: targetTimestamp: ' + targetTimestamp)

                // check bel reward amount
                await AccountUtils.balanceOfERC20Token('BEL', stakingContractAddress).then(res => {
                    console.log('[INFO]: stakingContractAddress BEL balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })

                // check wbtc poolstaked
                wbtcTokenStaked = await call(stakingContractInstance, 'getBtokenStaked', [wbtcPoolId, userA], { from: userA })
                console.log('[INFO]: WBTC Staked amount is ' + BNUtils.div10pow(new BigNumber(wbtcTokenStaked), tokenAddress.WBTC.decimals) + ' WBTC , holder address: ' + userA)
            
                await send(stakingContractInstance, 'claimAllBella', [wbtcPoolId], { from: userA }).then(() => {
                    console.log('[INFO]: Success call claimAllBella method by userA ' + userA)
                })

                await AccountUtils.balanceOfERC20Token('BEL', userA).then(res => {
                    belReceivedAmount = res
                    console.log('[INFO]: userA BEL balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })

                AssertionUtils.assertBNEq(belReceivedAmount, BNUtils.mul10pow(new BigNumber(expectedBelRewardAmount), 16))
            })
        })

        it('after 100 hours, user can accurately collect delayed BEL in USDT pool', async() => {
            // set timestamp plus 100 hours
            const diff100HoursTimestamp = 360000 // 100 * 60 * 60
            const diff192HoursTimestamp = 691200 // 192 * 60 * 60

            const expectedCollectableBelAmount = 13847

            let delayedBel
            let collectableBel
            let receivedBel100Hour
            let receivedBel292Hour

            await timeMachine.sendAndRollback(async () => {
                // forward 100 hours from start timestamp
                let firstTargetTimestamp = forkedBlockTimestamp + diff100HoursTimestamp
                await timeMachine.advanceBlockAndSetTime(firstTargetTimestamp)

                console.log('[INFO]: forkedBlockTimestamp: ' + forkedBlockTimestamp)
                console.log('[INFO]: first target timestamp: ' + firstTargetTimestamp)
                
               // claim USDT pool with saving type 1
                await send(stakingContractInstance, 'claimAllBella', [usdtPoolId], { from: userA }).then(() => {
                    console.log('[INFO]: Success call claimAllBella method on USDT pool by userA ' + userA)
                })

                delayedBel = await call(stakingContractInstance, 'delayedBella', [], { from: userA})
                console.log('[INFO]: Delayed Bel amount: ' + BNUtils.div10pow(new BigNumber(delayedBel), tokenAddress.BEL.decimals))

                let secondTargetTimestam = firstTargetTimestamp + diff192HoursTimestamp
                await timeMachine.advanceBlockAndSetTime(secondTargetTimestam)

                console.log('[INFO]: second target timestamp: ' + secondTargetTimestam)

                collectableBel = await call(stakingContractInstance, 'collectiableBella', [], { from: userA})
                console.log('[INFO]: collectiableBella Bel amount: ' + collectableBel)

                // check userA wallet BEL balance
                await AccountUtils.balanceOfERC20Token('BEL', userA).then(res => {
                    receivedBel100Hour = new BigNumber(res)
                    console.log('[INFO]: userA BEL balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })

                // userA collect delayed BEL
                await send(stakingContractInstance, 'collectBella', [], { from: userA }).then(() => {
                    console.log('[INFO]: collect delayed BEL reward')
                })

                // check userA wallet BEL balance
                await AccountUtils.balanceOfERC20Token('BEL', userA).then(res => {
                    receivedBel292Hour = new BigNumber(res)
                    console.log('[INFO]: userA BEL balance: ' + BNUtils.div10pow(new BigNumber(res), tokenAddress.BEL.decimals) + ' BEL')
                })

                let belRewardWaitCollected = receivedBel292Hour.sub(receivedBel100Hour)

                AssertionUtils.assertBNEq(collectableBel, BNUtils.mul10pow(new BigNumber(expectedCollectableBelAmount), 16))

                AssertionUtils.assertBNEq(belRewardWaitCollected, BNUtils.mul10pow(new BigNumber(expectedCollectableBelAmount), 16))
            })
        })



    })
})