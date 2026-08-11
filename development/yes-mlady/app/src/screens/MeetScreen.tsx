import { useMemo, useState } from 'react'
import { charOf, ledgersSafe, regionOf, shapeOf, useGame } from '../state/store'
import { CharacterCard } from '../ui/CharacterCard'
import { Typewriter } from '../ui/Typewriter'
import { Gold } from '../ui/GoldText'

const OPENERS: Record<string, string> = {
  longroad: 'The fire was already going when you reached it, and somebody had left room on the good side.',
  marrow: 'The Row at this hour is all doorways and arrangements. One of the doorways is occupied.',
  reeds: 'Green light, no horizon, and something standing very still in the water.',
  ashcombe: 'A door in a burned house opened, correctly, on hinges that should not still exist.',
  kingsmoot: 'A room of people saying two things at once, and one person in it saying neither.',
  palestair: 'Ninety two steps down. The door was answered before you had finished knocking.',
  thornmarch: 'Take nothing, accept nothing. Something in the trees knows you have been told that.',
  lowfield: 'Barley to the knee, and somebody standing in it who is not working.',
}

export function MeetScreen() {
  const { meeting, region, day, isNight, take, passOn, house } = useGame()
  const [done, setDone] = useState(false)
  const c = meeting ? charOf(meeting) : null

  const intro = useMemo(() => {
    if (!c) return ''
    return `${OPENERS[region] ?? OPENERS.longroad} ${shapeOf(c, day, region, isNight()).presents}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id, region, day])

  if (!c) return null
  const led = ledgersSafe(c.id)
  const full = house.length >= 10

  return (
    <div className="focus screen-in">
      <div className="meet">
        <CharacterCard char={c} day={day} region={region} isNight={isNight()} veiled />

        <div className="stack">
          <div>
            <div className="eyebrow">{regionOf(region).name}</div>
            <Gold as="h2" style={{ fontSize: 32, margin: '4px 0 0' }}>
              {c.name}
            </Gold>
            <div className="dim serif" style={{ fontStyle: 'italic', fontSize: 18 }}>
              {c.epithet}
            </div>
          </div>

          <p className="lead">{c.who}</p>

          <Typewriter text={intro} className="line -narrator" onDone={() => setDone(true)} />

          <div className="stats">
            <div className="stat">
              <b>{led.kept}</b>
              <span>taken in</span>
            </div>
            <div className="stat">
              <b>{led.passed}</b>
              <span>walked past</span>
            </div>
            <div className="stat">
              <b>{led.longest}</b>
              <span>longest stay</span>
            </div>
          </div>
          <p className="faint" style={{ fontSize: 14, marginTop: -4 }}>
            All you get to see of a stranger. What happened in those stays is theirs.
          </p>

          <div className="choices" style={{ opacity: done ? 1 : 0.2, pointerEvents: done ? 'auto' : 'none' }}>
            <button className="choice -on" disabled={full} onClick={() => take(c.id)}>
              <span>{full ? 'You have too many already' : 'Take them in'}</span>
            </button>
            <button className="choice -quiet" onClick={() => passOn(c.id)}>
              <span>Walk on</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
