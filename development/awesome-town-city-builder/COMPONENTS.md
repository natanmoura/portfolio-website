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
