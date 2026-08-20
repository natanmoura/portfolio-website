// Awesome Town City Builder. Wiring.
//
// State is small on purpose: a params object the sliders write to, and a
// sparse overrides object the editor writes to. Everything on screen is
// derived from those two plus the image pool.

import * as THREE from 'three';
import { ImagePool } from './textures.js';
import { CityMaterial } from './material.js';
import { CityBuilder } from './build.js';
import { Stage } from './scene.js';
import { Picker } from './select.js';
import { Controls, CONTROL_DEFS, h, setChildren } from './ui.js';
import { Inspector } from './inspector.js';
import { initTooltips, withHelp } from './tooltip.js';
import { MixWheel } from './piechart.js';
import { Scenes } from './scenes.js';
import { slotsOf } from './traits.js';
import {
  DEFAULTS,
  generateCity,
  generateLot,
  MODULE_KINDS,
  BODY_KINDS,
  ROOF_KINDS,
  KIND_LABEL,
  SURFACE_KINDS,
  SURFACE_LABEL,
  reconcileOverrides,
} from './generate.js';
import { PALETTES, PALETTE_KEYS, getPalette, glassTint } from './palettes.js';
import { waveState, waveFrequency } from './wave.js';
import { ROAD_PATTERNS, PATTERN_LABEL, NONE_PATTERN } from './layout.js';
import { liftAt, isRaised } from './elevation.js';
import { Traffic } from './traffic.js';
import { Particles } from './particles.js';
import { Flyby } from './flyby.js';
import { randomParams } from './randomize.js';
import { loadPresets } from './presets.js';
import { loadEditedLibrary, EDITS_KEY, EDITS_EVENT } from './library.js';
import { openShelfPicker } from './shelfpicker.js';
import { infoDialog, confirmDialog } from './dialog.js';
import { renderThumb } from './thumbs.js';
import { ROLES, includedFor, toggleInRole, roleLabel } from './roles.js';
import { History } from './history.js';
import { Layers, SHOWN } from './layers.js';
import { initPanelResize } from './resizer.js';
import { buildExport, downloadExport } from './exporter.js';
import { writeStats } from './stats.js';
import { resetNotes, readNotes, describe } from './provenance.js';
import { FACETS, FACET_KEYS, locksOf, isLocked, withFacet, keepLocked } from './locks.js';
import { CurveView } from './curveview.js';
import { CurveEditor } from './curveedit.js';
import { curveFromPolyline, OFFSET } from './curve.js';
import { BOUNDARY_ID, BOUNDARY_SHAPES, BOUNDARY_LABEL, boundaryShape, defaultHalf, regionFor } from './region.js';
import {
  LANDFORM_SHAPES,
  LANDFORM_LABEL,
  landformShape,
  landformKey,
  landformRadius,
} from './landform.js';
import { HILLS, DRAWN, TERRAIN_MODE_LABEL } from './terrain.js';

const APP_NAME = 'City Builder';

const ENV_DEFAULTS = {
  hour: 15.5,
  sunAzimuth: 0,
  sunStrength: 1,
  ambient: 1,
  exposure: 1.05,
  skyCustom: false,
  skyColor: '#dcd7c8',
  fog: 0.22,
  fogCustom: false,
  fogColor: '#c8c2b2',
  // Grass green, which is the one thing the palettes never gave you: all of
  // them ship a ground somewhere between paper and sand, so a town in a
  // landscape was not a look the tool could reach without editing a palette.
  // No paired "custom" switch — a colour with an off state that means "ask
  // the palette instead" is two controls where one will do, and every shipped
  // preset now carries the colour its palette used to hand it.
  groundColor: '#5f8f3e',
  // The tarmac, which was a hardcoded hex in the material until now — no
  // palette carries a road colour, so this has no "off" state to fall back to
  // and starts on the exact shade it was baked at.
  roadColor: '#2a2723',
  bloomOn: true,
  bloomStrength: 1,
  shadows: true,
  softShadows: true,
  shadowLightSize: 0.015,
  shadowSoftness: 1,
  shadowSamples: 32,
  shadowDetail: 8192,
  ao: 0,
  aoRadius: 2.4,
  aoSmoothing: 2,
  aoBias: 0.06,
  aoSamples: 20,
  aoTint: true,
  aoColor: '#2a3550',
  occlusion: 0.3,
  occlusionHeight: 5,
  showGrid: false,
  showStats: true,
  waveHeight: 0,
  waveScale: 1.4,
  waveSpeed: 0.6,
  waveRock: 1,
  wind: 0.35,
  dof: 0,
  dofAuto: true,
  dofFocus: 45,
  dofRange: 55,
  bokeh: 0.4,
  halftone: 0,
  halftoneScale: 4,
  posterize: 0,
  posterizeSteps: 6,
  vignette: 0.18,
  grain: 0.05,
  contrast: 1,
  saturation: 1,
  shadowTintOn: false,
  shadowTint: '#8fa8d8',
  highlightTintOn: false,
  highlightTint: '#ffe6c0',
  showCars: true,
  // Things in the air. Off by default at zero count, so a scene that predates
  // them opens exactly as it did — and so the first thing anyone sees is
  // still the town rather than a snowstorm.
  particleCount: 0,
  particleSize: 1.2,
  particleRise: 40,
  particleFloor: 0,
  particleSpeed: 1,
  particleSpeedVariance: 0.5,
  particleDrift: 3,
  particleSpin: 0.3,
  particleOpacity: 0.7,
  particleGlow: 0.6,
  // No colour parameter. Particles take the palette's glow colours and only
  // those — a sprite is read for its shape, never its pixels. See
  // particles.js.
  flybySpeed: 16,
  // Just above a windscreen. Low enough that the buildings tower, high enough
  // to see over a parked car — and paired with the new aim below, which
  // climbs with distance instead of sitting level with the road, this is what
  // makes the default tour look up at the town rather than down the street at
  // the vanishing point.
  flybyHeight: 2.4,
  flybyLookAhead: 14,
  flybyBank: 0.8,
  // Metres of climb per ten metres of look-ahead. At this look-ahead that is
  // about twenty-five degrees above the road, which puts the upper floors of
  // a normal building in frame from a windscreen — the tour is for looking at
  // the town, and level with the tarmac it mostly shows the vanishing point.
  flybyPitch: 4.5,
  flybySmoothing: 6,
};

const SHORTCUTS = [
  ['click', 'select a module'],
  ['shift + click', 'select the whole building'],
  ['double click', 'new image on that face'],
  ['I', 'new image on the selected face'],
  ['shift + I', 'new image on every face'],
  ['M', 'next shape'],
  ['G', 'light it or unlight it'],
  ['[  ]', 'shorter, taller'],
  [',  .', 'narrower, wider'],
  ['1 - 9', 'pick a face'],
  ['B', 'switch module and building'],
  ['R', 'reroll the building'],
  ['+  -', 'grow or shrink the lot along its street'],
  ['delete', 'remove it, or the picked control points'],
  ['click near a road', 'pick that road up'],
  ['drag a handle', 'move it, and hold it there'],
  ['alt + drag a handle', 'raise or lower that bit of road'],
  ['L', 'hold this road as it is, or let it go'],
  ['delete, no points picked', 'delete the whole curve'],
  ['shift + click a picked curve', 'add a control point'],
  ['C', 'corner or curve, on the picked points'],
  ['F', 'frame the whole town'],
  ['T', 'start or stop the tour'],
  ['ctrl + Z', 'undo'],
  ['ctrl + shift + Z', 'redo'],
  ['esc', 'deselect'],
];

const WHEEL_COLORS = {
  box: '#e0663a',
  octagon: '#e7a24a',
  cylinder: '#3f6f6a',
  pillars: '#7a3b2e',
  pillars8: '#a8623f',
  post: '#5a3f7a',
  sphere: '#c9c0a4',
  spin: '#2f5df0',
  flag: '#c9412f',
  flat: '#8c8579',
  pyramid: '#c9412f',
  gable: '#e7a24a',
  cone: '#3f6f6a',
  dome: '#5a3f7a',
};
// A stable hash straight to a hue, so a component id always lands on the
// same slice colour without a table entry for it — every id the library
// might ever hold, not just the dozen shipped ones `WHEEL_COLORS` names by
// hand. Golden-angle spacing on top keeps ids that hash close together from
// landing on close hues too.
function hashColor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = (h * 137.508) % 360;
  return `hsl(${hue.toFixed(1)}, 62%, 52%)`;
}

// The wheel names its slices from the library when it can, so a component
// renamed in the editor renames its slice here too. Colour the same way —
// the shipped table first, a hash-derived hue for anything the table has
// never heard of, so a role full of custom or assembly components never
// shows an untinted slice.
const wheelMeta = (keys) =>
  Object.fromEntries(
    keys.map((k) => [
      k,
      { label: library?.components.get(k)?.label || KIND_LABEL[k] || k, color: WHEEL_COLORS[k] || hashColor(k) },
    ])
  );

const SURFACE_COLORS = {
  texture: '#9a8f74',
  glass: '#6fb8d6',
  mirror: '#c9d3d8',
  image: '#c9412f',
  cutout: '#f2b705',
  colour: '#7d7d7d',
};
const SURFACE_META = Object.fromEntries(
  SURFACE_KINDS.map((k) => [k, { label: SURFACE_LABEL[k], color: SURFACE_COLORS[k] }])
);

const state = {
  params: structuredClone({ ...DEFAULTS, ...ENV_DEFAULTS }),
  overrides: {},
  // Which parameters the dice must leave alone. Authoring intent rather than
  // a view preference, so it saves with the scene.
  paramLocks: {},
  city: null,
  selection: null,
  sceneName: '',
  // True while the loaded scene is a bundled preset rather than something
  // from the visitor's own library, so "save" always forks a copy instead of
  // quietly writing over a file that only ships with the site.
  scenePreset: false,
};

const byModule = new Map();
const byBuilding = new Map();

const viewport = document.getElementById('viewport');
const loadingEl = document.getElementById('loading');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');
let sceneNameEl = null;
const undoBtn = document.getElementById('btn-undo');
const redoBtn = document.getElementById('btn-redo');

const pool = new ImagePool();
const matPool = new ImagePool();
// Its own pool rather than a range inside the collage one. A particle sprite
// is picked from a different question ("what is in the air") than a facade
// image, and a shared pool would mean every new star also became a possible
// wall.
const particlePool = new ImagePool();
let stage;
let materials;
let builder;
let picker;
let controls;
let inspector;
let traffic;
let particles;
let flyby;
let tourButton;
let wheels = {};
let presets = [];
// The component library, shipped files with the editor's uncommitted work
// layered on top. Null until boot finishes, which the generator treats as
// "no components", so the town renders as it did before the library existed.
let library = null;
let history;
let historyLabel;
// Redraw callbacks for the role toggle sets, so a scene load or an undo puts
// the checkboxes back in step with the params they describe.
const roleRedraws = [];
let rebuildMixWheels = null;
// Layer visibility. Purely a view concern, kept out of params on purpose.
let layers = null;
// The curve layer. The boundary is the first curve the town actually reads
// back — drag it and the streets are recut to it. The roads are still
// mirrored into the same store read-only, so the primitive can be seen
// against something real until they become curves in their own right.
let curveView = null;
let curveEditor = null;
let curves = [];

// Mounted by shell.js, which owns the two views and decides which is on
// screen. This one loads first because it is what you came for.
export async function mount() {
  await boot();
  return {
    // Stops drawing while you are in the components view. The scene, the
    // camera and the selection all stay exactly as they were, so coming back
    // is one frame rather than a rebuild.
    setActive(on) {
      onScreen = on;
      if (on) frameSize();
    },
    resize: frameSize,
  };
}

