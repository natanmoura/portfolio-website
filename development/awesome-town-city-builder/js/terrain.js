// The ground the town sits on. A displaced plane driven by layered noise, plus
// a street grid that follows the same surface.
//
// The geometry is built directly in world XZ rather than as a rotated plane,
// so the wave shader can read a vertex position and know where in the water it
// is without unwinding a transform first.

import * as THREE from 'three';
import { fbm2D } from './noise.js';
import { shared } from './material.js';
import { WAVE_GLSL } from './wave.js';
import { shaderVersion } from './pcss.js';
import { ribbonEdges, ribbonTriangles } from './curve.js';
import { landformRaster } from './landform.js';

// Which kind of ground the town is standing on. Exclusive on purpose: see the
// header of landform.js. Noise you can only tune; shapes you can only place;
// mixing them means a slider nudge moves ground somebody placed by hand.
export const HILLS = 'hills';
export const DRAWN = 'drawn';
export const TERRAIN_MODES = [HILLS, DRAWN];
export const TERRAIN_MODE_LABEL = {
  [HILLS]: 'Hills',
  [DRAWN]: 'Drawn',
};

// The ground rides the same water as the buildings, using the same uniforms.
function patchWaves(material, withNormals) {
  material.onBeforeCompile = (shader) => {
    Object.entries(shared).forEach(([k, v]) => {
      shader.uniforms[k] = v;
    });
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `uniform float uTime;\n${WAVE_GLSL}\nvoid main() {`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.y += ccWaveAt(position.xz);`
      );
    if (withNormals) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         {
           vec2 ccS = ccWaveSlope(position.xz);
           objectNormal = normalize(objectNormal + vec3(-ccS.x, 0.0, -ccS.y));
         }`
      );
    }
  };
  material.customProgramCacheKey = () => (withNormals ? 'ground-' : 'grid-') + shaderVersion();
}

export class Ground {
  constructor() {
    this.material = new THREE.MeshStandardMaterial({
      color: '#c2bcab',
      roughness: 1,
      metalness: 0,
    });
    patchWaves(this.material, true);

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.material);
    this.mesh.receiveShadow = true;

