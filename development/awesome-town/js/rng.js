// Seeded randomness. Everything in the city derives from one integer seed plus
// stable per-lot hashes, so the same seed always rebuilds the same city and
// resizing the grid does not reshuffle the lots that were already there.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Streams keyed by a site id string, for layouts where lots are not on a grid.
export function hashId(seed, id) {
  const h = hashString(id);
  return hashCoords(seed, h & 0xffff, h >>> 16);
}

export function hashIdModule(seed, id, index) {
  return hashCoords(hashId(seed, id), index, 0x5bf03635);
}

// A stream per module rather than per building, so a module's traits depend
// only on where it is and never on how many rolls happened before it. That is
// what keeps a slider like "lit modules" from reshuffling the city.
export function hashModule(seed, gx, gz, index) {
  return hashCoords(hashCoords(seed, gx, gz), index, 0x5bf03635);
}

export function hashCoords(seed, x, z) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (x + 0x9e3779b9), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (z + 0xc2b2ae35), 0x27d4eb2f);
  h ^= h >>> 16;
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1) {
    this.next = mulberry32(seed >>> 0);
  }
  float() {
    return this.next();
  }
  range(min, max) {
    return min + this.next() * (max - min);
  }
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  pickIndex(len) {
    return Math.floor(this.next() * len);
  }
  // Jitter around 1.0 by +/- amount.
  jitter(amount) {
    return 1 + (this.next() * 2 - 1) * amount;
  }
  // Biased pick: bias < 1 favours low indices, bias > 1 favours high.
  weightedIndex(len, bias = 1) {
    return Math.min(len - 1, Math.floor(Math.pow(this.next(), bias) * len));
  }
}
