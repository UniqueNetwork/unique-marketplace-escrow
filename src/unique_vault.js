const { Keyring } = require('@polkadot/api');
const { Abi, ContractPromise } = require("@polkadot/api-contract");
const { hexToU8a } = require('@polkadot/util');
const { encodeAddress } = require('@polkadot/util-crypto');
const config = require('./config').getConfig();
const { connectApi, constants, logging, util } = require('./lib');
const {delay, cancelDelay} = util;
const db = require('./db_storage');
const {
  decodeTokenMeta,
  decodeSearchKeywords
} = require('./token-decoder');


let stateStore = {
  adminAddress: null,
  startBlockInitialized: false,
  bestBlockNumber: 0  // The highest block in chain (not final)
}

const contractAbi = require("./market_metadata.json");

const defaultQuoteId = 2; // KSM


async function getLastHandledUniqueBlock(api) {
  if(stateStore.startBlockInitialized || config.startFromBlock.toLocaleLowerCase() !== 'latest') {
    const dbResult = await db.getLastHandledUniqueBlock();
    if(dbResult.rows.length > 0) return dbResult.rows[0].BlockNumber;
  }

  return await getAndStoreStartingBlock(api);
}

async function getAndStoreStartingBlock(api) {
  let startingBlock;
  if(['current', 'latest'].indexOf(config.startFromBlock.toLocaleLowerCase()) > -1) {
    const head = await api.rpc.chain.getHeader();
    startingBlock = head.number.toNumber();
    stateStore.startBlockInitialized = true;
  } else {
    startingBlock = parseInt(config.startFromBlock);
  }

  await db.addHandledUniqueBlock(startingBlock);
  return startingBlock;
}

async function getIncomingNFTTransaction() {
  const res = await db.getIncomingNFTTransaction();

  let nftTx = {
    id: '',
    collectionId: 0,
    tokenId: 0,
    sender: null
  };

  if (res.rows.length > 0) {
    let publicKey = Buffer.from(res.rows[0].OwnerPublicKey, 'base64');

    try {
      // Convert public key into address
      const address = encodeAddress(publicKey);

      nftTx.id = res.rows[0].Id;
      nftTx.collectionId = res.rows[0].CollectionId;
      nftTx.tokenId = res.rows[0].TokenId;
      nftTx.sender = address;
    }
    catch (e) {
      await db.setIncomingNftTransactionStatus(res.rows[0].Id, 2, e.toString());
      logging.log(e, logging.status.ERROR);
    }

  }

  return nftTx;
}

async function updateOffer(collectionId, tokenId, newStatus) {
  const id = await db.getOpenOfferId(collectionId, tokenId);

  if (id !== "") {
    await db.updateOffer(id, newStatus);
  }
  else {
    logging.log(`WARNING: Offer not found for token ${collectionId}-${tokenId}, nothing to update`);
  }

  return id;
}

async function getIncomingKusamaTransaction() {
  const res = await db.getIncomingKusamaTransaction();

  let ksmTx = {
    id: '',
    amount: '0',
    sender: null
  };

  if (res.rows.length > 0) {
    let publicKey = res.rows[0].AccountPublicKey;

    try {
      if ((publicKey[0] !== '0') || (publicKey[1] !== 'x'))
        publicKey = '0x' + publicKey;

      // Convert public key into address
      const address = encodeAddress(hexToU8a(publicKey));

      ksmTx.id = res.rows[0].Id;
      ksmTx.sender = address;
      ksmTx.amount = res.rows[0].Amount;
    }
    catch (e) {
      await db.setIncomingKusamaTransactionStatus(res.rows[0].Id, 2, e.toString());
      logging.log(e, logging.status.ERROR);
    }

  }

  return ksmTx;
}


