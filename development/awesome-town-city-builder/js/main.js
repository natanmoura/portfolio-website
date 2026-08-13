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
import { Controls, CONTROL_DEFS, h } from './ui.js';
import { Inspector } from './inspector.js';
import { initTooltips, withHelp } from './tooltip.js';
import { MixWheel } from './piechart.js';
import { Scenes } from './scenes.js';
import { slotCount } from './geometry.js';
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
} from './generate.js';
import { PALETTES, PALETTE_KEYS, getPalette, glassTint } from './palettes.js';
import { waveState, waveFrequency } from './wave.js';
import { ROAD_PATTERNS, PATTERN_LABEL } from './layout.js';
import { Traffic } from './traffic.js';
import { Flyby } from './flyby.js';
import { randomParams } from './randomize.js';
import { loadPresets } from './presets.js';

const APP_NAME = 'Awesome Town';

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
const wheelMeta = (keys) =>
  Object.fromEntries(keys.map((k) => [k, { label: KIND_LABEL[k], color: WHEEL_COLORS[k] }]));

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

boot();

async function boot() {
  restore();
  try {
    const presetsLoading = loadPresets();
    await pool.loadManifest('collage', (done, total) => {
      loadingEl.querySelector('.bar span').style.width = `${(done / total) * 100}%`;
      loadingEl.querySelector('.count').textContent = `${Math.min(done, total)} / ${total}`;
    });
    await matPool.loadMaterialManifest('collage');
    presets = await presetsLoading;
  } catch (err) {
    loadingEl.querySelector('.count').textContent = String(err.message || err);
    console.error(err);
  }

  stage = new Stage(viewport);
  materials = new CityMaterial();
  materials.setAtlas(pool);
  materials.setMatAtlas(matPool);
  builder = new CityBuilder(pool, materials);
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

  initTooltips();
  buildUI();
  bindPointer();
  bindKeys();
  bindDropZone();

  loadingEl.classList.add('gone');
  animate();
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
  state.city = generateCity(p, state.overrides, pool.imageCount, pool.cutoutCount, matPool.length, groundAt);
  stage.ground.setRoads(state.city.layout.roads, p);
  traffic.build(state.city.layout.roads, p, getPalette(p.palette));
  flyby.build(state.city.layout.roads, p);
  builder.build(state.city);
  if (stage) builder.sortPending(stage.camera);
  reindex();
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
    layout.half
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
  stage.setGridVisible(p.showGrid);
  stage.ground.setRoadsVisible(p.showRoads);
  traffic.setNight(night);
  traffic.setVisible(p.showCars);
  statsEl.classList.toggle('on', !!p.showStats);

  // The shader gates glow by comparing each module's ticket against the
  // chance. Mirror that here so the editor agrees about what is lit without
  // anything being rebuilt.
  if (state.city) {
    for (const b of state.city.buildings) {
      for (const m of b.modules) m.glow = m.glowTicket < p.glowChance;
    }
  }
}

