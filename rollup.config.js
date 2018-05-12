import uglify from 'rollup-plugin-uglify'

const config = {
  input: 'src/newWombat/wbWombat.js',
  output: {
    name: 'wombat',
    file: 'wombat.js',
    format: 'iife'
  }
}

if (process.env.NODE_ENV === 'production') {
  config.plugins = [
    uglify()
  ]
}

export default config