import * as THREE from 'three';
import { Stage, LAYER } from './stage.js';
import { Emotes } from './emotes.js';
import { Creature, LIFE } from './creature.js';
import { Merge } from './merge.js';
import { seedPopulation, randomGenome } from './genome.js';
import { makeRng } from './rng.js';
import { setupDials } from './dials.js';

const START_COUNT = 7;
const MAX_POP = 22;
// How far above the floor a carried creature's body hovers.
const HOLD_LIFT = 0.45;
const DROP_EVERY = 10;

class Input {
  constructor(app) {
    this.app = app;
    this.el = app.stage.canvas;
    this.pointers = new Map();
    this.held = null;
    this.holdTarget = null;
    this.hover = null;
    this.ray = new THREE.Raycaster();
    this.ray.layers.set(LAYER.BODY);
    this.ndc = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hit = new THREE.Vector3();
    this.holdVel = new THREE.Vector3();
    this.lastHold = new THREE.Vector3();

    const el = this.el;
    el.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.move(e));
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e));
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.hover = null; });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const o = app.stage.orbit;
      o.zoom = THREE.MathUtils.clamp(o.zoom * Math.exp(e.deltaY * 0.0012), 0.45, 1.5);
      app.stage.userZoomed = true;
      app.stage.updateCamera();
    }, { passive: false });
  }

  setRay(x, y) {
    const r = this.el.getBoundingClientRect();
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.app.camera);
  }

  pick(x, y) {
    this.setRay(x, y);
    const bodies = this.app.creatures.filter((c) => !c.isBusy() && c.body.visible).map((c) => c.body);
    const hits = this.ray.intersectObjects(bodies, false);
    if (hits.length) return { c: hits[0].object.userData.creature, point: hits[0].point.clone() };
    // Forgiving touch: nearest creature on screen within a small radius.
    const r = this.el.getBoundingClientRect();
    let best = null, bd = 34;
    const v = new THREE.Vector3();
    for (const c of this.app.creatures) {
      if (c.isBusy()) continue;
      c.bodyCenter(v).project(this.app.camera);
      const d = Math.hypot((v.x * 0.5 + 0.5) * r.width + r.left - x, (-v.y * 0.5 + 0.5) * r.height + r.top - y);
      if (d < bd) { bd = d; best = c; }
    }
    return best ? { c: best, point: best.bodyCenter(new THREE.Vector3()) } : null;
  }

  down(e) {
    this.el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (this.pointers.size === 2) {
      this.cand = null;
      if (this.held) this.drop(this.held);
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.app.stage.orbit.zoom };
      return;
    }
    if (this.pointers.size > 2) return;
    this.cand = this.pick(e.clientX, e.clientY);
    this.orbiting = !this.cand;
    this.app.hideHint?.();
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    const r = this.el.getBoundingClientRect();
    this.hover = this.held || (!p && e.pointerType !== 'mouse') ? null : { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.app.stage.orbit.zoom = THREE.MathUtils.clamp(this.pinch.zoom * (this.pinch.d / Math.max(d, 1)), 0.45, 1.5);
      this.app.stage.userZoomed = true;
      this.app.stage.updateCamera();
      return;
    }

    if (this.cand && !this.held && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) {
      const { c, point } = this.cand;
      this.held = c;
      this.cand = null;
      this.hover = null;
      c.pickUp(point);
      // Carry over the floor, the way most games do: the pointer picks a spot
      // on the ground and the creature hovers a fixed height above it, so how
      // high it is never changes what it is over. It eases up into the hover.
      const center = c.bodyCenter(new THREE.Vector3());
      this.holdFrom = point.y;
      this.holdTo = center.y - c.pos.y + HOLD_LIFT;
      this.holdLift = 0;
      this.lastPtr = [e.clientX, e.clientY];
      this.lastHold.copy(point);
      this.holdTarget = point.clone();
      this.holdVel.set(0, 0, 0);
      this.trackHold(e.clientX, e.clientY);
    } else if (this.held) {
      this.trackHold(e.clientX, e.clientY);
      const c = this.held;
      const dir = Math.sign(dx);
      if (Math.abs(dx) > 9) {
        if (c.lastHoldDir && dir !== c.lastHoldDir) c.shakeCount++;
        c.lastHoldDir = dir;
      }
    } else if (this.orbiting) {
      const o = this.app.stage.orbit;
      o.yaw -= dx * 0.006;
      // Track how fast the swipe is turning the view, for the glide after release.
      const now = performance.now(), dtS = Math.max(1, now - (this.lastOrbitT || now - 16)) / 1000;
      this.lastOrbitT = now;
      const v = (-dx * 0.006) / dtS;
      this.app.stage.yawVel += (v - this.app.stage.yawVel) * Math.min(1, dtS * 18);
      this.app.stage.dragging = true;
      o.pitch = THREE.MathUtils.clamp(o.pitch + dy * 0.004, 0.16, 1.1);
      this.app.stage.userOrbited = true;
      this.app.stage.updateCamera();
    }
  }

  trackHold(x, y) {
    this.lastPtr = [x, y];
    const k = this.holdLift;
    const e = k * k * (3 - 2 * k);
    const h = this.holdFrom + (this.holdTo - this.holdFrom) * e;
    this.plane.set(new THREE.Vector3(0, 1, 0), -h);
    this.setRay(x, y);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return;
    const R = this.app.arena * 1.05, rr = Math.hypot(this.hit.x, this.hit.z);
    if (rr > R) { this.hit.x *= R / rr; this.hit.z *= R / rr; }
    this.holdTarget.copy(this.hit);
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      this.orbiting = false;
      this.app.stage.dragging = false;
      return;
    }
    if (!p) return;
    if (this.held) this.drop(this.held, true);
    else if (this.cand) {
      this.cand.c.tap();
    }
    this.cand = null;
    if (this.orbiting) {
      // A swipe that stopped before release shouldn't fling the view.
      if (performance.now() - (this.lastOrbitT || 0) > 90) this.app.stage.yawVel = 0;
      this.app.stage.dragging = false;
      this.lastOrbitT = 0;
    }
    this.orbiting = false;
    if (e.pointerType !== 'mouse') this.hover = null;
  }

  drop(c, thrown = false) {
    if (this.held !== c) return;
    this.held = null;
    this.holdTarget = null;
    if (thrown && this.app.onDrop(c)) return;
    c.release(thrown ? this.holdVel.clone() : new THREE.Vector3());
  }

  update(dt) {
    const c = this.held;
    if (!c) return;
    if (this.holdLift < 1) {
      this.holdLift = Math.min(1, this.holdLift + dt / 0.18);
      this.trackHold(...this.lastPtr);
    }
    const v = new THREE.Vector3().subVectors(this.holdTarget, this.lastHold).multiplyScalar(1 / Math.max(dt, 1e-4));
    this.holdVel.lerp(v, Math.min(1, dt * 14));
    this.lastHold.copy(this.holdTarget);
  }
}

