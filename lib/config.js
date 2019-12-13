const path = require('path');
const truffleConfig = require('truffle-config');
const findUp = require('find-up');

// Finds truffle conifg file path
async function getTruffleConfig(opts) {
  let file = await findUp('truffle-config.js', opts);
  if (!file) file = await findUp('truffle.js', opts);
  return file;
}

async function getNetworksConfig(opts) {
  const file = await findUp('networks.js', opts);
  return file;
}

// Extracts artifacts directory from Tuffle and OpenZeppelin configs
async function getBuildDir({ network, cwd }) {
  if (!network) {
    throw new Error('You must specify the network name to deploy to.');
  }

  let config;

  // Look for networks.js
  const networksConfig = await getNetworksConfig({ cwd });
  if (networksConfig) {
    // At that moment networks.js always use /build/contracts as a build folder
    // but that may change in the future
    return path.resolve(cwd, './build/contracts');
  }

  const truffleConfigPath = await getTruffleConfig({ cwd });
  if (truffleConfigPath) {
    config = truffleConfig.load(truffleConfigPath, { network });
    return config.contracts_build_directory;
  }

  throw new Error('No Truffle or Networks.js Config file found!');
}

module.exports = {
  getBuildDir,
};
