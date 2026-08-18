// Terrain as a heightfield with an analytic query, plus the flat reference grid
// that lab mode stands on.
//
// The footfall planner asks "how high is the ground at this x and z, and which
// way does it face" thousands of times a second, once per hoof per frame plus
// lookahead probes. Answering that from the noise function directly is far
// cheaper and more exact than raycasting against a mesh, and it never depends
// on triangle density. The mesh is only there to be looked at.

import * as THREE from 'three';

// Deterministic 2D value noise with smooth interpolation, plus fbm over it.
function hash2(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  // Quintic smoothstep, so the second derivative is continuous and normals do
  // not visibly facet.
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function createTerrain({
  seed = 7,
  size = 220,
  segments = 300,
  amplitude = 3.2,
  frequency = 0.016,
  octaves = 4,
} = {}) {
  const params = { seed, amplitude, frequency, octaves };

  function heightAt(x, z) {
    let h = 0;
    let amp = 1;
    let freq = params.frequency;
    let norm = 0;
    for (let o = 0; o < params.octaves; o++) {
      h += valueNoise(x * freq, z * freq, params.seed + o * 31) * amp;
      norm += amp;
      amp *= 0.48;
      freq *= 2.07;
    }
    // Centre it so zero is the average ground level, and flatten a bowl around
    // the origin so the horse always starts on level footing.
    let y = (h / norm - 0.5) * 2 * params.amplitude;
    const r = Math.hypot(x, z);
    const flat = 1 - Math.exp(-Math.pow(r / 14, 2));
    return y * flat;
  }

  // Central difference. Cheap and accurate enough for foot placement.
  const _n = new THREE.Vector3();
  function normalAt(x, z, eps = 0.25) {
    const hx = heightAt(x + eps, z) - heightAt(x - eps, z);
    const hz = heightAt(x, z + eps) - heightAt(x, z - eps);
    return _n.set(-hx, 2 * eps, -hz).normalize().clone();
  }

  // Slope in radians, useful for gait choice and for refusing a takeoff.
  function slopeAt(x, z) {
    return Math.acos(Math.min(1, Math.max(-1, normalAt(x, z).y)));
  }

  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x7d8259, roughness: 0.95, metalness: 0 })
  );
  mesh.receiveShadow = true;
  mesh.name = 'terrain';

  return { mesh, heightAt, normalAt, slopeAt, params, size };
}

// Lab mode backdrop. A flat plane at y = 0 with a grid, so the horse has an
// unambiguous ground reference and the eye can read stride length off the
// squares. The horse genuinely travels across this rather than running on the
// spot, which is what keeps the world locked hoof invariant intact.
export function createLabGround({ size = 400, step = 0.5 } = {}) {
  const group = new THREE.Group();
  group.name = 'labGround';

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color: 0x6e7360, roughness: 0.96, metalness: 0 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.002;
  plane.receiveShadow = true;
  group.add(plane);

  const grid = new THREE.GridHelper(size, size / step, 0x3d4436, 0x4a5241);
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  group.add(grid);

  // A metre grid on top of the half metre one, so scale is readable at a glance.
  const major = new THREE.GridHelper(size, size / 5, 0x9aa88c, 0x9aa88c);
  major.material.transparent = true;
  major.material.opacity = 0.28;
  major.position.y = 0.001;
  group.add(major);

  return {
    group,
    heightAt: () => 0,
    normalAt: () => new THREE.Vector3(0, 1, 0),
    slopeAt: () => 0,
  };
}
