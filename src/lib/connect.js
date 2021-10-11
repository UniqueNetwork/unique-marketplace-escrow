const { ApiPromise, WsProvider } = require('@polkadot/api');
const logging = require('./logging');
const rtt = require("../runtime_types.json");
const util = require('./utility');


module.exports = async function (config) {
  // Initialise the provider to connect to the node
  logging.log(`Connecting to ${config.wsEndpoint}`);
  const wsProvider = new WsProvider(config.wsEndpoint);

  // Create the API and wait until ready
  const api = new ApiPromise({
    provider: wsProvider,
    types: rtt
  });

  api.on('disconnected', async (value) => {
    logging.log(`disconnected: ${value}`, logging.status.ERROR);
    util.terminateProcess();
  });
  api.on('error', async (value) => {
    logging.log(`error: ${value.toString()}`, logging.status.ERROR);
    util.terminateProcess();
  });

  await api.isReady;

  return api;
}