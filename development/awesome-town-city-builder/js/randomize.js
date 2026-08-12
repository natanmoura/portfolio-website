// The dice.
//
// Rolling every slider across its full range gives noise, not a town. So each
// parameter has a range it is actually interesting across, and a few are tied
// together: floor minimums stay under maximums, look effects mostly stay off
// so one of them can be turned right up, and the counts stay somewhere a
// laptop can draw.

import { DEFAULTS, BODY_KINDS, ROOF_KINDS } from './generate.js';
import { PALETTE_KEYS } from './palettes.js';
import { ROAD_PATTERNS } from './layout.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const range = (a, b) => a + Math.random() * (b - a);
const rangeInt = (a, b) => Math.round(range(a, b));
// Biased toward the middle, for values where the extremes are rarely what you
// want but should still turn up sometimes.
const middling = (a, b) => a + ((Math.random() + Math.random()) / 2) * (b - a);
const chance = (p) => Math.random() < p;

function randomMix(keys, spread) {
  const out = {};
  for (const k of keys) out[k] = Math.random() ** spread;
  // One kind gets to dominate, or every town comes out the same soup.
  out[pick(keys)] += 1.4;
  const total = Object.values(out).reduce((a, b) => a + b, 0) || 1;
  for (const k of keys) out[k] = Math.round((out[k] / total) * 100);
  return out;
}

export function randomParams(current) {
  const p = { ...current };

  p.seed = Math.floor(Math.random() * 100000);

  // --- town ---------------------------------------------------------------
  p.cols = rangeInt(8, 22);
  p.rows = rangeInt(8, 22);
  p.cell = range(4.5, 9);
  p.density = range(0.55, 1);

  p.roadPattern = pick(ROAD_PATTERNS);
  p.roadSkew = Math.random() ** 1.4;
  p.blockWidth = range(1.1, 3.4);
  p.blockDepth = range(1.1, 3.4);
  p.highwayWidth = range(3.5, 8);
  p.streetWidth = range(1.6, 4);
  p.setback = range(0.1, 1.6);
  p.frontageSpacing = range(0.95, 1.5);
  p.blockDepthRatio = range(0.55, 1.4);

  p.minFloors = rangeInt(1, 5);
  p.maxFloors = p.minFloors + rangeInt(2, 22);
  p.centerBias = range(0.15, 0.95);
  p.floorHeight = range(1.4, 3.4);
  p.floorJitter = range(0.05, 0.55);
  p.lotFill = range(0.5, 0.95);
  p.lotJitter = range(0.05, 0.4);
  p.setbackChance = range(0, 0.6);
  p.setbackAmount = range(0.05, 0.4);
  p.bend = chance(0.35) ? range(0.15, 0.85) : range(0, 0.2);

  p.cohesion = range(0.45, 1);
  p.moduleMix = randomMix(BODY_KINDS, 1.6);
  p.roofMix = randomMix(ROOF_KINDS, 1.2);

  // --- traffic ------------------------------------------------------------
  p.carCount = rangeInt(30, 220);
  p.flyerCount = rangeInt(0, 45);
  p.mainRoadBias = range(0.4, 0.95);
  p.carSpeed = range(4, 14);
  p.carSize = range(0.7, 1.5);
  p.flyerHeight = range(8, 34);

  // --- surface ------------------------------------------------------------
  p.collageChance = range(0.25, 0.95);
  p.imageChance = range(0.3, 0.9);
  p.sameImageChance = range(0, 0.7);
  p.zoomJitter = range(0, 0.9);
  p.slabChance = range(0, 0.4);
  p.rotateChance = range(0, 0.6);
  p.spireChance = range(0, 0.8);
  p.wind = range(0.1, 0.9);

  p.palette = pick(PALETTE_KEYS);
  p.duotone = chance(0.3) ? range(0.3, 1) : range(0, 0.25);

  p.glowChance = range(0.1, 0.6);
  p.glowStrength = range(0.6, 1.7);
  p.glowTint = range(0.3, 1);
  p.glowImage = range(0.3, 1);
  p.scrollShare = range(0, 0.6);
  p.swapShare = range(0, 0.6);
  p.flickerShare = range(0, 0.35);

  // --- world --------------------------------------------------------------
  const hilly = chance(0.45);
  p.terrainHeight = hilly ? range(2, 14) : 0;
  p.terrainScale = range(0.3, 2.2);
  p.terrainDetail = rangeInt(1, 5);

  const wet = !hilly && chance(0.3);
  p.waveHeight = wet ? range(0.6, 3.2) : 0;
  p.waveScale = range(0.6, 2.6);
  p.waveSpeed = range(0.25, 1.2);
  p.waveRock = range(0.3, 1.4);

  p.hour = range(0, 24);
  p.sunAzimuth = range(-180, 180);
  p.sunStrength = middling(0.5, 1.8);
  p.ambient = middling(0.5, 1.8);
  p.exposure = middling(0.75, 1.45);
  p.fog = Math.random() ** 1.6;
  p.skyCustom = chance(0.25);
  p.skyColor = randomHex(0.35, 0.75);
  p.fogCustom = chance(0.2);
  p.fogColor = randomHex(0.3, 0.7);
  p.bloomStrength = middling(0.4, 1.8);

  // --- camera and render --------------------------------------------------
  // One effect gets to lead. Stacking all of them just makes mud.
  const lead = pick(['dof', 'halftone', 'posterize', 'none', 'none']);
  p.dof = lead === 'dof' ? range(0.5, 1) : chance(0.3) ? range(0.15, 0.4) : 0;
  p.dofAuto = chance(0.7);
  p.dofFocus = range(15, 90);
  p.dofRange = lead === 'dof' ? range(3, 18) : range(15, 60);
  p.bokeh = range(0.1, 0.8);
  p.halftone = lead === 'halftone' ? range(0.45, 0.95) : 0;
  p.halftoneScale = range(2, 7);
  p.posterize = lead === 'posterize' ? range(0.4, 0.9) : 0;
  p.posterizeSteps = rangeInt(3, 9);
  p.shadowSoftness = range(0.5, 5);
  p.occlusion = range(0.15, 0.65);
  p.occlusionHeight = range(2, 10);
  p.contrast = middling(0.85, 1.4);
  p.saturation = middling(0.7, 1.6);
  p.shadowTintOn = chance(0.4);
  p.shadowTint = randomHex(0.4, 0.8);
  p.highlightTintOn = chance(0.4);
  p.highlightTint = randomHex(0.6, 0.95);
  p.vignette = range(0, 0.5);
  p.grain = range(0, 0.2);

  // Keep the housekeeping toggles where they were.
  for (const key of ['showRoads', 'showCars', 'showGrid', 'showStats', 'bloomOn', 'shadows']) {
    p[key] = current[key] ?? DEFAULTS[key];
  }
  return p;
}

function randomHex(loL, hiL) {
  const h = Math.random();
  const s = range(0.15, 0.8);
  const l = range(loL, hiL);
  // Minimal HSL to RGB, enough for picking a colour.
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
