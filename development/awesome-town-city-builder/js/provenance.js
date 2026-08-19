// Why the town came out this way.
//
// Three places in this codebase are deliberately forgiving, and each one is
// right on its own:
//
//   `includedFor` hands back every default when a role's include list is
//   empty, because switching everything off is almost always a slip mid-edit
//   and a town of nothing is not useful to look at.
//
//   `pickWeighted` returns the first key when every weight is zero, because
//   the alternative is no module at all.
//
//   `narrow` keeps the inner constraint when two ranges cannot both be
//   satisfied, because the closer author is the one who meant it.
//
// They compose, and that is the problem. Switch a role empty inside an
// assembly that pins a range nothing can satisfy, and the answer is not an
// error and not nothing: it is a confident, arbitrary town, three layers away
// from where the contradiction was stated. There is no way to work backwards
// from the result to the cause, and it gets worse as layers multiply.
//
// So the behaviour stays and stops being silent. Nothing here changes what
// the generator does — it only writes down the moments where it had to choose
// for you.
//
// A register rather than a scope. The obvious shape is `collect(fn)` around a
// build, and it was the first thing here, and it was wrong: generation and
// geometry happen at different times — a component that reaches itself is
// only discovered when something tries to draw it, chunks at a time, frames
// later — so half the notes fell outside the wrapper. A register has no
// opinion about when a thing is noticed.
//
// Bounded by causes, not by occurrences. One empty role is one line whatever
// it touched, which is both the honest reading and what stops four hundred
// modules becoming four hundred entries.

const seen = new Map();

// Same cause reported from four hundred modules is one thing worth knowing.
// Whatever names the specific case joins the code to make the key, so two
// different roles are two lines and one role is one.
const keyOf = (code, d) => `${code}|${d?.role || d?.wheel || d?.param || d?.id || ''}`;

export function note(code, detail) {
  const k = keyOf(code, detail);
  const at = seen.get(k);
  if (at) at.count++;
  else seen.set(k, { code, detail, count: 1 });
}

// Called at the top of a full rebuild. Anything still true will report itself
// again on the way through; anything that does not was fixed.
export function resetNotes() {
  seen.clear();
}

export function readNotes() {
  return [...seen.values()].sort((a, b) => b.count - a.count);
}

// What each code means in a sentence, since the point is to be readable by
// the person who caused it rather than by whoever wrote it.
export const NOTE_TEXT = {
  'role-empty': (d) => `Nothing is switched on for the ${d.role} role, so every shape was allowed.`,
  'mix-zero': (d) => `Every share in ${d.wheel} is zero, so the first one was used.`,
  'mix-blocked': (d) => `Nothing in ${d.wheel} suited this building, so the rule was dropped for it.`,
  'range-empty': (d) => `${d.param} was given a range nothing can satisfy, so the inner one won.`,
  'slot-missing': (d) => `${d.parent} asks for a component called "${d.id}", which is not in the library.`,
  'too-deep': (d) => `${d.id} nests too deeply or reaches itself, so it was left empty.`,
};

export const describe = (n) => NOTE_TEXT[n.code]?.(n.detail || {}) || n.code;
