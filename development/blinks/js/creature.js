import * as THREE from 'three';
import { compileGenome, hsl } from './genome.js';
import { evalPrims } from './sdf.js';
import { meshAsync } from './mesh-service.js';
import { createBodyMaterial, createLegMaterial } from './materials.js';
import { drawFace, FACE_PX } from './face.js';
import { LAYER } from './stage.js';

export const BASE = 0.62; // world units per genome unit
export const LIFE = 60;
export const GROWN = 50;
export const GRAVITY = 32;
// Seconds a creature is always up on its feet before its minute ends.
const AWAKE_BEFORE_DEATH = 5;
// Upward speed of a tap hop. With this gravity it peaks about 0.3 units up.
const TAP_HOP = 4.4;
// Gentler gravity while a baby is hopping, so each bounce hangs a moment.
const HOP_GRAVITY = 18;
const SINK = 3;
// Seconds into a garden before creatures start pairing off by themselves.
const COURT_AFTER = 20;
// Heartbeats per second while two creatures are in love.
const BEAT_RATE = 1.2;
const DIE_ROCK = 2.6;
const ROCK_W = (Math.PI * 3.5) / DIE_ROCK;
// The fall takes over at the start of the last swing, as it heads over.
const DIE_FALL = (DIE_ROCK * 3) / 3.5;
const rockAmp = (t) => 0.04 + 0.27 * Math.pow(Math.min(1, t / DIE_ROCK), 1.5);
const rockAngle = (t) => Math.sin(t * ROCK_W) * rockAmp(t);
const MESH_CELL = 0.035;
// Limbs are identical on every creature: thin black tubes ending in balls.
const LIMB_R = 0.0093;
const BALL_R = 0.027;
const INK = [0.106, 0.102, 0.122];

