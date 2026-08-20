# Component system

The design for turning this from a city builder into a world builder. Written
before the code so the shape of the data is settled while it is still cheap to
change.

## The problem with what exists now

Today a module's shape is a string. `generate.js` rolls `'box'` or `'cone'`,
`geometry.js` has a function per string, and the city builder knows the whole
list by heart. That was right while there were eight shapes and one kind of
structure. It stops being right the moment you want a hand-tuned sign, or an
elevated highway, because:

- A shape cannot be authored. It is code, so a wonky cube means a new function.
- A shape cannot carry constraints. There is nowhere to say "this is between
  two and four metres tall and the rest is free."
- Nothing composes. A sign made of five stacked parts has no way to exist as
  one reusable thing that other systems understand.
- The city builder is the only consumer, and it is hardwired to buildings.

## The three objects

**Component.** One unit. A shape, a modifier stack, and a parameter schema.
This is a lego brick.

**Component template.** Several components assembled by a small construction
algorithm, with some parameters pinned and others left free. This is a lego
sub-assembly you keep as a unit: a sign, a stair run, a lamp post.

**System.** A large procedural algorithm that consumes components and
templates in named roles and produces a structure. The city builder is one
system. A road network is another. A pipe run is another.

Everything above a component is just a consumer of the layer below it, which
is what lets this grow past buildings without another rewrite.

## Parameters and the lock model

This is the heart of it. Every parameter on a component carries not just a
value but how free that value is:

```js
{ mode: 'free' }                        // the system may roll anything sensible
{ mode: 'range', min: 2, max: 4 }       // the system rolls inside these bounds
{ mode: 'fixed', value: 3.2 }           // authored, never rolled
```

A component author works by progressively locking down. You start with
everything free, tune the things you care about, and leave the rest for the
generator. That is what makes a component "a hybrid between authored and
procedural" rather than either extreme: the parts you had an opinion about
survive, and the parts you did not stay alive to variation.

Templates carry the same three modes over their own aggregate parameters, so
locking can happen at either level.

A free parameter has nothing to author, but that is not the same as nothing
worth showing: the editor resolves it against the same seed the viewport
does and displays that sample, dimmed, so a row reading "set by the scene"
is not indistinguishable from a control that does not work. Pinning it with
the `=` button starts from that sample rather than the middle of the
parameter's track, so taking control of a free value never moves the model
out from under you the instant you touch it.

### An assembly told a different size now actually becomes one

`w`/`h`/`d` are structural rather than incidental: every component occupies
some size on all three axes whether or not its author declared tunable
params for them. Two bugs followed from treating them as merely another
param a component might or might not mention.

**A component that never declared `w` could not be resized from outside,
even though a caller offered a size.** `resolveParamsWith` only ever answers
for keys a component's own `params` object lists, so a proposal for an axis
the component left out was silently dropped -- and most assemblies leave all
three out, since their size has always been "whatever the parts add up to."
Missing dims now read as free: a proposal for `w`, `h` or `d` is honoured
even when the component never thought to ask for one.

**Even a component that *did* accept a size only reported it, and never drew
it.** `resolveAssembly` computed the requested size and put it in `bounds`
for the inspector to read, and then built the geometry from the parts'
own native sizes regardless -- a `bounds` that disagreed with what the
triangles actually occupied. The fix bakes the request into the geometry
itself, once, after every part has already been placed: each piece's
position and vertex data get a genuine per-axis rescale, proportioned to
however the assembly as a whole needs to change, with its parts' *internal*
proportions preserved. That is what "resize an assembly while keeping its
composition" has to mean, since a child resolves its own absolute size from
its own params long before the assembly's request is even known -- there is
no path for a proposal to redistribute itself into each part's own size
independently, only to stretch the composed result afterward.

Verified directly against the shipped, unedited `lamp-post` component (whose
own `params` is empty): proposing a city-scale footprint of 6.2 × 2.8 × 5.7
produces a merged mesh whose measured vertex extent is exactly that, not the
lamp post's native ~0.3 × 2 × 0.3.

### Every module is a component now, not just the assemblies

`build.js`'s `shapeFor` used to branch: an assembly resolved through the
library, a leaf -- box, octagon, cylinder, everything the default town is
built from -- called `geometry.js`'s `buildShape` directly, a hardcoded path
that predates the component system and never consulted a leaf's own
document at all. Editing `box.json`'s `shapeOpts`, or renaming what shape it
actually built (`doc.shape`), changed nothing about what the city drew.

