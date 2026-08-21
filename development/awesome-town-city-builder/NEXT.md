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

## Where this is, in one paragraph

Tiers 0 and 1 are done. Tier 4 is most of the way there (4.1–4.3 done, 4.4 is
the recommendation below). Tier 5 has 5.1 and 5.2, an unplanned chunk of 5.6 —
roads have height, drape properly, and bridge ground they cannot climb — and
the thin end of 5.4, since a road now carries its own width and kind. Tier 6
is half done from an unexpected direction: ground is drawable, queryable, and
each drawn shape carries its own roughness and terracing, but nothing conforms
to a slope beyond standing on it. Tiers 2, 3, 7, 8 are untouched. **The next
thing to build is 4.4, distribute-along-curve**; the argument is at the bottom
of this file under "If you do one week", and the short version is that every
dependency it has landed as a side effect of other work.

**Two structural things landed recently that change what is cheap**, and both
are worth knowing before picking anything up:

- **The selection panel takes curves.** Selecting a road, a landform or the
  boundary puts its settings on the right, in the same panel a selected
  building uses. That was worth doing as consistency and turned out to matter
  much more than that: *a setting that applies to one road has nowhere to live
  in a panel of global sliders*, which is why per-road settings did not exist.
  Anything Tier 5 wants to vary per road — a width profile, a road type, a
  frontage rule — now has somewhere to appear, and most of what made 5.4 and
  5.5 look expensive was the missing home rather than the feature.
- **The Terrain panel is noise-only, and a drawn shape carries its own
  surface.** Terracing used to be applied to both kinds of ground, so one
  slider restepped every shape in the scene. Each landform now has its own
  terracing and its own roughness — roughness being new rather than moved,
  since drawn ground had no equivalent at all and read as glassy. The general
  rule this established is worth applying to the next thing: **a control in
  the global panel should describe how the procedural version is generated,
  and anything that describes one authored object belongs on that object.**

Three habits are worth inheriting along with the code. Run
`node development/awesome-town-city-builder/tools/digest.mjs` after anything
structural — it hashes every road, lot and module across four patterns, and
"byte-identical" is the bar for a change that should not have moved the town.
Drive the real gesture rather than calling the method under it; that
difference has caught four separate bugs now. And when a metric says a fix
failed, check the metric first — twice this week it was measuring the wrong
thing and a working fix looked broken.

## Status

**Tiers 0 and 1 are done. Tier 4 is started: 4.1 and 4.2 are done.** Every
structural commit is verified against a digest of every road, lot and module
in the town, hashed across all four road patterns — byte-identical to the town
before the change, which is the bar this work has to clear. That digest is now
a committed tool rather than something rebuilt each time:

```bash
node development/awesome-town-city-builder/tools/digest.mjs
```

Three things came out different from what was written here, each recorded in
its commit and worth knowing before reading the plan below:

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
- **4.2 kept a specialised box.** The plan said one region interface, and
  there is one — but the axis-aligned box has its own clip rather than
  running through the general polygon path. Not premature: the same box
  clipped as a four-sided polygon gives answers that differ in the last bits
  of a float, and that is enough to renumber a road id and move an override
  onto a different building. The specialisation *is* the compatibility
  guarantee, and it is why adopting the region changed nothing.

**4.3 and 5.1/5.2 followed immediately**, because 4.2 shipped a boundary you
could drag next to roads you could not, which is a worse tool than one where
neither could be touched — it teaches the wrong thing about what the tool is.
A road is now either proposed or held, held roads are stored as curves in
`params.roadEdits`, and holding one freezes its name so every building on it
keeps its id, keeps its edits, and travels with the street. The conflict
rules that fall out of that are in `README.md` under "Holding things still",
and they are the deliverable as much as the dragging is.

**Three things that were not on this list landed alongside the road work,
each because using it surfaced something that made it unusable rather than
merely imperfect.**

- **Road ribbons were rendering broken.** One free-standing quad per segment,
  each offset along its own perpendicular, so every bend left a gap on the
  outside of the turn and an overlap on the inside — the "broken pieces, not
  connected" a curved or radial town showed on sight. Rewritten as one mitred
  strip per road, closing properly on a ring. Not scheduled anywhere, because
  nobody had looked at a bent road closely enough to notice until roads
  became something you drag into a bend.
- **A road under a building could not be selected**, which is most roads in
  a town with any density: the line is drawn under the geometry, so a click
  landed on whatever building was in front of it. Every curve now carries one
  small grip at its midpoint, drawn over everything the way a handle already
  is — a legible number of dots, and the same pick path a control point uses.
- **Merged lots — `+`/`-` on a selected building, `params.lotSpans`.** Not
  from this list at all: asked for directly, on the reasoning that the town
  reads as one texture because every footprint is lot-sized, and nothing
  short of Tier 3's claims could change that honestly. A span turned out to
  need none of that machinery — it runs after placement, costs the
  eviction-priority pass its second real customer, and is small enough that
  withholding it until claims arrive would have been the wrong call.

**The gap the merge exposed**: a four-lot footprint still gets a generic
module mix stacked on it, so the massing changes and the surface does not.
The town needs a handful of components that are obviously *institutional* —
long runs, deep cornices, ground-floor arcades — for a merge to read as a
department store rather than four shops wearing a trenchcoat. That is a
component-authoring task, not a systems one, and it is the actual next step
now that there is a footprint worth authoring one for.

**Four more things landed straight after, all asked for directly rather than
found on this list.**

