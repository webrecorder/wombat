const noStrict = {
  renderChunk(code) {
    return code.replace("'use strict';", '');
  }
};

export default {
  input: 'src/wbWombat.js',
  output: {
    name: 'wombat',
    file: 'dist/wombat-full.js',
    format: 'iife'
  },
  watch: {
    chokidar: true
  },
  plugins: [noStrict]
};
