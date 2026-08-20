# Awesome Town City Builder

A three.js cityscape assembled from stacked modules with collage images
projected onto their faces. Buildings sit on a grid over rolling terrain,
modules stack upward, and every distribution is a control you can pull.

Static site, no build step. Run it:

```bash
node development/awesome-town-city-builder/tools/serve.js 5182
```

Then open http://localhost:5182. There is also an `awesome-town` entry in
`.claude/launch.json`.

## Images

Everything in `collage/` listed by `collage/manifest.json` is loaded at boot
into one texture array. To add more:

```bash
node development/awesome-town-city-builder/tools/scan.mjs
```

Dropping image files onto the window adds them for the current session only.
Dropping a `.json` scene file loads that scene.

## Performance

The whole city merges into chunk buffers sharing a single material, so draw
calls track the number of chunks rather than the number of modules.

| Grid | Buildings | Modules | Triangles | Draw calls | Render |
| --- | --- | --- | --- | --- | --- |
| 10 -- 10 | 84 | 558 | 35k | 33 | 0.2 ms |
| 20 -- 20 | 342 | 2193 | 126k | 65 | 0.6 ms |
| 30 -- 30 | 765 | 4917 | 263k | 120 | 1.5 ms |
| 40 -- 40 | 1362 | 8759 | 483k | 170 | 3.2 ms |

Three things make that work:

- **Merged chunks.** Four lots by four lots of modules become one buffer. Face
  colour, image layer, glow and rotation all travel as vertex attributes, so
  nothing needs its own material.
- **A texture array.** Every image is a layer of one `DataArrayTexture`, so
  the material never rebinds. Layers avoid the mip bleed an atlas would have.
- **GPU rotation.** Spinning modules carry a pivot and a speed per vertex and
  turn in the vertex shader, so they stay inside the merged buffers instead of
  breaking out into a mesh each. The shadow depth material gets the same
  vertex transform, so their shadows turn with them.

Editing is fast for a separate reason: **the selected building is lifted out of
its chunk into a mesh of its own**, so dragging a module slider rebuilds one
building rather than sixteen. That runs at about 0.4 ms per drag step.

Rebuilding everything is the one expensive path, because generating the data
is cheap (about 18 ms at 30 -- 30) but turning it into buffers is not. So chunk
meshing is queued and drained inside a per-frame budget, nearest chunks first.
A global slider drag updates the city in waves and holds its frame rate
instead of stalling.

## How it fits together

The city is a pure function of three things: the `params` object the controls
write to, the `overrides` object the editor writes to, and the image pool.
Nothing else is stored, which is why a saved scene is a few kilobytes.

**What belongs in this section, and what does not.** Everything below explains
the system as it stands: what a control means, what invariant a piece of code
is protecting, and which decisions would be quietly undone by someone who did
not know why they were made. It is written for the next person to change this
code, and the test for a paragraph is whether not knowing it would cause a
mistake.

What does not belong here is history — what was tried first, what the
measurements were before and after, which bug prompted which fix. That is
what commit messages are for and they already carry it in more detail than
this could. Two rounds of terrain and road work went in as narrative before
this line existed, and the result was a third of the file describing one
week and a paragraph still confidently documenting behaviour that had been
replaced. If a rule here is surprising, say why in one clause. If the story
needs a paragraph, it belongs in the commit.

`NEXT.md` holds what to build next and why the order is what it is.
`ROADMAP.md` holds the reasoning behind the tiers. `COMPONENTS.md` covers the
component library and its editor.

| File | Does |
| --- | --- |
| `js/rng.js` | Seeded randomness, and the hashes that give each lot and each module a stable identity |
| `js/noise.js` | Value noise and fbm for the terrain |
| `js/generate.js` | Params, seed and overrides in, city data out. No three.js |
| `js/region.js` | Where the town is: contains, clip, extent. The square is the default one |
| `js/curve.js` | The curve primitive: sampling, resampling, editing, queries |
| `js/curveview.js` | Drawing curves and making their handles pickable |
| `js/curveedit.js` | Moving control points, and alt-dragging them upward |
| `js/landform.js` | Ground you drew: closed curves with a height and a falloff |
| `js/elevation.js` | How high a road runs, and what it bridges rather than climbs |
| `js/geometry.js` | The ten module shapes, and the per-face UV cropping |
| `js/build.js` | City data to merged chunk buffers, plus the pick tables |
| `js/material.js` | The one material every module shares |
| `js/textures.js` | The image pool packed into a texture array |
| `js/terrain.js` | The ground: height, slope, tarmac, columns and the grid |
| `js/scene.js` | Renderer, camera, day/night rig, fog and sky |
| `js/select.js` | Raycast picking and highlight |
| `js/ui.js` | Global control definitions |
| `js/piechart.js` | The draggable module mix wheel |
| `js/inspector.js` | The selection panel |
| `js/scenes.js` | Named scene storage |
| `js/tooltip.js` | Hover help overlay |
| `js/pcss.js` | Rewrites three's shadow chunk for contact-hardening shadows |
| `js/ssao.js` | Depth-based ambient occlusion pass |
| `js/looks.js` | Depth of field, grade, halftone, posterise, vignette, grain |
| `js/traffic.js` | Cars and flyers, two instanced meshes sharing one material |
| `js/particles.js` | Things rising off the town, animated entirely in the vertex shader |
| `js/flyby.js` | The driving tour |
| `js/layout.js` | Street patterns and where buildings sit |
| `js/randomize.js` | The dice |
| `js/main.js` | State and wiring |

