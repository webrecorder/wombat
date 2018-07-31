import uglify from 'rollup-plugin-uglify';

const full = {
  input: 'src/newWombat/wbWombat.js',
  output: {
    name: 'wombat',
    file: 'docs/wombat-full.js',
    format: 'iife'
  }
};

if (process.env.NODE_ENV === 'production') {
  full.plugins = [
    uglify()
  ];
}

export default [
  full,
  {
    input: 'src/newWombat/wombat.js',
    output: {
      name: 'wombat',
      file: 'docs/wombat-only.js',
      format: 'es'
    }
  }
];
