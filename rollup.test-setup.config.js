import resolve from 'rollup-plugin-node-resolve';
import minify from 'rollup-plugin-babel-minify';

export default {
  input: 'test-setup/bundle.js',
  output: {
    file: 'docs/test-setup-bundle.js',
    format: 'es'
  },
  plugins: [
    resolve({
      // pass custom options to the resolve plugin
      customResolveOptions: {
        moduleDirectory: 'node_modules'
      }
    }),
    minify({
      comments: false,
      sourceMap: false
    })
  ]
};
