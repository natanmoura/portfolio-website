# Blinks

A small character toy. Jelly creatures with lava-lamp insides wander a white
glass floor, live for one minute, and only survive if you keep breeding them.

Run it with the `blinks` entry in `.claude/launch.json` (port 5184), or
`node tools/serve.js 5184`. Static files, no build step, three.js from unpkg.

## Playing

- Drag a creature to pick it up. It squirms, surprised.
- Bump it into another one and both fall in love. Let go and they walk to
  each other, melt together, and bud off a baby that mixes their shapes and colours.
- Fling or shake one and it gets angry. Anything you bump into with an angry
  creature runs away until it feels safe.
- Tap a creature to focus the camera on it and get a happy hop. Three quick taps make it angry.
- Hover near one and it notices you, leans back to look up, and gets bored after about 5 seconds.
- Drag empty space to orbit, scroll or pinch to zoom.

## How it fits together

- `genome.js` is the character generator. A genome is a body type with
  parameters, optional parts, parts that sprout later in life, a palette and
  face settings. `compileGenome(g, growth)` turns it into signed distance
  primitives. Growth stretches the body only (up to 3x tall, about 2x wide).
  Parts, legs and face keep their size and get re-seated on the bigger body.
  `seedPopulation` spreads a starting set across hue, body type and part group.
- `mesher.js` is surface nets over the SDF with a coarse skip pass.
  `mesh-service.js` runs it in a worker pool so growth re-meshes and merge goo
  never block a frame. Between re-meshes the body is stretched to the current size.
- `materials.js` holds the body shader. Colour is a field of drifting gaussian
  blobs sampled along the view ray inside the body, so the swirl has real
  parallax when you orbit. Mood tint, greying with age, and angry tremble are uniforms.
- `creature.js` covers state, mood, gait and life cycle. Gait and jiggle are driven
  by measured motion, so walking, being carried and being pulled into a merge all
  animate the same way. Feet are world-locked with an IK knee. Faces are canvas
  sprites redrawn on expression change (`face.js`).
- `merge.js` drives the two parents and the baby through the merge, while a worker
  meshes the blended SDF of all three (`goo.js`).
- `stage.js` holds the renderer, the reflective floor (three's Reflector with a blur and
  fade shader), and the depth-of-field pass that racks focus to whatever you touch.

## Dev

`window.gg` is the app. `gg.shot()` saves the current frame into `shots/`
(ignored). When the preview pane is hidden the canvas is 0x0 and rAF stops,
so set `gg.stage.forced = [1280, 800]; gg.stage.resize()` and call
`gg.frame(1/60)` by hand.
