/* ═══════════════════════════════════════════════════════════════
   Orbit — a sphere of recipe bubbles you can spin, focus and open.
   DOM text in 3D space (CSS3DSprite), so the type stays crisp and
   the bubbles keep facing you. Depth drives blur and opacity.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DSprite } from 'three/addons/renderers/CSS3DRenderer.js';

const RECIPES = window.RECIPES || [];
const RADIUS = 620;
// Far enough back that the whole sphere stays inside the stage —
// closer than this and the edge bubbles get clipped.
const CAM_Z = 1560;

const stage = document.getElementById('orbitStage');
const holder = document.getElementById('css3d');
const hint = document.getElementById('orbitHint');
const card = document.getElementById('orbitCard');
const cardTitle = document.getElementById('orbitCardTitle');
const cardMeta = document.getElementById('orbitCardMeta');
const cardOpen = document.getElementById('orbitCardOpen');
const cardPlan = document.getElementById('orbitCardPlan');
const dice = document.getElementById('diceBtn');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let scene, camera, renderer, group;
let bubbles = [];
let liveRadius = RADIUS;
let running = false;
let started = false;
let rafId = null;
let lastT = 0;

// Rotation state
const vel = { x: 0, y: reduceMotion ? 0 : 0.055 };
let dragging = false;
let moved = 0;
let lastPointer = { x: 0, y: 0 };

// Focus state
let focused = null;
let tween = null;

const tmpVec = new THREE.Vector3();
const upWorld = new THREE.Vector3(0, 0, 1);

/* ── Build ───────────────────────────────────────────────── */

function build() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 1, 6000);
  camera.position.z = CAM_Z;

  renderer = new CSS3DRenderer();
  holder.appendChild(renderer.domElement);

  group = new THREE.Group();
  scene.add(group);

  // Fibonacci sphere — even spacing, no clumps at the poles
  const n = RECIPES.length;
  const golden = Math.PI * (3 - Math.sqrt(5));

  RECIPES.forEach((r, i) => {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;

    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = r.title;
    el.style.setProperty('--dish', r.dish);
    el.dataset.slug = r.slug;

    const sprite = new CSS3DSprite(el);
    // Keep the unit direction so resize() can re-fit the sphere's size
    sprite.userData.dir = new THREE.Vector3(Math.cos(theta) * rad, y, Math.sin(theta) * rad);
    sprite.position.copy(sprite.userData.dir).multiplyScalar(RADIUS);
    sprite.userData.recipe = r;
    group.add(sprite);
    bubbles.push(sprite);

    // A tap always brings the bubble round to the front — same move as
    // picking one out of the search box. Opening is the card's job.
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (moved > 8) return;          // that was a drag, not a tap
      focus(sprite);
    });
  });

  resize();
  window.addEventListener('resize', resize);
  bindPointer();
}

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);

  // A narrow stage can't hold the sphere at full size. Shrink the sphere
  // rather than backing the camera off, so labels stay readable instead
  // of receding into specks.
  liveRadius = Math.max(130, Math.min(RADIUS, w * 0.40));
  bubbles.forEach((b) => b.position.copy(b.userData.dir).multiplyScalar(liveRadius));

  // CSS3D scale is focal / distance. Park the camera one radius behind
  // the focal length so the bubble nearest us renders at its true pixel
  // size, and everything behind it falls away from there.
  const focal = (h / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  camera.position.z = focal + liveRadius;
}

/* ── Interaction ─────────────────────────────────────────── */

function bindPointer() {
  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    lastPointer = { x: e.clientX, y: e.clientY };
    stage.classList.add('is-dragging');
    stage.setPointerCapture(e.pointerId);
    tween = null;
    hideHint();
  });

  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer = { x: e.clientX, y: e.clientY };
    moved += Math.abs(dx) + Math.abs(dy);
    vel.y = dx * 0.35;
    vel.x = dy * 0.35;
    spin(vel.x, vel.y);
  });

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-dragging');
    try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  // Tapping empty space lets go of the focused bubble
  stage.addEventListener('click', (e) => {
    if (moved > 8) return;
    if (e.target === stage || e.target === holder || e.target === renderer.domElement) blur();
  });

  dice.addEventListener('click', roll);

  cardPlan.addEventListener('click', (e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('orbit:plan', { detail: { slug: cardPlan.dataset.slug } }));
  });
}

function spin(dx, dy) {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(THREE.MathUtils.degToRad(dx), THREE.MathUtils.degToRad(dy), 0)
  );
  group.quaternion.premultiply(q);
}

/* ── Focus ───────────────────────────────────────────────── */

