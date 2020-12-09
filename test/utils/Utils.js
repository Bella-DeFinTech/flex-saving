const BigNumber = require('bignumber.js');
const { time } = require("@openzeppelin/test-helpers");
BigNumber.config({ DECIMAL_PLACES: 0 });

let gasLogger = {};
let gasLoggerNum = {};

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

timeTravel = async (time) => {
  await increaseTime(time);
  await mineBlock();
  return Promise.resolve(web3.eth.getBlock('latest'));
}

increaseTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [time],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err); }
      return resolve(result);
    });
  });
}

mineBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_mine",
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err); }
      return resolve(result)
    });
  });
}

function assertBNEq(a, b) {
  let _a = new BigNumber(a);
  let _b = new BigNumber(b);
  try {
    expect(_a).toEqual(_b);
  } catch (error) {
    Error.captureStackTrace(error, assertBNEq)
    throw error
  }
}

function assertApproxBNEq(a, b, c) {
  let _a = new BigNumber(a).div(c);
  let _b = new BigNumber(b).div(c);
  try {
    expect(_a).toEqual(_b);
  } catch (error) {
    Error.captureStackTrace(error, assertApproxBNEq)
    throw error
  }
}

function assertBNGt(a, b) {
  let _a = new BigNumber(a);
  let _b = new BigNumber(b);
  try {
    expect(_a).toBeGreaterThan(_b);
  } catch (error) {
    Error.captureStackTrace(error, assertBNGt)
    throw error
  }
}

function assertNEqBN(a, b) {
  let _a = new BigNumber(a);
  let _b = new BigNumber(b);
  try {
    expect(_a).not.toEqual(_b);
  } catch (error) {
    Error.captureStackTrace(error, assertNEqBN)
    throw error
  }
}

async function inBNfixed(a) {
  return await (new BigNumber(a)).toFixed();
}

module.exports = {
  gasLogger,
  gasLoggerNum,
  gasLog,
  printGasLog,
  timeTravel,
  assertBNEq,
  assertApproxBNEq,
  assertBNGt,
  assertNEqBN,
  inBNfixed
};
