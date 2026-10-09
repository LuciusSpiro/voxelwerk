// Viewer: Renderer, Kamera (Perspektive mit kleinem Bildwinkel = Diorama), Stimmung, Bloom, Statistik.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { applyPose } from './voxel-three.js';

const D2R = Math.PI / 180;
const col = (s) => new THREE.Color(s);

export class Viewer {
  constructor(container, opt = {}) {
    this.container = container;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opt.preserve, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;   // erhält Sättigung besser als ACES (Stonehearth-Farbigkeit)
    r.info.autoReset = false;   // Composer rendert mehrere Pässe → selbst zurücksetzen
    container.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true; this.controls.maxPolarAngle = 88 * D2R;
    this.content = new THREE.Group(); this.scene.add(this.content);
    this.lights = new THREE.Group(); this.scene.add(this.lights);
    // Hilfsebenen (Raster, Socket-Marker): unabhängig vom Inhalt, nie im Schattenwurf
    this.overlay = new THREE.Group(); this.overlay.name = 'overlay'; this.scene.add(this.overlay);
    this.raster = null; this.sockets = null;
    this.figures = []; this.t = 0; this.anim = true;
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.stats = { fps: 0, frames: 0, last: performance.now() };
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); };
    loop();
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /** Inhalt ersetzen. figures: Figuren mit .pose zum Animieren. */
  setContent(obj, figures = []) {
    this.content.clear();
    this.content.add(obj);
    this.figures = figures;
    const box = new THREE.Box3().setFromObject(obj);
    this.bounds = box;
    return box;
  }

  /** Kamera: Ziel, Abstand, Neigung (elev), Drehung (az), Bildwinkel. */
  setCamera({ target, dist, elev = 40, az = 35, fov = 30 }) {
    this.camera.fov = fov; this.camera.updateProjectionMatrix();
    const T = new THREE.Vector3(...target);
    const e = elev * D2R, a = az * D2R;
    this.camera.position.set(T.x + Math.sin(a) * Math.cos(e) * dist, T.y + Math.sin(e) * dist, T.z + Math.cos(a) * Math.cos(e) * dist);
    this.controls.target.copy(T); this.controls.update();
  }

  /** Kamera so setzen, dass der Inhalt ins Bild passt. */
  frameContent(opt = {}) {
    const box = this.bounds || new THREE.Box3().setFromObject(this.content);
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2 || 1;
    const fov = opt.fov ?? 30;
    this.setCamera({ target: [c.x, c.y, c.z], dist: (r / Math.sin((fov * D2R) / 2)) * (opt.pad ?? 1.0), elev: opt.elev ?? 30, az: opt.az ?? 35, fov });
  }

  /** Stimmung (assets/moods/*.json) anwenden. */
  setMood(mood, focus, opt = {}) {
    this.mood = mood;
    this.lights.clear();
    const box = focus || this.bounds || new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
    const center = box.getCenter(new THREE.Vector3()), radius = Math.max(4, box.getSize(new THREE.Vector3()).length() / 2);
    this.scene.background = col(mood.background ?? '#202630');
    this.scene.fog = mood.fog && opt.fog !== false ?new THREE.Fog(col(mood.fog.color), radius * (mood.fog.near ?? 2), radius * (mood.fog.far ?? 6)) : null;
    const hemi = new THREE.HemisphereLight(col(mood.hemi?.sky ?? '#a0b4c8'), col(mood.hemi?.ground ?? '#40382c'), mood.hemi?.intensity ?? 1.0);
    this.lights.add(hemi);
    if (mood.ambient) this.lights.add(new THREE.AmbientLight(col(mood.ambient.color), mood.ambient.intensity));
    if (mood.sun) {
      const d = new THREE.Vector3(...(mood.sun.dir ?? [-0.5, 1, 0.3])).normalize();
      const sun = new THREE.DirectionalLight(col(mood.sun.color ?? '#fff2dc'), mood.sun.intensity ?? 2.5);
      sun.position.copy(center).addScaledVector(d, radius * 3); sun.target.position.copy(center);
      sun.castShadow = true;
      const sz = mood.sun.shadowMap ?? 4096; sun.shadow.mapSize.set(sz, sz);
      const c = sun.shadow.camera; c.left = c.bottom = -radius; c.right = c.top = radius; c.near = 0.1; c.far = radius * 6;
      sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = mood.sun.softness ?? 3;
      this.lights.add(sun, sun.target);
    }
    for (const p of mood.points || []) {
      const l = new THREE.PointLight(col(p.color), p.intensity ?? 5, p.distance ?? 12, 2);
      l.position.set(...p.at); this.lights.add(l);
    }
    this.renderer.toneMappingExposure = mood.exposure ?? 1.0;
    this.bloom.strength = mood.bloom?.strength ?? 0.5;
    this.bloom.radius = mood.bloom?.radius ?? 0.5;
    this.bloom.threshold = mood.bloom?.threshold ?? 0.85;
  }

  /** Zusätzliche Punktlichter aus der Szene (Fackeln, Leuchtsäulen …). */
  addPointLights(list) {
    for (const p of list || []) {
      const l = new THREE.PointLight(col(p.color), p.intensity ?? 5, p.distance ?? 10, 2);
      l.position.set(...p.at); this.lights.add(l);
    }
  }

  /**
   * Raster-Overlay: Kacheln 1 m, Zelle cell×cell Kacheln, die 2 Mittelkacheln jeder Zellkante markiert.
   * origin = [x, z] der Zellecke (min), y = Bodenhöhe. visible schaltet nur die Sichtbarkeit.
   */
  setRaster({ origin = [0, 0], y = 0, cell = 8, visible = true } = {}) {
    if (this.raster) { this.overlay.remove(this.raster); disposeTree(this.raster); }
    const g = (this.raster = new THREE.Group()); g.name = 'raster'; g.visible = visible;
    const [x0, z0] = origin, x1 = x0 + cell, z1 = z0 + cell, pad = 2;
    // feine Kachellinien (über die Zelle hinaus, damit Nachbarzellen erkennbar bleiben)
    const fine = [], coarse = [];
    for (let i = -pad; i <= cell + pad; i++) {
      const L = i % cell === 0 ? coarse : fine;
      L.push(x0 + i, 0, z0 - pad, x0 + i, 0, z1 + pad, x0 - pad, 0, z0 + i, x1 + pad, 0, z0 + i);
    }
    const lines = (arr, color, opacity) => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    };
    g.add(lines(fine, 0xe8e4d8, 0.35), lines(coarse, 0xd4a23a, 0.9));
    // Zellrand als flache Bänder (Linienbreite ist in WebGL immer 1 px)
    const band = new THREE.MeshBasicMaterial({ color: 0xd4a23a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const quad = (cx, cz, w, d, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.001, cz); g.add(m); return m; };
    const t = 0.05;
    quad(x0 + cell / 2, z0, cell + t, t, band); quad(x0 + cell / 2, z1, cell + t, t, band);
    quad(x0, z0 + cell / 2, t, cell + t, band); quad(x1, z0 + cell / 2, t, cell + t, band);
    // Kantenmitte: die 2 mittleren Kacheln jeder Kante (Türöffnung/Durchgang)
    const mid = new THREE.MeshBasicMaterial({ color: 0x56b4e9, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    const c = cell / 2;
    quad(x0 + c, z0 + 0.5, 2, 1, mid); quad(x0 + c, z1 - 0.5, 2, 1, mid);
    quad(x0 + 0.5, z0 + c, 1, 2, mid); quad(x1 - 0.5, z0 + c, 1, 2, mid);
    g.position.y = y + 0.006; g.renderOrder = 2;
    g.userData.box = new THREE.Box3(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z1));
    this.overlay.add(g);
    return g;
  }

  /** Raster ein-/ausblenden; gibt den neuen Zustand zurück. */
  toggleRaster(on) { if (!this.raster) return false; this.raster.visible = on ?? !this.raster.visible; return this.raster.visible; }

  /** Socket-Marker: [{ name, at: [x, y, z] }] in Metern (Weltkoordinaten), Kugel + Namensschild. */
  setSockets(list = []) {
    if (this.sockets) { this.overlay.remove(this.sockets); disposeTree(this.sockets); this.sockets = null; }
    if (!list.length) return null;
    const g = (this.sockets = new THREE.Group()); g.name = 'sockets';
    const geo = new THREE.SphereGeometry(0.08, 16, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4fd8, depthTest: false, transparent: true });
    for (const s of list) {
      const p = new THREE.Vector3(...s.at);
      const ball = new THREE.Mesh(geo, mat); ball.position.copy(p); ball.renderOrder = 10; g.add(ball);
      const label = textSprite(s.name); label.position.copy(p).add(new THREE.Vector3(0, 0.22, 0)); g.add(label);
    }
    this.overlay.add(g);
    return g;
  }

  frame() {
    const now = performance.now();
    this.stats.frames++;
    if (now - this.stats.last > 1000) { this.stats.fps = (this.stats.frames * 1000) / (now - this.stats.last); this.stats.frames = 0; this.stats.last = now; }
    if (this.anim) this.t += 1 / 60;
    for (const f of this.figures) applyPose(f, f.pose, this.t);
    this.controls.update();
    this.renderer.info.reset();
    this.composer.render();
  }

  info() {
    const ri = this.renderer.info;
    return { fps: Math.round(this.stats.fps), calls: ri.render.calls, triangles: ri.render.triangles };
  }
}

function textSprite(text) {
  const fs = 40, pad = 10, c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `600 ${fs}px system-ui, sans-serif`;
  c.width = Math.ceil(x.measureText(text).width) + pad * 2; c.height = fs + pad * 2;
  x.font = `600 ${fs}px system-ui, sans-serif`;
  x.fillStyle = 'rgba(18,21,28,0.8)'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#ff9fe8'; x.textBaseline = 'middle'; x.fillText(text, pad, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const h = 0.2; sp.scale.set((h * c.width) / c.height, h, 1); sp.renderOrder = 11;
  return sp;
}

function disposeTree(o) {
  o.traverse((n) => { n.geometry?.dispose(); const m = n.material; if (m) (Array.isArray(m) ? m : [m]).forEach((k) => { k.map?.dispose(); k.dispose(); }); });
}
