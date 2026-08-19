# Roadmap

Where this goes next, and in what order. Written after the component system
landed, when the question stopped being "can it make a town" and became "can
it make an environment, at scale, that stays editable."

Read `COMPONENTS.md` first. This assumes it.

## The two invariants everything serves

**Authored decisions survive procedural change.** This is the whole point of
the tool and the thing Houdini and Geometry Nodes are worst at. Every choice
below is judged against it.

**View state is never scene state.** Hiding, ghosting and isolating must never
touch generation, export, or what gets saved. Easy to violate once, painful
forever after.

---

## Phase 0. UI groundwork

Cheap, unblocked by anything, and the shells built here are where later
engine work becomes visible. Do this first.

- **Editor undo.** Reuse `history.js`. Today the component editor writes
  straight to storage and Revert throws away everything, which is not a
  substitute for stepping back one change. This is the biggest hazard in the
  tool right now.
- **Header cleanup.** Undo and redo out of the Scene tab and into the header.
  Split the status line: counts belong near the stats readout, the scene name
  belongs beside the scene control, transient messages get their own spot so
  they stop being lost among counts.
- **Persistent layers strip.** Above the tabs, not inside one. Visibility is
  something you change constantly while doing something else. Initially it
  holds the toggles currently scattered across three tabs (`showRoads`,
  `showCars`, `showGrid`, `showStats`), which empties those sections of
  unrelated content and gives the strip a reason to exist before layers do.
- **Three-state visibility**: shown, ghosted, hidden. Ghosted is the important
  middle, because context matters more than isolation.
- **Editor sections collapse**, matching the town's existing accent-tick
  pattern. Two idioms for the same thing is one too many.
- **Shelf search and tag filter.** Sixteen components is fine. Two hundred is
  not, and assemblies are cheap to make.
- **Modified-parameter marker** plus a filter in search. Over a hundred
  parameters and no way to see what differs from the preset you started from.
- **Reserve the viewport's top-left** for the tool strip that arrives in
  Phase 5. Put nothing there that would have to move.

Done when: nothing in the tool loses work, and you can tell at a glance what
you changed.

---

## Phase 1. Identity and locking

Small, and everything after it depends on it. This is where the first
invariant becomes real rather than best-effort.

- **Stable part ids.** Slot picks currently resolve off path strings holding
  positional indices (`.i${i}`, `.part${i}`), so inserting a part reshuffles
  the variation of every part after it. Mint an id per part on creation and
  derive seeds from parent seed plus that id. Buys "stable under insertion",
  which `@ptnum`-based randomness cannot offer.
- **Minted identity on lock.** Locking is promotion. An unlocked thing has
  derived identity and is anonymous. Locking mints a permanent id and moves
  the thing out of the generated stream into the authored set, where nothing
  downstream can renumber it. Today's ids are derived from layout
  (`b{road}_{slot}_m{i}`), so changing `cols` silently detaches every edit.
- **Locked facets.** A lock is a set, not a boolean. "Stays here but may
  change which rock it is." "Keeps its footprint but rerolls its floors."
  Forcing a choice between fully frozen and fully live is what makes
  procedural tools feel hostile.
- **Reference frames.** A lock records what it is anchored to: world, a curve
  at parameter t, another component's anchor, or terrain at an XZ position.
  This is what lets an edit survive a large upstream change, and it is
  genuinely painful in both Houdini and Geometry Nodes.
- **Provenance readout and Lock button.** Select anything and read the chain
  of reasons that put it there, with the lock button at the end of the
  explanation so the model teaches itself.
- **View modes: Normal and Authored.** Authored ghosts everything procedural
  and gets a keyboard shortcut. The clearest possible answer to "what have I
  actually decided here."

Done when: you can change the road layout and your hand-placed things are
still where you meant them, relative to what you meant them to be near.

---

## Phase 2. Placements

The keystone. Today `generateLot` builds buildings as a monolith and roads are
drawn straight into ground geometry, so a bollard beside a road has nowhere to
live.

- **Placement record.** `{ id, componentId, transform, seed, tags, source,
  lock }`. Systems contribute placements, the builder consumes them.
- **Spatial index.** A uniform grid is enough for a long time.
- **Claims, so generation runs around authored things rather than through
  them.** Authored placements become inputs to generation, not patches applied
  afterwards. Lock a plaza and the buildings move aside. Claim resolution must
  be deterministic or this reintroduces the instability Phase 1 removed.
- **Layers become real** and the strip from Phase 0 fills with counts, which
  is where the scale story shows up honestly: 4 authored against 14,206
  procedural.
- **View modes: Layer and Variation.** Variation is the sleeper. Tinting by
  which component or slot pick landed makes over-repetition obvious at a
  glance, which is otherwise very hard to judge by eye.
