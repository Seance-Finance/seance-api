const { fetchAmmPrices } = require('../../utils/fetchAmmPrices');
const { sleep } = require('../../utils/time');

const spiritLpPools = require('../../data/spiritLpPools.json');

const INIT_DELAY = 0 * 60 * 1000;
const REFRESH_INTERVAL = 5 * 60 * 1000;

const pools = spiritLpPools;

const knownPrices = {
  BUSD: 1,
  USDT: 1,
  HUSD: 1,
  DAI: 1,
  USDC: 1,
  UST: 1,
};

let tokenPricesCache = {};
let lpPricesCache = {};
let isProcessing = true;

const updateAmmPrices = async () => {
  console.log('> updating amm prices');
  isProcessing = true;
  try {
    let { poolPrices, tokenPrices } = await fetchAmmPrices(pools, knownPrices);
    tokenPricesCache = tokenPrices;
    lpPricesCache = poolPrices;
  } catch (err) {
    console.error(err);
  }
  isProcessing = false;

  setTimeout(updateAmmPrices, REFRESH_INTERVAL);
  console.log('> updated amm prices');
};

const getAmmTokensPrices = async () => {
  while (isProcessing) {
    await sleep(500);
  }
  return tokenPricesCache;
};

const getAmmLpPrices = async () => {
  while (isProcessing) {
    await sleep(500);
  }
  return lpPricesCache;
};

const getAmmTokenPrice = async tokenSymbol => {
  const tokenPrices = await getAmmTokensPrices();
  if (tokenPrices.hasOwnProperty(tokenSymbol)) {
    return tokenPrices[tokenSymbol];
  }
  console.error(`Unknown token '${tokenSymbol}'. Consider adding it to .json file`);
};

const getAmmLpPrice = async lpName => {
  const lpPrices = await getAmmLpPrices();
  if (lpPrices.hasOwnProperty(lpName)) {
    return lpPrices[lpName];
  }
  console.error(`Unknown liqudity pair '${lpName}'. Consider adding it to .json file`);
};

// Flexible delayed initialization used to work around ratelimits
setTimeout(updateAmmPrices, INIT_DELAY);

module.exports = {
  getAmmTokenPrice,
  getAmmTokensPrices,
  getAmmLpPrice,
  getAmmLpPrices,
};
