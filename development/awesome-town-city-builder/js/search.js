// Finding a control without knowing where it lives.
//
// There are well over a hundred knobs across seven tabs. Remembering that
// time of day is called Hour and sits under Sky and sun is a tax on using the
// tool, so this searches labels, keys, section names and the help text that
// already describes every control in plain language. Searching "day" finds
// Hour because Hour's own help says "time of day", which means the index
// improves whenever the copy does, with no keyword list to keep in step.
//
// The synonym table therefore only carries what the copy cannot: words people
// reach for that appear nowhere in the writing.

const SYNONYMS = {
  hour: ['day', 'night', 'time', 'evening', 'morning', 'dusk', 'dawn', 'sunset', 'sunrise'],
  sunAzimuth: ['direction', 'compass', 'angle'],
  dof: ['blur', 'focus', 'depth of field', 'bokeh', 'defocus'],
  bokeh: ['blur', 'depth of field'],
  fog: ['haze', 'mist', 'atmosphere', 'distance'],
  palette: ['colour', 'color', 'scheme', 'theme'],
  duotone: ['colour', 'color', 'tint', 'grade'],
  contrast: ['grade', 'look', 'colour', 'color'],
  saturation: ['grade', 'look', 'colour', 'color', 'vivid'],
  grain: ['noise', 'film', 'look'],
  vignette: ['edge', 'darken', 'look'],
  halftone: ['dots', 'print', 'look', 'comic'],
  posterize: ['bands', 'flat', 'look'],
  bloomStrength: ['glow', 'bright', 'halation'],
  carCount: ['traffic', 'cars', 'vehicles'],
  flyerCount: ['traffic', 'flying', 'air', 'vehicles'],
  carSpeed: ['traffic', 'fast', 'slow'],
  waveHeight: ['water', 'sea', 'ocean', 'float', 'swell'],
  terrainHeight: ['hills', 'ground', 'landscape', 'elevation'],
  terrainTools: ['ground', 'terrain', 'hills', 'drawn', 'sculpt', 'landscape'],
  terrainStep: ['terraces', 'steps', 'stepped', 'shelves', 'layers', 'contour', 'ziggurat'],
  landformTools: ['hill', 'mesa', 'plateau', 'cliff', 'mountain', 'island', 'sculpt', 'raise', 'ground', 'terrain'],
  groundColor: ['grass', 'green', 'floor', 'earth', 'ground', 'colour', 'color'],
  roadHeight: ['viaduct', 'overpass', 'elevated', 'raised', 'bridge', 'flyover', 'stilts'],
  roadColor: ['tarmac', 'asphalt', 'street', 'colour', 'color'],
  particleCount: ['stars', 'sparks', 'dust', 'motes', 'embers', 'snow', 'hologram', 'air', 'atmosphere'],
  particleGlow: ['bloom', 'bright', 'neon', 'hologram', 'light'],
  particleOpacity: ['transparent', 'hologram', 'ghost', 'fade'],
  flybySmoothing: ['tour', 'camera', 'smooth', 'jitter', 'damping', 'shake'],
  flybyPitch: ['tour', 'camera', 'look up', 'aim', 'tilt'],
  bend: ['lean', 'wonky', 'curve', 'tilt'],
  cohesion: ['variety', 'consistency', 'mix'],
  glowChance: ['lights', 'lit', 'neon', 'night'],
  shadowDetail: ['resolution', 'quality', 'crisp'],
  shadowSamples: ['quality', 'noise', 'grain'],
  ao: ['occlusion', 'contact', 'corners', 'shading'],
  exposure: ['brightness', 'bright', 'dark'],
  seed: ['random', 'reroll', 'variation'],
  cols: ['size', 'width', 'grid', 'big', 'large'],
  rows: ['size', 'depth', 'grid', 'big', 'large'],
  surfaceMix: ['material', 'glass', 'mirror', 'image', 'cutout', 'texture', 'cladding'],
  moduleMix: ['shapes', 'kinds', 'blocks'],
  roofMix: ['tops', 'caps'],
};

const normalise = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Splits camelCase keys so "shadowDetail" is findable by typing "detail".
const words = (s) =>
  normalise(String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2'))
    .split(' ')
    .filter(Boolean);

export function buildIndex(entries) {
  return entries.map((e) => {
    const synonyms = SYNONYMS[e.key] || [];
    return {
      ...e,
      _label: normalise(e.label),
      _labelWords: words(e.label),
      _keyWords: words(e.key),
      _section: normalise(e.section),
      _sectionWords: words(e.section),
      _help: normalise(e.help),
      _synonyms: synonyms.map(normalise),
    };
  });
}

// How well one query token matches one entry. Higher is better, 0 is no match.
function scoreToken(entry, token) {
  if (entry._label === token) return 120;
  if (entry._labelWords.some((w) => w === token)) return 100;
  if (entry._labelWords.some((w) => w.startsWith(token))) return 80;
  if (entry._keyWords.some((w) => w === token)) return 75;
  if (entry._synonyms.some((s) => s === token || s.split(' ').includes(token))) return 70;
  if (entry._sectionWords.some((w) => w === token)) return 55;
  if (entry._label.includes(token)) return 50;
  if (entry._keyWords.some((w) => w.startsWith(token))) return 45;
  if (entry._sectionWords.some((w) => w.startsWith(token))) return 35;
  if (entry._synonyms.some((s) => s.includes(token))) return 30;
  // Help text is the widest net and so the weakest signal. It is what lets
  // "day" reach Hour, whose help mentions time of day.
  if (entry._help.includes(token)) return 20;
  return 0;
}

export function search(index, query, limit = 12) {
  const tokens = normalise(query).split(' ').filter(Boolean);
  if (!tokens.length) return [];

  const scored = [];
  for (const entry of index) {
    let total = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const s = scoreToken(entry, token);
      if (s === 0) {
        matchedAll = false;
        break;
      }
      total += s;
    }
    if (!matchedAll) continue;
    // A shorter label matching the same query is usually the more direct hit.
    total -= Math.min(20, entry._label.length * 0.3);
    scored.push({ entry, score: total });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}
