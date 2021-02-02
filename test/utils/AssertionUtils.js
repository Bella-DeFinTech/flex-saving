const BigNumber = require('bn.js')

function assertBNEq(received, expected) {
  let _a = new BigNumber(received)
  let _b = new BigNumber(expected)
  try {
    expect(_a.toString()).toEqual(_b.toString())
  } catch (error) {
    Error.captureStackTrace(error, assertBNEq)
    throw error
  }
}

function assertApproxBNEq(received, expected, denominator) {
  let _a = new BigNumber(received).div(new BigNumber(denominator))
  let _b = new BigNumber(expected).div(new BigNumber(denominator))
  try {
    expect(_a.toString()).toEqual(_b.toString())
  } catch (error) {
    Error.captureStackTrace(error, assertApproxBNEq)
    throw error
  }
}

function assertBNApproxRange(received, expected, rangePortion, rangeBase) {
  let _a = new BigNumber(received)
  let _b = new BigNumber(expected)
  let diff = _a.sub(_b).abs()
  let expectedDiff = _b.muln(rangePortion).divn(rangeBase)
  try {
    expect(expectedDiff.gte(diff)).toBeTruthy()
  } catch (error) {
    console.log('Received: ' + _a.toString())
    console.log('Expected: ' + _b.toString())
    console.log('Diff: ' + diff.toString())
    console.log('Expected max Diff: ' + expectedDiff.toString())
    Error.captureStackTrace(error, assertApproxBNEq)
    throw error
  }
}

function assertBNGt(received, expected) {
  let _a = new BigNumber(received)
  let _b = new BigNumber(expected)
  try {
    expect(_a.gt(_b)).toBeTruthy()
  } catch (error) {
    console.log('Received: ' + _a.toString())
    console.log('Expected: ' + _b.toString())
    Error.captureStackTrace(error, assertBNGt)
    throw error
  }
}

function assertNEqBN(received, expected) {
  let _a = new BigNumber(received)
  let _b = new BigNumber(expected)
  try {
    expect(_a.toString()).not.toEqual(_b.toString())
  } catch (error) {
    Error.captureStackTrace(error, assertNEqBN)
    throw error
  }
}

function assertThrowError(func, error = undefined) {
  expect(func).rejects.toThrow(error)
}

async function assertThrowErrorAsync(func, error = undefined) {
  await expect(func).rejects.toThrow(error)
}

module.exports = {
  assertBNEq,
  assertApproxBNEq,
  assertBNApproxRange,
  assertBNGt,
  assertNEqBN,
  assertThrowError,
  assertThrowErrorAsync
}
