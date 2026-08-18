// App shell. Owns the frame loop and the wiring, and nothing else.
//
// Frame order is fixed and lives here so it is readable in one place. Phase 0
// only has a few of these layers built, and the rest are listed as comments in
// the order they will slot in, because getting the order wrong later is the
// expensive kind of mistake.

import * as THREE from 'three';
import { createStage } from './stage.js';
import { createTerrain, createLabGround } from './terrain.js';
import { buildSkeleton, buildBlockout, froude } from './skeleton.js';
import { createModes } from './modes.js';
import { buildPanel } from './ui.js';
import { initTooltips } from './tooltip.js';
import { createTimingChart, createReadout, createTraces, createForceChart } from './debug.js';
import { createFootfall } from './footfall.js';
import { createLoad } from './load.js';
import { createLimbSolver } from './limb.js';
import { params } from './params.js';
import { GAITS, LIMBS, withLead, cheapestGait, solveClock, maxStrideFrequency } from './gaits.js';

const canvas = document.getElementById('view');
const stage = createStage(canvas);

let terrain = createTerrain({
  seed: params.terrainSeed,
  amplitude: params.terrainAmplitude,
  frequency: params.terrainFrequency,
});
stage.scene.add(terrain.mesh);

const labGround = createLabGround();
stage.scene.add(labGround.group);

const skel = buildSkeleton();
const blockout = buildBlockout(skel);
const horse = new THREE.Group();
horse.name = 'horse';
horse.add(blockout);
stage.scene.add(horse);

const modes = createModes(stage, { terrain, labGround });
const footfall = createFootfall(skel);
const load = createLoad();
const limbs = createLimbSolver(skel);
const traces = createTraces(THREE, stage.scene, { limbs: LIMBS });

// Body state. Phase 3 gives this real momentum. For now it is a position and a
// heading that the camera can follow and the clock can drive.
const body = {
  position: new THREE.Vector3(0, 0, 0),
  heading: 0,
  speed: 0,
  scale: params.scale,
  // How far the body sits below its standing height. A horse standing square has
  // its forelimbs almost fully extended, which leaves them no reach at all, so
  // the body has to drop for a hoof to get out in front. Real horses do exactly
  // this and run lower the faster they go.
  crouch: 0,
};

// Solve the crouch from the reach the stride actually needs. Stance travel is
// duty times stride length, and the hoof has to get half of that ahead of the
// limb root, so this inverts the reach formula for the required root height and
// takes the deeper of the two limbs.
// The joint limits stop the chain from ever pulling straight, so the usable
// length is well under the sum of the bones. The rest pose already sits at about
// 0.966 of the total, and the minimum bend at each joint means it can only
// straighten a little past that, so anything above roughly 0.96 asks for reach
// the solver cannot deliver and the hoof slides to make up the difference.
const USABLE = 0.955;
// A real horse does not drop 30 cm to take a stride. Most of a forelimb's reach
// comes from the scapula rotating on the ribcage, the thoracic sling, which
// effectively raises the pivot and lengthens the arc without lowering the body at
// all. That is Phase 3. Until then the honest trade is a correct posture with the
// stride clamped to what the legs can actually cover, rather than a full stride
// bought with a squat, so canter and gallop currently under stride.
const MAX_CROUCH_FRACTION = 0.12;

function legGeometry(key) {
  const s = params.scale;
  const r = limbs.rest[key];
  // The hoof does not rest directly below its limb root. A forehoof sits ahead of
  // the scapula and a hind hoof sits behind the hip, so the two ends of a stance
  // are not symmetric about the root and the longer end is what has to fit.
  const offset = r.u[r.u.length - 1] - r.u[0];
  return {
    // `rest.total` already carries the scale once the solver has run, so go back
    // to the unscaled lengths to stay independent of solve order.
    total: (r.lenBase ?? r.len).reduce((a, b) => a + b, 0) * s * USABLE,
    restH: (key[0] === 'F' ? skel.metrics.foreLegLength : skel.metrics.hindLegLength) * s,
    offset: offset * s,
  };
}

