import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import uglify from 'rollup-plugin-uglify'

export default {
  input: 'bchai.js',
  output: {
    name: 'chai',
    file: 'test/bchai.js',
    format: 'iife'
  },
  plugins: [
    resolve({
      main: true,
      module: true,
      browser: true
    }),
    commonjs({
      include: 'node_modules/**',
      extensions: ['.js'],  // Default: [ '.js' ]
      ignoreGlobal: false,  // Default: false
      sourceMap: false  // Default: true
    }),
    uglify({mangle: false})
  ]
}
