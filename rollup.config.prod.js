import * as path from 'path';
import minify from 'rollup-plugin-babel-minify';

const license = `/*
Wombat.js client-side rewriting engine for web archive replay
Copyright (C) 2014-2020 Webrecorder Software, Rhizome, and Contributors. Released under the GNU Affero General Public License.

This file is part of wombat.js, see https://github.com/webrecorder/wombat.js for the full source
Wombat.js is part of the Webrecorder project (https://github.com/webrecorder)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */`


const outputDir = process.env.OUTPUT_DIR || path.join(__dirname, 'dist');

const addLicenceNoStrict = {
  renderChunk(code) {
    return `${license}\n${code.replace("'use strict';", '')}`;
  }
};

const minificationOpts = {
  booleans: false,
  builtIns: false,
  comments: false,
  deadcode: false,
  flipComparisons: false,
  infinity: false,
  keepClassName: true,
  keepFnName: true,
  mangle: false,
  removeUndefined: false,
  simplifyComparisons: false,
  sourceMap: false,
  typeConstructors: false,
  undefinedToVoid: false
};

export default [
  {
    input: 'src/wbWombat.js',
    plugins: [minify(minificationOpts), addLicenceNoStrict],
    output: {
      name: 'wombat',
      file: path.join(outputDir, 'wombat.js'),
      format: 'iife'
    }
  },
  {
    input: 'src/wbWombatProxyMode.js',
    plugins: [minify(minificationOpts), addLicenceNoStrict],
    output: {
      name: 'wombatProxyMode',
      file: path.join(outputDir, 'wombatProxyMode.js'),
      format: 'iife'
    }
  },
  {
    input: 'src/wombatWorkers.js',
    plugins: [minify(minificationOpts), addLicenceNoStrict],
    output: {
      name: 'wombatWorkers',
      file: path.join(outputDir, 'wombatWorkers.js'),
      format: 'es',
      sourcemap: false,
      exports: 'none'
    }
  },
  {
    input: 'src/autoFetchWorker.js',
    plugins: [
      {
        renderChunk(code) {
          if (!code.startsWith("'use strict';")) {
            return "'use strict';\n" + code;
          }
          return code;
        }
      }
    ],
    output: {
      name: 'autoFetchWorker',
      file: path.join(outputDir, 'autoFetchWorker.js'),
      format: 'es',
      sourcemap: false,
      exports: 'none'
    }
  }
];
