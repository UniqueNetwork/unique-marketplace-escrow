const {postgres} = require("./lib");
const {decodeAddress} = require("@polkadot/util-crypto");
const {v4: uuidv4} = require("uuid");

const pgTables = {
  incomingTx: 'NftIncomingTransaction',
  incomingQuoteTx: 'QuoteIncomingTransaction',
  offer: 'Offer',
  trade: 'Trade',
  outgoingQuoteTx: 'QuoteOutgoingTransaction',
  uniqueBlocks: 'UniqueProcessedBlock',
  tokenTextSearch: 'TokenTextSearch'
};

const getLastHandledUniqueBlock = async () => {
  const conn = await postgres.getDbConnection();
  const selectLastHandledUniqueBlockSql = `SELECT * FROM public."${pgTables.uniqueBlocks}" ORDER BY public."${pgTables.uniqueBlocks}"."BlockNumber" DESC LIMIT 1;`;
  return await conn.query(selectLastHandledUniqueBlockSql);
}

const addHandledUniqueBlock = async blockNumber => {
  const conn = await postgres.getDbConnection();
  const insertHandledBlocSql = `INSERT INTO public."${pgTables.uniqueBlocks}" VALUES ($1, now());`;
  await conn.query(insertHandledBlocSql, [blockNumber]);
}

const addIncomingNFTTransaction = async (address, collectionId, tokenId, blockNumber) => {
  const conn = await postgres.getDbConnection();

  // Convert address into public key
  const publicKey = Buffer.from(decodeAddress(address), 'binary').toString('base64');

  // Clear all previous appearances of this NFT with status 0, update to error
  const errorMessage = "Failed to register (sync err)";
  const updateIncomingNftSql = `UPDATE public."${pgTables.incomingTx}"
    SET  "Status" = 2, "ErrorMessage" = $1
    WHERE "Status" = 0 AND "CollectionId" = $2 AND "TokenId" = $3;`;
  await conn.query(updateIncomingNftSql, [errorMessage, collectionId, tokenId]);

  // Clear all previous appearances of this NFT with null orderId
  const updateNftIncomesSql = `DELETE FROM public."${pgTables.incomingTx}"
    WHERE "OfferId" IS NULL AND "CollectionId" = $1 AND "TokenId" = $2;`
  await conn.query(updateNftIncomesSql, [collectionId, tokenId]);

  // Add incoming NFT with Status = 0
  const insertIncomingNftSql = `INSERT INTO public."${pgTables.incomingTx}"("Id", "CollectionId", "TokenId", "Value", "OwnerPublicKey", "UniqueProcessedBlockId", "Status", "LockTime", "ErrorMessage") VALUES ($1, $2, $3, 0, $4, $5, 0, now(), '');`;
  await conn.query(insertIncomingNftSql, [uuidv4(), collectionId, tokenId, publicKey, blockNumber]);
}

const setIncomingNftTransactionStatus = async (id, status, error = "OK") => {
  const conn = await postgres.getDbConnection();

  const updateIncomingNftStatusSql = `UPDATE public."${pgTables.incomingTx}" SET "Status" = $1, "ErrorMessage" = $2 WHERE "Id" = $3`;

  // Get one non-processed Kusama transaction
  await conn.query(updateIncomingNftStatusSql, [status, error, id]);
}

const getIncomingNFTTransaction = async () => {
  const conn = await postgres.getDbConnection();

  const getIncomingNftsSql = `SELECT * FROM public."${pgTables.incomingTx}"
    WHERE "Status" = 0`;
  // Get one non-processed incoming NFT transaction
  // Id | CollectionId | TokenId | Value | OwnerPublicKey | Status | LockTime | ErrorMessage | UniqueProcessedBlockId
  return await conn.query(getIncomingNftsSql);
}

const addOffer = async (seller, collectionId, tokenId, quoteId, price, metadata, searchKeywords) => {
  const conn = await postgres.getDbConnection();

  // Convert address into public key
  const publicKey = Buffer.from(decodeAddress(seller), 'binary').toString('base64');

  const inserOfferSql = `INSERT INTO public."${pgTables.offer}"("Id", "CreationDate", "CollectionId", "TokenId", "Price", "Seller", "Metadata", "OfferStatus", "SellerPublicKeyBytes", "QuoteId")
    VALUES ($1, now(), $2, $3, $4, $5, $6, 1, $7, $8);`;
  const offerId = uuidv4();
  //Id | CreationDate | CollectionId | TokenId | Price | Seller | Metadata | OfferStatus | SellerPublicKeyBytes | QuoteId
  await conn.query(inserOfferSql, [offerId, collectionId, tokenId, price.padStart(40, '0'), publicKey, metadata, decodeAddress(seller), quoteId]);

  const updateNftIncomesSql = `UPDATE public."${pgTables.incomingTx}"
	SET "OfferId"=$1
	WHERE "CollectionId" = $2 AND "TokenId" = $3 AND "OfferId" IS NULL;`
  await conn.query(updateNftIncomesSql, [offerId, collectionId, tokenId]);

  await saveSearchKeywords(collectionId, tokenId, searchKeywords, conn);
}