- **Terrain and the road pattern each have their own seed.** `terrainSeed`
  and `roadSeed` in `params`, `null` by default, meaning "follow the city
  seed" — which is why a scene saved before this existed loads and generates
  exactly as it did, and why a fresh town's three seeds start out equal
  without anywhere actually copying a number into two other fields. Reroll
  either one, or type a value in, and it decouples permanently; a small
  `↺` next to it links it back to following the city seed. Locking a seed now
  disables the field itself, not only its reroll button — the one place in
  the panel where typing a number by hand is as much "rolling the dice" as
  the dice are, so the old lock (reroll only) was locking half the door.
  "Randomise everything" rolls all three when none are locked, the same
  as pressing each one's own reroll button would.
- **A curve can be deleted outright**, distinct from releasing a held road.
  Release hands a road back to the pattern and it reappears, shaped however
  the pattern currently shapes it; delete says there should be no road there,
  full stop — its buildings go, any hold on it goes, and the pattern's next
  proposal in the same place is refused. Stored as `params.roadRemoved`, an
  id set in the same spirit as `roadEdits`: it stays deleted for as long as
  the pattern keeps proposing that road in that place, and lapses quietly the
  moment something upstream changes enough that it would not. Selecting a
  curve with no points picked and pressing delete removes the whole thing;
  the boundary answers the same key by clearing itself.
- **Fixing that surfaced a real bug in the pick/select split from the road
  work.** `onPick` called the general `deselect()` to clear a stale building
  selection, and `deselect()` had just been taught to also clear the curve
  selection — so picking a road cleared its own selection one line after
  setting it, silently, and only Delete-with-nothing-selected made it
  visible. Split into `deselectBuilding()` and `deselectCurve()`; `onPick`
  wants only the first. The other latent one in the same family: a *refused*
  point delete (a curve does not go below two points) still called `onChange`
  unconditionally, so trying and failing to remove a point silently held the
  road anyway. Both are two-line fixes and neither would have been found
  without driving the real keyboard-and-click path end to end rather than
  calling the underlying methods directly.
- **Curves were hard to see and hard to pick.** Every line drew at the same
  weight regardless of whether it was selected, because `LineBasicMaterial`'s
  `linewidth` does nothing in any browser that matters — a known WebGL
  limitation, not a bug to fix in this project. The mitred-ribbon math
  written for road tarmac was the answer already sitting in the codebase:
  pulled out of `terrain.js` into `ribbonEdges`/`ribbonTriangles` in
  `curve.js`, and the selected curve alone now draws a wide translucent halo
  under its thin line, built from the same geometry. Picking one up in a
  dense town had the harder problem — the line runs under the buildings
  standing on it, so a click on the line rarely lands — which is what the
  grip already solved; this was purely about being able to see which curve
  you had.
- **A boundary shape button regenerated on every click with no memory of
  whether there was anything to lose.** Clicking Square twice looked
  identical whether the first click was the only thing that had ever
  happened to the boundary or you had spent ten minutes shaping it — both
  silently produced a pristine square. Fixed with a `source` field that
  names which shape a boundary was minted from and clears the moment it is
  actually edited: switching between pristine shapes stays free, since
  there is nothing authored yet to lose, and any shape click once `source`
  is `null` confirms first. The active shape button now shows which one you
  are looking at, which is most of the fix by itself — the destructive click
  was never really "accidental", it was invisible.
- **The street pattern can be set to None.** Not a fifth entry in
  `ROAD_PATTERNS` — that list is also what the dice roll a pattern from, and
  landing on a roadless town one time in five would be a bad random outcome
  rather than a fun one — but a separate value the dropdown offers, handled
  as its own case in `buildLayout` that proposes nothing. Anything already
  held is unaffected either way, which follows directly from what holding
  already meant: a pattern only ever governs what is *proposed*.
- **The renderer rebuilt every chunk on every rebuild, regardless of whether
  a chunk's data had changed.** `CityBuilder.build()` now keeps a fingerprint
  of what each chunk last drew and only queues a chunk whose fingerprint
  differs; a chunk not queued is not touched, still the same mesh it was.
  Measured: editing one held road on one side of a 25-chunk town now touches
  3 chunks, not 25; a change unrelated to layout (glow, palette) touches
  exactly the chunks whose buildings it altered and nothing standing next to
  them; a no-op rebuild touches nothing at all. Paired with a smaller fix in
  the same investigation — `gx`/`gz` were anchored to `region.bounds`, which
  moves with every boundary edit even for buildings nowhere near it, so a
  drag could re-index the entire chunk grid on top of whatever else changed.
  Anchored to the stable square `cols`/`rows`/`cell` imply instead, which
  only moves on an actual resize.
- **This did not fix what it looks like it should have.** Dragging the
  boundary itself still rebuilds nearly everything, and it earned a real
  investigation rather than a guess: verified directly that a 0.5-unit nudge
  on a 24×24 town left 0 of ~300 buildings holding the id they had a moment
  before, on *every* pattern. The cause is structural, not a missed
  optimisation — grid, boulevard and radial draw full-span lines cut down by
  the boundary, and a moved vertex belongs to two edges that between them
  cross essentially every line in a typical grid, so essentially every road
  gets a new position-derived id and therefore does every building on it.
  Old town is worse: its wandering start angle reads the boundary's own
  centre directly, so even its *proposal*, not just its clip, moves. No
  diff can recover stability the data does not have. The tool's actual
  answer is the one already built: hold what you want to keep still before
  you touch the boundary, which the chunk fix above makes visibly cheap for
  the first time — held roads were always immune, but until now watching
  the rest of the town regenerate around them still repainted their own
  chunk too, everywhere they happened to share one with an unheld road.
  Full write-up, including the one remaining caveat about shared chunks, is
  in `README.md` under "Why moving the boundary still rebuilds the whole
  town".
