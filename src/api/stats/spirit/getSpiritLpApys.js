const BigNumber = require('bignumber.js');
const { fantomWeb3: web3 } = require('../../../utils/web3');

const MasterChef = require('../../../abis/MasterChef.json');
const fetchPrice = require('../../../utils/fetchPrice');
const getBlockNumber = require('../../../utils/getBlockNumber');
const pools = require('../../../data/spiritLpPools.json');
const { compound } = require('../../../utils/compound');
const { getTotalLpStakedInUsd } = require('../../../utils/getTotalStakedInUsd');
const { BASE_HPY, FTM_CHAIN_ID } = require('../../../constants');

const getSpiritLpApys = async () => {
  let apys = {};
  const masterchef = '0x9083EA3756BDE6Ee6f27a6e996806FBD37F6F093';

  let promises = [];
  pools.forEach(pool => promises.push(getPoolApy(masterchef, pool)));
  const values = await Promise.all(promises);

  for (item of values) {
    apys = { ...apys, ...item };
  }

  return apys;
};

const getPoolApy = async (masterchef, pool) => {
  const [yearlyRewardsInUsd, totalStakedInUsd] = await Promise.all([
    getYearlyRewardsInUsd(masterchef, pool),
    getTotalLpStakedInUsd(masterchef, pool),
  ]);
  const simpleApy = yearlyRewardsInUsd.dividedBy(totalStakedInUsd);
  const apy = compound(simpleApy, BASE_HPY, 1, 0.955);
  // console.log(pool.name, simpleApy.valueOf(), apy, totalStakedInUsd.valueOf(), yearlyRewardsInUsd.valueOf());
  return { [pool.name]: apy };
};

const getYearlyRewardsInUsd = async (masterchef, pool) => {
  const blockNum = await getBlockNumber(FTM_CHAIN_ID);
  const masterchefContract = new web3.eth.Contract(MasterChef, masterchef);

  const multiplier = new BigNumber(
    await masterchefContract.methods.getMultiplier(blockNum - 1, blockNum).call()
  );
  // console.log(`multiplier`, multiplier);
  const blockRewards = new BigNumber(await masterchefContract.methods.spiritPerBlock().call());
  // console.log(`blockRewards`, blockRewards);

  let { allocPoint } = await masterchefContract.methods.poolInfo(pool.poolId).call();
  // console.log(`allocPoint`, allocPoint);
  allocPoint = new BigNumber(allocPoint);

  const totalAllocPoint = new BigNumber(await masterchefContract.methods.totalAllocPoint().call());
  const poolBlockRewards = blockRewards
    .times(multiplier)
    .times(allocPoint)
    .dividedBy(totalAllocPoint);

  const secondsPerBlock = 3;
  const secondsPerYear = 31536000;
  const yearlyRewards = poolBlockRewards.dividedBy(secondsPerBlock).times(secondsPerYear);

  const cakePrice = await fetchPrice({ oracle: 'tokens', id: 'Cake' });
  const spiritPrice = await fetchPrice({ oracle: 'tokens', id: 'Spirit' });
  console.log(`cakePrice`, cakePrice);
  console.log(`spiritPrice`, spiritPrice);
  const yearlyRewardsInUsd = yearlyRewards.times(spiritPrice).dividedBy('1e18');

  return yearlyRewardsInUsd;
};

module.exports = { getSpiritLpApys, getYearlyRewardsInUsd };
