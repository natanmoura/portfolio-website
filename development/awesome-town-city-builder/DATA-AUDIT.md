# Data structure audit

Taken before building terrain, curves, volumes and scatter on top of what is
here. The question is not "does it work" — it does — but "which of these
structures will still be the right shape when there are a hundred thousand
things instead of three hundred, and when an edit has to survive a change
upstream of it."

Read alongside `ROADMAP.md`. Where the roadmap already names a problem, this
says whether the diagnosis was right and whether the priority still holds.

---

## What is genuinely sound, and should not be touched

These are load-bearing and they are correct. Listed because knowing what not
to redesign is half of an audit.

**The constraint model** (`constraints.js`). `free` / `range` / `fixed`, with
`resolveWith(param, proposed, seed, path)` as the single entry point. It is
one function, it composes with itself through `narrow`, it degrades to a
deterministic draw when nobody proposes, and no layer needs to know how many
layers are above it. Everything later in this document assumes it stays.

**Sparse overrides that a reroll happens around, not through.** Edits are
`{id: patch}`, applied after generation. A global reroll regenerates and then
reapplies. This is the correct shape and it is why the tool feels safe.

**Fixed ticket blocks per module.** `tickets()` rolls the same quantity in the
same order regardless of parameters, and parameters only decide how to read
them. This is the reason turning "lit modules" up lights modules that were
already there instead of reshuffling the town. It is a subtle discipline and
it has been held consistently.

**One document type for leaves and assemblies**, with parts naming children by
id rather than embedding them. Nesting, sharing and live propagation all fall
out of that one decision rather than needing machinery.

**Measured bounds with a stated invariant** — a resolved component stands on
y = 0, measured rather than nominal. Every stacking, framing and placement
system to come can rely on it without reading anything inside.

**`generate.js` is pure.** Data in, data out, no three.js. That is what makes
determinism testable and the exporter possible.

---

## Findings, ranked by what actually blocks the roadmap

### 1. Identity is positional, and the failure mode is worse than losing edits

`layout.js:284` mints building ids as `` `b${ri}_${counter++}` ``, where the
counter is per road and increments only on a *successful* placement. It sits
inside a loop that skips on `rng.chance(density)`, on `packing.fits`, and on
`kerbs.blocked`.

So any change to density, lot jitter, setback, street width, frontage spacing
or road count renumbers every building after the first one that moved. The
override keyed `b3_7` does not become orphaned. It lands on a **different
building**, and quietly applies someone's hand-authored floors, material and
deletions to a building they never touched. Module ids inherit this, since
they are `` `${buildingId}_m${i}` ``.

The roadmap already names this under Phase 1. Two corrections to the framing:

- It is described as "changing `cols` silently detaches every edit."
  Detaching would be the good outcome. It reattaches, which is data
  corruption, and it is silent in a way a user will read as the tool being
  unpredictable rather than as their own edit moving.
- It is sequenced after Phase 0 alongside four other identity features. The
  *misapplication* half should be split out and fixed first, because it is
  cheap and it is the only item here that can lose work.

**Cheapest correct fix, ahead of the full identity system:** an override
records a fingerprint of the site it was authored against — quantised x/z,
road index, and footprint. On reapply, a mismatch means skip and report,
never misapply. That converts corruption into a visible, recoverable
"3 edits could not be placed" without needing minted ids yet.

**The real fix**, when Phase 1 lands: derive ids from quantised world position
plus road identity rather than from an ordinal, so the id survives everything
that does not actually move the building. An id built from a counter is an id
that encodes iteration order, and iteration order is exactly the thing
procedural change is allowed to alter.

### 2. `module.kind` carries four unrelated meanings at once

The same string is used as:

- a component id, looked up in `library.components` (`build.js:214`)
- a geometry primitive name, switched on in `buildShape` (`geometry.js:554`)
- a key into hardcoded trait tables — `FAMILY`, `MATERIAL_KINDS`,
  `ROOF_KINDS`, `POINTED_ROOFS`, `SLOT_LABELS`, `FLAT_SLOTS`