class App {
  constructor() {
    this.stage = new Stage(document.getElementById('view'));
    this.scene = this.stage.scene;
    this.camera = this.stage.camera;
    this.emotes = new Emotes(this.scene);
    this.input = new Input(this);
    setupDials(this.stage);
    this.stage.startIntro();
    this.creatures = [];
    this.merges = [];
    this.time = 0;
    this.ui = {
      count: document.getElementById('count'),
      clock: document.getElementById('clock'),
      best: document.getElementById('best'),
      over: document.getElementById('over'),
      overText: document.getElementById('over-text'),
      hint: document.getElementById('hint'),
    };
    document.getElementById('again').addEventListener('click', () => this.start());
    this.last = performance.now();
    this.start();
    const loop = (now) => {
      // The first frame's timestamp can land just before the constructor's clock.
      const dt = Math.max(0, Math.min(1 / 30, (now - this.last) / 1000));
      this.last = now;
      if (!this.paused) this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  get arena() { return this.stage.arena; }

  start() {
    for (const m of this.merges) if (!m.done) m.pop();
    for (const c of this.creatures) c.dispose();
    this.overlap = null;
    this.creatures = [];
    this.merges = [];
    this.rng = makeRng((Math.random() * 2 ** 31) | 0);
    this.clock = 0;
    this.nextDrop = DROP_EVERY;
    this.births = 0;
    this.bestGen = 1;
    this.overShown = false;
    this.ui.over.classList.remove('show');
    const genomes = seedPopulation(this.rng, START_COUNT);
    // Everyone drops in from the sky. The first lands right away, the last
    // 0.7 seconds later, the rest scattered in between.
    const delays = genomes.map((_, i) => (i === 0 ? 0 : i === genomes.length - 1 ? 0.7 : this.rng.range(0.05, 0.65)));
    this.drops = [];
    this.dropT = 0;
    const ages = this.rng.shuffle([0, 3, 7, 10, 14, 18, 22]);
    const spots = [];
    genomes.forEach((g, i) => {
      let x, z, tries = 0;
      do {
        const a = this.rng.range(0, Math.PI * 2), r = Math.sqrt(this.rng.next()) * this.arena * 0.7;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      } while (tries++ < 40 && spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 1.4));
      spots.push([x, z]);
      const age = ages[i % ages.length];
      this.drops.push({ at: delays[i], make: () => {
        const c = new Creature(this, g, x, z, age);
        c.state = 'air';
        c.pos.y = c.prevPos.y = 4.2;
        c.vel.set(0, 0, 0);
        c.surpriseT = 1.5;
        c.snapLimbs = true;
        this.creatures.push(c);
      } });
    });
  }

  // A hue the garden is short on. Every colour patch on every creature counts
  // toward its hue band, and the emptiest band wins.
  freshHue() {
    const BANDS = 12, count = new Array(BANDS).fill(0);
    const add = (h, w) => {
      const b = (((h % 360) + 360) % 360) / (360 / BANDS);
      const i = Math.floor(b), f = b - i;
      count[i % BANDS] += w * (1 - f);
      count[(i + 1) % BANDS] += w * f;
    };
    for (const c of this.creatures) {
      add(c.g.palette.base[0], 1);
      for (const col of c.g.palette.cols) add(col[0], 0.4);
    }
    const low = Math.min(...count);
    const open = count.map((v, i) => [v, i]).filter(([v]) => v <= low + 0.25).map(([, i]) => i);
    const band = this.rng.pick(open);
    return band * (360 / BANDS) + this.rng.range(-8, 8);
  }

  dropIn(g, age = 0, height = 6) {
    // Never land on a birth in progress.
    let x = 0, z = 0;
    for (let k = 0; k < 30; k++) {
      const a = this.rng.range(0, Math.PI * 2), r = Math.sqrt(this.rng.next()) * this.arena * 0.8;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      if (!this.inPocket(x, z, 0.6)) break;
    }
    const c = new Creature(this, g, x, z, age);
    c.state = 'air';
    c.pos.y = c.prevPos.y = height;
    c.vel.set(0, 0, 0);
    c.surpriseT = 1.2;
    c.newcomer = true;
    c.snapLimbs = true;
    this.creatures.push(c);
    return c;
  }

  // Dev: saves the current frame into shots/.
  shot() {
    this.stage.render();
    const url = this.stage.canvas.toDataURL('image/png');
    return fetch(url).then((r) => r.blob()).then((b) => fetch('/_shot', { method: 'POST', body: b })).then((r) => r.text());
  }

  hideHint() { if (this.births > 0) this.ui.hint.classList.add('gone'); }

  tryMerge(a, b) {
    if (!a.canBreed() || !b.canBreed()) return;
    if (this.creatures.length >= MAX_POP) {
      a.loveT = b.loveT = 0;
      return;
    }
    this.merges.push(new Merge(this, a, b));
  }

  onBirth(c) {
    if (!c) return;
    this.births++;
    this.bestGen = Math.max(this.bestGen, c.g.gen);
    if (this.births >= 2) this.ui.hint.classList.add('gone');
  }

  // While dragging, the creature under the one you hold stops and looks up at
  // you. After a moment they fall for each other, or it runs if anyone is angry.
  canTarget(o) {
    if (o.isBusy() || o.state === 'flee' || o.state === 'held') return false;
    return o.grounded() || o.smallJump();
  }

  checkOverlap(dt) {
    const h = this.input.held;
    if (!h) { this.overlap = null; return; }
    // A generous reach, but only ever one target: the closest by how far
    // inside its reach the held creature is. The current target holds on
    // until another is clearly closer, so it never flickers between two.
    const reach = (o) => (o.radius() + h.radius()) * 1.5 + 0.2;
    const score = (o) => Math.hypot(o.pos.x - h.pos.x, o.pos.z - h.pos.z) / reach(o);
    let best = null, bd = Infinity;
    for (const o of this.creatures) {
      if (o === h || !this.canTarget(o)) continue;
      const d = score(o);
      if (d < 1 && d < bd) { bd = d; best = o; }
    }
    const cur = this.overlap?.c;
    if (cur && cur !== best && this.canTarget(cur)) {
      const dc = score(cur);
      if (dc < 1.1 && !(best && bd < dc * 0.75)) best = cur;
    }
    if (!best) { this.overlap = null; return; }
    if (!this.overlap || this.overlap.c !== best) this.overlap = { c: best, t: 0 };
    const ov = this.overlap;
    ov.t += dt;
    best.attendT = 0.2;
    best.hopT = 0;
    if (ov.t > 0.25) {
      if (h.angerT > 0 || best.angerT > 0) {
        best.flee(h);
        this.overlap = null;
      } else if (h.canBreed(true) && best.canBreed(true)) {
        // Both hearts start beating on the same clock, so they pulse together.
        if (!ov.love) { ov.love = true; h.kick(-0.6); best.kick(-0.6); h.beat0 = best.beat0 = this.time; }
        h.hoverLoveT = best.hoverLoveT = 0.1;
        this.lastLove = { c: best, t: this.time };
      }
    }
  }

  // A newcomer thumping down startles anyone right beside it into looking over.
  // A body about to topple: anyone standing where it will land notices and
  // hurries sideways out of the way, watching it go down.
  onTopple(c, dir, reach) {
    for (const o of this.creatures) {
      if (o === c || o.isBusy() || !o.grounded() || o.state === 'held') continue;
      const rx = o.pos.x - c.pos.x, rz = o.pos.z - c.pos.z;
      const along = rx * dir.x + rz * dir.z;
      const perp = rx * -dir.z + rz * dir.x;
      const clear = c.radius() + o.radius() + 0.15;
      if (along < -o.radius() || along > reach + o.radius() || Math.abs(perp) > clear) continue;
      const side = perp === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(perp);
      const move = clear - Math.abs(perp) + 0.35;
      if (o.state === 'sleep' || o.state === 'seek') o.state = 'wander';
      o.target = { x: o.pos.x + -dir.z * side * move, z: o.pos.z + dir.x * side * move };
      o.dodgeT = 1.2;
      o.surpriseT = Math.max(o.surpriseT, 0.6);
      o.lookAtT = 0;
      o.pause = 1.5;
    }
  }

  onArrival(n) {
    for (const o of this.creatures) {
      if (o === n || o.isBusy() || !o.grounded() || o.state === 'held') continue;
      const d = Math.hypot(o.pos.x - n.pos.x, o.pos.z - n.pos.z) - o.radius() - n.radius();
      if (d > 1.1) continue;
      if (o.state === 'sleep' || o.state === 'seek') o.state = 'wander';
      o.surpriseT = Math.max(o.surpriseT, 0.8);
      o.desHeading = Math.atan2(n.pos.x - o.pos.x, n.pos.z - o.pos.z);
      o.lookAtT = 1.4;
      o.lookAt = n;
      o.target = null;
      o.pause = Math.max(o.pause, 1.2);
    }
  }

  inPocket(x, z, r = 0) {
    return this.merges.some((m) => !m.done && Math.hypot(x - m.mid.x, z - m.mid.z) < m.pocket + r);
  }

  // Letting go while the pair is in love always makes a baby. The garden's
  // population cap only limits pairs that meet on their own.
  onDrop(c) {
    const love = this.lastLove && this.time - this.lastLove.t < 0.3 ? this.lastLove.c : null;
    const ov = this.overlap || (love ? { c: love } : null);
    this.overlap = null;
    this.lastLove = null;
    if (!ov || ov.c.isBusy() || c.angerT > 0 || ov.c.angerT > 0) return false;
    if (!c.canBreed(true) || !ov.c.canBreed(true)) return false;
    this.merges.push(new Merge(this, c, ov.c));
    return true;
  }

  separate() {
    const cs = this.creatures;
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      if (!a.grounded() || a.isBusy()) continue;
      for (let j = i + 1; j < cs.length; j++) {
        const b = cs[j];
        if (!b.grounded() || b.isBusy()) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz) || 1e-3;
        const lovers = a.loveTarget === b && b.loveTarget === a;
        const min = (a.radius() + b.radius()) * (lovers ? 0.75 : 1.02);
        if (d < min) {
          const push = (min - d) * 0.5;
          a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push;
          b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push;
        }
      }
    }
  }

  frame(dt) {
    this.time += dt;
    const t = this.time;
    if (this.creatures.length) this.clock += dt;
    if (this.drops?.length) {
      this.dropT = (this.dropT || 0) + dt;
      for (const d of this.drops.filter((d) => d.at <= this.dropT)) d.make();
      this.drops = this.drops.filter((d) => d.at > this.dropT);
    }
    // A newcomer falls from the sky every ten seconds.
    this.nextDrop -= dt;
    if (this.nextDrop <= 0) {
      this.nextDrop = DROP_EVERY;
      if (this.creatures.length && this.creatures.length < MAX_POP) this.dropIn(randomGenome(this.rng, { hue: this.freshHue() }));
    }

    for (const m of this.merges) m.drive(dt);
    for (const c of this.creatures) c.update(dt, t);
    this.input.update(dt);
    this.checkOverlap(dt);
    this.separate();
    this.separate();

    for (const c of this.creatures) if (c.needsRebuild()) c.rebuild();

    this.scene.updateMatrixWorld();
    for (const c of this.creatures) c.postPose(t, dt);
    for (const m of this.merges) m.remesh(t);
    this.merges = this.merges.filter((m) => !m.done);

    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (c.dead) {
        c.dispose();
        this.creatures.splice(i, 1);
      }
    }
    this.emotes.update(dt, this.creatures);

    this.stage.updateIntro(dt);
    this.stage.holding = !!this.input.held;
    this.stage.updateOrbit(dt);
    this.stage.cloudActive = this.merges.length > 0;
    if (this.stage.cloudActive) {
      // Depth of the nearest merge cloud, for sorting it against the bodies.
      let best = 1;
      for (const m of this.merges) {
        const p = m.mid.clone().setY(m.size * 0.9).project(this.camera);
        best = Math.min(best, p.z * 0.5 + 0.5);
      }
      this.stage.cloudDepth = best;
    }
    this.stage.render(t);
    this.updateUI();
  }

  updateUI() {
    const n = this.creatures.length;
    this.ui.count.textContent = n;
    const s = Math.floor(this.clock);
    this.ui.clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.ui.best.textContent = this.bestGen;
    // Not over while the opening drop is still on its way down.
    if (!n && !this.merges.length && !this.drops?.length && !this.overShown) {
      this.overShown = true;
      this.ui.overText.textContent = `They kept going for ${this.ui.clock.textContent} and made it to generation ${this.bestGen}.`;
      setTimeout(() => this.ui.over.classList.add('show'), 900);
    }
  }
}

window.gg = new App();
window.gg.LIFE = LIFE;
