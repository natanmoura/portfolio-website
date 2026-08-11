import { useEffect, useRef, useState } from 'react'

const BASE = 17 // ms per character

/** Punctuation buys a pause. This is most of what makes it feel spoken. */
function pauseAfter(ch: string, next: string): number {
  if (ch === '.' && next !== '.') return 420
  if (ch === '?' || ch === '!') return 400
  if (ch === ',') return 190
  if (ch === ';' || ch === ':') return 240
  if (ch === '\n') return 320
  if (ch === '—' || ch === '…') return 300
  return 0
}

export function Typewriter({
  text,
  className = '',
  startDelay = 0,
  onDone,
  skipSignal = 0,
}: {
  text: string
  className?: string
  startDelay?: number
  onDone?: () => void
  /** bump this to force the line to complete */
  skipSignal?: number
}) {
  const [n, setN] = useState(0)
  const done = useRef(false)
  const cb = useRef(onDone)
  cb.current = onDone

  useEffect(() => {
    setN(0)
    done.current = false
    let cancelled = false
    let t: number

    const step = (i: number) => {
      if (cancelled) return
      if (i >= text.length) {
        done.current = true
        cb.current?.()
        return
      }
      setN(i + 1)
      const extra = pauseAfter(text[i], text[i + 1] ?? '')
      // a little jitter so it does not sound like a machine
      t = window.setTimeout(() => step(i + 1), BASE + Math.random() * 22 + extra)
    }

    t = window.setTimeout(() => step(0), startDelay)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [text, startDelay])

  // external skip
  useEffect(() => {
    if (skipSignal > 0 && !done.current) {
      setN(text.length)
      done.current = true
      cb.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipSignal])

  const shown = text.slice(0, n)
  const running = n < text.length

  return (
    <div className={className}>
      {shown}
      {running && <i className="caret" />}
    </div>
  )
}

/**
 * Plays an ordered list of lines, each one typed, each one staying on screen.
 * Click anywhere to hurry the current line, then the next, and so on.
 */
export function Script({
  lines,
  onComplete,
}: {
  lines: { kind: 'narrator' | 'said' | 'reply'; text: string }[]
  onComplete?: () => void
}) {
  const [visible, setVisible] = useState(1)
  const [skip, setSkip] = useState(0)
  const [lineDone, setLineDone] = useState(false)

  useEffect(() => {
    setVisible(1)
    setSkip(0)
    setLineDone(false)
  }, [lines])

  const hurry = () => {
    if (!lineDone) {
      setSkip((s) => s + 1)
    } else if (visible < lines.length) {
      setVisible((v) => v + 1)
      setLineDone(false)
    }
  }

  const onLineDone = () => {
    setLineDone(true)
    if (visible >= lines.length) onComplete?.()
    else {
      const t = setTimeout(() => {
        setVisible((v) => Math.min(lines.length, v + 1))
        setLineDone(false)
      }, 520)
      return () => clearTimeout(t)
    }
  }

  return (
    <div className="stack tap-on" onClick={hurry}>
      {lines.slice(0, visible).map((l, i) => (
        <Typewriter
          key={`${i}-${l.text.slice(0, 12)}`}
          text={l.text}
          className={`speech -${l.kind}`}
          skipSignal={i === visible - 1 ? skip : 1}
          onDone={i === visible - 1 ? onLineDone : undefined}
        />
      ))}
    </div>
  )
}
