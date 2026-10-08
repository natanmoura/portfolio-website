import * as THREE from 'three';
import { BODIES, PARTS, OFF_PARTS, randomGenome, compileGenome } from './genome.js';
import { CANDIDATES } from './body-candidates.js';
import { evalPrims, primsBounds } from './sdf.js';
import { meshField } from './mesher.js';

// Renders every body shape, in game and proposed, and every ear and topper
// part, a few random variations each, and lets you pick the ones to keep.
// Picks persist per browser and copy out as plain text.

const VARIANTS = 3;
const SIZE = 240;

// Shapes taken out of the game in earlier rounds, and the simple primitives batch.
const RETIRED = ['bean', 'gumdrop', 'cloud', 'caterpillar', 'wide', 'mushroom', 'kidney', 'crown', 'frog', 'sausage', 'carrot', 'molar'];
const PRIMS = ['coin', 'tombstone', 'butter', 'mochi', 'longegg', 'topheavy', 'bottle', 'flan', 'funnel', 'bun', 'snout', 'belly', 'comet', 'squish', 'cone', 'onigiri', 'ball', 'egg'];
const kindOf = (name) => (PRIMS.includes(name) ? 'blocks' : RETIRED.includes(name) ? 'retired' : 'new');
const order = { blocks: 0, new: 1, retired: 2 };
const TAGS = { current: ['', 'in game'], blocks: ['new', 'primitive'], new: ['new', 'new'], retired: ['', 'retired'] };

// Ears and toppers are shown on three in-game bodies, with the part coloured.
const PART_BODIES = ['blob', 'pear', 'box'];
const PART_NAMES = { roundEars: 'round ears', pointyEars: 'pointy ears', bunnyEars: 'bunny ears', sideEars: 'side ears', tail: 'tail (back)', spikes: 'spikes (back)' };

const SECTIONS = {
  bodies: {
    store: 'goo-shape-picks',
    items: [
      ...Object.entries(BODIES).map(([name, def]) => ({ name, def, current: true, kind: 'current' })),
      ...Object.entries(CANDIDATES)
        .map(([name, def]) => ({ name, def, current: false, kind: kindOf(name) }))
        .sort((a, b) => order[a.kind] - order[b.kind]),
    ],
  },
  parts: {
    store: 'goo-part-picks',
    items: Object.keys(PARTS).filter((k) => k !== 'arms').map((name) => {
      const on = !OFF_PARTS.includes(name);
      return { name, part: true, current: on, kind: on ? 'current' : 'retired' };
    }),
  },
};

for (const sec of Object.values(SECTIONS)) {
  sec.picks = new Set(sec.items.filter((i) => i.current).map((i) => i.name));
  sec.notes = '';
  try {
    const saved = JSON.parse(localStorage.getItem(sec.store) || 'null');
    if (saved) { sec.picks = new Set(saved.picks || []); sec.notes = saved.notes || ''; }
  } catch {}
}
const save = (sec) => { try { localStorage.setItem(sec.store, JSON.stringify({ picks: [...sec.picks], notes: sec.notes })); } catch {} };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4dc, 2.1));
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(2, 4, 3);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(13, 1, 0.1, 100);
const material = new THREE.MeshLambertMaterial({ vertexColors: true });
const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
scene.add(mesh);

const rand = (a, b) => a + Math.random() * (b - a);
const sample = (ranges) => Object.fromEntries(Object.entries(ranges).map(([k, [a, b]]) => [k, rand(a, b)]));
const rng = {
  next: Math.random,
  range: rand,
  pick: (a) => a[Math.floor(Math.random() * a.length)],
  chance: (p) => Math.random() < p,
  shuffle: (a) => [...a].sort(() => Math.random() - 0.5),
  int: (a, b) => Math.floor(rand(a, b + 1)),
};