// Both views mount into a hidden container, so the first size they see is
// zero. Re-measured on the way in rather than trusted from mount time.
function frameSize() {
  stage?.resize?.();
}

async function boot() {
  restore();
  try {
    const presetsLoading = loadPresets();
    const libraryLoading = loadEditedLibrary('library');
    await pool.loadManifest('collage', (done, total) => {
      loadingEl.querySelector('.bar span').style.width = `${(done / total) * 100}%`;
      loadingEl.querySelector('.count').textContent = `${Math.min(done, total)} / ${total}`;
    });
    await matPool.loadMaterialManifest('collage');
    await particlePool.loadParticleManifest('collage');
    presets = await presetsLoading;
    library = await libraryLoading;
  } catch (err) {
    loadingEl.querySelector('.count').textContent = String(err.message || err);
    console.error(err);
  }

  stage = new Stage(viewport);
  materials = new CityMaterial();
  materials.setAtlas(pool);
  materials.setMatAtlas(matPool);
  builder = new CityBuilder(pool, materials);
  // The builder resolves assemblies itself at geometry time, so it needs the
  // same library the generator got.
  builder.library = library;
  stage.scene.add(builder.root);
  picker = new Picker(stage, builder);
  // Rewriting the shadow chunk changes GLSL that every material already
  // compiled against, so they all have to be told to build again.
  stage.onShaderVersion = () => {
    materials.material.needsUpdate = true;
    materials.depthMaterial.needsUpdate = true;
    stage.ground.material.needsUpdate = true;
    stage.ground.roadMaterial.needsUpdate = true;
    stage.ground.gridMaterial.needsUpdate = true;
    if (traffic) traffic.material.needsUpdate = true;
  };
  traffic = new Traffic();
  stage.scene.add(traffic.group);
  particles = new Particles();
  particles.setPool(particlePool);
  stage.scene.add(particles.group);
  curveView = new CurveView(stage.scene);
  curveView.setGroundAt(groundAt);
  curveEditor = new CurveEditor(stage, curveView, {
    // Live during the drag, committed on release. Rebuilding the town per
    // frame is far too expensive, so the curve redraws continuously and
    // anything that consumes it waits for the gesture to finish — the same
    // split the component editor's sliders already use.
    onLive: () => stage.render(),
    onPick: (curve) => {
      // Not `deselect()`: the curve half of that would undo the very
      // selection this callback exists to report, since it fires after
      // `pointerDown` has already set it.
      deselectBuilding();
      noteStatus(describeCurve(curve));
      stage.render();
    },
    onDelete: (curve) => {
      if (curve.id === BOUNDARY_ID) return setBoundary(null);
      if (curve.kind === 'landform') return removeLandform(curve.id);
      removeRoad(curve.id);
    },
    // Editing a curve is editing the town. Which curve decides what that
    // means, and there are only two answers: the boundary is one artifact the
    // scene already owns, and everything else is a road, which the act of
    // editing hands over to the scene.
    onChange: (curve) => {
      if (!curve) return;
      if (curve.id === BOUNDARY_ID) {
        // `source` names which shape button minted this boundary, and it
        // rides along through every generic curve edit unchanged — `movePoint`
        // and friends all spread `{ ...curve }`, so nothing about a drag would
        // ever clear it on its own. It has to be cleared here, the one place
        // every real edit to the boundary passes through, or the shape
        // buttons would have no way to tell a boundary you have shaped by
        // hand from one still exactly as they left it.
        state.params.boundary = { ...structuredClone(curve), source: null };
        history?.record('boundary');
        markAll();
        syncBoundaryTools();
        noteStatus('Boundary edited');
        return;
      }
      if (curve.kind === 'landform') {
        // Same `source` rule as the boundary and for the same reason: a shape
        // you have dragged is no longer the round one the button minted, and
        // the list row should stop claiming it is. The height and falloff ride
        // through the generic curve edits untouched, since every one of them
        // spreads the whole object.
        state.params.landforms = (state.params.landforms || []).map((l) =>
          l.id === curve.id ? { ...structuredClone(curve), source: null } : l
        );
        history?.record('landform');
        extentKey = '';
        markAll();
        syncLandformTools();
        noteStatus('Ground edited');
        return;
      }
      holdRoad(curve, 'moved');
    },
  });
  flyby = new Flyby(stage);
  pool.onChange(() => materials.setAtlas(pool));
  matPool.onChange(() => materials.setMatAtlas(matPool));

  rebuildAll();
  frameCity();
  applyEnv();

  // Panel widths are view state, like layer visibility: dragging one wider
  // changes what you can see and nothing about the town.
  initPanelResize({
    main: document.getElementById('view-city'),
    left: { key: 'controls', side: 'left', var: '--pw-l', min: 220, max: 620, def: 300 },
    storeKey: 'awesome-town:panels',
  });

  initTooltips();
  buildUI();
  bindPointer();
  bindKeys();
  bindDropZone();
  bindLibrarySync();

  animate();
}

// The editor writes to localStorage, and the browser fires `storage` in every
// *other* tab on the same origin. So with the editor open beside the town,
// locking a parameter or adding a modifier retunes the city as it happens,
// with no reload and no export step. Recalculating is just regenerating:
// nothing about a component is baked into the city data, so there is no
// stale state that could survive the change.
function bindLibrarySync() {
  const reload = async () => {
    library = await loadEditedLibrary('library');
    builder.library = library;
    inspector.library = library;
    markAll();
    noteStatus('Components updated');
  };
  // The components view, one tab switch away.
  window.addEventListener(EDITS_EVENT, reload);
  // A second window someone still has open on the same library.
  window.addEventListener('storage', (e) => {
    if (e.key === EDITS_KEY) reload();
  });
}

const groundAt = (x, z) => stage.ground.heightAt(x, z);

// Framing needs real bounds, so finish any queued meshing first.
function frameCity() {
  builder.flushAll();
  stage.frame(builder.root);
}

// --- rebuild scheduling ----------------------------------------------------

let rafId = 0;
let dirtyAll = false;
const dirtyLots = new Set();

function markAll() {
  dirtyAll = true;
  queue();
}
function markLot(id) {
  dirtyLots.add(id);
  queue();
}
// Whether a plot exists only because an edit anchored it there — see
// `anchorMissingClaims` in layout.js. Clearing that edit is the one case
// where the targeted single-lot rebuild is not enough, since the plot
// itself, not only what is drawn on it, was the thing the override was
// holding up.
function wasAnchored(plotId) {
  return Boolean(state.city?.layout?.sites?.find((s) => s.id === plotId)?.anchored);
}

function markLotOfModule(moduleId) {
  const entry = byModule.get(moduleId);
  if (entry) markLot(entry.building.id);
  else markAll();
}
function queue() {
  if (!rafId) rafId = requestAnimationFrame(flush);
}

function flush() {
  rafId = 0;
  if (dirtyAll) {
    rebuildAll();
    dirtyAll = false;
    dirtyLots.clear();
  } else {
    dirtyLots.forEach(rebuildLot);
    dirtyLots.clear();
  }
  applyEnv();
  refreshHighlight();
  refreshInspector();
  autosave();
  updateStatus();
}

let extentKey = '';
function rebuildAll() {
  const p = state.params;
  // The ground has to reach at least as far as the town does, so a boundary
  // dragged out past the square is standing on something. Its span is part of
  // the key for the same reason every other extent input is: the terrain mesh
  // is expensive and must not be rebuilt for anything that did not move it.
  const region = regionFor(p);
  const span = Math.max(region.bounds.maxX - region.bounds.minX, region.bounds.maxZ - region.bounds.minZ);
  const key = [
    p.cols,
    p.rows,
    p.cell,
    p.terrainHeight,
    p.terrainScale,
    p.terrainDetail,
    p.seed,
    // Its own field even though `terrain.js` already falls back to `seed`:
    // that fallback is exactly why a terrain seed changing while the city
    // seed does not would otherwise leave this key unchanged and the ground
    // never rebuilt.
    p.terrainSeed,
    p.terrainMode,
    p.terrainStep,
    // Drawn ground is rastered inside `setExtent`, so moving one point of one
    // landform has to reach this key or the raster the whole town stands on
    // never gets rebuilt. Hashed rather than stringified: the answer has to
    // change for half a metre of drag and must not carry a kilobyte of points.
    landformKey(p.landforms),
    Math.ceil(span),
  ].join('|');
  if (key !== extentKey) {
    extentKey = key;
    stage.setExtent(p, span);
  }
  // Cleared at the top of the rebuild, read once the geometry is up. Anything
  // still true reports itself again on the way through, so this is a fresh
  // answer rather than an accumulating one.
  resetNotes();
  state.city = generateCity(p, state.overrides, pool.imageCount, pool.cutoutCount, matPool.length, groundAt, library);
  stage.ground.setRoads(state.city.layout.roads, p);
  // Roads mirrored as curves, which is the adoption path proving itself in
  // place: a polyline becomes a curve with no geometric change at all, so the
  // day roads genuinely become curves the town does not move.
  // A held road is drawn from the curve the scene stored, not from the
  // polyline the layout produced out of it. Same geometry either way, but the
  // stored curve carries the control points' own ids, so a selection survives
  // the rebuild that a drag causes and a second nudge does not need re-aiming.
  curves = state.city.layout.roads.map((road) => {
    const held = state.params.roadEdits?.[road.id];
    if (held?.curve) return { ...held.curve, ground: OFFSET, held: true };
    // A proposed road is drawn carrying the height the pattern gave it, not
    // flat. That is what makes alt-dragging one handle an *edit* rather than
    // a reset: grab a point on a road cruising at six metres and it starts at
    // six, so the first thing a lift gesture does is never to drop the road
    // to the floor and start again.
    const lifts = road.profile?.lifts;
    return curveFromPolyline(road.pts, {
      id: road.id,
      label: road.main ? 'Highway' : 'Street',
      kind: 'road',
      ground: OFFSET,
      lifts,
    });
  });
  // Landforms next, then the boundary last, so both draw over the roads. Both
  // came from the scene rather than from a generator, and both are things you
  // reach for while the streets are in the way rather than the other way
  // round. Drawn ground only: a landform the town is not standing on is not
  // something to trip over a handle for.
  if (state.params.terrainMode === DRAWN) curves.push(...(state.params.landforms || []));
  if (state.params.boundary) curves.push(state.params.boundary);
  curveView?.set(curves);
  curveEditor?.setCurves(curves);
  // Handles are drawn for the selected curve only, and the boundary is the
  // one curve here that an edit reaches, so it holds the selection. Which
  // points were picked survives the rebuild: dragging one commits, which
  // rebuilds, and losing the selection every time would make a second nudge
  // impossible without re-aiming.
  const wanted = curveEditor?.selectedCurve || (state.params.boundary ? BOUNDARY_ID : null);
  const stillThere = curves.some((c) => c.id === wanted);
  curveEditor?.select(
    stillThere ? wanted : state.params.boundary ? BOUNDARY_ID : null,
    stillThere ? [...curveEditor.selectedPoints] : []
  );
  traffic.build(state.city.layout.roads, p, getPalette(p.palette));
  // Scattered over the town's real footprint, so a boundary you drew is the
  // shape they rise out of. Rebuilt only when the count, the pool or the
  // extent changed — everything expressive about them is a uniform.
  particles.build(p, state.city.layout.region, groundAt);
  flyby.build(state.city.layout.roads, p, state.city.layout.region, groundAt);
  builder.build(state.city);
  if (stage) builder.sortPending(stage.camera);
  reindex();
  checkOverrides();
}

