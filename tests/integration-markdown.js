const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');

function loadMdToHtml() {
  const sourcePath = path.resolve(__dirname, '../web/lib/markdown.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
    fileName: sourcePath,
  });

  const module = { exports: {} };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', outputText);
  fn(module.exports, require, module, sourcePath, path.dirname(sourcePath));
  return module.exports.mdToHtml;
}

(async () => {
  const mdToHtml = loadMdToHtml();

  const basic = await mdToHtml('# Heading\n\nParagraph with **bold** and <em>inline HTML</em>.');
  assert.match(basic, /<h1>Heading<\/h1>/, 'Heading should render as h1');
  assert.match(basic, /<p>Paragraph with <strong>bold<\/strong> and <em>inline HTML<\/em>\.<\/p>/);

  const sanitized = await mdToHtml('<script>alert(1)</script><p>Visible</p>');
  assert.doesNotMatch(sanitized, /<script/i, 'Script tags should be removed');
  assert.match(sanitized, /<p>Visible<\/p>/, 'Safe content should remain');

  console.log('integration markdown ok');
})().catch(err => {
  console.error('integration markdown failed');
  console.error(err);
  process.exit(1);
});
