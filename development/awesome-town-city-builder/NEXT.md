# What to build next

Everything outstanding, in one list, ordered. This merges three sources that
were drifting apart: the phases in `ROADMAP.md`, the nine findings in
`DATA-AUDIT.md`, and the loose feature work agreed in conversation but never
written down.

`ROADMAP.md` still holds the reasoning for *why* each phase exists and what it
is worth. This holds the order and the reasons the order changed. Where the
two disagree, this one is newer.

---

## What the audit changed about the plan

Six things, and they are the whole reason this document exists rather than
an edit to the roadmap.

**One item is losing work right now.** Everything else on the list is
groundwork or capability. Positional building ids do not merely fail to
protect an edit, they hand it to the wrong building. That belongs before all
capability work, and it is small.

**Roads were one bullet and needed a tier.** The old plan had "roads become a
curve consumer" buried in the curves phase. But roads are the least editable
thing in the tool — no id, no override of any kind, regenerated wholesale
every rebuild — and the one with the largest effect on everything else, since
buildings are placed along their kerbs. They also sit *upstream* of the
identity problem: building ids embed the road's array index, so road identity
is a prerequisite for fixing building identity rather than a follow-on.

**The generation chain should be editable at every stage, and it isn't
written down anywhere.** `buildLayout` computes a boundary, generates roads
from it, and walks their kerbs for lot sites — all inside one call, with
every intermediate thrown away. Each of those should be an artifact you can
hold and edit, where editing regenerates what is downstream and leaves what
is upstream alone. That covers both the "roads generated from curves, then
edited further" workflow and the "town extent is a shape you drew on the
terrain rather than rows and columns" one, which are the same idea applied at
two points in the chain. It is now the framing of Tier 4 rather than a bullet
inside it.

**Curves move ahead of terrain.** Consequence of the above: the boundary and
the roads both want curves, both work on flat ground, and neither needs a
terrain field to be useful. The roadmap's `Terrain -> Curves -> ...` chain is
the evaluation order at runtime, not the order to build them in.

**Phase 1 was one block and should be two.** "Identity and locking" bundles a
data-integrity fix with four authoring features. The fix is a day; the
features are weeks. Splitting them means the corruption stops next, not after
locked facets and reference frames are designed.

**The `kind` fix and Phase 2 are the same work.** Untangling `module.kind`
into a component id plus tag-derived traits produces exactly the first two
fields of the placement record Phase 2 is built on. Doing it now is not
paying a tax before placements, it is starting placements at the only end
that can be started independently. That reframing moves it up hard.

---

## Status

**Tier 0 is done. Tier 1 is done except 1.2.** Seven commits, each verified
against a digest of every building and module in the town, hashed across all
four road patterns — every one of them byte-identical to the town before the
change, which is the bar this work had to clear.

Two things came out different from what was written here, both recorded in
their commits and worth knowing before reading the plan below:

- **1.1 kept the field name `kind`.** The plan said rename it to
  `componentId`. The audit's finding was about the *trait lookups* being
  keyed on a name, and those all moved; renaming the field itself touches
  forty sites, changes the override schema and breaks every saved scene, for
  no behavioural gain. A comment where `kind` is defined says it is a
  component id.
- **0.1 grew a third fix.** `placeSites` drew from one running rng shared
  across every candidate plot, so a plot rejected for density shifted the
  jitter and footprint of every plot after it on that road. Identity was
  worthless without it — a stable id on a building that moves anyway is
  bookkeeping, not a guarantee. Each candidate now draws its own block of
  tickets, the same discipline `tickets()` already applied to modules.

**1.2, the single-page shell, is deliberately unstarted.** It restructures
how the whole app boots and is the one item here that cannot be left half
done, so it wants someone watching. It is otherwise ready to go.

---

## Tier 0 — before anything else ✅

Small, unglamorous, and each one prevents a class of loss.

### 0.1 Road identity ✅
*Audit 9. Prerequisite for 0.2, not a parallel to it.*

A road today is `{ pts, main, width }` with no id. The four pattern functions
push them into an array and the array index *is* the identity — and that
index goes straight into every building id as `` `b${ri}_${counter++}` ``.

So the ordinal problem has two halves. The counter renumbers buildings within
a road; `ri` renumbers every road and therefore every building in town, any
time a pattern emits a different number of lines or emits them in a different
order. Change the pattern, the radial ring count, or anything that makes
`clipLine` reject a line it used to accept, and `ri` shifts under every
override in the scene.

