// Traffic.
//
// Two instanced meshes, one per shape, both sharing a material. Cars carry a
// per-vertex part tag so the same instance can have a body in its own colour,
// a headlamp cap lit that colour, and a tail cap lit a hot palette red. Nothing
// here takes a collage image: a car is a silhouette and a pair of lights.
//
// Ground cars sit on the tarmac and follow their road exactly. Flyers take the
// same roads as flight corridors, because the open air above a street is where
// there is room, then weave off the centreline and drift in height.

import * as THREE from 'three';
import { Rng } from './rng.js';
import { waveAt } from './wave.js';
import { shaderVersion } from './pcss.js';
import { liftAt } from './elevation.js';

// --- shapes ----------------------------------------------------------------

class Mesh {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.part = [];
  }
  tri(a, b, c, part) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) {
      this.nor.push(nx, ny, nz);
      this.part.push(part);
    }
  }
  quad(a, b, c, d, part) {
    this.tri(a, b, c, part);
    this.tri(a, c, d, part);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    const count = this.pos.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 1));
    // White vertex colours exist only so three applies instanceColor: with
    // USE_INSTANCING_COLOR alone the fragment stage never multiplies it in.
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(count * 3).fill(1), 3));
    g.computeBoundingSphere();
    return g;
  }
}

// A capsule lying on its side. Nose cap is part 1, tail cap part 2.
// Two long, one wide, half a unit tall, to match the boxes.
function pillGeometry() {
  const m = new Mesh();
  const r = 0.5;
  const body = 1.0;
  const squash = 1; // round in section, not flattened
  const seg = 20;
  const caps = 6;
  const rings = [];
  for (let i = 0; i <= caps; i++) {
    const a = (i / caps) * (Math.PI / 2);
    rings.push({ x: -body / 2 - r * Math.cos(a), rad: r * Math.sin(a), part: 2 });
  }
  rings.push({ x: body / 2, rad: r, part: 0 });
  for (let i = 1; i <= caps; i++) {
    const a = (Math.PI / 2) * (1 - i / caps);
    rings.push({ x: body / 2 + r * Math.cos(a), rad: r * Math.sin(a), part: 1 });
  }

  const at = (ring, k) => {
    const a = (k / seg) * Math.PI * 2;
    return [ring.x, Math.sin(a) * ring.rad * squash, Math.cos(a) * ring.rad];
  };
  for (let i = 0; i < rings.length - 1; i++) {
    // The quad belongs to whichever end it is closest to.
    const part = i < caps ? 2 : i === caps ? 0 : 1;
    const lo = rings[i];
    const hi = rings[i + 1];
    for (let k = 0; k < seg; k++) {
      // A ring of zero radius is a point, so fan to it rather than emitting a
      // quad with two coincident corners and an undefined normal.
      if (lo.rad < 1e-6) m.tri(at(hi, k), at(hi, k + 1), at(lo, k), part);
      else if (hi.rad < 1e-6) m.tri(at(hi, k), at(lo, k + 1), at(lo, k), part);
      else m.quad(at(hi, k), at(hi, k + 1), at(lo, k + 1), at(lo, k), part);
    }
  }
  return m.geometry();
}

// A plain box, two units long by one wide by half a unit tall. The two square
// ends are the lamps: nose lit its own colour, tail lit red.
function boxGeometry() {
  const m = new Mesh();
  const L = 2;
  const W = 1;
  const H = 0.5;
  const fr = L / 2;
  const bk = -L / 2;
  const y0 = -H / 2;
  const y1 = H / 2;
  const P = (x, y, z) => [x, y, z];

  const FLb = P(fr, y0, -W / 2);
  const FRb = P(fr, y0, W / 2);
  const BLb = P(bk, y0, -W / 2);
  const BRb = P(bk, y0, W / 2);
  const FLt = P(fr, y1, -W / 2);
  const FRt = P(fr, y1, W / 2);
  const BLt = P(bk, y1, -W / 2);
  const BRt = P(bk, y1, W / 2);

  // Counter-clockwise seen from outside each face. Reversed from the obvious
  // corner order, which points every normal into the car and lights it as if
  // it were inside out.
  m.quad(FLt, FRt, FRb, FLb, 1); // nose, +X
  m.quad(BRt, BLt, BLb, BRb, 2); // tail, -X
  m.quad(FRt, BRt, BRb, FRb, 0); // +Z
  m.quad(BLt, FLt, FLb, BLb, 0); // -Z
  m.quad(BLt, BRt, FRt, FLt, 0); // top
  m.quad(FLb, FRb, BRb, BLb, 0); // bottom
  return m.geometry();
}

