import { Atmosphere } from './atmosphere/Atmosphere'
import type { MoodId } from './atmosphere/moods'
import { regionOf, useGame } from './state/store'
import { WorldScreen } from './screens/WorldScreen'
import { MeetScreen } from './screens/MeetScreen'
import { PeopleScreen } from './screens/PeopleScreen'
import { SceneScreen } from './screens/SceneScreen'
import { AboutScreen } from './screens/AboutScreen'
import { ReleaseScreen } from './screens/ReleaseScreen'
import { Gold } from './ui/GoldText'

const NIGHTLY: Partial<Record<MoodId, MoodId>> = { day: 'night', dawn: 'night', dusk: 'night' }

export default function App() {
  const { screen, region, day, house, go, pref, setPref, isNight } = useGame()
  const base = regionOf(region).mood
  const mood: MoodId = isNight() ? (NIGHTLY[base] ?? base) : base

  // nav follows what you actually do: go out, meet, then tend
  const onWorld = screen === 'world' || screen === 'meet'
  const onPeople =
    screen === 'people' || screen === 'scene' || screen === 'about' || screen === 'release'

  return (
    <>
      <Atmosphere mood={mood} />
      <div className="app">
        <header className="topbar">
          <Gold className="brand" quiet>
            Yes M’lady
          </Gold>

          <nav className="nav">
            <button className={onWorld ? '-on' : ''} onClick={() => go('world')}>
              Go out
            </button>
            <button className={onPeople ? '-on' : ''} onClick={() => go('people')}>
              Your people{house.length ? ` (${house.length})` : ''}
            </button>
          </nav>

          <div className="meta">
            <div>
              <span className="eyebrow">Day</span> <b>{day}</b>
            </div>
            <label className="pref">
              <span className="eyebrow">Drawn to</span>
              <select value={pref} onChange={(e) => setPref(e.target.value as any)}>
                <option value="masc">masculine</option>
                <option value="femme">feminine</option>
                <option value="androgynous">androgynous</option>
                <option value="everyone">everyone</option>
              </select>
            </label>
          </div>
        </header>

        <main className="stage">
          {screen === 'world' && <WorldScreen />}
          {screen === 'meet' && <MeetScreen />}
          {screen === 'people' && <PeopleScreen />}
          {screen === 'scene' && <SceneScreen />}
          {screen === 'about' && <AboutScreen />}
          {screen === 'release' && <ReleaseScreen />}
        </main>
      </div>
    </>
  )
}
