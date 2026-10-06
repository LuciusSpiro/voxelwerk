// Voxelwerk-Editor (v1): Bibliothek durchsuchen, Modelle/Figuren/Szenen ansehen, Parameter und Paletten
// ausprobieren, Rezepte als JSON bearbeiten (Anwenden = Vorschau, Speichern = Datei), .vox exportieren.
// URL: ?model=rom/kiste | ?figure=rom/legionaer | ?scene=rom-aussenposten  [&mood=…&pose=…&palette=…&shot=1]
import * as THREE from 'three';
import { Library } from '../core/library.js';
import { formatJSON } from '../core/format.js';
import { voxelSize, TIERS } from '../core/scales.js';
import { gridToVox } from '../core/vox.js';
import { Viewer } from '../render/viewer.js';
import { modelObject, figureObject, sceneObject, applyPose } from '../render/voxel-three.js';

const $ = (s) => document.querySelector(s);
const ROOT = new URL('../', import.meta.url).href;
const io = {
  json: async (p) => { const r = await fetch(ROOT + p, { cache: 'no-store' }); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); },
  binary: async (p) => { const r = await fetch(ROOT + p, { cache: 'no-store' }); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.arrayBuffer(); },
};
const lib = new Library(io);
const url = new URLSearchParams(location.search);
const SHOT = url.has('shot');
if (SHOT) document.body.classList.add('shot');

const viewer = new Viewer($('#view'), { preserve: true });
window.__viewer = viewer;
const state = { kind: null, id: null, params: {}, palette: null, mood: url.get('mood'), pose: url.get('pose'), saved: null, index: null };

function msg(text, cls = '') { const m = $('#msg'); m.textContent = text; m.className = cls; }

// ---------------------------------------------------------------------------------------------
// Bibliothek
// ---------------------------------------------------------------------------------------------
const GROUPS = [['scenes', 'Szenen'], ['figures', 'Figuren'], ['models', 'Modelle'], ['palettes', 'Paletten'], ['moods', 'Stimmungen'], ['rigs', 'Rigs'], ['poses', 'Posen']];
async function loadIndex() {
  state.index = await (await fetch(ROOT + 'api/index', { cache: 'no-store' })).json();
  renderIndex();
}
function renderIndex() {
  const q = $('#search').value.trim().toLowerCase(), el = $('#lib'); el.innerHTML = '';
  for (const [kind, label] of GROUPS) {
    const ids = (state.index[kind] || []).filter((id) => !q || id.includes(q));
    if (!ids.length) continue;
    const h = document.createElement('h2'); h.textContent = `${label} (${ids.length})`; el.appendChild(h);
    let folder = null;
    for (const id of ids) {
      const f = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '';
      if (f !== folder && f) { folder = f; const d = document.createElement('div'); d.className = 'folder'; d.textContent = f + '/'; el.appendChild(d); }
      const d = document.createElement('div'); d.className = 'item' + (kind === state.kind && id === state.id ? ' on' : '');
      d.textContent = f ? id.slice(f.length + 1) : id; d.title = id;
      d.onclick = () => select(kind, id);
      el.appendChild(d);
    }
  }
}
$('#search').oninput = renderIndex;

// ---------------------------------------------------------------------------------------------
// Auswahl + Vorschau
// ---------------------------------------------------------------------------------------------
async function select(kind, id, keep = false) {
  try {
    const obj = await lib.load(kind, id);
    if (!keep) { state.params = {}; state.palette = url.get('palette') || null; }
    // Parameter per URL: &p.open=1&p.w=20
    for (const [k, v] of url) if (k.startsWith('p.') && kind === 'models') state.params[k.slice(2)] = isNaN(+v) ? v : +v;
    state.kind = kind; state.id = id; state.saved = formatJSON(obj);
    $('#json').value = state.saved;
    history.replaceState(null, '', `?${kind.slice(0, -1)}=${id}${state.mood ? '&mood=' + state.mood : ''}${SHOT ? '&shot=1' : ''}`);
    renderIndex();
    await preview();
    msg('');
  } catch (e) { console.error(e); msg(e.message, 'err'); }
}

async function ensureMoods() { for (const m of state.index.moods) await lib.load('moods', m); for (const p of state.index.palettes) await lib.load('palettes', p); }