- a member of a role's include list, which since the roles refactor may be
  **any component id at all**, including an assembly

The first three only line up because the library's leaf ids were deliberately
named after the primitives. The fourth broke that guarantee, and the breakage
is already live.

Put a `lamp-post` in the body role today and: `FAMILY['lamp-post']` is
undefined so it silently becomes `boxy` and drags the roof choice with it;
`MATERIAL_KINDS.has` is false so it can never take a material; and
`slotLabels` falls back to the box's six faces, so the inspector offers you
"right / left / top / bottom / front / back" for an object that has fifty-six
slots. Rendering survives — `build.js:225` re-runs `prepFaces` against the
merged slot count and repeats faces across the assembly — but every
*authoring* decision above it was made against the wrong vocabulary.

This is the single biggest correctness hazard for scale, because every system
in the roadmap adds more component ids that are not primitive names.

**Fix:** split the field. `m.componentId` says what to resolve; traits are
read from the resolved component's own document rather than from tables in
`generate.js`. `tags` already exists on every component doc and is currently
used for almost nothing — `["structural"]`, `["roof"]`, `["round"]`,
`["surfaceable"]` belong there, next to the shape they describe, where an
author adding a component declares them once instead of editing four sets in
two files. Keep the tables as the defaults leaf components inherit, so nothing
on disk has to change on day one.

### 3. Version fields exist and nothing reads them

Components carry `version: 1`. Scenes carry `version: 2`. The edits blob
carries nothing. `grep` finds no reader for any of them.

The concrete consequence is in `applyEdits` (`library.js:81`):

```js
out.set(id, out.has(id) ? { ...out.get(id), ...over } : over);
```

A shallow merge, disk under edit. Touch `box` once in the editor and your
edit's `params` shadows the disk copy forever. Ship an improved `box.json`
and everyone who ever opened `box` is pinned to their old version, with no
signal that a newer one exists and no way to take it.

**Fix:** store `baseVersion` on each edit at the moment it is written. On
load, compare; when disk is newer, either rebase the edit or surface it in the
shelf as "updated on disk". Cheap now, and impossible to retrofit once there
is a body of user edits in the wild.

### 4. `resolveComponent` is uncached, and the cache key is already free

Every module resolves its component from scratch, every rebuild, per building.
At three hundred modules this is invisible. Virtual scatter is the phase where
it stops being invisible, and it will look like a rendering problem rather
than a data one.

The good news is that this needs no restructuring: `resolveComponent` is
already a pure function of `(doc, lib, seed, path, proposals)`, and `path`
already carries everything that distinguishes one instance from another. A
memo keyed on `(id, seed, path, proposalHash)` drops in whole. The thing to
protect is the purity, not to add the cache today.

### 5. Overrides have no schema and never get collected

`state.overrides` is `{id: patch}` where a patch is free-form and mixes two
different record types — building-level (`deleted`, `seedNudge`,
`floorsDelta`, `material`) and module-level (any module field). Nothing
validates it. Nothing prunes keys whose building no longer exists. `saveAuto`
serialises the whole blob on every change.

Given finding 1, the dead keys are not merely waste: they are the keys most
likely to land on the wrong building later. A prune pass belongs with the
fingerprint check, not separately.

Splitting into `overrides.buildings` and `overrides.modules` also removes the
`key.startsWith(`${buildingId}_m`)` scan at `main.js:669`, which is a string
prefix search standing in for a relationship the structure should hold.

### 6. Empty means "everything" in three different places, and they compose

`includedFor` returns the full defaults on an empty include list.
`pickWeighted` returns `keys[0]` when every weight is zero. `narrow` keeps the
inner constraint when two ranges do not intersect.

Each is individually defensible and each is well argued in its comment. But
they stack. Switch a role empty inside an assembly that pins a range that
cannot be satisfied, and the result is not an error and not nothing — it is a
confident, arbitrary answer three layers from where the contradiction was
stated. That is unexplainable to a user, and it will get more common as the
layers multiply.