Give a road a real record with a minted id, and derive building ids from that
rather than from position in an array. Small, and it is the ground the next
item stands on.

### 0.2 Override fingerprints and prune ✅
*Audit 1, 5. Split out of roadmap Phase 1.*

An override records what it was authored against: quantised x/z, road id,
footprint. On reapply, a mismatch skips and reports rather than misapplying.
Prune keys whose building no longer exists, in the same pass, since dead keys
are precisely the ones most likely to land somewhere wrong later.

This does not need the full minted-identity system from Tier 2. It converts
silent corruption into "3 edits could not be placed", which is recoverable
and, more importantly, legible.

**Done when:** changing `cols` or density with edits in the scene never
changes a building the user did not edit.

### 0.3 `baseVersion` on component edits ✅
*Audit 3.*

Record the disk version an edit was made against. On load, compare. Where disk
is newer, surface it in the shelf rather than silently pinning the user to
their old copy forever.

Must land before there is a body of user edits worth preserving, and it is
not retrofittable after. That is the entire argument for doing it now rather
than in Phase 7 where schema work otherwise lives.

### 0.4 Name the two hash streams ✅
*Audit 7.*

One comment on `rng.js` and one on `constraints.js`, each naming the other and
stating they are separate by design. Costs nothing. Prevents someone reaching
for the wrong one and silently regenerating every saved scene.

---

## Tier 1 — the unblockers

Nothing in Tiers 2+ is safe or cheap until these exist.

### 1.1 Split `module.kind` ✅
*Audit 2. Front half of roadmap Phase 2.*

`m.componentId` says what to resolve. Traits — family, whether it takes a
material, which slots stay flat, what a roof is — are read from the resolved
component's own document via `tags`, which already exists on every component
and is used for almost nothing.

Keep the current tables as the defaults a leaf component inherits, so nothing
on disk changes on day one and the town regenerates byte-identically.

This is already broken in the shipped tool: any assembly in the body role gets
a cube's trait answers. Every phase below adds more non-primitive component
ids, so the breakage compounds.

**Done when:** a lamp post in the body role reports its own family, its own
material eligibility, and its own slots in the inspector.

### 1.2 Single-page shell ← next
*Agreed in conversation, never scheduled.*

City Builder and Components are two documents, so crossing between them
reloads the image pool, the library and every thumbnail. It is one editing
session and should behave like one: one shell, two views, shared pools and
caches that outlive the switch.

Worth doing before the tool grows more views, not after, since every view
added first is another one to port.

### 1.3 Shared spatial index ✅
*Audit 8. Pulled forward from roadmap Phase 2.*

`layout.js` already solves XZ proximity twice privately, in `packing` and
`kerbs`. Terrain sampling, curve projection, volume containment and scatter
rejection all want the same structure. A uniform grid is enough for a long
time.

Pulled ahead of the systems that need it because four more private
implementations is the default outcome otherwise, and unifying them
afterwards is a much larger job than putting one down first.

### 1.4 Resolve provenance ✅
*Audit 6, and roadmap Phase 1's readout.*

Keep the forgiving empty-means-everything fallbacks — they are right during a
mid-edit state — but make them observable. A resolve pass collects "I
substituted a default here, and this is why."

Two payoffs for one piece of work: it makes three-layers-deep contradictions
explainable, and it is the data the "why is this here" inspector needs, which
the roadmap wants in Phase 1 and again in Phase 6.

---

## Tier 2 — identity and locking

Roadmap Phase 1, minus what moved to Tier 0. This is where the first
invariant, *authored decisions survive procedural change*, stops being
best-effort.

- **Stable part ids.** Slot picks resolve off path strings holding positional
  indices, so inserting a part reshuffles every part after it. Mint an id per
  part on creation; derive seeds from parent seed plus that id.
- **Minted identity on lock.** Locking is promotion: an unlocked thing has
  derived, anonymous identity, and locking moves it into the authored set
  where nothing downstream can renumber it. This is the permanent version of
  what Tier 0.2 patches.
- **Locked facets.** A lock is a set, not a boolean. "Stays here but may
  change which rock it is."
- **Reference frames.** A lock records what it is anchored to: world, a curve
  at t, another component's anchor, terrain at XZ.
- **Provenance readout with the Lock button at the end of it**, so the model
  teaches itself. Consumes Tier 1.4.
