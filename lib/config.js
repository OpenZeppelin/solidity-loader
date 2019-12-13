const truffleConfig = require('truffle-config');
const findUp = require('find-up');

// Finds truffle conifg file path
async function getTruffleConfig(opts) {
  let file = await findUp('truffle-config.js', opts);
  if (!file) file = await findUp('truffle.js', opts);
  return file;
}

// Extracts artifacts directory from Tuffle and OpenZeppelin configs
async function getBuildDir({ network, cwd }) {
  if (!network) {
    throw new Error('You must specify the network name to deploy to.');
  }

  let config;
  const truffleConfigPath = await getTruffleConfig({ cwd });
  if (truffleConfigPath) {
    config = truffleConfig.load(truffleConfigPath, { network });
  } else {
    throw new Error('No Truffle Config file found!');
  }

  return config.contracts_build_directory;
}

module.exports = {
  getBuildDir,
};
