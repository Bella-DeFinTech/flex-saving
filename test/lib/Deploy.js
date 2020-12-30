const fs = require('fs');
// don't capture console
const console = require('console');

module.exports = async function (saddle, deployer, accounts) {

  const deploy = saddle.deploy
  const send = saddle.send
  const web3 = saddle.web3

  // -----------------------PRODUCTION PARAMTERS --------------------------------
  const governanceAddress = accounts[0]
  const firemanAddress = accounts[0]
  const deployerAddress = accounts[0]
  const belTokenAddress = "0xa91ac63d040deb1b7a5e4d4134ad23eb0ba07e14"

  const arpaVaultStartTimestamp = 1606132800 // 2020/11/23 20:00

  // Deploy Configuration - Current vault tokens
  const usdtToken = { symbol: 'USDT', _address: '0xdac17f958d2ee523a2206206994597c13d831ec7' }
  const usdcToken = { symbol: 'USDC', _address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }
  const wbtcToken = { symbol: 'WBTC', _address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' }
  const arpaToken = { symbol: 'ARPA', _address: '0xba50933c268f567bdc86e1ac131be072c6b0b71a' }
  const daiToken = { symbol: 'DAI', _address: '0x6b175474e89094c44da98b954eedeac495271d0f' }
  const busdToken = { symbol: 'BUSD', _address: '0x4fabb145d64652a948d72533023f6e7a623c7c53' }
  const hbtcToken = { symbol: 'HBTC', _address: '0x0316EB71485b0Ab14103307bf65a021042c6d380' }

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

  console.log('[INFO]: Current account: ' + accounts[0])
  // console.log('[INFO]: Current network: ' + network)

  // Deploy info file, DO NOT CHANGE NAME
  const deployFilename = 'deploy.txt'
  const vaultAddressFilename = 'vaults.json'

  // Variables used during deployment
  controllerInstance = null;
  whitelistInstance = null;
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
  addNewContent('[MIGRATE] Deployer address: ' + deployerAddress)
  addNewContent('[MIGRATE] Governance address: ' + governanceAddress)
  addNewContent('[MIGRATE] Firman address: ' + firemanAddress)
  changeLine()

  function addVault(controllerInstance, whitelistInstance, strategy, token) {
    // if (network !== 'private') {
    //   console.log('[WARNING]: network name: ' + network) 
    // }

    changeLine()
    addNewContent('[' + token.symbol + ' VAULT]: ' + token.symbol + ' TokenAddress: ' + token._address)

    //return whitelistInstance.add(token._address).then(() => {
    //  console.log('[INFO] Add ' + token.symbol + ' to WhiteList Contract\n    ' + whitelistInstance._address)

    return deploy('bVault', [token._address, controllerInstance._address, whitelistInstance._address], { from: deployer }).then((_bvaultInstance) => {
      bvaultInstance = _bvaultInstance

      addNewContent('[' + token.symbol + ' VAULT]: ' + token.symbol + ' VaultAddress: ' + bvaultInstance._address)
      generateVaultObj(token, bvaultInstance._address)

      if (token.symbol === 'ARPA') {
        return deploy(strategy, [controllerInstance._address, deployerAddress, arpaVaultStartTimestamp], { from: deployer })
      }
      else {
        return deploy(strategy, [controllerInstance._address, deployerAddress], { from: deployer })
      }
    }).then((_strategyContractInstance) => {
      strategyContractInstance = _strategyContractInstance
      addNewContent('[' + token.symbol + ' VAULT]: ' + token.symbol + ' StrategyAddress: ' + strategyContractInstance._address)

      console.log('[INFO]: Target token is: ' + token.symbol + ' Token')

      return saddle.getContractAt('IERC20', token._address).then((tokenContractInstance) => {
        send(tokenContractInstance, 'approve', [strategyContractInstance._address, web3.utils.toWei('100000000', 'ether')], { from: deployerAddress })
      })
    }).then(() => {
      console.log('[INFO]: ' + token.symbol + ' token contract approve, strategy contract address: ' + strategyContractInstance._address)

      return send(controllerInstance, 'setVault', [token._address, bvaultInstance._address], { from: deployer })
    }).then(() => {
      console.log('[INFO]: Controller setVault(): \n    '
        + token.symbol + ' Token address: ' + token._address
        + '\n   Vault address: ' + bvaultInstance._address)

      return send(controllerInstance, 'setStrategy', [token._address, strategyContractInstance._address], { from: deployer })
    }).then(() => {
      console.log('[INFO]: Controller setStrategy(): \n   '
        + token.symbol + ' Token address: ' + token._address
        + '\n   Strategy address: ' + strategyContractInstance._address)

      return send(bvaultInstance, 'setGovernance', [governanceAddress], { from: deployer })
    }).then(() => {
      addNewContent('[' + token.symbol + ' VAULT]:  Change governance address:'
        + '\n    from: ' + deployerAddress
        + '\n    to: ' + governanceAddress)


      return send(strategyContractInstance, 'setGovernance', [governanceAddress], { from: deployer })
    }).then(() => {
      addNewContent('[' + token.symbol + ' STRATEGY]:  Change governance address:'
        + '\n    from: ' + deployerAddress
        + '\n    to: ' + governanceAddress)

      console.log('[INFO]: FINISH add Vault and Strategy for ' + token.symbol + ' Token')
    })
  }

  return deploy('Controller', [belTokenAddress, deployerAddress, firemanAddress], { from: deployer }).then(
    (_controllerInstance) => {
      controllerInstance = _controllerInstance

      addNewContent('[FLEX SAVINGS] ControllerAddress: ' + controllerInstance._address)

      // related contract deployment
      return deploy('WhiteList', [deployerAddress], { from: deployer })
    }).then((_whitelistInstance) => {
      whitelistInstance = _whitelistInstance

      addNewContent('[FLEX SAVINGS] WhitelistAddress: ' + whitelistInstance._address)

      return addVault(controllerInstance, whitelistInstance, 'StrategyUsdt', usdtToken)
    }).then(() => {
      return addVault(controllerInstance, whitelistInstance, 'StrategyUsdc', usdcToken)
    }).then(() => {
      return addVault(controllerInstance, whitelistInstance, 'StrategyWbtc', wbtcToken)
    }).then(() => {
      return addVault(controllerInstance, whitelistInstance, 'StrategyArpa', arpaToken)
    }).then(() => {
      return addVault(controllerInstance, whitelistInstance, 'StrategyDai', daiToken)
    }).then(() => {
      return addVault(controllerInstance, whitelistInstance, 'StrategyBusd', busdToken)
    }).then(() => {
      return addVault(controllerInstance, whitelistInstance, 'StrategyHbtc', hbtcToken)
    }).then(() => {
      return send(controllerInstance, 'setGovernance', [governanceAddress], { from: deployer })
    }).then(() => {
      addNewContent('')
      addNewContent('[FLEX SAVINGS] Change ControllerContract governance address:'
        + '\n    from: ' + deployerAddress
        + '\n    to: ' + governanceAddress)

      return send(whitelistInstance, 'transferOwnership', [governanceAddress], { from: deployer })
    }).then(() => {
      addNewContent('')
      addNewContent('[FLEX SAVINGS] Change WhiteList governance address:'
        + '\n    from: ' + deployerAddress
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
    })

};
