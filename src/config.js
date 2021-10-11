const getConfig = mode => {
  let config = require('./config.global');
  if(typeof mode === 'undefined') mode = process.env.RUN_MODE || 'dev';
  let localConfig;
  try {
    localConfig = require(`./config.${mode}`);
  }
  catch (e) {
    localConfig = {};
  }
  if(mode === 'test') localConfig.inTesting = true;
  return {...config, ...localConfig};
};

module.exports.getConfig = getConfig;