- **View modes: Normal and Authored**, on a shortcut.

---

## Tier 3 — placements

Roadmap Phase 2, minus the two pieces that moved up.

- **Placement record.** `{ id, componentId, transform, seed, tags, source,
  lock }`. Systems contribute, the builder consumes. `componentId` and `tags`
  arrive already correct from Tier 1.1.
- **Claims.** Authored placements become inputs to generation rather than
  patches applied after it, so locking a plaza makes buildings move aside.
  Claim resolution must be deterministic or it reintroduces exactly the
  instability Tier 2 removed.
- **Editable lots**, which is the claims machinery with a handle on it. A lot
  is the third link in the generation chain and currently the only one with
  no plan — see Tier 4. `placeSites` emits `{ id, x, z, angle, w, d }` per
  building (`layout.js:283`) and nothing can touch it: you can edit the
  building, but not the plot of land it stands on.

  Those are different edits. Deleting a building leaves a gap where a
  building was. Merging three lots gives you one wide footprint — a
  department store, a plaza, a car park — and dragging a lot's edge rebuilds
  the building to fit it. Both are claims on ground, so the record and the
  resolution already exist by this point; what is missing is only selecting
  lots and saying "these are one now."
- **Layers become real**, and the Phase 0 strip fills with honest counts:
  4 authored against 14,206 procedural.
- **View mode: Variation.** Tinting by which component or slot pick landed.
  The sleeper on this list — over-repetition is very hard to judge by eye and
  trivial to see this way.
- **Instancing split.** Unique geometry merges as now; repeated components go
  to `InstancedMesh`. The placement list makes the split trivial.
- **Resolved-geometry cache** (*audit 4*), keyed on component content hash,
  seed and quantised dimensions. `resolveComponent` is already pure, so this
  drops in whole. Pull it forward the moment assemblies start hurting.

---

## Tier 4 — curves, and the editable generation chain

Roadmap Phase 4, moved ahead of terrain and given the larger framing it
needs. This is the highest-leverage tier on the list, and the one that
changes what kind of tool this is.

### The principle

Right now the generation chain is a single function call. `buildLayout` picks
a `half` from cols × rows × cell, runs a pattern function to get roads,
walks their kerbs to get sites, and returns. The boundary, the road network
and the lot sites all exist for the duration of one call and are then either
rendered or thrown away. None of them is a thing you can hold.

**Every one of those intermediates should be an artifact you can edit, and
editing one should regenerate everything downstream of it and nothing
upstream.** Generated first, edited second, and the edit survives the next
reroll. That is the same relationship the parameter system already has, one
level up:

| Parameter | Artifact |
| --- | --- |
| `free` — the proposal stands | regenerated from the pattern every time |
| `range` — clamped into bounds | may be re-routed, but must still connect these two points / stay in this corridor |
| `fixed` — the proposal is ignored | authored by hand, the generator does not touch it |

So there is no new locking concept to design. `constraints.js` already says
what happens when a system proposes and an author has an opinion; this
applies it to geometry instead of to numbers. A road you have never touched
is free. A road you have nudged is fixed. The interesting middle is a road
that may reroute but has to keep meeting the two roads it currently meets.

### The chain, and where each link is handled

Four links, each one generated from the one above it:

| Link | What it is today | Where it becomes editable |
| --- | --- | --- |
| **Boundary** | `half`, one scalar from cols × rows × cell | 4.2 |
| **Roads** | `{ pts, main, width }` in a local array | 5.2 |
| **Lots** | `{ id, x, z, angle, w, d }` from `placeSites` | Tier 3, as claims |
| **Buildings** | modules with sparse overrides | already editable |

The bottom link has been editable since long before any of this. The top
three are the work. Reading it as a chain is what makes the ordering obvious:
each link consumes the one above, so editing high up regenerates a lot and
editing low down regenerates almost nothing — which is exactly what you want
from an art-direction tool and exactly what a single `buildLayout` call
cannot offer.

### 4.1 Curve primitive
One type, serving every linear thing in the world: roads, rivers, walls,
fences, pipes, cables, powerlines, hedgerows, balustrades — and boundaries,
which are the same object closed.

Editable control points, a length parameterisation, sampling by t, and the
lock states above.

### 4.2 The town boundary becomes a shape
The extent is currently `half`, one scalar, computed as
`Math.max(cols, rows) * cell / 2` (`layout.js:307`) and threaded through
every pattern function as an axis-aligned square. `clipLine` tests against
it, `placeSites` rejects against it.

