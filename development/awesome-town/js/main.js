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
import { initTooltips } from './tooltip.js';
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
} from './generate.js';
import { PALETTES, PALETTE_KEYS, getPalette } from './palettes.js';
import { waveState, waveFrequency } from './wave.js';

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
  showGrid: false,
  showStats: true,
  waveHeight: 0,
  waveScale: 1.4,
  waveSpeed: 0.6,
  waveRock: 1,
};

const WHEEL_COLORS = {
  box: '#e0663a',
  octagon: '#e7a24a',
  cylinder: '#3f6f6a',
  pillars: '#7a3b2e',
  pillars8: '#a8623f',
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

const state = {
  params: structuredClone({ ...DEFAULTS, ...ENV_DEFAULTS }),
  overrides: {},
  city: null,
  selection: null,
  sceneName: '',
};

const byModule = new Map();
const byBuilding = new Map();

const viewport = document.getElementById('viewport');
const loadingEl = document.getElementById('loading');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');

const pool = new ImagePool();
let stage;
let materials;
let builder;
let picker;
let controls;
let inspector;
let wheels = {};

boot();

async function boot() {
  restore();
  try {
    await pool.loadManifest('collage', (done, total) => {
      loadingEl.querySelector('.bar span').style.width = `${(done / total) * 100}%`;
      loadingEl.querySelector('.count').textContent = `${Math.min(done, total)} / ${total}`;
    });
  } catch (err) {
    loadingEl.querySelector('.count').textContent = String(err.message || err);
    console.error(err);
  }

  stage = new Stage(viewport);
  materials = new CityMaterial();
  materials.setAtlas(pool);
  builder = new CityBuilder(pool, materials);
  stage.scene.add(builder.root);
  picker = new Picker(stage, builder);
  pool.onChange(() => materials.setAtlas(pool));

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
  state.city = generateCity(p, state.overrides, pool.length, groundAt);
  builder.build(state.city);
  if (stage) builder.sortPending(stage.camera);
  reindex();
}

function rebuildLot(id) {
  const match = /^b(\d+)_(\d+)$/.exec(id);
  if (!match) return;
  const gx = Number(match[1]);
  const gz = Number(match[2]);
  const building = generateLot(state.params, state.overrides, pool.length, gx, gz, groundAt);

  const list = state.city.buildings;
  const at = list.findIndex((b) => b.id === id);
  if (building) {
    if (at >= 0) list[at] = building;
    else list.push(building);
  } else if (at >= 0) {
    list.splice(at, 1);
  }
  reindex();

  if (builder.isolatedId === id && building) builder.rebuildSolo();
  else builder.rebuildChunkAt(gx, gz);
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
  materials.setBillboards(p.scrollShare, p.swapShare, p.flickerShare);
  materials.setDuotone(p.duotone, palette.ink, palette.paper);
  materials.setWaves(p.waveHeight, p.waveScale, p.waveSpeed, p.waveRock);
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
  stage.setShadows(p.shadows);
  stage.setGridVisible(p.showGrid);
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
    if (state.selection.mode === 'building') picker.showBuilding(building);
    else picker.showModule(building, byModule.get(hit.moduleId)?.module, hit.point, hit.normal);
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
  const paletteDef = CONTROL_DEFS.flatMap((s) => s.items).find((i) => i.key === 'palette');
  paletteDef.options = PALETTE_KEYS.map((k) => [k, PALETTES[k].label]);

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

  inspector = new Inspector(document.getElementById('inspector'), pool, actions);

  document.getElementById('btn-frame').onclick = () => frameCity();
  document.getElementById('btn-shot').onclick = snapshot;
  document.getElementById('btn-export').onclick = exportJSON;
  document.getElementById('btn-clear-edits').onclick = () => {
    state.overrides = {};
    deselect();
    markAll();
  };
  document.getElementById('btn-reset').onclick = () => {
    if (!confirm('Reset every slider and every hand edit?')) return;
    state.params = structuredClone({ ...DEFAULTS, ...ENV_DEFAULTS });
    state.overrides = {};
    state.sceneName = '';
    deselect();
    syncPanels();
    extentKey = '';
    markAll();
  };
  document.getElementById('load-json').onchange = (e) => {
    const file = e.target.files[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  bindSceneMenu();
  refreshSceneMenu();
  updateStatus();
}

function syncPanels() {
  controls.sync(state.params);
  wheels.moduleMix.set(state.params.moduleMix);
  wheels.roofMix.set(state.params.roofMix);
}

// --- scenes ----------------------------------------------------------------

function bindSceneMenu() {
  const select = document.getElementById('scene-list');
  select.onchange = () => {
    const name = select.value;
    if (!name) return;
    const scene = Scenes.get(name);
    if (!scene) return;
    applyScene(scene, name);
  };

  document.getElementById('btn-scene-save').onclick = () => {
    const name = state.sceneName || prompt('Save scene as', suggestName());
    if (!name) return;
    Scenes.save(name, state.params, state.overrides);
    state.sceneName = name;
    refreshSceneMenu();
    updateStatus();
  };

  document.getElementById('btn-scene-saveas').onclick = () => {
    const name = prompt('Save scene as', suggestName());
    if (!name) return;
    Scenes.save(name, state.params, state.overrides);
    state.sceneName = name;
    refreshSceneMenu();
    updateStatus();
  };

  document.getElementById('btn-scene-delete').onclick = () => {
    const name = document.getElementById('scene-list').value || state.sceneName;
    if (!name) return;
    if (!confirm(`Delete the scene "${name}"?`)) return;
    Scenes.remove(name);
    if (state.sceneName === name) state.sceneName = '';
    refreshSceneMenu();
    updateStatus();
  };
}

function suggestName() {
  const palette = getPalette(state.params.palette).label;
  return `${palette} ${state.params.seed}`;
}

document.title = `${APP_NAME} City Builder`;

function refreshSceneMenu() {
  const select = document.getElementById('scene-list');
  const names = Scenes.list();
  select.replaceChildren(
    h('option', { value: '' }, names.length ? 'Scenes' : 'No saved scenes'),
    ...names.map((n) =>
      h('option', { value: n, ...(n === state.sceneName ? { selected: '' } : {}) }, n)
    )
  );
  select.value = state.sceneName || '';
}

function applyScene(scene, name) {
  state.params = { ...DEFAULTS, ...ENV_DEFAULTS, ...(scene.params || {}) };
  state.params.moduleMix = { ...DEFAULTS.moduleMix, ...(scene.params?.moduleMix || {}) };
  state.params.roofMix = { ...DEFAULTS.roofMix, ...(scene.params?.roofMix || {}) };
  state.overrides = scene.overrides || {};
  state.sceneName = name || scene.name || '';
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
  state.overrides = saved.overrides || {};
  state.sceneName = saved.current || '';
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
  if (state.params.waveHeight > 0 && state.selection) refreshHighlight();
  stage.render();

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
    state, stage, builder, materials, pool, picker, inspector, controls, wheels,
    actions, flush, markAll, applyEnv, frameCity,
  }),
});
