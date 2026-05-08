import type { QuestTier } from '@/lib/types'
import { TIER_CONFIG } from '@/lib/constants'

export function TierBadge({ tier }: { tier: QuestTier | null | undefined }) {
  const resolved = tier ?? 'normal'
  if (resolved === 'normal') return null
  const cfg = TIER_CONFIG[resolved]
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
      style={{
        background: `${cfg.color}18`,
        color: cfg.color,
        border: `1px solid ${cfg.color}40`,
      }}
    >
      {cfg.label}
    </span>
  )
}
