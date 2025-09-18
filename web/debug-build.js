// debug-build.js - Add this to your web folder for debugging
const fs = require('fs');
const path = require('path');

console.log('=== Build Debug Info ===');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('CWD:', process.cwd());

// Check if content directory exists
const contentDir = path.join(process.cwd(), 'content', 'mega_article');
console.log('Content dir:', contentDir);
console.log('Content dir exists:', fs.existsSync(contentDir));

if (fs.existsSync(contentDir)) {
  const files = fs.readdirSync(contentDir);
  console.log('Content files:', files);
  
  // Check first JSON file
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  if (jsonFiles.length > 0) {
    const firstFile = path.join(contentDir, jsonFiles[0]);
    console.log('First JSON file size:', fs.statSync(firstFile).size);
  }
}

// Check package.json
const pkg = require('./package.json');
console.log('Package name:', pkg.name);
console.log('Next.js version:', pkg.dependencies?.next);

console.log('=== End Debug Info ===');
