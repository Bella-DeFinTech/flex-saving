// Deploy Configuration - Current vault tokens
const strategyTokens = require('../const/StrategyToken.js');
const fs = require('fs');
// don't capture console
const console = require('console');

module.exports = async function (saddle, deployer, governance, deployTokenIndices = [], controllerAddress, whitelistAddress) {

  const deploy = saddle.deploy
  const send = saddle.send
  const web3 = saddle.web3
  let deployerTrxNonce = await web3.eth.getTransactionCount(deployer, 'latest')
  let governanceTrxNonce = await web3.eth.getTransactionCount(governance, 'latest')
  // -----------------------PRODUCTION PARAMTERS --------------------------------
  const governanceAddress = '0x6E91F688433F2E2198c3eFe363eE46D14002e9ea'
  const firemanAddress = '0xDD1Ce2d72b2FdCCB2D10D3D04D5ca2Ba81E39aD3'
  const strategyTokenRewardsAddress = '0x78172CaabC374C4520aF613467E82fc9e1dC4Ba9'
  const BELRewardsAddress = '0xcA7aE36A38eA4dE50DFEeCF6A4c44fC074811a6c'
  let controllerInstance = await saddle.getContractAt('Controller', controllerAddress)
  let whitelistInstance = await saddle.getContractAt('WhiteList', whitelistAddress)

  const deployAddress = {
    controller: '',
    whitelist: '',
    governance: governanceAddress,
    strategyTokenRewardsAddress: strategyTokenRewardsAddress,
    BELRewardsAddress: BELRewardsAddress,
    vault: {
      USDT: '',
      USDC: '',
      WBTC: '',
      ARPA: '',
      DAI: '',
      BUSD: '',
      HBTC: ''
    },
    strategy: {
      USDT: '',
      USDC: '',
      WBTC: '',
      ARPA: '',
      DAI: '',
      BUSD: '',
      HBTC: ''
    }
  }

  // -----------------------PRODUCTION PARAMTERS --------------------------------

  // Data obj write to json file
  let vaultAddressObj = {
    bUsdt: '',
    bUsdc: '',
    bWbtc: '',
    bArpa: '',
    bDai: '',
    bBusd: '',
    bHbtc: '',
  }

  // console.log('[INFO]: Current account: ' + accounts[0])
  // console.log('[INFO]: Current network: ' + network)

  // Deploy info file, DO NOT CHANGE NAME
  const deployFilename = 'deploy.txt'
  const vaultAddressFilename = 'vaults.json'

  // Variables used during deployment
  // controllerInstance = null;
  // whitelistInstance = null;
  bvaultInstance = null;
  strategyContractInstance = null;
  tokenContractInstance = null;

  // delete old deploy.txt AND vaults.json
  fs.unlink(deployFilename, (err) => {
    if (err) {
      console.log('[INFO]: FILE ' + deployFilename + ' do NOT exist.')
    }
    else {
      console.log('[INFO]: Deleted deperacated ' + deployFilename + '.');
    }
  });

  fs.unlink(vaultAddressFilename, (err) => {
    if (err) {
      console.log('[INFO]: FILE ' + vaultAddressFilename + ' do NOT exist.')
    }
    else {
      console.log('[INFO]: Deleted deperacated ' + vaultAddressFilename + '.');
    }
  });

  // init deploy info file
  fs.writeFile(deployFilename, '[Vault contract migration]\n', function (err) {
    if (err) {
      console.log('[ERROR]: FAILED WRITE FILE: ' + deployFilename)
      throw err
    }
  });

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

  // vault obj generator
  function generateVaultObj(token, vaultAddress) {
    switch (token.symbol) {
      case 'USDT':
        vaultAddressObj.bUsdt = vaultAddress
        console.log('[INFO]: VaultAddressObj write address: ' + vaultAddress)
        break;
      case 'USDC':
        vaultAddressObj.bUsdc = vaultAddress
        console.log('[INFO]: VaultAddressObj write address: ' + vaultAddress)
        break;
      case 'WBTC':
        vaultAddressObj.bWbtc = vaultAddress
        console.log('[INFO]: VaultAddressObj write address: ' + vaultAddress)
        break;
      case 'ARPA':
        vaultAddressObj.bArpa = vaultAddress
        console.log('[INFO]: VaultAddressObj write address: ' + vaultAddress)
        break;
      case 'DAI':
        vaultAddressObj.bDai = vaultAddress
        console.log('[INFO]: VaultAddressObj write address: ' + vaultAddress)
        break;
      case 'BUSD':
        vaultAddressObj.bBusd = vaultAddress
        console.log('[INFO]: VaultAddressObj write address: ' + vaultAddress)
        break;
      case 'HBTC':
        vaultAddressObj.bHbtc = vaultAddress
        console.log('[INFO]: VaultAddressObj write address: ' + vaultAddress)
        break;
      default:
        console.log('[INFO]: VaultAddressObj write address: N/A')
        break;
    }
  }

  addNewContent('-----------------------------------------------')
  addNewContent('[MIGRATE] Deployer address: ' + deployer)
  addNewContent('[MIGRATE] Governance address: ' + governanceAddress)
  addNewContent('[MIGRATE] Firman address: ' + firemanAddress)
  changeLine()

  function addVault(controllerInstance, _whitelistInstance, strategy, token) {
    if (deployTokenIndices.length > 0 && deployTokenIndices.indexOf(token.index) === -1) {
      return
    }
    // if (network !== 'private') {
    //   console.log('[WARNING]: network name: ' + network) 
    // }

    changeLine()
    addNewContent('[' + token.symbol + ' VAULT]: ' + token.symbol + ' TokenAddress: ' + token._address)

    //return whitelistInstance.add(token._address).then(() => {
    //  console.log('[INFO] Add ' + token.symbol + ' to WhiteList Contract\n    ' + whitelistInstance._address)

    return deploy('bVault', [token._address, controllerAddress, whitelistAddress], { from: deployer }).then((_bvaultInstance) => {
      deployerTrxNonce++
      bvaultInstance = _bvaultInstance

      addNewContent('[' + token.symbol + ' VAULT]: ' + token.symbol + ' VaultAddress: ' + bvaultInstance._address)
      generateVaultObj(token, bvaultInstance._address)

      if (token.symbol === 'ARPA') {
        return deploy(strategy, [controllerAddress, deployer, arpaVaultStartTimestamp], { from: deployer })
      }
      else {
        return deploy(strategy, [controllerAddress, deployer], { from: deployer })
      }
    }).then((_strategyContractInstance) => {
      deployerTrxNonce++
      strategyContractInstance = _strategyContractInstance
      addNewContent('[' + token.symbol + ' VAULT]: ' + token.symbol + ' StrategyAddress: ' + strategyContractInstance._address)

      deployAddress.vault[token.symbol] = bvaultInstance._address
      deployAddress.strategy[token.symbol] = strategyContractInstance._address

      console.log('[INFO]: Target token is: ' + token.symbol + ' Token')

      return saddle.getContractAt('IERC20', token._address).then((tokenContractInstance) => {
        send(tokenContractInstance, 'approve', [strategyContractInstance._address, web3.utils.toWei('100000000', 'ether')], { from: deployer, nonce: deployerTrxNonce })
      })
    }).then(() => {
      deployerTrxNonce++
      console.log('[INFO]: ' + token.symbol + ' token contract approve, strategy contract address: ' + strategyContractInstance._address)

      return send(controllerInstance, 'setVault', [token._address, bvaultInstance._address], { from: governance, nonce: governanceTrxNonce })
    }).then(() => {
      governanceTrxNonce++
      console.log('[INFO]: Controller setVault(): \n    '
        + token.symbol + ' Token address: ' + token._address
        + '\n   Vault address: ' + bvaultInstance._address)

      return send(controllerInstance, 'setStrategy', [token._address, strategyContractInstance._address], { from: governance, nonce: governanceTrxNonce })
    }).then(() => {
      governanceTrxNonce++
      console.log('[INFO]: Controller setStrategy(): \n   '
        + token.symbol + ' Token address: ' + token._address
        + '\n   Strategy address: ' + strategyContractInstance._address)

      return send(bvaultInstance, 'setGovernance', [governanceAddress], { from: deployer, nonce: deployerTrxNonce })
    }).then(() => {
      deployerTrxNonce++
      addNewContent('[' + token.symbol + ' VAULT]:  Change governance address:'
        + '\n    from: ' + deployer
        + '\n    to: ' + governanceAddress)


      return send(strategyContractInstance, 'setGovernance', [governanceAddress], { from: deployer, nonce: deployerTrxNonce })
    }).then(() => {
      deployerTrxNonce++
      addNewContent('[' + token.symbol + ' STRATEGY]:  Change governance address:'
        + '\n    from: ' + deployer
        + '\n    to: ' + governanceAddress)

      console.log('[INFO]: FINISH add Vault and Strategy for ' + token.symbol + ' Token')
    })
  }

  return addVault(controllerInstance, whitelistInstance, 'StrategyWbtc', strategyTokens.WBTC)

    .then(() => {
      addNewContent('')
      addNewContent('[FLEX SAVINGS] Change WhiteList governance address:'
        + '\n    from: ' + deployer
        + '\n    to: ' + governanceAddress)

      // write vaultAddressObj
      var vaultAddressJson = JSON.stringify(vaultAddressObj);
      console.log(vaultAddressJson)

      fs.exists(vaultAddressFilename, (isExist) => {
        if (isExist) {
          fs.unlink(vaultAddressFilename, (err) => {
            if (err) {
              console.log('[INFO]: FILE ' + vaultAddressFilename + ' do NOT exist.')
            }
            else {
              console.log('[INFO]: Deleted deperacated ' + vaultAddressFilename + '.');
            }
          })
        }
      })

      fs.writeFile(vaultAddressFilename, vaultAddressJson, 'utf8', (err) => {
        if (err) throw err;
        console.log('[INFO]: Success write VaultAddressObj to file: ' + vaultAddressFilename)
      });
      console.log(deployAddress)
      return deployAddress
    })
};