### Distributions never restructure the city

Every module draws from its own random stream, seeded from `(seed, lot,
index)`, and its traits are rolled as a fixed block of tickets no matter what
the sliders say. The sliders only decide how to read those tickets.

That matters because the obvious approach -?" rolling `if (rng.chance(glowChance))`
inline -?" makes every later draw depend on the value of `glowChance`, so nudging
one distribution reshuffles shapes and sizes across the whole city. With
tickets, turning "lit modules" up lights modules that are already standing.

Glow goes further and is not baked at all: each module's glow ticket is a
vertex attribute compared against a uniform in the shader, so scrubbing "lit
modules" or "glow strength" costs nothing and rebuilds nothing.

### The mix wheel

Every boundary carries a handle, the seam between the last and first kind
included. That one has nowhere fixed to sit, so the wheel keeps a rotation and
the seam handle turns the whole ring as it trades. Without it the first and
last kinds could never trade directly and one edge of the wheel would have no
grip. Dragging a handle onto its neighbour removes a kind outright, and either
neighbouring handle brings it back.

### Building cohesion

Each building picks a signature kind from the module mix, which gives it a
family (boxy or round). Modules then come from the signature kind, its family
siblings, or the global mix, weighted by the cohesion control. Roofs are drawn
only from the family's own roofs, so a round tower takes cones and domes rather
than gables.

Colour follows the same instinct: a building takes three colours from the
palette, each module uses two of those three, and those two are laid across the
module's faces in a geometric pattern -?" solid, alternate, half, mirror, caps or
banded. Roofs are always flat colour. Some buildings carry no images at all, so
the eye has somewhere to rest.

### Module kinds

Bodies: cube, octagon, hollow cylinder, corner pillars, sphere, spinning cards.
Roofs: pyramid, gable, cone, gazebo dome. Cornice slabs are just modules with a
small height. Cylinders and cards can turn.

### Every system has its own seed

Terrain and the road pattern each draw from `terrainSeed` and `roadSeed`
rather than the one `seed` everything used to share. Both default to `null`,
meaning "follow the city seed", which is why a scene saved before either
existed still generates exactly as it did and why a fresh town's three seeds
start out equal without anywhere actually copying a number between fields.

Reroll one, or type a number into it, and it decouples from the city seed for
good -- rerolling the city seed after that leaves the terrain or the streets
exactly where they are. A small `↺` puts it back to following. Locking a seed
disables the field itself, not only its reroll button, since a seed is the
one control in the whole panel where typing a number by hand changes it as
much as randomness does. "Randomise everything" rolls all three when none are
locked, the same as pressing each one's own reroll button in turn would.

### The town has an outline

The extent used to be one number: `max(cols, rows) * cell / 2`, threaded
through every road pattern as an axis-aligned square. It is now a region that
answers three questions -- is this spot in town, which parts of this line are,
and how big is the whole thing -- and the square is simply the default answer.

So a scene that never draws a boundary generates exactly as it always did,
down to the last float. `tools/digest.mjs` is the check: it hashes every road,
lot and module across all four patterns, and this whole change had to leave it
untouched.

Draw one from the Size panel -- square, round or blob -- and the roads are cut
to it, the lots outside it go, the ground grows to cover it, and the outline
appears in the Curves layer with a handle on every point. Drag one and the
town is rebuilt around it. Square is deliberately a no-op: it is the extent
cols and rows already implied, now with handles on it, so adopting a boundary
never costs you the town you had.

A boundary is a closed curve stored in `params`, so it saves, loads, undoes and
exports with everything else, and a scene file with one is still a few
kilobytes.