function updateStatus() {
  const s = builder.stats;
  const edits = Object.keys(state.overrides).length;
  statusEl.textContent = [
    `${state.city.buildings.length} buildings`,
    `${s.modules} modules`,
    `${pool.length} images`,
    state.sceneName || null,
    edits ? `${edits} edits` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// --- editor actions --------------------------------------------------------

function patchOverride(id, patch) {
  state.overrides[id] = { ...(state.overrides[id] || {}), ...patch };
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

function clearModuleOverrides(buildingId) {
  for (const key of Object.keys(state.overrides)) {
    if (key.startsWith(`${buildingId}_m`)) delete state.overrides[key];
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
    return inspector.show(state.selection, null, building, palette);
  }
  const entry = byModule.get(state.selection.moduleId);
  if (!entry) return inspector.hide();
  inspector.show(state.selection, entry.module, building, palette);
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
    const count = slotCount(module.kind, module.blades);

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
    document.getElementById('controls'),
    CONTROL_DEFS,
    state.params,
    (key, value, def) => {
      state.params[key] = value;
      if (key === 'minFloors' && value > state.params.maxFloors) state.params.maxFloors = value;
      if (key === 'maxFloors' && value < state.params.minFloors) state.params.minFloors = value;
      if (def.cheap) {
        applyEnv();
        autosave();
        return;
      }
      markAll();
    }
  );

  wheels.moduleMix = new MixWheel(
    controls.mounts.get('moduleMix'),
    BODY_KINDS,
    wheelMeta(BODY_KINDS),
    state.params.moduleMix,
    (values) => {
      state.params.moduleMix = values;
      markAll();
    }
  );
  wheels.roofMix = new MixWheel(
    controls.mounts.get('roofMix'),
    ROOF_KINDS,
    wheelMeta(ROOF_KINDS),
    state.params.roofMix,
    (values) => {
      state.params.roofMix = values;
      markAll();
    }
  );
  wheels.surfaceMix = new MixWheel(
    controls.mounts.get('surfaceMix'),
    SURFACE_KINDS,
    SURFACE_META,
    state.params.surfaceMix,
    (values) => {
      state.params.surfaceMix = values;
      markAll();
    }
  );

  inspector = new Inspector(document.getElementById('inspector'), pool, actions, matPool);

  document.getElementById('btn-frame').onclick = () => frameCity();
  document.getElementById('btn-shot').onclick = snapshot;

  buildSceneTools();
  buildTourTools();
  buildShortcuts();
  refreshSceneMenu();
  updateStatus();
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
    Scenes.save(name, state.params, state.overrides);
    state.sceneName = name;
    state.scenePreset = false;
    refreshSceneMenu();
    updateStatus();
  };

  mount.replaceChildren(
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
      withHelp(h('button', { class: 'chip', onclick: exportJSON }, 'export'), 'Writes the current scene to a JSON file.', 'Export')
    ),
    h('h3', { class: 'grp' }, 'Roll the dice'),
    withHelp(
      h('button', {
        class: 'chip wide-chip',
        onclick: () => {
          if (!confirm('Randomise every setting?\n\nThis replaces all your current sliders. Hand edits are kept.')) return;
          state.params = { ...state.params, ...randomParams(state.params) };
          state.sceneName = '';
          deselect();
          syncPanels();
          extentKey = '';
          markAll();
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
  mount.replaceChildren(h('div', { class: 'chips' }, button));
}

function buildShortcuts() {
  const mount = controls.mounts.get('shortcuts');
  mount.replaceChildren(
    h('p', { class: 'hint' }, 'With a module selected.'),
    h(
      'dl',
      { class: 'keys' },
      SHORTCUTS.flatMap(([key, what]) => [h('dt', {}, h('kbd', {}, key)), h('dd', {}, what)])
    )
  );
}

function syncPanels() {
  controls.sync(state.params);
  wheels.moduleMix.set(state.params.moduleMix);
  wheels.roofMix.set(state.params.roofMix);
  wheels.surfaceMix.set(state.params.surfaceMix);
}

// --- scenes ----------------------------------------------------------------

function suggestName() {
  const palette = getPalette(state.params.palette).label;
  return `${palette} ${state.params.seed}`;
}

document.title = `${APP_NAME} City Builder`;

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
  select.replaceChildren(
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
  state.overrides = scene.overrides || {};
  state.sceneName = name || scene.name || '';
  state.scenePreset = isPreset;
  deselect();
  syncPanels();
  extentKey = '';
  markAll();
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
  Scenes.saveAuto(state.params, state.overrides, state.sceneName);
}

function restore() {
  const saved = Scenes.loadAuto();
  if (!saved) return;
  state.params = { ...DEFAULTS, ...ENV_DEFAULTS, ...(saved.params || {}) };
  state.params.moduleMix = { ...DEFAULTS.moduleMix, ...(saved.params?.moduleMix || {}) };
  state.params.roofMix = { ...DEFAULTS.roofMix, ...(saved.params?.roofMix || {}) };
  state.params.surfaceMix = { ...DEFAULTS.surfaceMix, ...(saved.params?.surfaceMix || {}) };
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

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
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
    statsEl.textContent = `${fps.toFixed(0)} fps · ${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris · ${builder.stats.chunks} chunks`;
    statsAt = frameAccum;
    frameCount = 0;
  }
}

// Console handle, for poking at the city by hand.
Object.defineProperty(window, 'cc', {
  get: () => ({
    state, stage, builder, materials, pool, picker, inspector, controls, wheels, traffic, flyby,
    actions, flush, markAll, applyEnv, frameCity,
  }),
});
