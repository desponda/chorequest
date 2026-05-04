import type { KidColor, QuestTier } from './types'

export const TIER_CONFIG: Record<QuestTier, {
  label: string
  icon: string
  color: string
  bg: string
  border: string
  glow: string | null
}> = {
  normal: {
    label: 'Common',
    icon: '⚔️',
    color: 'rgba(255,255,255,0.55)',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.1)',
    glow: null,
  },
  heroic: {
    label: 'Heroic',
    icon: '🔵',
    color: '#38bdf8',
    bg: 'linear-gradient(135deg, rgba(56,189,248,0.14) 0%, rgba(56,189,248,0.05) 100%)',
    border: 'rgba(56,189,248,0.48)',
    glow: '0 0 20px rgba(56,189,248,0.2), 0 0 0 1px rgba(56,189,248,0.14)',
  },
  legendary: {
    label: 'Legendary',
    icon: '🌟',
    color: '#fbbf24',
    bg: 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.07) 100%)',
    border: 'rgba(251,191,36,0.55)',
    glow: '0 0 28px rgba(251,191,36,0.28), 0 0 0 1px rgba(251,191,36,0.2)',
  },
  epic: {
    label: 'Epic',
    icon: '💜',
    color: '#a78bfa',
    bg: 'linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0.07) 100%)',
    border: 'rgba(167,139,250,0.55)',
    glow: '0 0 28px rgba(167,139,250,0.28), 0 0 0 1px rgba(167,139,250,0.2)',
  },
}

export { QUEST_ICON_KEYS as QUEST_ICONS, KID_AVATAR_KEYS as KID_AVATARS } from './icons'

export const KID_COLORS: Record<KidColor, {
  primary: string
  glow: string
  bg: string
  border: string
  gradient: string
  tailwindText: string
  cardGlow: string
}> = {
  azure: {
    primary: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.35)',
    bg: 'rgba(56, 189, 248, 0.07)',
    border: 'rgba(56, 189, 248, 0.22)',
    gradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(56, 189, 248, 0.03))',
    tailwindText: 'text-cq-azure',
    cardGlow: 'quest-card-glow-azure',
  },
  mystic: {
    primary: '#a78bfa',
    glow: 'rgba(167, 139, 250, 0.35)',
    bg: 'rgba(167, 139, 250, 0.07)',
    border: 'rgba(167, 139, 250, 0.22)',
    gradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.12), rgba(167, 139, 250, 0.03))',
    tailwindText: 'text-cq-mystic',
    cardGlow: 'quest-card-glow-mystic',
  },
}

export function getStreakBonus(streak: number): number {
  if (streak >= 14) return 2.0
  if (streak >= 7) return 1.5
  if (streak >= 3) return 1.25
  return 1.0
}

export function getStreakLabel(streak: number): string | null {
  if (streak >= 14) return '2× COINS!'
  if (streak >= 7) return '1.5× COINS!'
  if (streak >= 3) return '+25% BONUS'
  return null
}

/** Returns the lockout duration in ms for a given number of failed PIN attempts. */
export function getLockDurationMs(attempts: number): number {
  return attempts >= 8 ? 5 * 60_000 : 30_000
}

export const DEFAULT_QUESTS = [
  { title: 'Make Your Bed', icon: 'GiBed', coins: 10, description: 'Straighten covers and fluff pillows' },
  { title: 'Brush Teeth', icon: 'GiToothbrush', coins: 5, description: 'Morning and evening' },
  { title: 'Tidy Your Room', icon: 'GiBroom', coins: 15, description: 'Put everything in its place' },
  { title: 'Help with Dinner', icon: 'GiCookingPot', coins: 20, description: 'Set the table or help prepare' },
  { title: 'Do Homework', icon: 'GiWhiteBook', coins: 15, description: 'Complete all assignments' },
  { title: 'Feed the Pets', icon: 'GiFlowerPot', coins: 10, description: 'Fill food and water bowls' },
  { title: 'Take Out Trash', icon: 'GiTrashCan', coins: 15, description: 'Empty bins and take bags out' },
]
