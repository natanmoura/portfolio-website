// Static server for the project. Exists because Python's http.server picks
// up .js and .webp types from the Windows registry and gets them wrong.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || process.argv[2] || 5182);
const ROOT = path.resolve(__dirname, '..');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);

    // Dev only: lets the page drop a render into shots/ so a headless session
    // can look at what it just built.
    if (req.method === 'POST' && urlPath === '/_shot') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const dir = path.join(ROOT, 'shots');
        fs.mkdirSync(dir, { recursive: true });
        const name = `shot-${Date.now()}.png`;
        fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks));
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(name);
      });
      return;
    }

    let filePath = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
      fs.readFile(filePath, (readErr, data) => {
        if (readErr) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.writeHead(200, {
          'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        res.end(data);
      });
    });
  })
  .listen(PORT, () => console.log(`Awesome Town on http://localhost:${PORT}`));
