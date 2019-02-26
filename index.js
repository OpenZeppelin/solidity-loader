const path = require('path');
const util = require('util');
const fs = require('fs');

const { getOptions } = require('loader-utils');
const truffleConfig = require('truffle-config');
const findUp = require('find-up');
const childProcess = require('child_process');

const { promisify } = util;
const exec = promisify(childProcess.exec);
const readFile = promisify(fs.readFile);
const fileExists = promisify(fs.access);
const wait = promisify(setTimeout);

// Finds truffle conifg file path
const getTruffleConfig = async (opts) => {
  let file = await findUp('truffle-config.js', opts);
  if (!file) file = await findUp('truffle.js', opts);
  return file;
};

// Loads truffle config
const getConfig = async ({ network, cwd }) => {
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

  return config;
};

// Lock to prevent race conditions
let isZeppelinBusy = false;

module.exports = async function loader(source) {
  const callback = this.async();

  try {
    const options = getOptions(this);
    const network = (options && options.network) ? options.network : 'development';
    const disabled = options && options.disabled;
    const contractPath = this.context;
    const cwd = path.resolve(contractPath, '..');
    const contractFilePath = this.resourcePath;
    const config = await getConfig({ network, cwd });
    const contractsBuildDirectory = config.contracts_build_directory;
    const contractFileName = path.basename(contractFilePath);
    const contractName = contractFileName.charAt(0).toUpperCase() + contractFileName.slice(1, contractFileName.length - 4);
    const compiledContractPath = path
      .resolve(config.contracts_build_directory, `${contractName}.json`);

    // if loader is disabled do not compile/push/upgrade, but still serve .json contracts from file system.
    if (!disabled) {
      // wait until compile/push/update is done
      while (isZeppelinBusy) await wait(500);

      isZeppelinBusy = true;

      try {
        // push new code into local blockchain
        let result = await exec(`zos push --network ${network}`, { cwd });
        // update proxy contract
        result = await exec(`zos update ${contractName} --network ${network}`, { cwd });
      } finally {
        // release lock
        isZeppelinBusy = false;
      }
    }

    // read JSON contract produced by compile and return it
    const solJSON = await readFile(compiledContractPath, 'utf8');
    callback(null, solJSON);
  } catch (e) {
    // report error here, because configuration seems to be lacking
    callback(e, {});
  }
};