The point is not the shape. It is that the boundary is the first link in the
generation chain you can hold: **each link is generated from the one above it,
and editing one regenerates what is below and leaves what is above alone.**
Roads and lots are the links still to come.

Choosing a shape twice used to be indistinguishable from choosing it once --
every click regenerated a fresh, pristine version, so a stray second click
silently wiped out however long you had spent dragging its points. Now the
active shape button shows which one the current boundary still matches
*exactly*, and it goes dark the moment you touch a point: clicking a shape
while pristine is free, whichever one you pick, because there is nothing
authored yet to lose, and clicking one once the boundary has been edited
asks first. Deterministic shapes make the free case exact rather than
approximate -- square and round never carry randomness, and blob's only
depends on the seed, so reclicking the one already showing regenerates
something bit-for-bit identical rather than merely similar.

### Two kinds of ground, and never both

Terrain used to be one thing: layered noise, three sliders, take it or leave
it. You could make it rougher or wider but you could never say "there is a
hill *here*".

The Terrain panel now picks between **hills**, which is that, and **drawn**,
which is shapes you place. A landform is a closed curve with a height and a
falloff: the outline you draw is the flat top, and the falloff is how far out
the slope runs before it meets whatever is underneath. A falloff near zero is
a sheer cliff. Thirty metres is a swell you could drive up. Negative height
digs a pit instead.

They stack in the order they were added, each layering over the last, so a
landform's height is exactly the height its top sits at whatever it is
standing on. Draw a plateau at 8, draw a smaller one inside it at 16, and the
second is at 16 rather than at 24. That is the property that makes terracing
predictable, and summing would have destroyed it -- every plateau's real
height would depend on the list above it, which is unusable at three of them.

**The two never mix.** A slider that could nudge ground somebody placed by
hand is exactly the corruption the rest of this tool refuses, so choosing one
leaves the other's controls visible but out of play, and the dice never touch
`landforms` or `terrainMode` at all.

A landform is a curve, which is the whole reason it is a landform and not a
brush. A brush paints pixels you cannot re-edit; a curve stays a handful of
draggable points forever, saves as four lines of JSON, undoes cleanly, and
inherits the view, the editor, the drag, the halo and the delete key that
roads and the boundary already had.

**Terracing** is separate and applies to both: it cuts any slope into flat
shelves with hard risers between them. One slider turns a swell into rice
paddies, a strip mine or a stack of card.

**Ground colour** is a plain swatch, grass green to start, with no paired
"custom" switch. Every palette ships a ground somewhere between paper and
sand, so a town in a landscape was not a look the tool could reach without
editing one — and a colour whose off state means "ask the palette instead" is
two controls where one will do. The palette answer is not lost: every shipped
preset carries the exact colour its palette used to hand it. Night is that
colour dimmed rather than a second swatch to keep in step.

Under the hood the drawn field is rastered once at the ground mesh's own cell
size rather than evaluated per query -- a point-in-polygon plus a
distance-to-outline is fifty-odd edge tests and the mesh alone asks a quarter
of a million times. That is not lost fidelity but gained agreement: the mesh
cannot draw a cliff finer than one cell anyway, so buildings, traffic and the
camera all stand on exactly the surface that was drawn rather than on a more
precise one nobody can see.

### Roads and height

A road used to be paint: a ribbon on the terrain plus six centimetres so it did
not z-fight. It now has a relationship with the ground, and four controls in
the Streets panel decide what that relationship is.

**Road height** raises the whole network onto viaducts. **Slope easing** is the
one that matters most: at zero a road is glued to the terrain, over every bump
and down every cliff; raise it and the road refuses steeper and steeper ground,
stretching the descent off a hill and leaving a taller gap underneath. **Column
spacing** and **column thickness** decide what fills that gap. Alt-drag any
control point to lift that point alone.

**Height is a profile along the run, not a property of a control point**, and
that is the design rather than an implementation detail. A grid road has
exactly two control points, both at the edge of town, so a per-point model
could not express "up in the middle, down at both ends" without inserting
points — and inserting a point renames the road, which renames every building
on it, which loses every edit made to them. So the points are never touched.
The same constraint decides how a road is *drawn*: the ribbon is built from a
subdivided copy made at draw time, because two vertices cannot follow a hill.
Anything that varies along a road has to be shaped this way, which includes
the width profiles Tier 5.4 wants.

Each ribbon vertex sits at **whichever is higher, the deck or its own
terrain**. There is deliberately no test deciding between them: choosing per
vertex puts neighbours on opposite sides of a threshold wherever a road lifts
off, and the two answers do not meet there, which draws a notch. Fading
between them does not help either — the fade would have to be driven by the
lift, and the lift is `surface - ground`, so on steep ground it is the ground
term that jumps and the blend factor is as discontinuous as the thing it was
meant to smooth. The maximum needs no such number: continuous because both
arguments are, incapable of putting tarmac under the terrain, and true to how
a road is built, since the surface is flat across its width and a hill rising
under one edge meets it rather than bending it.

