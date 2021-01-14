let gasLogger = {}
let gasLoggerNum = {}

async function logTrxGasUsed(id, trxReceipt) {
  let gasUsed = trxReceipt.gasUsed
  if (gasLogger[id] == undefined) {
    gasLogger[id] = gasUsed
    gasLoggerNum[id] = 1
  }
  else {
    gasLoggerNum[id]++
    gasLogger[id] = Math.floor((gasLogger[id] + gasUsed) / gasLoggerNum[id])
  }
}

async function printGasLog() {
  console.log(gasLogger)
}

module.exports = {
  logTrxGasUsed,
  printGasLog
}
