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

Four things, and they are the whole reason this document exists rather than
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

## Tier 0 — before anything else

Small, unglamorous, and each one prevents a class of loss.

### 0.1 Road identity
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

### 0.2 Override fingerprints and prune
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

### 0.3 `baseVersion` on component edits
*Audit 3.*

Record the disk version an edit was made against. On load, compare. Where disk
is newer, surface it in the shelf rather than silently pinning the user to
their old copy forever.

Must land before there is a body of user edits worth preserving, and it is
not retrofittable after. That is the entire argument for doing it now rather
than in Phase 7 where schema work otherwise lives.

### 0.4 Name the two hash streams
*Audit 7.*

One comment on `rng.js` and one on `constraints.js`, each naming the other and
stating they are separate by design. Costs nothing. Prevents someone reaching
for the wrong one and silently regenerating every saved scene.

---

## Tier 1 — the unblockers

Nothing in Tiers 2+ is safe or cheap until these exist.

### 1.1 Split `module.kind`
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

### 1.2 Single-page shell
*Agreed in conversation, never scheduled.*

City Builder and Components are two documents, so crossing between them
reloads the image pool, the library and every thumbnail. It is one editing
session and should behave like one: one shell, two views, shared pools and
caches that outlive the switch.

Worth doing before the tool grows more views, not after, since every view
added first is another one to port.

### 1.3 Shared spatial index
*Audit 8. Pulled forward from roadmap Phase 2.*

`layout.js` already solves XZ proximity twice privately, in `packing` and
`kerbs`. Terrain sampling, curve projection, volume containment and scatter
rejection all want the same structure. A uniform grid is enough for a long
time.

Pulled ahead of the systems that need it because four more private
implementations is the default outcome otherwise, and unifying them
afterwards is a much larger job than putting one down first.

### 1.4 Resolve provenance
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

## Tier 4 — terrain as a field

Roadmap Phase 3. Promote `heightAt` into `heightAt` / `normalAt` / `slopeAt`,
have placements conform to it, and make it writable so volumes can displace
it later. If terrain stays a rendered mesh rather than a queryable field,
every later system special-cases it.

---

## Tier 5 — curves and semantic anchors

Roadmap Phase 4, and the highest leverage item on the whole list. Roads,
rivers, walls, fences, pipes, cables, powerlines, hedgerows and balustrades
are one thing: a curve, a distribution, and a component slot.

- Curve primitive.
- Distribute-along-curve, which slots into `algorithms.js` beside the nine
  already there.
- **Semantic anchors** — promote base/top/sides into queryable tagged
  surfaces: "wall faces fronting a street", "flat roof over four square
  metres". Houdini's groups and attributes, except typed and semantic, so
  they survive the geometry changing underneath them.
- **Stairs as the proving case** for attachment. Two anchors, a path between
  them, a step count derived from the height difference, staying attached
  when either end moves. If stairs work, pipes and railings and billboards
  are trivial.

Roads are the other proving case, and large enough to be its own tier.

---

## Tier 6 — roads

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

### 6.1 Roads become curves
A road is a curve plus a width profile plus a road type. The four patterns
become curve *generators* rather than the only way a road can exist, which is
the change that makes everything below possible.

### 6.2 Hand-editable roads
The point of the whole tier. Draw a road. Drag a control point and watch the
buildings re-front onto it. Split, join, delete, reroute. Widen one road
without touching the parameter that widens all of them.

Roads use the same lock model as everything else, so this is not a new
concept: an unlocked road is regenerated from the pattern, a locked one is
authored and survives every reroll and every pattern change. Editing a road
*is* locking it, the same way editing a building is.

### 6.3 Junctions as generated components
Where two curves meet, resolve a junction from the library — a crossroads, a
T, a roundabout, a fork — rather than overlapping two ribbons and hoping.
This is the single biggest visual upgrade in the tier and it needs no new
machinery: a junction is a component, chosen by a role, sized by its
constraints.

### 6.4 Width profiles and cross sections
A road's cross section is a small assembly: carriageway, kerb, pavement,
gutter, verge. Distribute-along-curve already places what sits on it — lamp
posts, bollards, parking meters, hydrants, street trees, signage — which is
the first real payoff of Tier 5 and the thing the component library has been
waiting for something to attach to.

Width varying along a curve is what gives you a road narrowing into an alley
without it being a different road.

### 6.5 Road types drive what fronts them
Highway, avenue, street, alley, path already half-exist as the `main` flag.
Promote it: a road type carries its own setback, frontage spacing, building
role mix and traffic weighting. An alley gets back doors and fire escapes; an
avenue gets shopfronts. This is where the town stops reading as one texture
applied evenly.

### 6.6 Roads conform to terrain
Once Tier 4 makes terrain a writable field, a road cuts and fills rather than
draping over the surface. Cuttings, embankments and bridges fall out of the
same mechanism, and the quarry case in the next tier is the same displacement
run with a different brush.

**Done when:** you can draw a street where you want one, and the buildings,
traffic and street furniture all rearrange around it while everything you
locked stays put.

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

Tier 6. Roads are where this stops being a machine you tune and starts being
a set you dress, and they are currently the only major element of the world
with no editing at all. Everything between here and there is real work that
roads depend on — identity, curves, terrain as a field — but it is worth
knowing which direction the groundwork points.