function getTransactionStatus(events, status) {
  if (status.isReady) {
    return constants.transactionStatus.STATUS_NOT_READY;
  }
  if (status.isBroadcast) {
    return constants.transactionStatus.STATUS_NOT_READY;
  }
  if (status.isInBlock || status.isFinalized) {
    const errors = events.filter(e => e.event.data.method === 'ExtrinsicFailed');
    if(errors.length > 0) {
      logging.log(`Transaction failed, ${util.toHuman(errors)}`, logging.status.ERROR);
      return constants.transactionStatus.STATUS_FAIL;
    }
    if(events.filter(e => e.event.data.method === 'ExtrinsicSuccess').length > 0) {
      return constants.transactionStatus.STATUS_SUCCESS;
    }
  }

  return constants.transactionStatus.STATUS_FAIL;
}

function sendTransactionAsync(sender, transaction) {
  return new Promise(async (resolve, reject) => {
    try {
      let unsub = await transaction.signAndSend(sender, ({ events = [], status }) => {
        const transactionStatus = getTransactionStatus(events, status);

        if (transactionStatus === constants.transactionStatus.STATUS_SUCCESS) {
          logging.log(`Transaction successful`);
          resolve(events);
          unsub();
        } else if (transactionStatus === constants.transactionStatus.STATUS_FAIL) {
          logging.log(`Something went wrong with transaction. Status: ${status}`);
          reject(events);
          unsub();
        }
      });
    } catch (e) {
      logging.log('Error: ' + e.toString(), logging.status.ERROR);
      reject(e);
    }
  });

}

async function registerQuoteDepositAsync({api, sender, depositorAddress, amount}) {
  logging.log(`${depositorAddress} deposited ${amount} in ${defaultQuoteId} currency`);

  const abi = new Abi(contractAbi);
  const contract = new ContractPromise(api, abi, config.marketContractAddress);

  const value = 0;
  const maxgas = 1_000_000_000_000;

  let amountBN = new util.BigNumber(amount);
  const tx = contract.tx.registerDeposit(value, maxgas, defaultQuoteId, amountBN.toString(), depositorAddress);
  await sendTransactionAsync(sender, tx);
}

async function registerNftDepositAsync(api, sender, depositorAddress, collection_id, token_id) {
  logging.log(`${depositorAddress} deposited ${collection_id}, ${token_id}`);
  const abi = new Abi(contractAbi);
  const contract = new ContractPromise(api, abi, config.marketContractAddress);

  const value = 0;
  const maxgas = 1_000_000_000_000;

  // if (blackList.includes(token_id)) {
  //   log(`Blacklisted NFT received. Silently returning.`, "WARNING");
  //   return;
  // }

  const tx = contract.tx.registerNftDeposit(value, maxgas, collection_id, token_id, depositorAddress);
  await sendTransactionAsync(sender, tx);
}


async function sendNftTxAsync(api, sender, recipient, collection_id, token_id) {
  const tx = api.tx.nft.transfer(recipient, collection_id, token_id, 0);
  await sendTransactionAsync(sender, tx);
}

function isSuccessfulExtrinsic(eventRecords, extrinsicIndex) {
  const events = eventRecords
    .filter(({ phase }) =>
      phase.isApplyExtrinsic &&
      phase.asApplyExtrinsic.eq(extrinsicIndex)
    )
    .map(({ event }) => `${event.section}.${event.method}`);

  return events.includes('system.ExtrinsicSuccess');

}

