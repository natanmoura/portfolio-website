// City data to three.js objects.
//
// Every module in a chunk of lots merges into one buffer sharing one material,
// so a thousand-building city is a few dozen draw calls rather than tens of
// thousands. Rotation rides along as a vertex attribute and happens on the
// GPU, so spinning modules do not have to break out into their own meshes.
//
// Editing stays cheap because the selected building is lifted out of its chunk
// into a mesh of its own. Dragging a slider then rebuilds one building, not
// sixteen.

import * as THREE from 'three';
import { buildShape, slotCount, slotLabels, cropFaces } from './geometry.js';
import { applyModifiers } from './modifiers.js';
import { isAssembly, resolveComponent, mergeResolved } from './library.js';

const CHUNK = 4; // lots per side

export class CityBuilder {
  constructor(pool, cityMaterial) {
    this.pool = pool;
    this.mat = cityMaterial;
    this.root = new THREE.Group();
    this.root.name = 'city';
    this.chunks = new Map(); // key -> mesh
    this.groups = new Map(); // key -> buildings
    this.pending = [];
    this.solo = null;
    this.isolatedId = null;
    this.city = null;
    // The component library, so a module whose kind is an assembly can be
    // resolved and merged at geometry time. Null until the app sets it.
    this.library = null;
    this._ghosted = false;
    this.stats = { chunks: 0, modules: 0, triangles: 0 };
    this._color = new THREE.Color();
  }

  chunkKey(gx, gz) {
    return `${Math.floor(gx / CHUNK)}_${Math.floor(gz / CHUNK)}`;
  }

  clear() {
    for (const mesh of this.chunks.values()) this.drop(mesh);
    this.chunks.clear();
    this.groups.clear();
    this.pending.length = 0;
    if (this.solo) this.drop(this.solo);
    this.solo = null;
  }

  drop(mesh) {
    mesh.geometry.dispose();
    mesh.removeFromParent();
  }

  // Queue the whole city for remeshing rather than doing it in one go.
  // Generating the data is cheap; turning it into buffers is not, so a global
  // slider drag on a large city spreads that cost over a few frames and keeps
  // the viewport interactive instead of locking up for a third of a second.
  build(city) {
    this.city = city;
    this.groups = new Map();
    for (const b of city.buildings) {
      const key = this.chunkKey(b.gx, b.gz);
      if (!this.groups.has(key)) this.groups.set(key, []);
      this.groups.get(key).push(b);
    }
    for (const key of [...this.chunks.keys()]) {
      if (!this.groups.has(key)) {
        this.drop(this.chunks.get(key));
        this.chunks.delete(key);
      }
    }
    this.pending = [...this.groups.keys()];
    this.sortPending();
    if (this.isolatedId) this.rebuildSolo();
    return this.root;
  }

  // Nearest chunks first, so what you are looking at updates first.
  sortPending(camera) {
    if (!camera || this.pending.length < 4) return;
    const score = (key) => {
      const list = this.groups.get(key);
      if (!list || !list.length) return Infinity;
      const b = list[0];
      return (b.x - camera.position.x) ** 2 + (b.z - camera.position.z) ** 2;
    };
    this.pending.sort((a, b) => score(a) - score(b));
  }

  // Mesh as many queued chunks as fit in the budget. Returns how many are left.
  tick(budgetMs = 6) {
    if (!this.pending.length) return 0;
    const start = performance.now();
    do {
      const key = this.pending.shift();
      this.setChunk(key, this.groups.get(key) || []);
    } while (this.pending.length && performance.now() - start < budgetMs);
    if (!this.pending.length) this.refreshStats();
    return this.pending.length;
  }

  flushAll() {
    while (this.pending.length) this.tick(1e9);
    this.refreshStats();
  }

  lotsIn(key) {
    return (this.groups.get(key) || []).filter((b) => b.id !== this.isolatedId);
  }

  setChunk(key, list) {
    const existing = this.chunks.get(key);
    if (existing) this.drop(existing);
    const filtered = list.filter((b) => b.id !== this.isolatedId);
    if (!filtered.length) {
      this.chunks.delete(key);
      return;
    }
    const mesh = this.makeMesh(filtered);
    mesh.name = `chunk-${key}`;
    this.chunks.set(key, mesh);
    this.root.add(mesh);
  }