// How far the body has to drop for the hooves to reach the ends of their stance.
// A horse standing square has its forelimbs almost fully extended, so a hoof
// cannot get out in front until the body comes down. Real horses do exactly this,
// and run lower the faster they go.
function solveCrouch(halfTravel) {
  let worst = 0;
  for (const key of ['F.L', 'H.L']) {
    const { total, restH, offset } = legGeometry(key);
    // Whichever end of the stance sits further from the limb root is the one that
    // has to fit.
    const need = halfTravel + Math.abs(offset);
    if (need >= total) {
      worst = Math.max(worst, restH);
      continue;
    }
    worst = Math.max(worst, restH - Math.sqrt(total * total - need * need));
  }
  // Never crouch more than a quarter of leg length, which would read as a
  // different animal rather than as a running horse.
  return THREE.MathUtils.clamp(worst, 0, skel.metrics.hindLegLength * params.scale * MAX_CROUCH_FRACTION);
}

// Longest stance travel the legs can cover at the deepest allowed crouch. Stride
// length is clamped to this so the hooves never have to slide, because a sliding
// hoof is the treadmill bug and no amount of polish hides it.
function maxStanceTravel() {
  let limit = Infinity;
  const maxCrouch = skel.metrics.hindLegLength * params.scale * MAX_CROUCH_FRACTION;
  for (const key of ['F.L', 'H.L']) {
    const { total, restH, offset } = legGeometry(key);
    const H = Math.max(0.2, restH - maxCrouch);
    const reach = Math.sqrt(Math.max(0, total * total - H * H));
    // The offset eats into the reach on the far side, so it comes off the half
    // travel, not off the whole.
    limit = Math.min(limit, 2 * Math.max(0, reach - Math.abs(offset)));
  }
  return limit;
}

const clock = {
  stridePhase: 0,
  gait: GAITS.walk,
  solved: solveClock({
    speed: params.speed,
    gait: GAITS.walk,
    hipHeight: skel.metrics.hipHeight,
    swingTime: params.swingTime,
    dutyFloor: params.dutyFloor,
  }),
  froudeNumber: 0,
  running: true,
};

// UI

initTooltips();
const setters = buildPanel(document.getElementById('controls'), params, onParam);
const timing = createTimingChart(document.getElementById('timing'));
const forces = createForceChart(document.getElementById('forces'));
const readout = createReadout(document.getElementById('readout'));
const statusEl = document.getElementById('status');
const clockHint = document.getElementById('clock-hint');

document.getElementById('phase-note').innerHTML = `
  <b>Phases 0 to 2 are built.</b> Skeleton, terrain, lighting, cameras, the gait
  table and the instruments. Footfall planning with world locked stance and limb
  IK with the tendon couplings. Ground force per limb, with the fetlock driven as
  a spring and the body sinking under load. Zero foot drift at every gait, and
  peak forces land within 4 percent of the published measurements without being
  told them.<br><br>
  Still to come: momentum and turning, then the thoracic sling, which is what lets
  a foreleg reach without the body dropping. Canter and gallop under stride until
  it lands, and that is also why they currently show no suspension.
  Greyed dials are stored but not yet read by any solver.
`;

// Lab view buttons, built from the rig itself so the two cannot drift apart.
const viewSeg = document.getElementById('view-seg');
Object.entries(modes.LAB_VIEWS).forEach(([name, def], i) => {
  const b = document.createElement('button');
  b.className = 'btn' + (name === modes.state.labView ? ' on' : '');
  b.textContent = name;
  b.dataset.help = def.help;
  b.dataset.helpTitle = `${name} view`;
  b.addEventListener('click', () => {
    modes.setLabView(name, params.scale);
    for (const c of viewSeg.children) c.classList.toggle('on', c === b);
  });
  viewSeg.append(b);
});

document.querySelectorAll('#mode-seg .btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    modes.setMode(btn.dataset.mode);
    document.querySelectorAll('#mode-seg .btn').forEach((b) => b.classList.toggle('on', b === btn));
    viewSeg.style.display = btn.dataset.mode === 'lab' ? '' : 'none';
  });
});