function stage(obj, size = 2, floor = true) {
  // Boden mit 1-m-Raster für Modelle und Figuren (Schiffe schweben: ohne Boden)
  const g = new THREE.Group(); g.add(obj);
  if (!floor) return g;
  const box = new THREE.Box3().setFromObject(obj), s = Math.max(4, Math.ceil(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + size * 2));
  const ground = new THREE.Mesh(new THREE.BoxGeometry(s, 0.05, s), new THREE.MeshStandardMaterial({ color: 0x7d766a, roughness: 1 }));
  ground.position.y = -0.025 + Math.min(0, box.min.y); ground.receiveShadow = true; g.add(ground);
  const grid = new THREE.GridHelper(s, s, 0x5c564c, 0x5c564c); grid.position.y = 0.002 + Math.min(0, box.min.y); grid.material.transparent = true; grid.material.opacity = 0.5; g.add(grid);
  return g;
}

function scaleRef(x) {
  // Maßstab: Mensch 1,94 m als Säule
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.94, 0.3), new THREE.MeshStandardMaterial({ color: 0x56b4e9, transparent: true, opacity: 0.25 }));
  m.position.set(x, 0.97, 0); return m;
}

async function preview() {
  await ensureMoods();
  const { kind, id } = state;
  let hud = '', title = id, sub = '';
  if (kind === 'models') {
    const m = lib.get('models', id);
    const opts = { params: state.params, palette: state.palette || m.palette };
    const built = lib.build(id, opts);
    const o = modelObject(lib, id, opts);
    const b = built.grid.bounds(), s = voxelSize(built.tier), dims = [0, 1, 2].map((i) => b.max[i] - b.min[i] + 1);
    const box = new THREE.Box3().setFromObject(o);
    const floats = (m.tags || []).includes('schiff') || url.get('floor') === '0';
    const g = stage(o, 2, !floats); if (url.get('ref') !== '0') g.add(scaleRef(box.max.x + 0.6));
    viewer.setContent(g); viewer.bounds = box.union(new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1.94, 1)));
    viewer.setMood(lib.get('moods', state.mood || 'planet_day'), viewer.bounds, { fog: false });
    viewer.frameContent({ elev: +(url.get('elev') ?? 28), az: +(url.get('az') ?? 35), pad: +(url.get('pad') ?? 1.05) });
    title = m.name || id; sub = `${id} · ${TIERS[built.tier].label} (${TIERS[built.tier].voxelsPerMeter} Voxel/m)`;
    hud = `${dims.join('×')} Voxel = ${dims.map((d) => (d * s).toFixed(2)).join(' × ')} m · ${built.grid.size.toLocaleString('de-DE')} Voxel · ${(built.mesh.lit.quads + built.mesh.emit.quads).toLocaleString('de-DE')} Quads`;
    controlsModel(m);
  } else if (kind === 'figures') {
    const f = figureObject(lib, id, { palette: state.palette || undefined, phase: 0 });
    f.pose = state.pose || 'stand'; applyPose(f, f.pose, 0);
    const g = stage(f.root); g.add(scaleRef(1.0));
    viewer.setContent(g, [f]); viewer.bounds = new THREE.Box3(new THREE.Vector3(-0.8, 0, -0.6), new THREE.Vector3(1.3, 2.4, 0.6));
    viewer.setMood(lib.get('moods', state.mood || 'planet_day'), viewer.bounds, { fog: false });
    viewer.frameContent({ elev: +(url.get('elev') ?? 14), az: +(url.get('az') ?? 30), pad: 0.75 });
    title = lib.get('figures', id).name || id; sub = `${id} · Rig ${lib.get('figures', id).rig}`;
    hud = `${f.root.userData.voxels.toLocaleString('de-DE')} Voxel`;
    controlsFigure(f);
  } else if (kind === 'scenes') {
    const sc = sceneObject(lib, id);
    viewer.setContent(sc.group, sc.figures);
    const mood = lib.get('moods', state.mood || sc.scene.mood || 'planet_day');
    viewer.setMood(mood, viewer.bounds);
    viewer.addPointLights(sc.scene.lights);
    const cams = sc.scene.cameras || {};
    const cam = cams[state.cam || url.get('cam')] || sc.scene.camera || Object.values(cams)[0];
    if (cam) viewer.setCamera(cam); else viewer.frameContent({ elev: 40, az: 35, pad: 0.9 });
    title = sc.scene.name || id; sub = `${id} · ${sc.info.W}×${sc.info.D} m`;
    hud = `${sc.stats.voxels.toLocaleString('de-DE')} Voxel · ${sc.stats.instances} Platzierungen (${sc.stats.models} Bauten) · ${sc.figures.length} Figuren`;
    controlsScene(sc);
  } else {
    title = id; sub = kind; hud = '';
    $('#controls').innerHTML = `<span class="chip">${kind}</span> Nur JSON – Änderungen wirken nach „Anwenden“ auf die Vorschau.`;
  }
  $('#title').innerHTML = `${esc(title)}<small>${esc(sub)}</small>`;
  state.hud = hud;
  window.__stats = { kind, id, hud };
  // Bereit-Signal für Screenshot-Werkzeuge (nach zwei gerenderten Frames)
  window.__ready = false;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
}
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

