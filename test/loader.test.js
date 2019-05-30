import path from 'path';
import requireFromString from 'require-from-string';

import compiler from './compiler';

import { getLocalDependencies } from '../lib/truffle';

// because we want to mock loader
const util = require('../lib/util');

const defaultOptions = {
  network: 'development',
  disabled: false,
};

const wrongOptions = {
  network: 'dev',
  disabled: false,
};

const disabledOptions = {
  network: 'development',
  disabled: true,
};

const contractsDir = './test/data/contracts/';
const contractsBuildDir = './test/data/build/';
const contractFilePath = './data/contracts/Contract.sol';
const execOptions = {
  cwd: path.resolve(__dirname, 'data'),
  env: {
    ...process.env,
    // disable an interactive in ZeppelinOS by setting env variable to prevent blocking
    ZOS_NON_INTERACTIVE: 'FULL',
  },
};

const execute = async (options, source, contractName) => {
  const stats = await compiler(source, options);
  const output = stats.toJson().modules[0].source;

  const contract = requireFromString(output);

  expect(contract.contractName).toBe(contractName);
  expect(contract.abi.length).toBeGreaterThan(0);
};

describe('Hot Loader', () => {
  beforeAll(() => {
    util.exec = jest.fn();
    util.packageExist = jest.fn();
    util.which.sync = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const coreTests = (command) => {
    test('Runs truffle compile, zos push, and zos update commands to produce fresh .json files', async (done) => {
      const contractName = 'Contract';
      const { network } = defaultOptions;
      await execute(defaultOptions, contractFilePath, contractName);
      expect(util.exec).toHaveBeenCalledTimes(2);
      expect(util.exec).toHaveBeenCalledWith(`${command} update ${contractName} --network ${network}`, execOptions);
      expect(util.exec).toHaveBeenCalledWith(`${command} push --network ${network}`, execOptions);
      done();
    });

    test('Runs truffle compile, zos push, and zos update commands to produce fresh .json files with contract not being the same as filename', async (done) => {
      const { network } = defaultOptions;
      const contractName = 'Counter';
      await execute(defaultOptions, `${contractFilePath}?contract=${contractName}`, contractName);
      expect(util.exec).toHaveBeenCalledTimes(2);
      expect(util.exec).toHaveBeenCalledWith(`${command} update ${contractName} --network ${network}`, execOptions);
      expect(util.exec).toHaveBeenCalledWith(`${command} push --network ${network}`, execOptions);
      done();
    });

    test('Serves json files from file system while disabled', async (done) => {
      const contractName = 'Contract';
      await execute(disabledOptions, contractFilePath, contractName);
      expect(util.exec).toHaveBeenCalledTimes(0);
      done();
    });

    test('Discovers parent contracts as dependencies', async (done) => {
      const ret = ['B.sol', 'Base.sol'];
      const deps = await getLocalDependencies('C', path.resolve(contractsBuildDir), path.resolve(contractsDir));
      expect(deps.length).toEqual(2);
      expect(deps.map(dep => path.basename(dep))).toEqual(ret);
      done();
    });

    test('Discovers parent contracts as dependencies for contract inside one .sol file with many contracts', async (done) => {
      const deps = await getLocalDependencies('Contract', path.resolve(contractsBuildDir), path.resolve(contractsDir));
      expect(deps.length).toEqual(0);
      done();
    });
  };

  describe('with zos not installed either globally or locally', () => {
    beforeAll(() => {
      util.which.sync.mockImplementation(pckg => null);
      util.packageExist.mockImplementation((pckg, dir) => Promise.resolve(false));
    });

    test('Serves json files from file system', async (done) => {
      const contractName = 'Contract';
      await execute(disabledOptions, contractFilePath, contractName);
      expect(util.exec).toHaveBeenCalledTimes(0);
      done();
    });
  });

  describe('with only global zos installed', () => {
    beforeAll(() => {
      util.which.sync.mockImplementation(pckg => 'zos');
      util.packageExist.mockImplementation((pckg, dir) => Promise.resolve(false));
    });

    coreTests('zos');
  });

  describe('with local zos installed', () => {
    beforeAll(() => {
      util.packageExist.mockImplementation((pckg, dir) => Promise.resolve(true));
      util.which.sync.mockImplementation(pckg => null);
    });

    coreTests('npx zos');
  });
});
