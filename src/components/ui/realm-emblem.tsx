import type { ReactNode, SVGProps } from 'react'

export type RealmEmblemName =
  | 'crest'
  | 'quest'
  | 'reward'
  | 'streak'
  | 'bounty'
  | 'family'
  | 'dungeon'
  | 'curse'
  | 'shield'
  | 'scroll'
  | 'spark'

interface RealmEmblemProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: RealmEmblemName
  size?: number
  title?: string
}

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/**
 * ChoreQuest's own emblem language. These marks are intentionally bolder than
 * utility icons: they carry the world-building, category, and brand moments.
 */
export function RealmEmblem({ name, size = 28, title, className, ...props }: RealmEmblemProps) {
  const label = title ?? name

  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{label}</title> : null}

      {name === 'crest' && (
        <>
          <path d="M24 4 40 10v12c0 10-6.7 17.8-16 22C14.7 39.8 8 32 8 22V10L24 4Z" fill="currentColor" opacity=".18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m24 12 2.5 6.2 6.7.5-5.1 4.3 1.6 6.5-5.7-3.5-5.7 3.5 1.6-6.5-5.1-4.3 6.7-.5L24 12Z" fill="currentColor" stroke="none" />
          <path d="m17 34 7 4 7-4" {...common} strokeWidth="2.2" />
        </>
      )}

      {name === 'quest' && (
        <>
          <path d="m13 36 18-18" {...common} strokeWidth="3.2" />
          <path d="m28 13 7 7-4 4-7-7 4-4Z" fill="currentColor" stroke="none" />
          <path d="m12 37 7-2-5-5-2 7Z" fill="currentColor" stroke="none" />
          <path d="M36 9v8M32 13h8" {...common} strokeWidth="2.5" />
        </>
      )}

      {name === 'reward' && (
        <>
          <path d="M9 19h30v22H9z" fill="currentColor" opacity=".16" stroke="currentColor" strokeWidth="2.6" />
          <path d="M7 13h34v8H7z" fill="currentColor" opacity=".28" stroke="currentColor" strokeWidth="2.6" />
          <path d="M24 13v28M18 13c-5 0-7-3-5-6 2-3 7-1 11 6m6 0c5 0 7-3 5-6-2-3-7-1-11 6" {...common} strokeWidth="2.2" />
        </>
      )}

      {name === 'streak' && (
        <path d="M27 4c1.2 8.1-4.7 9.6-3.5 15.4 1-2.3 3.1-3.8 5.8-4.5 2.9 3.1 5.2 6.5 5.2 11.1C34.5 34.3 30 40 23.1 40 15.2 40 10 34.3 10 27.1c0-6.1 4-11.1 8.5-15.7-.2 4.8 2.2 7.3 3.9 8.6C23.1 14.1 25.1 8.7 27 4Z" fill="currentColor" opacity=".9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      )}

      {name === 'bounty' && (
        <>
          <path d="m27 4-16 22h11l-2 18 17-24H26l1-16Z" fill="currentColor" opacity=".86" stroke="currentColor" strokeWidth="2.1" />
          <path d="m31 9-4 7" {...common} stroke="white" strokeOpacity=".5" strokeWidth="1.5" />
        </>
      )}

      {name === 'family' && (
        <>
          <circle cx="24" cy="15" r="5" fill="currentColor" opacity=".9" />
          <circle cx="11.5" cy="20" r="4" fill="currentColor" opacity=".65" />
          <circle cx="36.5" cy="20" r="4" fill="currentColor" opacity=".65" />
          <path d="M14 39c.5-7 4-11 10-11s9.5 4 10 11M4 37c.3-5 2.8-8 7.5-8 2.4 0 4.3.8 5.6 2.3M44 37c-.3-5-2.8-8-7.5-8-2.4 0-4.3.8-5.6 2.3" {...common} strokeWidth="2.4" />
        </>
      )}

      {name === 'dungeon' && (
        <>
          <path d="M7 40V19L24 7l17 12v21H7Z" fill="currentColor" opacity=".16" stroke="currentColor" strokeWidth="2.5" />
          <path d="M18 40V28h12v12M14 21h4M30 21h4M24 7v7" {...common} strokeWidth="2.3" />
          <path d="M24 17v5" {...common} strokeWidth="2.3" />
        </>
      )}

      {name === 'curse' && (
        <>
          <path d="M12 22c0-7 5.4-12 12-12s12 5 12 12v9c0 5-5 9-12 9s-12-4-12-9v-9Z" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="19" cy="25" r="2.2" fill="currentColor" />
          <circle cx="29" cy="25" r="2.2" fill="currentColor" />
          <path d="M17 33c4 3 10 3 14 0M12 18l-4-4M36 18l4-4" {...common} strokeWidth="2.4" />
        </>
      )}

      {name === 'shield' && (
        <>
          <path d="M24 5 39 11v11c0 9-6.1 16.1-15 20-8.9-3.9-15-11-15-20V11l15-6Z" fill="currentColor" opacity=".18" stroke="currentColor" strokeWidth="2.6" />
          <path d="m16 24 5.2 5.2L32 18.5" {...common} strokeWidth="3.1" />
        </>
      )}

      {name === 'scroll' && (
        <>
          <path d="M12 8h23v32H12a5 5 0 0 1 0-10h23" fill="currentColor" opacity=".14" stroke="currentColor" strokeWidth="2.5" />
          <path d="M18 17h11M18 24h11M18 31h7" {...common} strokeWidth="2.2" />
        </>
      )}

      {name === 'spark' && (
        <path d="m24 4 3.7 14.3L42 24l-14.3 3.7L24 42l-3.7-14.3L6 24l14.3-5.7L24 4Z" fill="currentColor" opacity=".84" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      )}
    </svg>
  )
}

export function CoinMark({ size = 18, className, title, ...props }: Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & { size?: number; title?: string }) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <circle cx="16" cy="16" r="13" fill="currentColor" opacity=".22" stroke="currentColor" strokeWidth="2" />
      <path d="m16 7 2.3 5.7 5.7.5-4.3 3.7 1.3 5.6-5-3-5 3 1.3-5.6L8 13.2l5.7-.5L16 7Z" fill="currentColor" />
      <circle cx="11" cy="10" r="1.5" fill="white" opacity=".65" />
    </svg>
  )
}

export function IconMedallion({ name, size = 'md', className, children }: {
  name: RealmEmblemName
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children?: ReactNode
}) {
  const dimensions = size === 'sm' ? 'h-10 w-10 rounded-xl' : size === 'lg' ? 'h-16 w-16 rounded-2xl' : 'h-12 w-12 rounded-2xl'
  const iconSize = size === 'sm' ? 21 : size === 'lg' ? 34 : 27
  return (
    <span className={`inline-flex shrink-0 items-center justify-center bg-cq-medallion text-cq-gold ${dimensions} ${className ?? ''}`}>
      <RealmEmblem name={name} size={iconSize} />
      {children}
    </span>
  )
}
