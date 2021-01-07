const BigNumber = require('bn.js');

let gasLogger = {};
let gasLoggerNum = {};

web3.eth.extend({
  methods: [{
    name: 'unlockAccount',
    call: 'evm_unlockUnknownAccount',
    params: 1,
    inputFormatter: [web3.extend.formatters.inputAddressFormatter]
  }]
})

async function gasLog(logTo, targetPromise) {
  let tx = await targetPromise;
  gasUsed = tx.receipt.gasUsed;

  if (gasLogger[logTo] == undefined) {
    gasLogger[logTo] = gasUsed;
    gasLoggerNum[logTo] = 1;
  }
  else {
    gasLogger[logTo] = (gasLogger[logTo]) / (gasLoggerNum[logTo] + 1) + gasUsed / (gasLoggerNum[logTo] + 1);
    gasLoggerNum[logTo]++;
  }
}

async function printGasLog() {
  console.log(gasLogger);
}

unlockAccount = async (address) => {
  return web3.eth.unlockAccount(address)
}

function assertBNEq(received, expected) {
  let _a = new BigNumber(received);
  let _b = new BigNumber(expected);
  try {
    expect(_a.toString()).toEqual(_b.toString());
  } catch (error) {
    Error.captureStackTrace(error, assertBNEq)
    throw error
  }
}

function assertApproxBNEq(received, expected, denominator) {
  let _a = new BigNumber(received).div(denominator);
  let _b = new BigNumber(expected).div(denominator);
  try {
    expect(_a.toString()).toEqual(_b.toString());
  } catch (error) {
    Error.captureStackTrace(error, assertApproxBNEq)
    throw error
  }
}

function assertBNGt(received, expected) {
  let _a = new BigNumber(received);
  let _b = new BigNumber(expected);
  try {
    expect(_a.gt(_b)).toBeTruthy();
  } catch (error) {
    console.log('Received: ' + _a.toString())
    console.log('Expected: ' + _b.toString())
    Error.captureStackTrace(error, assertBNGt)
    throw error
  }
}

function assertNEqBN(received, expected) {
  let _a = new BigNumber(received);
  let _b = new BigNumber(expected);
  try {
    expect(_a.toString()).not.toEqual(_b.toString());
  } catch (error) {
    Error.captureStackTrace(error, assertNEqBN)
    throw error
  }
}

module.exports = {
  gasLogger,
  gasLoggerNum,
  gasLog,
  printGasLog,
  unlockAccount,
  assertBNEq,
  assertApproxBNEq,
  assertBNGt,
  assertNEqBN,
};
