// Minimal static server so the demo's ES module imports work.
// Usage: node serve.js  →  http://localhost:8420/demo/
//        live mode      →  http://localhost:8420/demo/?source=live
//        glasses HUD    →  http://localhost:8420/glasses/hype-glasses-hud.html?source=live
//
// /sse-proxy pipes the deployed kick-hype-starter SSE feed same-origin,
// because the deployment doesn't send CORS headers, so a browser page served
// from localhost can't consume it directly with EventSource.
//
// /glasses/* is served from the sibling repo-root glasses/ directory so the
// glasses HUD's live mode gets the same /src/* engine imports and /sse-proxy.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const SSE_UPSTREAM =
  process.env.SSE_UPSTREAM || 'https://kick-hype-starter-production.up.railway.app/api/events/stream';

async function pipeSse(req, res) {
  try {
    const upstream = await fetch(SSE_UPSTREAM, { headers: { accept: 'text/event-stream' } });
    if (!upstream.ok || !upstream.body) {
      res.writeHead(502).end(`upstream ${upstream.status}`);
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    const reader = upstream.body.getReader();
    req.on('close', () => reader.cancel().catch(() => {}));
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  }
}

const REPO_ROOT = dirname(ROOT);
const PORT = Number(process.env.PORT) || 8420;

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/sse-proxy') return pipeSse(req, res);
  if (path === '/glasses' || path === '/glasses/') path = '/glasses/hype-glasses-hud.html';
  if (path.endsWith('/')) path += 'index.html';
  const base = path.startsWith('/glasses/') ? REPO_ROOT : ROOT;
  const file = normalize(join(base, path));
  if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log(
  `demo at http://localhost:${PORT}/demo/  ·  live: http://localhost:${PORT}/demo/?source=live\n` +
  `glasses HUD live: http://localhost:${PORT}/glasses/hype-glasses-hud.html?source=live`,
));