    this.gridMaterial = new THREE.LineBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.12,
    });
    patchWaves(this.gridMaterial, false);
    this.grid = new THREE.LineSegments(new THREE.BufferGeometry(), this.gridMaterial);

    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: '#2a2723',
      roughness: 0.95,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    patchWaves(this.roadMaterial, true);
    this.roads = new THREE.Mesh(new THREE.BufferGeometry(), this.roadMaterial);
    this.roads.receiveShadow = true;

    this.group = new THREE.Group();
    this.group.add(this.mesh, this.roads, this.grid);

    this.amplitude = 0;
    this.frequency = 0.03;
    this.octaves = 3;
    this.seed = 1;
    this.mode = HILLS;
    this.raster = null;
    this.step = 0;
    // How far the ground travels vertically, whichever way it was made. The
    // lifts below (grid, tarmac) and the shadow frustum both want this, and
    // before drawn ground existed `amplitude` was the only answer there was.
    this.relief = 0;
  }

  // The still height of the ground. Waves ride on top of this at render time,
  // so buildings are placed against the resting surface.
  //
  // Called for every mesh vertex, every building, every car and every frame of
  // the tour, which is why drawn ground answers from a raster rather than from
  // the shapes themselves. See landform.js.
  heightAt(x, z) {
    let h;
    if (this.mode === DRAWN) {
      h = this.raster ? this.raster.sample(x, z) : 0;
    } else if (this.amplitude > 0) {
      h = fbm2D(this.seed, x * this.frequency, z * this.frequency, this.octaves) * this.amplitude;
    } else {
      h = 0;
    }
    // Terracing, applied last and to both kinds. One slider that turns any
    // slope into flat shelves with hard risers between them — rice paddies, a
    // strip mine, a stack of card. Rounding rather than flooring so the
    // stepped surface sits on the same average level as the smooth one it
    // replaced instead of sinking by half a step.
    if (this.step > 0) h = Math.round(h / this.step) * this.step;
    return h;
  }

  // `townSpan` is how far the town actually reaches, which is the square cols
  // and rows imply until a boundary is drawn and then whatever that boundary
  // covers. The ground takes the larger of the two, so dragging the edge of
  // town outward does not walk it off the end of the world.
  update(params, townSpan = 0) {
    // Its own seed, or the city's until it has one. See generate.js.
    this.seed = (params.terrainSeed ?? params.seed) >>> 0;
    this.amplitude = params.terrainHeight || 0;
    this.frequency = 0.02 / Math.max(0.08, params.terrainScale || 1);
    this.octaves = Math.max(1, Math.round(params.terrainDetail || 3));
    this.mode = params.terrainMode === DRAWN ? DRAWN : HILLS;
    this.step = Math.max(0, params.terrainStep || 0);

    const span = Math.max(Math.max(params.cols, params.rows) * params.cell, townSpan);
    const size = span * 2.6;
    // Waves need enough vertices to bend smoothly, not just enough for hills.
    // Drawn ground needs them for a third reason: a cliff can only be as sharp
    // as one cell is wide, so the mesh's own spacing *is* the sharpest edge
    // the tool can express. Finer, and capped higher, when there are shapes to
    // resolve.
    const drawn = this.mode === DRAWN;
    const detail = drawn ? 1 : params.waveHeight > 0 ? 1.1 : 1.6;
    const segments = Math.min(drawn ? 512 : 360, Math.max(24, Math.round(size / detail)));

    // Built before the mesh, because the mesh is its first customer. Cell size
    // is the mesh's own, so a vertex query hits a stored value exactly.
    this.raster = drawn
      ? landformRaster(params.landforms || [], -size / 2, -size / 2, size, size / segments)
      : null;
    this.relief = drawn ? this.raster.relief : this.amplitude;

    this.mesh.geometry.dispose();
    const geo = new THREE.PlaneGeometry(size, size, segments, segments).rotateX(-Math.PI / 2);
    if (this.relief > 0 || this.step > 0) {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, this.heightAt(pos.getX(i), pos.getZ(i)));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
    // The wave lifts vertices at render time, so bounds must allow for it.
    geo.computeBoundingSphere();
    geo.boundingSphere.radius += (params.waveHeight || 0) + 1;
    this.mesh.geometry = geo;

    this.buildGrid(params);
  }

  buildGrid(params) {
    const { cols, rows, cell } = params;
    const x0 = -(cols * cell) / 2;
    const z0 = -(rows * cell) / 2;
    const steps = params.waveHeight > 0 ? 28 : 12;
    const pts = [];
    const lift = 0.02 + this.relief * 0.004;

    const push = (x, z) => pts.push(x, this.heightAt(x, z) + lift, z);
    for (let i = 0; i <= cols; i++) {
      const x = x0 + i * cell;
      for (let s = 0; s < steps; s++) {
        push(x, z0 + (rows * cell * s) / steps);
        push(x, z0 + (rows * cell * (s + 1)) / steps);
      }
    }
    for (let j = 0; j <= rows; j++) {
      const z = z0 + j * cell;
      for (let s = 0; s < steps; s++) {
        push(x0 + (cols * cell * s) / steps, z);
        push(x0 + (cols * cell * (s + 1)) / steps, z);
      }
    }

    this.grid.geometry.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.computeBoundingSphere();
    geo.boundingSphere.radius += (params.waveHeight || 0) + 1;
    this.grid.geometry = geo;
  }

  // Roads are ribbons laid over the ground. They ride the same wave as
  // everything else, so the tarmac stays on the water with the town.
  //
  // One continuous strip per road, mitred at every point via `ribbonEdges` in
  // curve.js — shared with the curve highlight in curveview.js, which is the
  // second customer that made pulling the mitre math out of here worthwhile.
  // Before it existed this was one free-standing quad per segment, each
  // offset along its own perpendicular, and it read exactly as what it was:
  // at every bend the two quads met at their end edges pointing different
  // ways, leaving a wedge missing from the outside of the turn and a doubled
  // overlap on the inside.
  setRoads(roads, params) {
    this.roads.geometry.dispose();
    const pos = [];
    const nor = [];
    const lift = 0.06 + this.relief * 0.004;

    for (const road of roads || []) {
      const pts = road.pts;
      if (!pts || pts.length < 2) continue;
      // A ring road arrives with its last point on top of its first, which
      // `ribbonEdges` closes into a loop with no seam at the arbitrary place
      // it happened to start.
      const closed =
        pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6;
      const edges = ribbonEdges(pts, road.width / 2, closed);
      const { pos: p2, nor: n2 } = ribbonTriangles(edges, (p) => this.heightAt(p[0], p[1]) + lift);
      pos.push(...p2);
      nor.push(...n2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.computeBoundingSphere();
    if (geo.boundingSphere) geo.boundingSphere.radius += (params.waveHeight || 0) + 1;
    this.roads.geometry = geo;
  }

  setRoadsVisible(on) {
    this.roads.visible = on;
  }

  setRoadColor(color) {
    this.roadMaterial.color.copy(color);
  }

  setColor(color) {
    this.material.color.copy(color);
  }

  setGridVisible(on) {
    this.grid.visible = on;
  }

  setGridOpacity(v) {
    this.gridMaterial.opacity = v;
  }
}
