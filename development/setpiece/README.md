# Setpiece

Drawing to blocked-out 3D, fast. A browser tool for turning a perspective
drawing into a correctly-measured set of primitives, dressing it with collage
cutouts, and handing the result to Blender.

Runs at `http://localhost:3000/development/setpiece/` off the site's dev server.
No build step, no dependencies beyond three.js from a CDN.

## The workflow

1. **Drawing** — load the line art.
2. **Perspective grid** — optionally load a separate grid reference. This is the
   best calibration input there is, because it is nothing but clean converging
   lines. It does not need regular spacing: its only job is to supply the two
   vanishing points.
3. **Solve camera** — combines the two. The grid gives the vanishing points, the
   drawing gives the upright direction. That pairing matters: a bare ground grid
   has no upright edges, so on its own it cannot pin down the principal point,
   and the drawing supplies exactly that missing piece. Using both is strictly
   better than either alone.
4. **Ground grid** — draws the solved floor back on the drawing in green. If it
   lies on the drawing's own floor, the perspective plane is right.
5. **Block** — drag a rectangle around an object to place it.
6. **Overlay** — the blockout's outline in red, on the drawing. Where red sits on
   the drawn lines, the object is right.
7. Select it, use **Depth** or `[` `]` to slide it forward and back.
8. **scene.json** for the Blender importer, **.glb** for anything else.

Everything above is offline and needs no API key.

## Depth is a choice, not a measurement

The single most important thing to understand about this tool.

A picture cannot tell you how far away anything is along the view axis.
Infinitely many arrangements produce the same image, so the tool has to guess,
and it guesses "standing on the ground". That is right often enough to be useful
and wrong often enough to need fixing.

So rather than pretend, the ambiguity is exposed as a control. Select any object
and use the **Depth** slider, or the **[** and **]** keys. The object slides
toward or away from the camera and **its appearance from the station camera does
not change at all**. It cannot break the match to the drawing no matter how far
it is pushed. What changes is what it sits behind and in front of.

In a parallel projection this is exact and free: nothing rescales, nothing
shifts, not by a pixel. In a perspective projection the object is rescaled by
the distance ratio so it holds its place in frame. Both are verified on every
nudge, and the status line says "unchanged on screen" or warns if it ever drifts.

Press **Overlay** to draw the blockout's outline back onto the drawing in red.
Where the red sits on the drawn lines, the object is right. Where it floats, use
the depth slider or adjust its size. That is the whole correction loop.

## Start here

Pick **Candyworld** from the Example scenes dropdown. It is a real 24-object
blockout built from `assets/test-candyworld.jpg`, an axonometric render, with
the source image projected onto every object. Orbit it, then press **Fly**.

Rendered back from the station camera it reproduces the source image with a mean
absolute error of 15 out of 255 across the 82% of frame the geometry covers, so
the projection is landing where it should. The remaining error is silhouette
mismatch, which is what a blockout is: a box standing in for a cactus.

The **Courtyard** scene is a synthetic set exercising every primitive type.

## How a drawing becomes a scene

The flow that produced Candyworld, and the one to repeat:

1. Solve the camera from the image (automatic, no model, no key).
2. Read each object off the drawing as a pixel observation: where its own base
   sits, what elevation it stands at, where its top edge is.
3. The solved camera converts those to exact world geometry. Nothing metric is
   estimated by eye.
4. Write the nodes into a `scene.json` and load it.

Step 2 is the only human step, and it is deliberately the kind of thing a person
or a model can do from a picture: no depth judgement, only "where is this in the
image". `js/annotate.js` is the batch entry point for it.

The one rule that matters: **an object's pixel observation must be its own**. For
something standing on something else, give the elevation it sits at and the
pixel where its own base appears. Getting this wrong is easy and shows up
immediately as stacked objects flying off their supports. In Candyworld every
stacked object lands on its support within 0.17 world units.

## How the automatic pass works

Load a drawing, press **Interpret**. The work splits in two, because the two
halves need completely different tools.

**Perspective is measured, not guessed.** No model, no API key, no network. The
vanishing points are already in the image, encoded in which way its straight
edges lean, so classic computer vision recovers them exactly: Sobel gradients,
edge thinning, a gradient-steered Hough transform for straight lines, then
seeded RANSAC to cluster those lines into vanishing points. About 150ms. A
vision model asked for a focal length would be guessing, and would guess
differently every time you asked. This is deterministic: the same drawing gives
the same camera, every run, which matters because otherwise every position in
the set shifts underneath you.

