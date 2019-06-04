const path = require('path');
const { pathExists } = require('fs-extra');

const { getOptions, parseQuery } = require('loader-utils');

const {
  exec,
  readFile,
  wait,
  packageExist,
  which,
} = require('./lib/util');
const { getConfig, getLocalDependencies } = require('./lib/truffle');

// Lock to prevent race conditions
let isZeppelinBusy = false;

const oz = 'zos';

module.exports = async function loader(source) {
  const callback = this.async();
  const addDependency = this.addDependency;

  try {
    const params = parseQuery(this.resourceQuery || '?');
    const options = getOptions(this);
    const network = (options && options.network) ? options.network : 'development';
    const disabled = options && options.disabled;
    const contractFolderPath = this.context;
    const cwd = path.resolve(contractFolderPath, '..');
    const contractFilePath = this.resourcePath;
    const config = await getConfig({ network, cwd });
    const contractsBuildDirectory = config.contracts_build_directory;
    const contractFileName = path.basename(contractFilePath);
    const contractName = params.contract || contractFileName.charAt(0).toUpperCase() + contractFileName.slice(1, contractFileName.length - 4);
    const compiledContractPath = path.resolve(contractsBuildDirectory, `${contractName}.json`);

    // if loader is disabled do not compile/push/upgrade, but still serve .json contracts from file system.
    if (!disabled) {
      // check if local version is installed
      const localPath = await packageExist(oz, cwd);
      // check if global version is installed
      const globalPath = !localPath ? which.sync(oz, { nothrow: true }) : '';
      // if not installed at all do nothing
      if (localPath || globalPath) {
        // wait until compile/push/update is done
        while (isZeppelinBusy) await wait(500);

        isZeppelinBusy = true;

        try {
          const execOptions = {
            cwd,
            env: {
              ...process.env,
              // disable an interactive in ZeppelinOS by setting env variable to prevent blocking
              ZOS_NON_INTERACTIVE: 'FULL',
            },
          };
          // local has priority over global
          // single quotes around local zos are needed because local path may have spaces
          const command = localPath ? `'${localPath}'` : oz;
          // push new code into local blockchain
          await exec(`${command} push --network ${network}`, execOptions);
          // update a proxy contract
          await exec(`${command} update ${contractName} --network ${network}`, execOptions);
        } finally {
          // release the lock
          isZeppelinBusy = false;
        }
      } else {
        callback(new Error(`${oz} is required to support solidity hot-loading. Please run "npm install ${oz}", or disable hot-loading.`), '{}');
        // return because if zos not installed we should fail
        return;
      }
    }

    // check if compiled contract exists
    const isContractPathExists = await pathExists(compiledContractPath);
    if (isContractPathExists) {
      // read JSON contract produced by compile and return it
      const solJSON = await readFile(compiledContractPath, 'utf8');
      // get all contract's local dependencies
      const deps = await getLocalDependencies(contractName, contractsBuildDirectory, contractFolderPath);
      // add these imports as dependencies for a contract
      deps.map(imp => addDependency(imp));
      // return result to webpack
      callback(null, solJSON);
    } else {
      callback(new Error(`The contract '${compiledContractPath}' doesn't exist. Try to compile your contracts first.`), '{}');
    }
  } catch (e) {
    // report error here, because configuration seems to be lacking
    callback(e, '{}');
  }
};
