const path = require('path');
const { getOptions } = require('loader-utils');

const { exec, readFile, wait } = require('./lib/util');
const { getConfig } = require('./lib/truffle');

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