async function scanNftBlock(api, admin, blockNum) {

  if (blockNum % 10 === 0) logging.log(`Scanning Block #${blockNum}`);
  const blockHash = await api.rpc.chain.getBlockHash(blockNum);

  // Memo: If it fails here, check custom types
  const signedBlock = await api.rpc.chain.getBlock(blockHash);
  const allRecords = await api.query.system.events.at(blockHash);

  const abi = new Abi(contractAbi);

  // log(`Reading Block ${blockNum} Transactions`);

  for (let [extrinsicIndex, ex] of signedBlock.block.extrinsics.entries()) {

    // skip unsuccessful  extrinsics.
    if (!isSuccessfulExtrinsic(allRecords, extrinsicIndex)) {
      continue;
    }

    const { method: { args, method, section } } = ex;

    if ((section === "nft") && (method === "transfer") && (args[0].toString() === admin.address.toString())) {
      logging.log(`NFT deposit from ${ex.signer.toString()} id (${args[1]}, ${args[2]})`, logging.status.RECEIVED);

      const address = ex.signer.toString();
      const collectionId = args[1];
      const tokenId = args[2];

      const paraments = {
        api,
        userAddress: address,
        sender: admin,
        marketContractAddress: config.marketContractAddress,
      };
      // Add sender to contract white list
      await addWhiteList(paraments);

      // Save in the DB
      await db.addIncomingNFTTransaction(address, collectionId, tokenId, blockNum);
    }
    else if ((section === "contracts") && (method === "call") && (args[0].toString() === config.marketContractAddress.toString())) {
      try {
        logging.log(`Contract call in block ${blockNum}: ${args[0].toString()}, ${args[1].toString()}, ${args[2].toString()}, ${args[3].toString()}`);

        let data = args[3].toString();
        logging.log(`data = ${data}`);

        // Ask call
        if (data.startsWith("0x020f741e")) {
          logging.log(`======== Ask Call`);
          //    CallID   collection       token            quote            price
          // 0x 020f741e 0300000000000000 1200000000000000 0200000000000000 0080c6a47e8d03000000000000000000
          //    0        4                12               20               28

          if (data.substring(0,2) === "0x") data = data.substring(2);
          const collectionIdHex = "0x" + data.substring(8, 24);
          const tokenIdHex = "0x" + data.substring(24, 40);
          const quoteIdHex = "0x" + data.substring(40, 56);
          const priceHex = "0x" + data.substring(56);
          const collectionId = util.beHexToNum(collectionIdHex).toString();
          const tokenId = util.beHexToNum(tokenIdHex).toString();
          const quoteId = util.beHexToNum(quoteIdHex).toString();
          const price = util.beHexToNum(priceHex).toFixed();
          logging.log(`${ex.signer.toString()} listed ${collectionId}-${tokenId} in block ${blockNum} hash: ${blockHash} for ${quoteId}-${price}`);

          const [collection, token] = await Promise.all([api.query.nft.collectionById(collectionId), api.query.nft.nftItemList(collectionId, tokenId)]);

          const tokenMeta = decodeTokenMeta(collection, token) || {};
          const tokenSearchKeywords = decodeSearchKeywords(collection, token, tokenId) || [];
          let duplicate = await db.getOpenOfferId(collectionId, tokenId)
          if(duplicate && config.cancelDuplicates) {
            logging.log(`Found old offer for collection ${collectionId} and token ${tokenId}`, logging.status.WARNING);
            logging.log(`Status for offer ${duplicate} (and other, if exists) changed to 2 (cancelled)`, logging.status.WARNING);
            await db.cancelOffers(collectionId, tokenId);
          }
          await db.addOffer(ex.signer.toString(), collectionId, tokenId, quoteId, price, tokenMeta, tokenSearchKeywords);
        }

        // Buy call
        if (data.startsWith("0x15d62801")) {
          const withdrawNFTEvent = findMatcherEvent(allRecords, abi, extrinsicIndex, 'WithdrawNFT');
          const withdrawQuoteMatchedEvent = findMatcherEvent(allRecords, abi, extrinsicIndex, 'WithdrawQuoteMatched');
          await handleBuyCall(api, admin, withdrawNFTEvent, withdrawQuoteMatchedEvent);
        }

        // Cancel: 0x9796e9a703000000000000000100000000000000
        if (data.startsWith("0x9796e9a7")) {
          const withdrawNFTEvent = findMatcherEvent(allRecords, abi, extrinsicIndex, 'WithdrawNFT');
          await handleCancelCall(api, admin, withdrawNFTEvent);
        }

        // Withdraw: 0x410fcc9d020000000000000000407a10f35a00000000000000000000
        if (data.startsWith("0x410fcc9d")) {
          const withdrawQuoteUnusedEvent = findMatcherEvent(allRecords, abi, extrinsicIndex, 'WithdrawQuoteUnused');
          await handleWithdrawCall(withdrawQuoteUnusedEvent);
        }

      }
      catch (e) {
        logging.log(e, logging.status.ERROR);
      }
    }
  }
}

