const util = require('util');
const fs = require('fs');

const childProcess = require('child_process');

const { promisify } = util;
const exec = promisify(childProcess.exec);
const readFile = promisify(fs.readFile);
const wait = promisify(setTimeout);

module.exports = {
  exec,
  readFile,
  wait,
};
