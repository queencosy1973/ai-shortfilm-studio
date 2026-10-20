const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    }
  } else {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('Building static assets into public/ for Vercel deployment...');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

copyRecursiveSync(path.join(rootDir, 'index.html'), path.join(publicDir, 'index.html'));
copyRecursiveSync(path.join(rootDir, 'data', 'projects.json'), path.join(publicDir, 'data', 'projects.json'));
copyRecursiveSync(path.join(rootDir, 'outputs'), path.join(publicDir, 'outputs'));

console.log('Static build complete.');