function focus(sprite, dur = 0.85) {
  focused = sprite;

  bubbles.forEach((b) => b.element.classList.toggle('is-focused', b === sprite));

  // Turn the sphere so this bubble's direction points at the camera
  const dir = sprite.position.clone().normalize();
  const to = new THREE.Quaternion().setFromUnitVectors(dir, upWorld);

  tween = { from: group.quaternion.clone(), to, t: 0, dur: reduceMotion ? 0.01 : dur };
  vel.x = 0;
  vel.y = 0;

  paintCard(sprite.userData.recipe);
  hideHint();
}

function paintCard(r) {
  cardTitle.textContent = r.title;
  cardMeta.textContent = `${r.servings.n} ${r.servings.unit} · ${r.time}`;
  cardOpen.href = `recipe.html?r=${encodeURIComponent(r.slug)}`;
  card.style.setProperty('--dish', r.dish);

  const inPlan = window.OrbitPlanHas ? window.OrbitPlanHas(r.slug) : false;
  cardPlan.classList.toggle('is-on', inPlan);
  cardPlan.textContent = inPlan ? 'In plan' : 'Add to plan';
  cardPlan.dataset.slug = r.slug;

  card.classList.add('is-on');
}

function blur() {
  focused = null;
  bubbles.forEach((b) => b.element.classList.remove('is-focused'));
  card.classList.remove('is-on');
  if (!reduceMotion) vel.y = 0.055;
}

function openRecipe(r) {
  location.href = `recipe.html?r=${encodeURIComponent(r.slug)}`;
}

function roll() {
  if (!bubbles.length) return;
  dice.classList.add('is-rolling');
  setTimeout(() => dice.classList.remove('is-rolling'), 900);

  blur();
  hideHint();

  if (reduceMotion) {
    focus(bubbles[Math.floor(Math.random() * bubbles.length)], 0.01);
    return;
  }

  // Throw it, let it tumble, then settle on one
  vel.y = 9 + Math.random() * 5;
  vel.x = (Math.random() - 0.5) * 6;
  tween = null;

  setTimeout(() => {
    const pick = bubbles[Math.floor(Math.random() * bubbles.length)];
    focus(pick, 1.1);
  }, 620);
}

function hideHint() { hint.classList.add('is-hidden'); }

/* ── Loop ────────────────────────────────────────────────── */

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 1000, 0.05) || 0.016;
  lastT = now;

  if (tween) {
    tween.t += dt / tween.dur;
    const k = Math.min(tween.t, 1);
    group.quaternion.slerpQuaternions(tween.from, tween.to, easeOutCubic(k));
    if (k >= 1) tween = null;
  } else if (!dragging) {
    // Inertia, easing back to a slow idle drift
    vel.y += ((focused || reduceMotion ? 0 : 0.055) - vel.y) * Math.min(dt * 2.4, 1);
    vel.x += (0 - vel.x) * Math.min(dt * 3.2, 1);
    if (Math.abs(vel.x) > 0.0005 || Math.abs(vel.y) > 0.0005) spin(vel.x, vel.y);
  }

  depthStyle();
  renderer.render(scene, camera);
}

/* Farther bubbles blur out and fade back, like looking across a globe */
function depthStyle() {
  const camZ = camera.position.z;
  const near = camZ - liveRadius;
  const far = camZ + liveRadius;

  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    b.getWorldPosition(tmpVec);
    const dist = tmpVec.distanceTo(camera.position);
    const t = THREE.MathUtils.clamp((dist - near) / (far - near), 0, 1);

    const isFocus = b === focused;
    const el = b.element;

    el.style.opacity = isFocus ? '1' : String(1 - t * 0.8);
    el.style.filter = (isFocus || reduceMotion) ? 'none' : `blur(${(t * t * 5.5).toFixed(2)}px)`;
    el.style.zIndex = String(Math.round((1 - t) * 1000));
    el.style.pointerEvents = t > 0.72 ? 'none' : 'auto';
  }
}

/* ── Public hooks for app.js ─────────────────────────────── */

window.OrbitAPI = {
  resume() {
    if (!started) {
      started = true;
      try {
        build();
      } catch (err) {
        console.error('[orbit] build failed', err);
        document.getElementById('orbitFallback').classList.add('is-on');
        stage.style.display = 'none';
        return;
      }
    }
    if (running) return;
    running = true;
    resize();
    lastT = performance.now();
    rafId = requestAnimationFrame(frame);
  },
  pause() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  },
  focusSlug(slug) {
    this.resume();
    const b = bubbles.find((x) => x.userData.recipe.slug === slug);
    if (b) focus(b, 1);
  },
  refreshCard() {
    if (focused) paintCard(focused.userData.recipe);
  },
};

// If the page opened straight onto #orbit, app.js has already flipped the
// view but OrbitAPI didn't exist yet — catch up.
if (location.hash === '#orbit') window.OrbitAPI.resume();
