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

  let notInstalledMessage;

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
      const isLocal = await packageExist(oz, cwd);
      // check if global version is installed
      const isGlobal = !!which.sync(oz, { nothrow: true });
      // if not installed at all do nothing
      if (isLocal || isGlobal) {
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
          const command = isLocal ? `npx ${oz}` : oz;
          // push new code into local blockchain
          let result = await exec(`${command} push --network ${network}`, execOptions);
          // update a proxy contract
          result = await exec(`${command} update ${contractName} --network ${network}`, execOptions);
        } finally {
          // release the lock
          isZeppelinBusy = false;
        }
      } else {
        notInstalledMessage = ` ${oz} is not installed either locally or globally.`;
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
      callback(new Error(`The contract '${compiledContractPath}' doesn't exist. Try to compile your contracts first.${notInstalledMessage}`), '{}');
    }
  } catch (e) {
    // report error here, because configuration seems to be lacking
    e.message = `${e.message}${notInstalledMessage}`;
    callback(e, '{}');
  }
};
