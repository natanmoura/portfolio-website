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
import { ROAD_PATTERNS, PATTERN_LABEL } from './layout.js';
import { Traffic } from './traffic.js';
import { Flyby } from './flyby.js';
import { randomParams } from './randomize.js';
import { loadPresets } from './presets.js';
import { loadEditedLibrary, EDITS_KEY, EDITS_EVENT } from './library.js';
import { openShelfPicker } from './shelfpicker.js';
import { infoDialog, confirmDialog } from './dialog.js';
import { renderThumb } from './thumbs.js';
import { ROLES, includedFor, toggleInRole, roleLabel } from './roles.js';
import { History } from './history.js';
import { Layers } from './layers.js';
import { initPanelResize } from './resizer.js';
import { buildExport, downloadExport } from './exporter.js';
import { writeStats } from './stats.js';
import { resetNotes, readNotes, describe } from './provenance.js';
import { FACETS, FACET_KEYS, locksOf, isLocked, withFacet, keepLocked } from './locks.js';

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
  flybySpeed: 16,
  flybyHeight: 3.2,
  flybyLookAhead: 16,
  flybyBank: 0.8,
  flybyPitch: 1.5,
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
  ['delete', 'remove it'],
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
// The wheel names its slices from the library when it can, so a component
// renamed in the editor renames its slice here too.
const wheelMeta = (keys) =>
  Object.fromEntries(
    keys.map((k) => [
      k,
      { label: library?.components.get(k)?.label || KIND_LABEL[k] || k, color: WHEEL_COLORS[k] },
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
let stage;
let materials;
let builder;
let picker;
let controls;
let inspector;
let traffic;
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
  const key = [p.cols, p.rows, p.cell, p.terrainHeight, p.terrainScale, p.terrainDetail, p.seed].join('|');
  if (key !== extentKey) {
    extentKey = key;
    stage.setExtent(p);
  }
  // Cleared at the top of the rebuild, read once the geometry is up. Anything
  // still true reports itself again on the way through, so this is a fresh
  // answer rather than an accumulating one.
  resetNotes();
  state.city = generateCity(p, state.overrides, pool.imageCount, pool.cutoutCount, matPool.length, groundAt, library);
  stage.ground.setRoads(state.city.layout.roads, p);
  traffic.build(state.city.layout.roads, p, getPalette(p.palette));
  flyby.build(state.city.layout.roads, p);
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
    layout.half,
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

  builder.root.visible = layers.visible('buildings');
  // The city owns its own ghost material, because its meshes share one
  // instance and it writes a mirror flag into the alpha channel that is only
  // safe while opaque. Fading it from out here would take the mirrors with
  // it and shuffle the whole draw order.
  builder.setGhost(layers.ghosted('buildings'));

  if (stage.ground.mesh) stage.ground.mesh.visible = layers.visible('ground');
}

function updateLayerCounts() {
  if (!layers || !state.city) return;
  layers.setCounts({
    buildings: state.city.buildings.length,
    roads: state.city.layout.roads.length,
    traffic: Math.round(state.params.carCount + state.params.flyerCount),
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
  // Read here rather than cached at rebuild time. Geometry is built in chunks
  // across several frames, so a note raised while drawing lands well after the
  // rebuild that caused it has returned.
  const subs = readNotes();
  if (sceneNameEl) {
    sceneNameEl.textContent = [
      state.sceneName || 'Unsaved',
      edits ? `${edits} edit${edits === 1 ? '' : 's'}` : null,
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
    markLotOfModule(id);
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
    clearModuleOverrides(id);
    delete state.overrides[id];
    markLot(id);
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

function deselect() {
  state.selection = null;
  builder.isolate(null);
  picker.clear();
  inspector.hide();
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
    down = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 5) return;

    const hit = picker.pick(e);
    if (!hit) return deselect();

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
    if (e.target.matches('input, select, textarea')) return;
    const sel = state.selection;
    const entry = sel && byModule.get(sel.moduleId);

    if (e.key === 'Escape') return deselect();
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
  defs.find((i) => i.key === 'roadPattern').options = ROAD_PATTERNS.map((k) => [k, PATTERN_LABEL[k]]);

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
            state.params.roles = { ...(state.params.roles || {}), [role]: ids };
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

  buildSceneTools();
  buildTourTools();
  refreshSceneMenu();
  updateStatus();
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

function applyScene(scene, name, isPreset = false) {
  state.params = { ...DEFAULTS, ...ENV_DEFAULTS, ...(scene.params || {}) };
  state.params.moduleMix = { ...DEFAULTS.moduleMix, ...(scene.params?.moduleMix || {}) };
  state.params.roofMix = { ...DEFAULTS.roofMix, ...(scene.params?.roofMix || {}) };
  state.params.surfaceMix = { ...DEFAULTS.surfaceMix, ...(scene.params?.surfaceMix || {}) };
  // A scene saved before roles existed has none, and gets the full lists,
  // so it generates exactly as it did when it was saved.
  state.params.roles = { ...DEFAULTS.roles, ...(scene.params?.roles || {}) };
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
  state.params = { ...DEFAULTS, ...ENV_DEFAULTS, ...(saved.params || {}) };
  state.params.moduleMix = { ...DEFAULTS.moduleMix, ...(saved.params?.moduleMix || {}) };
  state.params.roofMix = { ...DEFAULTS.roofMix, ...(saved.params?.roofMix || {}) };
  state.params.surfaceMix = { ...DEFAULTS.surfaceMix, ...(saved.params?.surfaceMix || {}) };
  state.params.roles = { ...DEFAULTS.roles, ...(saved.params?.roles || {}) };
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
  flyby.update(dt, state.params, groundAt);
  if (state.params.waveHeight > 0 && state.selection) refreshHighlight();
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
    state, stage, builder, materials, pool, matPool, picker, inspector, controls, wheels, traffic, flyby,
    actions, flush, markAll, applyEnv, frameCity, history, presets, library,
  }),
});