// --- material --------------------------------------------------------------

function trafficMaterial(uniforms) {
  // Opaque on purpose. Blending an instanced mesh cannot sort its own cars
  // against each other, which is what made them look like ghosts. The fade is
  // done by dropping pixels on an ordered pattern instead, which keeps depth
  // correct and reads as a dissolve at the size a car is on screen.
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    metalness: 0.1,
  });
  material.onBeforeCompile = (shader) => {
    Object.entries(uniforms).forEach(([k, v]) => {
      shader.uniforms[k] = v;
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `attribute float aPart;
         attribute float aFade;
         flat varying float vPart;
         flat varying float vFade;
         void main() {`
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPart = aPart;\n  vFade = aFade;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `flat varying float vPart;
         flat varying float vFade;
         uniform vec3 uTail;
         uniform float uHead;
         uniform float uTailGlow;
         const float CAR_BAYER[16] = float[16](
           0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
           3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0
         );
         void main() {
           if (vFade < 0.999) {
             int bx = int(mod(gl_FragCoord.x, 4.0));
             int by = int(mod(gl_FragCoord.y, 4.0));
             if (vFade < (CAR_BAYER[by * 4 + bx] + 0.5) / 16.0) discard;
           }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `// Headlamps burn the car's own colour, tail lamps a hot palette red.
         vec3 ccLamp = vec3(0.0);
         if (vPart > 1.5) ccLamp = uTail * uTailGlow;
         else if (vPart > 0.5) ccLamp = vColor * uHead;
         totalEmissiveRadiance = ccLamp;`
      );
  };
  material.customProgramCacheKey = () => 'awesome-town-traffic-' + shaderVersion();
  return material;
}

// --- routes ----------------------------------------------------------------

// A polyline with cumulative lengths, so a car can be placed by distance
// travelled rather than by walking segments every frame.
function makeRoute(road, id) {
  const pts = road.pts;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  // The road itself comes along so a car can ask how high its deck is at the
  // distance it has travelled. Cars have always sat on the terrain directly,
  // which is right up until the road leaves it and they keep driving through
  // the valley the viaduct crosses.
  return { id, pts, cum, road, length: cum[cum.length - 1], width: road.width, main: road.main, exits: [[], []] };
}

// Nearest point on a route to somewhere, as an arclength. Used to work out
// where a car joins the road it is turning onto.
function nearestOn(route, px, pz) {
  let best = Infinity;
  let at = 0;
  for (let i = 1; i < route.pts.length; i++) {
    const a = route.pts[i - 1];
    const b = route.pts[i];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
    if (d < best) {
      best = d;
      at = route.cum[i - 1] + t * Math.sqrt(len2);
    }
  }
  return { dist: best, at };
}

function sampleRoute(route, distance, out) {
  const total = route.length;
  if (total <= 0) return false;
  let d = distance % total;
  if (d < 0) d += total;
  // Segments are few, and a linear scan beats keeping an index in sync.
  let i = 1;
  while (i < route.cum.length - 1 && route.cum[i] < d) i++;
  const a = route.pts[i - 1];
  const b = route.pts[i];
  const segLen = Math.max(1e-5, route.cum[i] - route.cum[i - 1]);
  const t = (d - route.cum[i - 1]) / segLen;
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[1] + (b[1] - a[1]) * t;
  out.angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  out.lift = route.road ? liftAt(route.road, d) : 0;
  return true;
}

// --- system ----------------------------------------------------------------

const MAX_CARS = 1200;

export class Traffic {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    this.uniforms = {
      uTail: { value: new THREE.Color('#ff2a1a') },
      uHead: { value: 0.4 },
      uTailGlow: { value: 0.8 },
    };
    this.material = trafficMaterial(this.uniforms);

    this.pill = new THREE.InstancedMesh(pillGeometry(), this.material, MAX_CARS);
    this.box = new THREE.InstancedMesh(boxGeometry(), this.material, MAX_CARS);
    for (const mesh of [this.pill, this.box]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CARS * 3), 3);
      const fade = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CARS).fill(1), 1);
      fade.setUsage(THREE.DynamicDrawUsage);
      mesh.geometry.setAttribute('aFade', fade);
      this.group.add(mesh);
    }

    this.cars = [];
    this.routes = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._hit = { x: 0, z: 0, angle: 0 };
  }

  // Rebuilt whenever the streets or the traffic counts change.
  build(roads, params, palette) {
    this.routes = (roads || []).filter((r) => r.pts.length > 1).map((r, i) => makeRoute(r, i));
    this.linkJunctions();
    this.uniforms.uTail.value.set(hotColour(palette));
    this.cars.length = 0;
    // One size for every car regardless of which road it is on, pinned to
    // whichever of the two is narrower — a car that fit its lane on the side
    // streets should not suddenly swell crossing onto a highway.
    this.refWidth = Math.max(0.1, Math.min(params.streetWidth, params.highwayWidth));
    if (!this.routes.length) return this.push();

    const rng = new Rng(((params.seed >>> 0) ^ 0x51ed270b) >>> 0);
    const mains = this.routes.filter((r) => r.main);
    const paints = [...palette.faces, ...palette.glow];

    const spawn = (flying) => {
      // Traffic prefers the arterials, on the ground and in the air alike.
      const wantMain = mains.length && rng.float() < (flying ? 0.85 : params.mainRoadBias);
      const pool = wantMain ? mains : this.routes;
      const route = pool[Math.floor(rng.float() * pool.length)];
      if (!route || route.length < 4) return;
      this.cars.push({
        route,
        flying,
        boxy: rng.float() < 0.5,
        // Some of the boxes on the ground stand up into buses.
        tall: !flying && rng.float() < 0.22 ? 2.6 + rng.float() * 0.8 : 1,
        dir: rng.float() < 0.5 ? 1 : -1,
        distance: rng.float() * route.length,
        cruise: params.carSpeed * (0.8 + rng.float() * 0.45) * (flying ? 1.3 : 1),
        speed: 0,
        lane: 0.24 + rng.float() * 0.06,
        sizeScale: 0.85 + rng.float() * 0.35,
        size: 1,
        phase: rng.float() * 100,
        weave: flying ? 1.5 + rng.float() * 5 : 0,
        height: flying ? params.flyerHeight * (0.55 + rng.float() * 0.9) : 0,
        color: paints[Math.floor(rng.float() * paints.length)],
        heading: 0,
        headingSet: false,
        wait: 0,
        stopper: rng.float(),
        nextTurn: 4 + rng.float() * 10,
        fade: 1,
      });
    };

    const ground = Math.max(0, Math.min(MAX_CARS, Math.round(params.carCount)));
    const air = Math.max(0, Math.min(MAX_CARS, Math.round(params.flyerCount)));
    for (let i = 0; i < ground; i++) spawn(false);
    for (let i = 0; i < air; i++) spawn(true);
    this.applySizes(params);
    this.push();
  }

  // Every car the same size, off the narrower of the two road widths rather
  // than whichever road it happens to be spawned on.
  applySizes(params) {
    for (const car of this.cars) {
      car.size = params.carSize * this.refWidth * 0.15 * car.sizeScale;
    }
  }

  // Which roads meet at which ends. Cars use this to turn down a different
  // street instead of teleporting back to where they started.
  linkJunctions() {
    const reach = 7;
    for (const route of this.routes) {
      route.exits = [[], []];
      for (let end = 0; end < 2; end++) {
        const p = end === 0 ? route.pts[0] : route.pts[route.pts.length - 1];
        for (const other of this.routes) {
          if (other === route || other.length < 4) continue;
          const near = nearestOn(other, p[0], p[1]);
          if (near.dist < reach) route.exits[end].push({ route: other, at: near.at });
        }
      }
    }
  }

  // Write the instance colours once; only matrices and fade change per frame.
  push() {
    let p = 0;
    let b = 0;
    for (const car of this.cars) {
      const mesh = car.boxy ? this.box : this.pill;
      const index = car.boxy ? b++ : p++;
      car.mesh = mesh;
      car.index = index;
      this._c.set(car.color);
      mesh.instanceColor.setXYZ(index, this._c.r, this._c.g, this._c.b);
    }
    this.pill.count = p;
    this.box.count = b;
    // Start every instance hidden and collapsed. The first update places the
    // ones that are in play; anything it does not touch stays invisible rather
    // than sitting at the origin at full size.
    for (const mesh of [this.pill, this.box]) {
      this._m.makeScale(0, 0, 0);
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, this._m);
      mesh.geometry.attributes.aFade.array.fill(0);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.geometry.attributes.aFade.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  setNight(night) {
    this.uniforms.uHead.value = 0.15 + night * 1.5;
    this.uniforms.uTailGlow.value = 0.3 + night * 1.9;
  }

  setVisible(on) {
    this.group.visible = on;
  }

  // Who is in front of whom, per road and direction, so a car can see the one
  // ahead without every car testing every other car.
  queue() {
    const lanes = new Map();
    for (const car of this.cars) {
      if (car.flying) continue;
      const key = `${car.route.id}|${car.dir}`;
      let list = lanes.get(key);
      if (!list) lanes.set(key, (list = []));
      list.push(car);
    }
    for (const list of lanes.values()) {
      list.sort((a, b) => (a.distance - b.distance) * (list[0].dir > 0 ? 1 : -1));
      for (let i = 0; i < list.length; i++) list[i].ahead = list[i + 1] || null;
    }
    for (const car of this.cars) if (car.flying) car.ahead = null;
  }

  update(dt, time, groundAt, params) {
    if (!this.cars.length) return;
    const step = Math.min(0.05, dt);
    this.queue();

    for (const car of this.cars) {
      let want = car.cruise;

      if (!car.flying) {
        // Keep off the bumper of whoever is in front. Signed, so only a car
        // genuinely ahead slows this one: an absolute gap lets the car behind
        // brake it too, and two cars at the same distance then hold each other
        // still forever. The floor means a snarl always creeps itself apart.
        if (car.ahead) {
          const gap = (car.ahead.distance - car.distance) * car.dir - car.size * 3.4;
          const room = car.size * 8;
          if (gap < room) want *= Math.max(0.09, Math.min(1, gap / room));
        }
        // Junctions: sometimes hold, then move off again. Kept rare, or every
        // road turns into one long queue. Never at a dead end, where a stopped
        // car would sit half-faded and never leave.
        const ahead = car.dir > 0 ? car.route.exits[1] : car.route.exits[0];
        const toEnd = car.dir > 0 ? car.route.length - car.distance : car.distance;
        if (car.wait > 0) {
          car.wait -= step;
          want = 0;
        } else if (ahead.length && toEnd < car.size * 3 && car.stopper < 0.16) {
          car.wait = 0.5 + car.stopper * 4;
          car.stopper = (car.stopper * 7.13 + 0.31) % 1; // reroll for next time
        }
      } else {
        // Flyers pick a new corridor now and then.
        car.nextTurn -= step;
        if (car.nextTurn <= 0) {
          car.nextTurn = 6 + Math.random() * 14;
          const pool = this.routes.filter((r) => r.main && r.length > 8);
          const next = (pool.length ? pool : this.routes)[Math.floor(Math.random() * (pool.length || this.routes.length))];
          if (next) {
            const near = nearestOn(next, this._last?.x ?? 0, this._last?.z ?? 0);
            car.route = next;
            car.distance = near.at;
            car.dir = Math.random() < 0.5 ? 1 : -1;
          }
        }
      }

      // Ease toward the wanted speed so stops and starts are not instant.
      car.speed += (want - car.speed) * Math.min(1, step * (want > car.speed ? 1.8 : 5));
      car.distance += car.speed * car.dir * step;

      // Off the end of a road: turn onto a connecting one if there is one.
      let fade = 1;
      const past = car.dir > 0 ? car.distance > car.route.length : car.distance < 0;
      if (past) {
        const end = car.dir > 0 ? 1 : 0;
        const exits = car.route.exits[end];
        if (exits.length) {
          const exit = exits[Math.floor(Math.random() * exits.length)];
          const overshoot = car.dir > 0 ? car.distance - car.route.length : -car.distance;
          car.route = exit.route;
          car.distance = exit.at;
          // Head whichever way has more road left.
          car.dir = exit.at < exit.route.length / 2 ? 1 : -1;
          car.distance += overshoot * car.dir;
        } else {
          car.distance = car.dir > 0 ? 0 : car.route.length;
        }
        car.headingSet = false;
      }

      // Fade near a dead end, so leaving the map is a departure not a blink.
      // The runway is measured off how fast the car is actually going, not its
      // cruise: a car that has slowed to a crawl would otherwise sit inside the
      // fade for good, permanently half-drawn.
      const deadAhead = car.dir > 0 ? car.route.exits[1] : car.route.exits[0];
      const deadBehind = car.dir > 0 ? car.route.exits[0] : car.route.exits[1];
      const toEnd = car.dir > 0 ? car.route.length - car.distance : car.distance;
      const fromStart = car.route.length - toEnd;
      const runway = Math.max(2, Math.min(car.cruise, Math.max(car.speed, car.cruise * 0.35)));
      if (!deadAhead.length) fade = Math.min(fade, Math.max(0, toEnd / runway));
      if (!deadBehind.length) fade = Math.min(fade, Math.max(0, fromStart / runway));
      car.fade = Math.min(1, Math.max(0, fade));

      // Once it is invisible at a dead end there is nothing to wait for, so
      // send it round rather than letting it linger there.
      if (car.fade <= 0.02 && !deadAhead.length && toEnd < runway * 0.5) {
        car.distance = car.dir > 0 ? 0 : car.route.length;
        car.headingSet = false;
        car.fade = 0;
      }

      if (!sampleRoute(car.route, car.distance, this._hit)) {
        // Never leave an instance holding a stale matrix: an untouched one is
        // an identity, which parks a full-size opaque car at the town centre.
        this._m.makeScale(0, 0, 0);
        car.mesh.setMatrixAt(car.index, this._m);
        car.mesh.geometry.attributes.aFade.setX(car.index, 0);
        continue;
      }

      const target = this._hit.angle + (car.dir < 0 ? Math.PI : 0);
      if (!car.headingSet) {
        car.heading = target;
        car.headingSet = true;
      } else {
        // Shortest way round, eased. Without this a car snaps at every joint
        // in the polyline and reads as jittering rather than driving.
        let delta = target - car.heading;
        delta = ((delta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        car.heading += delta * Math.min(1, step * 6);
      }

      const nx = -Math.sin(this._hit.angle);
      const nz = Math.cos(this._hit.angle);
      const laneOffset = car.route.width * car.lane * car.dir;

      let wobble = 0;
      let lift = 0;
      let roll = 0;
      if (car.flying) {
        const swing = Math.sin(time * 0.55 + car.phase);
        wobble = swing * car.weave;
        lift = car.height + Math.sin(time * 0.37 + car.phase * 1.7) * car.height * 0.16;
        roll = -Math.cos(time * 0.55 + car.phase) * 0.28;
      }

      const x = this._hit.x + nx * (laneOffset + wobble);
      const z = this._hit.z + nz * (laneOffset + wobble);
      const base = groundAt ? groundAt(x, z) : 0;
      const tall = car.boxy ? car.tall || 1 : 1;
      // A flyer is already off the ground by its own rule and ignores the
      // deck; a ground car drives on whatever its road is doing, which is the
      // terrain until the road leaves it.
      const deck = car.flying ? 0 : this._hit.lift || 0;
      const y = base + deck + waveAt(x, z) + (car.flying ? lift : car.size * 0.26 * tall);
      this._last = { x, z };

      // Roll about the car's own forward axis, and nothing else: a car on the
      // road must not pitch or it reads as spinning.
      this._e.set(car.flying ? roll : 0, -car.heading, 0, 'YXZ');
      this._q.setFromEuler(this._e);
      this._v.set(x, y, z);
      this._s.set(car.size, car.size * tall, car.size);
      this._m.compose(this._v, this._q, this._s);
      car.mesh.setMatrixAt(car.index, this._m);
      car.mesh.geometry.attributes.aFade.setX(car.index, car.fade);
    }

    for (const mesh of [this.pill, this.box]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.geometry.attributes.aFade.needsUpdate = true;
    }
  }

  get count() {
    return this.cars.length;
  }
}

// The reddest, hottest colour a palette has. Falls back to a warm red so a
// cool palette still gets tail lamps that read as tail lamps.
export function hotColour(palette) {
  const hsl = { h: 0, s: 0, l: 0 };
  let best = null;
  let bestScore = -1;
  for (const hex of [...palette.glow, ...palette.faces]) {
    const c = new THREE.Color(hex);
    c.getHSL(hsl);
    // Distance round the wheel from red, wrapped.
    const fromRed = Math.min(hsl.h, 1 - hsl.h);
    const score = (1 - fromRed * 3) + hsl.s * 0.9 - Math.abs(hsl.l - 0.45);
    if (score > bestScore) {
      bestScore = score;
      best = hex;
    }
  }
  const c = new THREE.Color(best || '#ff2a1a');
  c.getHSL(hsl);
  // Push it hot regardless of what the palette handed over.
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.3 + 0.35), Math.min(0.55, Math.max(0.36, hsl.l)));
  return `#${c.getHexString()}`;
}
