const path = require('path');
const util = require('util');
const fs = require('fs');
const truffleConfig = require('truffle-config');
const findUp = require('find-up');
const childProcess = require('child_process');

const { promisify } = util;
const exec = promisify(childProcess.exec);
const readFile = promisify(fs.readFile);
const wait = promisify(setTimeout);

const getTruffleConfig = () => {
  let file = findUp.sync('truffle-config.js');
  if (!file) file = findUp.sync('truffle.js');
  return file;
};


const getConfig = (opts) => {
  if (!opts.network) {
    throw new Error('You must specify the network name to deploy to. (network)');
  }

  let config;

  const truffleConfigPath = getTruffleConfig();
  if (truffleConfigPath) {
    config = truffleConfig.load(truffleConfigPath, opts);
  } else {
    throw new Error('No Truffle Config file found!');
  }

  return config;
};

// To prevent race conditions
let isZeppelinBusy = false;

module.exports = async function loader(source) {
  const callback = this.async();

  // todo: pull from zos session
  const network = 'development';
  const contractPath = this.context;
  const contractFilePath = this.resourcePath;
  const config = getConfig({ network });
  const contractsBuildDirectory = config.contracts_build_directory;
  const contractFileName = path.basename(contractFilePath);
  const contractName = contractFileName.charAt(0).toUpperCase() + contractFileName.slice(1, contractFileName.length - 4);
  const compiledContractPath = path
    .resolve(config.contracts_build_directory, `${contractName}.json`);

  while (isZeppelinBusy) await wait(500);

  isZeppelinBusy = true;

  try {
    const cwd = path.resolve(contractPath, '..');
    let result = await exec(`zos push --network ${network}`, { cwd });
    result = await exec(`zos update ${contractName} --network ${network}`, { cwd });
  } catch (e) {
    callback(e, null);
  } finally {
    isZeppelinBusy = false;
  }

  const solJSON = await readFile(compiledContractPath, 'utf8');

  callback(null, solJSON);
};