Every module now resolves through the same `resolveComponent` →
`mergeResolved` → `cropFaces` pipeline, leaf or assembly. The direct
`buildShape` call survives only as the fallback for a `kind` the library
genuinely does not have yet -- still loading, or a scene naming a component
since renamed or removed.

**The two conventions had to be reconciled, not just connected.** A
component previewed on its own -- the editor, a thumbnail -- sits with its
base at the floor, which is what standing something up on a table means.
A module in a stack is positioned by its centre instead: `restack` in
generate.js sets `m.y` to the middle of wherever it sits, the same way it
always has. Wiring the two together naively would have floated every module
half its own height above where it belongs -- which, worth noting, is a
pre-existing bug an assembly used as a module already had, independent of
anything about this change, since assemblies have always resolved through
the library and nothing before this ever corrected for it.

The correction happens once, at the point `shapeFor` hands geometry back to
the mesh builder. For a single-piece result -- every leaf, and what most
modules are -- it is exact: `resolveComponent` itself records how far it
lifted the piece to stand its measured base at zero, and subtracting that
recorded amount restores precisely what `buildShape` would have produced
directly, for any shape, symmetric or not. (A dome does not sit symmetrically
in its own nominal box, which is what proved half-the-measured-height was
the wrong formula before landing on this one.) An assembly has no single
piece to read a lift from -- its composed result is already based at zero,
the way each of its own children already is -- so it is recentred on its own
resolved height instead, the same assumption `restack` already makes for
everything else.

**None of this shows up in `digest.mjs`**, which hashes generated data, never
triangles. `tools/geom-diff.mjs` is the check that actually matters here: it
builds every default shape both ways -- the old direct call, the new routed
one -- across a spread of sizes, face patterns and blade counts, and diffs
every position, normal and UV value. 60 cases, 60 exact matches, including
the two that failed on the first pass and said something real: `spin`'s
blade count turned out to need its own threading through as a per-instance
proposal (`shapeOpts` is otherwise a fixed, per-document setting, and a
ticket-rolled blade count is neither fixed nor per-document), and `dome`'s
asymmetry is what proved the lift-based correction has to be exact rather
than approximated.

### A custom roof component could be chosen and still never appear

Two separate bugs, both older than the unification above and unrelated to
it, found only because someone actually tried adding a non-shipped
component to the roof role and it never showed up on a single building.

**The role picker included it correctly. The mix wheel gave it no reason to
ever be picked.** Choosing a component for a role writes straight to
`state.params.roles[role]`, but nothing gave the newly-added id a weight in
`roofMix` — `pickWeighted` reads a missing weight as zero, the wheel's own
wedge for it is too thin to draw (`if (a1 - a0 < 0.0004) return;`), and the
only trace was a legend row reading "0%" for something that should have
been showing up. A component added to a role now starts at the average
weight of what is already there — a real share, not zero, and not enough to
silently outweigh choices someone already made.

**Even weighted, it was never actually reachable.** This was the real one.
`generateLot` computes which roof ids a building may draw from — family
governs the classic shapes, a library component chosen for the role is
allowed regardless of family — and that computation was correct. But the
value it produces, `roofKind`, only ever gated *whether* a building gets
capped at all (`if (roofKind !== 'flat')`). The module's actual `kind` was
decided by a second, independent call inside `makeModule`'s own `isRoof`
branch, against its *own* `allow` set — computed the old way, intersecting
the family list directly against the role's include list, which can never
contain anything outside the five shipped roof shapes because the family
list itself never does. A custom roof component could be included, weighted,
and still be structurally unreachable, because the function that actually
assigns `kind` was never asking the question the includes list answers.

Pulled into one function, `roofAllowFor(roofKeys, family)`, called from both
places `generateLot` and `makeModule` used to compute this separately. Not
just deduplication: two copies of the same three lines are exactly how they
drifted in the first place, and a single copy is the only way this class of
bug does not recur the next time one of the two call sites gets edited and
the other does not. Verified directly: a component weighted at 1000 against
four classic roofs at 1 each was selected for 112 of 113 buildings in a
test town, at the correct city-driven scale and correctly seated on top of
its building — both because the assembly-scale and stacking fixes above
apply uniformly to every module, roof included, once it is actually being
chosen.

## Deterministic variation

A component must look different every time it is placed while staying stable
under re-rolls, which is the same problem the city already solved with
tickets. Same answer, one layer down:

```
resolve(component, seed) -> concrete instance
```