// Edits with nothing to land on, counted after every full rebuild.
//
// They are reported and never pruned automatically. A building can vanish
// mid-drag and come back when the slider does, so silently discarding its
// edit would turn a moment of hesitation into lost work. The count sits in
// the scene line, and the list is one click away.
let unplaced = [];
// Places the generator had to choose for you, grouped by cause. See
// provenance.js: the forgiving fallbacks stay forgiving and stop being silent.
function checkOverrides() {
  const before = unplaced.length;
  unplaced = reconcileOverrides(state.overrides, state.city).unplaced;
  if (unplaced.length && unplaced.length !== before) {
    noteStatus(`${unplaced.length} edit${unplaced.length === 1 ? '' : 's'} could not be placed`, 6000);
  }
}

// Both things the scene line can be warning about live behind the same click,
// because from where you are standing they are one question: what is not the
// way I left it. Substitutions first — they explain what you are looking at,
// where an unplaced edit explains what you are not.
function showNotices() {
  if (readNotes().length) return showSubstitutions();
  showUnplaced();
}

// Nothing to decide here, so it is something to read rather than something to
// answer. Each line is a cause and how many times it fired, in the words of
// the person who caused it.
function showSubstitutions() {
  const subs = readNotes();
  const rows = subs.map((n) => `${describe(n)}${n.count > 1 ? `  ×${n.count}` : ''}`);
  const extra = unplaced.length
    ? `\n\nAlso ${unplaced.length} edit${unplaced.length === 1 ? '' : 's'} with nowhere to go. Clear these first to see them.`
    : '';
  infoDialog({
    title: `${subs.length} thing${subs.length === 1 ? '' : 's'} decided for you`,
    body: h('p', { class: 'dlg-detail' }, `${rows.join('\n')}${extra}`),
    wide: true,
  });
}

function showUnplaced() {
  if (!unplaced.length) return;
  const lines = unplaced.slice(0, 40).join('\n');
  const more = unplaced.length > 40 ? `\n… and ${unplaced.length - 40} more` : '';
  confirmDialog({
    title: `${unplaced.length} edit${unplaced.length === 1 ? '' : 's'} with nowhere to go`,
    message:
      'These edits name buildings this town does not have. Usually the street parameters moved far enough that the plot they were made on is gone. They are kept until you say otherwise, in case the change was a slip.',
    detail: lines + more,
    confirmLabel: 'Discard them',
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    const n = unplaced.length;
    for (const key of unplaced) delete state.overrides[key];
    unplaced = [];
    history?.record('discard-unplaced');
    noteStatus(`Discarded ${n} edit${n === 1 ? '' : 's'}`);
    updateStatus();
  });
}

function rebuildLot(id) {
  const layout = state.city.layout;
  const site = layout.sites.find((s) => s.id === id);
  if (!site) return;

  const list = state.city.buildings;
  const at = list.findIndex((b) => b.id === id);
  const previous = at >= 0 ? list[at] : null;
  const building = generateLot(
    site,
    state.params,
    state.overrides,
    pool.imageCount,
    pool.cutoutCount,
    matPool.length,
    groundAt,
    layout.region,
    library
  );

  if (building) {
    if (at >= 0) list[at] = building;
    else list.push(building);
  } else if (at >= 0) {
    list.splice(at, 1);
  }
  reindex();

  if (builder.isolatedId === id && building) builder.rebuildSolo();
  else {
    const anchor = building || previous;
    if (anchor) builder.rebuildChunkAt(anchor.gx, anchor.gz);
  }
}

function reindex() {
  byModule.clear();
  byBuilding.clear();
  for (const building of state.city.buildings) {
    byBuilding.set(building.id, building);
    for (const module of building.modules) byModule.set(module.id, { module, building });
  }
}

let waterOn = false;
function applyEnv() {
  const p = state.params;
  const palette = getPalette(p.palette);
  const night = stage.apply(p, palette);
  materials.setGlow(p.glowChance, p.glowStrength, night);
  materials.setGlowResponse(p.glowTint, p.glowImage);
  materials.setGlassTint(glassTint(palette));
  materials.setBillboards(p.scrollShare, p.swapShare, p.flickerShare);
  materials.setDuotone(p.duotone, palette.ink, palette.paper);
  materials.setWaves(p.waveHeight, p.waveScale, p.waveSpeed, p.waveRock);
  materials.setWind(p.wind);
  Object.assign(waveState, {
    amp: p.waveHeight,
    freq: waveFrequency(p.waveScale),
    speed: p.waveSpeed,
    rock: p.waveRock,
  });

  // Water needs a finer ground mesh to bend smoothly, so retessellate when it
  // is switched on or off. The buildings are untouched either way.
  const nowOn = p.waveHeight > 0;
  if (nowOn !== waterOn) {
    waterOn = nowOn;
    stage.setExtent(p);
  }
  stage.setBloom(p.bloomOn);
  stage.setShadows(p.shadows, p.shadowSoftness, p.shadowDetail);
  stage.setShadowQuality(p.softShadows, p.shadowLightSize, p.shadowSamples);
  materials.setOcclusion(p.occlusion, p.occlusionHeight);
  traffic.setNight(night);
  particles.apply(p, night, palette);
  statsEl.classList.toggle('on', !!p.showStats);
  applyLayerVisibility();

  // The shader gates glow by comparing each module's ticket against the
  // chance. Mirror that here so the editor agrees about what is lit without
  // anything being rebuilt.
  if (state.city) {
    for (const b of state.city.buildings) {
      for (const m of b.modules) m.glow = m.glowTicket < p.glowChance;
    }
  }
}

// Layer visibility onto the scene.
//
// The one rule: this reads view state and writes nothing back. Generation,
// export and saving never consult it, so a hidden layer is hidden in this
// window and nowhere else.
function applyLayerVisibility() {
  if (!layers || !stage) return;

  stage.setGridVisible(layers.visible('grid'));
  stage.ground.setRoadsVisible(layers.visible('roads'));
  traffic.setVisible(layers.visible('traffic'));
  particles?.setVisible(layers.visible('particles'));

  builder.root.visible = layers.visible('buildings');
  // The city owns its own ghost material, because its meshes share one
  // instance and it writes a mirror flag into the alpha channel that is only
  // safe while opaque. Fading it from out here would take the mirrors with
  // it and shuffle the whole draw order.
  builder.setGhost(layers.ghosted('buildings'));

  if (stage.ground.mesh) stage.ground.mesh.visible = layers.visible('ground');
  curveView?.setVisible(layers.visible('curves'));
  // Only editable while you can see them. A drag that lands on something
  // hidden is indistinguishable from the tool ignoring you.
  curveEditor?.setEnabled(layers.visible('curves'));

  // The same rule, applied to the one layer that can be clicked and also
  // faded. Buildings stop taking clicks unless they are fully shown, so a
  // click aimed at a street reaches the street instead of being eaten by a
  // ghost standing in front of it — `picker.pick` already falls through to
  // the curves when it finds nothing, so this needs no other wiring.
  const solid = layers.get('buildings') === SHOWN;
  picker?.setPickable(solid);
  // And a selection made before the layer faded goes with it. Leaving it
  // would keep a highlight box on something you can no longer click and, far
  // worse, leave every keyboard edit — reroll, delete, nudge — pointed at a
  // building you cannot see.
  if (!solid && state.selection) deselectBuilding();
}

function updateLayerCounts() {
  if (!layers || !state.city) return;
  layers.setCounts({
    buildings: state.city.buildings.length,
    roads: state.city.layout.roads.length,
    traffic: Math.round(state.params.carCount + state.params.flyerCount),
    particles: particles?.count || 0,
    curves: curves.length,
  });
}

// A one-off message that sits in the status bar until the next rebuild
// replaces it, for things worth reporting that are not ongoing state.
function setStatus(text) {
  statusEl.textContent = text;
}

// A transient message that survives the next rebuild, since anything worth
// announcing usually causes one and would otherwise be overwritten by the
// counts before it could be read.
let statusNote = '';
let statusNoteAt = 0;
function noteStatus(text, ms = 4000) {
  statusNote = text;
  statusNoteAt = performance.now() + ms;
  updateStatus();
}

