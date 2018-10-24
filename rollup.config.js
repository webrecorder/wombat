import minify from 'rollup-plugin-babel-minify';

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
    minify({
      comments: false,
      sourceMap: false
    })
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
