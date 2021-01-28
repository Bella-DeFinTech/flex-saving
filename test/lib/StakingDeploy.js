const tokenAddress = require('../const/Token.js');
const fs = require('fs');
const console = require('console');

module.exports = async function (saddle, deployer, governance, customVaultAddressObj = {}) {
    const deploy = saddle.deploy
    const send = saddle.send

    // -----------------------PRODUCTION PARAMTERS --------------------------------
    // Configuration
    const deployerAddress  = deployer
    const governanceAddress = governance

    const startCalculeTimestamp = 1606132800 // 2020/11/23 20:00

    const bUsdtToken = { symbol: 'USDT', bSymbol: 'bUSDT', weight: 1000, boost: [115, 130, 160], withUpdate: false }
    const bUsdcToken = { symbol: 'USDC', bSymbol: 'bUSDC', weight: 1000, boost: [115, 130, 160], withUpdate: false }
    const bWbtcToken = { symbol: 'WBTC', bSymbol: 'bWBTC', weight: 1000, boost: [115, 130, 160], withUpdate: false }
    //const bArpaToken = { symbol: 'ARPA', bSymbol: 'bARPA', weight: 1000, boost: [115, 130, 160], withUpdate: false }
    const bDaiToken = { symbol: 'DAI', bSymbol: 'bDAI', weight: 1000, boost: [115, 130, 160], withUpdate: false }

    // -----------------------PRODUCTION PARAMTERS END--------------------------------

    // Const variable
    const bellaTokenAddress = tokenAddress.BEL.token

    // deploy info
    const deployFilename = 'deploy.txt'
    const vaultAddressFilename = 'vaults.json'

    bellaStakingInstance = null

    // deploy info file writer
    function addNewContent(content) {
        fs.appendFile(deployFilename, content + '\n', function (err) {
            if (err) {
                console.log('[ERROR]: FAILED write file.')
                throw err
            };
            console.log('[INFO]: ' + deployFilename + ' update with:\n    ' + content);
        });
    }
    // deploy info line changer
    function changeLine() {
        addNewContent('')
    }

    function getBtokenAddress(token) {
        let vaultAddress = ''
        let vaultAddressObj

        console.log('-----------------------------------------------------------------')
        console.log("customVaultAddressObj" + customVaultAddressObj)
        if (customVaultAddressObj === {}) {
            let rawVaultAddressJson = fs.readFileSync(vaultAddressFilename);
            vaultAddressObj = JSON.parse(rawVaultAddressJson);
        }
        else {
            vaultAddressObj = customVaultAddressObj
        }

        switch (token.symbol) {
            case 'USDT':
                vaultAddress = vaultAddressObj.bUsdt
                break;
            case 'USDC':
                vaultAddress = vaultAddressObj.bUsdc
                break;
            case 'WBTC':
                vaultAddress = vaultAddressObj.bWbtc
                break;
            case 'ARPA':
                vaultAddress = vaultAddressObj.bArpa
                break;
            case 'DAI':
                vaultAddress = vaultAddressObj.bDai
                break;
            default:
                console.log('[ERROR]: Check getBtokenAddress() func in staking script, do NOT found: ' + token.symbol + " vault contract address")
                break;
        }
        console.log('[INFO]: VaultAddressObj read ' + token.bSymbol + ' address: \n    ' + vaultAddress)
        return vaultAddress
    }

    function addStakingToken(stakingContractInstance, token, deployerAddress) {
        let bTokenAddress = getBtokenAddress(token)

        if (getBtokenAddress(token) !== '') {
            return send(stakingContractInstance, 'add', [token.weight, bTokenAddress, token.boost, token.withUpdate], { from: deployerAddress })
                .then(() => {
                    console.log('[INFO]: StakingContract add() func call: ')

                    addNewContent('[' + token.bSymbol + ' STAKING]'
                        + '\n    Weight: ' + token.weight
                        + '\n    TokenContractAddress: ' + bTokenAddress
                        + '\n    Boost: ' + token.boost.toString()
                        + '\n    WithUpdat: ' + token.withUpdate)
                })
        }
        else {
            return call(stakingContractInstance, 'poolLength', [], { from: deployerAddress })
                .then(() => {
                    addNewContent('[' + token.bSymbol + ' STAKING NON ADD]'
                        + '\n    Weight: ' + token.weight
                        + '\n    TokenContractAddress: ' + bTokenAddress
                        + '\n    Boost: ' + token.boost.toString()
                        + '\n    WithUpdat: ' + token.withUpdate)
                })

        }
    }

    console.log('[INFO]: Current deployerAddress: ' + deployerAddress)
    console.log('[INFO]: Current governance: ' + governanceAddress)

    addNewContent('\n')
    addNewContent('[Staking contracts migration]')
    addNewContent('-----------------------------------------------')
    addNewContent('[MIGRATE] deployerAddress: ' + deployerAddress)
    addNewContent('[MIGRATE] governanceAddress: ' + governanceAddress)
    changeLine()

    return deploy('BellaStaking', [bellaTokenAddress, startCalculeTimestamp, deployerAddress], { from: deployer }).then(
        (_bellaStakingInstance) => {
            bellaStakingInstance = _bellaStakingInstance

            addNewContent('[STAKING] BellaStaking contract address: \n    ' + bellaStakingInstance._address)

            return addStakingToken(bellaStakingInstance, bUsdtToken, deployerAddress)
        }).then(() => {

            return addStakingToken(bellaStakingInstance, bUsdcToken, deployerAddress)
        }).then(() => {

            return addStakingToken(bellaStakingInstance, bWbtcToken, deployerAddress)
        }).then(() => {
            
        //    return addStakingToken(bellaStakingInstance, bArpaToken, deployerAddress)
        //}).then(() => {

            return addStakingToken(bellaStakingInstance, bDaiToken, deployerAddress)
        }).then(() => {

            return send(bellaStakingInstance, 'transferOwnership', [governanceAddress], { from: deployerAddress })
        }).then(() => {
            addNewContent('')
            addNewContent('[STAKING] Change governance address:'
                + '\n    from: ' + deployerAddress
                + '\n    to: ' + governanceAddress)

            console.log('StakingContractAddress: ' + bellaStakingInstance._address)
            return bellaStakingInstance._address
        })


}
