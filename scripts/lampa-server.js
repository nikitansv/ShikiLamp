// Serve an unmodified Lampa checkout with the current ShikiLamp build for live testing.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function createServer(hostDir) {
  const root = path.resolve(hostDir);
  const plugin = path.resolve(__dirname, '../dist/plugin.js');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
  return http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch (_) { response.writeHead(400).end(); return; }
    const file = pathname === '/ShikiLamp.js' ? plugin : path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (file !== plugin && !file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      response.end(data);
    });
  });
}

if (require.main === module) {
  const hostDir = process.env.LAMPA_HOST_DIR;
  if (!hostDir || !fs.existsSync(path.join(hostDir, 'app.min.js'))) throw new Error('Set LAMPA_HOST_DIR to a yumata/lampa checkout');
  createServer(hostDir).listen(18123, '127.0.0.1', () => console.log('Lampa: http://127.0.0.1:18123/; plugin: http://127.0.0.1:18123/ShikiLamp.js'));
}

module.exports = createServer;
