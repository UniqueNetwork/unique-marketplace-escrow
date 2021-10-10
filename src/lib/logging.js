const util = require('./utility');

const logStatus = {
  ERROR: 'ERROR',
  RECEIVED: 'RECEIVED',
  FAILED: 'FAILED',
  INFO: 'INFO',
  REGISTERED: 'REGISTERED',
  FAILED_TO_REGISTER: 'FAILED TO REGISTER'
};

function log(operation, status = "") {
  console.log(`${util.getDate()} ${util.getTime()}: ${operation}${status.length > 0?',':''}${status}`);
}


module.exports = {
  status: logStatus, log
};