Every free or ranged parameter is resolved from a hash of `(seed, componentId,
paramName)`. The seed comes from the placing system. So the same component
placed in a thousand lots gives a thousand variants, the same lot always gives
the same one, and adding a new parameter does not disturb existing ones,
because each parameter draws from its own stream rather than a shared
sequence.

## Modifiers

An ordered stack evaluated after the base shape is built and before the
result is handed back. Each modifier is a pure function of geometry in,
geometry out, plus its own parameters, which follow the same lock model.

```js
{ type: 'noise', params: { x: {...}, y: {...}, z: {...}, scale: {...}, seedOffset: 0 } }
{ type: 'lattice', params: { divisions: 2, skewX: {...}, skewZ: {...}, taper: {...}, twist: {...} } }
```

Two to start:

- **noise** — per-axis translation noise with independent amounts for X, Y and
  Z, so you can make something lean without making it lumpy, or vice versa.
- **lattice** — a cube lattice around the object's bounds whose corners can be
  skewed, tapered and twisted, warping everything inside it. This is the one
  that makes a cube properly wonky rather than merely noisy.

Modifiers are ordered because they do not commute. Noise then lattice warps
the noise; lattice then noise adds noise on top of a warped shape. Both are
useful and they look different, so the stack is a list, not a set.

## Anchors, and why templates are more than groups

A system needs to know how to use a template without knowing what is inside
it. That is what anchors are for. Every component and template exposes:

```js
{
  bounds: { w, h, d },     // resolved, after modifiers
  anchors: {
    base:  { pos, normal },   // where it sits on whatever is below
    top:   { pos, normal },   // where the next thing stacks
    sides: [ ... ],           // optional attachment points
  },
  tags: ['roof', 'sign', 'structural'],
}
```

So when the city builder stacks a five-part sign template on a building, it
asks the template for its height and its top anchor and stacks accordingly. It
never learns what a sign is. This is the contract that lets new templates work
in old systems without touching the system's code.

`tags` are how a system decides what is eligible for a role, which replaces
today's hardcoded `ROOF_SET` and `MATERIAL_KINDS` sets.

## Roles, and include rather than exclude

A system declares the roles it can fill:

```js
CityBuilder.roles = {
  body:  { tags: ['structural'], stacking: 'linear' },
  roof:  { tags: ['roof', 'sign'] },
  spire: { tags: ['spire'], optional: true },
  ...
};
```

The scene then records, per role, which components are switched on and their
relative weights:

```js
roles: {
  body: { include: ['cube', 'octagon', 'wonky-cube-a'], mix: { cube: 50, ... } },
  roof: { include: ['cone', 'neon-sign-tpl'], mix: { ... } },
}
```

Include is a real list, not a weight of zero. A component that is not included
is not in the wheel at all, so the mix wheel only ever shows things you chose,
and the wheel controls proportion among them. That is the change from today,
where every shape is permanently present and must be zeroed to be silenced.

## The empty component

A first-class component with no geometry. It exists so a template can say
"something goes here, sometimes nothing does," and so parameters can be
attached to a hole. It carries the usual bounds and anchors, so a system
stacking through it behaves as though a real part were there. Its parameters
are the interesting bit: an empty with a `height` range punches a gap of
varying size into a stack, which is how you get a hole that sits randomly
between two heights without special-casing holes anywhere.

## Library and storage

One shared library, not a per-system one. A component authored for the city
should be usable by the road system without being copied, because the whole
point is accumulation.

```
library/
  components/    <id>.json
  templates/     <id>.json
  manifest.json
```

Same manifest pattern as `presets/` and `collage/`, generated by
`tools/scan.mjs`, so adding one is a matter of dropping a file in and
committing. A scene file then records which library entries it used, by id and
version, alongside the mix and the lock overrides. That keeps scenes small and
means improving a component improves every scene that uses it, while the
version field leaves room to pin one that must not change.

## Build order

1. Library data layer, `EMPTY`, load and save, manifest. Nothing visible yet.
2. Modifier stack, evaluated headlessly, with tests against known input.
3. Component editor window: viewport, stack UI, lock authoring, variant
   scrubbing.
4. Templates: assembly, aggregate anchors, constraint rollup.
5. Refactor the city builder onto roles, starting with roofs since they are
   the clearest case of "this should have been a component set all along."

Each step leaves the tool working. The city builder keeps its current
hardcoded path until step 5 swaps it, rather than being broken across the
whole build.
