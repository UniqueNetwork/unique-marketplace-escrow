const BigNumber = require('bignumber.js');
const {hexToU8a} = require("@polkadot/util");
BigNumber.config({ DECIMAL_PLACES: 12, ROUNDING_MODE: BigNumber.ROUND_DOWN, decimalSeparator: '.' });

const addLeadZero = num => {
  if(num < 10) return `0${num}`;
  return `${num}`;
}

const getTime = () => {
  let a = new Date(), hour = addLeadZero(a.getHours()), min = addLeadZero(a.getMinutes()), sec = addLeadZero(a.getSeconds());
  return `${hour}:${min}:${sec}`;
}

const getDate = () => {
  let a = new Date(), year = a.getFullYear(), month = addLeadZero(a.getMonth() + 1), date = addLeadZero(a.getDate());
  return `${year}-${month}-${date}`;
}

let timer, resolver = null;

const delay = ms => {
  return new Promise(async (resolve, reject) => {
    resolver = resolve;
    timer = setTimeout(() => {
      resolver = null;
      resolve();
    }, ms);
  });
}

const cancelDelay = () => {
  clearTimeout(timer);
  if (resolver) resolver();
}

const terminateProcess = (code=1) => {
  // TODO: maybe some other actions to do before termination
  process.exit(code);
}

const beHexToNum = beHex => {
  const arr = hexToU8a(beHex);
  let strHex = '';
  for (let i=arr.length-1; i>=0; i--) {
    let digit = arr[i].toString(16);
    if (arr[i] <= 15) digit = '0' + digit;
    strHex += digit;
  }
  return new BigNumber(strHex, 16);
}

const hexToString = hexStr => {
  if(!hexStr) {
    return hexStr;
  }

  if(!hexStr.startsWith('0x')) {
    return hexStr;
  }

  try {
    const bytes = hexToU8a(hexStr);
    return new TextDecoder().decode(bytes);
  } catch (error) {
    return hexStr;
  }
}

const isNullOrWhitespace = text => {
  if(!text) {
    return true;
  }

  if(text.length === 0) {
    return true;
  }

  const hasNonWhiteSpace = /\S/.test(text);
  return !hasNonWhiteSpace;
}

const toHuman = obj => {
  if(obj === undefined || obj === null) {
    return undefined;
  }

  if('toHuman' in obj) {
    return JSON.stringify(obj.toHuman());
  }

  if(Array.isArray(obj)) {
    return obj.map(toHuman).join(', ');
  }

  if(typeof obj === 'object') {
    for(let k of Object.keys(obj)) {
      const h = toHuman(obj);
      if(h) {
        return h;
      }
    }
  }

  return undefined;
}

module.exports = {
  delay, cancelDelay,
  terminateProcess,
  getTime, getDate,
  BigNumber, beHexToNum, hexToString, toHuman, isNullOrWhitespace
}