Replace the scalar with a region that answers `contains(x, z)` and clips a
line. A square derived from cols and rows is then just the default region,
so nothing changes for a scene that never draws one — and the moment you
want a town that follows a coastline, sits in a valley, or fills a shape you
drew, that is the same interface.

This is the smallest change in the tier and the one that most changes what
the tool feels like, because it is the difference between "a town, sized"
and "a town, sited."

### 4.3 Generators produce curves rather than being the only source
The four road patterns stop being the way roads exist and become one way
roads are *proposed*. Same for whatever proposes a boundary. A generator's
output is a set of curves you can then move, split, delete, extend or leave
alone — and re-running the generator preserves everything you authored.

This is the step that makes 4.2 and the whole roads tier possible, and it is
mostly bookkeeping: the pattern functions already produce polylines, they
just produce them into a local array that nobody can reach.

### 4.4 Distribute-along-curve
Slots into `algorithms.js` beside the nine arrangements already there, and
needs nothing new from the component system. This is what puts lamp posts
down a street, fence posts along a boundary, and pylons across a valley.

### 4.5 Semantic anchors
Promote `base`/`top`/`sides` into queryable tagged surfaces: "wall faces
fronting a street", "flat roof area over four square metres", "edges at
ground level". Houdini's groups and attributes, except typed and semantic,
so they survive the geometry changing underneath them.

**Stairs are the proving case for attachment**, as roads are for curves. Two
anchors, a path between them, a step count derived from the height
difference, and it stays attached when either end moves. If stairs work,
pipes and railings and billboards are trivial.

---

## Tier 5 — roads

Roads were one bullet in the old plan — "roads become a curve consumer" —
which badly understated them. They are the least editable thing in the tool
and the one with the largest effect on everything else, since buildings are
placed along their kerbs. Every road change moves the town.

Where they stand today: four pattern functions emit `{ pts, main, width }`
polylines from `(seed, params)`, wholesale, every rebuild. No id until Tier
0.1 gives them one. No overrides of any kind — a road cannot be moved, split,
deleted, redrawn, or widened on its own. The geometry is one quad per
segment, mitred badly by its own admission (`terrain.js:151`), with no
junctions, no kerbs, no markings and no width variation along a road. That is
fine for judging massing and not what a film pipeline wants from a street.

### 5.1 Roads become curve consumers
A road is a curve from Tier 4, plus a width profile, plus a road type. The
four patterns become the generators described in 4.3 — one way roads are
proposed, not the only way they can exist.

### 5.2 Hand-editable roads
The point of the whole tier. Draw a road. Drag a control point and watch the
buildings re-front onto it. Split, join, delete, reroute. Widen one road
without touching the parameter that widens all of them.

No new concept, because Tier 4 already established it: an untouched road is
`free` and regenerates from the pattern, an edited road is `fixed` and the
pattern does not touch it, and the middle case is a road that may reroute but
has to keep meeting the roads it currently meets. Editing a road *is* locking
it, the same way editing a building is.

### 5.3 Junctions as generated components
Where two curves meet, resolve a junction from the library — a crossroads, a
T, a roundabout, a fork — rather than overlapping two ribbons and hoping.
This is the single biggest visual upgrade in the tier and it needs no new
machinery: a junction is a component, chosen by a role, sized by its
constraints.

### 5.4 Width profiles and cross sections
A road's cross section is a small assembly: carriageway, kerb, pavement,
gutter, verge. Distribute-along-curve (4.4) already places what sits on it —
lamp posts, bollards, parking meters, hydrants, street trees, signage — which
is the first real payoff of the curve tier and the thing the component
library has been waiting for something to attach to.

Width varying along a curve is what gives you a road narrowing into an alley
without it being a different road.

### 5.5 Road types drive what fronts them
Highway, avenue, street, alley, path already half-exist as the `main` flag.
Promote it: a road type carries its own setback, frontage spacing, building
role mix and traffic weighting. An alley gets back doors and fire escapes; an
avenue gets shopfronts. This is where the town stops reading as one texture
applied evenly.

### 5.6 Roads conform to terrain
Needs Tier 6. Once terrain is a writable field, a road cuts and fills rather
than draping over the surface. Cuttings, embankments and bridges fall out of
the same mechanism, and the quarry case two tiers down is the same
displacement run with a different brush.