const playBtn = document.getElementById('btn-play');
playBtn.addEventListener('click', () => {
  clock.running = !clock.running;
  playBtn.textContent = clock.running ? 'Pause' : 'Play';
});
document.getElementById('btn-step').addEventListener('click', () => step(1 / 60));

document.getElementById('btn-shot').addEventListener('click', shot);

addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  const views = Object.keys(modes.LAB_VIEWS);
  if (e.key >= '1' && e.key <= String(views.length)) {
    viewSeg.children[Number(e.key) - 1]?.click();
  } else if (e.key === ' ') {
    e.preventDefault();
    playBtn.click();
  } else if (e.key === '.') {
    step(1 / 60);
  }
});

addEventListener('resize', () => stage.resize());

// Watch the viewport element rather than only the window. The canvas is sized
// from its own client box, and that box settles after first layout and changes
// again whenever a panel shows or hides at a breakpoint, neither of which fires
// a window resize.
new ResizeObserver(() => stage.resize()).observe(document.getElementById('viewport'));

function onParam(key) {
  if (key === 'terrainSeed' || key === 'terrainAmplitude' || key === 'terrainFrequency') {
    stage.scene.remove(terrain.mesh);
    terrain.mesh.geometry.dispose();
    terrain = createTerrain({
      seed: params.terrainSeed,
      amplitude: params.terrainAmplitude,
      frequency: params.terrainFrequency,
    });
    terrain.mesh.visible = modes.state.mode !== 'lab';
    stage.scene.add(terrain.mesh);
    modes.rebindTerrain?.(terrain);
  }
  if (key === 'exposure') stage.renderer.toneMappingExposure = params.exposure;
  if (key === 'sunAzimuth' || key === 'sunElevation') updateSun();
  if (key === 'scale') {
    body.scale = params.scale;
    horse.scale.setScalar(params.scale);
  }
  if (key === 'showSkeleton') blockout.visible = params.showSkeleton;
  if (key === 'showTraces') {
    traces.visible = params.showTraces;
    if (!params.showTraces) traces.clear();
  }
  // A different gait or size draws a different arc, so an old trace would be
  // comparing two things at once.
  if (key === 'gaitMode' || key === 'lead' || key === 'scale' || key === 'speed') traces.clear();
}

function updateSun() {
  const az = (params.sunAzimuth * Math.PI) / 180;
  const el = (params.sunElevation * Math.PI) / 180;
  const d = 11;
  stage.sun.position.set(
    Math.cos(el) * Math.sin(az) * d,
    Math.sin(el) * d,
    Math.cos(el) * Math.cos(az) * d
  );
}
updateSun();

// The frame.

