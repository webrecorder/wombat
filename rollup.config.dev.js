
const noStrict = {
  renderChunk (code) {
    return code.replace("'use strict';", '');
  }
};

export default {
  input: 'src/newWombat/wbWombat.js',
  output: {
    name: 'wombat',
    file: 'docs/wombat-full.js',
    format: 'iife'
  },
  watch: {
    chokidar: true
  },
  plugins: [noStrict]
};