// Three readouts rather than one line doing four jobs.
//
// The status slot carries only what just happened, so a message is not buried
// among counts that were already on screen. The scene name sits beside the
// control that sets it. The counts go with the frame rate, since they answer
// the same question, which is how heavy this is.
function updateStatus() {
  const note = statusNote && performance.now() < statusNoteAt ? statusNote : (statusNote = '');
  statusEl.textContent = note;
  statusEl.classList.toggle('on', Boolean(note));

  const edits = Object.keys(state.overrides).length;
  const heldRoads = Object.keys(state.params.roadEdits || {}).length;
  const merged = Object.keys(state.params.lotSpans || {}).length;
  // Read here rather than cached at rebuild time. Geometry is built in chunks
  // across several frames, so a note raised while drawing lands well after the
  // rebuild that caused it has returned.
  const subs = readNotes();
  if (sceneNameEl) {
    sceneNameEl.textContent = [
      state.sceneName || 'Unsaved',
      edits ? `${edits} edit${edits === 1 ? '' : 's'}` : null,
      // Counted apart from the edits, because holding a road is a different
      // kind of authoring: an edit says what one building looks like, a hold
      // says where a street is and moves everything standing on it.
      heldRoads ? `${heldRoads} road${heldRoads === 1 ? '' : 's'} held` : null,
      merged ? `${merged} merged lot${merged === 1 ? '' : 's'}` : null,
      // Worth its own word rather than folding into the count, because an
      // edit that is not on screen is the one you want to be told about.
      unplaced.length ? `${unplaced.length} unplaced` : null,
      // Places the town had to decide something for you. Counted by cause,
      // not by module, or one empty role would read as four hundred problems.
      subs.length ? `${subs.length} substituted` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    sceneNameEl.classList.toggle('warn', unplaced.length > 0 || subs.length > 0);
    // Hand edits are the thing you most want to notice you have, so the name
    // carries the count and marks itself when there are any.
    sceneNameEl.classList.toggle('edited', edits > 0);
  }
  updateHistoryButtons();
  updateLayerCounts();
  controls?.refreshModified();
}


// --- editor actions --------------------------------------------------------

// Every edit remembers the plot it was made on, stamped once when the
// override first appears and never rewritten. Never rewritten is the point:
// re-stamping on each edit would let the fingerprint follow the building as
// it drifted, which is precisely the drift it exists to notice.
function siteOf(id) {
  const building = byBuilding.get(id) || byModule.get(id)?.building;
  return building?.site || null;
}

function patchOverride(id, patch) {
  const current = state.overrides[id];
  const at = current?.at || siteOf(id);
  state.overrides[id] = { ...(current || {}), ...patch, ...(at ? { at } : {}) };
}

// Replaces rather than merges, which matters for anything that removes a
// field. Merging a patch that deleted a key leaves the key exactly where it
// was, so unlocking a facet quietly kept both the lock and the values it had
// captured — the thing carried on being frozen while claiming not to be.
function setOverride(id, next) {
  const at = state.overrides[id]?.at || siteOf(id);
  // `at` is bookkeeping, not an edit. An override holding nothing else is a
  // no-op that would still be counted, shown and saved, so it goes.
  const real = Object.keys(next || {}).filter((k) => k !== 'at');
  if (!real.length) {
    delete state.overrides[id];
    return;
  }
  state.overrides[id] = at ? { ...next, at } : next;
}

const actions = {
  buildingOverride: (id) => state.overrides[id] || {},
  refresh: () => refreshInspector(),

  setMode(mode) {
    if (!state.selection) return;
    state.selection.mode = mode;
    refreshHighlight();
    refreshInspector();
  },

  setFaceIndex(i) {
    if (!state.selection) return;
    state.selection.slot = i;
    refreshInspector();
  },

  setModule(id, patch) {
    patchOverride(id, patch);
    markLotOfModule(id);
  },

  // Locking captures what the module looks like right now, so the promise is
  // about a value somebody wrote down rather than one the generator might
  // happen to produce again. Unlocking takes those fields back out, which is
  // what makes it a genuine hand-back rather than a hidden edit.
  moduleLocks: (id) => locksOf(state.overrides[id]),
  toggleLock(id, facet) {
    const entry = byModule.get(id);
    if (!entry) return;
    const next = withFacet(state.overrides[id], entry.module, facet, !isLocked(state.overrides[id], facet));
    // Replaces, because unlocking is a removal. A merge would leave the
    // captured fields behind and the thing would stay frozen silently.
    setOverride(id, next);
    markLotOfModule(id);
    history?.record(`lock:${id}:${facet}`);
  },

  setFace(id, slot, patch, all, count = 1) {
    const current = state.overrides[id] || {};
    const faces = current.faces ? current.faces.slice() : [];
    const targets = all ? Array.from({ length: count }, (_, i) => i) : [slot];
    for (const i of targets) faces[i] = { ...(faces[i] || {}), ...patch };
    patchOverride(id, { faces });
    markLotOfModule(id);
  },

  deleteModule(id) {
    patchOverride(id, { deleted: true });
    markLotOfModule(id);
    deselect();
  },

  clearModule(id) {
    delete state.overrides[id];
    const entry = byModule.get(id);
    if (entry && !wasAnchored(entry.building.id)) markLot(entry.building.id);
    else markAll();
  },

  setBuilding(id, patch) {
    patchOverride(id, patch);
    markLot(id);
  },

  addFloor(id) {
    patchOverride(id, { floorsDelta: (state.overrides[id]?.floorsDelta || 0) + 1 });
    markLot(id);
  },

  removeFloor(id) {
    patchOverride(id, { floorsDelta: (state.overrides[id]?.floorsDelta || 0) - 1 });
    markLot(id);
  },

  rerollBuilding(id) {
    const nudge = (state.overrides[id]?.seedNudge || 0) + 1;
    clearModuleOverrides(id);
    patchOverride(id, { seedNudge: nudge });
    markLot(id);
  },

  glowBuilding(id) {
    const building = byBuilding.get(id);
    if (!building) return;
    const lit = building.modules.some((m) => m.glow);
    for (const module of building.modules) patchOverride(module.id, { glowTicket: lit ? 2 : -1 });
    markLot(id);
  },

  deleteBuilding(id) {
    patchOverride(id, { deleted: true });
    markLot(id);
    deselect();
  },

  clearBuilding(id) {
    const anchored = wasAnchored(id);
    clearModuleOverrides(id);
    delete state.overrides[id];
    // The fast path — rebuild this one lot against the site list already on
    // hand — assumes clearing an override never changes whether the site
    // itself should exist, which is true for every ordinary edit. It stops
    // being true for a plot the override was the only reason a road-less
    // road still had. Full rebuild, so `buildLayout` gets to decide fresh
    // whether anything belongs there now that nothing is claiming it.
    if (anchored) markAll();
    else markLot(id);
  },
};

// Every action that writes an override becomes an undo step. Wrapping them
// here rather than calling record() inside each body keeps the actions
// themselves about the edit and nothing else, and means a new action cannot
// quietly ship without history by forgetting a line.
//
// The continuous ones return a key so repeated changes of the same kind
// collapse: dragging a module's height is one step, not eighty. The key
// includes which fields changed, so moving height then width stays two steps.
const HISTORY_KEYS = {
  setModule: (id, patch) => `setModule:${id}:${Object.keys(patch).join(',')}`,
  setFace: (id, slot, patch) => `setFace:${id}:${slot}:${Object.keys(patch).join(',')}`,
  setBuilding: (id, patch) => `setBuilding:${id}:${Object.keys(patch).join(',')}`,
};

// Discrete edits always get their own step, however fast they are repeated.
const HISTORY_DISCRETE = [
  'deleteModule',
  'clearModule',
  'addFloor',
  'removeFloor',
  'rerollBuilding',
  'glowBuilding',
  'deleteBuilding',
  'clearBuilding',
];

for (const name of [...Object.keys(HISTORY_KEYS), ...HISTORY_DISCRETE]) {
  const inner = actions[name];
  actions[name] = (...args) => {
    const out = inner(...args);
    const key = HISTORY_KEYS[name] ? HISTORY_KEYS[name](...args) : null;
    history?.record(key);
    return out;
  };
}

// A reroll used to take every module edit in the building with it, which made
// locking pointless: the only way to keep anything was not to reroll. Held
// facets survive, everything else goes back to being generated, and an
// override left holding nothing is dropped rather than kept as clutter.
function clearModuleOverrides(buildingId) {
  for (const key of Object.keys(state.overrides)) {
    if (!key.startsWith(`${buildingId}_m`)) continue;
    const kept = keepLocked(state.overrides[key]);
    if (kept) state.overrides[key] = kept;
    else delete state.overrides[key];
  }
}

// The building half of deselection, kept apart from the curve half. A curve
// pick needs exactly this — clear whatever module or building was selected,
// leave the curve it just picked alone — and calling the combined `deselect`
// from inside `onPick` clears the curve `pointerDown` had only just set,
// since that call lands after the selection it is reporting on rather than
// before it.
function deselectBuilding() {
  state.selection = null;
  builder.isolate(null);
  picker.clear();
  inspector.hide();
}

function deselect() {
  deselectBuilding();
  deselectCurve();
}

// Puts the curve selection back to its resting state — the boundary if the
// scene has one, otherwise nothing — without touching whatever building
// selection exists. The two are independent state and every place that picks
// one now clears the other, so Delete and every curve shortcut always act on
// whichever was picked most recently rather than on whichever happens to
// still be sitting there from an earlier click.
function deselectCurve() {
  if (!curveEditor?.selectedCurve) return;
  curveEditor.select(state.params.boundary ? BOUNDARY_ID : null, []);
}

function refreshHighlight() {
  const sel = state.selection;
  if (!sel) return picker.clear();
  const building = byBuilding.get(sel.buildingId);
  if (!building) return picker.clear();
  if (sel.mode === 'building') return picker.showBuilding(building);
  const entry = byModule.get(sel.moduleId);
  if (!entry) return picker.clear();
  picker.showModule(building, entry.module);
}

function refreshInspector() {
  if (!state.selection) return inspector.hide();
  const palette = getPalette(state.params.palette);
  const building = byBuilding.get(state.selection.buildingId);
  if (!building) return inspector.hide();
  if (state.selection.mode === 'building') {
    return inspector.show(state.selection, null, building, palette, state.params);
  }
  const entry = byModule.get(state.selection.moduleId);
  if (!entry) return inspector.hide();
  inspector.show(state.selection, entry.module, building, palette, state.params);
}

// --- input -----------------------------------------------------------------

function bindPointer() {
  const canvas = stage.renderer.domElement;
  let down = null;

  canvas.addEventListener('pointerdown', (e) => {
    // Curves get first refusal on the press. Taking it means the orbit
    // controls have to stand down, or dragging a control point would spin the
    // camera underneath it at the same time.
    if (curveEditor?.pointerDown(e)) {
      stage.controls.enabled = false;
      canvas.setPointerCapture?.(e.pointerId);
      down = null;
      return;
    }
    down = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (curveEditor?.pointerMove(e)) {
      e.preventDefault();
      return;
    }
    // Not dragging, so the same move is a hover: which curve a click would
    // land on right now, found the same way the click itself would find it.
    // Sharing `pickCurve` with the actual pick is what keeps the preview
    // honest — a highlight built from a different test than the click uses
    // would eventually show a curve as reachable that a click then misses.
    // A handle first, because it is the more precise answer and the one that
    // outranks the line it sits on: over a control point, what a click does is
    // grab that point, not pick the curve. A grip reports itself under its own
    // curve's id, since that is what taking it selects.
    const handle = curveEditor?.pickHandle(e);
    if (handle) {
      curveView?.hover(handle.curveId, handle.grip ? handle.curveId : handle.pointId);
    } else {
      const near = curveEditor?.pickCurve(e, state.params.cell);
      curveView?.hover(near?.curve.id ?? null, null);
    }
    canvas.style.cursor = near ? 'pointer' : '';
  });

  canvas.addEventListener('pointerleave', () => {
    curveView?.hover(null);
    canvas.style.cursor = '';
  });

  const endCurveDrag = (e) => {
    if (!curveEditor?.dragging) return;
    curveEditor.pointerUp(e);
    stage.controls.enabled = true;
    canvas.releasePointerCapture?.(e.pointerId);
  };
  canvas.addEventListener('pointerup', endCurveDrag);
  canvas.addEventListener('pointercancel', endCurveDrag);

  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 5) return;

    const hit = picker.pick(e);
    if (!hit) {
      // Shift adds a control point to the curve you are already holding.
      //
      // Double-click did this and still does, but it was unreliable for a
      // reason no amount of aiming fixes: the first click of the pair runs the
      // ordinary click handler, and if it lands even slightly too far from the
      // line it deselects the curve — so the second click arrives with nothing
      // selected and adds nothing. Two thresholds had to pass in a row, and
      // missing either one silently undid the gesture. A modifier on a single
      // click has no such race.
      if (e.shiftKey && curveEditor?.addPointAt(e, { maxDistance: state.params.cell })) {
        noteStatus('Point added');
        stage.render();
        return;
      }
      // Nothing built under the pointer. Before giving up, ask the curves:
      // clicking beside a street is how you pick that street up, and a click
      // on empty tarmac is otherwise the one gesture in this tool that could
      // only ever mean "deselect".
      const near = curveEditor?.pickCurve(e, state.params.cell);
      if (near) {
        deselect();
        curveEditor.select(near.curve.id, []);
        noteStatus(describeCurve(near.curve));
        stage.render();
        return;
      }
      return deselect();
    }

    // A curve stays picked up until you put it down, and clicking a building
    // was never a way of doing that — so without this, picking a road and
    // then clicking a building leaves both selected at once, and Delete a
    // moment later hits the road instead of the building the click just
    // chose. Picking a building is exactly as clear a "not this curve
    // any more" as clicking empty ground is.
    deselectCurve();

    state.selection = {
      mode: e.shiftKey ? 'building' : 'module',
      moduleId: hit.moduleId,
      buildingId: hit.buildingId,
      slot: hit.slot,
    };
    // Lift the building out of its chunk so later edits rebuild only it.
    builder.isolate(hit.buildingId);
    const building = byBuilding.get(hit.buildingId);
    const module = byModule.get(hit.moduleId)?.module;
    if (state.selection.mode === 'building') picker.showBuilding(building);
    else picker.showModule(building, module, hit.point, hit.normal);

    // Orbit around what you picked, rather than around wherever the pivot
    // happened to be left.
    if (building) {
      const centre =
        state.selection.mode === 'building'
          ? new THREE.Vector3(building.x, (building.y || 0) + building.height / 2, building.z)
          : new THREE.Vector3(building.x, (building.y || 0) + (module ? module.y : 0), building.z);
      const size =
        state.selection.mode === 'building'
          ? building.height
          : Math.max(module ? module.w : 2, module ? module.h : 2);
      stage.focusOn(centre, size * 4.5);
    }
    refreshInspector();
  });

  // Double-click drops a new image straight onto the face you hit.
  canvas.addEventListener('dblclick', (e) => {
    // Unless it landed on the curve you are editing, in which case it adds a
    // control point there. Near the line only, so double-clicking a building
    // still does what it always did.
    if (curveEditor?.addPointAt(e, { maxDistance: state.params.cell })) return;
    const hit = picker.pick(e);
    if (!hit || !pool.length) return;
    const entry = byModule.get(hit.moduleId);
    if (!entry) return;
    actions.setFace(hit.moduleId, hit.slot, {
      image: Math.floor(Math.random() * pool.length),
      color: '#ffffff',
    });
  });
}