**Fix:** keep the forgiving behaviour, since it is right for mid-edit states,
but make it observable. A resolve pass that collects "I substituted a default
here, because of this" gives the provenance readout the roadmap already wants
in Phase 1 something real to read.

### 7. Two hash functions that must never be expected to agree

`rng.js` has `hashId`/`hashIdModule`; `constraints.js` has its own local
`hash`. The duplication is deliberate and the comment says why — a component
should resolve without dragging the city's generator in. That is a good
reason. But nothing anywhere states that the two are not interchangeable, and
the day someone reaches for the wrong one, every seed in the file it is called
from shifts and every saved scene silently regenerates differently.

**Fix:** cost is one comment on each, naming the other and saying they are
separate streams by design.

### 8. No shared spatial index

`layout.js` has `packing` and `kerbs`, each solving an XZ proximity query for
itself. Terrain sampling, curve projection, volume containment and scatter
rejection all want the same thing. Four more private implementations is the
default outcome if nothing is put down first.

Not urgent, but it is the one item here that is much cheaper to do *before*
the systems that need it than after.

### 9. Roads have no identity at all, and buildings key off their array index

Added after the first pass, which treated roads as a rendering concern and
missed that they sit upstream of everything in finding 1.

A road is `{ pts, main, width }` (`layout.js:52`). No id, no record, nothing
persisted. The four pattern functions push them into an array and the array
index *is* the road's identity — `roads.forEach((road, ri) => ...)` at
`layout.js:253`, and that `ri` goes straight into the building id as
`` `b${ri}_${counter++}` ``.

So the ordinal problem in finding 1 has two halves, and I only named the
second. The counter renumbers buildings *within* a road; `ri` renumbers
*every* road, and therefore every building in town, whenever the pattern
emits a different number of lines or emits them in a different order. Change
`roadPattern`, or the ring count in radial, or anything that makes `clipLine`
reject a line it previously accepted, and `ri` shifts underneath every
override in the scene.

Which means the fingerprint fix in finding 1 does not stand on its own. An
override fingerprinted against road 3 is fingerprinted against nothing stable
unless roads get identity first.

Beyond identity, roads are also the only major thing in the world with **no
editability whatsoever**. Buildings have overrides, modules have overrides,
components have an editor. A road cannot be moved, split, deleted, widened
individually, or drawn by hand. They are regenerated wholesale from
`(seed, params)` on every rebuild, and since buildings are placed along their
kerbs, roads are simultaneously the least editable thing in the tool and the
one with the largest effect on everything else.

The geometry is thin too, and worth knowing before curves land: one quad per
segment, mitred badly by its own admission (`terrain.js:151`), no junction
geometry, no kerbs, no markings, no width variation along a road. Fine for
massing. Not what a film pipeline needs from a street.

**Fix, in two steps.** First, a road record with a stable minted id, which is
a prerequisite for finding 1 rather than a follow-on from it. Second, roads
become the first consumer of the curve primitive, which is where editing,
junctions and proper geometry all come from at once — see the roads tier in
`NEXT.md`.

---

## Suggested sequence

1. Road identity (finding 9) — a prerequisite for the next item, not a
   parallel to it.
2. Override fingerprint + prune (findings 1, 5) — the only work here that
   prevents losing work, and it is small once roads are stable.
3. Split `kind` into component id and tag-derived traits (finding 2) — this
   unblocks every later system that adds non-primitive components.
4. `baseVersion` on edits (finding 3) — must land before there are edits in
   the wild worth preserving.
5. Shared spatial index (finding 8) — before terrain and curves, not after.
6. Resolve provenance (finding 6) — folds into Phase 1's readout.
7. Resolve memo (finding 4) — when scatter arrives, not before.

Findings 9, 1, 2 and 3 are corrections to what exists. Everything after is
groundwork, and none of it requires revisiting the constraint model, the
override model, or the component document, which are the three decisions the
rest of the tool is built on and which this audit found no reason to change.