async function handleBuyCall(api, admin, withdrawNFTEvent, withdrawQuoteMatchedEvent) {
  if(!withdrawNFTEvent) {
    throw `Couldn't find WithdrawNFT event in Buy call`;
  }
  if(!withdrawQuoteMatchedEvent) {
    throw `Couldn't find WithdrawQuoteMatched event in Buy call`;
  }

  logging.log(`======== Buy call`);

  // WithdrawNFT
  logging.log(`--- Event 1: ${withdrawNFTEvent.event.identifier}`);
  const buyerAddress = withdrawNFTEvent.args[0].toString();
  logging.log(`NFT Buyer address: ${buyerAddress}`);
  const collectionId = withdrawNFTEvent.args[1];
  logging.log(`collectionId = ${collectionId.toString()}`);
  const tokenId = withdrawNFTEvent.args[2];
  logging.log(`tokenId = ${tokenId.toString()}`);

  // WithdrawQuoteMatched
  logging.log(`--- Event 2: ${withdrawQuoteMatchedEvent.event.identifier}`);
  const sellerAddress = withdrawQuoteMatchedEvent.args[0].toString();
  logging.log(`NFT Seller address: ${sellerAddress}`);
  const quoteId = withdrawQuoteMatchedEvent.args[1].toNumber();
  const price = withdrawQuoteMatchedEvent.args[2].toString();
  logging.log(`Price: ${quoteId} - ${price.toString()}`);

  // Update offer to done (status = 3 = Traded)
  const id = await updateOffer(collectionId.toString(), tokenId.toString(), 3);

  // Record trade
  await db.addTrade(id, buyerAddress);

  // Record outgoing quote tx
  await db.addOutgoingQuoteTransaction(quoteId, price.toString(), sellerAddress, 1);

  // Execute NFT transfer to buyer
  await sendNftTxAsync(api, admin, buyerAddress.toString(), collectionId, tokenId);

}

async function handleCancelCall(api, admin, event) {
  if(!event) {
    throw `Couldn't find WithdrawNFT event in Cancel call`;
  }

  logging.log(`======== Cancel call`);

  // WithdrawNFT
  logging.log(`--- Event 1: ${event.event.identifier}`);
  const sellerAddress = event.args[0];
  logging.log(`NFT Seller address: ${sellerAddress.toString()}`);
  const collectionId = event.args[1];
  logging.log(`collectionId = ${collectionId.toString()}`);
  const tokenId = event.args[2];
  logging.log(`tokenId = ${tokenId.toString()}`);


  // Update offer to calceled (status = 2 = Canceled)
  await updateOffer(collectionId.toString(), tokenId.toString(), 2);

  // Execute NFT transfer back to seller
  await sendNftTxAsync(api, admin, sellerAddress.toString(), collectionId, tokenId);
}

async function handleWithdrawCall(event) {
  if(!event) {
    throw `Couldn't find WithdrawQuoteUnused event in Withdraw call`;
  }

  logging.log(`======== Withdraw call`);

  // WithdrawQuoteUnused
  logging.log(`--- Event 1: ${event.event.identifier}`);
  const withdrawerAddress = event.args[0];
  logging.log(`Withdrawing address: ${withdrawerAddress.toString()}`);
  const quoteId = parseInt(event.args[1].toString());
  const price = event.args[2].toString();
  logging.log(`Price: ${quoteId} - ${price.toString()}`);

  // Record outgoing quote tx
  await db.addOutgoingQuoteTransaction(quoteId, price.toString(), withdrawerAddress, 0);

}

function findMatcherEvent(allRecords, abi, extrinsicIndex, eventName) {
  return allRecords
    .filter(r =>
      r.event.method.toString() === 'ContractEmitted'
      && r.phase.isApplyExtrinsic
      && r.phase.asApplyExtrinsic.toNumber() === extrinsicIndex
      && r.event.data[0]
      && r.event.data[0].toString() === config.marketContractAddress
    )
    .map(r => abi.decodeEvent(r.event.data[1]))
    .filter(r => r.event.identifier === eventName)[0];
}

async function subscribeToBlocks(api) {
  await api.rpc.chain.subscribeNewHeads((header) => {
    stateStore.bestBlockNumber = header.number;
    cancelDelay();
  });
}