setInterval(() => { const i = viewer.info(); $('#hud').textContent = `${state.hud || ''}\n${i.fps} FPS · ${i.calls} Draw Calls · ${i.triangles.toLocaleString('de-DE')} Dreiecke`; window.__stats && (window.__stats.render = i); }, 500);

// ---------------------------------------------------------------------------------------------
// Bedienelemente
// ---------------------------------------------------------------------------------------------
function selectRow(label, options, value, onChange) {
  const r = document.createElement('div'); r.className = 'row';
  r.innerHTML = `<label>${esc(label)}</label>`;
  const s = document.createElement('select');
  for (const o of options) { const op = document.createElement('option'); op.value = o; op.textContent = o; if (o === value) op.selected = true; s.appendChild(op); }
  s.onchange = () => onChange(s.value);
  r.appendChild(s); return r;
}
function moodRow() { return selectRow('Stimmung', state.index.moods, state.mood || '', (v) => { state.mood = v; preview(); }); }
function paletteRow(def) { return selectRow('Palette', state.index.palettes, state.palette || def, (v) => { state.palette = v; preview(); }); }

function controlsModel(m) {
  const c = $('#controls'); c.innerHTML = '';
  const tags = (m.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
  if (tags) { const d = document.createElement('div'); d.innerHTML = tags; c.appendChild(d); }
  c.appendChild(paletteRow(m.palette)); c.appendChild(moodRow());
  for (const [k, def] of Object.entries(m.params || {})) {
    const r = document.createElement('div'); r.className = 'row';
    const v = state.params[k] ?? def.default;
    if (def.options) { c.appendChild(selectRow(def.label || k, def.options, v, (nv) => { state.params[k] = nv; preview(); })); continue; }
    r.innerHTML = `<label title="${esc(k)}">${esc(def.label || k)}</label><input type="range" min="${def.min ?? 0}" max="${def.max ?? 32}" step="${def.step ?? 1}" value="${v}"><span class="val">${v}</span>`;
    const inp = r.querySelector('input'), val = r.querySelector('.val');
    inp.oninput = () => { val.textContent = inp.value; };
    inp.onchange = () => { state.params[k] = +inp.value; preview(); };
    c.appendChild(r);
  }
  const seed = document.createElement('div'); seed.className = 'row';
  seed.innerHTML = `<label>Variante (seed)</label><input type="range" min="0" max="15" step="1" value="${state.params.seed ?? 0}"><span class="val">${state.params.seed ?? 0}</span>`;
  const si = seed.querySelector('input'); si.oninput = () => (seed.querySelector('.val').textContent = si.value); si.onchange = () => { state.params.seed = +si.value; preview(); };
  c.appendChild(seed);
  if (m.variants) {
    const b = document.createElement('div'); b.className = 'btns';
    for (const [name, p] of Object.entries(m.variants)) { const bt = document.createElement('button'); bt.textContent = name; bt.onclick = () => { state.params = { ...p }; preview(); }; b.appendChild(bt); }
    c.appendChild(b);
  }
}
function controlsFigure(f) {
  const c = $('#controls'); c.innerHTML = '';
  c.appendChild(paletteRow(lib.get('figures', state.id).palette)); c.appendChild(moodRow());
  c.appendChild(selectRow('Pose', Object.keys(f.poses), state.pose || 'stand', (v) => { state.pose = v; viewer.figures.forEach((x) => (x.pose = v)); }));
  const r = document.createElement('div'); r.className = 'row';
  r.innerHTML = '<label>Animation</label><input type="checkbox" checked>';
  r.querySelector('input').onchange = (e) => (viewer.anim = e.target.checked);
  c.appendChild(r);
}
function controlsScene(sc) {
  const c = $('#controls'); c.innerHTML = '';
  c.appendChild(moodRow());
  const cams = Object.keys(sc.scene.cameras || {});
  if (cams.length) c.appendChild(selectRow('Kamera', cams, state.cam || url.get('cam') || cams[0], (v) => { state.cam = v; viewer.setCamera(sc.scene.cameras[v]); }));
  const b = document.createElement('div'); b.className = 'btns';
  const cam = document.createElement('button'); cam.textContent = 'Kamera zurücksetzen';
  cam.onclick = () => { const k = state.cam || cams[0]; (k ? viewer.setCamera(sc.scene.cameras[k]) : sc.scene.camera ? viewer.setCamera(sc.scene.camera) : viewer.frameContent()); };
  const log = document.createElement('button'); log.textContent = 'Kamera → JSON';
  log.title = 'Aktuelle Kameraposition in die Zwischenablage (für "camera" in der Szene)';
  log.onclick = () => {
    const t = viewer.controls.target, p = viewer.camera.position, d = p.distanceTo(t);
    const elev = Math.round((Math.asin((p.y - t.y) / d) * 180) / Math.PI), az = Math.round((Math.atan2(p.x - t.x, p.z - t.z) * 180) / Math.PI);
    const json = JSON.stringify({ target: [t.x, t.y, t.z].map((v) => +v.toFixed(2)), dist: +d.toFixed(2), elev, az, fov: viewer.camera.fov });
    navigator.clipboard?.writeText(json); msg('Kamera: ' + json, 'ok');
  };
  b.append(cam, log); c.appendChild(b);
}

// ---------------------------------------------------------------------------------------------
// JSON bearbeiten
// ---------------------------------------------------------------------------------------------
async function apply() {
  let obj;
  try { obj = JSON.parse($('#json').value); } catch (e) { return msg('JSON-Fehler: ' + e.message, 'err'); }
  if (obj.id !== state.id) return msg(`Die ID darf hier nicht geändert werden ("${state.id}"). Für ein neues Asset die Datei kopieren.`, 'err');
  try { await lib.put(state.kind, obj); await preview(); msg('Angewendet (noch nicht gespeichert).', 'ok'); }
  catch (e) { console.error(e); msg(e.message, 'err'); }
}
async function save() {
  await apply(); if ($('#msg').className === 'err') return;
  const r = await fetch(ROOT + `api/asset/${state.kind}/${state.id}`, { method: 'PUT', body: $('#json').value });
  const j = await r.json();
  if (!r.ok) return msg('Speichern fehlgeschlagen: ' + j.error, 'err');
  state.saved = formatJSON(JSON.parse($('#json').value)); $('#json').value = state.saved;
  msg('Gespeichert: ' + j.file, 'ok');
}
$('#apply').onclick = apply;
$('#save').onclick = save;
$('#revert').onclick = async () => { $('#json').value = state.saved; await lib.put(state.kind, JSON.parse(state.saved)); preview(); msg('Verworfen.'); };
$('#vox').onclick = async () => {
  if (state.kind !== 'models') return msg('.vox-Export geht nur für Modelle.', 'err');
  const b = lib.build(state.id, { params: state.params, palette: state.palette || lib.get('models', state.id).palette });
  const r = await fetch(ROOT + `api/vox/${state.id}.vox`, { method: 'PUT', body: gridToVox(b.grid) });
  const j = await r.json(); msg(r.ok ? `Exportiert: ${j.file} – in MagicaVoxel öffnen, polieren, per "vox"-Schritt zurück ins Rezept.` : j.error, r.ok ? 'ok' : 'err');
};
$('#shot').onclick = () => { const a = document.createElement('a'); a.download = (state.id || 'voxelwerk').replace(/\//g, '_') + '.png'; a.href = viewer.renderer.domElement.toDataURL('image/png'); a.click(); };
addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); apply(); }
  if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
});
$('#json').addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { e.preventDefault(); const t = e.target, s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end'); }
});

// ---------------------------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------------------------
await loadIndex();
const start = ['scene', 'figure', 'model'].map((k) => [k + 's', url.get(k)]).find(([, v]) => v);
if (start) await select(start[0], start[1], true);
else if (state.index.scenes.length) await select('scenes', state.index.scenes[0]);
else if (state.index.models.length) await select('models', state.index.models[0]);