**An end either meets a road or comes down.** Tested against every other road's
whole line rather than only its endpoints, because in a grid nothing meets end
to end: roads cross in the middle and terminate at the boundary. So a
T-junction counts, and takes its height from the road it arrives at so the two
agree where they touch. An end that meets nothing ramps to the floor. Roads
crossing mid-span at different heights are left alone and read as flyovers,
which is what they are.

**Ground steeper than the easing allows is bridged, not followed.** One
slope-limited envelope does it: sample the ground along the road, sweep forward
limiting how fast the surface may drop, sweep back doing the same, and what
survives both passes is the lowest line that stays above the terrain within the
grade. No threshold decides "steep enough for a bridge" — a ravine, a cliff
approach and a gentle hill are the same rule with different answers. Three
properties are load-bearing and easy to break:

- The envelope stores the road's **absolute height**, not its height above the
  ground. Rebuilding a surface as `ground + lift` is only correct where the
  ground between two samples is a straight line, which is exactly what a cliff
  is not.
- The ground is sampled as the **highest point in each interval**, so a cliff
  lip thinner than the spacing cannot slip between two samples and leave the
  deck underground.
- Each straight run is then **replaced by a smoothstep** between its own ends,
  which is what makes a descent an S rather than a ramp with a crease at each
  end. Smoothing cannot do this — averaging a straight line returns it
  unchanged, and the only corner it could touch is pinned against the plateau
  by the clamp keeping roads above ground. A smoothstep's steepest point is one
  and a half times its average, so the sweeps run at two thirds of the limit
  and the curve brings it back to exactly the limit.

**A highway stands on a pair of columns**, one under each edge of its deck; a
**street stands on a single one** down the middle of its path. Two thin legs
under a wide deck reads as a viaduct where one under the middle reads as a
plank on a stick, so the count carries the distinction and thickness stays one
figure for the whole town. Spacing divides each road into a whole number of
equal bays so supports come out evenly spaced end to end.

**A height you set by hand is `fixed`** in the constraints.js sense: no
automatic ramp, no junction match, no grade rule. A road you shaped already
ramps by itself — that is what the difference between two neighbouring points
is.

### Nothing stands on a cliff

**Buildable slope** drops any plot whose ground is steeper than it, so a mesa
gets a town on top and clean bare sides. Measured across the footprint rather
than at its centre, which is the whole reason it works: a plot straddling a
cliff edge has a perfectly reasonable slope in the middle and a ten-metre drop
across one corner. Tested before the packing grid claims the ground, so a
rejected plot leaves the space genuinely empty rather than reserved by a
building that never appeared.

It is a refusal, not a fix. A building is still planted at one height with a
flat base, so this works by declining the plots where that would show. A
placement that could tilt to the ground under it would give a hillside town
rather than a bare hillside, and that is Tier 3's placement record.

### Things in the air

Whatever is in `collage/particles/` drifts up out of the streets and fades out
above the roofline, with controls for size, rise, speed, drift, spin, opacity
and glow. Drop your own stars and small shapes in and rerun the scan.

**Two folders, and the folder is the whole of the setting.** A sprite in
`particles/static/` never turns and stays upright; one in
`particles/rotating/` spins, each at its own rate and direction so they never
turn in lockstep. Deliberately not a per-sprite flag stored somewhere: a lens
flare that must stay level and a star that should tumble are different *kinds*
of thing, and dropping a file in one folder or the other is the shortest way
to say which. Sprites are picked uniformly across the pool and then behave
according to where they came from, so putting more files in `rotating/` makes
more of the field spin — which is what anyone would predict from the folders
alone.

Upright means upright *in the world*, not on screen. Those are the same thing
right up until the camera rolls, which the tour does every time it banks, so a
static sprite's up axis is world up projected into the screen plane and it
counter-rotates against a bank rather than tipping with it.

**A sprite is a shape, not a picture.** Only its alpha is read: colour always
comes from the palette, so what the file contributes is the silhouette. Put a
white star in the folder and the town decides what colour it is.

Each particle takes one of the palette's face colours — the colours the town
is literally built out of, so a mote shares a colour you can point at on a
wall — with the glow colours after them. Every one is pushed into a band of
saturation and lightness on the way through, and that step earns its place: a
palette's paper white and its near-black ink are both fine wall colours and
both useless on a mote in the air, one reading as no colour and the other as
no particle. Hue is never touched, so a nearly monochrome palette comes out as
variations on its own hue rather than as grey, which is right — it should look
like that town.

