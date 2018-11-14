import minify from 'rollup-plugin-babel-minify';

const noStrict = {
  renderChunk (code) {
    return code.replace("'use strict';", '');
  }
};

const wombatFull = {
  input: 'src/newWombat/wbWombat.js',
  output: {
    name: 'wombat',
    file: 'docs/wombat-full.js',
    format: 'iife'
  },
  plugins: [noStrict]
};

const wombatLiteFull = {
  input: 'src/newWombat/wbWombatProxyMode.js',
  output: {
    name: 'wombat',
    file: 'docs/wombatProxyMode-full.js',
    format: 'iife'
  },
  plugins: [noStrict]
};

if (process.env.NODE_ENV === 'production') {
  wombatFull.plugins.push(
    minify({
      comments: false,
      sourceMap: false
    })
  );
  wombatLiteFull.plugins.push(
    minify({
      comments: false,
      sourceMap: false
    })
  );
}

export default [
  wombatFull,
  wombatLiteFull,
  {
    input: 'src/newWombat/wombat.js',
    output: {
      name: 'wombat',
      file: 'docs/wombat-only.js',
      format: 'es'
    }
  }
];