- **The real fix for that is scoped but not attempted here.** Grid,
  boulevard and radial would need to propose their lines against the town's
  stable default extent — the way `gx`/`gz` now do — using the boundary only
  to clip rather than to decide how far a line reaches before clipping; Old
  town would need its wander decoupled from the boundary's live centre the
  same way. Paired with giving a road an identity that survives a reclip
  (Tier 0.1 gave buildings exactly this relative to a road; roads themselves
  have no equivalent relative to a pattern), a boundary edit could
  eventually touch only the roads that actually cross the moved point. That
  is design and verification work across four pattern functions and an
  identity scheme, not a patch — a real next tier, not a bug fix owed on
  this one.
- **A hand edit did not survive its road disappearing, and now it does.**
  Holding a road already meant a building on it kept its id and its edit
  through anything that happened elsewhere; nothing gave the same guarantee
  to a building on a road you had *not* held, so a boundary drag or a seed
  reroll could orphan an edit exactly as easily as it reshuffled the
  procedural network around it. `fingerprint()` in generate.js now carries
  `w`/`d`/`angle` alongside the position and road it already recorded, and
  `anchorMissingClaims` in layout.js rebuilds a plot outright from that
  fingerprint whenever the normal walk never produces it — a building
  becomes, in effect, a held road of one, evicting whatever procedural site
  now overlaps it the same way a held road's own plots already do. Old
  scenes degrade gracefully: their fingerprints predate the extra fields, so
  anchoring skips them and they fall back to exactly today's behaviour
  (reported unplaced) rather than being resurrected with an invented size.
  Verified: 15 edited buildings scattered through a town, then a boundary
  shrunk hard enough to reshuffle the whole procedural network — all 15 kept
  their exact position and their edit, 0 missing.
- **This is what "editing holds it" turned out to require making true
  everywhere, not just in the common case.** `clearBuilding` and
  `clearModule` used to always take the fast single-lot rebuild path, which
  assumes clearing an override can never change whether the plot itself
  should exist — true for every ordinary edit, false the moment the override
  being cleared was the only thing anchoring a road-less plot. Both now check
  whether the plot they are about to touch is anchored and fall back to a
  full rebuild only then, so the common case keeps its fast path and the one
  case that needed correcting gets it. Reroll needed no equivalent fix: it
  clears style overrides but re-stamps the building-level one with a fresh
  seed nudge, so the fingerprint — and the anchor — travels through a reroll
  the same way a held road's shape survives one.
- **The halo now answers "which one am I about to click", not only "which
  one did I click".** Moving the pointer over a curve shows the same halo
  the selected one gets, dimmer and without handles, built from the exact
  distance test `pickCurve` already used for the click itself — so the
  preview is never wrong about what a click would do, which is the property
  that makes it worth trusting enough to aim by. Deselecting on a click away
  was already correct going into this (verified directly, not assumed) — the
  actual gap was that there was no way to see where a curve was *before*
  committing to the click that would tell you.
- **An assembly resolved a requested size and then ignored it.** Asked for
  directly, after a lamp post placed as a city module rendered at its native
  ~2m regardless of how big the floor it was meant to fill was. Two separate
  bugs, both in `library.js`: `resolveParamsWith` only ever resolves a key a
  component's own `params` lists, so a proposal for `w`/`h`/`d` was silently
  dropped by any component — almost every assembly — that never declared
  them; and even a component that did declare them only got the request
  recorded in `bounds` for the inspector, never applied to the geometry
  `resolveAssembly` had already built from its parts' own native sizes. Fixed
  both: missing dims now read as free rather than unset, and the requested
  size is baked into every piece's position and vertex data as a genuine
  per-axis rescale, once, after placement — proportioning the whole composed
  result to the request while leaving each part's own internal proportions
  alone. Verified against the shipped, unedited `lamp-post` (empty `params`):
  a proposed 6.2 × 2.8 × 5.7 now measures exactly that in the merged mesh,
  not the native ~0.3 × 2 × 0.3. Full write-up in `COMPONENTS.md`.
- **Every module resolves through the library now, not just assemblies.**
  `build.js`'s `shapeFor` used to call `resolveComponent` only when
  `library.components.get(m.kind)` was an assembly; every leaf — box,
  octagon, cylinder, everything the default town is built from — still
  called `buildShape(m.kind, ...)` directly, the hardcoded path that
  predates the component system. Sizing and modifiers already reached it
  (`applyComponents` in generate.js constrains every module's `w`/`h`/`d`
  against its component's own params regardless of which render path it
  took), but `doc.shape`, `doc.faces` and `doc.shapeOpts` did not — editing
  those on `box.json` changed nothing about what the city drew. Both paths
  now go through the same `resolveComponent` → `mergeResolved` → `cropFaces`
  pipeline; the direct call survives only as the fallback for a `kind` the
  library genuinely does not have.
- **The two conventions the two paths used could not just be connected —
  reconciling them was the actual work, and it surfaced a bug older than
  this change.** A component previewed on its own sits with its base at the
  floor; a module in a stack is positioned by its centre (`restack` sets
  `m.y` to the middle of wherever it sits). Wired together naively, every
  module would have floated half its own height above where it belongs —
  which turned out to already be true of any assembly used as a module,
  independent of anything here, since assemblies had always resolved
  through the library and nothing before this corrected for it. Fixed once,
  where `shapeFor` hands geometry back to the mesh builder: for a
  single-piece result (every leaf) the correction is exact, subtracting the
  lift `resolveComponent` itself recorded when it stood the piece up —
  proven exact rather than assumed, since a first attempt using half the
  *measured* height was subtly wrong the moment `dome` turned out not to sit
  symmetrically in its own box. An assembly has no single piece to read a
  lift from, so it recentres on its own resolved height instead, the same
  assumption `restack` already makes everywhere else.