The only item in this tier that waits on terrain — 5.1 through 5.5 all run on
flat ground.

**Done when:** you can draw a street where you want one, and the buildings,
traffic and street furniture all rearrange around it while everything you
locked stays put.

---

## Tier 6 — terrain as a field

Roadmap Phase 3, moved after curves and roads. Promote `heightAt` into
`heightAt` / `normalAt` / `slopeAt`, have placements conform to it, and make
it writable so roads can cut into it and volumes can displace it.

If terrain stays a rendered mesh rather than a queryable field, every later
system special-cases it.

**On the reordering:** the roadmap's layer chain has terrain first, and that
is still the right *evaluation* order at runtime. It is not the right build
order. Curves are needed by more things sooner — the boundary, roads, every
linear object — and all of it works on flat ground first. Terrain arrives
when things need to sit on something other than a plane, which is one item in
the roads tier and the whole of the volumes tier.

---

## Tier 7 — volumes and regions

Roadmap Phase 5. The art-direction layer and the answer to boolean cutouts.
Box and extruded-spline volumes carrying rules: exclude, include, set density,
override a role's mix, displace terrain, force a component set.

Cutouts without mesh CSG: a tunnel is a volume that removes buildings and adds
tunnel components, a quarry is a terrain displacement, a cutaway is a clip
plane. Real CSG stays in reserve as an export-time bake.

**The viewport tool strip arrives** — select, move, pin, paint density, draw
region. This is the second mode of use the tool has never had: dressing the
set by hand rather than tuning the machine with sliders.

---

## Tier 8 — virtual scatter

Roadmap Phase 6. A scatter is a function, not a list: `(region, seed) ->
placements`, evaluated per tile on demand. Only locked placements become
stored records, so the scene file holds the two hundred rocks you edited
rather than the million you generated — which is what keeps scene files
diffable in git.

LOD is a parameter override by distance, not a separate system.

Build the provenance inspector alongside, not after. Lazy evaluation is
harder to debug and provenance is the mitigation.

---

## Tier 9 — ongoing, not sequenced

Roadmap Phase 7, plus what the audit added.

- **Storage.** localStorage is ~5MB and currently holds the entire
  uncommitted library. IndexedDB or a real file workflow before a hundred
  components exist.
- **Override schema** (*audit 5*). Split `overrides` into `buildings` and
  `modules`. Removes the `key.startsWith(id + '_m')` scan, which is a string
  search standing in for a relationship the structure should hold.
- **Schema validation and migration.** Nothing validates a component
  document, so one bad hand edit breaks resolve for the whole library. Tier
  0.2 makes versions readable; this makes them actionable.
- **Budget readout** per layer — triangles, instances, draw calls.
- **Export preserves instancing.** One merged mesh per building is right for
  today and wrong for a scattered landscape. Point instancing in USD plus
  per-object metadata.

---

## Still deliberately not building

Unchanged from `ROADMAP.md`, and worth re-reading before any of the above
tempts otherwise: no node graph UI, no general dependency graph, no mesh CSG
first, no multi-user anything. The fixed layer order stands:

```
Terrain -> Curves -> Regions -> Lots -> Structures -> Attachments -> Scatter -> Decoration
```

And the risk stays the one already named: there is a version of this that
spends a year building a worse Houdini. The way out is to stay pointed at
what Houdini is bad at — authored decisions surviving procedural change —
rather than matching its operator count.

---

## If you only do one thing

Tiers 0.1 and 0.2 together — road identity, then override fingerprints. They
are the smallest items on the list and the only ones where every day of delay
is edits quietly landing on the wrong buildings. They have to go together:
fingerprinting an override against a road index that itself renumbers fixes
nothing.

## If you do one week

Tier 0 entire, then 1.1. That stops the loss, makes component edits
survivable across updates, and untangles the field that every later system
reads — which is also the first two fields of the placement record, so the
week ends with Tier 3 already started.

## The one to be impatient about

Tiers 4 and 5, and specifically 4.2 and 5.2 — drawing the town's outline
instead of setting rows and columns, and dragging a road instead of rerolling
until one lands where you wanted. That is where this stops being a machine
you tune and becomes a set you dress.

Everything before them is real work they depend on: identity so an edit
survives, placements so there is something to edit, curves so there is
something to draw with. But it is worth knowing which direction the
groundwork points, and 4.2 in particular is small — one scalar becoming an
interface — for how much it changes.
