const { getSpiritLpApys } = require('./spirit/getSpiritLpApys');

const INIT_DELAY = 20 * 1000;
const REFRESH_INTERVAL = 15 * 60 * 1000;

let apys = {};

const getApys = () => {
  return apys;
};

const updateApys = async () => {
  console.log('> updating apys');

  try {
    const values = await Promise.all([getSpiritLpApys()]);

    for (item of values) {
      apys = { ...apys, ...item };
    }

    console.log('> updated apys', apys);
  } catch (err) {
    console.error('> apy initialization failed', err);
  }

  setTimeout(updateApys, REFRESH_INTERVAL);
};

setTimeout(updateApys, INIT_DELAY);

module.exports = getApys;