- **None of this shows up in `digest.mjs`**, which hashes generated data,
  never triangles. `tools/geom-diff.mjs` is new and is the check that
  actually matters here: every default shape, built both the old way and
  the new, across a spread of sizes, face patterns and blade counts, every
  position/normal/UV value diffed. 60/60 matched — after two real findings
  on the first pass, not zero: `spin`'s blade count needed threading through
  `resolveComponent` as a per-instance proposal (`shapeOpts` is otherwise a
  fixed per-document setting, and a ticket-rolled blade count is neither),
  and `dome` is what proved the lift-based correction above has to be exact.
  Full write-up in `COMPONENTS.md`.
- **A custom roof component could be included, weighted, even chosen by the
  right calculation, and still never appear on a single building.** Found by
  actually trying it, not by inspection — which is worth remembering, since
  the code that decided whether a building got capped at all
  (`generateLot`'s own `roofKind` pick) was computing the include set
  correctly the whole time. What decided the module's actual `kind` was a
  *second*, independent pick inside `makeModule`'s `isRoof` branch, against
  its own separately-computed `allow` set — the older version, intersecting
  the family list directly against the role's includes, which can never
  contain anything outside the five shipped roof shapes because the family
  list itself never does. Two copies of the same three lines, and they had
  already drifted; pulled into one `roofAllowFor(roofKeys, family)` both
  call sites now share, which is also what stops them drifting apart a
  second time. Paired with a smaller, real gap in the same investigation: a
  component newly added to a role got no weight in its mix wheel at all —
  `pickWeighted` reads a missing weight as zero, and the wheel's own wedge
  for a true zero is too thin to draw — so even a correctly-included
  component defaulted to invisible until someone found the one legend row
  that said "0%" and clicked it. Now starts at the average of what is
  already there. Verified: a component weighted at 1000 against four
  classic roofs at 1 each was chosen for 112 of 113 buildings, correctly
  scaled and correctly seated on top of each one. Full write-up in
  `COMPONENTS.md`.
- **A component's free parameters showed nothing to look at**, which reads
  as a control that does not work rather than one with nothing set. Box's
  width, height and depth all default to `free`, and every one of them
  rendered as the words "set by the scene" with no slider and no number —
  correct, since there is nothing to author, but no way to see what it drew
  or that pressing the `=` mode button was the way in. The row now shows the
  sample it actually resolved to, dimmed, next to a hint that `=` pins it —
  and pinning holds that sample rather than jumping to the middle of the
  track, so taking control of a parameter never moves the model out from
  under you. Alongside it, a real layout bug: the editor's right panel could
  resize down to 260px, and a parameter row's three fixed-width columns left
  the slider about 29px wide at that size — technically there, practically
  ungrabbable. Panel minimum raised to 320, and the row's control column
  given its own `minmax` floor so a panel narrower than intended degrades
  rather than disappearing.

**Four features arrived next, all asked for directly, and between them they
moved Tier 6 out of the future and put a real dent in Tier 5.**

- **Terrain became something you draw, and the two kinds do not mix.** This is
  most of Tier 6 arriving early and from an unexpected direction: the roadmap
  wanted `heightAt`/`normalAt`/`slopeAt` and a writable field, and what was
  actually asked for was "let me pull the ground up here, with a sharp edge".
  A landform is a closed curve with a height and a falloff, stacked in order,
  each layering over the last so its height is exactly where its top sits
  whatever it stands on. That last property is the whole reason it is usable
  at three landforms rather than one. `terrainMode` chooses noise or shapes and
  refuses to blend them, which is the same refusal the rest of the tool is
  built on applied one level up. Full write-up in `README.md` under "Two kinds
  of ground, and never both".
- **The curve primitive paid off again, and for the fourth time.** Nothing in
  the landform work needed a view, an editor, a drag, a halo, a grip or a
  delete key: roads and the boundary had already bought all of them. That is
  now four consumers of one type — boundary, road, landform, and whatever 4.4
  distributes along — which is what 4.1 was written for and the clearest
  evidence yet that building the primitive before any of its customers was the
  right order.
- **Roads can leave the ground**, which is a chunk of Tier 5 that was not on
  the list at all. The interesting part was not the geometry but the identity
  question it forced: height had to be a *profile along the run* rather than a
  property of a control point, because a grid road has two control points and
  expressing "up in the middle, down at both ends" per point would mean
  inserting points, which renames the road and loses every edit on it. So the
  points are untouched and rendering subdivides a throwaway copy. Ends meet
  other roads or ramp to the floor; an authored height is `fixed` and the
  generator gets no say. Columns, road colour, cars on the deck.
- **Particles**, which are not on any tier and are the first thing in the tool
  that exists purely for a *moving* frame. A still frame was always a collage;
  this is the volume above the town having something in it. Entirely
  vertex-shader driven, so the count is a performance question and nothing
  else is.
- **The tour got smooth**, which turned out to be three separate things and
  none of them the route: centripetal Catmull-Rom instead of uniform (road
  points are junctions, not samples, and uniform answers uneven spacing with
  cusps exactly where a junction is), the route resampled before it becomes a
  curve, and the eye and its aim low-passed rather than read raw. Measured:
  peak camera acceleration 644 → 431 → 143 m/s², with the aim going 615 → 95,
  which is the number you actually feel.

**Two things these surfaced that are worth carrying forward.** `flatten` was
silently dropping any per-point field it did not know about, which meant every
hand-raised road came back on the floor — the kind of bug that only appears
when a primitive gains a field after its consumers were written, and worth
remembering the next time one does. And the grade rule for ramps was
overriding hand-authored heights, found only by driving the real gesture end
to end rather than calling the underlying methods, which is now the second
time that exact difference has caught something.

**Then a second round on the same three, because using them found what they
were still missing.** Worth reading as one thing: none of it was new
capability, all of it was the first version being wrong in a way only visible
once there was something to look at.

- **Roads were not draping at all**, and the reason is the one this project
  keeps rediscovering: a road's control points are junctions, not samples. A
  grid road has two, both at the edge of town, so the tarmac ribbon spanned
  the whole run with a single flat quad. Invisible on level ground — which is
  why it survived this long — and over a drawn cliff it was a road passing
  clean through the hill. Fixed by subdividing a throwaway copy at draw time,
  never `road.pts`, which would rename the road and lose every edit on it.
- **Nothing refused to build on a cliff.** `slopeAt` and `normalAt` exist now
  (see Tier 6, which this closes half of) and `maxBuildSlope` drops a plot
  whose *footprint* is too steep — measured at four corners and the centre,
  because a plot straddling a cliff edge has a perfectly reasonable slope in
  the middle.
- **Roads bridge ground they cannot climb.** One slope-limited envelope, two
  sweeps, no threshold anywhere deciding "steep enough for a bridge". The
  useful shape of the control turned out to be the inverse of the useful
  shape of the algorithm: the algorithm wants a maximum grade, and as a
  slider that is backwards, since larger means steeper means *less* bridging.
  `roadEase` runs the other way with zero as the identity.
- **The descent had to be an S**, and the obvious repair does not work.
  Relaxing the surface toward its neighbours cannot touch a straight line,
  and the only corner it could touch is pinned against the plateau by the
  clamp that keeps roads above ground. Each straight run is replaced outright
  with a smoothstep between its own ends. The general lesson is worth keeping:
  **smoothing repairs a shape that is nearly right and cannot create one that
  is structurally wrong.**
- **Columns, and what they say.** A highway stands on a pair under its deck
  edges, a street on one down its middle, and thickness is one figure for the
  whole town — so the count carries the distinction rather than the girth
  saying it a second time.

**Three things these surfaced that are worth carrying forward**, all of the
same family — a value that was correct until the thing underneath it changed:

- `flatten` silently dropped any per-point field it did not know about, so
  every hand-raised road came back on the floor. The kind of bug that only
  appears when a primitive gains a field after its consumers were written.
- The bridge stored height *above the ground* rather than absolute height,
  which is identical arithmetic anywhere the ground between two samples is a
  straight line and wrong by the height of a cliff at the one place the
  system exists for.
- `profile.peak` was recomputed after bridging and wiped it, so eight bridged
  roads reported zero, counted as un-raised, and silently got no columns.

**And a third round, on the tour and on aiming at things.** The pattern is the
same as the second: no new capability, and each one a first version that was
wrong in a way only using it could show.

- **The tour left the roads.** Its route was stitched by walking one road end
  to end and jumping to whichever unused road passed nearest — with no limit
  on how near that had to be, so where the main roads did not meet, the jump
  was a straight line across whatever stood between. Measured before the fix:
  the camera passed inside a building on 10 of 600 samples on a grid town and
  20 of 600 on old town, and wandered 18m off-road on radial. Replaced with a
  walk of the road network as a graph — junctions from pairwise road
  intersection, edges between them, shortest path home to close the loop — so
  being on a road is structural rather than something to keep checking. Worst
  off-road distance 11.3m to 1.0m on a grid, and zero samples inside a
  building on three patterns of four.
- **Hidden and ghosted layers were still taking clicks**, because raycasting
  ignores `object.visible` entirely. Ghost is the case that mattered: it
  exists to keep the town legible while you work on something else, so a
  faded building that still swallows clicks aimed at a street is precisely
  what it was meant to prevent.
- **Curve hit tests were aiming at the wrong place.** They dropped the ray to
  the plane `y = 0` and compared in plan, which is exact on flat ground at
  origin height and wrong by the height of the hill otherwise. Aiming
  *exactly* at control points eighteen metres up reported distances of 14.5
  to 35.7 metres against a 6.4 metre threshold — 6 of 6 missed. This is what
  "adding points is finicky" turned out to be: not imprecision, but a test
  asking about a patch of ground beyond the hill.
- **`flatten` emits nothing between two corner points**, so a two-point road
  offered a hit test only its own ends. Same missing samples as the road
  draping bug, in a second consumer, which is what finally moved `densify`
  into curve.js to be shared.
- **Shift-click adds a control point.** Double-click had a race no aiming
  fixes: the first click of the pair runs the ordinary handler and can
  deselect the curve, so the second arrives with nothing selected.

**A fourth round, and this one was a refactor that paid.** Two items, and both
are cases of the same thing: a control living in the wrong place, where the
wrong place was preventing a whole category of feature rather than merely
being untidy.

- **The selection panel takes curves.** Every other thing in the tool answers
  "what is selected" on the right; curves were the exception, so a road had no
  settings at all and a landform's lived in a list in the World tab. Fixing
  the inconsistency is what made a **per-road width** possible — that setting
  had nowhere to live before, which is the entire reason it did not exist,
  and the data model needed nothing: `roadEdits` had carried `width` and
  `main` since the day holding a road existed. Changing anything about a road
  now takes hold of it, the same rule dragging a control point already
  followed. Measured: widening a road from 5.2m to 9m moves its frontages back
  exactly 1.90m, half the change, on both sides.
- **Terrain settings became noise-only, and a drawn shape got its own
  surface.** Terracing was applied after both branches of `heightAt` on the
  reasoning that it is a property of a *surface* rather than of how the
  surface was made — which sounds right and is wrong in the way that matters:
  one slider silently restepped every shape in the scene and there was no way
  to terrace one mesa and leave the next smooth. Each landform now carries its
  own terracing and its own **roughness**, the latter being new rather than
  moved, since the noise ground has had a roughness control since the
  beginning and the drawn ground had none. Scaled by the shape's own weight so
  it fades where the shape does, and seeded from the shape's id so two
  identical settings do not produce the same crumple.

**The rule worth carrying forward from both**: a control in the global panel
should describe how the *procedural* version is generated. Anything that
describes one authored object belongs on that object, and if there is nowhere
to put it, that absence is the bug rather than a reason to make it global.

**What is still missing from the road tier**: 5.3 junctions, 5.4 width
profiles, 5.5 road types. 5.6 (roads conform to terrain) is now *mostly* done
and from an unplanned direction — roads drape properly, and bridge what they
cannot climb — but it is all fill and no cut: no cutting into a hill, no
embankment, no abutment where a deck meets ground. The columns remain the
plainest thing that reads as structure rather than a pier component, which is
the component-library job 4.4 would open up.

**Next: the missing anchor.** Every building edit is road-relative today,
including "Nudge X", which is why they ride a road that moves — the right
default, and the only one available, since a plot's whole identity is its
address on a street. What has no answer is a building pinned to the *world*:
"this one stays here even if that street walks away." That is Tier 2's
reference frames and Tier 3's claims, and it is now the largest hole in the
locking story.

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

### 1.2 Single-page shell ✅
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
| **Boundary** | a closed curve in `params`, or the square by default | 4.2 ✅ |
| **Roads** | proposed by a pattern, or held as a curve in `params` | 5.2 ✅ |
| **Lots** | `{ id, x, z, angle, w, d }` from `placeSites` | Tier 3, as claims |
| **Buildings** | modules with sparse overrides | already editable |

The bottom link has been editable since long before any of this. The top
three are the work. Reading it as a chain is what makes the ordering obvious:
each link consumes the one above, so editing high up regenerates a lot and
editing low down regenerates almost nothing — which is exactly what you want
from an art-direction tool and exactly what a single `buildLayout` call
cannot offer.

### 4.1 Curve primitive ✅
One type, serving every linear thing in the world: roads, rivers, walls,
fences, pipes, cables, powerlines, hedgerows, balustrades — and boundaries,
which are the same object closed.

Editable control points, a length parameterisation, sampling by t, and the
lock states above.

### 4.2 The town boundary becomes a shape ✅
The extent was `half`, one scalar, `Math.max(cols, rows) * cell / 2`,
threaded through every pattern function as an axis-aligned square.
`clipLine` tested against it, `placeSites` rejected against it, and the
generator divided by it to decide how far downtown a building was.

It is now a region — `region.js` — answering `contains(x, z)`, clipping a
line, and reporting its own extent and centre. The square derived from cols
and rows is the default one, so a scene that never draws a boundary is
unchanged down to the last float, which the digest holds it to.

Three things came with it that the plan did not name:

- **Clipping returns a list, not a span.** A line crossing a square enters
  once and leaves once; the same line across a crescent is inside, outside
  and inside again, and a road that jumps its own gap is not a road. Each
  span becomes a road with its own id and its own kerbs.
- **A polyline clip, for generators that wander.** Old town walks its lanes
  rather than drawing them, so it needs the inside *runs* of a walk. Written
  against `contains` and a bisection, so it works for any region — including
  whatever replaces a polygon later.
- **On the outline counts as in town.** Ray casting cannot answer for a
  point exactly on the edge, and old town starts every lane on the edge of
  the extent, so half of them would have begun one step outside the shape
  they were filling.

The boundary itself is a closed curve in `params`: it saves, loads, undoes
and exports with everything else, three starting shapes are one click away in
the Size panel, and choosing Square is a deliberate no-op so adopting a
boundary never costs you the town you had.

### 4.3 Generators produce curves rather than being the only source ✅
The four road patterns stopped being the way roads exist and became one way
roads are *proposed*. A proposal you take hold of is stored as a curve in
`params.roadEdits` and emitted every rebuild whether or not the pattern would
still produce it; re-running the generator preserves it exactly.

Mostly bookkeeping, as predicted, with one thing that was not: **merge order
is load-bearing.** `placeSites` walks the road list once and first claim wins
the ground, so a held road that has not moved has to sit in its proposal's
place — otherwise holding a road silently rearranges which procedural plots
survive, which is the precise behaviour holding exists to stop. A held road
that *has* moved goes to the front instead and claims first, or you drag a
street into a gap and its buildings lose the ground to plots that were
generated earlier. The test between the two is the geometry, not a flag.

### 4.4 Distribute-along-curve
Slots into `algorithms.js` beside the nine arrangements already there, and
needs nothing new from the component system. This is what puts lamp posts
down a street, fence posts along a boundary, and pylons across a valley.

**This is the next thing to build**, and it moved up without ever being
touched. Five things landed underneath it as side effects of other work:

- `resample` in curve.js already spaces points evenly by arc length, which is
  the whole algorithm's core and the part that would otherwise need writing.
- `densify` is now shared and handles the case that breaks naive samplers — a
  straight run between two corner points, which `flatten` correctly emits
  nothing between.
- Curves answer height as well as plan, so a post on a slope lands on the
  slope.
- `elevation.js` can say where a road's *deck* is, so a railing on a viaduct
  goes on the viaduct rather than at the ground under it.
- The assembly sizing fix means a component asked for a size actually takes
  it, which is what stopped a lamp post rendering at its native two metres
  whatever it was asked for.

**Aim at viaduct railings first.** They are the case that needs a curve's
height rather than its plan, which is the part that did not exist a week ago,
and they are visibly missing right now — a raised road with no edge to it is
the most obviously unfinished thing in the tool. Lamp posts down a street are
the easier second, and prove the same code against a draped curve rather than
a raised one.

Four curves already exist to consume it: roads, the boundary, landform
outlines and held roads. That is the argument for having built the primitive
first, finally cashed.

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

### 5.1 Roads become curve consumers ✅
A held road is a curve, carrying its own width and whether it is a main road.
The four patterns are now generators in the 4.3 sense — one way roads are
proposed, not the only way they can exist.

Width *profiles* and road *types* are still 5.4 and 5.5. A held road carries
one width, taken from its proposal the first time and owned by the scene
after that, because once the pattern has moved on there is nothing left to
read a width off.

### 5.2 Hand-editable roads — moving ✅, the rest to come
Drag a control point and the buildings re-front onto it, keeping their ids
and their edits. Add a point, delete one, make it a corner or let it curve.
Hold a road as it is with `L`, release it with `L`.

No new concept, exactly as predicted: an untouched road is `free` and
regenerates from the pattern, a held road is `fixed` and the pattern does not
touch it. Editing a road *is* locking it, the same way editing a building is.

**What the doing of it added to the plan**, and neither was foreseen here:

- **Holding freezes the road's name.** A building's id is its road's id plus
  its address along it, so a road named after its own position renames every
  building on it the moment it moves — losing every edit. Freezing the name
  on hold is what makes "the buildings travel with the street" work at all,
  and it is one line in `heldRoads`.
- **Edited plots claim their ground first**, which is the smallest useful
  piece of Tier 3's claims arriving early. It was written to stop a moved
  road evicting an edited building and it does not do that — that loss is
  the kerb test, a plot landing inside another street, which no priority
  should fix. What it does do, measured rather than assumed, is stop *lot
  fill* evicting them: 96 of 592 edited plots survive a range of footprint
  settings with it and not without, and none go the other way. Worth keeping
  for the reason it turned out to have rather than the one it was written
  for.
- **An override's reference frame follows from that.** `overrideMoved`
  rejects an edit whose plot has drifted more than a cell and a half, which
  is right for a plot that drifted and catastrophic for a plot on a road you
  deliberately dragged twenty metres. A plot on a held road is anchored to
  the road, so the road id still has to match and the distance no longer
  does. That is Tier 2's reference frames arriving early, in the one place
  that could not proceed without them.

**Still to come:** drawing a new road from nothing, splitting, joining,
deleting a proposed road outright, and widening one road on its own. The
middle constraint state — a road that may reroute but must keep meeting the
roads it currently meets — is still unbuilt, and is the interesting one.

**Height landed since, and was not on this list.** A road is no longer
obliged to lie on the ground: `roadHeight` proposes a viaduct network,
alt-dragging a control point raises that point alone, and columns hold the
decks up. The part worth keeping from it is not the viaducts but what the
identity scheme forced — height had to be a profile along the run rather than
a per-point value, because expressing "up in the middle, down at both ends"
on a two-point grid road would mean inserting points, and inserting a point
renames the road and loses every edit on it. Any future per-road property
that varies *along* the road — 5.4's width profile, most obviously — has to
be shaped the same way for the same reason. That is the precedent.

### 5.3 Junctions as generated components
Where two curves meet, resolve a junction from the library — a crossroads, a
T, a roundabout, a fork — rather than overlapping two ribbons and hoping.
This is the single biggest visual upgrade in the tier and it needs no new
machinery: a junction is a component, chosen by a role, sized by its
constraints.

**Per-road width and kind landed early**, out of a refactor rather than out of
this tier. Putting the selected curve in the same panel a selected building
uses — which was an inconsistency worth fixing on its own — turned out to be
the thing that made a per-road setting *possible*: a width that applies to
this road has nowhere to live in a panel of global sliders. The data model
needed nothing; `roadEdits` already carried `width` and `main` from the day
holding a road existed, and only the UI was missing.

Two things follow from that worth remembering here. Any per-road property
Tier 5 wants — a width profile, a road type, a frontage rule — now has a home
to appear in, which removes most of the reason 5.4 and 5.5 looked expensive.
And the width one is already the thin end of 5.4: what is missing is only that
the width is a single number per road rather than a profile along it, and
elevation.js has already established the shape that has to take.

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

**Half the groundwork is in.** `main` is already per road and already
editable — the selection panel offers street or highway on whichever road is
picked up, and `roadEdits` stores it. What is missing is that `main` is a
boolean where this wants a named type, and that nothing downstream reads it
except width and the column count. The shape of the work is therefore: turn
the flag into a type, give each type its own setback, frontage spacing and
role mix, and have `placeSites` read those off the road instead of off
`params`. No new storage and no new UI pattern — the panel that would show it
already exists.

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

**Partly landed, and from the other end than expected.** Drawn ground —
landform curves stacked over a raster, exclusive with noise — is the
*writable* half, and it arrived because somebody wanted to pull the ground up
in a particular spot rather than because the roadmap asked for a field. See
`README.md` under "Two kinds of ground, and never both". What that leaves:

- ~~**`normalAt` and `slopeAt` do not exist.**~~ Both landed, and exactly as
  predicted: the raster made them two samples and an arctangent, and they
  arrived the moment something wanted to refuse to build on a cliff. They are
  sampled rather than analytic on purpose — drawn ground is a raster and
  terracing is a rounding step, neither of which has a derivative, and a
  building asking "is this patch too steep" is asking about a patch anyway.
- ~~**Drawn ground has no surface detail.**~~ Each landform now carries its
  own roughness and its own terracing, and the Terrain panel describes the
  rolled ground only. Worth knowing when adding anything else to that panel:
  it is a list of *noise* parameters, and a setting that describes one drawn
  shape goes on the shape.
- **Nothing conforms to terrain beyond standing on it.** A building on a
  slope is planted at one height with a flat base, which reads fine at the
  gentle end and badly on a real cliff. That is Tier 3's placement record
  wanting a transform rather than a Y. **Newly the most visible gap in this
  tier**: `maxBuildSlope` currently hides it by refusing the plots where it
  would show, which is the right stopgap and not a fix — the same rule with
  a placement that could tilt would be a hillside town rather than a bare
  hillside.
- **Nothing displaces it.** Roads bridge rather than cut, so it is all fill
  and no excavation: no cutting into a hill, no embankment, no quarry. That
  is 5.6 and Tier 7 and both want the raster to become writable *by systems*
  rather than only by hand, which it currently is not.

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

*Was Tiers 0.1 and 0.2, then 4.3. All done, and each was the right one: the
first two were losing work while they waited, and the third was the gesture
the whole tool is pointed at.*

Now: **the world anchor.** A lock currently means "this thing keeps its
address", and every address in the town is relative to a street. That is the
right default and it is not sufficient: there is no way to say "this building
stays exactly here" and have it mean anything once the street moves. Until
that exists, every lock in the tool is a lock with one silent exception in
it, and the tool cannot honestly claim the invariant it is built on.

## If you do one week

The world anchor, then Tier 3's placement record, which is the structure it
wants to live in: `{ id, componentId, transform, seed, tags, source, lock }`,
where the lock names what the transform is measured against — world, a curve
at t, another component's anchor, terrain at XZ.

**Or 4.4, if the week should produce something to look at rather than
something to build on** — and this is now the stronger recommendation of the
two. Distribute-along-curve is the cheapest large win on the list and it has
got cheaper twice without being touched: `resample` already spaces points
evenly by arc length, curves already answer height as well as position, the
assembly sizing fix means a component asked for a size takes it, and since
the bridging work a curve can say where its *deck* is rather than only where
its ground is.

It is also the item that finally puts the component library to use on
something other than a building — which is the gap the whole library has been
sitting in. Lamp posts down a street, railings along a viaduct, pylons across
a valley, fence posts round a boundary: four consumers of one algorithm, on
four curves that already exist. The viaduct railings are the case worth
aiming at, because they are the first thing that would need a curve's height
rather than its plan, and everything needed for that landed this week by
accident.

Take the roads work as the pattern for all of it: an artifact stored in
`params`, generated first and edited second, a frozen name at the moment of
authoring, an explicit rule for every way it can contradict what is generated
around it, and a digest run to prove the untouched case did not move.

## Starting cold

If you are picking this up in a fresh context, the fastest way in:

1. `node development/awesome-town-city-builder/tools/serve.js 5182`, or the
   `awesome-town` entry in `.claude/launch.json`.
2. Read `README.md` under "How it fits together" — it is the system as it
   stands, and it says at the top what belongs there and what does not.
3. Read this file's "Where this is, in one paragraph" and then 4.4 above.
4. `node development/awesome-town-city-builder/tools/digest.mjs` before you
   start, so you have the baseline to compare against.

`cc` in the browser console is the whole app — `cc.state.params`,
`cc.markAll()`, `cc.flush()`, `cc.layers`, `cc.curveEditor`, `cc.liftAt`,
`cc.particles`, `cc.flyby`. It is how every measurement quoted in this file
was taken, and it is faster than adding logging. Two things about it that are
not obvious: `cc.flush()` is needed after writing to `cc.state.params` because
rebuilds are queued on a frame, and a hidden browser tab does not run frames
at all — so a measurement taken without it may be reading the state from
before the change.

Where a setting lives is now a rule rather than a habit. **The left panel
holds parameters of the procedural systems; the right panel holds whatever is
selected.** A road, a landform and the boundary all open in the right panel
the same way a building does, and a setting that describes one of them belongs
there — see "Two structural things landed recently" above for why that
distinction is load-bearing rather than tidiness.

## The one to be impatient about

Tiers 4 and 5, and specifically 4.2 and 5.2 — drawing the town's outline
instead of setting rows and columns, and dragging a road instead of rerolling
until one lands where you wanted. That is where this stops being a machine
you tune and becomes a set you dress.

4.2 landed, and it was what it looked like: one scalar becoming an interface,
small for how much it changes. The half of the claim that mattered turned out
to be the cheaper half — a town you *site* rather than size reads differently
before you have edited a single point of it.

5.2 is the other half and it is the one still worth being impatient about.
Everything between here and it is real work it depends on: placements so
there is something to edit, and 4.3 so a road is a thing that exists rather
than a thing that is emitted.
