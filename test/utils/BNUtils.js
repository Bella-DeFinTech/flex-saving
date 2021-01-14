const BigNumber = require('bn.js');

function sum(bnArr) {
  return bnArr.reduce((prev, current) => {
    return prev.add(current)
  })
}

function mul10pow(bn, n) {
  return bn.mul(new BigNumber(10).pow(new BigNumber(n)))
}

function get10pow(n) {
  return new BigNumber(10).pow(new BigNumber(n))
}

function isPositive(bn) {
  return bn.cmpn(0) === 1
}

module.exports = {
  sum,
  mul10pow,
  get10pow,
  isPositive
};
