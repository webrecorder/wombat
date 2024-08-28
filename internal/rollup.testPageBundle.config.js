const path = require('path');
const { nodeResolve } = require('@rollup/plugin-node-resolve');

const wombatDir = path.join(__dirname, '..');
const baseTestOutput = path.join(wombatDir, 'test', 'assets');

const noStrict = {
  renderChunk(code) {
    return code.replace("'use strict';", '');
  }
};

module.exports = {
  input: path.join(__dirname, 'testPageBundle.js'),
  output: {
    name: 'testPageBundle',
    file: path.join(baseTestOutput, 'testPageBundle.js'),
    sourcemap: false,
    format: 'es'
  },
  plugins: [
    nodeResolve(),
    noStrict
  ]
};