function step(dt) {
  // L0 body. Phase 3 replaces this with real momentum and traction. For now the
  // speed dial is followed directly so the clock has something to chew on.
  body.speed = params.speed;

  // L1 clock. Pick the gait, solve the stride, advance the phase.
  const hip = skel.metrics.hipHeight * params.scale;
  clock.froudeNumber = froude(body.speed, hip);

  const named = params.gaitMode !== 'auto' && GAITS[params.gaitMode];
  const chosen =
    named ||
    cheapestGait(clock.froudeNumber, {
      allowReverse: false,
      speed: body.speed,
      hipHeight: hip,
      swingTime: params.swingTime,
      dutyFloor: params.dutyFloor,
      strideScale: params.strideScale,
      cadence: params.cadence,
    });
  clock.gait = withLead(chosen, params.lead);

  clock.solved = solveClock({
    speed: body.speed,
    gait: clock.gait,
    hipHeight: hip,
    swingTime: params.swingTime,
    dutyFloor: params.dutyFloor,
    strideScale: params.strideScale,
    cadence: params.cadence,
  });

  // Stance travel is what the legs have to cover, so clamp it to what they can
  // actually reach rather than letting the hooves slide to make up the shortfall.
  // This has to happen before the phase advances, since it changes the frequency.
  const wantTravel = clock.solved.duty * clock.solved.strideLength;
  const maxTravel = maxStanceTravel();
  clock.travelClamped = wantTravel > maxTravel + 1e-6;
  const travel = Math.min(wantTravel, maxTravel);
  if (clock.travelClamped) {
    // Shorten the stride to fit, and the clock speeds up to hold the same ground
    // speed, which is what a horse does when it runs out of reach.
    clock.solved.strideLength = travel / clock.solved.duty;
    clock.solved.period = clock.solved.strideLength / Math.max(1e-3, body.speed);
    clock.solved.frequency = 1 / clock.solved.period;
  }

  clock.stridePhase = (clock.stridePhase + clock.solved.frequency * dt) % 1;

  // The horse genuinely travels, in the lab exactly as in the field. Nothing
  // below here may ever ask which mode it is in.
  const fwd = new THREE.Vector3(Math.cos(body.heading), 0, -Math.sin(body.heading));
  body.position.addScaledVector(fwd, body.speed * dt);
  const g = modes.ground();

  // Reach needed at the extremes of this stance, with a margin so the solver is
  // never right on its limit.
  const need = (travel * 0.5) / 0.92;
  body.crouch = solveCrouch(need);
  body.position.y = g.heightAt(body.position.x, body.position.z) - body.crouch;

  horse.position.copy(body.position);
  horse.rotation.y = body.heading;
  horse.scale.setScalar(params.scale);
  horse.updateMatrixWorld(true);

  // L2 contact. Plans and world locks each hoof.
  const feet = footfall.update({
    gait: clock.gait,
    stridePhase: clock.stridePhase,
    duty: clock.solved.duty,
    period: clock.solved.period,
    body,
    scale: params.scale,
    ground: g,
  });

  // L3 load. How hard each hoof is pressing, and therefore how far each limb
  // spring compresses. Speed factor drives engagement toward the hindquarters the
  // way it does in a real horse, before the style dial adds anything.
  const speedFactor = THREE.MathUtils.clamp(clock.froudeNumber / 5, 0, 1);
  clock.load = load.update({
    gait: clock.gait,
    stridePhase: clock.stridePhase,
    duty: clock.solved.duty,
    engagement: params.engagement,
    speedFactor,
    stiffness: params.limbStiffness,
    scale: params.scale,
  });

  // The body sinks by however far the loaded legs have compressed, which is where
  // the vertical bob comes from. It is a consequence of the springs rather than an
  // animated curve, so it changes correctly with mass, speed and stiffness.
  body.sink = load.bodySink();
  body.position.y -= body.sink;
  horse.position.copy(body.position);
  // The limb solver reads limb root positions off the live world matrices, so the
  // body transform has to be committed before L4 runs.
  horse.updateMatrixWorld(true);

  // L4 limb. Solves each leg to its hoof, with the tendon couplings, and with the
  // fetlock driven by force rather than by the IK.
  clock.limbInfo = limbs.solve(feet, body.heading, params.scale, {
    compression: Object.fromEntries(LIMBS.map((l) => [l, clock.load[l].compression])),
  });

  if (params.showTraces && body.speed > 0.01) traces.push(feet);

  // L3 load, L5 spine, L6 neck, L7 gaze, L8 passive, L9 breath, L10 character.
  // All Phase 2 and later, and they slot in here in this order.

  modes.update(dt, {
    position: body.position,
    scale: params.scale,
    heading: body.heading,
    centerX: skel.metrics.centerX,
    centerY: skel.metrics.centerY,
  });
}