**Two rules keep them from washing out to white**, and both are the same
principle. The brightest channel is scaled to a ceiling and never allowed past
one, because scaling preserves hue and clipping destroys it — push a warm
amber to 2.5 and every channel clips, and the result is not approximately
white but exactly it. And the material is premultiplied alpha, where the
fragment's own output alpha decides whether it blends as an object or adds as
a light: pure addition onto a bright sky can only wash toward white however
saturated the source, so a particle has to be *drawn over* daylight to read as
a colour against it. Glow slides between the two, weighted by the hour — solid
and coloured at noon, pure light after dark — and brightness past the ceiling
comes from the bloom pass, because the framebuffer has nowhere else to put it.

**Speed spread** varies how fast each one climbs; zero moves the whole field
as one sheet, which reads as a scrolling texture rather than as objects. It is
centred, so turning it up never changes the average — a variance control that
also moved the mean would be two controls fighting.

Every particle is animated entirely in the vertex shader: position, drift,
spin, fade and size are all functions of one time uniform and attributes
rolled once at build time, so ten thousand cost one uniform write a frame.
Everything expressive is a uniform too, so only the count, the sprite pool and
the town's extent ever rebuild the buffer.

### The tour drives the streets

`T` sends a camera down the roads rather than orbiting the town. The route is
a walk of the **road network as a graph**: junctions found by intersecting
every pair of roads, edges being the pieces of road between them. At a junction
the walk turns down a different street; at a dead end the only edge available
is the way back out; and when it has gone far enough, the shortest way home
*along the streets* is appended, so the loop closes on real roads.

That structure is the point, because the failure it replaces was not a tuning
problem. The route used to be stitched by walking one road end to end and then
jumping to whichever unused road passed nearest — with no limit on how near
that had to be. Where the main roads happened to meet it looked fine; where
they did not, the jump was a straight line drawn across whatever stood in
between, and the camera flew through buildings. A graph removes the
possibility rather than bounding it: every edge is a piece of an actual road,
so any walk of it is on the network by construction and there is no hop left
to get wrong.

Three things then decide whether it reads as a shot rather than a debug
flythrough, and all three are about smoothness rather than the path.
Centripetal Catmull-Rom instead of uniform, because road points are junctions
and not samples, and uniform parameterisation answers uneven spacing with
cusps exactly where a junction is. The route resampled at a fixed spacing
before it becomes a curve. And the eye and its aim low-passed rather than read
raw — a camera operator's hand, arriving everywhere the curve goes slightly
late and without the corner, with the aim lagging harder than the body so a
turn reads as looking into it.

**Aim** is metres of climb per ten metres of look-ahead, so one setting means
the same thing whether the tour is creeping or racing. It defaults high enough
to put the upper floors of a building in frame from windscreen height, because
level with the tarmac a street mostly shows its own vanishing point.

### Holding things still

The tool's whole reason to exist is that **authored decisions survive
procedural change**. Roads are where that used to break: they were emitted
wholesale every rebuild and nothing could be said about them.

Now a road is either *proposed* or *held*. Click near one to pick it up. Drag
a handle and it is held where you put it; press `L` and it is held exactly
where the pattern left it, which is the weaker and more useful statement --
keep this street, reroll everything else. Held roads draw orange, proposed
ones blue. `L` again lets it go.

Picking one up is the harder half in a town with any density, since the thin
line runs under the buildings standing on it and a click on the line itself
rarely lands. Every curve carries one small **grip** at its midpoint for
exactly that -- drawn over everything, the same pick path a control point
uses -- and the selected curve draws with a wide translucent **halo** under
its line: a real ribbon of geometry, not a thicker `linewidth` (browsers
ignore that on a plain line, which is why every curve used to look the same
width regardless of what was selected).

Moving the mouse gets the same halo, dimmer and without handles, over
whichever curve a click would land on right now -- built from the exact same
test the click itself uses, so the preview is never wrong about what it is
previewing. That answers "which one am I about to click" before you commit
to clicking it, which matters more than it sounds: a thin line under a dense
town is genuinely hard to aim at, and a highlight that only appears after
the click is too late to help you aim. Move off every curve and both halos
go with it; click on empty ground, or on a building, and the selection goes
too -- a curve stays picked up only until something else is.

The pattern that drives which roads are proposed can itself be set to
**None**, in the Streets panel -- no streets proposed at all, so a town built
entirely from roads you have held. Anything already held stays exactly as it
is either way; a pattern only ever governs what is *proposed*, and held roads
were never that.

