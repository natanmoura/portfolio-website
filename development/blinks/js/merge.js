import * as THREE from 'three';
import { meshGooAsync } from './mesh-service.js';
import { createBodyMaterial } from './materials.js';
import { breed } from './genome.js';
import { Creature, GRAVITY } from './creature.js';
import { LAYER } from './stage.js';

// The two parents spin around each other faster and faster until they are one
// blurry cloud, then pop apart: parents fly out to either side and the baby
// shoots straight up. The cloud is the blended SDF of both bodies, meshed in a
// worker and counter-rotated so the spin stays smooth between meshes.

const POP_OUT = 0.55, POP_SPEED = 4.4, POP_UP = 5;
const T_GATHER = 0.18, T_CENTER = 0.42, T_POP = 1.0;
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
// The spin is drawn as a smear of trailing copies, close enough together that
// after the cloud blur they read as one continuous streak, not separate ghosts.
const TRAIL = 12;
const GHOSTS = Array.from({ length: TRAIL }, (_, i) => (i === 0
  ? { lag: 0, alpha: 0.92 }
  : { lag: (i / (TRAIL - 1)) * 0.34, alpha: 0.22 * Math.pow(1 - i / TRAIL, 1.5) }));

function participant(c) {
  const m = c.body.matrixWorld;
  const s = Math.cbrt(Math.abs(m.determinant()));
  if (s < 1e-3) return null;
  const inv = Array.from(new THREE.Matrix4().copy(m).invert().elements);
  const cg = c.cg;
  const center = c.body.localToWorld(new THREE.Vector3(...cg.center)).toArray();
  const sc = c.scaler.scale;
  const R = cg.radius * s * Math.max(1, sc.y / sc.x) * 1.05;
  return { prims: cg.prims, inv, s, center, R };
}

export class Merge {
  constructor(app, a, b) {
    this.app = app;
    this.a = a;
    this.b = b;
    this.t = 0;
    this.done = false;
    this.spin = 0;
    this.omega = 14;
    for (const c of [a, b]) {
      c.state = 'merge';
      c.vel.set(0, 0, 0);
      c.attendT = c.noticeT = 0;
      c.courted = true;
      // Pairs that met on their own beat in step through the merge too.
      if (c.hoverLoveT <= 0) c.beat0 = app.time;
      c.start = c.pos.clone();
    }
    this.mid = new THREE.Vector3().addVectors(a.pos, b.pos).multiplyScalar(0.5).setY(0);
    const u = new THREE.Vector3().subVectors(b.pos, a.pos).setY(0);
    this.spin0 = Math.atan2(u.z, u.x);
    this.ra = a.radius();
    this.rb = b.radius();
    this.size = (this.ra + this.rb) * 0.5;
    // Clear a pocket a little wider than where the parents will land, so the
    // birth has room. Measured from the centre to the edge of anyone nearby.
    this.pocket = (((this.ra + this.rb) * POP_OUT + POP_SPEED * ((2 * POP_UP) / GRAVITY)) * 1.15 + 0.5) * 1.15;

    const g = breed(a.g, b.g, app.rng);
    this.child = new Creature(app, g, this.mid.x, this.mid.z, 0);
    this.child.state = 'bud';
    this.child.hideAll = true;
    app.creatures.push(this.child);

    this.mats = GHOSTS.map((gh) => {
      const m = createBodyMaterial();
      const uu = m.uniforms;
      uu.uBase.value.set(...a.baseRGB);
      [a.baseRGB, a.colsRGB[1], b.baseRGB, b.colsRGB[1]].forEach((c, i) => uu.uBlobCol.value[i].set(...c));
      uu.uHeight.value.set(0, 10);
      uu.uAlpha.value = gh.alpha;
      // Only the lead copy gets the soft fresnel edge. On the faint trailing
      // copies it breaks thin parts up into speckle.
      uu.uCloud.value = gh.lag === 0 ? 0.45 : 0;
      m.transparent = true;
      m.depthWrite = gh.lag === 0;
      return m;
    });
    this.geo = new THREE.BufferGeometry();
    this.meshes = this.mats.map((m, i) => {
      const mesh = new THREE.Mesh(this.geo, m);
      mesh.frustumCulled = false;
      mesh.layers.set(LAYER.CLOUD);
      mesh.renderOrder = 5 + i;
      mesh.position.copy(this.mid);
      mesh.visible = false;
      app.scene.add(mesh);
      return mesh;
    });
    this.burst(2);
  }

