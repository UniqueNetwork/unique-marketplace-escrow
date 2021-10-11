module.exports = {
  wsEndpoint : process.env.UNIQUE_WS_ENDPOINT || 'wss://testnet2.uniquenetwork.io',

  adminSeed : process.env.ADMIN_SEED || '//Alice',
  marketContractAddress : process.env.MATCHER_CONTRACT_ADDRESS || "5EuBcZYh47ruAjrDweHvH4Fm5BwYkiFHNpTGKWAHkA3WFsEG",

  whiteList : false,

  dbHost : process.env.DB_HOST || 'localhost',
  dbPort : process.env.DB_PORT || 5432,
  dbName : process.env.DB_NAME|| 'marketplace',
  dbUser : process.env.DB_USER || 'marketplace',
  dbPassword : process.env.DB_PASSWORD || '12345',

  // From which block to start at the first run.
  // Either block number or 'current' to start from current block.
  startFromBlock : process.env.START_FROM_BLOCK || 'current'
};