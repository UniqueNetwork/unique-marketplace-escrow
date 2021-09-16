const protobuf = require('protobufjs')
const { hexToU8a } = require('@polkadot/util');

function decodeTokenMeta(collection, token) {
  try {
    const schema = collection.toJSON().ConstOnChainSchema;
    let protoJson = undefined;
    const bytes = hexToU8a(schema);
    const schemaStr = new TextDecoder().decode(bytes);
    protoJson = JSON.parse(schemaStr);

    let tokenDataBuffer = undefined;
    const constData = token.toJSON().ConstData;
    tokenDataBuffer = hexToU8a(constData);

    let root = protobuf.Root.fromJSON(protoJson);
    // Obtain the message type
    let NFTMeta = root.lookupType("onChainMetaData.NFTMeta");

    // Decode a Uint8Array (browser) or Buffer (node) to a message
    var message = NFTMeta.decode(tokenDataBuffer);

    // Maybe convert the message back to a plain object
    var object = NFTMeta.toObject(message, {
      longs: String,  // longs as strings (requires long.js)
      bytes: String,  // bytes as base64 encoded strings
      defaults: true, // includes default values
      arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
      objects: true,  // populates empty objects (map fields) even if defaults=false
      oneofs: true
    });

    return stringify(object);
  }
  catch(e) {
    return undefined;
  }
}

function stringify(val) {
  if(typeof val === 'object') {
    for(let key of Object.keys(val)) {
      val[key] = stringify(val[key]);
    }

    return val;
  }

  if(Array.isArray(val)) {
    return val.map(v => stringify(v));
  }

  if(val === undefined) {
    return val;
  }

  if(val === null) {
    return val;
  }

  return val.toString();
}

module.exports = decodeTokenMeta;
