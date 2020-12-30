const Utils = require("./utils/Utils.js")

jest.setTimeout(300000)

describe('Test BellaFlexsaving Strategy', () => {

    const governance = accounts[0]
    const wantTokenAddress = '0x6b175474e89094c44da98b954eedeac495271d0f'
    const wantTokenHolder = '0xf28d8a46cf2811c1fcc0cbbe0ab28dcecaa4f68c'

    let strategy
    let wantToken

    beforeAll(async (done) => {
        strategy = await saddle.getContractAt('StrategyDai', '0xfE5Bf2562CEb1a040a683872a3307f9dC74f6FD1')
        wantToken = await saddle.getContractAt('IERC20', wantTokenAddress)
        // console.log(await call(wantToken, 'balanceOf', [wantTokenHolder]))
        web3.eth.getBalance(governance)
            .then((balance) => {
                console.log("ETH Balance: " + balance)
            })
        // unlock unknown account for transaction
        await Utils.unlockAccount(wantTokenHolder)
        // prepare wantTokenHolder eth for gas from test account
        await web3.eth.sendTransaction({
            from: governance,
            to: wantTokenHolder,
            value: web3.utils.toWei("1"),
            gas: 23000
        })
        // prepare strategy Token balance from wantTokenHolder
        send(wantToken, 'transfer', [strategy._address, web3.utils.toWei("30000")], { from: wantTokenHolder }).then(() => {
            console.log("Token distributed")
            done()
        })
    })

    it('lp strategy can deposit', async () => {
        await send(strategy, 'deposit', [], { from: governance })
        let investmentAmount = await call(strategy, 'balanceInPool')
        console.log("balanceInPool: " + investmentAmount)
        Utils.assertBNGt(investmentAmount, 0)
    })

})