function bindKeys() {
  addEventListener('keydown', (e) => {
    // Undo is checked before the input guard, so it still works while a
    // number box happens to hold focus.
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) history?.redo();
      else history?.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      history?.redo();
      return;
    }
    // Optional call, because this is the one listener whose throwing would
    // take every shortcut in the tool down with it, and a keydown whose
    // target is not an element is one focus quirk away.
    if (e.target.matches?.('input, select, textarea')) return;
    const sel = state.selection;
    const entry = sel && byModule.get(sel.moduleId);

    // Curves answer Delete before a selected building does, and in one of
    // two ways depending on what is actually picked: control points first,
    // since a handle you just grabbed is the more specific target, and the
    // whole curve only once none are. A building can be selected at the same
    // time as a curve — they are independent pieces of state — but a curve
    // being current at all is a strong enough signal that Delete means the
    // curve, not whatever module happened to be clicked earlier.
    if (curveEditor?.enabled && curveEditor.selectedCurve) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (curveEditor.selectedPoints.size) return void curveEditor.deleteSelected();
        return void curveEditor.deleteCurve();
      }
      if (curveEditor.selectedPoints.size && (e.key === 'c' || e.key === 'C')) return void curveEditor.toggleCorner();
      if (e.key === 'l' || e.key === 'L') return void toggleHold();
    }

    if (e.key === 'Escape') {
      if (curveEditor?.selectedCurve && !state.selection) {
        curveEditor.select(state.params.boundary ? BOUNDARY_ID : null, []);
        return stage.render();
      }
      return deselect();
    }
    // Growing a building across its neighbours' plots. On the selection
    // rather than on the module, because it is the lot that changes, and it
    // works in either mode for the same reason.
    if (sel && (e.key === '+' || e.key === '=')) return void spanLot(sel.buildingId, 1);
    if (sel && (e.key === '-' || e.key === '_')) return void spanLot(sel.buildingId, -1);

    if (e.key === 'f' || e.key === 'F') return frameCity();
    if (e.key === 't' || e.key === 'T') {
      const on = flyby.toggle();
      if (tourButton) {
        tourButton.textContent = on ? 'stop the tour' : 'start the tour';
        tourButton.classList.toggle('on', on);
      }
      return;
    }
    if (!entry) return;
    const { module } = entry;
    const id = module.id;
    const slot = sel.slot || 0;
    // The module knows, once built. Falls back to the shape for a primitive,
    // which is every case where the two agree anyway.
    const count = slotsOf(module, library?.components?.get(module.kind));

    switch (e.key) {
      case 'i':
        actions.setFace(id, slot, { image: randomImage(), color: '#ffffff' }, false, count);
        break;
      case 'I':
        actions.setFace(id, slot, { image: randomImage(), color: '#ffffff' }, true, count);
        break;
      case 'm':
      case 'M': {
        const next = MODULE_KINDS[(MODULE_KINDS.indexOf(module.kind) + 1) % MODULE_KINDS.length];
        actions.setModule(id, { kind: next });
        break;
      }
      case 'g':
      case 'G':
        actions.setModule(id, { glowTicket: module.glow ? 2 : -1 });
        break;
      case ']':
        actions.setModule(id, { h: module.h * 1.12 });
        break;
      case '[':
        actions.setModule(id, { h: Math.max(0.15, module.h / 1.12) });
        break;
      case '.':
        actions.setModule(id, { w: module.w * 1.08, d: module.d * 1.08 });
        break;
      case ',':
        actions.setModule(id, { w: module.w / 1.08, d: module.d / 1.08 });
        break;
      case 'b':
      case 'B':
        actions.setMode(sel.mode === 'building' ? 'module' : 'building');
        break;
      case 'r':
      case 'R':
        actions.rerollBuilding(sel.buildingId);
        break;
      case 'Delete':
      case 'Backspace':
        if (sel.mode === 'building') actions.deleteBuilding(sel.buildingId);
        else actions.deleteModule(id);
        break;
      default:
        if (/^[1-9]$/.test(e.key)) actions.setFaceIndex(Math.min(count - 1, Number(e.key) - 1));
    }
  });
}

function randomImage() {
  return pool.length ? Math.floor(Math.random() * pool.length) : null;
}

function bindDropZone() {
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!e.dataTransfer.files.length) return;
    const json = [...e.dataTransfer.files].find((f) => f.name.endsWith('.json'));
    if (json) return loadFile(json);
    const added = await pool.addFiles(e.dataTransfer.files);
    if (added) {
      materials.setAtlas(pool);
      markAll();
    }
  });
}

// --- panels ----------------------------------------------------------------

function buildUI() {
  const defs = CONTROL_DEFS.flatMap((s) => s.items);
  defs.find((i) => i.key === 'palette').options = PALETTE_KEYS.map((k) => [k, PALETTES[k].label]);
  // `NONE_PATTERN` tacked on after the real patterns rather than folded into
  // `ROAD_PATTERNS` itself — see the comment on it in layout.js for why the
  // dice must never be able to land on it.
  defs.find((i) => i.key === 'roadPattern').options = [...ROAD_PATTERNS, NONE_PATTERN].map((k) => [k, PATTERN_LABEL[k]]);

  controls = new Controls(
    document.getElementById('controls-body'),
    CONTROL_DEFS,
    state.params,
    (key, value, def) => {
      state.params[key] = value;
      if (key === 'minFloors' && value > state.params.maxFloors) state.params.maxFloors = value;
      if (key === 'maxFloors' && value < state.params.minFloors) state.params.minFloors = value;
      if (def.cheap) {
        applyEnv();
        autosave();
        history?.record(`param:${key}`);
        return;
      }
      markAll();
      history?.record(`param:${key}`);
      // A seed that follows another one has nothing of its own to show but
      // whatever that one currently is, so changing the city seed has to
      // repaint the road and terrain rows too, not just the one that was
      // touched.
      if (def.type === 'seed') controls.sync(state.params);
    },
    state.paramLocks,
    (key, on) => {
      autosave();
      noteStatus(on ? `${key} locked against the dice` : `${key} unlocked`);
    }
  );

  // The wheel only ever shows what the role includes, so it is rebuilt when
  // the include list changes rather than carrying dead slices at zero. That
  // is the whole difference between excluding a shape and silencing it.
  const buildMixWheel = (wheelKey, role) => {
    const mount = controls.mounts.get(wheelKey);
    if (!mount) return;
    mount.replaceChildren();
    const keys = includedFor(state.params, role);
    wheels[wheelKey] = new MixWheel(
      mount,
      keys,
      wheelMeta(keys),
      state.params[wheelKey],
      (values) => {
        state.params[wheelKey] = { ...state.params[wheelKey], ...values };
        markAll();
        history?.record(`wheel:${wheelKey}`);
      }
    );
  };

  // Which components a role may use, shown as the things themselves rather
  // than a column of labels. Clicking opens the library as an overlay, and
  // what comes back is what the wheel underneath then divides up — so
  // choosing *what* and setting *how much* stay two separate, visible acts.
  const buildRoleToggles = (mountKey, role, wheelKey) => {
    const mount = controls.mounts.get(mountKey);
    if (!mount) return;

    const draw = () => {
      const on = includedFor(state.params, role);
      const docs = on.map((id) => library?.components.get(id)).filter(Boolean);

      const strip = h(
        'button',
        { class: 'role-strip', title: 'Choose which components this role uses' },
        ...docs.slice(0, 7).map((doc) =>
          h('img', { class: 'role-thumb', src: renderThumb(doc, library, 3), alt: doc.label, title: doc.label })
        ),
        docs.length > 7 ? h('span', { class: 'role-more' }, `+${docs.length - 7}`) : null,
        h('span', { class: 'role-pick' }, `${on.length} chosen`)
      );

      strip.addEventListener('click', () => {
        // Every component in the library, not a per-role shortlist. Which
        // things belong on a roof is a judgement the person making the town
        // is better placed to make than a tag written months ago, and an
        // assembly is exactly as placeable as a plain shape.
        const candidates = [...(library?.components.values() || [])].sort((a, b) => {
          const ai = ROLES[role].defaults.includes(a.id) ? 0 : 1;
          const bi = ROLES[role].defaults.includes(b.id) ? 0 : 1;
          return ai - bi || a.label.localeCompare(b.label);
        });
        openShelfPicker({
          title: `${ROLES[role].label} components`,
          help: ROLES[role].help,
          candidates,
          selected: includedFor(state.params, role),
          library,
          onCommit: (ids) => {
            const before = includedFor(state.params, role);
            state.params.roles = { ...(state.params.roles || {}), [role]: ids };
            // A component newly let into a role has no reason to already
            // have a share of the wheel — nobody has said how much of the
            // roof it should be yet. Left at that, it is included and
            // invisible: `pickWeighted` reads a missing weight as zero, the
            // wedge is too thin to draw, and the only way to notice is
            // spotting a legend row reading "0%" for something that should
            // be showing up. Starting it at the average of what is already
            // there is a real share without silently outweighing choices
            // someone already made.
            const added = ids.filter((id) => !before.includes(id));
            if (added.length) {
              const mix = { ...(state.params[wheelKey] || {}) };
              const weights = before.map((id) => Math.max(0, mix[id] || 0)).filter((w) => w > 0);
              const avg = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : 20;
              for (const id of added) if (!(id in mix)) mix[id] = Math.round(avg);
              state.params[wheelKey] = mix;
            }
            draw();
            buildMixWheel(wheelKey, role);
            markAll();
            history?.record(null);
            noteStatus(`${ROLES[role].label}: ${ids.length} components`);
          },
        });
      });

      setChildren(mount, strip);
    };

    roleRedraws.push(draw);
    draw();
  };

  buildRoleToggles('bodyRole', 'body', 'moduleMix');
  buildMixWheel('moduleMix', 'body');
  buildRoleToggles('roofRole', 'roof', 'roofMix');
  buildMixWheel('roofMix', 'roof');
  rebuildMixWheels = () => {
    buildMixWheel('moduleMix', 'body');
    buildMixWheel('roofMix', 'roof');
  };
  wheels.surfaceMix = new MixWheel(
    controls.mounts.get('surfaceMix'),
    SURFACE_KINDS,
    SURFACE_META,
    state.params.surfaceMix,
    (values) => {
      state.params.surfaceMix = values;
      markAll();
      history?.record('wheel:surfaceMix');
    }
  );

  inspector = new Inspector(
    document.getElementById('inspector'),
    pool,
    actions,
    matPool,
    () => stage.clockTime || 0
  );
  inspector.library = library;

  document.getElementById('btn-help').onclick = showShortcuts;

  // Built after the panels exist, because restoring a step has to push the
  // recovered values back into every slider and wheel on screen.
  history = new History(
    () => ({ params: state.params, overrides: state.overrides }),
    (snap) => {
      state.params = snap.params;
      state.overrides = snap.overrides;
      syncPanels();
      // The town's extent may have moved, so let the next rebuild reconsider
      // it rather than trusting the cached key.
      extentKey = '';
      markAll();
    }
  );
  history.reset();
  history.onChange(updateHistoryLabel);

  controls.setBaseline(state.params);

  layers = new Layers(document.getElementById('layers'), () => {
    applyLayerVisibility();
    stage.render();
  });
  // Once, now, rather than only on the first toggle. Everything that reads a
  // layer happened to default to visible on its own, so nothing noticed the
  // stored state was never actually applied at startup — right up until
  // something arrived whose safe default is off.
  applyLayerVisibility();

  buildSceneTools();
  buildBoundaryTools();
  buildTerrainTools();
  buildLandformTools();
  buildTourTools();
  refreshSceneMenu();
  updateStatus();
}

