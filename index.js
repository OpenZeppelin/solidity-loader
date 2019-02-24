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

const getTruffleConfig = async (opts) => {
  let file = await findUp('truffle-config.js', opts);
  if (!file) file = await findUp('truffle.js', opts);
  return file;
};


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

// To prevent race conditions
let isZeppelinBusy = false;

module.exports = async function loader(source) {
  const callback = this.async();

  try {
    // todo: pull from zos session
    const network = 'development';
    const contractPath = this.context;
    const cwd = path.resolve(contractPath, '..');
    const contractFilePath = this.resourcePath;
    const config = await getConfig({ network, cwd });
    const contractsBuildDirectory = config.contracts_build_directory;
    const contractFileName = path.basename(contractFilePath);
    const contractName = contractFileName.charAt(0).toUpperCase() + contractFileName.slice(1, contractFileName.length - 4);
    const compiledContractPath = path
      .resolve(config.contracts_build_directory, `${contractName}.json`);

    while (isZeppelinBusy) await wait(500);

    isZeppelinBusy = true;

    try {
      let result = await exec(`zos push --network ${network}`, { cwd });
      result = await exec(`zos update ${contractName} --network ${network}`, { cwd });
    } finally {
      isZeppelinBusy = false;
    }

    const solJSON = await readFile(compiledContractPath, 'utf8');

    callback(null, solJSON);
  } catch (e) {
    callback(e, null);
  }
};
