const { postgres, connectApi } = require("./lib");
const config = require('./config').getConfig();
const fs = require("fs");
const db = require('./db_storage');

const { decodeTokenMeta, decodeSearchKeywords } = require("./token-decoder");

async function migrateDb(){
  const conn = await postgres.getDbConnection();
  const migrationSql = fs.readFileSync('migration-script.sql').toString();
  await conn.query(migrationSql);
}

async function migrated(migrationId) {
  try {
    const conn = await postgres.getDbConnection();
    const migrationSql = `SELECT 1 FROM public."__EFMigrationsHistory" WHERE "MigrationId" = $1`;
    const res = await conn.query(migrationSql, [migrationId]);
    return res.rows.length > 0;
  } catch (error) {
    // 42P01 = table does not exist
    if(error.code === '42P01') {
      return false;
    }

    throw error;
  }
}

async function setMetadataForAllOffers() {
  const conn = await postgres.getDbConnection();
  const offers = await conn.query(`SELECT "Id", "CreationDate", "CollectionId", "TokenId"	FROM public."Offer";`)
  const api = await connectApi(config);
  for(let offer of offers.rows) {
    const [collection, token] = await Promise.all([api.query.nft.collectionById(+offer.CollectionId), api.query.nft.nftItemList(+offer.CollectionId, +offer.TokenId)]);
    const metadata = decodeTokenMeta(collection, token);
    if(metadata) {
      await conn.query(`UPDATE public."Offer"
      SET "Metadata"=$1
      WHERE "Id"=$2;`, [metadata, offer.Id]);
    }
  }
}



async function setTextSearchForAllOffers() {
  const conn = await postgres.getDbConnection();
  const offers = await conn.query(`SELECT DISTINCT "CollectionId", "TokenId" FROM public."Offer";`)
  const api = await connectApi(config);
  for(let offer of offers.rows) {
    const [collection, token] = await Promise.all([api.query.nft.collectionById(+offer.CollectionId), api.query.nft.nftItemList(+offer.CollectionId, +offer.TokenId)]);
    const textSearchKeywords = decodeSearchKeywords(collection, token, offer.TokenId.toString());
    await db.saveSearchKeywords(+offer.CollectionId, +offer.TokenId, textSearchKeywords, conn);
  }
}

async function truncateTextSearch() {
  const conn = await postgres.getDbConnection();
  await conn.query(`TRUNCATE public."TokenTextSearch";`)
}

const doMigrate = async () => {
  const [isMetadataMigrated, isTextSearchMigrated, isAddTokenPrefixAndIdMigrated, isFixedTokensSearchIndexing] =
    await Promise.all([migrated('20210722091927_JsonMetadata'), migrated('20210802081707_TokensTextSearch'), migrated('20210805043620_AddTokenPrefixAndIdToSearch'), migrated('20210806043509_FixedTokensSearchIndexing')]);
  await migrateDb();
  if(!isMetadataMigrated)
  {
    await setMetadataForAllOffers();
  }
  if(!isTextSearchMigrated || !isAddTokenPrefixAndIdMigrated || !isFixedTokensSearchIndexing)
  {
    await truncateTextSearch();
    await setTextSearchForAllOffers();
  }
}

module.exports = {
  doMigrate
}