- **Instancing split.** Unique geometry merges as now, repeated components go
  to `InstancedMesh`. The placement list makes the split trivial to compute.
- **Resolved-geometry cache**, keyed on component content hash plus seed plus
  quantised dimensions. Two lamp posts with the same seed and size are
  byte-identical today and built twice. Can be pulled forward if assemblies
  start hurting before this phase.

Done when: everything in the world is a placement, and you can see how many of
what there are.

---

## Phase 3. Terrain as a field

- Promote `heightAt` into a real interface: `heightAt`, `normalAt`, `slopeAt`.
- Placements conform to it.
- Writable, so Phase 5 volumes can displace it.

If terrain stays a rendered mesh rather than a queryable field, every later
system has to special-case it.

---

## Phase 4. Curves and semantic anchors

Highest leverage on the whole list. Roads, rivers, walls, fences, pipes,
cables, powerlines, hedgerows and balustrades are one thing: a curve, a
distribution, and a component slot.

- **Curve primitive.**
- **Distribute-along-curve algorithm**, which slots straight into
  `algorithms.js` beside the nine already there.
- **Semantic anchors.** Promote anchors from base/top/sides into queryable
  tagged surfaces: "wall faces fronting a street", "flat roof area over four
  square metres", "edges at ground level". This is Houdini's group and
  attribute system, except typed and semantic rather than raw geometry
  attributes, so it survives the geometry changing underneath it.
- **Roads become a curve consumer**, not a separate subsystem.
- **Stairs as the proving case.** The hardest of the attachment types: two
  anchors, a path between them, a step count derived from the height
  difference, and it must stay attached when either end moves. If stairs are
  easy, pipes and railings and billboards are trivial.

---

## Phase 5. Volumes and regions

The art direction layer, and the answer to boolean cutouts.

- Box and extruded-spline volumes carrying rules: exclude, include, set
  density, override a role's mix, displace terrain, force a component set.
- **Cutouts without mesh CSG.** Three cheaper strategies cover most of it: a
  tunnel is a volume that removes buildings and adds tunnel components, a
  quarry is a terrain-field displacement, and a cutaway is a clip plane. Real
  CSG stays in reserve for what these cannot express, and runs as a bake step
  on export rather than live.
- **The viewport tool strip arrives**: select, move, pin, paint density, draw
  region. This is the second mode of use the tool has been missing, which is
  dressing the set by hand rather than tuning the machine with sliders.

---

## Phase 6. Virtual scatter

Rocks, foliage, debris, everything in the millions.

- **A scatter is a function, not a list.** `(region, seed) -> placements`,
  evaluated per tile on demand. Only locked placements become stored records.
- The scene file holds the two hundred rocks you edited, not the million you
  generated, which keeps scene files **diffable and reviewable in git**. "What
  changed in this environment between versions" is close to unanswerable in a
  Houdini scene and should be trivial here.
- **LOD is a parameter override by distance.** A ring of twenty four pillars
  becomes eight far away, a forest thins out. No separate LOD system, just the
  existing lock model with a distance driver.
- Build the "why is this here" inspector alongside this, not after. Lazy
  evaluation is harder to debug and provenance is the mitigation.

---

## Phase 7. Robustness at scale

Ongoing rather than sequenced, but none of it is optional past a certain size.

- **Storage.** localStorage is roughly five megabytes and currently holds the
  entire uncommitted library. Move to IndexedDB or a real file workflow before
  a hundred components exist.
- **Schema validation and migration.** Nothing validates a component document,
  so one bad hand edit breaks resolve for the whole library. `version` is
  recorded and never read, so there is no migration path when the schema
  changes, which it will.
- **Budget readout.** Triangles, instances and draw calls, broken down per
  layer, so bottlenecks are self-diagnosable.
- **Export preserves instancing.** One merged mesh per building is right for
  today and wrong for a scattered landscape. Point instancing in USD, plus
  per-object metadata for downstream selection.

---

## Deliberately not building

**A node graph UI.** Tempting, expensive, and the current model of components
plus roles plus volumes is more constrained and much easier to reason about.
Revisit only when there are concrete cases the constraint model genuinely
cannot express.

**A general dependency graph.** The fixed layer order below is less flexible
and far easier to hold in your head. It is a special case that can be
generalised later if it ever needs to be.

```
Terrain -> Curves -> Regions -> Lots -> Structures -> Attachments -> Scatter -> Decoration
```

**Real mesh CSG, first.** Slow, fragile against collage geometry, and produces
topology that does not texture cleanly. See Phase 5.

**Multi-user anything.**

## The risk worth naming

There is a version of this project that spends a year building a worse
Houdini. The way to avoid it is to stay pointed at the thing Houdini is bad
at, which is authored decisions surviving procedural change, rather than
trying to match its operator count.