  burst(n) {
    const top = new THREE.Vector3();
    this.a.headTop(top).lerp(this.b.headTop(new THREE.Vector3()), 0.5);
    for (let i = 0; i < n; i++) {
      const p = top.clone();
      p.x += (i - (n - 1) / 2) * 0.3;
      this.app.emotes.spawn('heart', p, 0.34, (i - (n - 1) / 2) * 0.35, 1.6);
    }
  }

  // Drives the parents before they update.
  drive(dt) {
    this.t += dt;
    const t = this.t;
    // Starts already spinning, then winds up. The pair pulls to the centre early.
    this.omega = 14 + 28 * Math.pow(Math.min(1, t / T_POP), 1.4);
    this.spin += this.omega * dt;
    const r0 = (this.ra + this.rb) * 0.45;
    const radius = r0 * (1 - 0.88 * ease(t / T_CENTER));
    const ang = this.spin0 + this.spin;
    const g = ease(t / T_GATHER);
    for (const [c, sgn] of [[this.a, -1], [this.b, 1]]) {
      const tx = this.mid.x + Math.cos(ang) * radius * sgn;
      const tz = this.mid.z + Math.sin(ang) * radius * sgn;
      c.pos.set(c.start.x + (tx - c.start.x) * g, c.start.y * (1 - g), c.start.z + (tz - c.start.z) * g);
      c.desHeading = c.heading = Math.atan2(c.pos.x - this.mid.x, c.pos.z - this.mid.z) + Math.PI / 2 + this.spin * 0.5;
      c.hoverLoveT = 0.2;
    }
    this.clearPocket();
    this.sprayT = (this.sprayT ?? 0) - dt;
    if (t > T_GATHER && this.sprayT <= 0) {
      this.sprayT = 0.07;
      // Flung off the rim along the spin, nearly flat, like a sprinkler.
      const a = Math.random() * Math.PI * 2;
      const radial = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      const speed = 2.6 + this.omega * 0.09 + Math.random() * 1.2;
      const v = radial.clone().multiplyScalar(0.55).addScaledVector(tangent, 0.85).normalize().multiplyScalar(speed);
      v.y = (Math.random() - 0.5) * 0.5;
      const p = this.mid.clone().setY(this.size * 0.9).addScaledVector(radial, this.size * 0.9);
      this.app.emotes.fling('heart', p, 0.18 + Math.random() * 0.08, v, 0.55 + Math.random() * 0.25);
    }
    if (t >= T_POP) this.pop();
  }

  // Nudges bystanders out of the pocket. Other couples mid-merge, anyone held,
  // in the air or dying are left alone.
  // Each bystander gets one smooth shove out to the pocket edge, like a
  // little force field. Anyone wandering in later gets their own single shove.
  clearPocket() {
    this.shoved ||= new Set();
    for (const o of this.app.creatures) {
      if (o === this.a || o === this.b || o === this.child || this.shoved.has(o) || o.shoving) continue;
      if (o.state === 'merge' || o.state === 'bud' || !o.grounded() || o.die) continue;
      const dx = o.pos.x - this.mid.x, dz = o.pos.z - this.mid.z;
      const d = Math.hypot(dx, dz) || 1e-3;
      const reach = this.pocket + o.radius();
      if (d >= reach) continue;
      const ang = d > 1e-2 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
      const dist = reach - d + 0.1;
      o.shove(Math.cos(ang) * dist, Math.sin(ang) * dist);
      this.shoved.add(o);
    }
  }