  rebuildChunkAt(gx, gz) {
    const key = this.chunkKey(gx, gz);
    const list = this.city
      ? this.city.buildings.filter((b) => this.chunkKey(b.gx, b.gz) === key)
      : [];
    this.groups.set(key, list);
    this.setChunk(key, list);
    this.refreshStats();
  }

  // --- isolation ----------------------------------------------------------
  // While a building is selected it gets its own mesh, so per-module edits
  // rebuild one building instead of a whole chunk.

  isolate(buildingId) {
    if (this.isolatedId === buildingId) return;
    const previous = this.isolatedId;
    this.isolatedId = buildingId;
    if (this.solo) {
      this.drop(this.solo);
      this.solo = null;
    }
    if (previous) {
      const b = this.find(previous);
      if (b) this.rebuildChunkAt(b.gx, b.gz);
    }
    if (buildingId) {
      const b = this.find(buildingId);
      if (b) {
        this.rebuildChunkAt(b.gx, b.gz);
        this.rebuildSolo();
      }
    }
    this.refreshStats();
  }

  rebuildSolo() {
    if (this.solo) {
      this.drop(this.solo);
      this.solo = null;
    }
    const b = this.find(this.isolatedId);
    if (!b) return;
    this.solo = this.makeMesh([b]);
    this.solo.name = 'solo';
    this.root.add(this.solo);
  }

  find(id) {
    return this.city ? this.city.buildings.find((b) => b.id === id) : null;
  }

  // Ghosting swaps which material the meshes point at rather than editing the
  // one they share. Every chunk uses a single material instance, so mutating
  // it to fade the town would fade everything that instance touches and leave
  // nothing to restore from. Meshes made after this still need telling, which
  // is why the flag is remembered.
  setGhost(on) {
    this._ghosted = Boolean(on);
    this.applyGhost();
  }

  applyGhost() {
    const mat = this._ghosted ? this.mat.ghostMaterial : this.mat.material;
    for (const mesh of this.chunks.values()) mesh.material = mat;
    if (this.solo) this.solo.material = mat;
  }

  // --- merging ------------------------------------------------------------

