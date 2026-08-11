/**
 * 'androgyne' is not a midpoint between the other two. It is its own thing and
 * several of these have no interest in the question. 'unsexed' is for the
 * objects and the spirits, which always circulate regardless of preference.
 */
export type Sex = 'man' | 'woman' | 'androgyne' | 'unsexed'

/**
 * How they present and how the world reads them. Independent of `sex`, and it
 * is the one you meet first, so it is what the preference filter runs on. What
 * someone actually is, if it is anybody's business, comes out later or not at
 * all. The veil applies here too.
 *
 * 'shifting' is for the ones who are not the same on Tuesday.
 */
export type Gender = 'masc' | 'femme' | 'androgynous' | 'shifting' | 'none'

/** What the player is drawn to. The world never becomes only that. */
export type Attraction = 'masc' | 'femme' | 'androgynous' | 'everyone'

export type MoodId = import('../atmosphere/moods').MoodId

export type Axes = {
  warmth: number
  restraint: number
  station: number
  beast: number
  candour: number
  devotion: number
}

export type RegionId =
  | 'marrow'
  | 'lowfield'
  | 'ashcombe'
  | 'palestair'
  | 'thornmarch'
  | 'reeds'
  | 'kingsmoot'
  | 'longroad'

export type Region = {
  id: RegionId
  name: string
  sub: string
  mood: MoodId
  /** map position in percent */
  x: number
  y: number
  blurb: string
}

/**
 * A shape a character wears. Until there are portraits this is doing the work a
 * picture would do, so `presents` is written to be read, not skimmed.
 *
 * Forms are not costumes. A form carries its own axis shifts, its own need and
 * often its own voice, and the ledger records which one you were dealing with.
 * The flaw is conserved across all of them, because the flaw is the person.
 */
export type Form = {
  id: string
  name: string
  sex: Sex
  gender: Gender
  /** the vibe line, standing in for a portrait */
  presents: string
  /** what changes about them in this shape */
  shift: Partial<Axes>
  /** overrides the base need while worn. omit to keep it. */
  need?: string
  answers?: Verb[]
  /** what brings this shape on */
  trigger: FormTrigger
  /** appended to the card while this form is worn */
  note?: string
  deeds?: Deed[]
}

export type FormTrigger =
  | { kind: 'default' }
  /** cycles on the world clock. `of` days in every `every` days. */
  | { kind: 'cycle'; every: number; of: number; offset?: number }
  | { kind: 'region'; regions: RegionId[] }
  | { kind: 'night' }
  | { kind: 'regard'; min: number }
  | { kind: 'phase'; min: number }

/**
 * What sort of thing this is. Kept deliberately separate from sex and gender so
 * that a talking sword does not have to be shoehorned into either. Most of the
 * roster is 'person'. The interesting quarter is not.
 */
export type Kind =
  | 'person'
  | 'beast' // has a body and instincts and no interest in your categories
  | 'object' // a made thing that woke up
  | 'spirit' // bound to a place rather than a body
  | 'bound' // sealed into a vessel and answerable to whoever holds it
  | 'revenant' // was a person and is running on the memory of it

/**
 * For the ones that live in something. The vessel is how you reach them, and
 * handling it is the whole of the physical relationship, which is either very
 * funny or very charged and is usually both.
 */
export type Vessel = {
  /** what the thing is. 'a brass lamp', 'the ninth stair', 'a tall glass' */
  object: string
  /** how you get their attention. 'rub', 'sit in', 'draw', 'stand on', 'uncover' */
  handle: string
  /** what handling it is like, and what it costs them to be handled */
  note: string
}

export type CultureId =
  | 'rowfolk'
  | 'fieldborn'
  | 'ashcombe'
  | 'stairhold'
  | 'thornsworn'
  | 'reedkin'
  | 'moot'
  | 'roadless'

export type Culture = {
  id: CultureId
  name: string
  seat: RegionId
  /** one line on who they are */
  blurb: string
  /** what passes for a greeting here */
  greeting: string
  /** what reads as forward. saying this too early is a misstep. */
  forward: string
  /** what reads as tender. it is rarely what an outsider would guess. */
  tender: string
  /** the thing you do not do */
  taboo: string
  /** how silence is read here. this one has teeth, because silence is a verb. */
  silence: string
}

