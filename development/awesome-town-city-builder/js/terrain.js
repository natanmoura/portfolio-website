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
  }

  // The still height of the ground. Waves ride on top of this at render time,
  // so buildings are placed against the resting surface.
  heightAt(x, z) {
    if (this.amplitude <= 0) return 0;
    return fbm2D(this.seed, x * this.frequency, z * this.frequency, this.octaves) * this.amplitude;
  }

  update(params) {
    this.seed = params.seed >>> 0;
    this.amplitude = params.terrainHeight || 0;
    this.frequency = 0.02 / Math.max(0.08, params.terrainScale || 1);
    this.octaves = Math.max(1, Math.round(params.terrainDetail || 3));

    const span = Math.max(params.cols, params.rows) * params.cell;
    const size = span * 2.6;
    // Waves need enough vertices to bend smoothly, not just enough for hills.
    const detail = params.waveHeight > 0 ? 1.1 : 1.6;
    const segments = Math.min(360, Math.max(24, Math.round(size / detail)));

    this.mesh.geometry.dispose();
    const geo = new THREE.PlaneGeometry(size, size, segments, segments).rotateX(-Math.PI / 2);
    if (this.amplitude > 0) {
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
    const lift = 0.02 + this.amplitude * 0.004;

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

  // Roads are ribbons laid over the ground, one quad per segment, mitred badly
  // but close enough at these widths. They ride the same wave as everything
  // else, so the tarmac stays on the water with the town.
  setRoads(roads, params) {
    this.roads.geometry.dispose();
    const pos = [];
    const nor = [];
    const lift = 0.06 + this.amplitude * 0.004;

    for (const road of roads || []) {
      const half = road.width / 2;
      for (let i = 0; i < road.pts.length - 1; i++) {
        const [ax, az] = road.pts[i];
        const [bx, bz] = road.pts[i + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const len = Math.hypot(dx, dz) || 1;
        const nx = (-dz / len) * half;
        const nz = (dx / len) * half;
        const corners = [
          [ax - nx, az - nz],
          [bx - nx, bz - nz],
          [bx + nx, bz + nz],
          [ax + nx, az + nz],
        ];
        const y = (x, z) => this.heightAt(x, z) + lift;
        const [p0, p1, p2, p3] = corners;
        // Counter-clockwise seen from above. The other way round and the
        // tarmac faces the earth and gets culled.
        for (const [a, b, c] of [
          [p0, p2, p1],
          [p0, p3, p2],
        ]) {
          pos.push(a[0], y(a[0], a[1]), a[1], b[0], y(b[0], b[1]), b[1], c[0], y(c[0], c[1]), c[1]);
          nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
        }
      }
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
