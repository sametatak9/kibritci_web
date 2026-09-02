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
  // @google/genai node_modules'tan yüklensin — bundle ESM/CJS çakışması önlenir
  packages: 'external',
  // Vercel CJS handler ister; esbuild `export default`i { default: fn } sarmalar.
  footer: {
    js: [
      '(() => {',
      '  const exp = module.exports;',
      '  const fn = exp && typeof exp.default === "function" ? exp.default : exp;',
      '  const cfg = exp && exp.config;',
      '  if (typeof fn === "function") {',
      '    module.exports = fn;',
      '    if (cfg) module.exports.config = cfg;',
      '  }',
      '})();',
    ].join('\n'),
  },
});

console.log('Built Vercel API handler ->', outFile);