**The tool classifies the perspective: one-point, two-point, three-point, or
parallel.** It decides by counting how many of the three vanishing directions
actually converge, not by guessing.

The trap worth naming, because I fell into it: **upright edges staying parallel
in the image is the definition of two-point perspective**, not evidence of a
parallel projection. A level camera yaws between two horizontal directions that
converge while verticals stay vertical. Treating that as orthographic throws
away a perfectly good perspective solve.

Two-point also breaks the usual assumption that the principal point sits at the
image centre. A vanishing point at infinity along image direction d forces
(V - P) . d = 0 for every other vanishing point, so both horizontal vanishing
points AND the principal point lie on one line: the horizon. The principal point
slides along it, which is exactly what a cropped or lens-shifted frame does.
Verified on a synthetic camera with a deliberately off-centre principal point at
(500, 140): focal 1100 recovered as 1100, principal point recovered exactly,
distances and heights exact. On the line-art drawing it lands at (496, -131),
131px above the top of frame, which is why no horizon is visible: the drawing is
a crop looking down.

Projected textures honour this through `setViewOffset`, building the virtual
full frame that would have the principal point centred. The three.js camera
agrees with the analytic projection to 0px.

**Parallel projection is still supported, as a genuine last resort** when
nothing converges at all. A lot of
stylised art, and most of the diorama and isometric look, is rendered with
parallel projection or a lens so long it amounts to the same thing. Vertical
edges stay vertical, nothing converges, and there is no horizon anywhere.

Perspective solving has no answer there, and worse, it fails quietly: the focal
length formula divides by the convergence, so as the vanishing points run off to
infinity it returns a confidently enormous number rather than an error. On a
test image it produced a 13806px focal length, a 4.6° field of view, which is a
500mm super-telephoto. So the solver now rejects any result beyond plausible
lens range and switches to an axonometric solve.

Axonometric is easier, not harder. With world up projecting straight up the
image, requiring the projection to be a genuine rotation gives three constraints
that are linear in the squared axis scales, so the whole basis is a closed form
rather than a fit. It also self-checks: if any of the three comes out negative,
no rotation could have produced those directions and the image is neither a
consistent perspective nor a consistent parallel projection. Measured on a real
axonometric render, the ground round-trip is exact to 0 pixels, and the three.js
orthographic camera agrees with the analytic projection to 0 pixels, so
projected textures line up.

**Shapes come from a model reading a measured ruler.** This is the core idea of
the tool. A vision model asked "how far away is that column" guesses badly. So
instead the solved ground plane is rendered back onto the drawing with its world
coordinates printed on it, plus poles of known height standing on it, and the
model is asked to read positions off the grid it can see. Its job changes from
inventing a coordinate system to interpolating inside a correct one.

It returns a *scene program*, not a picture description: typed primitives (box,
cylinder, column, pipe, sphere, arch, roof, stairs, card) with world positions,
metre sizes, rotation and per-type parameters like stair count or roof style.
Press **Scaffold** to see exactly the image it was sent. If the grid is not lying
flat on the floor of your drawing, nothing downstream had a chance, and that is
the first thing to check when a placement comes back wrong.

Every placement is then scored against the drawing independently, by projecting
its bounding box and measuring how much drawn ink sits under the edges. In
testing, correctly placed boxes scored 1.00, 1.00 and 0.48, while the same boxes
at the wrong depth scored 0.38, at the wrong size 0.08, and an empty patch of
floor 0.00. Low scorers are flagged for you to look at. They are never silently
deleted, and note the 0.48: a correct box that runs partly out of frame scores
low too, so this is advice rather than a filter.

**Shapes from lines alone is also built, but it is not good enough, and is off
by default.**
`js/shapes.js` reconstructs cuboids from the detected lines: every vertical edge
is a candidate box corner whose foot back-projects to an exact ground position,
two corners joined by a drawn edge form a footprint edge, two footprint edges
sharing a corner close the whole footprint with no depth guessing, and the
height is then found by sweeping for maximum top-edge support. On a synthetic
drawing of three boxes it recovers one (footprint 7.07 × 7.90 against a true
5 × 8, height 4.42 against 4.5) and misses the other two. Adding a paved floor
drops it to zero.