// The town's outline, as something you can pick up.
//
// Three shapes and a way back to none, which is the whole control. The
// alternative — an empty canvas and a note telling you to start clicking — is
// how a boundary tool goes unused: the useful gesture is nudging an outline
// that is already roughly right, not drawing one from nothing.
//
// Choosing Square is deliberately a no-op on the town. It is the extent cols
// and rows already implied, now with handles on it, so adopting a boundary
// never costs you the town you had.
let boundaryLabel = null;
let boundaryChips = {};

function buildBoundaryTools() {
  const mount = controls.mounts.get('boundaryTools');
  if (!mount) return;

  boundaryChips = {};
  const chips = BOUNDARY_SHAPES.map((shape) => {
    const chip = h('button', { class: 'chip' }, BOUNDARY_LABEL[shape].toLowerCase());
    chip.addEventListener('click', () => pickBoundaryShape(shape));
    boundaryChips[shape] = chip;
    return withHelp(
      chip,
      shape === 'square'
        ? 'The extent columns and rows already give you, with handles on its corners. Choosing it changes nothing until you drag one.'
        : shape === 'round'
          ? 'Twelve points on a circle. Pull it into an ellipse, a lozenge or a horseshoe.'
          : 'A circle with its radius pushed about, from the seed. A town that grew rather than one that was planned.',
      BOUNDARY_LABEL[shape]
    );
  });

  const clear = withHelp(
    h('button', {
      class: 'chip',
      onclick: () => {
        if (state.params.boundary && !confirm('Drop the boundary?\n\nAny points you moved go with it. Undo brings it back.')) return;
        setBoundary(null);
      },
    }, 'none'),
    'Back to the square columns and rows imply. The outline is discarded, so this is one to undo rather than redraw.',
    'No boundary'
  );

  boundaryLabel = h('div', { class: 'hint' });
  setChildren(mount, h('div', { class: 'chips' }, ...chips, clear), boundaryLabel);
  syncBoundaryTools();
}

// A shape chip has three things it can mean, and only one of them is worth
// protecting: re-clicking the shape a pristine boundary already is regens
// nothing (every shape here is deterministic in the current seed, so it
// would be bit-for-bit the same curve anyway); picking a different shape
// while pristine loses nothing since there is nothing authored yet to lose;
// picking any shape once the boundary has actually been dragged is the one
// case that erases real work, and is the only one that asks first.
//
// This is the direct answer to a boundary that turned out to be too easy to
// wipe by a stray click on a button that looks identical whether there is
// something to lose or not: the active shape now shows which one you are
// looking at, so a second click on it reads as "again", not "nothing".
function pickBoundaryShape(shape) {
  const current = state.params.boundary;
  if (current?.source === shape) return;
  // Only a boundary with nothing authored on it needs no protecting. A
  // pristine one — `source` still names a shape, whichever it is — has
  // nothing to lose by switching, so square to round to blob is free for as
  // long as none of them has been touched. The moment one has, `source` is
  // `null` (see the boundary `onChange` handler) and every shape click from
  // there on asks first, including the shape it already resembles.
  const pristine = current && current.source != null;
  if (current && !pristine && !confirm(`Replace the boundary with a fresh ${shape}?\n\nAny points you moved go with it. Undo brings them back.`)) {
    return;
  }
  const curve = boundaryShape(shape, defaultHalf(state.params), state.params.seed);
  setBoundary({ ...curve, source: shape });
}

function syncBoundaryTools() {
  if (!boundaryLabel) return;
  const drawn = state.params.boundary;
  boundaryLabel.textContent = drawn
    ? `${drawn.points.length} points. Show the Curves layer to drag them.`
    : 'No outline. The town fills the square columns and rows imply.';
  for (const [shape, chip] of Object.entries(boundaryChips)) {
    chip.classList.toggle('on', drawn?.source === shape);
  }
}

// --- terrain ---------------------------------------------------------------

// Two kinds of ground, and you are standing on exactly one of them.
//
// The chips are not a view filter — switching genuinely changes what the town
// is built on, and the sliders above and the shapes below are each dead while
// the other kind is chosen. Shown as two chips rather than a checkbox because
// neither is the "off" state of the other: rolled ground and placed ground are
// two ways of answering the same question, and a checkbox would have to name
// one of them as the exception.
let terrainChips = {};
let terrainHint = null;

function buildTerrainTools() {
  const mount = controls.mounts.get('terrainTools');
  if (!mount) return;
  terrainChips = {};

  const chips = [HILLS, DRAWN].map((mode) => {
    const chip = h('button', { class: 'chip' }, TERRAIN_MODE_LABEL[mode].toLowerCase());
    chip.addEventListener('click', () => setTerrainMode(mode));
    terrainChips[mode] = chip;
    return withHelp(
      chip,
      mode === HILLS
        ? 'Noise from a seed, shaped by the three sliders under this. Nothing to place and nothing to lose, but nothing you can put in a particular spot either.'
        : 'Shapes you place, each with its own height and falloff. The sliders under this stop applying — drawn ground is drawn ground, and mixing the two would mean a slider could move a hill you put down by hand.',
      TERRAIN_MODE_LABEL[mode]
    );
  });

  terrainHint = h('div', { class: 'hint' });
  setChildren(mount, h('div', { class: 'chips' }, ...chips), terrainHint);
  syncTerrainTools();
}

function setTerrainMode(mode) {
  if (state.params.terrainMode === mode) return;
  state.params.terrainMode = mode;
  history?.record('terrain-mode');
  extentKey = '';
  markAll();
  syncTerrainTools();
  syncLandformTools();
}

function syncTerrainTools() {
  const mode = state.params.terrainMode === DRAWN ? DRAWN : HILLS;
  for (const [key, chip] of Object.entries(terrainChips)) chip.classList.toggle('on', key === mode);
  if (!terrainHint) return;
  const n = (state.params.landforms || []).length;
  terrainHint.textContent =
    mode === DRAWN
      ? n
        ? `${n} shape${n === 1 ? '' : 's'} making the ground. The hill sliders are not in play.`
        : 'Nothing placed yet, so the ground is flat. Add a shape below.'
      : 'Rolled from the terrain seed. Anything you draw below is kept but not in play.';
}

// --- landforms -------------------------------------------------------------

// The list of drawn shapes, with the two numbers that decide what each one
// actually is: how high its top sits, and how far its slope runs before
// meeting whatever is underneath. Everything else about a landform — where it
// is, what shape it is — is edited by dragging it in the viewport, which is
// the whole reason it is a curve rather than a row of sliders.
let landformMount = null;
let landformList = null;
let landformHint = null;

function buildLandformTools() {
  landformMount = controls.mounts.get('landformTools');
  if (!landformMount) return;

  const chips = LANDFORM_SHAPES.map((shape) =>
    withHelp(
      h('button', { class: 'chip', onclick: () => addLandform(shape) }, LANDFORM_LABEL[shape].toLowerCase()),
      shape === 'square'
        ? 'Four corners. A mesa, a plinth, a raised block of town.'
        : shape === 'round'
          ? 'Twelve points on a circle. Pull it into a ridge, a crater rim or an island.'
          : 'A circle with its radius pushed about, from the seed. Ground that grew rather than ground that was planned.',
      `Add a ${LANDFORM_LABEL[shape].toLowerCase()} landform`
    )
  );

  landformList = h('div', { class: 'landforms' });
  landformHint = h('div', { class: 'hint' });
  setChildren(landformMount, h('div', { class: 'chips' }, ...chips), landformList, landformHint);
  syncLandformTools();
}

// A fresh shape lands offset from the ones already there, in a widening
// spiral. Dropping every new landform on the origin would put the second one
// exactly inside the first, where it is invisible and reads as the button
// having done nothing.
function addLandform(shape) {
  const half = defaultHalf(state.params);
  const list = state.params.landforms || [];
  const angle = list.length * 2.399;
  const spread = list.length ? half * 0.42 : 0;
  const curve = landformShape(shape, landformRadius(half), (state.params.seed >>> 0) + list.length, {
    x: Math.cos(angle) * spread,
    z: Math.sin(angle) * spread,
  });
  state.params.landforms = [...list, curve];
  // Placing ground is the unambiguous statement that you want drawn ground.
  // Adding a shape and watching nothing happen because a chip two rows up is
  // still on "hills" would be the tool being right and useless at once.
  state.params.terrainMode = DRAWN;
  history?.record('landform-add');
  extentKey = '';
  markAll();
  curveEditor?.select(curve.id, []);
  syncTerrainTools();
  syncLandformTools();
}

function removeLandform(id) {
  state.params.landforms = (state.params.landforms || []).filter((l) => l.id !== id);
  history?.record('landform-remove');
  extentKey = '';
  markAll();
  syncTerrainTools();
  syncLandformTools();
}

// Height and falloff, written straight through. Both rebuild the raster and
// therefore the whole ground, so neither is live while you drag — the same
// call the terrain sliders already make.
function setLandformField(id, field, value) {
  state.params.landforms = (state.params.landforms || []).map((l) =>
    l.id === id ? { ...l, [field]: value } : l
  );
  history?.record(`landform-${field}`);
  extentKey = '';
  markAll();
}

function syncLandformTools() {
  if (!landformList) return;
  const list = state.params.landforms || [];
  const drawn = state.params.terrainMode === DRAWN;

  setChildren(
    landformList,
    ...list.map((land, i) => {
      const num = (value, step, min, max, onCommit) => {
        const input = h('input', { type: 'number', class: 'num', step, value });
        input.addEventListener('change', () => {
          const v = Math.min(max, Math.max(min, Number(input.value)));
          if (!Number.isFinite(v)) return;
          input.value = v;
          onCommit(v);
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') input.blur();
          e.stopPropagation();
        });
        return input;
      };

      // The name says which shape it started as and how far up the stack it
      // is, because "landform 3" tells you nothing and the stack order is the
      // one property of a landform you cannot see by looking at it.
      const label = h(
        'button',
        {
          class: 'landform-name',
          onclick: () => {
            curveEditor?.select(land.id, []);
            noteStatus('Show the Curves layer to drag its points');
          },
        },
        `${i + 1}. ${LANDFORM_LABEL[land.source] || 'Shape'}`
      );

      return h(
        'div',
        { class: `landform-row${drawn ? '' : ' idle'}` },
        withHelp(label, 'Selects this shape so its control points show in the viewport. Turn on the Curves layer to drag them.', 'Select'),
        withHelp(
          num(land.height ?? 0, 0.5, -400, 400, (v) => setLandformField(land.id, 'height', v)),
          'How high the flat top of this shape sits. Negative digs a pit instead. Each shape lands at exactly this height whatever it is standing on, so a small one inside a big one is a step up rather than a total.',
          'Height'
        ),
        withHelp(
          num(land.falloff ?? 0, 0.5, 0, 400, (v) => setLandformField(land.id, 'falloff', v)),
          'How far out the slope runs before it meets the ground underneath. Zero is a sheer cliff at the outline you drew. Large is a swell you could drive up.',
          'Falloff'
        ),
        withHelp(
          h('button', { class: 'landform-del', onclick: () => removeLandform(land.id) }, '×'),
          'Removes this shape. Undo brings it back.',
          'Remove'
        )
      );
    })
  );

  landformHint.textContent = list.length
    ? drawn
      ? 'Top number is height, second is falloff. Later shapes layer over earlier ones.'
      : 'Kept, but the ground is set to hills. Switch to drawn above to use these.'
    : 'Nothing placed. A shape you add becomes the ground, and the outline you draw is its flat top.';
}

// What picking a curve up should tell you, which is always the same two
// things: what you have got, and what the next gesture does.
function describeCurve(curve) {
  if (!curve) return '';
  if (curve.id === BOUNDARY_ID) return 'Boundary. Drag a handle to move the edge of town';
  const label = curve.label || 'Road';
  return state.params.roadEdits[curve.id]
    ? `${label}, held. Drag a handle to reshape it, or L to let it go`
    : `${label}. Drag a handle to hold it there, or L to hold it as it is`;
}

