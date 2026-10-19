import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import endpoint from '../api/generate.mjs';

const port = Number(process.env.PORT || 3000);
const files = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']],
  ['/cards.js', ['cards.js', 'text/javascript']], ['/example.js', ['example.js', 'text/javascript']],
  ['/example.json', ['example.json', 'application/json']],
]);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/generate') {
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      const request = new Request(url, { method: req.method, headers: req.headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
        signal: controller.signal,
      });
      const result = await endpoint.fetch(request);
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
    } else if (files.has(url.pathname) && ['GET', 'HEAD'].includes(req.method)) {
      const [file, type] = files.get(url.pathname);
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(new URL(`../viewer/${file}`, import.meta.url)));
    } else { res.writeHead(404); res.end('Not found'); }
  } catch { if (!res.headersSent) res.writeHead(500); res.end('Request failed'); }
}).listen(port, '127.0.0.1', () => console.log(`Wingman: http://127.0.0.1:${port}`));
