const esbuild = require('esbuild');
const path = require('path');

const outFile = path.join(__dirname, '..', 'api', '[...path].js');

esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'api', 'handler.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: outFile,
  sourcemap: true,
  packages: 'bundle',
});

console.log('Built Vercel API handler ->', outFile);
