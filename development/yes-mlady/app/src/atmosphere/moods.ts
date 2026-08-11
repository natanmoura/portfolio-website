// Time of day crossed with place. The UI reads from whichever mood is active,
// so chrome, glow and grain all move together when you travel.

export type MoodId =
  | 'dawn'
  | 'day'
  | 'dusk'
  | 'night'
  | 'swamp'
  | 'campfire'
  | 'court'
  | 'crypt'
  | 'chapel'
  | 'wood'

export type Mood = {
  id: MoodId
  label: string
  skyTop: string
  skyBottom: string
  horizon: string
  fog: string
  fogDensity: number
  moteColor: string
  moteCount: number
  moteSpeed: number
  moteSize: number
  shaft: string
  shaftStrength: number
  grain: number
  vignette: number
  /** drives --amb-key / --amb-fill so the html chrome tints with the scene */
  key: string
  fill: string
}

const M = (m: Mood) => m

export const MOODS: Record<MoodId, Mood> = {
  dawn: M({
    id: 'dawn',
    label: 'first light',
    skyTop: '#241a33',
    skyBottom: '#7d5a52',
    horizon: '#c98d5e',
    fog: '#4a3a44',
    fogDensity: 0.055,
    moteColor: '#f0d9a8',
    moteCount: 420,
    moteSpeed: 0.1,
    moteSize: 9,
    shaft: '#e8b06a',
    shaftStrength: 0.5,
    grain: 0.05,
    vignette: 0.5,
    key: '#d8a463',
    fill: '#3a2a45',
  }),
  day: M({
    id: 'day',
    label: 'daylight',
    skyTop: '#3d5a52',
    skyBottom: '#93a189',
    horizon: '#c3c39c',
    fog: '#6c7a6a',
    fogDensity: 0.035,
    moteColor: '#fff4d0',
    moteCount: 340,
    moteSpeed: 0.08,
    moteSize: 7,
    shaft: '#fdf3cf',
    shaftStrength: 0.7,
    grain: 0.035,
    vignette: 0.38,
    key: '#d9cf9a',
    fill: '#42574c',
  }),
  dusk: M({
    id: 'dusk',
    label: 'evening',
    skyTop: '#1a1226',
    skyBottom: '#4c2b3a',
    horizon: '#a8502f',
    fog: '#33223a',
    fogDensity: 0.07,
    moteColor: '#f2c98a',
    moteCount: 520,
    moteSpeed: 0.11,
    moteSize: 10,
    shaft: '#e08a4a',
    shaftStrength: 0.55,
    grain: 0.06,
    vignette: 0.58,
    key: '#c98a4e',
    fill: '#2b1b3d',
  }),
  night: M({
    id: 'night',
    label: 'small hours',
    skyTop: '#05070a',
    skyBottom: '#141d2a',
    horizon: '#243044',
    fog: '#0d1420',
    fogDensity: 0.1,
    moteColor: '#b9cfe8',
    moteCount: 700,
    moteSpeed: 0.05,
    moteSize: 8,
    shaft: '#7d9bc4',
    shaftStrength: 0.25,
    grain: 0.085,
    vignette: 0.72,
    key: '#8aa4c4',
    fill: '#141d2a',
  }),
  swamp: M({
    id: 'swamp',
    label: 'the reeds',
    skyTop: '#0d1611',
    skyBottom: '#2c3a26',
    horizon: '#516b3f',
    fog: '#243026',
    fogDensity: 0.22,
    moteColor: '#a8e08a',
    moteCount: 900,
    moteSpeed: 0.16,
    moteSize: 12,
    shaft: '#8fd06a',
    shaftStrength: 0.3,
    grain: 0.075,
    vignette: 0.68,
    key: '#8fbf6a',
    fill: '#1c2a1e',
  }),
  campfire: M({
    id: 'campfire',
    label: 'by the fire',
    skyTop: '#07060a',
    skyBottom: '#1c1210',
    horizon: '#4a2113',
    fog: '#160f0d',
    fogDensity: 0.13,
    moteColor: '#ffb066',
    moteCount: 620,
    moteSpeed: 0.34,
    moteSize: 13,
    shaft: '#ff9040',
    shaftStrength: 0.85,
    grain: 0.07,
    vignette: 0.74,
    key: '#e08a45',
    fill: '#26140f',
  }),
  court: M({
    id: 'court',
    label: 'the court',
    skyTop: '#150f22',
    skyBottom: '#33224a',
    horizon: '#6b4791',
    fog: '#221838',
    fogDensity: 0.07,
    moteColor: '#e6cf9a',
    moteCount: 480,
    moteSpeed: 0.07,
    moteSize: 9,
    shaft: '#d8b56a',
    shaftStrength: 0.6,
    grain: 0.05,
    vignette: 0.55,
    key: '#c9a24a',
    fill: '#2b1b3d',
  }),
  crypt: M({
    id: 'crypt',
    label: 'below',
    skyTop: '#04060a',
    skyBottom: '#0f1420',
    horizon: '#1c2436',
    fog: '#080c14',
    fogDensity: 0.19,
    moteColor: '#9fb6d8',
    moteCount: 380,
    moteSpeed: 0.03,
    moteSize: 7,
    shaft: '#6b86ad',
    shaftStrength: 0.2,
    grain: 0.1,
    vignette: 0.82,
    key: '#7d95b8',
    fill: '#0c111c',
  }),
  chapel: M({
    id: 'chapel',
    label: 'the chapel',
    skyTop: '#0d0c16',
    skyBottom: '#26243a',
    horizon: '#5c5480',
    fog: '#191828',
    fogDensity: 0.11,
    moteColor: '#f4e2b0',
    moteCount: 560,
    moteSpeed: 0.045,
    moteSize: 10,
    shaft: '#f0d68a',
    shaftStrength: 0.95,
    grain: 0.05,
    vignette: 0.6,
    key: '#dcc07a',
    fill: '#221f36',
  }),
  wood: M({
    id: 'wood',
    label: 'under the thorns',
    skyTop: '#0b1410',
    skyBottom: '#1d3324',
    horizon: '#3f5c3a',
    fog: '#152218',
    fogDensity: 0.15,
    moteColor: '#c8e8b0',
    moteCount: 760,
    moteSpeed: 0.09,
    moteSize: 10,
    shaft: '#9ad080',
    shaftStrength: 0.45,
    grain: 0.06,
    vignette: 0.66,
    key: '#93bd7d',
    fill: '#1a2c1f',
  }),
}

export const moodOf = (id: MoodId): Mood => MOODS[id] ?? MOODS.dusk
