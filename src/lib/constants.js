const transactionStatus = {
  STATUS_NOT_READY: 'NotReady',
  STATUS_FAIL: 'Fail',
  STATUS_SUCCESS: 'Success'
};

const healthState = {
  STATE_TRANSACTION: 'in_transaction',
  STATE_IDLE: 'idle'
}

const offerStatuses = {
  ACTIVE: 1,
  CANCELED: 2,
  TRADED: 3
}

module.exports = {
  transactionStatus, healthState, offerStatuses
};