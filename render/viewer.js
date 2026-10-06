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
  setMood(mood, focus) {
    this.mood = mood;
    this.lights.clear();
    const box = focus || this.bounds || new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
    const center = box.getCenter(new THREE.Vector3()), radius = Math.max(4, box.getSize(new THREE.Vector3()).length() / 2);
    this.scene.background = col(mood.background ?? '#202630');
    this.scene.fog = mood.fog ? new THREE.Fog(col(mood.fog.color), radius * (mood.fog.near ?? 2), radius * (mood.fog.far ?? 6)) : null;
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