That is `free` and `fixed` from `constraints.js`, applied to geometry instead
of to a number: the system proposes, the author disposes.

**Holding a road freezes its name, and that is the mechanism.** A road's id is
a hash of where it is, and a building's id is that road's id plus which kerb
and how far along -- so a building is *addressed relative to its road*. Drag a
road whose name comes from its position and every building on it is renamed,
which loses every edit ever made to them. Drag a road whose name was frozen
when you took hold of it and the buildings keep their names, keep their edits,
and travel with the street.

#### What happens when they disagree

Locking some things and generating the rest does create contradictions. These
are the answers, and each is a rule rather than a special case:

| Situation | What happens |
| --- | --- |
| Hold a road and change nothing else | Nothing moves. Holding in place is a no-op on the whole town, or "keep this and reroll the rest" would not mean anything |
| Hold a road, then reroll the seed or switch pattern | Held roads come through untouched. Everything else is new around them |
| Move a held road | Its buildings move with it, keeping their ids and their edits. It also claims its ground first, so procedural plots give way to it rather than the other way round |
| Grow footprints -- lot fill, frontage, depth -- with edits in the scene | Edited plots are offered their ground before untouched ones, so a building you spent an hour on is not evicted by one nobody has looked at. It is a no-op on a town that has not otherwise moved |
| Move the boundary with a road held | The road stays whole. The boundary decides where the *town* is, not where your road is -- `fixed` means the proposal is ignored, and that includes the boundary's. Plots outside the boundary go, and come back when it grows again |
| A plot ends up inside another street | It cannot be built, and priority is the wrong tool for it -- a building in the middle of a road is worse than a missing one. The edit is reported as unplaced, never discarded, and the building returns when the road moves clear. This is the usual reason a held road loses a plot when you nudge it |
| Release a road the pattern no longer proposes | It disappears, because there was nothing underneath it. One undo away |
| Delete a curve outright | Different from releasing: release hands a road back to the pattern and it comes straight back, delete says there should be no road there at all. Its buildings go, any hold on it goes, and the pattern's next proposal in the same place is refused until you undo it. Select the curve with no points picked and press delete; on the boundary the same key clears it |

One narrower case still has no answer: "Nudge X" and "Nudge Z" are read
relative to the road a building fronts, not to the world, which is why they
ride along when a held road moves rather than staying at a fixed offset from
the origin. That is a coordinate-interpretation question, and it is
different from *whether an edit survives at all* -- which the next section
is about, and which no longer has this gap.

#### An edited building survives its road disappearing

Holding a road freezes its name so its buildings keep theirs. That was never
available to a building on a road you had *not* held -- so a hand edit
survived a slider, but not a boundary drag, a seed reroll, or anything else
that reshuffled the procedural network under it. The plot the edit named
simply stopped existing, and the edit sat in the scene file unreachable,
reported as "nowhere to go" and drawn nowhere.

Every override now carries enough of a fingerprint -- position, size, angle,
not just which road -- to rebuild its plot outright if the normal walk never
produces it. **Editing a building is what holds it in place**, the same
relationship editing a road already has to holding it: you do not press a
button first, the act of authoring something is what promotes it out of the
generated set. The plot becomes, in effect, a held road of one -- it wins
its ground against anything procedural that would otherwise stand there, the
same way a held road's plots already do, and it stays exactly where it was
for as long as the edit exists, independent of whatever the road network
around it is doing.

Two things follow from "the edit is what holds it":

- **Clearing every edit on a building releases it.** The plot goes back to
  being whatever the road says it should be, which may be nothing at all if
  there genuinely is no road there any more -- the same honest outcome an
  unheld road disappearing already gives you.
- **Rerolling a building is not clearing it.** The dice give it a new seed
  and a fresh style while leaving its position exactly where the edit put
  it, because reroll has always meant "surprise me here", not "let this
  location go".

A building explicitly deleted stays deleted through all of this -- there is
nothing to rebuild a plot for when the point of the edit was for nothing to
stand there.

#### Why moving the boundary still rebuilds the whole town

The renderer no longer rebuilds a chunk whose buildings resolved to the same
data as last time -- see "Only what changed redraws" below -- so a lot of
what used to look like a full regeneration is now free: an unrelated slider,
a no-op rebuild, editing one held road while others sit elsewhere all touch
only the chunks that actually changed.