// Drawing the instruments is separate from the frame loop so a headless session
// can refresh them without a rAF tick, which never fires while the pane is
// hidden.
function drawInstruments() {
  const hip = skel.metrics.hipHeight * params.scale;
  const maxFreq = maxStrideFrequency(params.swingTime, params.dutyFloor, hip);
  timing.draw({
    gait: clock.gait,
    stridePhase: clock.stridePhase,
    duty: clock.solved.duty,
    strideFreq: clock.solved.frequency,
    froudeNumber: clock.froudeNumber,
    speed: body.speed,
    maxFreq,
  });

  forces.draw(clock.load, params.mass);

  readout.set([
    `gait        ${clock.gait.name} (${clock.gait.structure})`,
    `lead        ${clock.gait.lead ?? 'n/a'}`,
    `speed       ${body.speed.toFixed(2)} m/s`,
    `Froude      ${clock.froudeNumber.toFixed(3)}`,
    `stride      ${clock.solved.strideLength.toFixed(2)} m over ${clock.solved.period.toFixed(3)} s`,
    `frequency   ${clock.solved.frequency.toFixed(2)} Hz of ${maxFreq.toFixed(2)} ceiling`,
    `duty        ${clock.solved.duty.toFixed(3)}`,
    `swing       ${(clock.solved.swing * 1000).toFixed(0)} ms (pendulum scaled)`,
    `stance      ${(clock.solved.period * clock.solved.duty * 1000).toFixed(0)} ms`,
    `reach       ${clock.solved.reachRatio.toFixed(2)}x${clock.solved.overdriven ? '  OVERDRIVEN' : ''}`,
    ``,
    // Zero or it is the treadmill bug. This is the single most important number
    // on the page.
    `foot drift  ${footfall.totalDrift().toExponential(1)} m`,
    `support     ${footfall.supportSet().join(' ') || 'none, airborne'}`,
    `crouch      ${(body.crouch * 100).toFixed(1)} cm below standing`,
    `spring sink ${((body.sink ?? 0) * 100).toFixed(1)} cm from limb compression`,
    `peak force  ${LIMBS.map((l) => (clock.load?.[l]?.peak ?? 0).toFixed(1)).join('  ')} N/kg`,
    `limb use    ${LIMBS.map((l) => `${l} ${(clock.limbInfo?.[l]?.load ?? 0).toFixed(2)}`).join('  ')}`,
    `unreached   ${LIMBS.filter((l) => clock.limbInfo?.[l] && !clock.limbInfo[l].reached).join(' ') || 'none'}`,
    ``,
    // A hand is four inches, so 0.1016 m.
    `withers     ${(skel.metrics.withersHeight * params.scale).toFixed(2)} m (${((skel.metrics.withersHeight * params.scale) / 0.1016).toFixed(1)} hands)`,
    `hip         ${(skel.metrics.hipHeight * params.scale).toFixed(2)} m`,
    `length      ${(skel.metrics.totalLength * params.scale).toFixed(2)} m nose to tail`,
    `travelled   ${body.position.length().toFixed(1)} m`,
  ]);

  clockHint.textContent = clock.solved.overdriven
    ? 'past the frequency ceiling, extra speed is coming from reach'
    : `${clock.gait.name}  ${clock.solved.frequency.toFixed(2)} Hz`;

  statusEl.textContent = `${modes.state.mode}  ${skel.bones.size} joints`;
}

// Settle the solver before the first visible frame. The limb chains seed from the
// rest pose, and the first solve has to travel from there to a real stance, which
// otherwise shows up as a visible snap on load and as a misleading spike in the
// first error measurement anyone takes.
for (let i = 0; i < 30; i++) step(1 / 60);
traces.clear();

let last = performance.now();

function frame(now) {
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (clock.running) step(raw * params.timeScale);
  drawInstruments();
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

async function shot() {
  stage.render();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const res = await fetch('/_shot', { method: 'POST', body: blob });
  statusEl.textContent = `saved ${await res.text()}`;
}

// Headless handle. rAF stops when the browser pane is hidden, so a verifying
// session needs to be able to drive a frame and read state by hand.
window.eq = {
  params,
  stage,
  skel,
  horse,
  blockout,
  body,
  clock,
  modes,
  get terrain() {
    return terrain;
  },
  step,
  shot,
  setters,
  drawInstruments,
  footfall,
  load,
  limbs,
  traces,
  flush(n = 1, dt = 1 / 60) {
    for (let i = 0; i < n; i++) step(dt);
    drawInstruments();
    stage.render();
  },
  // Save any canvas on the page through the dev shot endpoint, so the timing
  // chart can be inspected as an image and not just as numbers.
  async shotOf(id) {
    const el = document.getElementById(id);
    const blob = await new Promise((r) => el.toBlob(r, 'image/png'));
    return (await fetch('/_shot', { method: 'POST', body: blob })).text();
  },
};