// --- merged lots -----------------------------------------------------------

// Grow or shrink a building across the plots next to it along its street.
//
// The whole town is built at one footprint scale, which is why it reads as a
// texture however much the modules vary. This is the control that breaks
// that: a shop becomes a department store, four plots of housing become a
// market hall, and the skyline finally has something in it that is not
// lot-sized. See `applySpans` in layout.js for what a span is and why it is
// stored as a count rather than a set.
function spanLot(plotId, delta) {
  if (!plotId) return;
  const spans = state.params.lotSpans;
  const now = spans[plotId] || 1;
  // Six is arbitrary and generous: past that a building is longer than most
  // blocks and the span runs off the end of its street anyway.
  const next = Math.max(1, Math.min(6, now + delta));
  if (next === now) return;
  if (next === 1) delete spans[plotId];
  else spans[plotId] = next;

  // The lot list itself changes, so this is a whole-town rebuild rather than
  // the one-building path an ordinary edit takes.
  markAll();
  history?.record(`span:${plotId}`);
  noteStatus(next === 1 ? 'Back to one lot' : `Standing on ${next} lots`);
}

// --- holding roads ---------------------------------------------------------

// Take hold of a road, or record a change to one already held.
//
// Two gestures reach this. Dragging a control point calls it with the moved
// curve, because moving something is the clearest possible statement that you
// want it where you put it. Pressing L calls it with the road exactly as the
// pattern proposed it, which says the weaker and often more useful thing:
// keep this street, and reroll everything else around it.
//
// Both store the same record, and neither mints a new name. The road keeps
// the id it had, so every building on it keeps the id built from that, keeps
// its edits, and travels with the street. See `heldRoads` in layout.js.
function holdRoad(curve, reason = 'held') {
  const road = state.city?.layout?.roads?.find((r) => r.id === curve.id);
  const existing = state.params.roadEdits[curve.id];
  state.params.roadEdits[curve.id] = {
    curve: structuredClone(curve),
    // Width and kind come from the proposal the first time and are then the
    // scene's, since the road no longer has a proposal to read them off once
    // the pattern moves on.
    main: existing?.main ?? Boolean(road?.main),
    width: existing?.width ?? road?.width ?? state.params.streetWidth,
  };
  history?.record(reason === 'moved' ? `road:${curve.id}` : null);
  markAll();
  noteStatus(reason === 'moved' ? 'Road held where you put it' : 'Road held');
}

// Delete a road outright, distinct from releasing it. Release hands a road
// back to the pattern and it comes straight back, shaped however the pattern
// currently shapes it. Delete says there should be no road there at all —
// its buildings go with it, any hold on it goes with it, and the pattern's
// next proposal in the same place is refused rather than accepted.
function removeRoad(id) {
  delete state.params.roadEdits[id];
  state.params.roadRemoved[id] = true;
  if (curveEditor?.selectedCurve === id) curveEditor.select(state.params.boundary ? BOUNDARY_ID : null, []);
  markAll();
  history?.record(null);
  noteStatus('Road deleted');
}

function releaseRoad(id) {
  if (!state.params.roadEdits[id]) return false;
  delete state.params.roadEdits[id];
  history?.record(null);
  markAll();
  noteStatus('Road released, and back to the pattern');
  return true;
}

// L, on whichever curve is selected. A road the pattern is still proposing
// comes back the moment it is released; a road that has no proposal behind it
// any more — because the seed or the pattern moved on since you took hold of
// it — disappears, which is the honest outcome and is one undo away.
function toggleHold() {
  const id = curveEditor?.selectedCurve;
  if (!id || id === BOUNDARY_ID) return false;
  const curve = curveEditor.curveById(id);
  if (!curve) return false;
  if (state.params.roadEdits[id]) return releaseRoad(id);
  holdRoad(curve);
  return true;
}

function setBoundary(curve) {
  state.params.boundary = curve ? structuredClone(curve) : null;
  // The extent key holds the boundary's span, so a shape that happens to
  // cover the same ground reuses the terrain it is standing on.
  markAll();
  history?.record(null);
  syncBoundaryTools();
  noteStatus(curve ? 'Boundary drawn' : 'Boundary cleared');
}

// Undo and redo are primary actions and now live in the header rather than
// three clicks into a tab. The depth rides along in the tooltip, which is
// where it is useful and nowhere it is in the way.
function updateHistoryButtons() {
  if (!history) return;
  const { back, forward } = history.depth();
  if (undoBtn) {
    undoBtn.disabled = !history.canUndo();
    undoBtn.title = back ? `Undo (${back} back)` : 'Nothing to undo';
  }
  if (redoBtn) {
    redoBtn.disabled = !history.canRedo();
    redoBtn.title = forward ? `Redo (${forward} forward)` : 'Nothing to redo';
  }
}

function updateHistoryLabel() {
  updateHistoryButtons();
  if (!historyLabel || !history) return;
  const { back, forward } = history.depth();
  historyLabel.textContent = `${back} back · ${forward} forward`;
  historyLabel.classList.toggle('dim', back === 0 && forward === 0);
}

// Everything to do with saving, loading and starting over, gathered in one
// place instead of strung along the top bar.
function buildSceneTools() {
  const mount = controls.mounts.get('sceneTools');
  const select = h('select', { id: 'scene-list', class: 'wide' });
  select.onchange = () => {
    if (isPresetValue(select.value)) {
      const preset = presetAt(select.value);
      if (preset) applyScene(preset, preset.name, true);
      return;
    }
    const scene = Scenes.get(select.value);
    if (scene) applyScene(scene, select.value, false);
  };

  const fileInput = h('input', { type: 'file', id: 'load-json', accept: '.json,application/json', hidden: '' });
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  const save = (askName) => {
    const name =
      askName || !state.sceneName || state.scenePreset ? prompt('Save scene as', suggestName()) : state.sceneName;
    if (!name) return;
    Scenes.save(name, { ...state.params, __locks: state.paramLocks }, state.overrides);
    state.sceneName = name;
    state.scenePreset = false;
    refreshSceneMenu();
    updateStatus();
  };

  // Undo and redo moved to the header, where a primary action belongs.
  historyLabel = null;

  // Which scene is open, and whether it has hand edits on top. It sat in the
  // title bar, which is not the wrong idea, but it was floating text beside
  // the app tabs with nothing tying it to anything. Here it is the first line
  // of the tab that saves and loads it, which is where you look when you care.
  sceneNameEl = h('div', { class: 'scene-name', onclick: () => showNotices() });

  setChildren(mount,
    h('h3', { class: 'grp' }, 'Scenes'),
    sceneNameEl,
    withHelp(select, 'Presets ship with the site. Saved is your own library on this machine. Picking either loads its sliders and all its hand edits.', 'Scenes'),
    h(
      'div',
      { class: 'chips' },
      withHelp(h('button', { class: 'chip', onclick: () => save(false) }, 'save'), 'Saves over the scene you have open, or asks for a name if none is. A preset always asks, since it saves a copy rather than writing over the file it shipped in.', 'Save'),
      withHelp(h('button', { class: 'chip', onclick: () => save(true) }, 'save as'), 'Saves under a new name and switches to it.', 'Save as'),
      withHelp(
        h('button', {
          class: 'chip',
          onclick: () => {
            if (isPresetValue(select.value)) {
              alert("Presets ship with the site and can't be deleted here — export first if you want a copy to edit.");
              return;
            }
            const name = select.value || state.sceneName;
            if (!name || !confirm(`Delete the scene "${name}"?`)) return;
            Scenes.remove(name);
            if (state.sceneName === name) state.sceneName = '';
            refreshSceneMenu();
            updateStatus();
          },
        }, 'delete'),
        'Removes the selected saved scene. Export first if you want a copy. Presets cannot be deleted here.',
        'Delete'
      )
    ),
    h('h3', { class: 'grp' }, 'File'),
    h(
      'div',
      { class: 'chips' },
      withHelp(h('label', { class: 'chip' }, 'import', fileInput), 'Loads a scene file from disk. Dragging a .json onto the window does the same.', 'Import'),
      withHelp(h('button', { class: 'chip', onclick: exportJSON }, 'export'), 'Writes the current scene to a JSON file, for reloading here or dropping into presets.', 'Export')
    ),
    // Snapshot sits with the other ways of getting something out of the tool
    // rather than in the title bar. It produces a file, which is what every
    // other control in this group does.
    h('h3', { class: 'grp' }, 'Get a picture'),
    withHelp(
      h(
        'div',
        { class: 'chips' },
        h('button', { class: 'chip', onclick: snapshot }, 'snapshot'),
        h('button', { class: 'chip', onclick: () => frameCity() }, 'frame all')
      ),
      'Snapshot saves the current view as a PNG at the size of the viewport. Frame all pulls the camera back to fit the whole town, the same as pressing F.',
      'Picture'
    ),
    h('h3', { class: 'grp' }, 'Send to Blender'),
    withHelp(
      h(
        'div',
        { class: 'chips' },
        h('button', { class: 'chip', onclick: () => exportBlender(false) }, 'full geometry'),
        h('button', { class: 'chip', onclick: () => exportBlender(true) }, 'blockout')
      ),
      'Writes a .json and a .bin beside it. Run tools/blender_import.py in Blender and point it at the json. Full carries every real shape with its collage materials. Blockout swaps each module for its bounding box, which is a fraction of the size and is what a layout or camera pass actually needs.',
      'Blender export'
    ),
    h('h3', { class: 'grp' }, 'Roll the dice'),
    withHelp(
      h('button', {
        class: 'chip wide-chip',
        onclick: () => {
          if (!confirm('Randomise every setting?\n\nThis replaces all your current sliders. Hand edits are kept.')) return;
          state.params = { ...state.params, ...randomParams(state.params, state.paramLocks) };
          state.sceneName = '';
          deselect();
          syncPanels();
          extentKey = '';
          markAll();
          history?.record(null);
        },
      }, 'randomise everything'),
      'Rolls every setting at once, within ranges that actually produce a town rather than noise. One look effect gets to lead instead of all of them stacking. Asks first, and your hand edits survive.',
      'Randomise'
    ),
    h('h3', { class: 'grp' }, 'Start over'),
    h(
      'div',
      { class: 'chips' },
      withHelp(
        h('button', {
          class: 'chip',
          onclick: () => {
            state.overrides = {};
            deselect();
            markAll();
            history?.record(null);
          },
        }, 'clear edits'),
        'Drops every hand edit and leaves the sliders alone.',
        'Clear edits'
      ),
      // Separate from clearing edits, because they are separate kinds of
      // authoring and losing one while meaning to lose the other is exactly
      // the sort of thing a single "start over" button causes.
      withHelp(
        h('button', {
          class: 'chip',
          onclick: () => {
            const n = Object.keys(state.params.roadEdits || {}).length;
            if (!n) return noteStatus('No roads are being held');
            state.params.roadEdits = {};
            markAll();
            history?.record(null);
            noteStatus(`Released ${n} road${n === 1 ? '' : 's'}`);
          },
        }, 'release roads'),
        'Hands every held road back to the pattern. The streets you drew are discarded and the town regenerates around none of them. Undo brings them back.',
        'Release roads'
      )
    ),
    withHelp(
      h('button', {
        class: 'chip wide-chip danger',
        onclick: () => {
          if (!confirm('Reset every setting back to its default?\n\nThis also drops every hand edit. It cannot be undone.')) return;
          state.params = structuredClone({ ...DEFAULTS, ...ENV_DEFAULTS });
          state.overrides = {};
          state.sceneName = '';
          deselect();
          syncPanels();
          extentKey = '';
          markAll();
          history?.record(null);
        },
      }, 'reset to defaults'),
      'Puts every slider back where it started and drops all hand edits. Asks first.',
      'Reset'
    )
  );
}

