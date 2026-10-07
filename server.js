// Voxelwerk-Server: liefert Editor + Assets aus und speichert Änderungen aus dem Editor.
// Start: npm start  →  http://localhost:3412/editor/
//   GET  /api/index                    alle Asset-IDs je Art
//   PUT  /api/asset/<art>/<id>         Asset speichern (JSON im Body, wird formatiert)
//   PUT  /api/vox/<pfad>.vox           .vox-Datei speichern (Binär-Body) – Export aus dem Editor
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS } from './core/library.js';
import { formatJSON } from './core/format.js';
import { listAssets } from './tools/fs-io.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = +(process.argv[2] || process.env.PORT || 3412);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.vox': 'application/octet-stream', '.md': 'text/plain; charset=utf-8' };
const ID = /^[a-z0-9_\-]+(\/[a-z0-9_\-]+)*$/;

const body = (req) => new Promise((ok, fail) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); req.on('error', fail); });
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    if (p === '/api/index' && req.method === 'GET') return send(res, 200, await listAssets(root));
    if (p.startsWith('/api/asset/') && req.method === 'PUT') {
      const [kind, ...rest] = p.slice('/api/asset/'.length).split('/'); const id = rest.join('/');
      if (!KINDS.includes(kind) || !ID.test(id)) return send(res, 400, { error: 'Ungültige Art oder ID' });
      let obj; try { obj = JSON.parse((await body(req)).toString('utf8')); } catch (e) { return send(res, 400, { error: 'Kein gültiges JSON: ' + e.message }); }
      if (obj.id !== id) return send(res, 400, { error: `Feld "id" (${obj.id}) passt nicht zur ID ${id}` });
      const file = path.join(root, 'assets', kind, id + '.json');
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, formatJSON(obj), 'utf8');
      return send(res, 200, { ok: true, file: path.relative(root, file) });
    }
    if (p.startsWith('/api/vox/') && req.method === 'PUT') {
      const rel = p.slice('/api/vox/'.length);
      if (!/^[a-z0-9_\-\/]+\.vox$/.test(rel)) return send(res, 400, { error: 'Ungültiger Pfad' });
      const file = path.join(root, 'assets', 'vox', rel);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, await body(req));
      return send(res, 200, { ok: true, file: path.relative(root, file) });
    }
    // Statische Dateien – "/" auf den Editor umleiten, sonst lösen dessen relative Skriptpfade falsch auf
    if (p === '/') { res.writeHead(302, { Location: '/editor/' }); return res.end(); }
    let rel = p.endsWith('/') ? p + 'index.html' : p;
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    const data = await fs.readFile(file).catch(() => null);
    if (!data) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) {
    console.error(e); send(res, 500, { error: e.message });
  }
}).listen(port, () => console.log(`Voxelwerk: http://localhost:${port}/editor/`));
