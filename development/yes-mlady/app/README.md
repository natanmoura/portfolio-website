# Yes M'lady — prototype

```bash
npm install && npm run dev
```

Runs on `http://localhost:5181`.

## Stack, and why

- **Vite + React + TypeScript.** Fast, boring, no framework opinions to fight.
- **three.js via @react-three/fiber** for the atmosphere layer only. The UI is DOM.
  Putting the whole interface in WebGL would cost accessibility, text selection
  and text rendering quality for no visual gain, because everything that reads
  as expensive here is lighting, and lighting composites fine behind DOM.
- **Custom GLSL** for sky, motes and shafts. No postprocessing package. Bloom is
  faked with additive blending plus a CSS grade layer, which is a fraction of
  the cost and, at this saturation, indistinguishable.
- **zustand + persist** for state. localStorage for now. The shared pool needs a
  backend before any of the social mechanics are real.
- **No Tailwind.** The look is specific enough that utility defaults would fight it.

## Layout

```
src/
  atmosphere/   sky, motes, light shafts, time-of-day and biome moods
  data/         characters, cultures, regions, types
  state/        store, preference filter, form resolution
  ui/           gold type, typewriter, the parallax card, sigils
  screens/      map, encounter, house, dossier
  styles/       tokens (palette, gold) and base
```

## Data model notes

Four independent axes, deliberately not collapsed into one:

- `kind` — person, beast, object, spirit, bound, revenant. A talking sword does
  not have to be squeezed into a gender.
- `sex` — what they are. Often nobody's business.
- `gender` — how they read. **This is what the preference filter uses**, since it
  is what you meet first.
- `culture` — where they are from, which changes what the same verb means.

`forms[]` handles shapeshifters. Each form carries its own axis shifts, need,
voice and deed pool, and the ledger records which one you were dealing with. The
flaw is conserved across every form, because the flaw is the person.

## Not built yet

Release ritual and the edit composer, the note composer, the queue and pool,
regard tiers past `confiding`, the Almshouse, phases past 0, fortunes as real
state rather than map flavour, and portraits.
