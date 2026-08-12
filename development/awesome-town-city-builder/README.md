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

| File | Does |
| --- | --- |
| `js/rng.js` | Seeded randomness, and the hashes that give each lot and each module a stable identity |
| `js/noise.js` | Value noise and fbm for the terrain |
| `js/generate.js` | Params, seed and overrides in, city data out. No three.js |
| `js/geometry.js` | The ten module shapes, and the per-face UV cropping |
| `js/build.js` | City data to merged chunk buffers, plus the pick tables |
| `js/material.js` | The one material every module shares |
| `js/textures.js` | The image pool packed into a texture array |
| `js/terrain.js` | Displaced ground and the grid that follows it |
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

### Selection

Click a module, shift-click a building. Double-click drops a fresh image on the
face you hit. Keyboard: `I` image, `shift+I` all faces, `M` shape, `G` glow,
`[` `]` height, `,` `.` width, `R` reroll building, `B` switch between module
and building, `1`-`9` pick a face, `del` remove, `F` frame, `esc` deselect.

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
