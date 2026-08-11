import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CHARACTERS, charOf } from '../data/characters'
import { REGIONS, regionOf } from '../data/regions'
import { SCENES, factsFor, sceneFor } from '../data/scenes'
import { quirksOf } from '../data/quirks'
import type { Attraction, Character, Form, RegionId } from '../data/types'

/* ------------------------------------------------------------------ */
/* preference                                                          */

/**
 * Preference filters who you meet. It never empties the world of anybody.
 * A share of every draw is somebody outside it, because a world that only
 * contains what you asked for is not a world, it is a mirror.
 */
export const OTHER_SHARE = 0.3

export function weightFor(c: Character, pref: Attraction): number {
  if (c.gender === 'none') return 1 // objects and spirits always circulate
  if (pref === 'everyone') return 1
  if (c.gender === 'shifting') return 1
  return c.gender === pref ? 1 : OTHER_SHARE
}

function weightedPick(pool: Character[], pref: Attraction): Character | null {
  if (!pool.length) return null
  const w = pool.map((c) => weightFor(c, pref))
  const total = w.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    r -= w[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

/* ------------------------------------------------------------------ */
/* forms                                                               */

export function activeForm(
  c: Character,
  day: number,
  region: RegionId,
  isNight: boolean,
): Form | null {
  if (!c.forms?.length) return null
  let chosen = c.forms.find((f) => f.trigger.kind === 'default') ?? c.forms[0]
  for (const f of c.forms) {
    const t = f.trigger
    if (t.kind === 'cycle') {
      if ((day + (t.offset ?? 0)) % t.every < t.of) chosen = f
    } else if (t.kind === 'region') {
      if (t.regions.includes(region)) chosen = f
    } else if (t.kind === 'night') {
      if (isNight) chosen = f
    }
  }
  return chosen
}

export function shapeOf(c: Character, day: number, region: RegionId, isNight: boolean) {
  const f = activeForm(c, day, region, isNight)
  const shifted = !!f && f.trigger.kind !== 'default'
  return {
    form: f,
    shifted,
    name: shifted ? f!.name : c.name,
    presents: f?.presents ?? c.presents,
    note: shifted ? f!.note : undefined,
  }
}

/* ------------------------------------------------------------------ */

export type Line = { kind: 'narrator' | 'said' | 'reply' | 'you'; text: string }

export type Kept = {
  id: string
  metOn: number
  /** 0 to 100. earned from choices, never from waiting. */
  closeness: number
  sceneId: string | null
  beat: number
  transcript: Line[]
  scenesDone: string[]
  /** facts they have shown you, by index */
  learned: number[]
  /** crossed just now, waiting to be shown. cleared when the next scene loads. */
  revealing: number[]
  /**
   * What they will remember about you. Formed from the choice that landed
   * hardest in each conversation, so a memory is always something you did
   * rather than something the game decided.
   */
  memories: { text: string; day: number }[]
  /** closeness earned this conversation, shown in one lump at the end */
  gain: number
}

/** What a keeper did to somebody, kept after they have gone. */
export type Change = {
  quirk: string
  outcome: 'took' | 'warped'
  text: string
  day: number
}

export type Ledger = { kept: number; passed: number; longest: number }

type Screen = 'world' | 'meet' | 'people' | 'scene' | 'about' | 'release'

export type ReleaseResult = {
  id: string
  change: Change
  closeness: number
  days: number
  memories: { text: string; day: number }[]
}

type State = {
  day: number
  hour: number
  pref: Attraction
  region: RegionId
  screen: Screen
  house: Kept[]
  ledgers: Record<string, Ledger>
  /** what every keeper, including you, has done to them. survives release. */
  changes: Record<string, Change[]>
  meeting: string | null
  active: string | null
  releaseResult: ReleaseResult | null

  isNight: () => boolean
  travel: (r: RegionId) => void
  wander: () => void
  seek: (id: string) => void
  take: (id: string) => void
  passOn: (id: string) => void
  open: (id: string) => void
  choose: (index: number) => void
  nextScene: () => void
  beginRelease: () => void
  commitRelease: (quirkId: string) => void
  finishRelease: () => void
  go: (s: Screen) => void
  setPref: (p: Attraction) => void
  reset: () => void
}

function freshLedger(c: Character): Ledger {
  let h = 0
  for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0
  const r = (n: number) => ((h = (h * 1103515245 + 12345) >>> 0) % n)
  const kept = 3 + r(40)
  return { kept, passed: kept * (2 + r(6)) + r(30), longest: 2 + r(48) }
}

const emptyLedgers = () => Object.fromEntries(CHARACTERS.map((c) => [c.id, freshLedger(c)]))

export const useGame = create<State>()(
  persist(
    (set, get) => ({
      day: 1,
      hour: 20,
      pref: 'masc',
      region: 'longroad',
      screen: 'world',
      house: [],
      ledgers: emptyLedgers(),
      changes: {},
      meeting: null,
      active: null,
      releaseResult: null,

      isNight: () => {
        const h = get().hour
        return h >= 19 || h < 6
      },

      travel: (r) => set({ region: r }),

      wander: () => {
        const { house, pref, region } = get()
        const held = new Set(house.map((k) => k.id))
        const here = CHARACTERS.filter((c) => !held.has(c.id) && c.home.includes(region))
        const anywhere = CHARACTERS.filter((c) => !held.has(c.id))
        const pool = Math.random() < 0.78 && here.length ? here : anywhere
        const pick = weightedPick(pool, pref)
        set({ meeting: pick?.id ?? null, screen: pick ? 'meet' : 'world' })
      },

      /** the map events point at somebody specific. going to them meets them. */
      seek: (id) => {
        const held = new Set(get().house.map((k) => k.id))
        if (held.has(id)) {
          set({ active: id, screen: 'scene' })
          return
        }
        set({ meeting: id, screen: 'meet' })
      },

      take: (id) => {
        const { house, day } = get()
        if (house.some((k) => k.id === id)) return
        set({
          house: [
            ...house,
            {
              id,
              metOn: day,
              closeness: 0,
              sceneId: null,
              beat: 0,
              transcript: [],
              scenesDone: [],
              learned: [],
              revealing: [],
              memories: [],
              gain: 0,
            },
          ],
          meeting: null,
          active: id,
          screen: 'scene',
        })
        get().nextScene()
      },

      passOn: (id) => {
        const l = get().ledgers[id]
        set({
          ledgers: { ...get().ledgers, [id]: { ...l, passed: l.passed + 1 } },
          meeting: null,
          screen: 'world',
        })
      },

      open: (id) => {
        set({ active: id, screen: 'scene' })
        const k = get().house.find((x) => x.id === id)
        if (k && !k.sceneId) get().nextScene()
      },

      /** loads the next appropriate scene and plays its first beat */
      nextScene: () => {
        const { house, active } = get()
        const k = house.find((x) => x.id === active)
        if (!k) return
        const c = charOf(k.id)
        const scene = sceneFor(c, k.closeness, k.scenesDone)
        if (!scene) return
        const first = scene.beats[0]
        const lines: Line[] = [{ kind: 'narrator', text: first.text }]
        if (first.says) lines.push({ kind: 'said', text: `“${first.says}”` })
        set({
          house: house.map((x) =>
            x.id === k.id
              ? { ...x, sceneId: scene.id, beat: 0, transcript: lines, revealing: [], gain: 0 }
              : x,
          ),
        })
      },

      choose: (index) => {
        const { house, active } = get()
        const k = house.find((x) => x.id === active)
        if (!k || !k.sceneId) return
        const c = charOf(k.id)
        const all = (SCENES[c.id] ?? []).find((s) => s.id === k.sceneId)
        if (!all) return
        const beat = all.beats[k.beat]
        const choice = beat?.choices[index]
        if (!choice) return

        const last = choice.end || k.beat >= all.beats.length - 1

        /**
         * Closeness is how much of this person you have seen, not points. Each
         * conversation is worth one share of a hundred, and choosing well earns
         * the whole share. So finishing everything somebody has to give always
         * lands at a hundred, whether they have two evenings in them or six,
         * and adding scenes later lengthens the road without breaking it.
         */
        const total = Math.max(1, (SCENES[c.id] ?? []).length)
        const share = 100 / total
        const beats = all.beats.length
        const best = Math.max(1, ...all.beats.flatMap((b) => b.choices.map((x) => x.close)))
        // 60% of the share is just showing up, 40% is reading them right
        const earned = (share / beats) * (0.6 + 0.4 * (choice.close / best))
        const closeness = Math.min(100, Math.round((k.closeness + earned) * 10) / 10)
        const facts = factsFor(c)
        const learned = [...k.learned]
        const revealing = [...k.revealing]
        facts.forEach((f, i) => {
          if (closeness >= f.at && !learned.includes(i)) {
            learned.push(i)
            revealing.push(i)
          }
        })

        const transcript: Line[] = [
          ...k.transcript,
          { kind: 'you', text: choice.label },
          { kind: 'reply', text: choice.reply },
        ]

        let beatIndex = k.beat + 1
        if (!last) {
          const nb = all.beats[beatIndex]
          transcript.push({ kind: 'narrator', text: nb.text })
          if (nb.says) transcript.push({ kind: 'said', text: `“${nb.says}”` })
        } else {
          beatIndex = -1
        }

        // the choice that landed hardest is what they take away with them
        const memories = [...k.memories]
        if (last) {
          const best = [...k.transcript, { kind: 'you' as const, text: choice.label }]
            .filter((l) => l.kind === 'you')
            .slice(-3)
          const pick = choice.close >= 5 ? choice.label : best[0]?.text
          // never record the same thing twice. a memory is a distinct event.
          if (pick && !memories.some((m) => m.text === pick)) {
            memories.push({ text: pick, day: get().day })
          }
        }

        set({
          house: house.map((x) =>
            x.id === k.id
              ? {
                  ...x,
                  closeness,
                  learned,
                  revealing,
                  transcript,
                  memories,
                  gain: Math.round((x.gain + earned) * 10) / 10,
                  beat: beatIndex,
                  scenesDone: last ? [...x.scenesDone, k.sceneId!] : x.scenesDone,
                  sceneId: last ? null : x.sceneId,
                }
              : x,
          ),
          day: last ? get().day + 1 : get().day,
          hour: last ? (get().hour + 7) % 24 : get().hour,
        })
      },

      /* --------------------------------------------------- letting them go */

      beginRelease: () => set({ screen: 'release', releaseResult: null }),

      commitRelease: (quirkId) => {
        const { house, active, day, changes, ledgers } = get()
        const k = house.find((x) => x.id === active)
        if (!k) return
        const q = quirksOf(k.id).find((x) => x.id === quirkId)
        if (!q) return

        // the magic compels them to try. it does not make them able. closeness
        // is the only thing that improves the odds, because you understood them.
        const odds = 0.18 + (k.closeness / 100) * 0.34
        const took = Math.random() < odds
        const change: Change = {
          quirk: q.name,
          outcome: took ? 'took' : 'warped',
          text: took ? q.took : q.warp,
          day,
        }

        const led = ledgers[k.id]
        set({
          changes: { ...changes, [k.id]: [...(changes[k.id] ?? []), change] },
          ledgers: {
            ...ledgers,
            [k.id]: { ...led, kept: led.kept + 1, longest: Math.max(led.longest, day - k.metOn) },
          },
          releaseResult: {
            id: k.id,
            change,
            closeness: k.closeness,
            days: Math.max(1, day - k.metOn),
            memories: k.memories,
          },
        })
      },

      finishRelease: () =>
        set((s) => ({
          house: s.house.filter((x) => x.id !== s.active),
          active: null,
          releaseResult: null,
          screen: 'people',
          day: s.day + 1,
        })),

      go: (screen) => set({ screen }),
      setPref: (pref) => set({ pref }),
      reset: () =>
        set({
          day: 1,
          hour: 20,
          house: [],
          region: 'longroad',
          screen: 'world',
          meeting: null,
          active: null,
          releaseResult: null,
          changes: {},
          ledgers: emptyLedgers(),
        }),
    }),
    { name: 'yes-mlady-v3' },
  ),
)

export const CLOSENESS_TIERS = [
  { at: 0, name: 'a stranger', hint: 'They are polite and they tell you nothing.' },
  { at: 25, name: 'warming', hint: 'They have started letting things slip.' },
  { at: 55, name: 'trusted', hint: 'They tell you things they have not told the others.' },
  { at: 85, name: 'known', hint: 'You have the whole of it.' },
]

export const ledgersSafe = (id: string) =>
  useGame.getState().ledgers[id] ?? { kept: 0, passed: 0, longest: 0 }

export const tierOf = (n: number) =>
  [...CLOSENESS_TIERS].reverse().find((t) => n >= t.at) ?? CLOSENESS_TIERS[0]

export { REGIONS, regionOf, CHARACTERS, charOf, factsFor }
