// Shelf thumbnails.
//
// One small renderer shared by every preview, drawn once per component and
// cached as a data URL. Rebuilt only when that component changes, so
// scrolling a shelf of a hundred parts costs nothing and editing one costs
// a single 96px render.

import * as THREE from 'three';
import { resolveComponent } from './library.js';

const SIZE = 96;

let renderer = null;
let scene = null;
let camera = null;
let material = null;
const cache = new Map();

function init() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe8eef8, 0x30343c, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(2, 4, 3);
  scene.add(key);

  camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
  material = new THREE.MeshStandardMaterial({
    color: 0xd6d1c4,
    roughness: 0.7,
    metalness: 0.02,
    side: THREE.DoubleSide,
    flatShading: true,
  });
}

// A preview is only useful if every part is in frame at a readable size, so
// the camera is fitted to the resolved bounds rather than parked somewhere
// fixed and hoping.
function frame(bounds) {
  const reach = Math.max(bounds.w, bounds.h, bounds.d, 0.2);
  const dist = reach * 2.4;
  camera.position.set(dist * 0.72, bounds.h * 0.62 + reach * 0.55, dist * 0.72);
  camera.lookAt(0, bounds.h * 0.45, 0);
  camera.updateProjectionMatrix();
}

export function thumbKey(doc) {
  // Content-addressed, so an edit invalidates its own preview and nothing
  // else has to remember to.
  return `${doc.id}:${JSON.stringify(doc)}`.slice(0, 512);
}

export function renderThumb(doc, lib, seed = 3) {
  const key = thumbKey(doc);
  if (cache.has(key)) return cache.get(key);
  init();

  const group = new THREE.Group();
  let url = '';
  try {
    const r = resolveComponent(doc, lib, seed, `thumb:${doc.id}`);
    if (!r) return '';
    for (const piece of r.pieces) {
      if (!piece.geometry) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(piece.geometry.pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(piece.geometry.nor, 3));
      const mesh = new THREE.Mesh(geo, material);
      const sc = piece.scale ?? 1;
      mesh.scale.setScalar(sc);
      mesh.position.set(
        piece.offset[0],
        piece.offset[1] + (piece.bounds.h * sc) / 2,
        piece.offset[2]
      );
      if (piece.rotY) mesh.rotation.y = piece.rotY;
      group.add(mesh);
    }
    scene.add(group);
    frame(r.bounds);
    renderer.render(scene, camera);
    url = renderer.domElement.toDataURL('image/png');
  } finally {
    scene.remove(group);
    group.traverse((o) => o.geometry && o.geometry.dispose());
  }

  cache.set(key, url);
  return url;
}

export function clearThumbs() {
  cache.clear();
}
