const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = 'C:\\Users\\User\\Documents\\projects\\portfolio-website';

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}).listen(PORT, () => console.log(`Serving on http://localhost:${PORT}`));
