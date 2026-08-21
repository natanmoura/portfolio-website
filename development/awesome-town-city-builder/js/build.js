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
import { resolveComponent, mergeResolved } from './library.js';

const CHUNK = 4; // lots per side

// What a chunk drew, cheaply enough to compute every rebuild without being
// the thing that makes rebuilding slow.
//
// Every building here is already plain, JSON-safe data — nothing this
// project's generator returns holds a function or a cycle — so stringifying
// it is the correct answer to "did anything about this change", not an
// approximation of one: it covers every field `makeMesh` reads without this
// file having to know what all of them are or keep the list in sync by hand
// as new ones are added. Sorted by id first, so two buildings arriving in a
// different order — which the claims-priority pass in `placeSites` can
// produce — reads as unchanged rather than as a false positive.
function chunkSignature(list) {
  const sorted = [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return JSON.stringify(sorted);
}

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
    // A cheap fingerprint of what each chunk last drew, so `build()` can tell
    // a chunk whose buildings resolved to the exact same data from one that
    // genuinely changed. See the comment on `build()`.
    this.signatures = new Map();
  }

  chunkKey(gx, gz) {
    return `${Math.floor(gx / CHUNK)}_${Math.floor(gz / CHUNK)}`;
  }

  clear() {
    for (const mesh of this.chunks.values()) this.drop(mesh);
    this.chunks.clear();
    this.groups.clear();
    this.signatures.clear();
    this.pending.length = 0;
    if (this.solo) this.drop(this.solo);
    this.solo = null;
  }

  drop(mesh) {
    mesh.geometry.dispose();
    mesh.removeFromParent();
  }

  // Queue changed chunks for remeshing rather than doing it in one go, and —
  // the point of this rewrite — rather than queuing *every* chunk regardless
  // of whether anything in it actually changed.
  //
  // A full `generateCity()` runs every rebuild, and most of what it produces
  // is the same data it produced last time: nudging a slider that never
  // touches roads, editing one held road on the far side of town, toggling a
  // layer — all of these leave the overwhelming majority of buildings
  // byte-identical to before. Queuing every chunk anyway meant tearing down
  // and rebuilding meshes that were already correct, which is wasted GPU
  // work and, worse, a visible flash across the whole town for a change that
  // touched one corner of it.
  //
  // So each chunk gets a cheap fingerprint of the data it last drew from, and
  // only chunks whose fingerprint changed go in the queue. A chunk's mesh
  // that is not queued is not touched at all — still the same three.js
  // object, still on screen, because it is still correct.
  //
  // This does not manufacture stability that is not really there. Moving a
  // boundary point reclips every road that crosses one of its two adjacent
  // edges, which for a full-span pattern (grid, boulevard, radial) is
  // typically every road in town — their ids change, their tickets change,
  // and the fingerprint correctly says so. What this fixes is the case where
  // the *data* did not change: it stops that case from paying the cost of
  // the case where it did.
  build(city) {
    this.city = city;
    const groups = new Map();
    for (const b of city.buildings) {
      const key = this.chunkKey(b.gx, b.gz);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }

    const changed = [];
    for (const [key, list] of groups) {
      const sig = chunkSignature(list);
      if (this.signatures.get(key) !== sig) {
        changed.push(key);
        this.signatures.set(key, sig);
      }
    }

    for (const key of [...this.chunks.keys()]) {
      if (!groups.has(key)) {
        this.drop(this.chunks.get(key));
        this.chunks.delete(key);
        this.signatures.delete(key);
      }
    }

    this.groups = groups;
    this.pending = changed;
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
    // Recorded here too, or the next full `build()` would compare against a
    // fingerprint taken before this targeted rebuild and queue this chunk
    // again for no reason — not wrong, since redrawing it a second time still
    // draws the right thing, just the exact waste this file exists to avoid.
    this.signatures.set(key, chunkSignature(list));
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
  // Every module resolves through the library now, leaf or assembly — a box
  // is `box.json`, not a name a hardcoded switch happens to recognise. The
  // fallback below, calling `buildShape` directly, exists only for a `kind`
  // the library genuinely does not have: still loading, or a scene naming a
  // component that was since renamed or removed. That is the one case
  // nothing here can resolve honestly, so it draws the best guess it always
  // drew rather than nothing.
  //
  // The library and the city disagree about where a component's own zero
  // is, on purpose: a component previewed on its own sits with its base at
  // the floor, which is what an editor or a thumbnail wants, while a module
  // in a stack is positioned by its centre (`restack` in generate.js sets
  // `m.y` to the middle of where it sits). Reconciling that here, once, is
  // what makes the switch invisible everywhere else. For a single-piece
  // result — every leaf, and it is what most modules are — the exact
  // correction is the lift `resolveComponent` itself recorded when it stood
  // the piece up: subtracting it exactly restores the geometry `buildShape`
  // would have produced directly, provably so (`tools/geom-diff.mjs` checks
  // this for every default shape). An assembly has no single piece to read a
  // lift from — its composed result is already based at zero by
  // construction, the way each of its own children already is — so it is
  // recentred using its own resolved height instead, which is the same
  // assumption `restack` already makes for everything else.
  shapeFor(m) {
    const doc = this.library?.components.get(m.kind);
    if (doc) {
      const resolved = resolveComponent(
        doc,
        this.library,
        m.modSeed ?? 0,
        m.modPath || `mod:${m.id}`,
        // `fit` is the uniform scale generate.js already worked out from the
        // measuring stick, carried across rather than derived again — the two
        // resolves have to agree exactly or the triangles come out a different
        // size from the bounds every other system was told about. An assembly
        // ignores the `w`/`h`/`d` beside it whenever a fit is present; a leaf
        // has no use for the fit and reads only those.
        { fit: m.fitScale, w: m.w, h: m.h, d: m.d, blades: m.blades }
      );
      const drop = resolved.pieces.length === 1 ? resolved.pieces[0].offset[1] : resolved.bounds.h / 2;
      const merged = mergeResolved(resolved);
      if (drop) {
        for (let i = 1; i < merged.pos.length; i += 3) merged.pos[i] -= drop;
      }
      // How many slots this actually turned out to have. Nothing upstream can
      // know it — an assembly's slot count only exists once its parts have
      // been resolved and merged — so it is stamped back onto the module for
      // the inspector to read. Without it the panel offers a cube's six faces
      // for an object with fifty-six.
      m.slotCount = merged.slots.length;
      // More slots than the module has faces repeats the faces across them,
      // rather than one painted face and the rest blank — true for a
      // primitive with several faces same as it is for a fifty-six-slot
      // assembly.
      const faces = this.prepFaces(m, merged.slots.length);
      return cropFaces(merged, faces, { tile: !!m.matKind });
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
        //
        // A slot that carries its own speed is a piece of an assembly that was
        // given a spin of its own, and it turns about its own axis rather than
        // the module's centre — that is what keeps a spin pinned on the lamp
        // of a lamp-post from taking the post round with it. Everything else
        // falls back to the module-wide spin, which is still how a spinner's
        // cards all turn together.
        const ownSpin = Number.isFinite(slot.spinSpeed) ? slot.spinSpeed : null;
        const speed = labels[si] === 'axle' ? 0 : ownSpin !== null ? ownSpin : m.spinSpeed || 0;
        // **The axis stays the module's own centre, and that is a deliberate
        // limit rather than an oversight.** `aSpin.xz` is read twice: as the
        // axle to turn about, and by `WAVE_BODY` as the anchor a module is
        // lifted and tilted around, which is what makes a stack ride the swell
        // as one rigid body instead of shearing apart. Giving a piece its own
        // axle here would also give it its own wave anchor, so on water the
        // parts of one module would start pulling away from each other.
        //
        // It costs nothing for the arrangement this is actually wanted on: a
        // stacked assembly places every part on x = z = 0, so a part's own
        // axle *is* the module's centre and the two answers agree exactly. It
        // only diverges for an arrangement that spreads parts sideways — a
        // ring, a grid, a scatter — where a spinning part would orbit the
        // module's middle rather than turn on the spot. Fixing that properly
        // means a second attribute for the axle so the wave can keep its own
        // anchor, which is a real change and not one to make blind.

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