The cause is the line detector, not the fitting. The Hough pass returns about 33
fragments where a proper LSD would return 150-odd clean segments with true
endpoints, and footprints need corner-to-corner connectivity that fragments
cannot supply. Every threshold that removes a false box also removes a real one,
which is the signature of thin evidence rather than bad tuning. See the note at
the top of `js/shapes.js`.

**Meaning does need a model.** Which regions are objects, where each one meets
the floor, whether it reads as a box or a cylinder or a flat. That is genuine
perception. Paste an Anthropic key into the side panel and it stays in your
browser's local storage.

The rule the code enforces: **the model never estimates depth unaided.** It
either reports 2D observations, or reads world coordinates off a scaffold that
the exact camera solve drew for it. Nothing metric originates in the model.

You can see everything it decided. Detected edges are drawn on the image,
coloured by which vanishing point claimed them, greyed out if none did, and the
Scaffold button shows the ruler itself.

## Why it works this way

`scene.json` is the product. The viewer, the glTF exporter and the Blender
importer are all just readers of it. That means a scene can be generated by a
script, edited by hand, diffed in git, or written by a model, and nothing is
trapped inside an app.

The blockout is not depth estimation. It is single-view metrology: once the
camera is solved, a pixel where an object touches the ground has exactly one
possible world position, and the top edge gives an exact height. No ML, no
guessing, no dragging things around in 3D until they look right. Drawings are
ideal input because their perspective lines are deliberate and clean.

## Manual workflow

The fallback when a drawing has no clean straight edges to measure, or when you
want to overrule what it found.

1. **Load drawing.** Any image.
2. **Calibrate.** In `Lines A`, trace two or more edges that are parallel in the
   scene and horizontal (say, along a street). In `Lines B`, trace two more
   along a perpendicular horizontal direction. Right-click removes the last
   line. A green ground grid appears the moment it solves. If that grid sits on
   the drawing's floor, the camera is right. That is the only check you need.
3. **Set camera height.** This is the world scale. Everything downstream is
   measured against it, so pick something real (eye height, a doorway).
4. **Block.** Drag a rectangle around an object. Bottom edge is its ground
   contact, top edge is its height. A box lands in the right place at the right
   size, textured by projection from the drawing.
5. **Ground / Backdrop.** One click each. Backdrops handle skies and far hills,
   which have no ground contact and so cannot come from a drag.
6. **Scatter.** Load cutout PNGs, add a field, push the sliders.
7. **Fly.** Push the camera through the set. Nothing about a depth trick
   survives a moving camera, so test early and often.
8. **Export.** `scene.json` for the full-fidelity Blender route, `.glb` for
   anything else.

Drop a `scene.json` back onto the window to reload a set.

## The look controls

These are the reason to build this rather than use an existing tool.

**Projection falloff and grazing fade.** The drawing is projected onto the
blockout from the exact camera it was solved for, so from that angle it is a
perfect match. As the camera leaves, the image stretches across surfaces turned
away from the projector. That stretch is the material. The two sliders control
how it fails rather than hiding it.

**Billboard, 0 to 1.** At 0 a card stays where you put it. At 1 it always faces
the lens. The interesting range is between, around 0.3 to 0.6, where a card
turns partway toward the camera and reads as breathing rather than as either a
sprite or a flat.

**Depth bands.** Snaps scattered instances onto a small number of depth planes.
A deliberate flattening: fewer discrete depths read as stronger parallax than a
smooth cloud does, the same reason a paper theatre works.

**Tint from drawing.** Each scattered instance samples the source drawing at its
own projected position and takes that colour. The collage then grows out of the
drawing instead of being sprinkled on top of it.

## Scatter fields

A field emits ordinary nodes into the scene. It does not own a live subtree.
That means every instance stays individually editable, and any node marked
`pinned` survives the next re-roll. Most scatter tools throw away your hand work
the moment you touch a slider. This one does not, and that is most of the point.

Domains: `ground` (a rectangle on the floor), `box` (a volume, reads as floating
particulate), `shell` (the walls of a volume, leaving the middle clear for the
camera), `ring` (an annulus around a centre, for dressing a move that travels
through the middle).

## Getting it into Blender

```bash
blender --python development/setpiece/blender/import_setpiece.py -- path/to/scene.json
```

