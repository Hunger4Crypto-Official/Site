const fs = require('node:fs');
function ok(x,msg){ if(!x){ console.error('FAIL:',msg); process.exit(1);} }
function log(...a){ console.log('[itest]', ...a); }

ok(fs.existsSync('./bot/src/services/badgeEvaluationService.js'), 'badgeEvaluationService missing');
ok(fs.existsSync('./bot/src/database/models.js'), 'models missing');

const svc = fs.readFileSync('./bot/src/services/badgeEvaluationService.js','utf8');
ok(/pickHodlBadgeId/.test(svc), 'pickHodlBadgeId not found');

log('Static checks passed. For runtime tests, run the bot with TEST_MODE and inject mocks.');
console.log('integration ok');
