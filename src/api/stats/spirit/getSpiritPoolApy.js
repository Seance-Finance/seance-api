const BigNumber = require('bignumber.js');
const { bscWeb3: web3 } = require('../../../utils/web3');

const MasterChef = require('../../../abis/MasterChef.json');
const fetchPrice = require('../../../utils/fetchPrice');
const { getTotalStakedInUsd } = require('../../../utils/getTotalStakedInUsd');
const { compound } = require('../../../utils/compound');
const { BASE_HPY, FTM_CHAIN_ID } = require('../../../constants');
const getBlockNumber = require('../../../utils/getBlockNumber');

const getSpiritPoolApy = async () => {
  const masterChef = '0x9083EA3756BDE6Ee6f27a6e996806FBD37F6F093';
  const spirit = '0x5cc61a78f164885776aa610fb0fe1257df78e59b';
  const oracle = 'tokens';
  const oracleId = 'Spirit';

  const [yearlyRewardsInUsd, totalStakedInUsd] = await Promise.all([
    getYearlyRewardsInUsd(masterChef, oracle, oracleId),
    getTotalStakedInUsd(masterChef, spirit, oracle, oracleId),
  ]);

  const simpleApy = yearlyRewardsInUsd.dividedBy(totalStakedInUsd);
  const apy = compound(simpleApy, BASE_HPY, 1, 0.94);

  return { 'spirit-spirit': apy, 'spirit-smart': apy };
};

const getYearlyRewardsInUsd = async (masterChefAddr, oracle, oracleId) => {
  const fromBlock = await getBlockNumber(FTM_CHAIN_ID);
  const toBlock = fromBlock + 1;
  const masterChefContract = new web3.eth.Contract(MasterChef, masterChefAddr);

  const multiplier = new BigNumber(
    await masterChefContract.methods.getMultiplier(fromBlock, toBlock).call()
  );
  const blockRewards = new BigNumber(await masterChefContract.methods.spiritPerBlock().call());

  let { allocPoint } = await masterChefContract.methods.poolInfo(0).call();
  allocPoint = new BigNumber(allocPoint);

  const totalAllocPoint = new BigNumber(await masterChefContract.methods.totalAllocPoint().call());
  const poolBlockRewards = blockRewards
    .times(multiplier)
    .times(allocPoint)
    .dividedBy(totalAllocPoint);

  const secondsPerBlock = 1;
  const secondsPerYear = 31536000;
  const yearlyRewards = poolBlockRewards.dividedBy(secondsPerBlock).times(secondsPerYear);

  const spiritPrice = await fetchPrice({ oracle, id: oracleId });
  const yearlyRewardsInUsd = yearlyRewards.times(spiritPrice).dividedBy('1e18');

  return yearlyRewardsInUsd;
};

module.exports = getSpiritPoolApy;
