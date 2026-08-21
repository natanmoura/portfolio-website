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
import { CLOUDS_GLSL } from './clouds.js';
import { shaderVersion } from './pcss.js';
import { ribbonEdges, ribbonTriangles } from './curve.js';
import { landformRaster } from './landform.js';
import { isRaised, raisedPoints, GROUNDED } from './elevation.js';

// One column, as a cylinder. No caps: the top is under a road deck and the
// bottom is half a metre into the ground, so neither is ever seen, and two
// fans per pier across a whole viaduct is geometry paid for and never looked
// at.
//
// **Normals are per vertex and radial, which is the whole of the difference
// between a cylinder and a post.** The first version gave each quad one
// normal, on the theory that a few flat faces catching different light reads
// as cast concrete — and at the thickness these actually want, it reads as a
// hexagonal pencil instead. A radial normal per vertex makes the light wrap,
// so twelve sides is enough to look round at any distance the town is viewed
// from and the silhouette does the rest.
const COLUMN_SIDES = 12;

function cylinder(pos, nor, cx, cz, bottom, top, radius) {
  for (let s = 0; s < COLUMN_SIDES; s++) {
    const a0 = (s / COLUMN_SIDES) * Math.PI * 2;
    const a1 = ((s + 1) / COLUMN_SIDES) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    const x0 = cx + c0 * radius;
    const z0 = cz + s0 * radius;
    const x1 = cx + c1 * radius;
    const z1 = cz + s1 * radius;
    pos.push(x0, bottom, z0, x1, bottom, z1, x1, top, z1);
    nor.push(c0, 0, s0, c1, 0, s1, c1, 0, s1);
    pos.push(x0, bottom, z0, x1, top, z1, x0, top, z0);
    nor.push(c0, 0, s0, c1, 0, s1, c0, 0, s0);
  }
}

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

// How finely a road is subdivided to follow the ground, in metres. Close to
// the ground mesh's own cell size, since that is the finest shape the terrain
// can express and there is nothing below it worth chasing.
const DRAPE_STEP = 1.5;


// The ground rides the same water as the buildings, using the same uniforms
// — and, where `withClouds` is set, sits under the same drifting shadow. The
// grid lines skip it: they are unlit already, so a term that darkens surface
// colour has nothing to act on there.
function patchWaves(material, withNormals, withClouds = false) {
  material.onBeforeCompile = (shader) => {
    Object.entries(shared).forEach(([k, v]) => {
      shader.uniforms[k] = v;
    });
    const cloudDecl = withClouds ? `${CLOUDS_GLSL}\nvarying float vCloud;\n` : '';
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `uniform float uTime;\n${WAVE_GLSL}\n${cloudDecl}void main() {`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.y += ccWaveAt(position.xz);
         ${withClouds ? 'vCloud = ccCloudAt(position.xz);' : ''}`
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
    if (withClouds) {
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying float vCloud;\nvoid main() {')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           diffuseColor.rgb *= vCloud;`
        );
    }
  };
  material.customProgramCacheKey = () =>
    (withNormals ? 'ground-' : 'grid-') + (withClouds ? 'cloud-' : '') + shaderVersion();
}

