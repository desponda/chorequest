import React from 'react'
import { getIcon } from '@/lib/icons'

interface AppIconProps {
  icon: string
  size?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Renders a game icon SVG from the registry, or falls back to rendering
 * the value as an emoji span — ensuring old emoji values in the DB still display.
 */
export function AppIcon({ icon, size = 24, color, className, style }: AppIconProps) {
  const Icon = getIcon(icon)

  if (Icon) {
    return React.createElement(Icon, {
      size,
      color,
      className,
      style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style },
    })
  }

  // Emoji / legacy fallback
  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block', flexShrink: 0, ...style }}
    >
      {icon}
    </span>
  )
}
