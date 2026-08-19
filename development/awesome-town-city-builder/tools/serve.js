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
        // Code stays uncached so an edit shows up on reload. The collage does
        // not: it is content rather than source, it is the bulk of the bytes,
        // and re-fetching forty-odd images every time you cross between the
        // two windows is the single most obvious waste in a session.
        const ext = path.extname(filePath).toLowerCase();
        const isAsset = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.woff2'].includes(ext);

        // Sending Last-Modified without answering the question it invites just
        // adds a header. The browser asks whether its copy is still good, and
        // this is where it gets told yes.
        const since = req.headers['if-modified-since'];
        if (since && Date.parse(since) >= Math.floor(stat.mtimeMs / 1000) * 1000) {
          res.writeHead(304);
          return res.end();
        }

        res.writeHead(200, {
          'Content-Type': mime[ext] || 'application/octet-stream',
          'Cache-Control': isAsset ? 'public, max-age=3600' : 'no-cache',
          // Even the uncached things can answer with a 304 rather than the
          // whole file, once the browser has something to compare against.
          'Last-Modified': stat.mtime.toUTCString(),
        });
        res.end(data);
      });
    });
  })
  .listen(PORT, () => console.log(`Awesome Town on http://localhost:${PORT}`));
