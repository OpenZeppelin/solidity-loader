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
const cwd = { cwd: path.resolve(__dirname, 'data') };

util.exec = jest.fn();

const execute = async (options, source, contractName) => {
  const stats = await compiler(source, options);
  const output = stats.toJson().modules[0].source;

  const contract = requireFromString(output);

  expect(contract.contractName).toBe(contractName);
  expect(contract.abi.length).toBeGreaterThan(0);
};

beforeEach(() => {
  jest.resetAllMocks();
});

test('Runs truffle compile, zos push, and zos update commands to produce fresh .json files', async (done) => {
  const contractName = 'Contract';
  const { network } = defaultOptions;
  await execute(defaultOptions, contractFilePath, contractName);
  expect(util.exec).toHaveBeenCalledTimes(2);
  expect(util.exec).toHaveBeenCalledWith(`zos update ${contractName} --network ${network}`, cwd);
  expect(util.exec).toHaveBeenCalledWith(`zos push --network ${network}`, cwd);
  done();
});

test('Runs truffle compile, zos push, and zos update commands to produce fresh .json files with contract not being the same as filename', async (done) => {
  const { network } = defaultOptions;
  const contractName = 'Counter';
  await execute(defaultOptions, `${contractFilePath}?contract=${contractName}`, contractName);
  expect(util.exec).toHaveBeenCalledTimes(2);
  expect(util.exec).toHaveBeenCalledWith(`zos update ${contractName} --network ${network}`, cwd);
  expect(util.exec).toHaveBeenCalledWith(`zos push --network ${network}`, cwd);
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