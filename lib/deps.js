const path = require('path');

const flatten = require('array-flatten');
const pathIsInside = require('path-is-inside');

const { readFile } = require('./util');

// Returns contracts dependencies
async function getLocalDependencies(sourceContract, contractsBuildDirectory, contractsDirectory) {
  const jsonFilePathByName = name => path.resolve(contractsBuildDirectory, `${name}.json`);

  const helper = async (contractName) => {
    const compiledContractPath = jsonFilePathByName(contractName);

    // read JSON contract produced by compile and return it
    const solJSON = await readFile(compiledContractPath, 'utf8');

    const contract = JSON.parse(solJSON);

    // grab all base contracts
    const baseContractNames = (
      (((contract.ast || {}).nodes || []).filter(node => node.name === contractName)[0] || {})
        .baseContracts || []
    )
      // grab base contract name
      .map(node => node.baseName.name);

    // test if it exists locally
    const localBaseContracts = (await Promise.all(
      baseContractNames.map(name => readFile(jsonFilePathByName(name))),
    ))
      .map(json => JSON.parse(json))
      // filter all contracts which are not local
      .filter(cont => pathIsInside(cont.ast.absolutePath, contractsDirectory));

    // return an array of contract .sol file paths as local dependencies
    return [
      ...localBaseContracts
        // get local contract filepath
        .map(cont => cont.ast.absolutePath),
      // call recursive on all local base contracts
      ...flatten(await Promise.all(localBaseContracts.map(cont => helper(cont.contractName)))),
    ];
  };

  // pick only unique values
  return [...new Set(await helper(sourceContract))];
}

module.exports = {
  getLocalDependencies,
};