  // Requests a new cloud mesh when the last one is back; spins the meshes.
  remesh(time) {
    if (this.done) return;
    const t = this.t;
    const k = ease(t / T_CENTER);
    if (!this.inFlight) {
      const parts = [this.a, this.b].map(participant);
      if (parts[0] && parts[1]) {
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (const p of parts) for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], p.center[i] - p.R - 0.05);
          max[i] = Math.max(max[i], p.center[i] + p.R + 0.05);
        }
        const ext = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
        const spinAt = this.spin;
        this.inFlight = true;
        meshGooAsync({ parts, kAB: this.size * (0.2 + 1.2 * k), kC: 0 }, min, max, Math.max(0.03, ext / 40)).then((m) => {
          this.inFlight = false;
          if (this.done) return;
          const pos = m.positions;
          for (let i = 0; i < pos.length; i += 3) { pos[i] -= this.mid.x; pos[i + 2] -= this.mid.z; }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
          geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
          this.geo.dispose();
          this.geo = geo;
          this.meshSpin = spinAt;
          for (const mesh of this.meshes) mesh.geometry = geo;
          this.ready = true;
        });
      }
    }

    if (this.ready && t > T_GATHER) {
      for (const c of [this.a, this.b]) c.hideAll = true;
      const fp = (time * 2.6) % 1;
      const flash = fp < 0.07 ? fp / 0.07 : fp < 0.5 ? 1 : fp < 0.57 ? 1 - (fp - 0.5) / 0.07 : 0;
      this.meshes.forEach((mesh, i) => {
        mesh.visible = true;
        // Three.js yaw is clockwise seen from above, the spin angle is counter-clockwise in x/z.
        mesh.rotation.y = -(this.spin - this.meshSpin) + GHOSTS[i].lag * Math.min(1, this.omega / 30) * 3;
        const pulse = 1 + Math.sin(time * 22) * 0.04 * k;
        mesh.scale.set(pulse, 1 / pulse, pulse);
        const u = this.mats[i].uniforms;
        u.uTime.value = time;
        u.uCamLocal.value.copy(this.app.camera.position).sub(this.mid).applyAxisAngle(new THREE.Vector3(0, 1, 0), -mesh.rotation.y);
        u.uSize.value = this.size * 2.2;
        u.uTintAmt.value = 0;
        u.uFlash.value = 0.05 + 0.2 * flash * (0.4 + 0.6 * k);
        const blobs = [[this.a, 0], [this.a, 1], [this.b, 0], [this.b, 1]];
        blobs.forEach(([c, j], bi) => {
          const bp = c.mat.uniforms.uBlobPos.value[j];
          const s = Math.cbrt(Math.abs(c.body.matrixWorld.determinant()));
          const w = c.body.localToWorld(new THREE.Vector3(bp.x, bp.y, bp.z)).sub(this.mid);
          u.uBlobPos.value[bi].set(w.x, w.y, w.z, bp.w * s);
        });
      });
    }
  }

  pop() {
    if (this.done) return;
    this.done = true;
    for (const mesh of this.meshes) this.app.scene.remove(mesh);
    this.geo.dispose();
    for (const m of this.mats) m.dispose();

    const ang = this.spin0 + this.spin;
    const dir = new THREE.Vector3().setFromMatrixColumn(this.app.camera.matrixWorld, 0).setY(0).normalize();
    const out = (this.ra + this.rb) * POP_OUT;
    for (const [c, sgn] of [[this.a, -1], [this.b, 1]]) {
      c.hideAll = false;
      c.state = 'air';
      c.pos.copy(this.mid).addScaledVector(dir, out * sgn).setY(0.05);
      c.prevPos.copy(c.pos);
      c.vel.copy(dir).multiplyScalar(POP_SPEED * sgn).setY(POP_UP);
      const cam = this.app.camera.position;
      c.heading = c.desHeading = Math.atan2(cam.x - c.pos.x, cam.z - c.pos.z);
      c.hoverLoveT = 0;
      c.loveT = 0;
      c.loveTarget = null;
      // Surprised the whole way through the air; happy only once landed.
      c.surpriseT = 10;
      c.happyT = 0;
      c.popLand = true;
      c.breedCD = 4;
      c.kick(-1);
      c.snapLimbs = true;
    }
    const ch = this.child;
    ch.hideAll = false;
    ch.state = 'air';
    ch.pos.copy(this.mid).setY(this.size * 0.8);
    ch.prevPos.copy(ch.pos);
    // Launch straight up to about three times its own height.
    const tall = (ch.legLen + ch.cg.height) * ch.worldScale();
    ch.vel.set(0, Math.sqrt(2 * GRAVITY * 3.2 * tall), 0);
    const cam = this.app.camera.position;
    ch.heading = ch.desHeading = Math.atan2(cam.x - ch.pos.x, cam.z - ch.pos.z);
    ch.surpriseT = 10;
    ch.popLand = true;
    ch.flash = 0.8;
    ch.kick(1.2);
    ch.snapLimbs = true;
    this.app.onBirth?.(ch);
  }

  finish() { this.pop(); }
}