  prepFaces(module, n = slotCount(module.kind, module.blades)) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const f = module.faces[i] || module.faces[0];
      const item = f.image == null ? null : this.pool.get(f.image);
      out.push(item ? { aspect: item.aspect, zoom: f.zoom, panU: f.panU, panV: f.panV } : null);
    }
    return out;
  }

  // One module's geometry, whether the component behind it is a single shape
  // or an assembly of dozens. Merging happens here rather than in the
  // generator because geometry is this file's business, and because an
  // assembly resolved per module is what keeps every instance of a lamp post
  // different from the next.
  shapeFor(m) {
    const doc = this.library?.components.get(m.kind);

    if (doc && isAssembly(doc)) {
      const resolved = resolveComponent(
        doc,
        this.library,
        m.modSeed ?? 0,
        m.modPath || `mod:${m.id}`,
        { w: m.w, h: m.h, d: m.d }
      );
      const shape = mergeResolved(resolved);
      // An assembly has more slots than the module has faces, so the faces
      // repeat across it. A cheap rule, and it keeps a stack of parts reading
      // as one object rather than one painted part and the rest blank.
      const faces = this.prepFaces(m, shape.slots.length);
      return cropFaces(shape, faces, { tile: !!m.matKind });
    }

    const shape = buildShape(m.kind, m.w, m.h, m.d, this.prepFaces(m), {
      blades: m.blades,
      tile: !!m.matKind,
    });
    // A component's modifier stack, run at the one point geometry actually
    // exists. Free when the stack is empty, which is every component nobody
    // has authored yet, so the default town costs nothing for it being here.
    return m.mods ? applyModifiers(shape, m.mods, m.modSeed, m.modPath) : shape;
  }

  makeMesh(buildings) {
    const parts = [];
    let vertices = 0;

    for (let bi = 0; bi < buildings.length; bi++) {
      const b = buildings[bi];
      for (const m of b.modules) {
        const shape = this.shapeFor(m);
        parts.push({ bi, b, m, shape });
        vertices += shape.pos.length / 3;
      }
    }

    const pos = new Float32Array(vertices * 3);
    const nor = new Float32Array(vertices * 3);
    const uv = new Float32Array(vertices * 2);
    const col = new Float32Array(vertices * 3);
    const layer = new Float32Array(vertices);
    // Which material tiles this face, per module rather than per face — a
    // building only ever wears one material, so the whole module reads it.
    // -1 is no material, -2 is the glass shader (no texture, PBR override
    // only), >=0 indexes the material pool.
    const matLayer = new Float32Array(vertices);
    const glowTicket = new Float32Array(vertices);
    const emissive = new Float32Array(vertices * 3);
    // Billboard tickets: scroll, swap, flicker. The shader compares each
    // against a uniform share, so which signs move is scrubbable.
    const anim = new Float32Array(vertices * 3);
    const spin = new Float32Array(vertices * 4);
    // Where the building meets the ground. The wave shader lifts and tilts
    // about this, so a whole stack rides the swell as one piece.
    const baseY = new Float32Array(vertices);
    // Flutter weight, non-zero only along the free edge of a flag.
    const wind = new Float32Array(vertices);

    const triangles = vertices / 3;
    const pickBuilding = new Uint16Array(triangles);
    const pickModule = new Uint16Array(triangles);
    const pickSlot = new Uint8Array(triangles);

    let v = 0;
    for (const { bi, b, m, shape } of parts) {
      // Both turns collapse into one angle, then the bend tilt is layered on
      // top in world space. Small angles, so a linearised tilt is enough and
      // avoids a full matrix per vertex.
      const angle = (m.rotY || 0) + (b.rotY || 0);
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const bx = m.bendX || 0;
      const bz = m.bendZ || 0;
      const tx = m.tiltX || 0;
      const tz = m.tiltZ || 0;
      const tilted = tx !== 0 || tz !== 0;
      // Lean the module about its own centre. Rotation about X by tx sends +Y
      // toward +Z, about Z by tz sends +Y toward -X.
      const cx = Math.cos(tx);
      const sx = Math.sin(tx);
      const cz = Math.cos(tz);
      const sz = Math.sin(tz);
      const ox = b.x + bx;
      const oy = (b.y || 0) + m.y;
      const oz = b.z + bz;

      const labels = slotLabels(m.kind, m.blades);
      // Emissive is written as if lit. The shader decides whether it is, by
      // comparing the ticket against the global chance.
      const strength = m.glowStrength ?? 1;
      const ticket = m.glowTicket ?? 2;
      const glowColor = this._color.set(m.glowColor || '#ffcc66');
      const gr = glowColor.r * strength;
      const gg = glowColor.g * strength;
      const gb = glowColor.b * strength;
      const [an0, an1, an2] = m.anim || [1, 1, 1];
      // Whole-module, not per-face: a building wears one material at most, so
      // every eligible module in it reads the same index. -2 is the glass
      // shader, -3 is the mirror shader, neither backed by a texture.
      const matIndex =
        m.matKind === 'material' ? m.matIndex ?? 0 : m.matKind === 'glass' ? -2 : m.matKind === 'mirror' ? -3 : -1;

      shape.slots.forEach((slot, si) => {
        const face = m.faces[si] || m.faces[0];
        const count = this.pool.length;
        const layerIndex =
          matIndex !== -1 || face.image == null || !count
            ? -1
            : ((face.image % count) + count) % count;
        const c = this._color.set(
          layerIndex >= 0 || matIndex !== -1 ? '#ffffff' : face.color || '#cccccc'
        );
        const cr = c.r;
        const cg = c.g;
        const cb = c.b;
        // The axle of a spinning module stays put while its cards turn.
        const speed = labels[si] === 'axle' ? 0 : m.spinSpeed || 0;

        for (let i = slot.start; i < slot.start + slot.count; i++) {
          const px = shape.pos[i * 3];
          const py = shape.pos[i * 3 + 1];
          const pz = shape.pos[i * 3 + 2];
          const nx = shape.nor[i * 3];
          const ny = shape.nor[i * 3 + 1];
          const nz = shape.nor[i * 3 + 2];
          const k = v * 3;
          let rx = ca * px + sa * pz;
          let ry = py;
          let rz = -sa * px + ca * pz;
          let mx = ca * nx + sa * nz;
          let my = ny;
          let mz = -sa * nx + ca * nz;
          if (tilted) {
            // Rz then Rx, applied to both the point and its normal.
            let a = cz * rx - sz * ry;
            let bqy = sz * rx + cz * ry;
            rx = a;
            ry = cx * bqy - sx * rz;
            rz = sx * bqy + cx * rz;
            a = cz * mx - sz * my;
            const nyy = sz * mx + cz * my;
            mx = a;
            my = cx * nyy - sx * mz;
            mz = sx * nyy + cx * mz;
          }
          pos[k] = rx + ox;
          pos[k + 1] = ry + oy;
          pos[k + 2] = rz + oz;
          nor[k] = mx;
          nor[k + 1] = my;
          nor[k + 2] = mz;
          col[k] = cr;
          col[k + 1] = cg;
          col[k + 2] = cb;
          emissive[k] = gr;
          emissive[k + 1] = gg;
          emissive[k + 2] = gb;
          anim[k] = an0;
          anim[k + 1] = an1;
          anim[k + 2] = an2;
          uv[v * 2] = shape.uv[i * 2];
          uv[v * 2 + 1] = shape.uv[i * 2 + 1];
          layer[v] = layerIndex;
          matLayer[v] = matIndex;
          glowTicket[v] = ticket;
          spin[v * 4] = ox;
          spin[v * 4 + 1] = oy;
          spin[v * 4 + 2] = oz;
          spin[v * 4 + 3] = speed;
          baseY[v] = b.y || 0;
          wind[v] = shape.wind ? shape.wind[i] : 0;

          if (v % 3 === 0) {
            const t = v / 3;
            pickBuilding[t] = bi;
            pickModule[t] = m.index;
            pickSlot[t] = si;
          }
          v++;
        }
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aLayer', new THREE.BufferAttribute(layer, 1));
    geo.setAttribute('aMatLayer', new THREE.BufferAttribute(matLayer, 1));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(glowTicket, 1));
    geo.setAttribute('aEmissive', new THREE.BufferAttribute(emissive, 3));
    geo.setAttribute('aAnim', new THREE.BufferAttribute(anim, 3));
    geo.setAttribute('aSpin', new THREE.BufferAttribute(spin, 4));
    geo.setAttribute('aBaseY', new THREE.BufferAttribute(baseY, 1));
    geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 1));
    geo.computeBoundingSphere();
    // Spinning modules sweep past their resting bounds and waves lift the
    // whole town, so give culling generous slack.
    if (geo.boundingSphere) geo.boundingSphere.radius *= 1.3;

    const mesh = new THREE.Mesh(geo, this._ghosted ? this.mat.ghostMaterial : this.mat.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = this.mat.depthMaterial;
    mesh.userData = {
      buildingIds: buildings.map((b) => b.id),
      pickBuilding,
      pickModule,
      pickSlot,
    };
    return mesh;
  }

  // Resolve a raycast hit back to the data that made it.
  resolve(intersection) {
    const data = intersection.object.userData;
    if (!data || !data.pickBuilding) return null;
    const t = intersection.faceIndex;
    if (t == null || t >= data.pickBuilding.length) return null;
    const buildingId = data.buildingIds[data.pickBuilding[t]];
    const moduleIndex = data.pickModule[t];
    const building = this.find(buildingId);
    if (!building) return null;
    const module = building.modules[moduleIndex];
    if (!module) return null;
    return { buildingId, moduleId: module.id, slot: data.pickSlot[t] };
  }

  refreshStats() {
    let triangles = 0;
    let modules = 0;
    const count = (mesh) => {
      triangles += mesh.geometry.attributes.position.count / 3;
    };
    this.chunks.forEach(count);
    if (this.solo) count(this.solo);
    if (this.city) modules = this.city.buildings.reduce((n, b) => n + b.modules.length, 0);
    this.stats = {
      chunks: this.chunks.size + (this.solo ? 1 : 0),
      modules,
      triangles: Math.round(triangles),
    };
  }

  update(elapsed) {
    this.mat.setTime(elapsed);
  }
}
