const fs = require('node:fs');
function ok(x,msg){ if(!x){ console.error('FAIL:',msg); process.exit(1);} }
ok(fs.existsSync('./bot/src/index.js'), 'bot entry missing');
ok(fs.existsSync('./web/pages/articles/[slug].tsx'), 'web article page missing');
console.log('smoke ok');
