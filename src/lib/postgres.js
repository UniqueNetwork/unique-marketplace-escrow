const {Client} = require("pg");
const logging = require("./logging");

let dbClient = null;

async function getDbConnection() {
  if (!dbClient) {
    let config = require('../config').getConfig();
    dbClient = new Client({
      user: config.dbUser,
      host: config.dbHost,
      database: config.dbName,
      password: config.dbPassword,
      port: config.dbPort
    });
    dbClient.connect();
    logging.log("Connected to the DB");
  }
  return dbClient;
}

module.exports = {
  getDbConnection
}