import type { SigilId } from '../data/types'

/**
 * Standing in for portraits. Each one is a heraldic mark rather than a picture,
 * which is on theme and does not look like a missing asset. Swap the plate for
 * an <img> when there are real portraits and keep the sigil as a watermark.
 */
const P: Record<SigilId, string> = {
  kneel: 'M32 6 L32 30 M20 30 L44 30 M24 30 L20 56 M40 30 L44 56 M26 44 L38 44',
  rat: 'M14 40 a12 12 0 1 1 24 0 a12 12 0 1 1 -24 0 M38 34 L52 22 M52 22 l-2 8 M52 22 l-8 2 M20 34 a3 3 0 1 0 0.1 0',
  stair: 'M10 54 L22 54 L22 44 L34 44 L34 34 L46 34 L46 24 L58 24 M10 54 L10 60 L58 60 L58 24',
  moon: 'M40 10 a24 24 0 1 0 0 44 a19 19 0 1 1 0 -44 Z M14 20 l4 4 M50 46 l4 4',
  thorn: 'M32 60 L32 8 M32 20 l12 -8 M32 20 l-12 -8 M32 34 l14 -6 M32 34 l-14 -6 M32 48 l10 -5 M32 48 l-10 -5',
  prayer: 'M32 8 L32 40 M22 20 L42 20 M24 56 c4 -14 12 -14 16 0 M28 48 l8 0',
  hourglass: 'M18 8 L46 8 L32 32 L46 56 L18 56 L32 32 Z M18 8 L46 8 M18 56 L46 56 M32 32 l0 8',
  harness: 'M32 8 a14 14 0 0 1 14 14 v6 h-28 v-6 a14 14 0 0 1 14 -14 Z M20 30 l-6 26 M44 30 l6 26 M24 22 h16',
  creak: 'M8 44 L24 44 L24 32 L40 32 L40 20 L56 20 M12 52 q6 6 12 0 q6 -6 12 0 q6 6 12 0',
  mirror: 'M32 6 a16 26 0 1 1 -0.1 0 Z M20 52 h24 M26 52 l-2 8 h16 l-2 -8 M26 18 q6 -6 12 0',
  hearth: 'M8 34 L32 12 L56 34 M14 34 v22 h36 v-22 M26 56 v-12 h12 v12 M32 26 l0 6',
  debt: 'M32 8 v48 M20 18 q12 -8 24 0 M20 46 q12 8 24 0 M14 32 h36',
  bone: 'M14 20 a6 6 0 1 1 8 8 L42 44 a6 6 0 1 1 -8 8 M22 14 a6 6 0 1 1 -8 8 M50 42 a6 6 0 1 1 -8 8',
  skin: 'M32 6 c14 8 18 26 12 40 c-4 10 -20 10 -24 0 c-6 -14 -2 -32 12 -40 Z M24 26 a2 2 0 1 0 0.1 0 M40 26 a2 2 0 1 0 0.1 0',
  bell: 'M32 8 a16 16 0 0 1 16 16 v18 h6 v6 h-44 v-6 h6 v-18 a16 16 0 0 1 16 -16 Z M28 54 a4 4 0 0 0 8 0',
  reed: 'M18 60 q2 -34 8 -50 M32 60 q0 -38 2 -52 M46 60 q-2 -32 -8 -46 M26 22 l6 4 M34 14 l6 5',
  lamp: 'M32 10 v6 M20 16 h24 l-4 10 h-16 Z M24 26 v18 a8 8 0 0 0 16 0 v-18 M28 52 h8 v6 h-8 Z',
  blade: 'M32 4 L38 22 L38 46 L32 54 L26 46 L26 22 Z M18 46 h28 M32 54 v8 M28 62 h8',
  wolf: 'M12 22 L20 6 L28 20 M52 22 L44 6 L36 20 M12 22 q-2 22 20 34 q22 -12 20 -34 M24 30 a2 2 0 1 0 0.1 0 M40 30 a2 2 0 1 0 0.1 0 M32 42 l0 4',
  twin: 'M22 22 a10 10 0 1 1 0.1 0 M42 22 a10 10 0 1 1 0.1 0 M10 58 q12 -18 24 0 M30 58 q12 -18 24 0',
  moth: 'M32 14 v34 M32 14 l-6 -8 M32 14 l6 -8 M32 22 c-20 -14 -26 8 -14 18 c6 5 10 4 14 0 M32 22 c20 -14 26 8 14 18 c-6 5 -10 4 -14 0',
}

export function Sigil({ id, color }: { id: SigilId; color: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <g
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.95}
      >
        <path d={P[id] ?? P.thorn} />
      </g>
      <circle cx="32" cy="32" r="29" stroke={color} strokeWidth={0.6} opacity={0.3} />
      <circle cx="32" cy="32" r="24" stroke={color} strokeWidth={0.4} opacity={0.16} />
    </svg>
  )
}
