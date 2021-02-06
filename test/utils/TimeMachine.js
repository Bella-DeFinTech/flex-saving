advanceTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [time],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}

advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}

advanceBlockAndSetTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [time],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}

advanceTimeAndBlock = async (time) => {
  //capture current time
  let block = await web3.eth.getBlock('latest')
  let forwardTime = block['timestamp'] + time

  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [forwardTime],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}

takeSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_snapshot',
      id: new Date().getTime()
    }, (err, snapshotId) => {
      if (err) { return reject(err) }
      return resolve(snapshotId)
    })
  })
}

revertToSnapshot = (id) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_revert',
      params: [id],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}

// this function will revert changes to chain after execution 
sendAndRollback = async (trx) => {
  // you don't want to change this pattern
  let snapshot = await takeSnapshot();
  snapshotId = snapshot['result'];
  let res = await trx()
  await revertToSnapshot(snapshotId);
  return res
}

getTimeStampByTrxReceipt = async (receipt) => {
  let trxBlock = await web3.eth.getBlock(receipt.blockNumber)
  return trxBlock.timestamp
}

getLatestTimeStamp = async () => {
  let trxBlock = await web3.eth.getBlock('latest')
  return trxBlock.timestamp
}

module.exports = {
  advanceTime,
  advanceBlock,
  advanceBlockAndSetTime,
  advanceTimeAndBlock,
  takeSnapshot,
  revertToSnapshot,
  sendAndRollback,
  getTimeStampByTrxReceipt,
  getLatestTimeStamp
}
