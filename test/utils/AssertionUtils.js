const BigNumber = require('bn.js');

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
  let _a = new BigNumber(received).div(new BigNumber(denominator));
  let _b = new BigNumber(expected).div(new BigNumber(denominator));
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
  assertBNEq,
  assertApproxBNEq,
  assertBNGt,
  assertNEqBN,
};
