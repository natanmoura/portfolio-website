import type { Region } from './types'

export const REGIONS: Region[] = [
  {
    id: 'marrow',
    name: 'Marrow Row',
    sub: 'the low city',
    mood: 'night',
    x: 30,
    y: 62,
    blurb:
      'Nine streets of leaning houses and one gutter that runs downhill through all of them. Everything here is for sale and most of it has been sold twice.',
  },
  {
    id: 'lowfield',
    name: 'The Low Field',
    sub: 'tenant country',
    mood: 'dawn',
    x: 18,
    y: 34,
    blurb:
      'Wet ground worked by people who will never own it. Good barley. Bad landlords. The moon gets a wide view out here and takes it.',
  },
  {
    id: 'ashcombe',
    name: 'Ashcombe',
    sub: 'the burned house',
    mood: 'dusk',
    x: 52,
    y: 22,
    blurb:
      'A great house with its roof gone and its mirrors intact. Nobody agrees on what happened. Everybody agrees not to stay past dark.',
  },
  {
    id: 'palestair',
    name: 'The Pale Stair',
    sub: 'below the chapel',
    mood: 'crypt',
    x: 68,
    y: 44,
    blurb:
      'Ninety two steps down, and a door at the bottom that is always answered. The count is disputed. He insists it is ninety two.',
  },
  {
    id: 'thornmarch',
    name: 'Thornmarch',
    sub: 'the owed wood',
    mood: 'wood',
    x: 80,
    y: 24,
    blurb:
      'Take nothing. Accept nothing. If you are given something, you are already in it, and the wood keeps very good accounts.',
  },
  {
    id: 'reeds',
    name: 'The Reeds',
    sub: 'standing water',
    mood: 'swamp',
    x: 62,
    y: 74,
    blurb:
      'Green light and no horizon. Things are preserved out here rather than buried, and some of them have opinions about that.',
  },
  {
    id: 'kingsmoot',
    name: 'Kingsmoot',
    sub: 'the seat',
    mood: 'court',
    x: 40,
    y: 12,
    blurb:
      'Gold leaf over rot, and everyone can smell it, and it is very bad manners to mention the smell.',
  },
  {
    id: 'longroad',
    name: 'The Long Road',
    sub: 'between everywhere',
    mood: 'campfire',
    x: 46,
    y: 48,
    blurb:
      'Two days of nothing in either direction. People tell the truth on this road because there is nobody here to hold them to it.',
  },
]

export const regionOf = (id: string) => REGIONS.find((r) => r.id === id) ?? REGIONS[0]
