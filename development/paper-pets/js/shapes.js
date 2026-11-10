// Evaluation sheet for the head structures: clay renders from three angles plus the
// net, with face / fold / tab counts, so structures can be compared side by side.
import * as THREE from 'three';
import { BREEDS, buildPet, STRUCTURES } from './construct.js';
import { unfoldPart, layoutSheet } from './unfold.js';

const SIZE = 360;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f74, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(-2, 3, 4);
scene.add(key);
const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);

function clay(build, color) {
  const g = new THREE.Group();
  for (const part of build.parts) {
    const pos = [];
    for (const f of part.faces) for (let k = 1; k < f.v.length - 1; k++) for (const j of [0, k, k + 1]) pos.push(...part.verts[f.v[j]]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, side: THREE.DoubleSide })));
    const lines = [];
    const seen = new Set();
    for (const f of part.faces) f.v.forEach((a, k) => {
      const b = f.v[(k + 1) % f.v.length];
      const key2 = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (seen.has(key2)) return;
      seen.add(key2);
      lines.push(...part.verts[a], ...part.verts[b]);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2320, transparent: true, opacity: 0.25 })));
  }
  // where the eyes and nose land
  const t = build.template;
  for (const [pt, r] of [[t.eyes[0], 0.045], [t.eyes[1], 0.045], [t.nose, 0.05]]) {
    if (!pt) continue;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshStandardMaterial({ color: 0x1f1a18 }));
    m.position.set(...pt);
    g.add(m);
  }
  return g;
}

function shot(group, yaw, pitch = 0.12) {
  scene.add(group);
  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  const d = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.02;
  camera.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d);
  camera.lookAt(c);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL();
  scene.remove(group);
  return url;
}

function netImage(layout) {
  const xs = layout.faces.flatMap((f) => f.pts.map((p) => p[0])).concat(layout.islands.flatMap((i) => i.tabs.flatMap((t) => t.pts.map((p) => p[0]))));
  const ys = layout.faces.flatMap((f) => f.pts.map((p) => p[1])).concat(layout.islands.flatMap((i) => i.tabs.flatMap((t) => t.pts.map((p) => p[1]))));
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d');
  const k = (SIZE - 20) / Math.max(w, h);
  const P = ([x, y]) => [10 + (x - x0) * k, 10 + (y - y0) * k];
  const poly = (pts) => { ctx.beginPath(); pts.map(P).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  for (const isl of layout.islands) for (const t of isl.tabs) { poly(t.pts); ctx.fillStyle = '#e4ddd2'; ctx.fill(); }
  for (const f of layout.faces) { poly(f.pts); ctx.fillStyle = '#f6efe4'; ctx.fill(); }
  ctx.setLineDash([3, 2]);
  ctx.strokeStyle = 'rgba(80,60,50,0.6)';
  for (const e of layout.folds) { ctx.beginPath(); ctx.moveTo(...P(e.a)); ctx.lineTo(...P(e.b)); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.strokeStyle = '#2a2320';
  for (const e of layout.cuts) { ctx.beginPath(); ctx.moveTo(...P(e.a)); ctx.lineTo(...P(e.b)); ctx.stroke(); }
  return c.toDataURL();
}

const grid = document.getElementById('grid');
let current = new URLSearchParams(location.search).get('s') || 'planes';
const structs = document.getElementById('structs');
for (const s of Object.keys(STRUCTURES)) {
  const b = document.createElement('button');
  b.textContent = s;
  b.className = s === current ? 'on' : '';
  b.onclick = () => { current = s; [...structs.children].forEach((x) => x.classList.toggle('on', x.textContent === s)); render(); };
  structs.appendChild(b);
}

function render() {
  grid.innerHTML = '<div></div><div class="head">Front</div><div class="head">Three-quarter</div><div class="head">Side</div><div class="head">Net</div>';
  const stats = [];
  for (const [key3, pet] of Object.entries(BREEDS)) {
    const build = buildPet(pet, 'head', null, current);
    const layout = layoutSheet(build.parts.map(unfoldPart), 64);
    const g = clay(build, pet.colors.base);
    const faces = build.parts[0].faces.length;
    const tabs = layout.islands.reduce((s, i) => s + i.tabs.length, 0);
    stats.push({ key: key3, faces, folds: layout.folds.length, tabs, pieces: layout.islands.length });
    const name = document.createElement('div');
    name.className = 'name';
    name.innerHTML = `<b>${pet.name}</b><small>${faces} faces<br>${layout.folds.length} folds<br>${tabs} glue tabs<br>${layout.islands.length} piece${layout.islands.length > 1 ? 's' : ''}</small>`;
    grid.appendChild(name);
    for (const url of [shot(g, 0, 0.05), shot(g, 0.75), shot(g, Math.PI / 2, 0.02), netImage(layout)]) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.innerHTML = `<img src="${url}" alt="">`;
      grid.appendChild(cell);
    }
  }
  window.shapeStats = stats;
}
render();