const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0);
const sphGeo = new THREE.SphereGeometry(1, 16, 12);
const FACE_GRID = 12;
// How far the edge of a face may bend back from its centre to follow the body.
const FACE_WRAP = 0.06;
// World units the face is pulled toward the camera, a bit more than the most
// the body surface can wobble or tremble past it.
const FACE_BIAS = 0.09;
let shadowTex;
function getShadowTex() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(40,40,60,0.75)');
  g.addColorStop(0.35, 'rgba(40,40,60,0.45)');
  g.addColorStop(0.7, 'rgba(40,40,60,0.12)');
  g.addColorStop(1, 'rgba(40,40,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

const V = () => new THREE.Vector3();
const tmp = V(), tmp2 = V(), tmp3 = V(), tmp4 = V(), up = new THREE.Vector3(0, 1, 0);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const fract = (x) => x - Math.floor(x);

// Wobble groups: base, second lobe, top parts, back/odd parts. Softer springs
// higher up so lobes lag behind each other like linked metaballs.
const GROUP_K = [150, 70, 48, 60];
const GROUP_C = [11, 5.5, 4, 5];
const GROUP_GAIN = [0.012, 0.035, 0.05, 0.04];
const GROUP_IDLE = [0.006, 0.022, 0.03, 0.022];

export class Creature {
  constructor(app, genome, x, z, age = 0) {
    this.app = app;
    this.g = genome;
    this.age = age;
    this.growth = this.growthAt(age);

    const rgb = (c) => hsl(...c);
    this.baseRGB = rgb(genome.palette.base);
    this.colsRGB = genome.palette.cols.map(rgb);

    this.root = new THREE.Group();
    this.tip = new THREE.Group();
    this.pivot = new THREE.Group();
    this.scaler = new THREE.Group();
    this.root.add(this.tip);
    this.tip.add(this.pivot);
    this.pivot.add(this.scaler);
    this.root.scale.setScalar(BASE);

    this.gOff = [V(), V(), V(), V()];
    this.gVel = [V(), V(), V(), V()];
    this.gPhase = [0, 1, 2, 3].map(() => Math.random() * 6.28);

    this.mat = createBodyMaterial();
    this.mat.uniforms.uBase.value.set(...this.baseRGB);
    this.mat.uniforms.uGroupOff.value = this.gOff;
    const blobCols = [this.colsRGB[0], this.colsRGB[1], this.colsRGB[2], this.colsRGB[0]];
    blobCols.forEach((c, i) => this.mat.uniforms.uBlobCol.value[i].set(...c));
    this.body = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.body.userData.creature = this;
    this.body.layers.set(LAYER.BODY);
    this.scaler.add(this.body);

    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = this.faceCanvas.height = FACE_PX;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.anisotropy = 4;
    this.face = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, FACE_GRID, FACE_GRID),
      new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    );
    this.face.renderOrder = 2;
    // The body bulges and sways at runtime, so the face is drawn a little toward
    // the camera. It always beats its own surface, and anything genuinely in
    // front still hides it.
    this.face.material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
  mvPosition.z += ${FACE_BIAS.toFixed(3)};
  gl_Position = projectionMatrix * mvPosition;`
      );
    };
    this.face.layers.set(LAYER.OVERLAY);
    this.pivot.add(this.face);
    this.expr = '';

    this.legMat = createLegMaterial(INK);
    this.limbGroup = new THREE.Group();
    app.scene.add(this.limbGroup);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: getShadowTex(), transparent: true, depthWrite: false, opacity: 0.15 })
    );
    this.shadow.layers.set(LAYER.SHADOW);
    app.scene.add(this.shadow);

    this.armLimbs = null;
    this.rebuild();

    const pairs = this.cg.hips.length / 2;
    this.legs = this.cg.hips.map((h, i) => {
      const pair = Math.floor(i / 2), side = i % 2;
      return {
        i, meshes: this.limbMeshes(4), plant: V(), from: V(), to: V(), foot: V(), fvel: V(), swing: false,
        off: fract((pair % 2) * 0.5 + side * 0.5 + (pairs > 2 ? pair * 0.08 : 0)),
      };
    });
    app.scene.add(this.root);

    this.pos = new THREE.Vector3(x, 0, z);
    this.prevPos = this.pos.clone();
    this.vel = V();
    this.mvel = V();
    this.prevMvel = V();
    this.heading = Math.random() * Math.PI * 2;
    this.desHeading = this.heading;
    this.state = 'wander';
    this.target = null;
    this.pause = Math.random() * 1.5;
    this.phase = Math.random();
    this.lag = V();
    this.fastWake = 0;
    this.sleepAmt = 0;
    this.walkCrouch = 0;
    this.waveT = 0;
    this.greeted = false;
    this.lagVel = V();
    this.sq = 0;
    this.sqVel = 0;
    this.roll = 0;
    this.lean = 0;
    this.glance = 0;
    this.prevPivotY = 0;
    this.prevPivotVY = 0;
    this.loveT = 0;
    this.angerT = 0;
    this.surpriseT = 0;
    this.happyT = 0;
    this.sleepT = 0;
    this.fleeT = 0;
    this.breedCD = 0;
    this.noticeT = 0;
    this.noticeCD = 2 + Math.random() * 3;
    this.awayT = 0;
    this.attendT = 0;
    this.hoverLoveT = 0;
    this.taps = [];
    this.blinkT = 2 + Math.random() * 3;
    this.emoteT = 1 + Math.random();
    this.courtAge = Math.min(LIFE - 10, Math.max(12, age + 8) + Math.random() * 26);
    this.courted = false;
    this.courtCheck = 0;
    this.grey = 0;
    this.tintAmt = 0;
    this.tint = new THREE.Vector3(1, 0.5, 0.6);
    this.tremble = 0;
    this.budScale = 1;
    this.dead = false;
    this.hideBody = false;
    this.hideAll = false;
    this.flash = 0;
    this.swing = { x: 0, z: 0, vx: 0, vz: 0 };
    this.grab = null;
    this.die = null;

    this.pose(0, 0);
    this.root.updateMatrixWorld(true);
    for (const leg of this.legs) { this.hipGround(leg, leg.plant); leg.foot.copy(leg.plant); }
  }

  limbMeshes(n) {
    return Array.from({ length: n }, (_, k) => {
      const m = new THREE.Mesh(k < 2 ? cylGeo : sphGeo, this.legMat);
      m.layers.set(LAYER.SHARP);
      this.limbGroup.add(m);
      return m;
    });
  }

  growthAt(age) { return Math.min(age, GROWN) / GROWN; }

  // Re-mesh the body at the current growth in a worker. Between rebuilds the
  // scaler stretches the old mesh to keep growth smooth.
  rebuild() {
    if (this.pending) return;
    const cg = compileGenome(this.g, this.growth);
    const growth = this.growth;
    const ext = Math.max(...cg.bounds.max.map((v, i) => v - cg.bounds.min[i]));
    const cell = Math.max(MESH_CELL, ext / 64);
    this.pending = true;
    if (!this.cg) this.applyShape(cg, growth, ext);
    meshAsync(cg.prims, cg.bounds, cell).then((m) => {
      this.pending = false;
      if (this.disposed) return;
      const sprouted = this.meshSprouts && cg.sprouts.some((s, i) => s > 0.2 && !(this.meshSprouts[i] > 0.2));
      this.applyShape(cg, growth, ext);
      this.applyMesh(m);
      if (sprouted) { this.kick(-0.9); this.flash = 0.5; }
    });
  }

  applyMesh(m) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    geo.setAttribute('groupW', new THREE.BufferAttribute(m.weights, 4));
    geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
    geo.computeBoundingSphere();
    this.body.geometry.dispose();
    this.body.geometry = geo;
    this.meshed = true;
  }

  // Everything that depends on the compiled shape, swapped in together with
  // its mesh so merge goo and limbs always match the body on screen.
  applyShape(cg, growth, ext) {
    this.cg = cg;
    this.meshGrowth = growth;
    this.meshSprouts = cg.sprouts.slice();
    this.mat.uniforms.uHeight.value.set(cg.bounds.min[1], cg.bounds.max[1]);
    this.mat.uniforms.uSize.value = Math.max(0.8, Math.min(1.6, ext * 0.6));

    const f = cg.face;
    this.face.position.set(...f.pos);
    this.faceBase = this.face.position.clone();
    const n = tmp.set(...f.normal).normalize();
    const zx = tmp2.crossVectors(up, n).normalize();
    const yy = tmp3.crossVectors(n, zx);
    this.face.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(zx, yy, n));
    this.faceQuat = this.face.quaternion.clone();
    this.face.scale.setScalar(f.w);
    this.conformFace(cg, f, zx, yy, n);
    this.faceH = clamp((f.pos[1] - cg.bounds.min[1]) / (cg.bounds.max[1] - cg.bounds.min[1]), 0, 1);

    if (cg.arms && !this.armLimbs) {
      this.armLimbs = cg.arms.map((a, i) => ({ i, meshes: this.limbMeshes(4), hand: V() }));
    }
    this.legLen = this.g.legs.len;
  }

  conformFace(cg, f, ex, ey, ez) {
    const geo = new THREE.PlaneGeometry(1, 1, FACE_GRID, FACE_GRID);
    const pos = geo.attributes.position;
    const a = new THREE.Vector3(...f.pos), p = new THREE.Vector3();
    const surface = (u, v) => {
      p.copy(a).addScaledVector(ex, u * f.w).addScaledVector(ey, v * f.w).addScaledVector(ez, 0.4);
      let depth = 0.4;
      for (let k = 0; k < 120; k++) {
        if (evalPrims(cg.prims, p.x, p.y, p.z) < 0) break;
        p.addScaledVector(ez, -0.01);
        depth -= 0.01;
      }
      return depth;
    };
    // The face hugs the surface only gently. Where the body curves away hard,
    // or the face hangs past a thin body like the arch, it stays near flat
    // instead of wrapping and stretching around the back.
    const center = surface(0, 0);
    for (let i = 0; i < pos.count; i++) {
      const depth = Math.max(surface(pos.getX(i), pos.getY(i)), center - FACE_WRAP);
      pos.setZ(i, (depth + 0.014) / f.w);
    }
    geo.computeBoundingSphere();
    this.face.geometry.dispose();
    this.face.geometry = geo;
  }

  needsRebuild() {
    if (this.pending || this.dead || this.die) return 0;
    let need = Math.abs(this.growth - this.meshGrowth) / 0.06;
    this.cg.sprouts.forEach((_, i) => {
      const gp = this.g.growth[i];
      const t = clamp((this.growth - gp.at) / 0.08, 0, 1);
      const s = t * t * (3 - 2 * t);
      if (Math.abs(s - this.meshSprouts[i]) > 0.2) need = Math.max(need, 2);
    });
    return need >= 1 ? need : 0;
  }

  // ---------- world-facing helpers ----------

  worldScale() { return BASE * this.budScale; }
  radius() { return this.cg.footprint * this.scaler.scale.x * this.worldScale(); }
  // How big the body is next to an average one. Heavier bodies move slower.
  bulk() { return clamp(this.radius() / 0.5, 0.4, 3); }
  sizePace(p = 0.5, lo = 0.55, hi = 1.25) { return clamp(Math.pow(this.bulk(), -p), lo, hi); }
  bodyCenter(out) { return this.body.localToWorld(out.set(...this.cg.center)); }
  headTop(out) {
    this.anchorOffset(this.cg.top.w, out);
    out.y += this.cg.top.y + 0.12;
    return this.body.localToWorld(out);
  }
  anchorOffset(w, out) {
    out.set(0, 0, 0);
    for (let i = 0; i < 4; i++) out.addScaledVector(this.gOff[i], w[i]);
    return out;
  }
  // A body-local point, moved by the wobble and the lag sway, in pivot space.
  bodyPoint(x, y, z, w, out) {
    this.anchorOffset(w, tmp4);
    const h = clamp((y - this.cg.bounds.min[1]) / (this.cg.bounds.max[1] - this.cg.bounds.min[1]), 0, 1);
    out.set(x + tmp4.x + this.lag.x * h * h, y + tmp4.y, z + tmp4.z + this.lag.z * h * h);
    return out.multiply(this.scaler.scale);
  }
  grounded() { return this.state !== 'held' && this.state !== 'air'; }
  // Winding up or in the air. Anything the creature decides for itself waits
  // until it has landed. Only the player cuts a jump short.
  midJump() { return this.state === 'crouch' || this.state === 'air'; }
  isBusy() { return this.state === 'merge' || this.state === 'bud' || !!this.die; }
  // Anyone who hasn't had a baby yet can always manage one before dying, even
  // past their minute while held. Parents slow down near the end.
  // A pairing the player sets up by hand always works, however old they are.
  canBreed(byPlayer = false) {
    if (this.isBusy() || this.breedCD > 0 || !this.meshed) return false;
    return byPlayer || !this.courted || this.age < LIFE - 4;
  }
  canWalk() { return ['wander', 'flee', 'seek', 'sleep'].includes(this.state); }

  mood() {
    if (this.die) return this.die.fallen ? 'dead' : 'tired';
    if (this.waveT > 0 && this.state !== 'held') return 'happy';
    if (this.hoverLoveT > 0) return 'happy';
    if (this.state === 'held' || this.surpriseT > 0) return 'surprise';
    if (this.angerT > 0) return 'angry';
    if (this.loveT > 0 || this.hoverLoveT > 0) return 'love';
    if (this.state === 'sleep') return 'sleep';
    if (this.happyT > 0 || this.waveT > 0 || this.state === 'dance') return 'happy';
    if (this.noticeT > 0 || this.attendT > 0) return 'curious';
    if (this.age > GROWN) return 'tired';
    return 'normal';
  }

  baseSpeed() {
    const s = 1.15 - 0.6 * this.growth;
    // Babies scurry at about three times grown-up speed, easing off as they grow.
    const baby = 1 + 2 * (1 - smooth(0, 0.3, this.growth));
    return (this.age > GROWN ? s * 0.35 : s) * baby * this.sizePace();
  }

  // ---------- reactions ----------

  pickUp(hit) {
    if (this.state === 'sleep' || this.sleepAmt > 0.05) this.fastWake = 0.5;
    this.state = 'held';
    this.prep = null;
    this.smallHop = false;
    this.pendingFlee = null;
    this.sleepT = 0;
    this.noticeT = 0;
    this.shakeCount = 0;
    this.lastHoldDir = null;
    this.root.updateMatrixWorld(true);
    this.grab = this.root.worldToLocal(hit.clone());
    this.grabCenter = this.root.worldToLocal(this.bodyCenter(new THREE.Vector3()));
    const cam = this.app.camera.position;
    this.desHeading = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z);
    this.kick(-0.6);
  }

  holdTo(target, dt) {
    if (this.grabCenter) this.grab.lerp(this.grabCenter, 1 - Math.exp(-dt * 7));
    // Keep the grabbed point exactly under the pointer while the body turns.
    const s = this.worldScale();
    tmp.copy(this.grab).multiplyScalar(s).applyAxisAngle(up, this.heading);
    this.pos.subVectors(target, tmp);
    if (this.pos.y < 0) this.pos.y = 0;
  }

  release(vel) {
    this.state = 'air';
    this.vel.copy(vel);
    const sp = Math.hypot(vel.x, vel.z);
    if (sp > 6) { this.vel.x *= 6 / sp; this.vel.z *= 6 / sp; }
    this.vel.y = Math.min(this.vel.y, 6);
    if (sp > 4.5 || this.shakeCount >= 4) this.anger();
  }

  greet() {
    if (this.greeted || this.isBusy() || this.state === 'held') return false;
    this.greeted = true;
    this.waveT = 1.5;
    this.happyT = 1.5;
    if (this.state === 'sleep') this.wakeUp();
    const cam = this.app.camera.position;
    this.desHeading = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z);
    this.kick(-0.5);
    return true;
  }

  // Startled awake: the body springs up off the floor instead of slowly rising.
  wakeUp() {
    if (this.state === 'sleep') this.state = 'wander';
    this.fastWake = 0.5;
    this.surpriseT = Math.max(this.surpriseT, 0.6);
    this.kick(0.8);
  }

  tap() {
    const greeted = this.greet();
    const now = this.app.time;
    this.taps = this.taps.filter((t) => now - t < 1.4);
    this.taps.push(now);
    if (this.state === 'sleep') this.wakeUp();
    else if (!greeted) {
      if (this.taps.length >= 3) { this.anger(); this.taps = []; }
      else if (this.angerT <= 0) this.happyT = 1.4;
    }
    // Every tap springs it straight up, right away: a stretch on take-off
    // and a quick hop a little off the floor.
    if (this.grounded() && !this.isBusy() && this.state !== 'crouch') {
      this.tapHop = true;
      this.hopT = 0;
      this.jump(TAP_HOP, 0.08);
      const cam = this.app.camera.position;
      this.desHeading = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z);
    }
  }


  burst(type, n, size = this.emoteSize(), rise = 1) {
    const top = this.headTop(V());
    for (let i = 0; i < n; i++) {
      const p = top.clone();
      p.x += (i - (n - 1) / 2) * size * 0.6;
      p.y += Math.abs(i - (n - 1) / 2) * -0.05;
      this.app.emotes.spawn(type, p, size, (i - (n - 1) / 2) * 0.25, rise);
    }
  }

  anger() {
    this.angerT = 5;
    this.loveT = 0;
    this.loveTarget = null;
    this.happyT = 0;
    this.hoverLoveT = 0;
  }

  love(partner) {
    this.loveT = 9;
    this.loveTarget = partner;
    this.angerT = 0;
    if (this.state === 'sleep') this.state = 'wander';
    if (this.midJump()) this.hopT = 0;
    else if (this.grounded() && !this.isBusy()) this.state = 'seek';
    this.burst('heart', 1);
    this.emoteT = 2.5 + Math.random();
  }

  flee(from) {
    if (this.isBusy()) return;
    if (this.midJump()) { this.pendingFlee = from; this.hopT = 0; return; }
    this.state = 'flee';
    this.fleeFrom = from;
    this.fleeT = 3.5;
    this.surpriseT = 0.35;
    this.attendT = 0;
    this.kick(-0.5);
  }

  kick(v) { this.sqVel += v * 6; this.kicked = true; }

  // Every jump winds up with a quick crouch, knees bending forward, then
  // springs. Big bodies take a touch longer to wind up.
  jump(v, prep) {
    this.state = 'crouch';
    this.prep = { t: 0, dur: prep / this.sizePace(0.4, 0.75, 1.2), v };
    this.vel.set(0, 0, 0);
  }

  // A single eased slide across the floor. Feet slide along with the body so
  // nothing has to re-step mid-push.
  shove(dx, dz, dur = 0.45) {
    this.shoving = { dx, dz, t: 0, dur, done: 0 };
    if (this.state === 'sleep') this.state = 'wander';
    this.target = null;
    this.pause = 0.6 + Math.random() * 0.6;
    this.vel.set(0, 0, 0);
    this.kick(-0.25);
  }

  applyShove(dt) {
    const s = this.shoving;
    s.t = Math.min(s.dur, s.t + dt);
    const k = 1 - Math.pow(1 - s.t / s.dur, 3);
    const step = k - s.done;
    s.done = k;
    const mx = s.dx * step, mz = s.dz * step;
    this.pos.x += mx;
    this.pos.z += mz;
    for (const leg of this.legs) for (const v of [leg.plant, leg.from, leg.to, leg.foot]) { v.x += mx; v.z += mz; }
    if (s.t >= s.dur) this.shoving = null;
  }

  emoteSize() { return 0.3 + 0.08 * this.growth; }

  // ---------- simulation ----------

  update(dt, t) {
    const app = this.app;
    this.kicked = false;
    if (this.state !== 'merge' && this.state !== 'bud') this.age += dt;
    this.growth = this.growthAt(this.age);
    this.legLen = this.g.legs.len * (1 + 0.45 * this.growth);
    if (this.heartIn > 0) {
      this.heartIn -= dt;
      if (this.heartIn <= 0) {
        // The surprise passes and turns to love: one heart and a loving face.
        this.app.emotes.spawn('heart', this.headTop(tmp), this.emoteSize());
        this.loveT = Math.max(this.loveT, 1.6);
        this.emoteT = 3;
      }
    }
    for (const k of ['hopT', 'fastWake', 'dodgeT', 'waveT', 'loveT', 'angerT', 'surpriseT', 'happyT', 'breedCD', 'noticeCD', 'attendT', 'hoverLoveT']) this[k] = Math.max(0, this[k] - dt);
    if (this.loveT <= 0) this.loveTarget = null;

    if (this.age >= LIFE && !this.isBusy() && !(this.hoverLoveT > 0)) {
      // Held creatures hang on until they are put down, then die on landing.
      // One being courted from above holds on until the moment passes.
      if (this.grounded() && !this.midJump()) this.startDying();
    }

    let speed = 0;
    if (this.shoving) {
      if (this.grounded() && !this.isBusy()) this.applyShove(dt);
      else this.shoving = null;
    }
    const attending = this.attendT > 0 && this.grounded() && !this.isBusy();
    if (attending) this.greet();
    if (this.waveT > 0 && this.canWalk()) {
      const cam = app.camera.position;
      this.desHeading = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z);
    }
    if (attending) {
      if (this.state === 'sleep' || this.state === 'seek' || this.state === 'dance') this.state = 'wander';
      const cam = app.camera.position;
      this.desHeading = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z);
      this.noticeT = 0;
    } else switch (this.state) {
      case 'wander': {
        if (this.lookAtT > 0 && this.lookAt && !this.lookAt.dead) {
          this.lookAtT -= dt;
          this.desHeading = Math.atan2(this.lookAt.pos.x - this.pos.x, this.lookAt.pos.z - this.pos.z);
          break;
        }
        if (this.updateNotice(dt)) break;
        if (this.updateCourtship(dt)) break;
        if (this.target) {
          const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.3) {
            this.target = null;
            this.pause = 1.2 + Math.random() * 3.5;
          } else {
            this.desHeading = this.steer(Math.atan2(dx, dz), null);
            speed = this.baseSpeed() * (this.angerT > 0 ? 1.35 : 1) * (this.dodgeT > 0 ? 2.6 : 1) * this.yieldFactor();
          }
        } else {
          this.pause -= dt;
          // Personal space: if someone is crowding while it stands around, it
          // drifts a little way off. A preference, not a rule.
          const crowd = this.crowding();
          if (crowd.w > 0.15 && this.pause > 0.2 && Math.random() < dt * 3) {
            this.target = { x: this.pos.x + crowd.x * crowd.want * (0.3 + crowd.w), z: this.pos.z + crowd.z * crowd.want * (0.3 + crowd.w) };
            break;
          }
          if (this.pause <= 0) {
            const nap = 4 + Math.random() * 4 + 3 * this.growth;
            const sleepy = 0.05 + 0.6 * smooth(0.3, 1, this.growth);
            const roll = Math.random();
            if (this.growth < 0.3 && roll < 0.35) {
              this.hopT = 3.5 + Math.random() * 2.5;
              this.happyT = 2;
              this.jump(this.hopSpeed(), 0.14);
              this.pause = 0.4;
            } else if (roll < (this.growth < 0.3 ? 0.45 : 0.12) && this.angerT <= 0 && this.age < LIFE - AWAKE_BEFORE_DEATH - 6) {
              this.state = 'dance';
              this.danceT = 3 + Math.random() * 3;
              this.danceRate = 5.5 + Math.random() * 2.5;
              this.vel.set(0, 0, 0);
              this.kick(-0.4);
            } else if (Math.random() < sleepy && this.angerT <= 0 && this.loveT <= 0 && this.age + nap < LIFE - AWAKE_BEFORE_DEATH - 2) {
              this.state = 'sleep';
              this.sleepT = nap;
            } else {
              // Pick somewhere to go: never inside a birth in progress, and
              // preferably not right next to someone else.
              const R = app.arena * 0.85;
              let best = null, bestScore = Infinity;
              for (let k = 0; k < 8; k++) {
                const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R;
                const x = Math.cos(a) * r, z = Math.sin(a) * r;
                if (app.inPocket(x, z, this.radius())) continue;
                const score = this.crowding(x, z).w + Math.random() * 0.3;
                if (score < bestScore) { bestScore = score; best = { x, z }; }
              }
              this.target = best || { x: this.pos.x, z: this.pos.z };
            }
          }
        }
        break;
      }
      case 'dance':
        this.danceT -= dt;
        if (this.danceT <= 0) { this.state = 'wander'; this.pause = 0.6; this.kick(-0.3); }
        break;
      case 'sleep':
        this.sleepT -= dt;
        if (this.sleepT <= 0 || this.age > LIFE - AWAKE_BEFORE_DEATH - 2) { this.state = 'wander'; this.kick(-0.3); }
        break;
      case 'flee': {
        const f = this.fleeFrom;
        this.fleeT -= dt;
        const fp = f ? f.pos : this.pos;
        let dx = this.pos.x - fp.x, dz = this.pos.z - fp.z;
        const d = Math.hypot(dx, dz) || 1;
        const edge = Math.hypot(this.pos.x, this.pos.z) / app.arena;
        if (edge > 0.75) { dx -= this.pos.x * edge * 1.5; dz -= this.pos.z * edge * 1.5; }
        this.desHeading = this.steer(Math.atan2(dx, dz), f);
        speed = this.baseSpeed() * 2.3;
        if (this.fleeT <= 0 || (d > 3.2 && this.fleeT < 2.5)) { this.state = 'wander'; this.target = null; this.pause = 0.6; }
        break;
      }
      case 'seek': {
        const p = this.loveTarget;
        const far = p && Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) > 2.5;
        if (!p || far || p.dead || p.isBusy() || this.loveT <= 0 || p.loveTarget !== this) { this.state = 'wander'; this.loveT = Math.min(this.loveT, 0.6); break; }
        const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        this.desHeading = this.steer(Math.atan2(dx, dz), p);
        speed = this.baseSpeed() * 1.3;
        if (d < (this.radius() + p.radius()) * 1.1 && p.grounded() && !p.midJump()) app.tryMerge(this, p);
        break;
      }
      case 'held': {
        const h = app.input.holdTarget;
        if (h) this.holdTo(h, dt);
        break;
      }
      case 'crouch': {
        const p = this.prep;
        if (!p) { this.state = 'wander'; break; }
        p.t += dt;
        if (p.t >= p.dur) {
          this.prep = null;
          this.smallHop = true;
          this.state = 'air';
          this.vel.set(0, p.v, 0);
          this.sqVel = 0;
          this.sq = 0.12;
          this.kick(0.6);
        }
        break;
      }
      case 'air': {
        this.vel.y -= (this.hopT > 0 ? HOP_GRAVITY : GRAVITY) * dt;
        this.pos.addScaledVector(this.vel, dt);
        if (this.pos.y <= 0) {
          const impact = -this.vel.y;
          this.pos.y = 0;
          if (impact > 9) {
            this.smallHop = true;
            this.vel.y = impact * 0.16;
            this.vel.x *= 0.5;
            this.vel.z *= 0.5;
          } else if (this.hopT > 0 && this.age < LIFE) {
            // Straight into the next bounce. Each hop hangs a little longer
            // as the baby grows.
            // Land into the crouch and push off again from it.
            this.jump(this.hopSpeed(), 0.12);
            this.happyT = Math.max(this.happyT, 1);
          } else {
            this.hopT = 0;
            this.vel.set(0, 0, 0);
            this.state = this.loveTarget ? 'seek' : 'wander';
            this.target = null;
            this.pause = 0.6;
            this.surpriseT = Math.max(this.surpriseT, impact > 2 ? 0.4 : 0);
            this.smallHop = false;
            if (this.age >= LIFE) this.startDying();
            else if (this.pendingFlee) this.flee(this.pendingFlee);
            this.pendingFlee = null;
          }
          this.kick(-Math.min(0.8, impact * 0.07));
          if (impact <= 9) { this.landT = 0.18; this.landDepth = clamp(impact * 0.06, 0.12, 0.32); }
          this.landFeet = true;
          if (this.state !== 'air') this.tapHop = false;
          if (this.newcomer) { this.newcomer = false; this.app.onArrival?.(this); }
          if (this.popLand) {
            this.popLand = false;
            this.surpriseT = 0.5;
            this.heartIn = 0.48;
          }
        }
        break;
      }
      case 'dying':
        this.updateDying(dt);
        break;
    }

    if (this.state !== this.lastState) {
      const quiet = ['air', 'held', 'merge', 'bud', 'dying', 'crouch'];
      if (!this.kicked && !quiet.includes(this.state) && !quiet.includes(this.lastState)) this.kick(-0.3);
      this.lastState = this.state;
    }
    if (this.shoving) speed = 0;
    speed *= 1 - smooth(0.05, 0.4, this.sleepAmt);
    // Steering and integration for walking states.
    const turnRate = (this.state === 'held' || attending ? 14 : this.state === 'flee' ? 7 : 4.5) * (this.state === 'held' ? 1 : this.sizePace(0.7, 0.4, 1.35));
    const dh = angDiff(this.heading, this.desHeading);
    const turn = this.state !== 'dying' ? clamp(dh, -turnRate * dt, turnRate * dt) : 0;
    this.heading += turn;
    this.turnSpeed = Math.abs(turn) / Math.max(dt, 1e-4) * (this.radius ? this.radius() : 0.3);
    if (this.canWalk()) {
      const facing = Math.max(0, Math.cos(dh));
      const tx = Math.sin(this.heading) * speed * facing * facing, tz = Math.cos(this.heading) * speed * facing * facing;
      this.vel.x += (tx - this.vel.x) * Math.min(1, dt * 7);
      this.vel.z += (tz - this.vel.z) * Math.min(1, dt * 7);
      this.vel.y = 0;
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
    }

    const rr = Math.hypot(this.pos.x, this.pos.z);
    if (rr > app.arena && this.state !== 'held') {
      this.pos.x *= app.arena / rr;
      this.pos.z *= app.arena / rr;
      if (this.state === 'wander') this.target = null;
    }

    // Measured motion drives gait and wobble, so walking, being carried and
    // being pulled into a merge all animate the same way.
    const idt = 1 / Math.max(dt, 1e-4);
    this.mvel.subVectors(this.pos, this.prevPos).multiplyScalar(idt);
    this.prevPos.copy(this.pos);
    const ax = clamp((this.mvel.x - this.prevMvel.x) * idt, -40, 40);
    const az = clamp((this.mvel.z - this.prevMvel.z) * idt, -40, 40);
    const ay = clamp((this.mvel.y - this.prevMvel.y) * idt, -40, 40);
    this.prevMvel.copy(this.mvel);
    const ch = Math.cos(this.heading), sh = Math.sin(this.heading);
    const lx = ax * ch - az * sh, lz = ax * sh + az * ch;
    const G = 0.05 / BASE;
    const still = this.die && this.die.settleT > 0;
    if (!still) this.lagVel.x += (-110 * this.lag.x - 7.5 * this.lagVel.x - lx * G) * dt;
    if (!still) {
      this.lagVel.z += (-110 * this.lag.z - 7.5 * this.lagVel.z - lz * G) * dt;
      this.lag.x += this.lagVel.x * dt;
      this.lag.z += this.lagVel.z * dt;
    }
    const ll = Math.hypot(this.lag.x, this.lag.z);
    if (ll > 0.28) { this.lag.x *= 0.28 / ll; this.lag.z *= 0.28 / ll; }
    if (this.state === 'held') this.sqVel += clamp(-ay * 0.004, -0.6, 0.6);
    if (this.angerT > 0) {
      this.lagVel.x += Math.sin(t * 31) * 14 * dt;
      this.lagVel.z += Math.cos(t * 27) * 10 * dt;
      this.sqVel += Math.sin(t * 19) * 4 * dt;
    }

    this.sqVel += (-240 * this.sq - 22 * this.sqVel) * dt;
    this.sq += this.sqVel * dt;
    this.sq = clamp(this.sq, -0.35, 0.35);
    // Once it starts to fall it's a rag doll: no squash and stretch, only the
    // rigid topple and its floor bounces.
    if (this.die && this.die.fallen) {
      this.sqVel = 0;
      this.sq *= Math.exp(-dt * 12);
    }

    this.updateSwing(dt, t, lx, lz);

    // Gait. Feet only step while travelling, plus one settling step after stopping.
    const sp = Math.hypot(this.mvel.x, this.mvel.z);
    this.speedH = sp;
    this.walkSpeed = this.canWalk() ? Math.hypot(this.vel.x, this.vel.z) : 0;
    const stepping = this.state === 'dance' ? 0.75 : Math.max(this.walkSpeed, this.canWalk() || this.state === 'wander' ? Math.min(this.turnSpeed, 0.8) : 0);
    // Slow, long strides, only quickening when a step would outreach the leg.
    const Lstep = Math.max(this.legLen * this.worldScale() - BALL_R, 0.02);
    const reachCps = (0.25 * this.walkSpeed) / (0.4 * Lstep);
    this.cps = Math.min(4.6, Math.max(this.feetOff ? 2.2 : 0, (1.05 + 1.4 * stepping) * this.sizePace(0.3, 0.7, 1.15), reachCps));
    if (this.grounded() && !this.die) {
      const prev = this.phase;
      if (stepping > 0.1 || this.feetOff) {
        this.stopPhase = null;
        this.phase += this.cps * dt;
      } else {
        // Finish the step in progress and stop right after a footfall.
        if (this.stopPhase == null) this.stopPhase = Math.ceil(this.phase * 2 - 0.002) / 2 + 0.001;
        this.phase = Math.min(this.stopPhase, this.phase + 2.2 * dt);
      }
      if (Math.floor(prev * 2) !== Math.floor(this.phase * 2)) this.kick(-0.16 * smooth(0.05, 0.4, this.walkSpeed));
    }

    this.updateMoodLook(dt, t);
    this.pose(dt, t);
    this.updateGroups(dt, t, lx, lz);
  }

  // Head toward a goal while sliding around anyone in the way.
  steer(goal, ignore) {
    let sx = Math.sin(goal), sz = Math.cos(goal);
    const r0 = this.radius();
    for (const o of this.app.creatures) {
      if (o === this || o === ignore || !o.grounded() || o.state === 'bud') continue;
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1e-3;
      const R = r0 + o.radius() + 0.15;
      const reach = R + 1.0;
      if (d > reach) continue;
      const nx = dx / d, nz = dz / d;
      const ahead = nx * sx + nz * sz;
      if (ahead < -0.2) continue;
      const w = (1 - clamp((d - R) / (reach - R), 0, 1)) * (0.6 + ahead);
      const side = nx * sz - nz * sx > 0 ? 1 : -1;
      sx += (-nx * 0.6 + -nz * side * 0.9) * w;
      sz += (-nz * 0.6 + nx * side * 0.9) * w;
    }
    return Math.atan2(sx, sz);
  }

  // How crowded a spot is: a push direction away from neighbours closer than
  // about one body width of gap, and how strong that push is (0 to 1).
  crowding(x = this.pos.x, z = this.pos.z) {
    let px = 0, pz = 0, w = 0, want = 0;
    const r0 = this.radius();
    for (const o of this.app.creatures) {
      if (o === this || o.state === 'bud' || o.die) continue;
      const dx = o.pos.x - x, dz = o.pos.z - z;
      const d = Math.hypot(dx, dz) || 1e-3;
      const gap = 2 * (r0 + o.radius());
      if (d >= gap) continue;
      const k = (gap - d) / gap;
      px -= (dx / d) * k;
      pz -= (dz / d) * k;
      if (k > w) { w = k; want = gap; }
    }
    const l = Math.hypot(px, pz) || 1;
    return { x: px / l, z: pz / l, w, want };
  }

  // Slow down when someone is right in front.
  yieldFactor() {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let f = 1;
    for (const o of this.app.creatures) {
      if (o === this || !o.grounded()) continue;
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const R = this.radius() + o.radius();
      if (d < R + 0.4 && (dx * fx + dz * fz) / (d || 1) > 0.6) f = Math.min(f, clamp((d - R) / 0.4, 0.15, 1));
    }
    return f;
  }

  updateCourtship(dt) {
    if (this.courted || this.age < this.courtAge || !this.canBreed() || this.loveT > 0 || this.angerT > 0) return false;
    // Nobody pairs off on their own in the opening moments of a garden.
    if (this.app.clock < COURT_AFTER) return false;
    this.courtCheck -= dt;
    if (this.courtCheck > 0) return false;
    this.courtCheck = 1.5;
    let best = null, bd = Infinity;
    for (const o of this.app.creatures) {
      if (o === this || o.courted || !o.canBreed() || o.age < 6 || o.loveT > 0 || o.angerT > 0) continue;
      if (o.state !== 'wander' && o.state !== 'sleep') continue;
      const d = Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) - this.radius() - o.radius();
      if (d < 0.9 && d < bd) { bd = d; best = o; }
    }
    if (!best) return false;
    this.love(best);
    best.love(this);
    return true;
  }

  updateNotice(dt) {
    const app = this.app;
    const p = app.input.hover;
    if (this.noticeCD > 0 || !p) {
      if (this.noticeT > 0) this.boredom();
      return false;
    }
    this.headTop(tmp2);
    const s = tmp2.project(app.camera);
    const px = (s.x * 0.5 + 0.5) * app.stage.width, py = (-s.y * 0.5 + 0.5) * app.stage.height;
    const d = Math.hypot(px - p.x, py - p.y);
    const near = d < Math.max(90, app.stage.height * 0.11);
    if (this.noticeT <= 0) {
      if (!near || this.angerT > 0 || this.loveT > 0) return false;
      this.noticeT = 0.0001;
      this.awayT = 0;
      this.kick(-0.8);
    }
    this.noticeT += dt;
    this.awayT = near ? 0 : this.awayT + dt;
    if (this.noticeT > 5 || this.awayT > 0.6) { this.boredom(); return false; }
    // A beat of anticipation after the bounce, then track the cursor.
    const track = smooth(0.15, 0.45, this.noticeT);
    const cam = app.camera.position;
    this.desHeading = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z) + clamp((p.x - px) / 300, -0.6, 0.6) * track;
    this.lookTilt = clamp((p.x - px) / 120, -1, 1) * track;
    this.lookUp = clamp((py - p.y) / 160 + 0.6, 0, 1.2) * track;
    return true;
  }

  boredom() {
    this.noticeT = 0;
    this.noticeCD = 6 + Math.random() * 3;
    this.target = null;
    this.pause = 0.4;
  }

  startDying() {
    this.state = 'dying';
    this.vel.set(0, 0, 0);
    this.noticeT = this.attendT = this.hoverLoveT = this.loveT = 0;
    const axis = 'x';
    this.die = {
      t: 0, axis, dir: Math.random() < 0.5 ? 1 : -1, th: 0, om: 0, fallen: false, settleT: 0, bounces: 0, sink: 0,
      collapse: this.legs.length > 2, drop: 0, dropV: 0,
    };
    this.kick(-0.5);
  }

  updateDying(dt) {
    const d = this.die;
    d.t += dt;
    // A slow forward and back rock that grows. On its last swing the motion
    // carries straight on into the topple, the way it was already going.
    if (d.t < DIE_FALL) return;
    if (!d.fallen) {
      d.fallen = true;
      d.th = 0;
      d.om = ROCK_W * rockAmp(DIE_FALL);
      if (!d.collapse) {
        const dirW = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(d.dir);
        const reach = (this.legLen + this.cg.height * this.scaler.scale.y) * this.worldScale();
        this.app.onTopple?.(this, dirW, reach);
      }
    }
    if (d.collapse) {
      // Many-legged bodies just give out and drop onto the floor.
      if (d.drop < 1 || d.dropV !== 0) {
        if (!d.bounces && d.dropV === 0) d.dropV = 1.5;
        d.dropV += 24 * dt;
        d.drop += d.dropV * dt;
        if (d.drop >= 1) {
          d.drop = 1;
          if (d.dropV > 1.2 && d.bounces < 2) { d.dropV = -d.dropV * 0.25; d.bounces++; }
          else d.dropV = 0;
        }
      }
      if (d.drop >= 1 && d.dropV === 0) {
        d.settleT += dt;
        if (d.settleT > 0.7) {
          d.sink += dt;
          if (d.sink >= SINK) this.dead = true;
        }
      }
      return;
    }
    // A stiff body toppling on its base, bouncing a little at the floor.
    if (d.th < Math.PI / 2 || Math.abs(d.om) > 0.01) {
      d.om += 9 * Math.sin(Math.max(d.th, 0.06)) * dt;
      d.om *= 1 - dt * 0.6;
      d.th += d.om * dt;
      if (d.th >= Math.PI / 2) {
        d.th = Math.PI / 2;
        if (d.om > 0.6 && d.bounces < 3) { d.om = -d.om * 0.32; d.bounces++; }
        else d.om = 0;
      }
    }
    if (d.th >= Math.PI / 2 - 1e-3 && d.om === 0) {
      d.settleT += dt;
      if (d.settleT > 0.7) {
        d.sink += dt;
        if (d.sink >= SINK) this.dead = true;
      }
    }
  }

  updateSwing(dt, t, lx, lz) {
    const s = this.swing;
    const held = this.state === 'held';
    // Held: a soft, slow sway. The squirm is driven near the sway's own pace,
    // and the Look dials scale its size and speed.
    const look = this.app.stage.look || {};
    const amp = look.holdWobble ?? 2, pace = look.holdWobbleSpeed ?? 1;
    const calm = this.loveCalm || 0;
    const k = held ? 14 * pace * pace : 60, c = held ? 2 * pace + calm * 8 : 7;
    const gain = held ? 0.035 : 0;
    s.vx += (-k * s.x - c * s.vx + lz * gain) * dt;
    s.vz += (-k * s.z - c * s.vz - lx * gain) * dt;
    if (held) {
      s.vx += Math.sin(t * 3.1 * pace) * 0.3 * amp * pace * pace * (1 - calm) * dt;
      s.vz += Math.sin(t * 4.7 * pace + 1.3) * 0.3 * amp * pace * pace * (1 - calm) * dt;
    }
    s.x = clamp(s.x + s.vx * dt, -0.9, 0.9);
    s.z = clamp(s.z + s.vz * dt, -0.9, 0.9);
  }

  updateGroups(dt, t, lx, lz) {
    // Frozen where it came to rest; it sinks in that exact pose.
    if (this.die && this.die.settleT > 0) return;
    // Vertical acceleration of the body from the walk bounce and squash.
    const py = this.pivot.position.y + this.sq * 0.3;
    const vy = (py - this.prevPivotY) / Math.max(dt, 1e-4);
    const ay = clamp((vy - this.prevPivotVY) / Math.max(dt, 1e-4), -60, 60);
    this.prevPivotY = py;
    this.prevPivotVY = vy;
    const active = this.hoverLoveT > 0 ? 0.4 : this.state === 'held' ? 1.6 : this.angerT > 0 ? 1.5 : 1;
    for (let i = 0; i < 4; i++) {
      const o = this.gOff[i], v = this.gVel[i];
      const ph = this.gPhase[i];
      const idle = GROUP_IDLE[i];
      const tx = Math.sin(t * 1.7 + ph) * idle, ty = Math.sin(t * 2.3 + ph * 1.3) * idle * 0.8, tz = Math.cos(t * 1.4 + ph) * idle;
      const kk = GROUP_K[i], cc = GROUP_C[i], gg = GROUP_GAIN[i] * active;
      v.x += (-kk * (o.x - tx) - cc * v.x - lx * gg) * dt;
      v.y += (-kk * (o.y - ty) - cc * v.y - ay * gg * 0.25) * dt;
      v.z += (-kk * (o.z - tz) - cc * v.z - lz * gg) * dt;
      o.addScaledVector(v, dt);
      const l = o.length();
      if (l > 0.12) o.multiplyScalar(0.12 / l);
    }
  }

  updateMoodLook(dt, t) {
    const m = this.mood();
    let tint = [1, 0.5, 0.6], amt = 0, trem = 0;
    if (m === 'love') { tint = [1, 0.48, 0.66]; amt = 0.2; }
    this.loveCalm = (this.loveCalm || 0) + ((this.hoverLoveT > 0 ? 1 : 0) - (this.loveCalm || 0)) * Math.min(1, dt * 6);
    // Held in love, the legs snap up into the body. Pulled away, they pop
    // straight back out.
    // Let go in love, they stay tucked through the merge.
    const tuckGoal = (this.state === 'held' && this.hoverLoveT > 0) || (this.state === 'merge' && this.tuck > 0.5) ? 1 : 0;
    this.tuckV = (this.tuckV || 0) + ((tuckGoal - (this.tuck || 0)) * 900 - 42 * this.tuckV) * dt;
    this.tuck = clamp((this.tuck || 0) + this.tuckV * dt, 0, 1);
    if (this.state !== 'held' && this.state !== 'merge') { this.tuck = 0; this.tuckV = 0; }
    this.beatPulse = 0;
    if (this.hoverLoveT > 0) {
      // A heartbeat, BEAT_RATE times a second and in step with the partner: bump, bump,
      // then two beats of rest. Each bump swells the body and flashes white.
      // This is the cue that letting go now makes a baby.
      const x = fract((t - (this.beat0 ?? 0)) * BEAT_RATE);
      const bump = (y) => (y < 0 ? 0 : smooth(0, 0.05, y) * (1 - smooth(0.05, 0.2, y)));
      const w = Math.max(bump(x), bump(x - 0.25));
      this.beatPulse = w;
      this.hoverWhite = w;
      tint = [1, 0.12, 0.14];
      amt = 1;
    }
    if (m === 'angry') { tint = [1, 0.16, 0.1]; amt = 0.5; trem = 1; }
    if (this.state === 'held' && !(this.hoverLoveT > 0)) trem = Math.max(trem, 0.2);
    const kt = this.hoverLoveT > 0 ? 1 : Math.min(1, dt * 5);
    this.tint.lerp(tmp.set(...tint), kt);
    this.tintAmt += (amt - this.tintAmt) * (this.hoverLoveT > 0 ? 1 : Math.min(1, dt * 4));
    this.tremble += (trem - this.tremble) * Math.min(1, dt * 6);
    const greyTarget = this.die ? 1 : smooth(GROWN, LIFE - 1, this.age);
    this.grey += (greyTarget - this.grey) * Math.min(1, dt * 3);
    this.flash = Math.max(0, this.flash - dt * 3);

    this.blinkT -= dt;
    let expr = m;
    if ((m === 'normal' || m === 'curious') && this.blinkT < 0.12) expr = 'blink';
    if (this.blinkT <= 0) this.blinkT = 2 + Math.random() * 3.5;
    if (expr !== this.expr) {
      // Every real change of expression lands with a little downward bounce.
      if (expr !== 'blink' && this.expr !== 'blink' && this.expr !== '') this.kick(-0.45);
      this.expr = expr;
      drawFace(this.faceCanvas.getContext('2d'), expr, this.g.face);
      this.faceTex.needsUpdate = true;
    }

    this.markType = m === 'angry' || m === 'surprise' ? m : null;
    this.emoteT -= dt;
    if (this.hoverLoveT > 0 && this.state === 'merge') {
      // The merge sprays its own hearts.
      this.emoteT = 0.7;
    } else if (this.hoverLoveT > 0) {
      // One heart on the first bump of each beat.
      const cycle = Math.floor((t - (this.beat0 ?? 0)) * BEAT_RATE);
      if (cycle !== this.heartCycle) {
        this.heartCycle = cycle;
        const p = this.headTop(tmp);
        p.x += (Math.random() - 0.5) * 0.4;
        this.app.emotes.spawn('heart', p, this.emoteSize() * (0.8 + Math.random() * 0.4), (Math.random() - 0.5) * 0.6, 3.4);
      }
      this.emoteT = 0.7;
    } else if (this.emoteT <= 0) {
      const kind = this.state === 'dance' ? 'note' : m === 'love' ? 'heart' : m === 'sleep' ? 'z' : null;
      if (kind === 'note') {
        const p = this.headTop(tmp);
        p.x += (Math.random() - 0.5) * 0.3;
        this.app.emotes.spawn('note', p, this.emoteSize() * (0.75 + Math.random() * 0.3), (Math.random() - 0.5) * 0.3);
        this.emoteT = 0.7 + Math.random() * 0.4;
      } else if (kind) {
        this.app.emotes.spawn(kind, this.headTop(tmp), this.emoteSize());
        this.emoteT = kind === 'z' ? 1.3 : kind === 'heart' ? 2.6 + Math.random() : 1.6;
      } else this.emoteT = 0.3;
    }
  }

  pose(dt, t) {
    const gw = smooth(0.1, 0.5, this.walkSpeed || 0);
    const ph = this.phase * Math.PI * 2;
    const fleeing = this.state === 'flee';
    const pace = smooth(0, 1.6, Math.max(this.walkSpeed || 0, this.turnSpeed || 0));
    const S = this.worldScale();
    const bounce = (0.004 + (fleeing ? 0.03 : 0.008) * pace) * gw;
    const bob = bounce * Math.sin(Math.PI * fract(this.phase * 2)) - (this.danceBob || 0);
    const Lw = Math.max(this.legLen * S - BALL_R, 0.02);
    // Planted legs carry the weight nearly straight, so the body rides an arc
    // over them: lowest at contact with the legs reaching, highest as the
    // other leg passes under, bent, in the air.
    const half = Math.min(((this.walkSpeed || 0) / (this.cps || 1.5)) * 0.25, Lw * 0.45);
    const moving = gw > 0.01 || this.feetOff;
    let reach = 0;
    if (moving) {
      for (const leg of this.legs) {
        const p = fract(this.phase + leg.off);
        if (p < 0.5) reach = Math.max(reach, half * Math.abs(1 - 4 * p));
      }
    }
    const give = Lw * 0.02 * gw;
    const needW = moving ? Lw - Math.sqrt(Lw * Lw - reach * reach) + give + (this.feetOff ? 0.006 : 0) : 0;
    this.walkCrouch += (needW / S - this.walkCrouch) * Math.min(1, dt * 30);

    let rollT = (fleeing ? 0.16 : 0.13) * Math.sin(ph) * gw;
    let leanT = 0;
    const sleepGoal = this.state === 'sleep' ? 1 : 0;
    this.sleepAmt += (sleepGoal - this.sleepAmt) * Math.min(1, dt * (this.fastWake > 0 ? 16 : 2.2));
    const sa = this.sleepAmt * this.sleepAmt * (3 - 2 * this.sleepAmt);
    const crouch = this.legLen * sa;
    this.landT = Math.max(0, (this.landT || 0) - dt);
    let jcGoal = 0;
    if (this.state === 'crouch') jcGoal = 0.3;
    else if (this.landT > 0) jcGoal = this.landDepth || 0.2;
    this.jc ||= 0;
    const jcRate = this.state === 'air' ? 35 : jcGoal > this.jc ? 30 : 9;
    this.jc += (jcGoal - this.jc) * Math.min(1, dt * jcRate);
    const jumpDip = this.jc * Math.min(this.legLen, 0.45);
    if (this.state === 'sleep') this.sqVel += Math.sin(t * 2.2) * 0.25 * dt * 6;
    if (this.noticeT > 0) {
      leanT = -0.12 - 0.22 * (this.lookUp || 0);
      rollT += 0.22 * (this.lookTilt || 0);
    }
    if (this.attendT > 0) leanT = -0.22;
    if (this.angerT > 0 && this.canWalk()) rollT += Math.sin(t * 40) * 0.03;
    if (this.state === 'dance') {
      const ph2 = t * this.danceRate;
      rollT += Math.sin(ph2) * 0.22;
      this.danceBob = Math.abs(Math.sin(ph2)) * 0.05;
    } else this.danceBob = 0;
    if (this.waveT > 0 && !this.cg.arms) rollT += Math.sin(t * 11) * 0.16 * Math.min(1, this.waveT * 2);

    // Glance at whoever is close by.
    let glanceT = 0;
    if (this.canWalk() && this.noticeT <= 0 && this.attendT <= 0) {
      let best = null, bd = 1.8;
      for (const o of this.app.creatures) {
        if (o === this || o.state === 'bud') continue;
        const d = Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) - o.radius();
        if (d < bd) { bd = d; best = o; }
      }
      if (best) glanceT = clamp(angDiff(this.heading, Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z)), -0.5, 0.5);
    }
    const k = Math.min(1, dt * 8);
    this.roll += (rollT - this.roll) * k;
    this.lean += (leanT - this.lean) * k;
    this.glance += (glanceT - this.glance) * Math.min(1, dt * 3);

    if (this.meshGrowth !== undefined) {
      const a = cgScale(this.meshGrowth), b = cgScale(this.growth);
      this.scaler.scale.set(b.w / a.w, b.h / a.h, b.w / a.w);
    }

    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
    this.root.scale.setScalar(this.worldScale());

    this.pivot.position.set(Math.sin(ph) * 0.035 * gw, this.legLen - crouch - this.walkCrouch - jumpDip + bob, 0);
    this.pivot.rotation.set(this.lean, 0.07 * Math.sin(ph) * gw + this.glance * 0.6, this.roll);
    const beat = 1 + 0.15 * (this.beatPulse || 0);
    this.pivot.scale.set((1 - this.sq * 0.5) * beat, (1 + this.sq) * beat, (1 - this.sq * 0.5) * beat);

    // The tip group carries swing around the grab point and the death topple.
    this.tip.rotation.set(0, 0, 0);
    this.tip.position.set(0, 0, 0);
    const s = this.swing;
    if (Math.abs(s.x) + Math.abs(s.z) > 1e-4) {
      this.tip.rotation.set(s.x, 0, s.z);
      if (this.grab) {
        tmp.copy(this.grab).applyEuler(this.tip.rotation);
        this.tip.position.subVectors(this.grab, tmp);
      }
    } else if (this.state !== 'held') this.grab = null;
    if (this.die) {
      const d = this.die;
      const wob = d.fallen ? 0 : -d.dir * rockAngle(d.t);
      const th = d.collapse ? 0 : d.th * d.dir;
      this.tip.rotation.set(th + wob * (d.collapse ? 0.5 : 1), 0, 0);
      const half = (d.axis === 'x' ? this.cg.desc.hd : this.cg.desc.hw) * this.scaler.scale.x;
      this.tip.position.y = d.collapse ? -this.legLen * d.drop : Math.sin(d.th) * (half * 0.85 - this.legLen * 0.25);
      if (d.sink > 0) {
        const q = d.sink / SINK;
        this.sinkY = -q * q * (this.cg.height * this.scaler.scale.y + 0.5) * BASE * 1.2;
        this.root.position.y += this.sinkY;
      }
    }

    this.bodyPoint(...this.faceBase.toArray(), this.cg.face.weights, this.face.position);
    this.face.visible = !this.hideAll && this.state !== 'bud' && !!this.meshed;
  }

  // A hop on the spot (a tap or a baby's happy bounce) rather than a big launch.
  smallJump() {
    return this.hopT > 0 || this.tapHop || this.smallHop;
  }

  // Launch speed for one baby hop: about 0.3s in the air for a newborn,
  // stretching to about 0.42s as it grows.
  hopSpeed() {
    const air = 0.3 + 0.12 * smooth(0, 0.35, this.growth);
    return (HOP_GRAVITY * air) / 2;
  }

  // How high a stepping foot lifts: barely at a stroll, more at a run.
  stepLift() {
    const pace = smooth(0, 1.6, Math.max(this.walkSpeed || 0, this.turnSpeed || 0));
    const rest = this.legLen * this.worldScale();
    return Math.min(rest * 0.4, 0.16) * (0.35 + 0.65 * pace);
  }

  hipGround(leg, out) {
    const h = this.cg.hips[leg.i];
    out.set(h.x * this.scaler.scale.x, 0, h.z * this.scaler.scale.z);
    out.applyAxisAngle(up, this.heading).multiplyScalar(this.worldScale()).add(this.pos);
    out.y = 0;
    return out;
  }

  // After world matrices are current: limbs, shadow and shader uniforms.
  postPose(t, dt) {
    const S = this.worldScale();
    const cps = this.cps || 1.5;
    const fwd = (this._fwd ||= V()).set(Math.sin(this.heading), 0, Math.cos(this.heading));
    const dangling = this.state === 'held' || (this.state === 'air' && this.pos.y > 0.02);
    const ragdoll = this.die && this.die.fallen;
    // Feet rest on the floor, or on wherever the floor is as a dead body sinks.
    const floor = (this.sinkY || 0) + BALL_R;

    let worst = 0;
    for (const leg of this.legs) {
      const h = this.cg.hips[leg.i];
      const hip = (leg.hipW ||= V());
      this.pivot.localToWorld(this.bodyPoint(h.x, h.y, h.z, h.w, hip));
      const rest = (this.legLen + h.y * this.scaler.scale.y) * S;
      const L = Math.max(rest - BALL_R, 0.01);
      const foot = leg.foot;
      const airborne = dangling && this.state !== 'held';
      if (airborne && !leg.wasAir) { leg.airOff = (leg.airOff || V()).subVectors(foot, hip); leg.airT = 0; }
      leg.wasAir = airborne;
      leg.lag ??= 0.015 + Math.random() * 0.05;

      if (this.sleepAmt > 0.01 && !dangling && !this.die) {
        foot.set(hip.x, floor, hip.z);
        leg.plant.copy(foot);
        leg.swing = false;
        const len = Math.max(hip.distanceTo(foot), 0.001);
        this.drawLimb(leg.meshes, hip, foot, len, fwd, true, 1 - this.sleepAmt);
        continue;
      }
      if (dangling) {
        if (this.state === 'held') {
          // Hanging down and kicking like mad, kept fairly close to the body.
          const sx = Math.cos(this.heading) * (h.x < 0 ? -1 : 1), sz = -Math.sin(this.heading) * (h.x < 0 ? -1 : 1);
          const k = leg.i * 1.7;
          const kick = 1 - 0.85 * (this.loveCalm || 0);
          const spread = 0.2 + (0.1 + Math.sin(t * 23 + k) * 0.22) * kick;
          tmp.set(sx * spread, -1, sz * spread);
          tmp.addScaledVector(fwd, (Math.sin(t * 27 + k * 1.3) * 0.5 + Math.sin(t * 13 + k) * 0.18) * kick);
          // Held legs stay straight and swing loosely about the hip.
          tmp.normalize();
          leg.heldDir = leg.heldDir && !this.snapLimbs ? leg.heldDir.lerp(tmp, Math.min(1, dt * 30)).normalize() : tmp.clone();
          foot.copy(hip).addScaledVector(leg.heldDir, L * 0.999);
          leg.knee = null;
          leg.airOff = null;
        } else {
          // Rising, the legs swing outward like wings; falling, they gather
          // back under the body ready to land.
          const g = this.hopT > 0 ? HOP_GRAVITY : GRAVITY;
          const rise = this.vel.y > 0 ? clamp((this.vel.y + g * leg.lag) / 2.5, 0, 1) : 0;
          leg.airT = (leg.airT || 0) + dt;
          // Little hops on the spot barely spread; big launches spread like wings.
          const splay = (this.smallJump() ? 0.14 : 1.0) * rise;
          const side = h.x < -0.01 ? -1 : h.x > 0.01 ? 1 : 0;
          const sx = Math.cos(this.heading) * side, sz = -Math.sin(this.heading) * side;
          tmp.set(sx * Math.sin(splay), -Math.cos(splay), sz * Math.sin(splay));
          if (!side) tmp.addScaledVector(fwd, (h.z > 0 ? 1 : -1) * Math.sin(splay)).normalize();
          tmp.multiplyScalar(L * 0.98);
          leg.airOff ||= tmp.clone();
          if (this.snapLimbs) leg.airOff.copy(tmp);
          else if (leg.airT > leg.lag) {
            // Coming down, the legs straighten right under the hips for touchdown.
            const landing = this.vel.y < 0 && this.pos.y < 0.4;
            leg.airOff.lerp(tmp, Math.min(1, dt * (landing ? 30 : 12 + leg.lag * 120)));
          }
          foot.copy(hip).add(leg.airOff);
        }
        foot.y = Math.max(foot.y, BALL_R);
        leg.swing = false;
        leg.plant.copy(foot);
      } else if (this.die) {
        // Limp legs fall toward the floor with a little lag.
        if (leg.frozen) {
          this.pivot.localToWorld(foot.copy(leg.frozen));
        } else if (ragdoll) {
          if (this.die.collapse) {
            const out = tmp2.set(hip.x - this.pos.x, 0, hip.z - this.pos.z);
            if (out.lengthSq() < 1e-6) out.copy(fwd);
            tmp.copy(hip).addScaledVector(out.normalize(), L * 0.9).addScaledVector(up, -L * 0.4);
          } else tmp.copy(hip).addScaledVector(up, -L);
          // Many-legged bodies fling their legs out fast as they drop.
          const snap = this.die.collapse ? 2.8 * (0.85 + (leg.lag || 0.03) * 5) : 1;
          leg.fvel.addScaledVector(tmp.sub(foot), dt * 55 * snap * snap).multiplyScalar(1 - Math.min(1, dt * 5 * snap));
          foot.addScaledVector(leg.fvel, dt);
          if (this.die.settleT > 0 && !leg.frozen) leg.frozen = this.pivot.worldToLocal(foot.clone().max(tmp.set(-1e9, floor, -1e9)));
        } else {
          this.hipGround(leg, tmp);
          foot.lerp(tmp, Math.min(1, dt * 12));
          foot.y = floor;
        }
        if (!leg.frozen) foot.y = Math.max(foot.y, floor);
      } else {
        if (this.landFeet) { leg.plant.set(hip.x, floor, hip.z); leg.swing = false; }
        // Crouching to jump or soaking up a landing, the feet stay right under
        // the hips so the legs only fold forward, never splay out.
        if ((this.landT > 0 || this.state === 'crouch') && !leg.swing) leg.plant.set(hip.x, floor, hip.z);
        const p = fract(this.phase + leg.off);
        const inSwing = p >= 0.5;
        if (inSwing && !leg.swing) { leg.swing = true; leg.from.copy(leg.plant); }
        if (!inSwing && leg.swing) { leg.swing = false; leg.plant.copy(leg.to); }
        if (leg.swing) {
          const s = (p - 0.5) / 0.5;
          const e = s * s * (3 - 2 * s);
          leg.to.set(hip.x, 0, hip.z).addScaledVector(this.vel, 0.25 / cps);
          foot.lerpVectors(leg.from, leg.to, e);
          foot.y = floor + Math.sin(Math.PI * s) * this.stepLift();
        } else {
          foot.copy(leg.plant);
          foot.y = floor;
          // How far this planted foot has fallen out from under its hip.
          const off = Math.hypot(hip.x - foot.x, hip.z - foot.z);
          worst = Math.max(worst, off / 0.055);
        }
      }
      if (foot.distanceTo(hip) > rest * 1.8 + 0.1) {
        foot.copy(hip).addScaledVector(up, -rest);
        foot.y = Math.max(foot.y, floor);
        leg.plant.copy(foot);
        leg.swing = false;
      }
      // Never draw a limb longer than its natural straight length.
      const end = tmp4.copy(foot);
      if (end.distanceTo(hip) > L) end.sub(hip).setLength(L).add(hip);
      const tuck = this.tuck || 0;
      if (tuck > 0.001) {
        const Lt = Math.max(L * (1 - tuck), 0.001);
        end.sub(hip).setLength(Lt).add(hip);
        this.drawLimb(leg.meshes, hip, end, Lt, fwd, true, 1 - tuck);
      } else this.drawLimb(leg.meshes, hip, end, L, this.state === 'held' && leg.knee ? leg.knee : fwd, true);
    }
    this.landFeet = false;
    // Start stepping once a foot is well out from under the body, and keep
    // going until every planted foot is close in again.
    const canStep = this.grounded() && !this.die && this.state !== 'merge' && this.state !== 'bud';
    if (!canStep) this.feetOff = false;
    else if (worst > 1.4) this.feetOff = true;
    else if (worst < 0.6) this.feetOff = false;

    // Arms can be lost on a rebuild when new side ears leave no room for them.
    if (this.armLimbs) for (const arm of this.armLimbs) for (const m of arm.meshes) m.visible = !!this.cg.arms;
    if (this.armLimbs && this.cg.arms) {
      const ph = this.phase * Math.PI * 2;
      const gw = smooth(0.1, 0.5, this.walkSpeed || 0);
      const right = (this._right ||= V()).set(Math.cos(this.heading), 0, -Math.sin(this.heading));
      for (const arm of this.armLimbs) {
        const a = this.cg.arms[arm.i];
        const sh = (arm.shW ||= V());
        this.pivot.localToWorld(this.bodyPoint(a.x, a.y, a.z, a.w, sh));
        const len = a.len * S;
        // Rest hangs outward and down. Walking swings opposite the legs,
        // being held flails, noticing waves the outer arm.
        let out = 0.55, dn = -0.75, fw = 0;
        // Each arm swings with the opposite leg: forward as that foot reaches forward.
        if (gw > 0) fw = a.s * Math.cos(ph) * 0.75 * gw;
        if (this.state === 'held') { out = 0.7; dn = 0.4 + Math.sin(t * 16 + arm.i * 2) * 0.5; fw = Math.cos(t * 13 + arm.i) * 0.3; }
        if (this.state === 'air') { const rise = clamp(this.vel.y / 2.5, 0, 1) * (this.smallJump() ? 0.3 : 1); out = 1; dn = -0.3 + 1.0 * rise; fw = 0; }
        if (this.noticeT > 0.3 && a.s > 0) { out = 0.5; dn = 0.85; fw = Math.sin(t * 12) * 0.35; }
        // One full wave every 0.3 seconds. The hand eases into each end and
        // lingers there, then whips across, so the wave reads as snappy.
        if (this.waveT > 0 && a.s > 0) {
          const p = fract(t / 0.3);
          const tri = p < 0.5 ? p * 2 : 2 - p * 2;
          out = 0.3 + (smooth(0.2, 0.8, tri) * 2 - 1) * 0.75;
          dn = 1.1;
          fw = 0.3;
        }
        if (this.state === 'dance') { const sw = Math.sin(t * (this.danceRate || 6) - 1.1 + arm.i * Math.PI); out = 0.6; dn = 0.6 + sw * 0.4; fw = 0.2; }
        if (this.hoverLoveT > 0 || this.state === 'merge') { out = 0.45; dn = 0.7 + Math.sin(t * 10 + arm.i * Math.PI) * 0.3; }
        if (arm.frozen) {
          this.pivot.localToWorld(arm.hand.copy(arm.frozen));
          this.drawLimb(arm.meshes, sh, arm.hand, len, fwd, false);
          continue;
        }
        if (ragdoll) {
          arm.hvel ||= V();
          tmp2.copy(sh).addScaledVector(up, -len);
          arm.hvel.addScaledVector(tmp2.sub(arm.hand), dt * 55).multiplyScalar(1 - Math.min(1, dt * 5));
          arm.hand.addScaledVector(arm.hvel, dt);
          arm.hand.y = Math.max(arm.hand.y, floor);
          if (arm.hand.distanceTo(sh) > len) arm.hand.sub(sh).setLength(len).add(sh);
          if (this.die.settleT > 0) arm.frozen = this.pivot.worldToLocal(arm.hand.clone());
          this.drawLimb(arm.meshes, sh, arm.hand, len, fwd, false);
          continue;
        }
        tmp.copy(right).multiplyScalar(a.s * out).addScaledVector(up, dn).addScaledVector(fwd, fw).normalize();
        this.clearArm(sh, tmp, len, right, a.s);
        tmp2.copy(sh).addScaledVector(tmp, len);
        tmp2.y = Math.max(tmp2.y, floor);
        arm.hand.lerp(tmp2, this.snapLimbs || (this.waveT > 0 && a.s > 0) ? 1 : Math.min(1, dt * 22));
        if (arm.hand.distanceTo(sh) > len * 1.8) arm.hand.copy(tmp2);
        // The eased hand can cut a corner through the body, so check it again.
        tmp.subVectors(arm.hand, sh).normalize();
        this.clearArm(sh, tmp, len, right, a.s);
        arm.hand.copy(sh).addScaledVector(tmp, len);
        arm.hand.y = Math.max(arm.hand.y, floor);
        this.drawLimb(arm.meshes, sh, arm.hand, len, fwd, false);
      }
    }

    this.snapLimbs = false;
    this.limbGroup.visible = !this.hideAll && this.state !== 'bud' && !!this.meshed;
    this.body.visible = !this.hideBody && !this.hideAll && this.meshed;

    const sr = this.radius() * 3.6 + 0.3;
    this.shadow.position.set(this.pos.x, 0.004, this.pos.z);
    this.shadow.scale.set(sr, 1, sr * 0.9);
    const lift = this.state === 'held' || this.state === 'air' ? this.pos.y : 0;
    const fade = this.die && this.die.sink ? 1 - this.die.sink / SINK : 1;
    this.shadow.material.opacity = this.state === 'held' ? 0.22 : 0.13 * clamp(1 - lift * 0.5, 0.3, 1) * fade;
    this.shadow.visible = !this.hideAll && this.state !== 'bud';

    const u = this.mat.uniforms;
    u.uTime.value = t;
    u.uLag.value.copy(this.lag);
    u.uTremble.value = this.tremble;
    u.uTint.value.copy(this.tint);
    u.uTintAmt.value = this.tintAmt;
    // In love they go fully red, however grey they had become.
    u.uGrey.value = this.hoverLoveT > 0 ? 0 : this.grey;
    // Sinking bodies wash out to white on the way down.
    const wash = this.die && this.die.sink ? smooth(0, SINK * 0.8, this.die.sink) : 0;
    if (!(this.hoverLoveT > 0)) this.hoverWhite = 0;
    u.uFlash.value = Math.max(this.flash, wash, (this.hoverWhite || 0) * 0.9);
    this.legMat.uniforms.uColor.value.set(...INK).lerp(tmp.set(1, 1, 1), wash);
    this.face.material.opacity = 1 - wash;
    this.body.worldToLocal(u.uCamLocal.value.copy(this.app.camera.position));
    const c = this.cg.center, b = this.cg.bounds;
    const ex = (b.max[0] - b.min[0]) * 0.5, ey = (b.max[1] - b.min[1]) * 0.5, ez = (b.max[2] - b.min[2]) * 0.5;
    this.g.blobs.forEach((bl, i) => {
      u.uBlobPos.value[i].set(
        c[0] + Math.sin(t * bl.f[0] + bl.ph[0]) * ex * bl.amp * 1.6,
        c[1] + Math.sin(t * bl.f[1] + bl.ph[1]) * ey * bl.amp * 1.6,
        c[2] + Math.sin(t * bl.f[2] + bl.ph[2]) * ez * bl.amp * 1.2,
        bl.r * Math.min(ex, ey) * 1.25
      );
    });
  }

  // Two-segment tube with a knee or elbow, ending in a ball. Every creature
  // shares the same tube and ball size.
  // Swings an arm direction outward until the whole arm stays clear of the
  // body. Points along the arm are tested against the body's shape in its own
  // space. Only the part past the shoulder is checked, since the shoulder sits
  // on the surface.
  clearArm(sh, dir, len, right, side) {
    const prims = this.cg.prims;
    const inv = (this._bodyInv ||= new THREE.Matrix4()).copy(this.body.matrixWorld).invert();
    const scale = Math.cbrt(Math.abs(this.body.matrixWorld.determinant())) || 1;
    // Clearance in body units: the limb's thickness plus a little air for the blur.
    const margin = (LIMB_R * 1.5 + 0.03) / scale;
    const p = this._armP ||= V();
    const clearance = () => {
      let worst = Infinity;
      for (const f of [0.35, 0.6, 0.85, 1]) {
        p.copy(sh).addScaledVector(dir, len * f).applyMatrix4(inv);
        worst = Math.min(worst, evalPrims(prims, p.x, p.y, p.z));
      }
      return worst;
    };
    for (let i = 0; i < 10 && clearance() < margin; i++) dir.addScaledVector(right, side * 0.25).normalize();
  }

  drawLimb(meshes, a, b, L, fwd, kneeForward, ballScale = 1) {
    const [upper, lower, joint, end] = meshes;
    const d = a.distanceTo(b);
    const mid = tmp2.addVectors(a, b).multiplyScalar(0.5);
    const bend = d < L ? Math.sqrt(L * L * 0.25 - d * d * 0.25) : 0;
    joint.position.copy(mid).addScaledVector(fwd, bend * (kneeForward ? 1 : -0.5));
    if (!kneeForward) joint.position.y -= bend * 0.4;
    segment(upper, a, joint.position, LIMB_R);
    segment(lower, joint.position, b, LIMB_R);
    joint.scale.setScalar(LIMB_R);
    end.position.copy(b);
    end.scale.setScalar(BALL_R * ballScale);
  }

  dispose() {
    this.disposed = true;
    this.app.scene.remove(this.root, this.limbGroup, this.shadow);
    this.body.geometry.dispose();
    this.mat.dispose();
    this.legMat.dispose();
    this.face.material.dispose();
    this.faceTex.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}

function cgScale(g) {
  const e = Math.pow(g, 0.85);
  return { w: 1 + 1.1 * e, h: 1 + 2 * e };
}

function segment(mesh, a, b, r) {
  const dir = tmp3.subVectors(b, a);
  const len = dir.length() || 1e-4;
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(up, dir.multiplyScalar(1 / len));
  mesh.scale.set(r, len, r);
}
