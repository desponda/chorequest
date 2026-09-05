import type { QuestKind } from '@/lib/types'
import { RealmIcon } from './realm-icon'

const KIND_CONFIG: Partial<Record<QuestKind, { label: string; icon: string; color: string; bg: string; border: string }>> = {
  shared: {
    label: 'Shared',
    icon: '⚡',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.25)',
  },
  oneoff: {
    label: 'One-time',
    icon: '⭐',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.2)',
  },
}

export function KindBadge({ kind }: { kind: QuestKind }) {
  const cfg = KIND_CONFIG[kind]
  if (!cfg) return null
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      <span className="inline-flex items-center gap-1"><RealmIcon name={cfg.icon} size={11} /> {cfg.label}</span>
    </span>
  )
}
