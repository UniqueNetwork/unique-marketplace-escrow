const { Keyring } = require("@polkadot/api");
const { decodeTokenMeta } = require("./token-decoder");
const { connectApi } = require('./lib');
const db = require('./db_storage');
const config = require('./config').getConfig();
const {decodeSearchKeywords} = require("./token-decoder");

async function createTestOffers() {
  const api = await connectApi(config);
  const keyring = new Keyring({ type: 'sr25519' });
  const admin = keyring.addFromUri('//Bob');
  let adminAddress = admin.address.toString();
  for(let i = 1; i < 200; i++) {
    const [collection, token] = await Promise.all([api.query.nft.collectionById(25), api.query.nft.nftItemList(25, i)]);
    const metadata = decodeTokenMeta(collection, token);
    const textSearchKeywords = decodeSearchKeywords(collection, token, i.toString());
    if(metadata) {
      await db.addOffer(adminAddress, 25, i, 2, '100000000000', metadata, textSearchKeywords);
    }
  }
  for(let i = 1; i < 200; i++) {
    const [collection, token] = await Promise.all([api.query.nft.collectionById(23), api.query.nft.nftItemList(23, i)]);
    const metadata = decodeTokenMeta(collection, token);
    const textSearchKeywords = decodeSearchKeywords(collection, token, i.toString());
    if(metadata) {
      await db.addOffer(adminAddress, 23, i, 2, '100000000000', metadata, textSearchKeywords);
    }
  }
  for(let i = 1; i < 200; i++) {
    const [collection, token] = await Promise.all([api.query.nft.collectionById(112), api.query.nft.nftItemList(112, i)]);
    const metadata = decodeTokenMeta(collection, token);
    const textSearchKeywords = decodeSearchKeywords(collection, token, i.toString());
    if(metadata) {
      await db.addOffer(adminAddress, 112, i, 2, '100000000000', metadata, textSearchKeywords);
    }
  }
}

async function main() {
  // await createTestOffers();
}

main().catch(console.error).finally(() => process.exit());