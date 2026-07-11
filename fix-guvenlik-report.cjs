const fs = require('fs');
let code = fs.readFileSync('src/lib/guvenlikReportHtml.ts', 'utf8');

// The backticks were escaped as \`, we want just `
code = code.replace(/\\`/g, '`');

fs.writeFileSync('src/lib/guvenlikReportHtml.ts', code);
console.log('Fixed');
