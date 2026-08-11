import type { CSSProperties, ReactNode } from 'react'

/**
 * Three stacked passes: a dark bevel behind, the lit gradient face, and a sheen
 * that travels across on a slow loop. The bevel and sheen are drawn from
 * data-text, so the text must be a plain string.
 */
export function Gold({
  children,
  className = '',
  style,
  quiet,
  still,
  as: Tag = 'span',
}: {
  children: string
  className?: string
  style?: CSSProperties
  quiet?: boolean
  still?: boolean
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'div'
}) {
  return (
    <Tag
      className={`gold ${quiet ? '-quiet' : ''} ${still ? '-still' : ''} ${className}`}
      data-text={children}
      style={style}
    >
      {children}
    </Tag>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>
}
