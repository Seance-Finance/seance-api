const BigNumber = require('bignumber.js');
const { ethers } = require('ethers');
const { MULTICHAIN_RPC } = require('../constants');

const MULTICALLS = {
  // 56: '0x0943afe23cb43BD15aC2d58bACa34Eb570BFC278',
  // 128: '0x6066F766f47aC8dbf6F21aDF2493316A8ACB7e34',
  // 137: '0xB784bd129a3bA16650Af7BBbcAa4c59D7e60057C',
  // 43114: '0xF7d6f0418d37B7Ec8D207fF0d10897C2a3F92Ed5',
  250: '0xd9F2Da642FAA1307e4F70a5E3aC31b9bfe920eAF',
};

const MulticallAbi = require('../abis/BeefyPriceMulticall.json');
const BATCH_SIZE = 128;

const calcTokenPrice = (knownPrice, knownToken, unknownToken) => {
  const valuation = knownToken.balance.dividedBy(knownToken.decimals).multipliedBy(knownPrice);
  const price = valuation
    .multipliedBy(unknownToken.decimals)
    .dividedBy(unknownToken.balance.toNumber() || 1);

  return {
    price: price.toNumber(),
    valuation: valuation.toNumber(),
  };
};

const calcLpPrice = (pool, tokenPrices) => {
  const lp0 = pool.lp0.balance
    .multipliedBy(tokenPrices[pool.lp0.oracleId])
    .dividedBy(pool.lp0.decimals);
  const lp1 = pool.lp1.balance
    .multipliedBy(tokenPrices[pool.lp1.oracleId])
    .dividedBy(pool.lp1.decimals);
  return lp0.plus(lp1).multipliedBy(pool.decimals).dividedBy(pool.totalSupply).toNumber();
};

const fetchAmmPrices = async (pools, tokenPrices) => {
  let poolPrices = {};
  let tokenValuations = {};

  for (let chain in MULTICALLS) {
    let filtered = pools.filter(p => p.chainId == chain);

    // Setup multichain
    const provider = new ethers.providers.JsonRpcProvider(MULTICHAIN_RPC[chain]);
    const multicall = new ethers.Contract(MULTICALLS[chain], MulticallAbi, provider);

    // Split query in batches
    const query = filtered.map(p => [p.address, p.lp0.address, p.lp1.address]);
    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = query.slice(i, i + BATCH_SIZE);
      const buf = await multicall.getLpInfo(batch);

      // Merge fetched data
      for (let j = 0; j < batch.length; j++) {
        filtered[j + i].totalSupply = new BigNumber(buf[j * 3 + 0].toString());
        filtered[j + i].lp0.balance = new BigNumber(buf[j * 3 + 1].toString());
        filtered[j + i].lp1.balance = new BigNumber(buf[j * 3 + 2].toString());
      }
    }

    const unsolved = filtered.slice();
    let solving = true;
    while (solving) {
      solving = false;

      for (let i = unsolved.length - 1; i >= 0; i--) {
        const pool = unsolved[i];

        let knownToken, unknownToken;
        if (pool.lp0.oracleId in tokenPrices) {
          knownToken = pool.lp0;
          unknownToken = pool.lp1;
        } else if (pool.lp1.oracleId in tokenPrices) {
          knownToken = pool.lp1;
          unknownToken = pool.lp0;
        } else {
          console.log('unsolved: ', pool.lp0.oracleId, pool.lp1.oracleId);
          continue;
        }

        const { price, valuation } = calcTokenPrice(
          tokenPrices[knownToken.oracleId],
          knownToken,
          unknownToken
        );

        if (valuation >= (tokenValuations[unknownToken.oracleId] || 0)) {
          tokenPrices[unknownToken.oracleId] = price;
          tokenValuations[unknownToken.oracleId] = valuation;
        }
        poolPrices[pool.name] = calcLpPrice(pool, tokenPrices);

        unsolved.splice(i, 1);
        solving = true;
      }
    }
  }

  return {
    poolPrices: poolPrices,
    tokenPrices: tokenPrices,
  };
};

module.exports = { fetchAmmPrices };
