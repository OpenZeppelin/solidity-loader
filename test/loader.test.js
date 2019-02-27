import path from 'path';
import requireFromString from 'require-from-string';

import compiler from './compiler';

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

const contractName = 'Contract';
const cwd = { cwd: path.resolve(__dirname, 'data') };

const execute = async (options) => {
  const stats = await compiler('./data/contracts/contract.sol', options);
  const output = stats.toJson().modules[0].source;

  const contract = requireFromString(output);

  expect(contract.contractName).toBe('Counter');
  expect(contract.abi.length).toBeGreaterThan(0);
  expect(Object.keys(contract.networks).length).toBeGreaterThan(0);
};

beforeEach(() => {
  util.exec = jest.fn();
});

test('Runs truffle compile, zos push, and zos update commands to produce fresh .json files', async (done) => {
  const { network } = defaultOptions;
  await execute(defaultOptions);
  expect(util.exec).toHaveBeenCalledTimes(2);
  expect(util.exec).toHaveBeenCalledWith(`zos update ${contractName} --network ${network}`, cwd);
  expect(util.exec).toHaveBeenCalledWith(`zos push --network ${network}`, cwd);
  done();
});

test('Serves json files from file system while disabled', async (done) => {
  await execute(disabledOptions);
  expect(util.exec).toHaveBeenCalledTimes(0);
  done();
});
