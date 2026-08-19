// What "locked" means, when a lock is a set rather than a switch.
//
// Every procedural tool eventually asks you to choose between a thing being
// fully generated and a thing being fully frozen, and both answers are wrong
// most of the time. What you actually want to say is narrower:
//
//   "Keep this one a sphere, but let it reroll its size."
//   "It stays lit, whatever else changes."
//   "That collage took an hour to get right. Everything else is fair game."
//
// So a lock names *facets* — groups of fields that mean one thing to a person
// — and holds those while leaving the rest of the object generated.
//
// The mechanism it rides on already existed. An override field wins over what
// was generated, and always has; a facet is a grouping over which fields get
// captured, so locking is a copy from the generated object into the override
// plus a note saying which group it came from. That is what the roadmap means
// by locking being promotion: an unlocked thing is anonymous and derived, and
// locking moves the parts you named into the authored set, where a reroll
// cannot reach them.
//
// Fields are listed rather than inferred because the grouping is a judgement
// about what reads as one decision, not about how the data happens to be
// shaped. `scheme` and `faces` live together under Surface because nobody
// thinks of a building's two colours and its photographs as separate
// choices, even though the generator rolls them apart.

export const FACETS = {
  shape: {
    label: 'Shape',
    help: 'Stays this shape through a reroll. Its size, surface and light still change.',
    fields: ['kind', 'blades'],
  },
  size: {
    label: 'Size',
    help: 'Keeps these proportions. What it is made of and what it wears still change.',
    fields: ['w', 'h', 'd'],
  },
  surface: {
    label: 'Surface',
    help: 'Keeps its images, colours and material. The shape underneath still rerolls.',
    fields: ['faces', 'pattern', 'scheme', 'matKind', 'matIndex'],
  },
  light: {
    label: 'Light',
    help: 'Stays lit or unlit, in this colour, at this strength.',
    fields: ['glowTicket', 'glowColor', 'glowStrength'],
  },
};

export const FACET_KEYS = Object.keys(FACETS);

// Which facets an override is holding. Absent means none, which is every
// override written before locks existed — an edit is not a lock, and reading
// it as one would freeze half the town retrospectively.
export const locksOf = (over) => (Array.isArray(over?.lock) ? over.lock : []);

export const isLocked = (over, facet) => locksOf(over).includes(facet);

// Every field held by the current set, flattened.
export function heldFields(over) {
  const out = new Set();
  for (const facet of locksOf(over)) {
    for (const field of FACETS[facet]?.fields || []) out.add(field);
  }
  return out;
}

// The current value of everything in a facet, read off the thing as it stands
// right now. This is the copy that makes a lock survive a reroll: without it
// a lock would only be a promise about a value nobody wrote down.
//
// Undefined fields are skipped rather than captured as undefined, since a
// module that never had a material should not gain an explicit null and start
// overriding one it would otherwise be given.
export function captureFacet(module, facet) {
  const out = {};
  for (const field of FACETS[facet]?.fields || []) {
    const v = module?.[field];
    if (v === undefined) continue;
    // Deep enough for faces, which is the only nested one and the one most
    // worth keeping. A shared reference here would let the next rebuild edit
    // the thing that was supposed to be frozen.
    out[field] = typeof v === 'object' && v !== null ? structuredClone(v) : v;
  }
  return out;
}

// Adding a facet writes what it holds; removing one takes those fields back
// out, so unlocking genuinely hands the thing back to the generator rather
// than leaving the captured values behind as an invisible edit.
export function withFacet(over, module, facet, on) {
  const current = locksOf(over);
  const next = { ...(over || {}) };

  if (on) {
    Object.assign(next, captureFacet(module, facet));
    next.lock = current.includes(facet) ? current : [...current, facet];
    return next;
  }

  for (const field of FACETS[facet]?.fields || []) delete next[field];
  const rest = current.filter((f) => f !== facet);
  if (rest.length) next.lock = rest;
  else delete next.lock;
  return next;
}

// What survives a reroll: the held fields and the record of what is held.
// Everything else goes back to being generated, which is the whole point of
// asking for a reroll.
//
// Returns null when nothing was held, so the caller can drop the override
// rather than keep an empty one cluttering the scene.
export function keepLocked(over) {
  const held = heldFields(over);
  if (!held.size) return null;
  const out = { lock: locksOf(over) };
  for (const field of held) {
    if (over[field] !== undefined) out[field] = over[field];
  }
  // The fingerprint travels with it. A lock that forgets which plot it was
  // made on is exactly the edit Tier 0.2 exists to catch.
  if (over.at) out.at = over.at;
  return out;
}
