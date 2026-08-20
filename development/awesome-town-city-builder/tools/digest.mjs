// A fingerprint of the whole town, for changes that must not change it.
//
// Most of the work in this project is structural: a scalar becomes an
// interface, a name becomes an id, a private helper becomes a shared one.
// The bar for every one of those is that the town comes out byte-identical,
// and the only way to hold that bar is to be able to check it in a second.
//
// Runs the generator headless — nothing in its chain touches three.js — over
// every road pattern at a couple of sizes, and prints one hash per run. Diff
// the output before and after a change; anything that moves is either a bug
// or a decision you now have to make on purpose.
//
//   node development/awesome-town-city-builder/tools/digest.mjs

import { createHash } from 'node:crypto';
import { generateCity, DEFAULTS } from '../js/generate.js';
import { ROAD_PATTERNS } from '../js/layout.js';

// Quantised, so a change of representation that lands on the same place is
// not reported as a difference while anything that actually moves always is.
// A ten-thousandth of a metre is far below what is visible and far above the
// float noise two orderings of the same arithmetic can produce.
const q = (n) => (typeof n === 'number' ? Math.round(n * 10000) : n);

function digestCity(city) {
  const h = createHash('sha1');
  for (const road of city.layout.roads) {
    h.update(`road ${road.id} ${road.main} ${q(road.width)}`);
    for (const [x, z] of road.pts) h.update(` ${q(x)},${q(z)}`);
    h.update('\n');
  }
  for (const s of city.layout.sites) {
    h.update(`site ${s.id} ${q(s.x)} ${q(s.z)} ${q(s.angle)} ${q(s.w)} ${q(s.d)}\n`);
  }
  for (const b of city.buildings) {
    h.update(`b ${b.id} ${q(b.x)} ${q(b.z)} ${q(b.y)} ${b.gx} ${b.gz} ${b.modules.length}\n`);
    for (const m of b.modules) {
      h.update(`  m ${m.id} ${m.kind} ${q(m.w)} ${q(m.h)} ${q(m.d)} ${q(m.y)} ${q(m.rot)} ${m.glow}\n`);
      for (const f of m.faces || []) h.update(`   f ${JSON.stringify(f)}\n`);
    }
  }
  return h.digest('hex').slice(0, 16);
}

const runs = [];
for (const roadPattern of ROAD_PATTERNS) {
  for (const [cols, rows] of [
    [12, 12],
    [20, 14],
  ]) {
    runs.push({ roadPattern, cols, rows });
  }
}

for (const run of runs) {
  const params = { ...DEFAULTS, ...run };
  const city = generateCity(params, {}, 40, 12, 6, null, null);
  const label = `${run.roadPattern.padEnd(10)} ${run.cols}x${run.rows}`.padEnd(22);
  console.log(
    `${label} ${digestCity(city)}  ${String(city.layout.roads.length).padStart(4)} roads` +
      ` ${String(city.layout.sites.length).padStart(5)} sites` +
      ` ${String(city.buildings.length).padStart(5)} buildings`
  );
}
