const AssertionUtils = require("./utils/AssertionUtils.js")
const AccountUtils = require("./utils/AccountUtils.js")
const BNUtils = require("./utils/BNUtils.js");
const timeMachine = require("./utils/TimeMachine.js")
const CurvePool = require("./lib/CurvePool.js");
const BigNumber = require('bn.js');
const curvePoolConstant = require('./const/CurvePool.js');
const tokenAddress = require('./const/Token.js');
const curve3pool = require('./abi/3pool.js');

jest.setTimeout(30 * 60 * 1000);

describe('Test BellaFlexsaving Strategy, take USDT for example', () => {

    const governance = accounts[0]

    let strategyToken
    let strategyTokenAddress
    let strategyTokenHolder
    // beforeAll(async (done) => {
    //     strategyTokenAddress = tokenAddress.USDT.token
    //     strategyTokenHolder = tokenAddress.USDT.tokenHolder
    //     strategyToken = await saddle.getContractAt('IERC20', strategyTokenAddress)
    //     // // unlock unknown account for transaction
    //     await AccountUtils.unlockAccount(strategyTokenHolder)
    //     // // prepare strategyTokenHolder eth for gas from test account
    //     await AccountUtils.give10ETH(strategyTokenHolder)
    //     done()
    // })

    // let snapshotId

    // beforeEach(async () => {
    //     let snapshot = await timeMachine.takeSnapshot();
    //     snapshotId = snapshot['result'];
    // });

    // afterEach(async () => {
    //     await timeMachine.revertToSnapshot(snapshotId);
    // });

    describe('Test Virtual Price in one block', () => {
        // let curve
        // beforeAll(async (done) => {
        //     // Pre-test conditions 
        //     const blockInput = curvePoolConstant.input.atBlock('latest')
        //     const A = await blockInput.A()
        //     const balances = await blockInput.balances()
        //     const admin_balances = await blockInput.admin_balances()
        //     const tokens = await blockInput.tokens()
        //     curve = new CurvePool(A, balances, admin_balances, tokens)
        //     // When Flex Savings USDT Strategy deposits 10,000 USDT to Curve 3pool
        //     // prepare strategy Token balance(10000 USDT) from strategyTokenHolder
        //     done()
        // })

        it('Virtual Price can change in one block', async () => {
            // let virtualPrice0
            // let virtualPrice1
            // let testVirtualPriceInstance = await deploy('TestVirtualPrice', [], { from: governance });
            // // console.log(await AccountUtils.balanceOfERC20Token('USDT',strategyTokenHolder)) //563111889
            // await send(strategyToken, 'transfer', [testVirtualPriceInstance._address, BNUtils.mul10pow(new BigNumber('263111889'), 6).toString()], { from: strategyTokenHolder })
            // console.log(testVirtualPriceInstance._address)
            // console.log(await AccountUtils.balanceOfERC20Token('USDT', testVirtualPriceInstance._address))
            // console.log(await AccountUtils.balanceOfERC20Token('DAI', testVirtualPriceInstance._address))
            // // do exchange
            // await send(testVirtualPriceInstance, 'exchangeForDaiHugely', [], { from: governance })
            // console.log(await AccountUtils.balanceOfERC20Token('USDT', testVirtualPriceInstance._address))
            // console.log(await AccountUtils.balanceOfERC20Token('DAI', testVirtualPriceInstance._address))
            // // get virtual price
            // virtualPrice0 = await call(testVirtualPriceInstance, 'virtualPrice0')
            // virtualPrice1 = await call(testVirtualPriceInstance, 'virtualPrice1')
            // console.log(virtualPrice0)
            // console.log(virtualPrice1)

            // await send(strategyToken, 'transfer', [testVirtualPriceInstance._address, BNUtils.mul10pow(new BigNumber('263111889'), 6).toString()], { from: strategyTokenHolder })
            // console.log(testVirtualPriceInstance._address)
            // console.log(await AccountUtils.balanceOfERC20Token('USDT', testVirtualPriceInstance._address))
            // console.log(await AccountUtils.balanceOfERC20Token('USDC', testVirtualPriceInstance._address))
            // // do exchange
            // await send(testVirtualPriceInstance, 'exchangeForUsdcHugely', [], { from: governance })
            // console.log(await AccountUtils.balanceOfERC20Token('USDT', testVirtualPriceInstance._address))
            // console.log(await AccountUtils.balanceOfERC20Token('USDC', testVirtualPriceInstance._address))
            // // get virtual price
            // virtualPrice0 = await call(testVirtualPriceInstance, 'virtualPrice0')
            // virtualPrice1 = await call(testVirtualPriceInstance, 'virtualPrice1')
            // console.log(virtualPrice0)
            // console.log(virtualPrice1)

            const curve3poolAddress = '0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB'
            const curve3poolInstance = new web3.eth.Contract(curve3pool.abiArray, curve3poolAddress);
            let virtualPrice = await curve3poolInstance.methods.get_virtual_price().call({}, 'latest')
            console.log(virtualPrice)
            let DAIAmount = await curve3poolInstance.methods.balances(0).call({}, 'latest')
            console.log(DAIAmount)
            let USDCAmount = await curve3poolInstance.methods.balances(1).call({}, 'latest')
            console.log(USDCAmount)
            let USDTAmount = await curve3poolInstance.methods.balances(2).call({}, 'latest')
            console.log(USDTAmount)
        })

    })
})