import { charOf, factsFor, shapeOf, tierOf, useGame } from '../state/store'
import { cultureOf } from '../data/cultures'
import { quirksOf } from '../data/quirks'
import { CharacterCard } from '../ui/CharacterCard'
import { Gold } from '../ui/GoldText'

/**
 * Everything you know, and a visible count of everything you do not. The locked
 * facts are the point: you can see how many there are and roughly what kind of
 * thing they are, which is what makes closeness worth spending time on.
 */
export function AboutScreen() {
  const { house, active, day, region, isNight, ledgers, changes, go, beginRelease } = useGame()
  const k = house.find((x) => x.id === active)
  if (!k) return null

  const c = charOf(k.id)
  const quirks = quirksOf(c.id)
  const mine = changes[c.id] ?? []
  const shape = shapeOf(c, day, region, isNight())
  const facts = factsFor(c)
  const led = ledgers[c.id]
  const culture = cultureOf(c.culture)
  const tier = tierOf(k.closeness)

  return (
    <div className="wrap screen-in">
      <div className="row spread" style={{ marginBottom: 18 }}>
        <button className="btn -ghost" onClick={() => go('scene')}>
          <span>← Back to them</span>
        </button>
        <button className="btn -ember" onClick={beginRelease}>
          <span>Let them go</span>
        </button>
      </div>

      <div className="about-cols">
        <div className="stack">
          <CharacterCard char={c} day={day} region={region} isNight={isNight()} veiled={false} />
        </div>

        <div className="stack">
          <div>
            <Gold as="h2" style={{ fontSize: 30, margin: 0 }}>
              {shape.name}
            </Gold>
            <p className="lead">{c.who}</p>
          </div>

          <div className="plate panel">
            <h3>How close you are</h3>
            <div className="meter -big">
              <i style={{ width: `${k.closeness}%` }} />
            </div>
            <div className="row spread" style={{ marginTop: 8 }}>
              <b className="serif" style={{ color: 'var(--gold-500)', fontSize: 18 }}>
                {tier.name}
              </b>
              <span className="faint">{k.closeness} of 100</span>
            </div>
            <p style={{ fontSize: 16, marginTop: 10 }}>{tier.hint}</p>
          </div>

          <div className="plate panel">
            <h3>
              What you know · {k.learned.length} of {facts.length}
            </h3>
            <div className="stack" style={{ gap: 10 }}>
              {facts.map((f, i) => {
                const got = k.learned.includes(i)
                return (
                  <div key={i} className={`fact ${got ? '-open' : ''}`}>
                    <div className="fact-head">
                      <b>{f.label}</b>
                      {!got && <span className="faint">needs {f.at} closeness</span>}
                    </div>
                    <p className={got ? '' : 'blurred'}>
                      {got ? f.text : 'They have not told you this yet.'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="plate panel">
            <h3>Before you met them</h3>
            <p style={{ fontSize: 16 }}>{c.flaw}</p>
            <div className="stats" style={{ marginTop: 14 }}>
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
            <p className="faint" style={{ fontSize: 14, marginTop: 12 }}>
              These are the only numbers strangers can see. What the people before you did to them
              is not public.
            </p>
          </div>

          <div className="plate panel">
            <h3>What they do</h3>
            <p className="faint" style={{ fontSize: 14, marginTop: -4 }}>
              When you let them go you may change one of these. One only.
            </p>
            <div className="stack" style={{ gap: 9, marginTop: 12 }}>
              {quirks.map((q) => (
                <div key={q.id} className="quirk">
                  <b>{q.name}</b>
                  <p>{q.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {!!k.memories.length && (
            <div className="plate panel">
              <h3>What they remember about you</h3>
              <ul className="mems">
                {k.memories.map((m, i) => (
                  <li key={i}>
                    {m.text}
                    <em>day {m.day}</em>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!!mine.length && (
            <div className="plate panel">
              <h3>What has already been changed in them</h3>
              <div className="stack" style={{ gap: 9 }}>
                {mine.map((ch, i) => (
                  <div key={i} className="quirk -changed">
                    <b>{ch.quirk}</b>
                    <p>{ch.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="plate panel">
            <h3>Where they are from · {culture.name}</h3>
            <p style={{ fontSize: 16 }}>{culture.blurb}</p>
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

          {c.vessel && (
            <div className="plate panel">
              <h3>They live in a thing</h3>
              <p style={{ fontSize: 16 }}>
                {c.vessel.object}. You {c.vessel.handle} it. {c.vessel.note}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
