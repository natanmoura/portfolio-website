import { useMemo } from 'react'
import { CHARACTERS, REGIONS, charOf, regionOf, useGame } from '../state/store'
import { cultureOf } from '../data/cultures'
import { Sigil } from '../ui/Sigil'
import { Gold } from '../ui/GoldText'

const REGION_CULTURE: Record<string, any> = {
  marrow: 'rowfolk',
  lowfield: 'fieldborn',
  ashcombe: 'ashcombe',
  palestair: 'stairhold',
  thornmarch: 'thornsworn',
  reeds: 'reedkin',
  kingsmoot: 'moot',
  longroad: 'roadless',
}

const HAPPENINGS: ((n: string) => string)[] = [
  (n) => `${n} was poisoned and is lying up by the road.`,
  (n) => `${n} took a bad wound at the crossing.`,
  (n) => `${n} has come into money and cannot say how.`,
  (n) => `${n} lost everything in an afternoon.`,
  (n) => `Something has been bound in ${n}. It is still in there.`,
  (n) => `They are saying things about ${n} in the market.`,
  (n) => `${n} has taken service in a house that does not deserve it.`,
  (n) => `${n} is sitting up with the dying and has not slept.`,
]

export function WorldScreen() {
  const { day, region, house, travel, wander, seek } = useGame()
  const held = useMemo(() => new Set(house.map((h) => h.id)), [house])
  const here = regionOf(region)
  const culture = cultureOf(REGION_CULTURE[region])

  // three things happening, each attached to a real person you can go to
  const happenings = useMemo(() => {
    const free = CHARACTERS.filter((c) => !held.has(c.id))
    return [0, 1, 2]
      .map((i) => {
        const c = free[(day * 5 + i * 7) % free.length]
        if (!c) return null
        return {
          id: c.id,
          region: c.home[(day + i) % c.home.length],
          line: HAPPENINGS[(day * 3 + i * 4 + c.id.length) % HAPPENINGS.length](c.name),
        }
      })
      .filter(Boolean) as { id: string; region: string; line: string }[]
  }, [day, held])

  return (
    <div className="wrap screen-in">
      <div className="world-cols">
        <div>
          <div className="eyebrow">You are at</div>
          <Gold as="h2" style={{ fontSize: 36, margin: '4px 0 2px' }}>
            {here.name}
          </Gold>
          <p className="lead" style={{ marginTop: 0 }}>
            {here.blurb}
          </p>

          <div className="map">
            <div className="map-grain" />
            {REGIONS.map((r) => (
              <div
                key={r.id}
                className={`pin ${r.id === region ? '-here' : ''}`}
                style={{ left: `${r.x}%`, top: `${r.y}%` }}
              >
                <button onClick={() => travel(r.id)} aria-label={r.name} />
                <label>{r.name}</label>
              </div>
            ))}
          </div>

          <button className="btn -wide" onClick={wander} style={{ marginTop: 18 }}>
            <span>Walk here and see who you meet</span>
          </button>
        </div>

        <aside className="stack">
          <div className="plate panel">
            <h3>Happening now</h3>
            <p className="faint" style={{ fontSize: 14, marginTop: -4 }}>
              Go to any of these and you will find them.
            </p>
            <div className="stack" style={{ gap: 8, marginTop: 10 }}>
              {happenings.map((h) => {
                const c = charOf(h.id)
                return (
                  <button
                    key={h.id}
                    className="happening"
                    style={{ ['--key' as any]: c.hue }}
                    onClick={() => {
                      travel(h.region as any)
                      seek(h.id)
                    }}
                  >
                    <div className="happening-face">
                      <Sigil id={c.sigil} color={c.hue} />
                    </div>
                    <div>
                      <b>{h.line}</b>
                      <em>{regionOf(h.region).name}</em>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="plate panel">
            <h3>{culture.name}</h3>
            <p style={{ fontSize: 15.5 }}>{culture.blurb}</p>
            <hr className="rule" />
            <div className="kv">
              <span>Forward here</span>
              <div>{culture.forward}</div>
              <span>Tender here</span>
              <div>{culture.tender}</div>
              <span>Silence means</span>
              <div className="ember">{culture.silence}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
