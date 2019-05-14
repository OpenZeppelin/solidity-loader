const path = require('path');

const { getOptions, parseQuery } = require('loader-utils');

const { exec, readFile, wait } = require('./lib/util');
const { getConfig, getLocalDependencies } = require('./lib/truffle');

// Lock to prevent race conditions
let isZeppelinBusy = false;

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
    const compiledContractPath = path
      .resolve(contractsBuildDirectory, `${contractName}.json`);

    // if loader is disabled do not compile/push/upgrade, but still serve .json contracts from file system.
    if (!disabled) {
      // wait until compile/push/update is done
      while (isZeppelinBusy) await wait(500);

      isZeppelinBusy = true;

      try {
        // push new code into local blockchain
        let result = await exec(`zos push --network ${network} --no-interactive`, { cwd });
        // update proxy contract
        result = await exec(`zos update ${contractName} --network ${network} --no-interactive`, { cwd });
      } finally {
        // release lock
        isZeppelinBusy = false;
      }
    }

    // read JSON contract produced by compile and return it
    const solJSON = await readFile(compiledContractPath, 'utf8');
    // get all contract's local dependencies
    const deps = await getLocalDependencies(contractName, contractsBuildDirectory, contractFolderPath);
    // add these imports as dependencies for a contract
    deps.map(imp => addDependency(imp));
    // return result to webpack
    callback(null, solJSON);
  } catch (e) {
    // report error here, because configuration seems to be lacking
    callback(e, '{}');
  }
};