Dragging the boundary itself is the one edit that does not benefit, and it is
worth knowing why rather than wondering whether it is a bug. Grid, boulevard
and radial roads are full-span lines, cut down to size by the boundary --
which means every one of them touches both edges the moved point belongs to,
somewhere along its length, and a boundary vertex always has exactly two.
Nudge one corner and there is no line left in a typical grid that does not
cross one of those two edges eventually, so every road's clipped endpoint
moves a little, every road gets a new position-derived id, and every
building on every road does too. Verified directly: a 0.5-unit nudge on a
24x24 town left 0 of nearly 300 buildings with the id they had a moment
before, on every pattern including Old town, whose wandering start angle
also reads the boundary's own centre.

That is not a rendering inefficiency to optimise away -- the data really did
change nearly everywhere, and a diff can only skip work where nothing did.
Two tools already built keep something still while you reshape the edge
around it, at two different grains: **hold a road** you want the whole
street kept exactly where it is, and **edit a building** for one you want
kept regardless of what its road does -- see "An edited building survives
its road disappearing" above. Both are `fixed`, in the same sense a
parameter is: untouched by anything the boundary proposes, including where
the boundary itself proposes they should end. One caveat the chunk system
adds: a held road's or an anchored building's own geometry is stable, but
the mesh it shares a chunk with is not necessarily private to it, since a
chunk is four lots on a side and a busy grid usually has something unheld
passing through the same one. That chunk still redraws -- correctly, since
something in it changed -- even though the thing you kept still inside it
did not move a pixel.

A real fix for full locality exists and is not small: teach grid, boulevard
and radial to propose their lines against the town's stable default extent
rather than the boundary's own current bounds -- using the boundary only to
clip, the way it already does, but no longer to decide how far a line
reaches before clipping -- and give roads an identity that survives a
reclip, the way Tier 0.1 gave buildings one that survives a road move. That
is real design work across four pattern functions and the identity scheme
both, not a patch, and it is written up as its own item in `NEXT.md` rather
than attempted here.

### Only what changed redraws

`CityBuilder.build()` used to queue every chunk for remeshing on every
rebuild, because that was the simplest thing that worked before there was
any reason to ask whether a chunk's data had actually changed. It kept a
fingerprint of what each chunk last drew and compares before queuing
anything: a chunk whose buildings resolve to the exact same data is left
completely alone, still the same three.js mesh it was a moment ago.

Measured directly: editing one held road while another sits on the far side
of a 5x5-chunk town touches 3 chunks, not 25. A change that does not touch
roads at all -- glow, palette, a slider with nothing to do with layout --
still touches every chunk whose buildings it actually altered, correctly,
since that data really is different; what it no longer touches is chunks it
never should have in the first place.

### Merging lots

A building stands on one lot, which is why the town reads as one texture
however much the modules vary -- everything is the same footprint scale.
Select a building and press `+` to grow it across the plots next to it along
its own street; `-` shrinks it back. That is the one control that changes the
town's *massing* rather than its surface: a shop becomes a department store,
four plots of housing become a market hall.

A merge is a **span** -- `{ plotId: howManyLots }` in `params.lotSpans` --
naming a plot and how many more plots after it along the same kerb are one
building. It runs after placement, so nothing else has to move: the ground a
merged lot covers is exactly its members' ground plus the empty gaps between
them. It stops at the first gap it meets -- a street's end, a plot the density
roll removed -- silently, because reporting every slider nudge as a problem is
worse than a span that took what was there.

### Why overrides are sparse

Each lot's identity comes from `hash(seed, gx, gz)`, and each module id is
`b{gx}_{gz}_m{index}`. Edits are stored against those ids rather than baked
into the city, so pulling a global control rerolls everything around a hand
edit while the edit itself stays put. `Clear edits` drops them all.

The tradeoff: ids are positional, so deleting a module or adding a floor shifts
the meaning of ids above the change. Edits below it are unaffected.

### Every control explains itself

House rule: nothing ships without hover help. `js/tooltip.js` runs one
delegated listener over the document, so a control only has to declare its
copy. For a global control, add `help` to its entry in `CONTROL_DEFS`. For
anything built by hand, wrap the node:

```js
withHelp(node, 'What it does, and what the extremes look like.', 'Label')
```

Write what the control does and what its extremes look like, not a restatement
of the label.

### A layer you cannot see, you cannot select

Hiding or ghosting the buildings stops them taking clicks. Raycasting does not
enforce that on its own — three.js tests geometry and layer masks and ignores
`object.visible` entirely — so a hidden building went on eating every click
aimed at the road behind it. Ghosted counts as unselectable too, and that is
the case worth having: ghost exists to keep the town legible while you work on
something else, so a faded building that still swallows clicks is exactly the
thing ghosting was meant to get out of the way. `picker.pick` already falls
through to the curves when it finds nothing, so a click simply reaches the
street. Any selection is dropped as the layer fades, or the keyboard would
still be pointed at a building you cannot see.

