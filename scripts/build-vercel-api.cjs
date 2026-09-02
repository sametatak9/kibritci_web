const esbuild = require('esbuild');
const path = require('path');

function cjsFunctionFooter() {
  return [
    '(() => {',
    '  const exp = module.exports;',
    '  const fn =',
    '    exp && typeof exp.default === "function" ? exp.default',
    '    : exp && typeof exp.vercelExpressHandler === "function" ? exp.vercelExpressHandler',
    '    : exp;',
    '  if (typeof fn === "function") {',
    '    module.exports = function vercelNodeHandler(req, res) { return fn(req, res); };',
    '  }',
    '})();',
  ].join('\n');
}

function bundle(entryRel, outRel) {
  const outfile = path.join(__dirname, '..', outRel);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', entryRel)],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile,
    sourcemap: true,
    packages: 'external',
    footer: { js: cjsFunctionFooter() },
  });
  console.log('Built Vercel function ->', outfile);
}

bundle('src/server/vercelHandler.ts', 'api/[...path].js');
bundle('src/server/whatsappTaseronWebhookHttp.ts', 'api/webhooks/whatsapp-taseron-grup.js');
bundle('src/server/whatsappKayitBildirHttp.ts', 'api/whatsapp-kayit-bildir.js');