export class Ground {
  constructor() {
    this.material = new THREE.MeshStandardMaterial({
      color: '#c2bcab',
      roughness: 1,
      metalness: 0,
    });
    patchWaves(this.material, true, true);

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
    patchWaves(this.roadMaterial, true, true);
    this.roads = new THREE.Mesh(new THREE.BufferGeometry(), this.roadMaterial);
    this.roads.receiveShadow = true;

<<<<<<< Updated upstream
=======
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
    // The piers under a raised road. Its own material rather than the road's,
    // for one reason that matters: the tarmac carries a polygon offset so it
    // does not fight the ground for the same pixels, and a column is a solid
    // standing *in* the ground — pushed forward by the same offset it would
    // z-fight the terrain it is planted in. Same colour, kept in step by
    // `setRoadColor`, which is what "the columns match the road" means here.
    this.columnMaterial = new THREE.MeshStandardMaterial({
      color: '#2a2723',
      roughness: 0.9,
      metalness: 0,
    });
<<<<<<< Updated upstream
    patchWaves(this.columnMaterial, true);
=======
    patchWaves(this.columnMaterial, true, true);
>>>>>>> Stashed changes
    this.columns = new THREE.Mesh(new THREE.BufferGeometry(), this.columnMaterial);
    this.columns.castShadow = true;
    this.columns.receiveShadow = true;

<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
>>>>>>> Stashed changes
    this.group = new THREE.Group();
    this.group.add(this.mesh, this.roads, this.columns, this.grid);

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
    // Drawn ground answers entirely from its own raster, and none of the hill
    // parameters reach it.
    //
    // Terracing used to be applied here, after both branches, on the reasoning
    // that it is a property of a *surface* rather than of how the surface was
    // made. That was wrong in the way that matters: it meant one slider in the
    // Terrain panel silently restepped every shape somebody had drawn, and
    // there was no way to terrace one mesa and leave another smooth. A
    // landform carries its own terracing now — and its own roughness, which
    // the global controls never offered it at all. See landform.js.
    if (this.mode === DRAWN) return this.raster ? this.raster.sample(x, z) : 0;

    let h = this.amplitude > 0
      ? fbm2D(this.seed, x * this.frequency, z * this.frequency, this.octaves) * this.amplitude
      : 0;
    // Rounding rather than flooring, so the stepped surface sits on the same
    // average level as the smooth one it replaced instead of sinking by half
    // a step.
    if (this.step > 0) h = Math.round(h / this.step) * this.step;
    return h;
  }

  // How steep the ground is here, in degrees from horizontal.
  //
  // Central differences over a fixed baseline rather than an analytic
  // derivative, because there is no analytic form to differentiate: drawn
  // ground is a raster and terracing is a rounding step, neither of which has
  // a gradient in the calculus sense. Sampling is also the honest answer for
  // what this is used for — a building asks "is the ground under my footprint
  // too steep to stand on", which is a question about a patch of ground, not
  // about a point.
  //
  // The baseline is a metre and a half: fine enough to catch a cliff face,
  // coarse enough that the one-cell riser a terrace leaves behind does not
  // read as a vertical wall everywhere.
  slopeAt(x, z, span = 1.5) {
    if (this.mode !== DRAWN && this.amplitude <= 0 && this.step <= 0) return 0;
    const dx = (this.heightAt(x + span, z) - this.heightAt(x - span, z)) / (2 * span);
    const dz = (this.heightAt(x, z + span) - this.heightAt(x, z - span)) / (2 * span);
    return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
  }

