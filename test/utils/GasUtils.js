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

module.exports = {
  gasLogger,
  gasLoggerNum,
  gasLog,
  printGasLog
};
