const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.FRONT_PORT || 5500);
const tipos = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml' };

http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  /* Redirección real (no solo servir el archivo): si se sirviera pages/index.html
     con la URL todavía en "/", los links relativos entre páginas (p. ej. href="descubrir.html")
     resolverían contra "/" en vez de "/pages/" y darían 404. */
  if (pathname === '/') { res.writeHead(302, { Location: '/pages/index.html' }); return res.end(); }
  const destino = path.resolve(root, '.' + pathname);
  if (!destino.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(destino, (err, data) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': tipos[path.extname(destino).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`SIWEPE web: http://127.0.0.1:${port}`));