export type Character = {
  id: string
  name: string
  epithet: string
  kind: Kind
  culture: CultureId
  vessel?: Vessel
  /** what they are. often not your business and often not known. */
  sex: Sex
  /** how they read. this is what the preference filter uses. */
  gender: Gender
  /** the vibe line for the base shape. stands in for a portrait. */
  presents: string
  /** shapeshifters only. the first entry must have trigger { kind: 'default' }. */
  forms?: Form[]
  station: string
  /**
   * One plain sentence. What they are and what is wrong with them, stated so
   * that a stranger understands immediately. This is the most important string
   * on the character and it must never be clever at the expense of clear.
   */
  who: string
  /** two short lines for the card. must fit. */
  card: string
  /** what you learn, and when */
  facts?: Fact[]
  /** stated plainly on the card. generic, never the current transmutation. */
  flaw: string
  /** never shown. the thing that actually moves regard. */
  need: string
  /** which verb answers the need most often */
  answers: Verb[]
  axes: Axes
  anchors: Axes
  resist: Partial<Record<keyof Axes, number>>
  home: RegionId[]
  /** hex, drives the sigil and the card's key light */
  hue: string
  sigil: SigilId
  tropes: string[]
  /** shown once regard is high enough */
  secret: string
  deeds: Deed[]
}

export type SigilId =
  | 'kneel'
  | 'rat'
  | 'stair'
  | 'moon'
  | 'thorn'
  | 'prayer'
  | 'hourglass'
  | 'harness'
  | 'creak'
  | 'mirror'
  | 'hearth'
  | 'debt'
  | 'bone'
  | 'skin'
  | 'bell'
  | 'reed'
  | 'lamp'
  | 'blade'
  | 'wolf'
  | 'twin'
  | 'moth'

export type Verb = 'yes' | 'no' | 'nothing' | 'look' | 'ask' | 'wait' | 'withhold' | 'latch'

/* ---------------------------------------------------------------- scenes */

/**
 * One thing you can do. The label is what YOU do, phrased plainly and short
 * enough to read at a glance. No abstract verbs, no guessing what a button
 * means. `close` is how much closer it gets you, 0 to 6.
 */
export type Choice = {
  label: string
  reply: string
  close: number
  /** ends the scene early rather than running the remaining beats */
  end?: boolean
}

export type Beat = {
  /** what is happening. two sentences at most. */
  text: string
  /** what they say, if they say anything */
  says?: string
  choices: Choice[]
}

/** A whole exchange. Three beats, three choices, about ninety seconds. */
export type Scene = {
  id: string
  /** plain, concrete title. "The fire", "The comb", "Ninety two steps". */
  title: string
  /** gated on closeness, so scenes get more intimate as you go */
  from?: number
  to?: number
  beats: Beat[]
}

/**
 * A specific thing you learn about them, revealed at a closeness threshold.
 * These are the collectibles. Sealed until earned, and visibly sealed.
 */
export type Fact = {
  at: number
  /** short header, so the locked state still tells you what kind of thing it is */
  label: string
  text: string
}

export type Deed = {
  id: string
  /** narrator line, sets the scene */
  scene?: string
  /** what he did. carries the tell. */
  text: string
  /** spoken, if he speaks at all. many of the best deeds are silent. */
  says?: string
  /** the verb that reads the tell correctly */
  tell: Verb
  /** offered today, on top of the standing three */
  offer?: Verb
  /** what happens for each answer. keyed by verb, 'else' catches the rest. */
  replies: Partial<Record<Verb | 'else', string>>
  minPhase?: number
  minRegard?: number
}

export type Encounter = {
  id: string
  region: RegionId
  mood?: MoodId
  /** narrator frame for meeting somebody here */
  scene: string
}

/** map pips. things happening to characters, out in the world, unasked for. */
export type WorldEvent = {
  id: string
  charId: string
  region: RegionId
  line: string
  kind: 'hurt' | 'fortune' | 'curse' | 'rumour' | 'service'
}
