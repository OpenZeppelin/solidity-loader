const util = require('util');
const path = require('path');
const which = require('which');
const { pathExists, readFile } = require('fs-extra');

const childProcess = require('child_process');

const { promisify } = util;
const exec = promisify(childProcess.exec);
const wait = promisify(setTimeout);

async function packageExist(pckg, dir) {
  return pathExists(path.resolve(dir, `node_modules/.bin/${pckg}`));
}

module.exports = {
  exec,
  readFile,
  wait,
  packageExist,
  which: promisify(which),
};
