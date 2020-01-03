import path from 'path';
import fs from 'fs-extra';
import requireFromString from 'require-from-string';

import compiler from './compiler';

import { getLocalDependencies } from '../lib/deps';

// because we want to mock loader
const util = require('../lib/util');

const defaultOptions = {
  network: 'development',
  disabled: false,
};

const disabledOptions = {
  network: 'development',
  disabled: true,
};

const projectDir = './test/project/';
const networksConfigBlueprint = `${projectDir}blueprint-networks.js`;
const networksConfig = `${projectDir}networks.js`;
const truffleConfigBlueprint = `${projectDir}blueprint-truffle-config.js`;
const truffleConfig = `${projectDir}truffle-config.js`;
const contractsDir = `${projectDir}contracts/`;
const contractsBuildDir = `${projectDir}build/`;
const contractFilePath = './project/contracts/Contract.sol';
const execOptions = {
  cwd: path.resolve(__dirname, 'project'),
  env: {
    ...process.env,
    // disable an interactive in OpenZeppelin SDK by setting env variable to prevent blocking
    OPENZEPPELIN_NON_INTERACTIVE: 'FULL',
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

  const runAllTests = () => {
    const coreTests = (command) => {
      test('Runs truffle compile, oz push, and oz update commands to produce fresh .json files', async (done) => {
        const contractName = 'Contract';
        const { network } = defaultOptions;
        await execute(defaultOptions, contractFilePath, contractName);
        expect(util.exec).toHaveBeenCalledTimes(2);
        expect(util.exec).toHaveBeenCalledWith(
          `${command} update ${contractName} --network ${network}`,
          execOptions,
        );
        expect(util.exec).toHaveBeenCalledWith(`${command} push --network ${network}`, execOptions);
        done();
      });

      test('Runs truffle compile, oz push, and oz update commands to produce fresh .json files with contract not being the same as filename', async (done) => {
        const { network } = defaultOptions;
        const contractName = 'Counter';
        await execute(defaultOptions, `${contractFilePath}?contract=${contractName}`, contractName);
        expect(util.exec).toHaveBeenCalledTimes(2);
        expect(util.exec).toHaveBeenCalledWith(
          `${command} update ${contractName} --network ${network}`,
          execOptions,
        );
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
        const deps = await getLocalDependencies(
          'C',
          path.resolve(contractsBuildDir),
          path.resolve(contractsDir),
        );
        expect(deps.length).toEqual(2);
        expect(deps.map(dep => path.basename(dep))).toEqual(ret);
        done();
      });

      test('Discovers parent contracts as dependencies for contract inside one .sol file with many contracts', async (done) => {
        const deps = await getLocalDependencies(
          'Contract',
          path.resolve(contractsBuildDir),
          path.resolve(contractsDir),
        );
        expect(deps.length).toEqual(0);
        done();
      });
    };

    describe('with oz not installed either globally or locally', () => {
      beforeAll(() => {
        util.which.sync.mockImplementation(() => null);
        util.packageExist.mockImplementation(() => Promise.resolve(false));
      });

      test('throws an error', async (done) => {
        const contractName = 'Contract';
        try {
          await execute(disabledOptions, contractFilePath, contractName);
        } catch (e) {
          expect(e).toBeNull();
        }
        done();
      });
    });

    describe('with only global oz installed', () => {
      beforeAll(() => {
        util.which.sync.mockImplementation(() => 'oz');
        util.packageExist.mockImplementation(() => Promise.resolve(''));
      });

      coreTests('oz');
    });

    describe('with local oz installed', () => {
      beforeAll(() => {
        util.packageExist.mockImplementation(() => Promise.resolve('node_modules/.bin/oz'));
        util.which.sync.mockImplementation(() => null);
      });

      coreTests("'node_modules/.bin/oz'");
    });
  };

  describe('with Truffle config', () => {
    beforeAll(async () => {
      await fs.copy(truffleConfigBlueprint, truffleConfig);
    });

    afterAll(async () => {
      await fs.remove(truffleConfig);
    });

    runAllTests();
  });

  describe('with Networks.js config', () => {
    beforeAll(async () => {
      await fs.copy(networksConfigBlueprint, networksConfig);
    });

    afterAll(async () => {
      await fs.remove(networksConfig);
    });

    runAllTests();
  });
});
