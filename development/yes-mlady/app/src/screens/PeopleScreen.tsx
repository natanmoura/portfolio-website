import { charOf, shapeOf, tierOf, useGame } from '../state/store'
import { Sigil } from '../ui/Sigil'
import { Gold } from '../ui/GoldText'

export function PeopleScreen() {
  const { house, day, region, isNight, open, go } = useGame()

  return (
    <div className="wrap screen-in">
      <div className="row spread" style={{ alignItems: 'flex-end', marginBottom: 6 }}>
        <div>
          <div className="eyebrow">Staying with you</div>
          <Gold as="h2" style={{ fontSize: 36, margin: '4px 0 0' }}>
            {house.length ? `${house.length} of them` : 'Nobody yet'}
          </Gold>
        </div>
        <button className="btn" onClick={() => go('world')}>
          <span>Go out and find someone</span>
        </button>
      </div>
      <p className="lead" style={{ marginTop: 0 }}>
        {house.length
          ? 'Keep as many as you like. Nobody drifts away if you leave them, they simply do not get any closer.'
          : 'Walk somewhere and see who is there.'}
      </p>

      <div className="people-grid">
        {house.map((k) => {
          const c = charOf(k.id)
          const shape = shapeOf(c, day, region, isNight())
          const tier = tierOf(k.closeness)
          return (
            <button
              key={k.id}
              className="person"
              style={{ ['--key' as any]: c.hue }}
              onClick={() => open(k.id)}
            >
              <div className="person-face">
                <Sigil id={c.sigil} color={c.hue} />
              </div>
              <div className="person-body">
                <b>{shape.name}</b>
                <p>{c.who}</p>
                <div className="meter">
                  <i style={{ width: `${k.closeness}%` }} />
                </div>
                <div className="row spread" style={{ marginTop: 6 }}>
                  <em className="serif" style={{ color: 'var(--gold-400)', fontSize: 14 }}>
                    {tier.name}
                  </em>
                  {shape.shifted && <span className="tag -warn">not themselves today</span>}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
