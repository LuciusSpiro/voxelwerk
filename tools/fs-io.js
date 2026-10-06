// Dateisystem-Zugriff für die Bibliothek in Node (Werkzeuge, Server).
import fs from 'node:fs/promises';
import path from 'node:path';
import { KINDS, Library } from '../core/library.js';

export function fsIO(root) {
  return {
    json: async (p) => JSON.parse(await fs.readFile(path.join(root, p), 'utf8')),
    binary: async (p) => { const b = await fs.readFile(path.join(root, p)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
  };
}

export const nodeLibrary = (root) => new Library(fsIO(root));

/** { models: [ids], palettes: [...], ... } */
export async function listAssets(root) {
  const out = {};
  for (const kind of KINDS) {
    const base = path.join(root, 'assets', kind), ids = [];
    const walk = async (dir) => {
      const ents = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const e of ents) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) await walk(f);
        else if (e.name.endsWith('.json')) ids.push(path.relative(base, f).replace(/\\/g, '/').replace(/\.json$/, ''));
      }
    };
    await walk(base);
    out[kind] = ids.sort();
  }
  return out;
}
