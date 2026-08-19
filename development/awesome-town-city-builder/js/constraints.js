// The constraint vocabulary, shared by every layer of the system.
//
// One rule holds the whole thing together: **the system proposes, the
// constraint disposes.** A city computes the height it wants for a module
// from its floor height and its setbacks; the component that module is made
// of gets the last word on whether that height is acceptable. Which word it
// says depends only on how locked the parameter is:
//
//   free   the author had no opinion   -> take the proposal
//   range  an opinion about bounds     -> clamp the proposal into them
//   fixed  an opinion about the value  -> ignore the proposal
//
// That is the entire mechanism, and it is why locking scales. Nothing needs
// to know which layer proposed, or how many layers there are. A parameter
// nobody has locked flows all the way up to whoever wants to drive it; the
// moment someone pins it, every layer above is overruled without any of them
// being rewritten.
//
// When there is no proposal at all — the editor showing a component on its
// own, a modifier parameter no system drives — the same call falls back to a
// deterministic draw from (seed, path), so an unlocked parameter is still a
// number rather than a hole.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const free = (min, max) => ({ mode: 'free', min, max });
export const range = (min, max) => ({ mode: 'range', min, max });
export const fixed = (value) => ({ mode: 'fixed', value });

export const MODES = ['free', 'range', 'fixed'];

// A cheap, well-mixed hash. Same family as `hashString` in rng.js, kept local
// so a component can be resolved without dragging the city's generator along
// — which is what lets the component editor open a lamp post with no town
// around it.
//
// The two are separate streams and must stay that way. They are not
// interchangeable: reaching for rng.js here would shift every seed this file
// produces, so every component in every saved scene would resolve to a
// different variant, and nothing would warn you because both answers look
// equally random. Same warning sits on rng.js, pointing back here.
function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // A final avalanche, or adjacent names come out adjacent.
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

export const unit = (str) => hash(str) / 4294967296;

export function normalise(param) {
  if (param === null || param === undefined) return free(0, 1);
  if (typeof param === 'number') return fixed(param);
  return param;
}

// Resolve with no proposal: the editor case, and every modifier parameter.
export function resolveParam(param, seed, path) {
  return resolveWith(param, undefined, seed, path);
}

// Resolve against what a system wants. `proposed` being undefined means
// nobody upstream had an opinion, so a free parameter draws for itself.
export function resolveWith(param, proposed, seed, path) {
  const p = normalise(param);
  if (p.mode === 'fixed') return p.value;

  const min = p.min ?? 0;
  const max = p.max ?? 1;

  if (proposed === undefined || proposed === null || Number.isNaN(proposed)) {
    return min + unit(`${seed}|${path}`) * (max - min);
  }

  // Free means the proposal stands as given. This is the case that lets a
  // component sit inside a city without fighting it: the town's massing
  // rules drive the size, and the component simply does not object.
  if (p.mode === 'free') return proposed;

  // Range is the in-between the whole model turns on — randomness upstream
  // is welcome, but only inside these walls.
  return clamp(proposed, min, max);
}

export function resolveParams(params, seed, path) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    out[key] = resolveParam(value, seed, `${path}.${key}`);
  }
  return out;
}

// Resolve a whole set against a set of proposals, keyed by name. Anything
// the proposer did not mention falls back to a draw, so a system can drive
// the two parameters it understands and leave the rest alone.
export function resolveParamsWith(params, proposals, seed, path) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    out[key] = resolveWith(value, proposals?.[key], seed, `${path}.${key}`);
  }
  return out;
}

// Composing two layers of constraint: the tighter one wins, and two ranges
// intersect. Used when a template pins a part, or a role narrows a
// component, so constraints can only ever get tighter going down the stack.
// An empty intersection keeps the inner opinion rather than inverting into
// nonsense — the closer author is the one who meant it.
export function narrow(outer, inner) {
  if (!inner) return normalise(outer);
  if (!outer) return normalise(inner);
  const a = normalise(outer);
  const b = normalise(inner);

  if (b.mode === 'fixed') return b;
  if (a.mode === 'fixed') return a;

  const min = Math.max(a.min ?? 0, b.min ?? 0);
  const max = Math.min(a.max ?? 1, b.max ?? 1);
  if (min > max) return b;

  // Range beats free: an opinion about bounds outranks no opinion at all.
  const mode = a.mode === 'range' || b.mode === 'range' ? 'range' : 'free';
  return { mode, min, max };
}

// Whether a system is allowed to drive this at all, which is what a UI needs
// to grey out a slider that a component has taken ownership of.
export const isDriveable = (param) => normalise(param).mode !== 'fixed';