### Aiming at a curve

Two gestures, and both used to be measured against the plane `y = 0`: drop the
ray to that plane, then compare in XZ. That is exact for a curve lying on flat
ground and wrong by the height of the hill for anything else — aiming *exactly*
at a control point eighteen metres up measured between fourteen and thirty-six
metres away, against a threshold of one block. Every one of those clicks
missed. Both now measure from the ray to the curve in three dimensions, which
has no such assumption and is the distance a person is judging by eye anyway.

The samples have to be dense enough to measure against. `flatten` emits
nothing between two corner points, because a straight segment *is* its
endpoints as far as shape goes, so a two-point road offered a hit test only
its two ends and aiming at the middle reported the distance to whichever end
was nearer. `densify` in curve.js is shared by the hit test and the drawing
for the same reason.

**Shift-click adds a control point** to the curve you are holding. Double-click
still does too, but it was unreliable for a reason no amount of aiming fixes:
the first click of the pair runs the ordinary click handler, and landing
slightly too far from the line deselects the curve, so the second click
arrives with nothing selected and adds nothing. Two thresholds had to pass in
a row and missing either silently undid the gesture.

Hovering highlights the individual handle under the pointer, not just the
curve it belongs to. Colour alone is easy to miss on a nine-pixel dot, so it
grows as well.

### One panel for whatever is selected

Selecting anything puts its settings in the panel on the right — a module, a
building, a road, a landform, the boundary. That was already true of buildings
and not of curves, which was not merely inconsistent: a road had no settings
at all, and a landform's lived in a list in the World tab, so selecting a shape
in the viewport meant then going to find it again in a panel holding every
other shape.

The pattern is what makes **per-road settings possible**. A width that applies
to *this* road has nowhere to live in a panel of global sliders, so it did not
exist; the Streets panel could only set every street at once. Now a road
carries its own width and its own kind, and buildings re-front onto the new
kerb — measured, widening a road from 5.2m to 9m moved its frontages back
exactly 1.90m, half the change, on both sides.

**Changing anything about a road takes hold of it**, exactly as dragging one
of its control points does, and for the same reason: the pattern cannot be
asked to keep proposing a road that is nine metres wide only here. The first
change mints the hold from the current proposal, so the road's existing width
and kind carry across rather than resetting.

The landform list in the World tab is now names and heights only — a way in to
the panel rather than a second place to edit. Every action in the panel routes
through the same functions the keyboard and the drag already use, so there is
one rule about what an edit means rather than two.

### Selection

Click a module, shift-click a building. Double-click drops a fresh image on the
face you hit. Keyboard: `I` image, `shift+I` all faces, `M` shape, `G` glow,
`[` `]` height, `,` `.` width, `R` reroll building, `B` switch between module
and building, `1`-`9` pick a face, `del` remove, `F` frame, `esc` deselect.

With the Curves layer on: click near a road or the boundary to pick it up --
every curve carries a small grip at its midpoint for exactly this, since the
line itself is almost always hidden behind a building. Drag a handle to move
it, double-click the line to add a point, `del` to remove the picked ones, `C`
to make a point a corner or let it curve again, `L` to hold a road or let it
go. Control points answer `del` before the selected module does, since the
handle you just grabbed is the more specific intent.

`+` and `-` on a selected building merge it across its neighbouring lots or
split it back apart -- see "Merging lots" above.

### Scenes

Scenes are named and stored in localStorage, listed in the menu in the top bar.
Export writes the same shape to a file, and dragging that file back onto the
window loads it. Working state autosaves, so a refresh does not lose anything.

### Console

`cc` in the devtools console exposes `{ state, stage, builder, materials, pool,
picker, inspector, controls, wheels, actions, flush, markAll, applyEnv,
frameCity }`.

## Notes

- `texture.flipY` does nothing for `ImageBitmap` and raw-data sources. The flip
  happens at decode time via `createImageBitmap(blob, { imageOrientation: 'flipY' })`.
- Ring shapes wind upper-a0, upper-a1, lower-a1, lower-a0. Getting that
  backwards makes the normals point inward and the shape renders inside out.
- `EffectComposer` resets `renderer.info` on every pass, so the stats readout
  turns off `autoReset` and resets once per frame.
- `tools/serve.js` exists because Python's `http.server` reads `.js` and
  `.webp` types from the Windows registry and gets them wrong. Its `POST
  /_shot` route is dev only -?" it lets a headless session save what the page
  just rendered into `shots/`.
