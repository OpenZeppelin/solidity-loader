const util = require('util');
const findUp = require('find-up');
const path = require('path');
const which = require('which');
const { pathExists, readFile } = require('fs-extra');

const childProcess = require('child_process');

const { promisify } = util;
const exec = promisify(childProcess.exec);
const wait = promisify(setTimeout);

async function packageExist(pckg, dir) {
  return findUp(`node_modules/.bin/${pckg}`, { cwd: dir });
}

module.exports = {
  exec,
  readFile,
  wait,
  packageExist,
  which,
};