const saveSearchKeywords = async (collectionId, tokenId, searchKeywords, conn) => {
  if(typeof conn === 'undefined') conn = await postgres.getDbConnection();

  if(searchKeywords.length <= 0) {
    return;
  }

  const keywordsStored = await conn.query(`SELECT Max("CollectionId") FROM public."${pgTables.tokenTextSearch}"
    WHERE "CollectionId" = $1 AND "TokenId" = $2`,
    [collectionId, tokenId]
  );
  if(keywordsStored.rows.length < 0) {
    return;
  }

  await Promise.all(searchKeywords.map(({locale, text}) =>
    conn.query(`INSERT INTO public."${pgTables.tokenTextSearch}"
("Id", "CollectionId", "TokenId", "Text", "Locale") VALUES
($1, $2, $3, $4, $5);`, [uuidv4(), collectionId, tokenId, text, locale]))
  );
}

const addTrade = async (offerId, buyer) => {
  const conn = await postgres.getDbConnection();

  // Convert address into public key
  const publicKey = Buffer.from(decodeAddress(buyer), 'binary').toString('base64');

  const insertTradeSql = `INSERT INTO public."${pgTables.trade}"("Id", "TradeDate", "Buyer", "OfferId")
    VALUES ($1, now(), $2, $3);`;
  await conn.query(insertTradeSql, [uuidv4(), publicKey, offerId]);
}

const getOpenOfferId = async (collectionId, tokenId) => {
  const conn = await postgres.getDbConnection();
  const selectOpenOffersSql = `SELECT * FROM public."${pgTables.offer}" WHERE "CollectionId" = ${collectionId} AND "TokenId" = ${tokenId} AND "OfferStatus" = 1;`;
  const res = await conn.query(selectOpenOffersSql);
  return (res.rows.length > 0) ? res.rows[0].Id : '';
}

const updateOffer = async (id, newStatus) => {
  const conn = await postgres.getDbConnection();

  const updateOfferSql = `UPDATE public."${pgTables.offer}" SET "OfferStatus" = ${newStatus} WHERE "Id" = '${id}'`;
  // Only update active offer (should be one)
  await conn.query(updateOfferSql);
}

const addOutgoingQuoteTransaction = async (quoteId, amount, recipient, withdrawType) => {
  const conn = await postgres.getDbConnection();

  // Convert address into public key
  const publicKey = Buffer.from(decodeAddress(recipient), 'binary').toString('base64');

  const insertOutgoingQuoteTransactionSql = `INSERT INTO public."${pgTables.outgoingQuoteTx}"("Id", "Status", "ErrorMessage", "Value", "QuoteId", "RecipientPublicKey", "WithdrawType")
    VALUES ($1, 0, '', $2, $3, $4, $5);`;
  // Id | Status | ErrorMessage | Value | QuoteId | RecipientPublicKey | WithdrawType
  // WithdrawType == 1 => Withdraw matched
  //                 0 => Unused
  await conn.query(insertOutgoingQuoteTransactionSql, [uuidv4(), amount, parseInt(quoteId), publicKey, withdrawType]);
}

const setIncomingKusamaTransactionStatus = async (id, status, error = "OK") => {
  const conn = await postgres.getDbConnection();

  const updateIncomingKusamaTransactionStatusSql = `UPDATE public."${pgTables.incomingQuoteTx}" SET "Status" = $1, "ErrorMessage" = $2 WHERE "Id" = $3`;
  // Get one non-processed Kusama transaction
  await conn.query(updateIncomingKusamaTransactionStatusSql, [status, error, id]);
}

const getIncomingKusamaTransaction = async () => {
  const conn = await postgres.getDbConnection();

  const selectIncomingQuoteTxsSql = `SELECT * FROM public."${pgTables.incomingQuoteTx}"
    WHERE
      "Status" = 0
      AND "QuoteId" = 2 LIMIT 1
  `;
  // Get one non-processed incoming Kusama transaction
  // Id | Amount | QuoteId | Description | AccountPublicKey | BlockId | Status | LockTime | ErrorMessage
  return await conn.query(selectIncomingQuoteTxsSql);
}
module.exports = {
  getLastHandledUniqueBlock, addHandledUniqueBlock,
  addIncomingNFTTransaction, setIncomingNftTransactionStatus, getIncomingNFTTransaction, addOutgoingQuoteTransaction,
  setIncomingKusamaTransactionStatus, getIncomingKusamaTransaction,
  addOffer, addTrade, getOpenOfferId, updateOffer, saveSearchKeywords
}