  // The surface normal, from the same two differences. Nothing uses it yet;
  // it is here because it is three lines given `slopeAt` exists, and the
  // first thing that wants to lie flat on a hillside rather than merely stand
  // on it will need exactly this.
  normalAt(x, z, span = 1.5) {
    const dx = (this.heightAt(x + span, z) - this.heightAt(x - span, z)) / (2 * span);
    const dz = (this.heightAt(x, z + span) - this.heightAt(x, z - span)) / (2 * span);
    const len = Math.hypot(dx, 1, dz) || 1;
    return { x: -dx / len, y: 1 / len, z: -dz / len };
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
    // Whether the ground under the town moves at all. Terracing counts even
    // at zero relief, because a riser is a cliff however short the hill is.
    const drapes = this.relief > 0 || this.step > 0;
    // Where each raised road actually runs, collected as it is drawn so the
    // columns underneath can be stood up against the same numbers the deck
    // was built from rather than against a second evaluation that could
    // drift from it by a millimetre and leave daylight under the road.
    const decks = [];

    for (const road of roads || []) {
      const pts = road.pts;
      if (!pts || pts.length < 2) continue;
      // A ring road arrives with its last point on top of its first, which
      // `ribbonEdges` closes into a loop with no seam at the arbitrary place
      // it happened to start.
      const closed =
        pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6;

      // **Every road is drawn from a subdivided copy of itself, raised or
      // not.** A road's control points are junctions, not samples: a grid road
      // has exactly two, both at the edge of town, so a ribbon built from them
      // spans the whole run with a single flat quad. On level ground that is
      // invisible and it is why this went unnoticed for so long. Over a hill
      // it is a road that ignores the hill, and over a drawn cliff it is a
      // road that passes clean through it and comes out the other side.
      //
      // Adding the points to `road.pts` instead is not an option — that
      // renames the road and every building on it (see `roadId` in layout.js)
      // — so the subdivision lives here, for the length of one draw call, and
      // nothing derives an id from it.
      // On ground that genuinely never moves, the subdivision is skipped and
      // the control points are used exactly as before — `Infinity` makes
      // `raisedPoints` emit one step per segment. That is not an
      // optimisation for its own sake: it keeps a flat town's tarmac
      // byte-identical to what it always was, and it stops a two-kilometre
      // road in a very large flat town paying for a thousand vertices that
      // would all land on the same plane.
      const dense = raisedPoints(
        road,
        drapes || isRaised(road) ? DRAPE_STEP : Infinity,
        (x, z) => this.heightAt(x, z)
      );
      const flat = dense.map((p) => [p[0], p[1]]);
      const edges = ribbonEdges(flat, road.width / 2, closed);
      // Two answers, blended by how far off the ground the road is.
      //
      // On the ground, an edge asks the terrain its own question, which is
      // what lets tarmac follow a slope sideways as well as lengthwise. Off
      // the ground, it takes the centreline's absolute surface height — a
      // deck is a flat thing, and letting its edges chase the terrain under a
      // viaduct would twist it into a ribbon following the ravine it is
      // supposed to be crossing.
      //
      // **Whichever is higher, and no test between them.** Choosing per vertex
      // is what produced the notches: a hard `lift > GROUNDED` puts
      // neighbouring vertices on opposite sides of it wherever a road lifts
      // off, and the two answers do not meet there — the deck is one height
      // all the way across while a draped edge is wherever its own terrain
      // happens to be, so on a cross-slope they differ by however far the hill
      // falls over half a road width. That drew thin V-shaped notches hanging
      // off the tarmac into the hillside: fourteen triangles with a 4.66m
      // drop, one vertex 1.26m above its ground beside two still pinned at
      // the z-fight epsilon.
      //
      // Fading between the two over the first metre of lift is the obvious
      // repair and is worse — sixty-two notches instead of fourteen. The
      // reason is worth keeping: `lift` is `surface - ground`, and on steep
      // ground it is the *ground* term that jumps, so the blend factor is
      // every bit as discontinuous as the thing it was meant to smooth. You
      // cannot fade between two answers using a number that is itself
      // jumping.
      //
      // The maximum needs no such number. It is continuous because both
      // arguments are, it can never put tarmac under the terrain, and it says
      // something true: a road surface is flat across its width, so where the
      // ground rises under one edge the road stays level and the hill meets
      // it, rather than the road bending into the hill.
      const { pos: p2, nor: n2 } = ribbonTriangles(edges, (p, i) => {
        const here = this.heightAt(p[0], p[1]);
        const src = dense[Math.min(dense.length - 1, i)];
        return (src && src[3] > here ? src[3] : here) + lift;
      });
      pos.push(...p2);
      nor.push(...n2);
      if (isRaised(road)) decks.push({ road, dense });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.computeBoundingSphere();
    if (geo.boundingSphere) geo.boundingSphere.radius += (params.waveHeight || 0) + 1;
    this.roads.geometry = geo;

    this.setColumns(decks, params, lift);
  }

  // What holds a raised road up.
  //
  // One thin prism per bent, from the ground to the underside of the deck.
  // Deliberately the plainest thing that reads as structure: a pier is a
  // component-library job — a trestle, a concrete Y, a steel lattice — and
  // this is the one that has to exist first so that a road in the air is not
  // a road floating in the air. It takes the road's own colour, because a
  // viaduct and its deck being the same material is both true of most of them
  // and the only answer that needs no second control.
  setColumns(decks, params, deckLift) {
    this.columns.geometry.dispose();
    const pos = [];
    const nor = [];
    const spacing = Math.max(2, params.roadColumnSpacing || 8);
    // One thickness for every pier in the town rather than scaling with the
    // road. A highway is held up by two and a street by one, so letting the
    // wide road also have fat columns would say the same thing twice and
    // blunt the distinction the count is already making.
    const radius = Math.max(0.02, (params.roadColumnWidth ?? 0.25) / 2);

    for (const { road, dense } of decks) {
      // Arc length along the drawn centreline, so bents land at genuinely
      // equal intervals. Walking vertices instead would crowd them wherever a
      // short segment got subdivided, since the subdivision is per segment.
      const run = [0];
      for (let i = 1; i < dense.length; i++) {
        run.push(run[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
      }
      const total = run[run.length - 1];
      if (!(total > 0)) continue;

      // A whole number of bays across the whole road, so the spacing comes out
      // exact and the end bents sit at the ends — rather than wherever the
      // walk happened to have accumulated a full span, which put the first
      // one at an arbitrary offset and left a ragged gap at the far end.
      const bays = Math.max(1, Math.round(total / spacing));
      // **A highway stands on a pair, one under each edge of its deck; a
      // street stands on a single pier down the middle of its own path.**
      // That is the whole difference between them, and it is enough: two thin
      // legs under a wide deck reads as a viaduct, where one under the middle
      // of it would read as a plank balanced on a stick.
      const pair = Boolean(road.main);
      const offset = pair ? Math.max(0, road.width / 2 - radius * 1.6) : 0;

      for (let b = 0; b <= bays; b++) {
        const d = (total * b) / bays;
        let i = 1;
        while (i < run.length - 1 && run[i] < d) i++;
        const a = dense[i - 1];
        const c = dense[i];
        const span = Math.max(1e-6, run[i] - run[i - 1]);
        const t = Math.min(1, Math.max(0, (d - run[i - 1]) / span));
        const x = a[0] + (c[0] - a[0]) * t;
        const z = a[1] + (c[1] - a[1]) * t;
        // Nothing to hold up where the deck is already on the ground, which is
        // most of a ramp and all of a road that only rises in the middle.
        if (a[2] + (c[2] - a[2]) * t <= GROUNDED) continue;
        // Top from the deck's own surface height rather than recomputed from
        // the ground, so a pier always meets the underside of the road it is
        // holding up instead of ending a little under or through it.
        const top = a[3] + (c[3] - a[3]) * t + deckLift;

        // Across the road, from the direction of travel here.
        const dx = c[0] - a[0];
        const dz = c[1] - a[1];
        const len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;

        for (const side of pair ? [-1, 1] : [0]) {
          const px = x + nx * offset * side;
          const pz = z + nz * offset * side;
          cylinder(pos, nor, px, pz, this.heightAt(px, pz) - 0.5, top, radius);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.computeBoundingSphere();
    if (geo.boundingSphere) geo.boundingSphere.radius += (params.waveHeight || 0) + 1;
    this.columns.geometry = geo;
  }

  setRoadsVisible(on) {
    this.roads.visible = on;
    this.columns.visible = on;
  }

  setRoadColor(color) {
    this.roadMaterial.color.copy(color);
    // Slightly deeper than the deck. Exactly the same colour reads as one flat
    // silhouette from any distance, since a column and the road above it are
    // never separated by anything; a shade down is still plainly the same
    // material and lets the two be told apart.
    this.columnMaterial.color.copy(color).multiplyScalar(0.82);
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
