import { useEffect, useRef, useState } from 'react'
import { SCENES, hasMoreLater, sceneFor } from '../data/scenes'
import { charOf, factsFor, shapeOf, useGame } from '../state/store'
import { Sigil } from '../ui/Sigil'
import { Typewriter } from '../ui/Typewriter'
import { Gold } from '../ui/GoldText'

/**
 * The only thing on this screen is the conversation. Card, stats, history and
 * facts all live one tap away on the About page, because the moment you put
 * them beside the dialogue people read the meters instead of the person.
 */
export function SceneScreen() {
  const { house, active, day, region, isNight, choose, nextScene, go, beginRelease } = useGame()
  const k = house.find((x) => x.id === active)
  const [typed, setTyped] = useState(false)
  const feed = useRef<HTMLDivElement>(null)

  const last = k?.transcript.length ?? 0
  useEffect(() => {
    setTyped(false)
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: 'smooth' })
  }, [last])

  if (!k) return null
  const c = charOf(k.id)
  const shape = shapeOf(c, day, region, isNight())
  const scene = (SCENES[c.id] ?? []).find((s) => s.id === k.sceneId)
  const beat = scene && k.beat >= 0 ? scene.beats[k.beat] : null
  const facts = factsFor(c)
  const next = facts.find((f) => k.closeness < f.at)
  const over = k.beat < 0
  const more = !!sceneFor(c, k.closeness, k.scenesDone)
  const later = hasMoreLater(c, k.closeness)

  return (
    <div className="focus screen-in">
      {/* who you are with. small, fixed, never competes with the text. */}
      <header className="whobar">
        <div className="whobar-face" style={{ ['--key' as any]: c.hue }}>
          <Sigil id={c.sigil} color={c.hue} />
        </div>
        <div className="whobar-name">
          <Gold still>{shape.name}</Gold>
          <p>{c.who}</p>
        </div>
        <div className="whobar-meter">
          <div className="meter-top">
            <span>Closeness</span>
            <b>{Math.round(k.closeness)}</b>
          </div>
          {/* ticks show exactly where the next thing they tell you sits */}
          <div className="meter">
            <i style={{ width: `${k.closeness}%` }} />
            {facts.map((f, i) => (
              <u
                key={i}
                className={k.closeness >= f.at ? '-passed' : ''}
                style={{ left: `${f.at}%` }}
              />
            ))}
          </div>
          <em>
            {next
              ? `${Math.ceil(next.at - k.closeness)} more and they tell you something`
              : 'They have told you everything'}
          </em>
        </div>
        <button className="btn -ghost" onClick={() => go('about')}>
          <span>About them</span>
        </button>
      </header>

      {shape.note && <div className="banner">{shape.note}</div>}

      {/* the conversation */}
      <div className="feed" ref={feed}>
        {k.transcript.map((l, i) => {
          const isLast = i === k.transcript.length - 1
          if (l.kind === 'you') return <div key={i} className="line -you">{l.text}</div>
          if (!isLast) return <div key={i} className={`line -${l.kind}`}>{l.text}</div>
          return (
            <Typewriter
              key={i}
              text={l.text}
              className={`line -${l.kind}`}
              onDone={() => setTyped(true)}
            />
          )
        })}

        {/* everything you gained, in one lump, at the end. never per choice. */}
        {typed && over && k.gain > 0 && (
          <div className="tally">
            <div className="tally-row">
              <span>Closeness</span>
              <b>+{Math.round(k.gain)}</b>
            </div>
            {!!k.memories.length && (
              <div className="tally-row -mem">
                <span>They will remember</span>
                <em>{k.memories[k.memories.length - 1].text}</em>
              </div>
            )}
          </div>
        )}

        {typed &&
          k.revealing.map((i) => (
            <div className="learned" key={i}>
              <span className="eyebrow">They let something slip</span>
              <b>{facts[i].label}</b>
              <p>{facts[i].text}</p>
            </div>
          ))}
      </div>

      {/* what you can do */}
      <footer className="choices" style={{ opacity: typed ? 1 : 0.2, pointerEvents: typed ? 'auto' : 'none' }}>
        {beat ? (
          beat.choices.map((ch, i) => (
            <button key={i} className="choice" onClick={() => choose(i)}>
              <span>{ch.label}</span>
            </button>
          ))
        ) : (
          <>
            {more ? (
              <button className="choice -on" onClick={nextScene}>
                <span>Stay with them a while longer</span>
              </button>
            ) : (
              <div className="spent">
                {later
                  ? 'There is nothing more tonight. They will open up again when you are closer.'
                  : 'You have had every evening this one has to give.'}
              </div>
            )}
            <button className="choice -quiet" onClick={() => go('people')}>
              <span>Leave it there for now</span>
            </button>
            <button className="choice -quiet -let" onClick={beginRelease}>
              <span>Let them go, and change one thing</span>
            </button>
          </>
        )}
      </footer>
    </div>
  )
}