async function addWhiteList({
                              api,
                              userAddress,
                              sender,
                              marketContractAddress
                            }) {
  if (!config.whiteList) return;

  const whiteListedBefore = (await api.query.nft.contractWhiteList(marketContractAddress, userAddress)).toJSON();
  if (!whiteListedBefore) {
    try {
      const addTx = api.tx.nft.addToContractWhiteList(marketContractAddress, userAddress);
      await sendTransactionAsync(sender, addTx);
    } catch(error) {
      logging.log(`Failed add to while list. Address: ${userAddress}`);
    }
  }
}

const catchUpWithBlocks = async (api, admin) => {
  while (true) {
    // Get last processed block
    let lastBlock = await getLastHandledUniqueBlock(api);
    let blockNum = parseInt(lastBlock) + 1;

    try {
      if (blockNum <= stateStore.bestBlockNumber) {
        await db.addHandledUniqueBlock(blockNum);

        // Handle NFT Deposits (by analysing block transactions)
        await scanNftBlock(api, admin, blockNum);
      } else break;

    } catch (ex) {
      logging.log(ex);
      if (!ex.toString().includes("State already discarded"))
        await delay(1000);
    }
  }
}

const handleQueuedNFTDeposits = async (api, admin) => {
  let deposit = false;
  do {
    deposit = false;
    const nftTx = await getIncomingNFTTransaction();
    if (nftTx.id.length > 0) {
      deposit = true;

      try {
        await registerNftDepositAsync(api, admin, nftTx.sender, nftTx.collectionId, nftTx.tokenId);
        await db.setIncomingNftTransactionStatus(nftTx.id, 1);
        logging.log(`NFT deposit from ${nftTx.sender} id (${nftTx.collectionId}, ${nftTx.tokenId})`, "REGISTERED");
      } catch (e) {
        logging.log(`NFT deposit from ${nftTx.sender} id (${nftTx.collectionId}, ${nftTx.tokenId})`, "FAILED TO REGISTER");
        await delay(6000);
      }
    }
  } while (deposit);
}
const handleQueuedKSMDeposits = async (api, admin) => {
  let deposit = false;
  do {
    deposit = false;
    const ksmTx = await getIncomingKusamaTransaction();
    if (ksmTx.id.length > 0) {
      deposit = true;

      try {

        const paraments = {
          api,
          userAddress: ksmTx.sender,
          sender: admin,
          marketContractAddress: config.marketContractAddress
        };
        // Add sender to contract white list
        await addWhiteList(paraments);

        await registerQuoteDepositAsync({api, sender: admin, depositorAddress: ksmTx.sender, amount: ksmTx.amount});
        await db.setIncomingKusamaTransactionStatus(ksmTx.id, 1);
        logging.log(`Quote deposit from ${ksmTx.sender} amount ${ksmTx.amount.toString()}`, "REGISTERED");
      } catch (e) {
        logging.log(`Quote deposit from ${ksmTx.sender} amount ${ksmTx.amount.toString()}`, "FAILED TO REGISTER");
        await delay(6000);
      }
    }

  } while (deposit);
}


async function handleUnique() {
  const api = await connectApi(config);
  const keyring = new Keyring({ type: 'sr25519' });
  const admin = keyring.addFromUri(config.adminSeed);
  stateStore.adminAddress = admin.address.toString();
  logging.log(`Escrow admin address: ${stateStore.adminAddress}`);

  // await scanNftBlock(api, admin, 415720);
  // return;

  await subscribeToBlocks(api);

  // Work indefinitely
  while (true) {

    // 1. Catch up with blocks
    await catchUpWithBlocks(api, admin);


    // Handle queued NFT deposits
    await handleQueuedNFTDeposits(api, admin);


    // Handle queued KSM deposits
    await handleQueuedKSMDeposits(api, admin);


    await delay(6000);
  }

}

async function main() {
  logging.log(`config.wsEndpoint: ${config.wsEndpoint}`);
  logging.log(`config.marketContractAddress: ${config.marketContractAddress}`);

  await handleUnique();
}

main().catch(console.error).finally(() => process.exit());