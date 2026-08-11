import { useEffect, useRef, useState } from 'react'
import { Gold } from './GoldText'
import { Sigil } from './Sigil'
import type { Character, Kind } from '../data/types'
import { shapeOf } from '../state/store'

const KIND_LABEL: Record<Kind, string> = {
  person: 'person',
  beast: 'beast',
  object: 'a made thing, awake',
  spirit: 'spirit',
  bound: 'bound to a vessel',
  revenant: 'revenant',
}

type Spring = { x: number; y: number; vx: number; vy: number }

/**
 * Layered in z, tilts to the pointer, and can be thrown around. The layers are
 * real translateZ rather than a fake parallax, so the depth holds up when you
 * drag it past forty degrees.
 */
export function CharacterCard({
  char,
  day,
  region,
  isNight,
  veiled = true,
  onClick,
}: {
  char: Character
  day: number
  region: any
  isNight: boolean
  veiled?: boolean
  onClick?: () => void
}) {
  const stage = useRef<HTMLDivElement>(null)
  const el = useRef<HTMLDivElement>(null)
  const rot = useRef<Spring>({ x: 0, y: 0, vx: 0, vy: 0 })
  const drag = useRef<{ on: boolean; ox: number; oy: number; dx: number; dy: number }>({
    on: false,
    ox: 0,
    oy: 0,
    dx: 0,
    dy: 0,
  })
  const target = useRef({ x: 0, y: 0 })
  const [lifted, setLifted] = useState(false)

  const shape = shapeOf(char, day, region, isNight)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const s = rot.current
      const k = drag.current.on ? 0.32 : 0.11
      const damp = drag.current.on ? 0.55 : 0.78
      s.vx = (s.vx + (target.current.x - s.x) * k) * damp
      s.vy = (s.vy + (target.current.y - s.y) * k) * damp
      s.x += s.vx
      s.y += s.vy
      const node = el.current
      if (node) {
        const d = drag.current
        node.style.transform =
          `translate3d(${d.dx}px, ${d.dy}px, 0) ` +
          `rotateX(${s.x.toFixed(3)}deg) rotateY(${s.y.toFixed(3)}deg) ` +
          `scale(${d.on ? 1.045 : 1})`
        node.style.setProperty('--rim', `${120 + s.y * 3}deg`)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onMove = (e: React.PointerEvent) => {
    const box = stage.current?.getBoundingClientRect()
    if (!box) return
    const px = (e.clientX - box.left) / box.width
    const py = (e.clientY - box.top) / box.height
    target.current = { x: (0.5 - py) * 22, y: (px - 0.5) * 26 }
    const node = el.current
    if (node) {
      node.style.setProperty('--mx', `${px * 100}%`)
      node.style.setProperty('--my', `${py * 100}%`)
    }
    if (drag.current.on) {
      drag.current.dx = e.clientX - drag.current.ox
      drag.current.dy = e.clientY - drag.current.oy
    }
  }

  const onDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { on: true, ox: e.clientX, oy: e.clientY, dx: drag.current.dx, dy: drag.current.dy }
    drag.current.ox = e.clientX - drag.current.dx
    drag.current.oy = e.clientY - drag.current.dy
    setLifted(true)
  }

  const release = () => {
    drag.current.on = false
    setLifted(false)
    // spring the card back to where it belongs
    const start = performance.now()
    const sx = drag.current.dx
    const sy = drag.current.dy
    const ease = (t: number) => 1 - Math.pow(1 - t, 4)
    const back = (now: number) => {
      const t = Math.min(1, (now - start) / 620)
      drag.current.dx = sx * (1 - ease(t))
      drag.current.dy = sy * (1 - ease(t))
      if (t < 1) requestAnimationFrame(back)
    }
    requestAnimationFrame(back)
  }

  const onLeave = () => {
    target.current = { x: 0, y: 0 }
    if (drag.current.on) release()
  }

  return (
    <div
      className="card-stage"
      ref={stage}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerDown={onDown}
      onPointerUp={release}
    >
      <div
        className="card"
        ref={el}
        style={{ ['--key' as any]: char.hue, zIndex: lifted ? 20 : 1 }}
        onClick={onClick}
      >
        <div className="card-shadow" />
        <div className="card-frame" />

        <div className="card-plate">
          <div className="card-sigil">
            <Sigil id={char.sigil} color={char.hue} />
          </div>
        </div>
        <div className="card-kind">
          {KIND_LABEL[char.kind]}
          {shape.form && shape.form.trigger.kind !== 'default' ? ' · shifted' : ''}
        </div>

        <div className="card-text">
          <Gold className="card-name">{shape.name}</Gold>
          <div className="card-epi">{char.epithet}</div>
          <div className="card-line">{veiled ? char.card : shape.presents}</div>
        </div>

        <div className="card-foot">
          <div>
            <div className="eyebrow">station</div>
            <b>{char.station}</b>
          </div>
        </div>

        <div className="card-rim" />
        <div className="card-gloss" />
      </div>
    </div>
  )
}