Rebuilds the station cameras with matching focal lengths, sets the source image
as a camera background plate so you can eyeball the match, and recreates
projected materials as a real UV Project modifier driven by that camera. All of
it stays editable.

Materials are emission, not Principled. The drawing already contains its own
light, and relighting it is the fastest way to lose the look.

Images embedded as data URLs get written out to `setpiece_assets/` next to the
json on first import.

The `.glb` route is a baked handoff. Geometry and cutout cards come through
cleanly; projected materials cannot, because glTF has no projector concept, so
they arrive as flat grey. Use the json route when projection matters.

## Known limits

- **Blockout needs ground contact.** Anything floating has to be placed by hand
  or hung off something that touches the floor.
- **A rectangle is a silhouette, and this is the big one.** Any box around a
  turned volume spans wider than the volume itself, and its bottom edge is the
  *nearest* ground contact, so the footprint lands at the near face. Heights are
  exact, widths come out over, depth is a guess. In testing a 5m wide building
  measured 6.02m while its 4.5m height came back at exactly 4.5. This applies
  equally to rectangles you drag and rectangles the model proposes, because it
  is a property of the gesture rather than of who made it. Expect to pull
  footprints back after an automatic pass. It is a blockout, not a survey.
- **Depth is unknowable from one view.** New boxes get a square-ish default
  depth, which is a guess and reads better than paper-thin for a blockout.
- **Cross-origin cutouts cannot be colour-sampled.** Local files and data URLs
  are fine, which covers the actual workflow.
- **One station is wired end to end.** The format holds many, and the Blender
  importer builds all of them, but the UI currently calibrates one at a time.

- **Automatic calibration needs straight edges.** Architecture, roads, tiled
  floors and interiors work. A drawing of clouds and trees has nothing to
  measure, and it will say so rather than invent a camera.
- **The API key sits in browser local storage.** Fine for a personal tool on
  your own machine. Do not put this page anywhere public with a key in it.

## Verification

`js/calib.test.js` round-trips the solve: it builds a camera with known focal
length and orientation, projects world lines through it, feeds the image lines
back to the solver, and checks that the recovered camera measures the world the
same way. Focal length, ground distances, object height and horizon position all
recover to within 0.1%.

```js
import('/development/setpiece/js/calib.test.js').then(m => console.table(m.run().results))
```

The automatic pass was checked the same way, by rendering a synthetic
architectural drawing through a known camera and asking `autoCalibrate` to
recover it from the pixels alone. From a true focal length of 900px it found
891px, a 1% error, with the horizon within 0.2 pixels, and it measured a
building at 5.013m wide against a true 5m and 4.514m tall against a true 4.5m.
Three consecutive runs returned identical results.

## Files

| | |
|---|---|
| `js/scene.js` | the format. Everything else reads it |
| `js/calib.js` | vanishing points, camera solve, image to world |
| `js/autocalib.js` | automatic perspective, no model. Edges, Hough, RANSAC |
| `js/ortho.js` | the axonometric solve, for parallel-projection art |
| `js/annotate.js` | pixel observations to exact geometry, no key needed |
| `js/scaffold.js` | renders the measured ruler the model reads |
| `js/interpret.js` | the vision call. Scene program in, nodes out |
| `js/shapes.js` | line-based fitting (rough) and the placement verifier |
| `js/blockout.js` | image rectangle to world primitive |
| `js/viewer.js` | scene to three.js, projection shader, billboarding |
| `js/scatter.js` | procedural fields with pinning |
| `js/exporter.js` | json and glb out |
| `js/main.js` | UI wiring |
| `blender/import_setpiece.py` | the full-fidelity route out |

## Next

- **Swap the Hough pass for a real line segment detector** (LSD or EDLines).
  This is the highest-value change in the project: the camera solve is already
  excellent and would only get better, and cuboid fitting is currently starved
  by fragmentary segments rather than by any flaw in its own logic.
- Replace bounding boxes with real masks (SAM), which fixes the silhouette
  overshoot: a mask's lowest points give a true footprint instead of a
  near-face guess, and the cutout comes free for use as a collage card.
- A second station sharing one world, aligned on the ground plane plus one
  anchor point.
- Camera paths authored in the tool and exported as Blender f-curves.
- Cross-projection: drawing A projected from camera A, drawing B from camera B,
  blended by camera position. Impossible space.