function buildTourTools() {
  const mount = controls.mounts.get('tourTools');
  const button = withHelp(
    h('button', { class: 'chip wide-chip' }, 'start the tour'),
    'Drives the camera along the main roads, leaning into the turns. Orbiting is handed back when you stop. The T key does the same.',
    'Tour'
  );
  button.onclick = () => {
    const on = flyby.toggle();
    button.textContent = on ? 'stop the tour' : 'start the tour';
    button.classList.toggle('on', on);
  };
  tourButton = button;
  setChildren(mount, h('div', { class: 'chips' }, button));
}

// Shortcuts are reference, not settings. They were a tab among the editing
// panels, which put a page you read once beside pages you adjust constantly.
// Behind the question mark they are one keystroke away and never in the way.
function showShortcuts() {
  infoDialog({
    title: 'Keyboard shortcuts',
    wide: true,
    body: h(
      'div',
      {},
      h('p', { class: 'hint' }, 'Most of these act on whatever is selected.'),
      h(
        'dl',
        { class: 'keys' },
        SHORTCUTS.flatMap(([key, what]) => [h('dt', {}, h('kbd', {}, key)), h('dd', {}, what)])
      )
    ),
  });
}

function syncPanels() {
  controls.sync(state.params);
  // Loading a scene replaces the locks object wholesale, so the panel is
  // re-pointed at the new one rather than left holding the old.
  controls.locks = state.paramLocks;
  controls.syncLocks();
  // A freshly loaded scene is the new zero: "changed" should mean changed by
  // you since opening it, not different from a preset you never used.
  controls.setBaseline(state.params);
  // Roles first: the mix wheels are rebuilt against the include lists, so
  // they have to be current before the wheels are asked to show a value.
  for (const draw of roleRedraws) draw();
  rebuildMixWheels?.();
  wheels.moduleMix.set(state.params.moduleMix);
  wheels.roofMix.set(state.params.roofMix);
  wheels.surfaceMix.set(state.params.surfaceMix);
  syncBoundaryTools();
  syncTerrainTools();
  syncLandformTools();
}

// --- scenes ----------------------------------------------------------------

function suggestName() {
  const palette = getPalette(state.params.palette).label;
  return `${palette} ${state.params.seed}`;
}

document.title = APP_NAME;

const PRESET_PREFIX = '__preset__';
const isPresetValue = (v) => v.startsWith(PRESET_PREFIX);
const presetAt = (v) => presets[Number(v.slice(PRESET_PREFIX.length))];

function refreshSceneMenu() {
  const select = document.getElementById('scene-list');
  if (!select) return;
  const names = Scenes.list();
  const presetOpts = presets.map((p, i) =>
    h(
      'option',
      { value: `${PRESET_PREFIX}${i}`, ...(state.scenePreset && p.name === state.sceneName ? { selected: '' } : {}) },
      p.name
    )
  );
  const savedOpts = names.map((n) =>
    h('option', { value: n, ...(!state.scenePreset && n === state.sceneName ? { selected: '' } : {}) }, n)
  );
  setChildren(select,
    h('option', { value: '' }, names.length || presets.length ? 'Scenes' : 'No saved scenes'),
    ...(presetOpts.length ? [h('optgroup', { label: 'Presets' }, ...presetOpts)] : []),
    ...(savedOpts.length ? [h('optgroup', { label: 'Saved' }, ...savedOpts)] : [])
  );
  if (state.scenePreset) {
    const i = presets.findIndex((p) => p.name === state.sceneName);
    select.value = i >= 0 ? `${PRESET_PREFIX}${i}` : '';
  } else {
    select.value = state.sceneName || '';
  }
}

// Parameters that used to exist and no longer do.
//
// Both load paths spread a saved scene over the defaults, so a key nothing
// reads any more rides along forever — it survives every load, every save and
// every export, and the next person to read a scene file finds three settings
// that look like they should do something. Dropped on the way in, which is
// the one place both paths pass through.
//
// Kept as a list rather than removed silently so the reason is written down:
// particles briefly had a colour mode, a tint and a strength, and now take
// the palette's glow colours and nothing else.
// `roadGrade` was a maximum slope in degrees, which is the number the
// algorithm wants and exactly backwards as a control — larger meant steeper
// meant *less* bridging. `roadEase` replaces it running the other way, so
// zero is the identity. A stored value would be read as an easing amount and
// mean something entirely different, which is worse than not being there.
// `groundCustom` was the off switch beside the ground colour. Left in a saved
// scene it would do nothing, which is the least harmful failure but still a
// setting in a file that looks like it should matter.
const RETIRED = ['particleColor', 'particleTint', 'particleTintAmount', 'roadGrade', 'groundCustom'];

function loadParams(saved) {
  const params = { ...DEFAULTS, ...ENV_DEFAULTS, ...(saved || {}) };
  for (const key of RETIRED) delete params[key];
  return params;
}

function applyScene(scene, name, isPreset = false) {
  state.params = loadParams(scene.params);
  state.params.moduleMix = { ...DEFAULTS.moduleMix, ...(scene.params?.moduleMix || {}) };
  state.params.roofMix = { ...DEFAULTS.roofMix, ...(scene.params?.roofMix || {}) };
  state.params.surfaceMix = { ...DEFAULTS.surfaceMix, ...(scene.params?.surfaceMix || {}) };
  // A scene saved before roles existed has none, and gets the full lists,
  // so it generates exactly as it did when it was saved.
  state.params.roles = { ...DEFAULTS.roles, ...(scene.params?.roles || {}) };
  // Copied rather than shared. DEFAULTS is a module constant and a spread
  // hands out the same object every time, so a scene that has never held a
  // road would otherwise be writing its first one straight into the defaults
  // and into every other scene loaded after it.
  state.params.roadEdits = { ...(scene.params?.roadEdits || {}) };
  state.params.roadRemoved = { ...(scene.params?.roadRemoved || {}) };
  state.params.lotSpans = { ...(scene.params?.lotSpans || {}) };
  // Locks ride inside params so they survive every path a scene takes, but
  // they are not parameters and must not reach the generator.
  state.paramLocks = { ...(scene.params?.__locks || {}) };
  delete state.params.__locks;
  state.overrides = scene.overrides || {};
  state.sceneName = name || scene.name || '';
  state.scenePreset = isPreset;
  deselect();
  syncPanels();
  extentKey = '';
  markAll();
  history?.record(null);
}

async function loadFile(file) {
  try {
    const data = JSON.parse(await file.text());
    applyScene(data, data.name || file.name.replace(/\.json$/i, ''));
    if (state.sceneName) {
      Scenes.save(state.sceneName, state.params, state.overrides);
      refreshSceneMenu();
    }
  } catch (err) {
    alert(`Could not read that file: ${err.message}`);
  }
}

function exportJSON() {
  const name = state.sceneName || suggestName();
  const blob = new Blob(
    [JSON.stringify({ version: 2, name, params: state.params, overrides: state.overrides }, null, 2)],
    { type: 'application/json' }
  );
  const a = h('a', { href: URL.createObjectURL(blob), download: `${name.replace(/\s+/g, '-')}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportBlender(proxy) {
  // Any queued chunk meshing is irrelevant here since geometry is rebuilt
  // from the city data, but the data itself must be current.
  builder.flushAll();
  const name = state.sceneName || suggestName();
  const t0 = performance.now();
  const payload = buildExport({
    city: state.city,
    params: state.params,
    pool,
    matPool,
    stage,
    name,
    proxy,
  });
  downloadExport(payload, `${name}${proxy ? '-blockout' : ''}`);
  const c = payload.json.counts;
  const mb = (payload.bin.byteLength / 1048576).toFixed(1);
  setStatus(
    `Exported ${c.buildings} buildings, ${c.triangles.toLocaleString()} triangles, ${mb}MB in ${Math.round(performance.now() - t0)}ms`
  );
}

function snapshot() {
  picker.clear();
  stage.render();
  stage.renderer.domElement.toBlob((blob) => {
    const a = h('a', { href: URL.createObjectURL(blob), download: `awesome-town-${Date.now()}.png` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    refreshHighlight();
  });
}

function autosave() {
  Scenes.saveAuto({ ...state.params, __locks: state.paramLocks }, state.overrides, state.sceneName);
}

function restore() {
  const saved = Scenes.loadAuto();
  if (!saved) return;
  state.params = loadParams(saved.params);
  state.params.moduleMix = { ...DEFAULTS.moduleMix, ...(saved.params?.moduleMix || {}) };
  state.params.roofMix = { ...DEFAULTS.roofMix, ...(saved.params?.roofMix || {}) };
  state.params.surfaceMix = { ...DEFAULTS.surfaceMix, ...(saved.params?.surfaceMix || {}) };
  state.params.roles = { ...DEFAULTS.roles, ...(saved.params?.roles || {}) };
  state.params.roadEdits = { ...(saved.params?.roadEdits || {}) };
  state.params.roadRemoved = { ...(saved.params?.roadRemoved || {}) };
  state.params.lotSpans = { ...(saved.params?.lotSpans || {}) };
  state.paramLocks = { ...(saved.params?.__locks || {}) };
  delete state.params.__locks;
  state.overrides = saved.overrides || {};
  state.sceneName = saved.current || '';
  state.scenePreset = false;
}

// --- loop ------------------------------------------------------------------

const clock = new THREE.Clock();
let waveClock = 0;
let frameAccum = 0;
let frameCount = 0;
let statsAt = 0;

// Off while the components view is on screen. A hidden canvas draws to
// nobody, and the frames cost the same as the visible ones.
let onScreen = true;

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  // getDelta is still called above, so time does not jump when you come back
  // and the traffic picks up where it was rather than teleporting.
  if (!onScreen) return;
  // Drain queued chunk meshing inside a frame budget, so a global slider drag
  // updates the city in waves instead of stalling the whole frame.
  if (builder.pending.length) {
    builder.tick(6);
    if (!builder.pending.length) updateStatus();
  }
  // Picking and the selection outline read the wave off the CPU, so both
  // clocks have to agree on what time it is.
  waveClock = clock.elapsedTime;
  waveState.time = waveClock;
  builder.update(waveClock);
  traffic.update(dt, waveClock, groundAt, state.params);
  // One uniform write. Every particle's position, drift, spin and fade is a
  // function of this number and the attributes rolled at build time.
  particles.update(waveClock);
  flyby.update(dt, state.params, groundAt);
  if (state.params.waveHeight > 0 && state.selection) refreshHighlight();
  // Handles hold their size on screen rather than in the world, so this has
  // to run against the live camera every frame rather than at build time.
  curveView?.faceCamera(stage.camera, viewport.clientHeight);
  stage.render(dt, waveClock);

  frameAccum += dt;
  frameCount++;
  if (state.params.showStats && frameAccum - statsAt > 0.5) {
    const info = stage.renderer.info.render;
    const fps = frameCount / (frameAccum - statsAt);
    writeStats(statsEl, [
      ['FPS', fps.toFixed(0)],
      ['Draws', info.calls],
      ['Chunks', builder.stats.chunks],
      ['Buildings', state.city.buildings.length],
      ['Modules', builder.stats.modules],
      ['Tris', builder.stats.triangles.toLocaleString()],
    ]);
    statsAt = frameAccum;
    frameCount = 0;
  }
}

// Console handle, for poking at the city by hand.
Object.defineProperty(window, 'cc', {
  get: () => ({
    state, stage, builder, materials, pool, matPool, particlePool, picker, inspector, controls, wheels, traffic, particles, flyby,
    actions, flush, markAll, applyEnv, frameCity, history, presets, library, curveView, curveEditor, curves,
    liftAt, isRaised, layers,
  }),
});
