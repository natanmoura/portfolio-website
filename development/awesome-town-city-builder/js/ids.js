// Minted names, for the things that must not be known by their position.
//
// This is the third time. Roads were identified by their index in an array
// and every building id was built on top of it, so adding a road renumbered
// the town and hand edits landed on the wrong buildings. Parts inside an
// assembly were identified by their index in a list, so adding a plinth at
// the bottom of a lamp post rerolled the lamp at the top. Both were the same
// bug, and control points on a curve would have been the third instance of it
// — insert a point halfway along a road and every point after it moves one
// place, taking whatever was keyed to it along.
//
// So it lives here now, once, and anything that can be inserted into gets its
// name from this rather than from where it happens to sit.
//
// Two properties matter and neither is uniqueness across the universe:
//
//   Stable under insertion. A name is assigned once and never recomputed, so
//   nothing about it depends on its neighbours.
//
//   Unique within its parent. A curve's points, an assembly's parts. Ids are
//   scoped, which is why four characters of counter is enough and a UUID
//   would be forty bytes of noise in every saved file.
//
// Time is in there so two documents authored in different sessions do not
// collide when someone pastes one into the other, and a counter is in there
// so two minted in the same millisecond do not collide either.

let counter = 0;

export function mintId(prefix = 'i') {
  return `${prefix}${Date.now().toString(36).slice(-4)}${(counter++).toString(36)}`;
}

// The name of something that may not have one yet.
//
// Documents authored before a given thing had ids fall back to their index,
// which is exactly what they have always resolved against, so nothing already
// on disk shifts the first time it is read by newer code. New things are
// minted properly and the fallback quietly stops being reached.
export const idOf = (item, index, prefix = 'i') => item?.id || `${prefix}${index}`;

// Every id in a list, for checking a new one does not collide with an old one.
export const idsIn = (list, prefix = 'i') =>
  new Set((list || []).map((item, i) => idOf(item, i, prefix)));

// A name not already taken in this list. Only reached when a document mixes
// minted ids with fallbacks, which happens for exactly as long as it takes
// somebody to edit an old file once.
export function freshId(list, prefix = 'i') {
  const taken = idsIn(list, prefix);
  let id = mintId(prefix);
  while (taken.has(id)) id = mintId(prefix);
  return id;
}
