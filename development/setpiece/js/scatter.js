// scatter.js — procedural population of the world with collage cutouts.
//
// Design rule that everything else follows from: a field emits ordinary nodes
// into the scene, it does not own a live subtree. That means every instance is
// editable afterwards, and pinning one protects it from the next re-roll. Most
// scatter tools lose your hand work the moment you nudge a slider. This one
// does not, and that is the whole reason it is worth building.

import * as THREE from 'three';
import { uid, replaceFieldNodes } from './scene.js';
import { stationCamera } from './viewer.js';

/** Deterministic RNG so a seed always reproduces the same layout. */
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;

/** Pick a position inside the field's domain. */
function samplePosition(domain, rand) {
  const [cx, cy, cz] = domain.center || [0, 0, 0];
  const [sx, sy, sz] = domain.size || [10, 4, 10];

  switch (domain.type) {
    case 'box':
      // Anywhere in the volume. Reads as floating debris or particulate.
      return new THREE.Vector3(
        cx + (rand() - 0.5) * sx,
        cy + rand() * sy,
        cz + (rand() - 0.5) * sz,
      );

    case 'shell': {
      // On the walls of the volume, leaving the middle clear. Good for
      // building a room out of cards without blocking the camera's path.
      const face = Math.floor(rand() * 4);
      const along = (rand() - 0.5);
      const up = rand() * sy;
      if (face === 0) return new THREE.Vector3(cx - sx / 2, cy + up, cz + along * sz);
      if (face === 1) return new THREE.Vector3(cx + sx / 2, cy + up, cz + along * sz);
      if (face === 2) return new THREE.Vector3(cx + along * sx, cy + up, cz - sz / 2);
      return new THREE.Vector3(cx + along * sx, cy + up, cz + sz / 2);
    }

    case 'ring': {
      // An annulus around the centre, which is how you dress a camera move
      // that travels through the middle of the set.
      const a = rand() * Math.PI * 2;
      const r = lerp(sx / 4, sx / 2, Math.sqrt(rand()));
      return new THREE.Vector3(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r);
    }

    case 'ground':
    default:
      return new THREE.Vector3(
        cx + (rand() - 0.5) * sx,
        cy,
        cz + (rand() - 0.5) * sz,
      );
  }
}

/**
 * Reads pixels back from a station image so instances can sample the drawing
 * they are standing in. Cached per source because the readback is the slow
 * part and fields get re-rolled constantly.
 */
const samplers = new Map();

export function imageSampler(src) {
  if (samplers.has(src)) return samplers.get(src);
  const entry = { ready: false, data: null, w: 0, h: 0 };
  samplers.set(src, entry);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const w = Math.min(img.naturalWidth, 512);
    const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    try {
      entry.data = ctx.getImageData(0, 0, w, h).data;
      entry.w = w;
      entry.h = h;
      entry.ready = true;
    } catch (err) {
      // Cross-origin images taint the canvas. Local files and data URLs are
      // fine, which covers the actual workflow.
      console.warn('cannot sample image', src, err);
    }
  };
  img.src = src;
  return entry;
}

function sampleAt(entry, u, v) {
  if (!entry.ready) return null;
  const x = Math.max(0, Math.min(entry.w - 1, Math.round(u * entry.w)));
  const y = Math.max(0, Math.min(entry.h - 1, Math.round(v * entry.h)));
  const i = (y * entry.w + x) * 4;
  return `#${[entry.data[i], entry.data[i + 1], entry.data[i + 2]]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Generate the nodes for one field. Pure: same field and same scene stations
 * always produce the same array.
 */
export function generateField(field, scene) {
  if (!field.enabled) return [];
  const rand = rng(field.seed);
  const out = [];

  const sources = field.sources && field.sources.length ? field.sources : [null];

  let sampler = null;
  let sampleCam = null;
  if (field.sampleColorFrom) {
    const station = scene.stations.find((s) => s.id === field.sampleColorFrom);
    if (station) {
      sampler = imageSampler(station.src);
      sampleCam = stationCamera(station);
    }
  }

  for (let i = 0; i < field.count; i++) {
    const p = samplePosition(field.domain, rand);

    if (field.domain.exclude > 0) {
      const [cx, , cz] = field.domain.center || [0, 0, 0];
      const d = Math.hypot(p.x - cx, p.z - cz);
      if (d < field.domain.exclude) continue;
    }

    // Depth banding snaps instances onto a small number of planes. It is a
    // deliberate flattening: fewer depths read as stronger multiplane parallax
    // than a smooth cloud does, the way a paper theatre does.
    if (field.depthBands > 1) {
      const [, , cz] = field.domain.center || [0, 0, 0];
      const [, , sz] = field.domain.size || [10, 4, 10];
      const t = (p.z - (cz - sz / 2)) / sz;
      const band = Math.round(t * (field.depthBands - 1)) / (field.depthBands - 1);
      p.z = cz - sz / 2 + band * sz;
    }

    const src = sources[Math.floor(rand() * sources.length)];
    const scale = lerp(field.scale.min, field.scale.max, rand());

    let color = null;
    if (sampler && sampleCam) {
      const ndc = p.clone().project(sampleCam);
      if (ndc.z < 1) {
        color = sampleAt(sampler, (ndc.x + 1) / 2, 1 - (ndc.y + 1) / 2);
      }
    }

    const tintT = field.tint.amount > 0 ? rand() * field.tint.amount : 0;

    out.push({
      id: uid('s'),
      type: 'card',
      name: `${field.name} ${i}`,
      field: field.id,
      position: [p.x, p.y, p.z],
      size: [scale, scale, 0],
      rotationY: (rand() - 0.5) * Math.PI * 2 * field.rotationJitter,
      billboard: field.billboard,
      material: src
        ? {
            mode: 'texture',
            src,
            opacity: lerp(field.opacity.min, field.opacity.max, rand()),
            color: color || (tintT > 0 ? mixHex(field.tint.from, field.tint.to, tintT) : undefined),
          }
        : {
            mode: 'flat',
            color: color || mixHex(field.tint.from, field.tint.to, rand()),
            opacity: lerp(field.opacity.min, field.opacity.max, rand()),
          },
    });
  }

  return out;
}

function mixHex(a, b, t) {
  const pa = new THREE.Color(a);
  const pb = new THREE.Color(b);
  return `#${pa.lerp(pb, t).getHexString()}`;
}

/** Re-roll a field in place, keeping pinned instances. */
export function applyField(scene, field) {
  return replaceFieldNodes(scene, field.id, generateField(field, scene));
}

/** Re-roll every field. Used after a load or a station change. */
export function applyAllFields(scene) {
  for (const field of scene.fields) applyField(scene, field);
  return scene;
}