// Meshes the prims and renders them from roughly the game's camera angle.
// With partFrom set, prims from that index on are coloured as the part.
function thumb(prims, hue, partFrom = prims.length) {
  const maxK = Math.max(0, ...prims.map((p) => p.k || 0));
  const { min, max } = primsBounds(prims, 0.06 + maxK * 0.3);
  min[1] = Math.max(min[1], -0.02);
  const m = meshField((x, y, z) => evalPrims(prims, x, y, z), min, max, 0.028);
  const body = prims.slice(0, partFrom), part = prims.slice(partFrom);
  const base = new THREE.Color().setHSL(hue, part.length ? 0.15 : 0.72, part.length ? 0.82 : 0.62);
  const hi = new THREE.Color().setHSL(hue, 0.8, 0.58);
  const cols = new Float32Array(m.positions.length);
  for (let i = 0; i < m.positions.length; i += 3) {
    const [x, y, z] = [m.positions[i], m.positions[i + 1], m.positions[i + 2]];
    const c = part.length && evalPrims(part, x, y, z) < evalPrims(body, x, y, z) + 0.01 ? hi : base;
    cols[i] = c.r; cols[i + 1] = c.g; cols[i + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
  mesh.geometry.dispose();
  mesh.geometry = geo;

  const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2 + 0.05, cz = (min[2] + max[2]) / 2;
  const ext = Math.max(max[0] - min[0], max[1] - min[1]) * 0.56 + 0.06;
  const dist = ext / Math.tan(THREE.MathUtils.degToRad(6.5));
  // Back parts are seen from behind and to the side.
  const yaw = 0.45 + (prims.backView ? 2.0 : 0), pitch = 0.42;
  camera.position.set(cx + Math.sin(yaw) * Math.cos(pitch) * dist, cy + Math.sin(pitch) * dist, cz + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(cx, cy, cz);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

function variant(item, v) {
  if (!item.part) return thumb(item.def.build(sample(item.def.ranges)).prims, item.hue);
  const gn = randomGenome(rng, { body: PART_BODIES[v % PART_BODIES.length], nParts: 0 });
  gn.growth = [];
  const bare = compileGenome(gn, 0).prims.length;
  gn.parts = [{ type: item.name, p: sample(PARTS[item.name].ranges) }];
  const prims = compileGenome(gn, 0).prims;
  prims.backView = PARTS[item.name].group === 'back';
  return thumb(prims, item.hue, bare);
}

const grid = document.getElementById('grid');
let section = 'bodies';
let filter = 'all';
const sec = () => SECTIONS[section];

for (const [key, s] of Object.entries(SECTIONS)) {
  s.cards = s.items.map((item, i) => {
    const el = document.createElement('div');
    el.className = 'card' + (s.picks.has(item.name) ? ' picked' : '');
    const tag = TAGS[item.kind];
    el.innerHTML = `<div class="thumbs">${'<div class="ph"></div>'.repeat(VARIANTS)}</div>
      <div class="meta"><span class="name">${PART_NAMES[item.name] || item.name}</span><span class="tag ${tag[0]}">${tag[1]}</span><span class="tick"></span></div>`;
    el.addEventListener('click', () => {
      if (s.picks.has(item.name)) s.picks.delete(item.name); else s.picks.add(item.name);
      el.classList.toggle('picked', s.picks.has(item.name));
      save(s);
      update();
    });
    grid.appendChild(el);
    item.hue = ((i + (key === 'parts' ? 3 : 0)) * 0.137) % 1;
    return { item, el };
  });
}

document.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
  section = b.dataset.s;
  document.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b));
  document.getElementById('body-filters').style.display = section === 'bodies' ? '' : 'none';
  filter = 'all';
  document.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x.dataset.f === 'all'));
  notesEl.value = sec().notes;
  update();
}));
document.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.f;
  document.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b));
  update();
}));

const notesEl = document.getElementById('notes');
notesEl.value = sec().notes;
notesEl.addEventListener('input', () => { sec().notes = notesEl.value; save(sec()); update(); });

function output() {
  const b = SECTIONS.bodies, p = SECTIONS.parts;
  const keep = b.items.filter((s) => b.picks.has(s.name));
  let t = `Blinks body shapes I picked (${keep.length}):\n`;
  t += `Keep from game: ${keep.filter((s) => s.current).map((s) => s.name).join(', ') || 'none'}\n`;
  t += `Add new: ${keep.filter((s) => !s.current).map((s) => s.name).join(', ') || 'none'}\n`;
  t += `Remove from game: ${b.items.filter((s) => s.current && !b.picks.has(s.name)).map((s) => s.name).join(', ') || 'none'}`;
  if (b.notes.trim()) t += `\nBody notes: ${b.notes.trim()}`;
  t += `\n\nEars and parts:\n`;
  t += `Keep: ${p.items.filter((s) => p.picks.has(s.name)).map((s) => s.name).join(', ') || 'none'}\n`;
  t += `Remove: ${p.items.filter((s) => !p.picks.has(s.name)).map((s) => s.name).join(', ') || 'none'}`;
  if (p.notes.trim()) t += `\nPart notes: ${p.notes.trim()}`;
  return t;
}

function update() {
  for (const [key, s] of Object.entries(SECTIONS)) {
    for (const { item, el } of s.cards) {
      const show = key === section && (filter === 'all' || (filter === 'current' && item.current) || (filter === 'new' && !item.current)
        || filter === item.kind || (filter === 'picked' && s.picks.has(item.name)));
      el.classList.toggle('hidden', !show);
    }
  }
  document.getElementById('count').textContent = `${sec().picks.size} picked of ${sec().items.length}`;
  document.getElementById('out').value = output();
}

const toast = document.getElementById('toast');
document.getElementById('copy').addEventListener('click', async () => {
  const text = output();
  try { await navigator.clipboard.writeText(text); }
  catch { const o = document.getElementById('out'); o.select(); document.execCommand('copy'); }
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1200);
});
document.getElementById('clear').addEventListener('click', () => {
  const s = sec();
  s.picks.clear();
  for (const { el } of s.cards) el.classList.remove('picked');
  save(s);
  update();
});

let run = 0;
async function renderAll() {
  const id = ++run;
  for (const s of [SECTIONS.parts, SECTIONS.bodies]) {
    for (const { item, el } of s.cards) {
      const slots = el.querySelector('.thumbs');
      for (let v = 0; v < VARIANTS; v++) {
        if (id !== run) return;
        const img = new Image();
        try { img.src = variant(item, v); } catch (e) { console.error(item.name, e); continue; }
        img.alt = `${item.name} variation ${v + 1}`;
        slots.children[v].replaceWith(img);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }
}
document.getElementById('reroll').addEventListener('click', () => {
  for (const s of Object.values(SECTIONS)) for (const { el } of s.cards) el.querySelector('.thumbs').innerHTML = '<div class="ph"></div>'.repeat(VARIANTS);
  renderAll();
});

update();
renderAll();
