import { useState } from 'react'
import { charOf, tierOf, useGame } from '../state/store'
import { quirksOf } from '../data/quirks'
import { Typewriter } from '../ui/Typewriter'
import { Gold } from '../ui/GoldText'
import { Sigil } from '../ui/Sigil'

/**
 * The one thing you get to change. Deliberately slow, deliberately one screen at
 * a time, and the words never change. Only the delivery does.
 */

/** How they said it. Drawn from how well you knew them. */
function delivery(closeness: number, seed: number): string {
  const cold = [
    'Flat, and fast, and already half turned toward the road.',
    'He said it the way a man agrees to be hanged.',
    'To the floor. The floor has heard it before.',
  ]
  const warm = [
    'Too fast. They had been waiting to be asked for something.',
    'Through the teeth, and then again, softer, as though the first one had not counted.',
    'Quietly, and then they stood there a moment longer than the words required.',
  ]
  const known = [
    'They said it looking straight at you, which nobody has managed before, and it took something out of them.',
    'They got halfway through it and had to start again.',
    'It came out wrong. Too quiet. And they heard it come out wrong.',
  ]
  const pool = closeness >= 70 ? known : closeness >= 35 ? warm : cold
  return pool[seed % pool.length]
}

export function ReleaseScreen() {
  const { house, active, releaseResult, commitRelease, finishRelease, go, day } = useGame()
  const [picked, setPicked] = useState<string | null>(null)
  const [stage, setStage] = useState<'pick' | 'flinch' | 'said' | 'after'>('pick')

  const k = house.find((x) => x.id === active)
  if (!k) return null
  const c = charOf(k.id)
  const quirks = quirksOf(c.id)
  const tier = tierOf(k.closeness)

  const say = () => {
    commitRelease(picked!)
    setStage('flinch')
    setTimeout(() => setStage('said'), 1900)
  }

  return (
    <div className="focus screen-in rite">
      {stage === 'pick' && (
        <>
          <header className="rite-head">
            <div className="whobar-face" style={{ ['--key' as any]: c.hue }}>
              <Sigil id={c.sigil} color={c.hue} />
            </div>
            <div>
              <div className="eyebrow">Letting them go</div>
              <Gold as="h2" style={{ fontSize: 30, margin: '4px 0 0' }}>
                {c.name}
              </Gold>
              <p className="dim serif" style={{ margin: '4px 0 0', fontSize: 16 }}>
                {Math.max(1, day - k.metOn)} days. {tier.name}.
              </p>
            </div>
          </header>

          <p className="rite-rule">
            You may change <b>one thing</b>. They are bound to try. They are not bound to manage it,
            and the better you knew them the better their chances.
          </p>

          <div className="choices">
            {quirks.map((q) => (
              <button
                key={q.id}
                className={`choice ${picked === q.id ? '-on' : ''}`}
                onClick={() => setPicked(q.id)}
              >
                <span>{q.name}</span>
                <em>{q.detail}</em>
              </button>
            ))}
          </div>

          <footer className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn -ghost" onClick={() => go('scene')}>
              <span>Not yet</span>
            </button>
            <button className="btn -ember" disabled={!picked} onClick={say}>
              <span>Ask it of them</span>
            </button>
          </footer>
        </>
      )}

      {stage === 'flinch' && (
        <div className="rite-centre">
          <div className="flinch">
            <p>They heard it.</p>
            <p className="faint">Something went across their face and did not finish.</p>
          </div>
        </div>
      )}

      {stage === 'said' && releaseResult && (
        <div className="rite-centre">
          <Gold as="h2" className="oath">
            Yes, m’lady.
          </Gold>
          <Typewriter
            text={delivery(k.closeness, c.id.length + day)}
            className="line -narrator"
            startDelay={700}
            onDone={() => setStage('after')}
          />
        </div>
      )}

      {stage === 'after' && releaseResult && (
        <div className="rite-centre -after">
          <Gold as="h2" className="oath -small">
            Yes, m’lady.
          </Gold>

          <div className="outcome">
            <span className="eyebrow">
              {releaseResult.change.outcome === 'took' ? 'It took' : 'They tried'}
            </span>
            <b>{releaseResult.change.quirk}</b>
            <p>{releaseResult.change.text}</p>
          </div>

          {!!releaseResult.memories.length && (
            <div className="carry">
              <span className="eyebrow">They carry this out with them</span>
              <ul>
                {releaseResult.memories.slice(-4).map((m, i) => (
                  <li key={i}>{m.text}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="faint serif" style={{ fontSize: 15 }}>
            You will not be told whether it settles. The next person will see it before you do.
          </p>

          <button className="btn -wide" onClick={finishRelease}>
            <span>Let them go</span>
          </button>
        </div>
      )}
    </div>
  )
}
