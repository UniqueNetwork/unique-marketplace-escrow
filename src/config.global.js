module.exports = {
  wsEndpoint : process.env.UNIQUE_WS_ENDPOINT || 'wss://testnet2.uniquenetwork.io',

  adminSeed : process.env.ADMIN_SEED || '//Alice',
  marketContractAddress : process.env.MATCHER_CONTRACT_ADDRESS || "5EuBcZYh47ruAjrDweHvH4Fm5BwYkiFHNpTGKWAHkA3WFsEG",

  whiteList : false,

  cancelDuplicates: true,

  postgresUrl: process.env.POSTGRES_URL || 'postgres://marketplace:12345@marketplace-postgres:5432/marketplace_db',

  // From which block to start at the first run.
  // Either block number or 'current' to start from current block.
  startFromBlock : `${process.env.UNIQUE_START_FROM_BLOCK || 'current'}`
};