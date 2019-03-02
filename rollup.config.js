import minify from 'rollup-plugin-babel-minify';

const noStrict = {
  renderChunk(code) {
    return code.replace("'use strict';", '');
  }
};

export default [
  {
    input: 'src/wbWombat.js',
    output: {
      name: 'wombat',
      file: 'dist/wombat.js',
      format: 'iife'
    },
    plugins: [noStrict]
  },
  {
    input: 'src/wbWombat.js',
    output: {
      name: 'wombat',
      file: 'dist/wombat.min.js',
      format: 'iife'
    },
    plugins: [
      noStrict,
      minify({
        comments: false,
        sourceMap: false
      })
    ]
  },
  {
    input: 'src/wbWombatProxyMode.js',
    output: {
      name: 'wombat',
      file: 'dist/wombatProxyMode.js',
      format: 'iife'
    },
    plugins: [noStrict]
  },
  {
    input: 'src/wbWombatProxyMode.js',
    output: {
      name: 'wombat',
      file: 'dist/wombatProxyMode.min.js',
      format: 'iife'
    },
    plugins: [
      noStrict,
      minify({
        comments: false,
        sourceMap: false
      })
    ]
  }
];
